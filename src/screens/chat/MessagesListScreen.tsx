/**
 * @fileoverview Écran de liste des conversations (threads)
 * 
 * Affiche toutes les conversations de l'utilisateur avec aperçu du dernier message.
 * Compatible patient ET psychologue.
 * 
 * Fonctionnalités :
 * - Liste des threads triée par dernier message (plus récent en haut)
 * - Badge "non lu" si unreadCount > 0
 * - Déchiffrement des aperçus de messages (E2EE) en temps réel
 * - Pull-to-refresh pour actualiser
 * - Navigation vers ChatConversationScreen au clic
 * - Bottom bar adaptée au rôle (PatientBottomBar ou PsyBottomBar)
 * 
 * Crypto :
 * - Chaque aperçu de message est déchiffré avec la clé de conversation
 * - Même mécanisme que ChatConversationScreen (Argon2id + AES-GCM)
 * - Si le déchiffrement échoue → Affiche le ciphertext brut
 * 
 * Gestion d'erreurs :
 * - Si backend ne supporte pas /chat/threads → Fallback gracieux
 * - Message "Aucune conversation" si liste vide
 * - Retry automatique au focus (useFocusEffect)
 * 
 * @author Psy2Bib Team
 * @since 1.0.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, FlatList, RefreshControl, SafeAreaView } from 'react-native';
import {
  List,
  Avatar,
  Text,
  useTheme,
  ActivityIndicator,
  Chip,
  IconButton,
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { getThreads, type ChatThread } from '../../api/chat.api';
import { Background } from '../../components/Background';
import { PatientBottomBar } from '../../components/PatientBottomBar';
import { PsyBottomBar } from '../../components/PsyBottomBar';
import { argon2id } from '@noble/hashes/argon2';
import { sha256 } from '@noble/hashes/sha2';
import { utf8ToBytes } from '@noble/hashes/utils';
import { gcm } from '@noble/ciphers/aes';
import { Buffer } from 'buffer';

/** Utilitaire pour décoder base64 → Uint8Array */
const fromBase64 = (value: string) => new Uint8Array(Buffer.from(value, 'base64'));

/**
 * Écran de liste des conversations.
 * 
 * État local :
 * - threads : Liste des conversations (ChatThread[])
 * - loading : Chargement initial
 * - refreshing : Pull-to-refresh en cours
 * - error : Message d'erreur
 * - threadsSupported : Le backend supporte-t-il /chat/threads ?
 * 
 * @returns {JSX.Element} Liste des conversations avec déchiffrement E2EE
 */
