import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  View,
  FlatList,
  TextInput as RNTextInput,
  SafeAreaView,
} from 'react-native';
import {
  Text,
  useTheme,
  IconButton,
  Avatar,
  Chip,
  ActivityIndicator,
} from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import {
  getConversation,
  markConversationAsRead,
  sendMessage,
  type ChatMessage,
} from '../../api/chat.api';
import { Background } from '../../components/Background';
import { argon2id } from '@noble/hashes/argon2';
import { utf8ToBytes } from '@noble/hashes/utils';
import { sha256 } from '@noble/hashes/sha2';
import { gcm } from '@noble/ciphers/aes';
import * as Crypto from 'expo-crypto';
import { Buffer } from 'buffer';

const toBase64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');
const fromBase64 = (value: string) => new Uint8Array(Buffer.from(value, 'base64'));

export const ChatConversationScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();

  const peerIdParam = route.params?.peerId;
  const peerName = route.params?.peerName ?? 'Conversation';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [targetIdError, setTargetIdError] = useState(false);

  const listRef = useRef<FlatList<ChatMessage>>(null);
  const inputRef = useRef<RNTextInput | null>(null);

  const resolvedPeerId = useMemo(() => {
    if (peerIdParam) return peerIdParam;
    if (!user?.id) return null;
    const other = messages.find(
      (m) => m.sender?.id !== user.id || m.recipient?.id !== user.id,
    );
    if (!other) return null;
    if (other.sender?.id && other.sender.id !== user.id) return other.sender.id;
    if (other.recipient?.id && other.recipient.id !== user.id) return other.recipient.id;
    return null;
  }, [messages, peerIdParam, user?.id]);

  const conversationKey = useMemo(() => {
    const peerId = peerIdParam ?? resolvedPeerId;
    if (!user?.id || !peerId) return null;
    const salt = sha256(utf8ToBytes('psy2bib-chat-salt'));
    const material = utf8ToBytes(`psy2bib-chat:${[String(user.id), String(peerId)].sort().join(':')}`);
    // Paramètres optimisés pour la fluidité mobile (m: 1024 = 1Mo RAM, t: 1 itération)
    return argon2id(material, salt, { m: 1024, t: 1, p: 1, dkLen: 32 });
  }, [user?.id, peerIdParam, resolvedPeerId]);

  const decryptMessage = (msg: ChatMessage) => {
    if (!conversationKey) return msg.encryptedContent;
    try {
      const cipher = gcm(conversationKey, fromBase64(msg.iv));
      const plain = cipher.decrypt(fromBase64(msg.encryptedContent));
      return Buffer.from(plain).toString('utf8');
    } catch {
      return msg.encryptedContent;
    }
  };

  const loadMessages = async () => {
    const targetId = peerIdParam ?? resolvedPeerId;
    if (!targetId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getConversation(targetId);
      const data = Array.isArray(res.data) ? res.data : [];
      data.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      setMessages(data);
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ??
        e?.message ??
        'Impossible de charger la conversation';
      setError(msg);
      console.warn('[chat-conversation] load error', msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages().then(() => {
      const targetId = peerIdParam ?? resolvedPeerId;
      if (targetId) markConversationAsRead(targetId).catch(() => {});
    });
  }, [peerIdParam, resolvedPeerId]);

  const handleSend = async () => {
    const content = inputValue.trim();
    const targetId = resolvedPeerId ?? peerIdParam;
    if (!content || !targetId || !user?.id) {
      if (!targetId) setTargetIdError(true);
      return;
    }
    setTargetIdError(false);

    setSending(true);
    try {
      let iv = 'plaintext';
      let encrypted = content;
      if (conversationKey) {
        const ivBytes = Crypto.getRandomBytes(12);
        const cipher = gcm(conversationKey, ivBytes);
        const ciphertext = cipher.encrypt(utf8ToBytes(content));
        iv = toBase64(ivBytes);
        encrypted = toBase64(ciphertext);
      }

      const optimistic: ChatMessage = {
        id: `temp-${Date.now()}`,
        encryptedContent: encrypted,
        iv,
        sender: { id: user.id },
        recipient: { id: targetId },
        createdAt: new Date().toISOString(),
        isRead: true,
      };
      setMessages((prev) => [...prev, optimistic]);
      setInputValue('');

      const res = await sendMessage(targetId, encrypted, iv);
      const saved = res.data;
      setMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? saved : m)),
      );
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ?? e?.message ?? 'Envoi impossible';
      setError(msg);
      console.warn('[chat-conversation] send error', msg);
      setMessages((prev) => prev.filter((m) => !m.id.startsWith('temp-')));
      setInputValue(content);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMe = item.sender?.id === user?.id;
    const timeLabel = new Date(item.createdAt).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const text = decryptMessage(item);
    const showAvatar = !isMe;
    const peerInitial =
      (peerName && peerName.trim()[0]?.toUpperCase()) || 'P';
    const isRead = !!item.isRead;

    return (
      <View
        style={{
          flexDirection: 'row',
          justifyContent: isMe ? 'flex-end' : 'flex-start',
          marginVertical: 4,
          paddingHorizontal: 12,
        }}
      >
        {!isMe && showAvatar && (
          <Avatar.Text
            size={28}
            label={peerInitial}
            style={{
              marginRight: 8,
              backgroundColor: 'rgba(129,140,248,0.15)',
            }}
            color={theme.colors.primary}
          />
        )}

        <View
          style={{
            maxWidth: '80%',
            backgroundColor: isMe
              ? theme.colors.primary
              : theme.colors.surface,
            borderRadius: 18,
            borderBottomLeftRadius: isMe ? 18 : 4,
            borderBottomRightRadius: isMe ? 4 : 18,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderWidth: isMe ? 0 : 1,
            borderColor: isMe ? 'transparent' : theme.colors.outlineVariant,
            shadowColor: '#000',
            shadowOpacity: 0.05,
            shadowRadius: 3,
            shadowOffset: { width: 0, height: 1 },
          }}
        >
          <Text
            style={{
              color: isMe ? theme.colors.onPrimary : theme.colors.onSurface,
              fontSize: 14,
            }}
          >
            {text}
          </Text>

          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              alignItems: 'center',
              marginTop: 4,
            }}
          >
            <Text
              style={{
                fontSize: 10,
                color: isMe
                  ? theme.colors.onPrimary
                  : theme.colors.onSurfaceVariant,
                marginRight: 4,
              }}
            >
              {timeLabel}
            </Text>
            {isMe && (
              <Text
                style={{
                  fontSize: 10,
                  color: isRead ? '#2596F3' : theme.colors.onPrimary,
                }}
              >
                {isRead ? '✓✓' : '✓'}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Background>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
        >
        {/* HEADER (opaque, masque le Background) */}
        <View
          style={{
            paddingHorizontal: 12,
            paddingVertical: 10,
            paddingTop: Platform.OS === 'ios' ? 60 : 10, // Plus d'espace pour la status bar
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.colors.surface,
            borderBottomWidth: 1,
            borderBottomColor: theme.colors.outlineVariant,
          }}
        >
          <IconButton
            icon="arrow-left"
            size={22}
            onPress={() => navigation.goBack()}
            style={{ margin: 0, marginRight: 4 }}
          />
          <Avatar.Text
            size={32}
            label={
              (peerName && peerName.trim()[0]?.toUpperCase()) || 'P'
            }
            style={{
              marginRight: 8,
              backgroundColor: 'rgba(129,140,248,0.18)',
            }}
            color={theme.colors.primary}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: '600',
                color: theme.colors.onSurface,
              }}
              numberOfLines={1}
            >
              {peerName}
            </Text>
            <Text
              style={{
                fontSize: 11,
                color: theme.colors.onSurfaceVariant,
              }}
            >
              Discussion privée
            </Text>
          </View>
        </View>

        {/* BANDEAU CHIFFREMENT (fond transparent, pill visible) */}
        <View
          style={{
            paddingHorizontal: 16,
            paddingVertical: 6,
            backgroundColor: 'transparent', // <--- laisse voir le Background
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 999,
              backgroundColor: 'rgba(248,250,252,0.95)',
            }}
          >
            <IconButton
              icon="shield-lock-outline"
              size={18}
              style={{
                margin: 0,
                marginRight: 4,
              }}
              iconColor={theme.colors.primary}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 12,
                  color: theme.colors.onSurface,
                  fontWeight: '600',
                }}
              >
                Confidentialité Zero-Knowledge
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: theme.colors.onSurfaceVariant,
                }}
              >
                Seuls vous et votre interlocuteur pouvez lire ces messages.
              </Text>
            </View>
          </View>
        </View>

        {/* LISTE MESSAGES (totalement transparente pour voir le Background) */}
        <View
          style={{
            flex: 1,
            backgroundColor: 'transparent',
          }}
        >
          {error && (
            <View style={{ paddingHorizontal: 16, paddingVertical: 6 }}>
              <Chip
                icon="alert-circle-outline"
                mode="outlined"
                style={{ borderColor: theme.colors.error }}
                textStyle={{ color: theme.colors.error, fontSize: 11 }}
              >
                {error}
              </Chip>
            </View>
          )}
          {targetIdError && (
            <View style={{ paddingHorizontal: 16, paddingVertical: 6 }}>
              <Chip
                icon="account-alert"
                mode="outlined"
                style={{ borderColor: theme.colors.error }}
                textStyle={{ color: theme.colors.error, fontSize: 11 }}
              >
                Destinataire introuvable. Essayez depuis la liste de messages ou via un rendez-vous confirmé.
              </Chip>
            </View>
          )}

          {loading && messages.length === 0 ? (
            <View
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ActivityIndicator animating={true} />
              <Text
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  color: theme.colors.onSurfaceVariant,
                }}
              >
                Chargement de la conversation…
              </Text>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              contentContainerStyle={{
                paddingVertical: 8,
                paddingBottom: 32,
              }}
              onContentSizeChange={() => {
                listRef.current?.scrollToEnd({ animated: true });
              }}
              onLayout={() => {
                listRef.current?.scrollToEnd({ animated: false });
              }}
              ListEmptyComponent={
                !loading ? (
                  <View
                    style={{
                      flex: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingVertical: 40,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        color: theme.colors.onSurfaceVariant,
                        textAlign: 'center',
                        paddingHorizontal: 32,
                      }}
                    >
                      Aucun message pour l&apos;instant. Commence la
                      conversation avec {peerName}.
                    </Text>
                  </View>
                ) : null
              }
            />
          )}
        </View>

        {/* ZONE DE SAISIE – décalée un peu vers le haut */}
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 8,
            backgroundColor: 'transparent',
            marginBottom: Platform.OS === 'ios' ? 14 : 10, // <--- décale la zone de texte vers le haut
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              borderRadius: 999,
              backgroundColor: theme.colors.surface,
              paddingHorizontal: 10,
              paddingVertical: 6,
              shadowColor: '#000',
              shadowOpacity: 0.08,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
              borderWidth: 1,
              borderColor: theme.colors.outlineVariant,
            }}
          >
            <View
              style={{
                flex: 1,
                paddingVertical: Platform.OS === 'ios' ? 4 : 0,
                maxHeight: 120,
                justifyContent: 'center',
              }}
            >
              <RNTextInput
                ref={inputRef}
                value={inputValue}
                onChangeText={setInputValue}
                placeholder="Écrivez un message"
                placeholderTextColor={theme.colors.onSurfaceVariant}
                style={{
                  fontSize: 14,
                  color: theme.colors.onSurface,
                  padding: Platform.OS === 'android' ? 2 : 0,
                }}
                multiline
              />
            </View>

            <IconButton
              icon="send"
              mode="contained"
              onPress={handleSend}
              disabled={!inputValue.trim() || sending}
              style={{
                borderRadius: 999,
                margin: 0,
              }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Background>
  </SafeAreaView>
  );
};
