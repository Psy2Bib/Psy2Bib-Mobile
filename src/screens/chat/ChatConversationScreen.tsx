/**
 * @fileoverview Écran de conversation chiffrée entre patient et psychologue
 * 
 * NÉCESSITE L'INSTALLATION DE :
 * npx expo install expo-document-picker expo-file-system expo-sharing
 * 
 * Gère l'envoi de messages textes ET de fichiers chiffrés.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  View,
  FlatList,
  TextInput as RNTextInput,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import {
  Text,
  useTheme,
  IconButton,
  Avatar,
  Chip,
  ActivityIndicator,
  Menu,
  Divider,
} from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import {
  getConversation,
  markConversationAsRead,
  sendMessage,
  uploadAttachment,
  type ChatMessage,
} from '../../api/chat.api';
import { API_BASE, authStorage } from '../../api/client';
import { Background } from '../../components/Background';
import { argon2id } from '@noble/hashes/argon2';
import { utf8ToBytes } from '@noble/hashes/utils';
import { sha256 } from '@noble/hashes/sha2';
import { gcm } from '@noble/ciphers/aes';
import * as Crypto from 'expo-crypto';
import { Buffer } from 'buffer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const toBase64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');
const fromBase64 = (value: string) => new Uint8Array(Buffer.from(value, 'base64'));

export const ChatConversationScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const peerIdParam = route.params?.peerId;
  const peerName = route.params?.peerName ?? 'Conversation';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null); // ID du message en cours de dl
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [targetIdError, setTargetIdError] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

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

  const formatUserName = (u?: any) => {
    if (!u) return '';
    const last =
      u?.lastName ||
      u?.profile?.lastName ||
      u?.psychologistProfile?.lastName ||
      u?.user?.lastName ||
      u?.user?.profile?.lastName ||
      u?.user?.psychologistProfile?.lastName;
    
    const first =
      u?.firstName ||
      u?.profile?.firstName ||
      u?.psychologistProfile?.firstName ||
      u?.user?.firstName ||
      u?.user?.profile?.firstName ||
      u?.user?.psychologistProfile?.firstName;
    
    if (last || first) {
      const full = `${last ? String(last).toUpperCase() : ''} ${first ?? ''}`.trim();
      if (full) return full;
    }
    return u?.pseudo || u?.email || '';
  };

  const conversationKey = useMemo(() => {
    const peerId = peerIdParam ?? resolvedPeerId;
    if (!user?.id || !peerId) return null;
    const salt = sha256(utf8ToBytes('psy2bib-chat-salt'));
    const material = utf8ToBytes(
      `psy2bib-chat:${[String(user.id), String(peerId)].sort().join(':')}`
    );
    return argon2id(material, salt, { m: 1024, t: 1, p: 1, dkLen: 32 });
  }, [user?.id, peerIdParam, resolvedPeerId]);

  const decryptMessage = (msg: ChatMessage) => {
    if (!conversationKey) return msg.encryptedContent;
    try {
      const cipher = gcm(conversationKey, fromBase64(msg.iv));
      const plain = cipher.decrypt(fromBase64(msg.encryptedContent));
      const text = Buffer.from(plain).toString('utf8');
      
      // Si c'est un message avec pièce jointe, le contenu est un JSON
      if (msg.attachmentPath) {
        try {
          const meta = JSON.parse(text);
          return `📎 Fichier : ${meta.filename || 'Document'}`;
        } catch {
          return '📎 Fichier chiffré';
        }
      }
      return text;
    } catch {
      return 'Message illisible (erreur déchiffrement)';
    }
  };

  const getAttachmentMeta = (msg: ChatMessage) => {
    if (!conversationKey || !msg.attachmentPath) return null;
    try {
      const cipher = gcm(conversationKey, fromBase64(msg.iv));
      const plain = cipher.decrypt(fromBase64(msg.encryptedContent));
      const text = Buffer.from(plain).toString('utf8');
      return JSON.parse(text); // { filename, mimeType, ... }
    } catch {
      return null;
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
      const msg = e?.response?.data?.message ?? e?.message ?? 'Erreur chargement';
      setError(msg);
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

  const handleSendText = async () => {
    const content = inputValue.trim();
    const targetId = resolvedPeerId ?? peerIdParam;
    if (!content || !targetId || !user?.id) {
      if (!targetId) setTargetIdError(true);
      return;
    }
    setTargetIdError(false);
    setSending(true);
    try {
      if (conversationKey) {
        const ivBytes = Crypto.getRandomBytes(12);
        const iv = toBase64(ivBytes);
        const cipher = gcm(conversationKey, ivBytes);
        const ciphertext = cipher.encrypt(utf8ToBytes(content));
        const encrypted = toBase64(ciphertext);
        
        await sendMessage(targetId, encrypted, iv);
        setInputValue('');
        loadMessages();
      }
    } catch (e: any) {
      setError('Erreur envoi');
    } finally {
      setSending(false);
    }
  };

  const processFileAndSend = async (file: { uri: string; name: string; mimeType?: string; size?: number }) => {
    const targetId = resolvedPeerId ?? peerIdParam;
    if (!targetId || !user?.id || !conversationKey) return;
    
    setMenuVisible(false); // Fermer le menu si ouvert
    setSending(true);

    try {
      const fileContentBase64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: 'base64',
      });
      
      // IV spécifique pour le fichier
      const fileIvBytes = Crypto.getRandomBytes(12);
      const fileIv = toBase64(fileIvBytes);
      const fileCipher = gcm(conversationKey, fileIvBytes);
      const encryptedFileBytes = fileCipher.encrypt(Buffer.from(fileContentBase64, 'base64'));
      
      const tempUri = (FileSystem as any).cacheDirectory + `enc_${Date.now()}.enc`;
      await FileSystem.writeAsStringAsync(tempUri, toBase64(encryptedFileBytes), {
        encoding: 'base64',
      });

      const formData = new FormData();
      formData.append('file', {
        uri: tempUri,
        name: 'blob.enc',
        type: 'application/octet-stream',
      } as any);

      const uploadRes = await uploadAttachment(formData);
      
      // Méta-données incluant l'IV du fichier !
      const meta = JSON.stringify({
        filename: file.name,
        mimeType: file.mimeType || 'application/octet-stream',
        fileIv: fileIv
      });
      
      const msgIvBytes = Crypto.getRandomBytes(12);
      const msgIv = toBase64(msgIvBytes);
      const msgCipher = gcm(conversationKey, msgIvBytes);
      const metaEncrypted = msgCipher.encrypt(utf8ToBytes(meta));
      
      await sendMessage(targetId, toBase64(metaEncrypted), msgIv, uploadRes.data.path);
      
      await FileSystem.deleteAsync(tempUri, { idempotent: true });
      loadMessages();

    } catch (err) {
      console.error(err);
      setError("Erreur envoi fichier");
    } finally {
      setSending(false);
    }
  };

  const handlePickDocument = async () => {
    try {
      setMenuVisible(false);
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        type: '*/*',
      });

      if (result.canceled || !result.assets || !result.assets[0]) return;
      const asset = result.assets[0];
      
      await processFileAndSend({
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType,
        size: asset.size
      });

    } catch (err) {
      console.error(err);
      setMenuVisible(false);
    }
  };

  const handlePickImage = async () => {
    try {
      setMenuVisible(false);
      // Demander la permission si nécessaire (automatique sur Expo récent)
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.8,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets || !result.assets[0]) return;
      const asset = result.assets[0];

      // Extraction du nom de fichier depuis l'URI ou génération d'un nom
      const filename = asset.fileName || asset.uri.split('/').pop() || `image_${Date.now()}.jpg`;

      await processFileAndSend({
        uri: asset.uri,
        name: filename,
        mimeType: asset.type === 'video' ? 'video/mp4' : 'image/jpeg', // Simplification, peut être affiné
        size: asset.fileSize
      });

    } catch (err) {
      console.error(err);
      setMenuVisible(false);
    }
  };
  
  const handleDownload = async (msg: ChatMessage) => {
    if (!msg.attachmentPath || !conversationKey) return;
    setDownloading(msg.id);
    try {
      const meta = getAttachmentMeta(msg); // Contient { filename, fileIv }
      if (!meta || !meta.fileIv) throw new Error("Métadonnées invalides");
      
      const tokens = authStorage.getTokens();
      const remoteUri = `${API_BASE}/chat/attachment/${msg.attachmentPath.split('/').pop()}`;
      const localEncUri = (FileSystem as any).cacheDirectory + `dl_${msg.id}.enc`;
      
      const dlRes = await FileSystem.downloadAsync(remoteUri, localEncUri, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` }
      });
      
      if (dlRes.status !== 200) throw new Error("Erreur DL");
      
      const encBase64 = await FileSystem.readAsStringAsync(localEncUri, {
        encoding: 'base64', // Utilisation de la chaîne littérale
      });
      
      const fileCipher = gcm(conversationKey, fromBase64(meta.fileIv));
      const decryptedBytes = fileCipher.decrypt(new Uint8Array(Buffer.from(encBase64, 'base64')));
      
      const localDecUri = (FileSystem as any).cacheDirectory + (meta.filename || 'download.bin');
      await FileSystem.writeAsStringAsync(localDecUri, toBase64(decryptedBytes), {
        encoding: 'base64', // Utilisation de la chaîne littérale
      });
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(localDecUri);
      }
    } catch (e) {
      console.error(e);
      setError("Erreur téléchargement");
    } finally {
      setDownloading(null);
    }
  };

  const peerUser = useMemo(() => {
    const targetId = peerIdParam ?? resolvedPeerId;
    if (!targetId) return route.params?.peer ?? null;
    const msg = messages.find(
      (m) => m.sender?.id === targetId || m.recipient?.id === targetId,
    );
    if (!msg) return route.params?.peer ?? null;
    if (msg.sender?.id === targetId) return msg.sender as any;
    if (msg.recipient?.id === targetId) return msg.recipient as any;
    return route.params?.peer ?? null;
  }, [messages, peerIdParam, resolvedPeerId, route.params?.peer]);

  const peerDisplayName = useMemo(() => {
    const fromMsg = formatUserName(peerUser);
    const fromRoute = route.params?.peerName;
    return fromMsg || fromRoute || 'Conversation';
  }, [peerUser, route.params?.peerName]);

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMe = item.sender?.id === user?.id;
    const timeLabel = new Date(item.createdAt).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const text = decryptMessage(item);
    const isAttachment = !!item.attachmentPath;
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
        <View
          style={{
            maxWidth: '80%',
            backgroundColor: isMe ? theme.colors.primary : theme.colors.surface,
            borderRadius: 18,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderWidth: isMe ? 0 : 1,
            borderColor: theme.colors.outlineVariant,
          }}
        >
          {isAttachment ? (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <IconButton 
                  icon="file-document-outline" 
                  size={20} 
                  iconColor={isMe ? theme.colors.onPrimary : theme.colors.primary}
                  style={{ margin: 0 }}
                />
                <Text
                  style={{
                    color: isMe ? theme.colors.onPrimary : theme.colors.onSurface,
                    fontSize: 14,
                    flex: 1,
                    fontWeight: 'bold',
                  }}
                  numberOfLines={1}
                >
                  {text.replace('📎 Fichier : ', '')}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleDownload(item)}
                disabled={!!downloading}
                style={{
                  backgroundColor: 'rgba(0,0,0,0.1)',
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 8,
                  alignItems: 'center',
                }}
              >
                {downloading === item.id ? (
                  <ActivityIndicator size={16} color={isMe ? 'white' : theme.colors.primary} />
                ) : (
                  <Text style={{ color: isMe ? 'white' : theme.colors.primary, fontSize: 12 }}>
                    Télécharger & Ouvrir
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
          <Text
            style={{
              color: isMe ? theme.colors.onPrimary : theme.colors.onSurface,
              fontSize: 14,
            }}
          >
            {text}
          </Text>
          )}

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 }}>
            <Text
              style={{
                fontSize: 10,
                color: isMe ? theme.colors.onPrimary : theme.colors.onSurfaceVariant,
                marginRight: 4,
              }}
            >
              {timeLabel}
            </Text>
            {isMe && (
              <Text style={{ fontSize: 10, color: isRead ? '#2596F3' : theme.colors.onPrimary }}>
                {isRead ? '✓✓' : '✓'}
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <Background>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
        >
          <View style={{ paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surface }}>
            <IconButton icon="arrow-left" size={22} onPress={() => navigation.goBack()} />
            <Avatar.Text size={32} label={(peerName && peerName[0]) || 'P'} style={{ marginRight: 8, backgroundColor: 'rgba(129,140,248,0.18)' }} color={theme.colors.primary} />
            <View>
              <Text style={{ fontSize: 16, fontWeight: '600' }}>{peerDisplayName}</Text>
              <Text style={{ fontSize: 11, color: theme.colors.onSurfaceVariant }}>Discussion sécurisée</Text>
          </View>
        </View>

          <View style={{ flex: 1, backgroundColor: 'transparent' }}>
            {error && <Chip icon="alert" style={{ margin: 10 }}>{error}</Chip>}
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              contentContainerStyle={{ paddingVertical: 8 }}
              onContentSizeChange={() => listRef.current?.scrollToEnd()}
            />
        </View>

          <View style={{ padding: 10, backgroundColor: 'transparent' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: 25, padding: 5, borderWidth: 1, borderColor: theme.colors.outlineVariant }}>
              
              <Menu
                visible={menuVisible}
                onDismiss={() => setMenuVisible(false)}
                anchor={
                  <IconButton
                    icon="paperclip"
                    size={22}
                    onPress={() => setMenuVisible(true)}
                    disabled={sending}
                    iconColor={theme.colors.primary}
                  />
                }
              >
                <Menu.Item 
                  onPress={handlePickImage} 
                  title="Photo / Vidéo" 
                  leadingIcon="image"
                />
                <Divider />
                <Menu.Item 
                  onPress={handlePickDocument} 
                  title="Document" 
                  leadingIcon="file-document"
                />
              </Menu>

              <RNTextInput
                ref={inputRef}
                value={inputValue}
                onChangeText={setInputValue}
                placeholder="Message chiffré..."
                style={{ flex: 1, maxHeight: 100, paddingHorizontal: 10 }}
                multiline
              />
            <IconButton
              icon="send"
              mode="contained"
                onPress={handleSendText}
              disabled={!inputValue.trim() || sending}
                style={{ borderRadius: 25 }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Background>
  </SafeAreaView>
  );
};