export const MessagesListScreen: React.FC = () => {
  const theme = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<any>();

  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threadsSupported, setThreadsSupported] = useState(true);

  const decryptPreview = (thread: ChatThread) => {
    try {
      if (!user?.id || !thread.peer?.id || !thread.lastMessage)
        return thread.lastMessage?.encryptedContent || '';
      const salt = sha256(utf8ToBytes('psy2bib-chat-salt'));
      const material = utf8ToBytes(
        `psy2bib-chat:${[String(user.id), String(thread.peer.id)].sort().join(':')}`,
      );
      const key = argon2id(material, salt, { m: 1024, t: 1, p: 1, dkLen: 32 });
      const cipher = gcm(key, fromBase64(thread.lastMessage.iv));
      const plain = cipher.decrypt(fromBase64(thread.lastMessage.encryptedContent));
      return Buffer.from(plain).toString('utf8');
    } catch {
      return thread.lastMessage?.encryptedContent || '';
    }
  };

  const loadThreads = useCallback(async () => {
    if (!threadsSupported) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getThreads();
      const data = Array.isArray(res.data) ? res.data : [];
      setThreads(data);
    } catch (e: any) {
      const status = e?.response?.status;
      const msg =
        e?.response?.data?.message ??
        e?.message ??
        'Erreur de chargement de la messagerie';
      if (status === 404) {
        setThreads([]);
        setThreadsSupported(false);
        setError('Messagerie non disponible (backend non à jour)');
      } else {
        setError(msg);
      }
      console.warn('[messages-list] load error', msg);
    } finally {
      setLoading(false);
    }
  }, [threadsSupported]);

  const refresh = useCallback(async () => {
    if (!threadsSupported) return;
    setRefreshing(true);
    try {
      const res = await getThreads();
      const data = Array.isArray(res.data) ? res.data : [];
      setThreads(data);
    } catch {
      // on ignore, on garde l'état courant
    } finally {
      setRefreshing(false);
    }
  }, [threadsSupported]);

  const getAttachmentLabel = () => 'Média';

  useFocusEffect(
    useCallback(() => {
      loadThreads();
    }, [loadThreads]),
  );

  const formatPeerName = (peer: ChatThread['peer']) => {
    if (!peer) return 'Utilisateur';
    const last =
      (peer as any)?.lastName ||
      (peer as any)?.profile?.lastName ||
      (peer as any)?.psychologistProfile?.lastName ||
      (peer as any)?.user?.lastName ||
      (peer as any)?.user?.profile?.lastName ||
      (peer as any)?.user?.psychologistProfile?.lastName;
    const first =
      (peer as any)?.firstName ||
      (peer as any)?.profile?.firstName ||
      (peer as any)?.psychologistProfile?.firstName ||
      (peer as any)?.user?.firstName ||
      (peer as any)?.user?.profile?.firstName ||
      (peer as any)?.user?.psychologistProfile?.firstName;
    if (last || first) {
      const full = `${last ? String(last).toUpperCase() : ''} ${first ?? ''}`.trim();
      if (full) return full;
    }
    return peer.pseudo || peer.email || 'Utilisateur';
  };

  const renderItem = ({ item }: { item: ChatThread }) => {
    const peer = item.peer;
    const last = item.lastMessage;
    const name = formatPeerName(peer);

    const preview = last ? decryptPreview(item) : '';
    const isAttachment = !!(last as any)?.attachmentPath;
    const subtitle = isAttachment ? `📎 ${getAttachmentLabel()}` : preview || 'Nouveau contact';

    return (
      <View
        style={{
          marginHorizontal: 12,
          marginVertical: 4,
          borderRadius: 18,
          overflow: 'hidden',
          backgroundColor: theme.colors.surface,
          shadowColor: '#000',
          shadowOpacity: 0.06,
          shadowRadius: 5,
          shadowOffset: { width: 0, height: 2 },
          borderWidth: 1,
          borderColor: 'rgba(148,163,184,0.25)',
        }}
      >
        <List.Item
          title={name}
          titleNumberOfLines={1}
          description={subtitle}
          descriptionNumberOfLines={1}
          onPress={() =>
            navigation.navigate('ChatConversation', {
              peerId: peer.id,
              peerName: name,
            })
          }
          left={() => (
            <Avatar.Text
              size={40}
              label={name.charAt(0).toUpperCase()}
              style={{
                marginLeft: 4,
                backgroundColor: 'rgba(129,140,248,0.2)',
              }}
              color={theme.colors.primary}
            />
          )}
          right={() =>
            item.unreadCount > 0 ? (
              <View
                style={{
                  minWidth: 24,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  marginRight: 8,
                  borderRadius: 999,
                  backgroundColor: theme.colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    color: theme.colors.onPrimary,
                    fontSize: 11,
                    fontWeight: '700',
                  }}
                >
                  {item.unreadCount}
                </Text>
              </View>
            ) : null
          }
          titleStyle={{
            fontSize: 15,
            fontWeight: '600',
            color: theme.colors.onSurface,
          }}
          descriptionStyle={{
            fontSize: 12,
            color: theme.colors.onSurfaceVariant,
          }}
          style={{ paddingVertical: 6 }}
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Background>
        <View style={{ flex: 1 }}>
        <View style={{ padding: 20 }}>
          <Text variant="headlineSmall" style={{ fontWeight: '700', color: theme.colors.primary }}>
            Messagerie
          </Text>
        </View>

          {/* Contenu sur Background visible (fond transparent) */}
          {loading && !refreshing ? (
            <View
              style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <ActivityIndicator />
              <Text
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  color: theme.colors.onSurfaceVariant,
                }}
              >
                Chargement de vos conversations…
              </Text>
            </View>
          ) : (
            <View style={{ flex: 1, backgroundColor: 'transparent' }}>
              {error && (
                <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                  <Chip
                    icon="alert-circle-outline"
                    mode="outlined"
                    style={{ borderColor: theme.colors.error }}
                    textStyle={{
                      color: theme.colors.error,
                      fontSize: 11,
                    }}
                  >
                    {error}
                  </Chip>
                </View>
              )}

              {!threadsSupported ? (
                <View
                  style={{
                    flex: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                    paddingHorizontal: 32,
                  }}
                >
                  <Text
                    style={{
                      textAlign: 'center',
                      color: theme.colors.onSurfaceVariant,
                      fontSize: 13,
                    }}
                  >
                    Messagerie non disponible pour le moment.{'\n'}
                    Votre application doit être connectée à un backend à jour.
                  </Text>
                </View>
              ) : threads.length === 0 ? (
                <View
                  style={{
                    flex: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                    paddingHorizontal: 32,
                  }}
                >
                  <Text
                    style={{
                      textAlign: 'center',
                      color: theme.colors.onSurfaceVariant,
                      fontSize: 13,
                    }}
                  >
                    Aucun contact pour l’instant.{'\n'}
                    Vos conversations apparaîtront ici dès qu’un rendez-vous sera
                    confirmé.
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={threads}
                  keyExtractor={(item) => item.id}
                  renderItem={renderItem}
                  refreshControl={
                    <RefreshControl
                      refreshing={refreshing}
                      onRefresh={refresh}
                      tintColor={theme.colors.primary}
                    />
                  }
                  contentContainerStyle={{
                    paddingTop: 8,
                    paddingBottom: 96,
                  }}
                />
              )}
            </View>
          )}
        </View>
        {user?.role === 'PSY' ? (
          <PsyBottomBar
            activeTab="messages"
            onPressHome={() => navigation.navigate('PsyDashboard')}
            onPressAvailability={() => navigation.navigate('PsyAvailability')}
            onPressAppointments={() => navigation.navigate('PsyAppointments')}
            onPressMessages={() => {}}
            onPressProfile={() => navigation.navigate('PsyProfile')}
          />
        ) : (
          <PatientBottomBar
            activeTab="messages"
            onPressHome={() => navigation.navigate('PatientDashboard')}
            onPressSearch={() => navigation.navigate('SearchPsy')}
            onPressAppointments={() => navigation.navigate('PatientAppointments')}
            onPressMessages={() => {}}
            onPressProfile={() => navigation.navigate('PatientProfile')}
          />
        )}
      </Background>
    </SafeAreaView>
  );
};
