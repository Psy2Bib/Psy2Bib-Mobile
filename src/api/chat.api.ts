/**
 * @fileoverview API de messagerie chiffrée de bout en bout (E2EE)
 * 
 * Ce module gère toutes les opérations de chat entre patients et psychologues.
 * Les messages sont chiffrés côté client avec AES-GCM avant envoi.
 * 
 * Architecture de sécurité (E2EE) :
 * - Chaque message est chiffré avec une clé dérivée du mot de passe des deux utilisateurs
 * - Le backend stocke uniquement les messages chiffrés (encryptedContent)
 * - Seuls l'émetteur et le destinataire peuvent déchiffrer les messages
 * - Un IV (Initialization Vector) unique est généré pour chaque message
 * 
 * Fonctionnalités :
 * - Liste des conversations (threads)
 * - Historique des messages d'une conversation
 * - Envoi de messages chiffrés
 * - Marquage des messages comme lus
 * - Compteur de messages non lus
 * 
 * @see crypto/zk.ts pour les fonctions de chiffrement AES-GCM
 * @author Psy2Bib Team
 * @since 1.0.0
 */

import { api } from './client';

/**
 * Structure d'un message dans une conversation.
 * 
 * Chaque message est chiffré individuellement avec AES-GCM.
 */
export interface ChatMessage {
  /** ID unique du message (UUID) */
  id: string;
  
  /** 
   * Contenu du message chiffré (base64).
   * Impossible à déchiffrer sans la clé de conversation.
   * 
   * Exemple (avant chiffrement) : "Bonjour, comment allez-vous ?"
   * Exemple (après chiffrement) : "U2FsdGVkX1+vupppZksvRf5pq5g5XjFRIipRkwB0K1Y="
   */
  encryptedContent: string;
  
  /** 
   * Vecteur d'initialisation (IV) pour AES-GCM (base64).
   * Unique pour chaque message, nécessaire pour déchiffrer.
   * Généré aléatoirement lors du chiffrement.
   * 
   * Longueur : 12 bytes (96 bits) pour AES-GCM
   */
  iv: string;
  
  /** Émetteur du message */
  sender: { 
    id: string; 
  };
  
  /** Destinataire du message */
  recipient: { 
    id: string; 
  };
  
  /** Date/heure d'envoi (ISO 8601) */
  createdAt: string;
  
  /** Le message a-t-il été lu par le destinataire ? */
  isRead?: boolean;
  
  /** Date/heure de lecture (null si pas encore lu) */
  readAt?: string | null;

  /** Chemin vers une pièce jointe chiffrée (optionnel) */
  attachmentPath?: string | null;
}

/**
 * Structure d'une conversation (thread) dans la liste des discussions.
 * 
 * Un thread regroupe tous les messages échangés entre deux utilisateurs.
 */
export interface ChatThread {
  /** ID du thread (UUID, souvent l'ID du peer pour simplifier) */
  id: string;
  
  /** 
   * L'autre utilisateur de la conversation.
   * Si je suis patient, peer = le psy. Si je suis psy, peer = le patient.
   */
  peer: { 
    id: string; 
    pseudo?: string; 
    email?: string; 
  };
  
  /** 
   * Dernier message de la conversation (pour l'affichage dans la liste).
   * Encore chiffré, il faut le déchiffrer pour l'afficher.
   * null si aucun message n'a encore été envoyé.
   */
  lastMessage?: {
    id: string;
    encryptedContent: string;
    iv: string;
    createdAt: string;
    sender: { id: string };
    recipient: { id: string };
  } | null;
  
  /** Nombre de messages non lus dans cette conversation */
  unreadCount: number;
}

/**
 * Récupère la liste de toutes mes conversations (threads).
 * 
 * Le backend renvoie automatiquement uniquement les conversations où
 * je suis participant (en tant qu'émetteur ou destinataire).
 * 
 * Triées par date du dernier message (plus récent en premier).
 * 
 * @returns Promise<ChatThread[]> - Liste des conversations
 * 
 * @example
 * ```typescript
 * const threads = await getThreads();
 * 
 * // Afficher la liste des conversations
 * threads.data.forEach(thread => {
 *   const lastMsg = thread.lastMessage;
 *   if (lastMsg) {
 *     const decrypted = await decryptMessage(lastMsg.encryptedContent, lastMsg.iv);
 *     console.log(`${thread.peer.pseudo}: ${decrypted}`);
 *   }
 * });
 * ```
 * 
 * @note Les messages (lastMessage) sont encore chiffrés, il faut les déchiffrer
 *       dans l'UI avec la clé de conversation.
 */
export const getThreads = () => 
  api.get<ChatThread[]>('/chat/threads');

/**
 * Récupère l'historique complet des messages avec un utilisateur.
 * 
 * Renvoie tous les messages échangés entre moi et l'utilisateur spécifié,
 * triés par date (plus ancien en premier).
 * 
 * @param userId - ID de l'utilisateur avec qui j'ai conversé
 * 
 * @returns Promise<ChatMessage[]> - Liste des messages (encore chiffrés)
 * 
 * @example
 * ```typescript
 * // Afficher la conversation avec le psy ID "abc-123"
 * const messages = await getConversation('abc-123');
 * 
 * for (const msg of messages.data) {
 *   const decrypted = await decryptMessage(msg.encryptedContent, msg.iv);
 *   const fromMe = msg.sender.id === myUserId;
 *   console.log(fromMe ? 'Moi' : 'Lui', ':', decrypted);
 * }
 * ```
 * 
 * @note Les messages sont encore chiffrés, il faut les déchiffrer un par un
 *       dans l'UI avec la clé de conversation.
 */
export const getConversation = (userId: string) =>
  api.get<ChatMessage[]>(`/chat/conversation/${userId}`);

/**
 * Marque tous les messages d'une conversation comme lus.
 * 
 * Appelé automatiquement quand l'utilisateur ouvre une conversation.
 * Met à jour isRead=true et readAt pour tous les messages non lus de cette conversation.
 * 
 * Impact :
 * - Le compteur de messages non lus diminue
 * - Les messages affichent "Lu à 14h30" dans l'UI de l'émetteur
 * 
 * @param userId - ID de l'utilisateur de la conversation
 * 
 * @returns Promise<void> - Pas de données retournées
 * 
 * @example
 * ```typescript
 * // Quand l'utilisateur ouvre la conversation avec le psy "abc-123"
 * useEffect(() => {
 *   markConversationAsRead('abc-123');
 * }, []);
 * ```
 */
export const markConversationAsRead = (userId: string) =>
  api.patch(`/chat/conversation/${userId}/read`);

/**
 * Récupère le nombre total de messages non lus (toutes conversations confondues).
 * 
 * Utilisé pour afficher le badge rouge dans l'onglet "Messages" du Bottom Tab Navigator.
 * 
 * @returns Promise<{ count: number }> - Nombre de messages non lus
 * 
 * @example
 * ```typescript
 * const unread = await getUnreadCount();
 * console.log('Vous avez', unread.data.count, 'message(s) non lu(s)');
 * 
 * // Affichage dans le badge
 * <Tab.Screen 
 *   name="Messages" 
 *   options={{ 
 *     tabBarBadge: unread.data.count > 0 ? unread.data.count : undefined 
 *   }} 
 * />
 * ```
 * 
 * @note Cette requête est souvent appelée au montage de l'app et lors d'un
 *       refresh du Bottom Tab Navigator pour mettre à jour le badge en temps réel.
 */
export const getUnreadCount = () => 
  api.get<{ count: number }>(`/chat/unread/count`);

/**
 * Envoie un message chiffré à un utilisateur.
 * 
 * Workflow complet d'envoi :
 * 1. L'utilisateur tape un message : "Bonjour docteur"
 * 2. Le message est chiffré avec AES-GCM + génération d'un IV unique
 * 3. Cette fonction envoie le message chiffré + IV au backend
 * 4. Le backend stocke le message (impossible pour lui de le lire)
 * 5. Le destinataire recevra le message et pourra le déchiffrer
 * 
 * @param recipientId - ID de l'utilisateur destinataire
 * @param encryptedContent - Message chiffré (base64)
 * @param iv - Vecteur d'initialisation (base64)
 * @param attachmentPath - Chemin du fichier joint chiffré (optionnel)
 * 
 * @returns Promise<ChatMessage> - Le message créé (avec son ID et timestamp)
 * 
 * @example
 * ```typescript
 * // 1. Chiffrer le message
 * const plainText = "Bonjour docteur, j'ai besoin d'aide";
 * const { encryptedContent, iv } = await encryptMessage(plainText, conversationKey);
 * 
 * // 2. Envoyer le message
 * const sentMessage = await sendMessage(
 *   'psy-id-123',
 *   encryptedContent,
 *   iv
 * );
 * 
 * console.log('Message envoyé à', sentMessage.data.createdAt);
 * ```
 * 
 * @security Le backend NE PEUT PAS lire le contenu du message.
 *           Seuls l'émetteur et le destinataire ont la clé de déchiffrement.
 * 
 * @note Pour implémenter une vraie E2EE avec forward secrecy, il faudrait
 *       utiliser le protocole Signal (Double Ratchet) au lieu d'une clé statique.
 */
export const sendMessage = (
  recipientId: string, 
  encryptedContent: string, 
  iv: string,
  attachmentPath?: string
) =>
  api.post('/chat/send', { recipientId, encryptedContent, iv, attachmentPath });

/**
 * Upload une pièce jointe chiffrée.
 * 
 * Le fichier doit être chiffré côté client AVANT l'upload.
 * Le serveur stocke le blob sans savoir ce qu'il contient.
 * 
 * @param formData - FormData contenant le fichier chiffré (champ 'file')
 * @returns Promise<{ path: string, filename: string }>
 */
export const uploadAttachment = (formData: FormData) =>
  api.post<{ path: string; filename: string }>('/chat/attachment', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
