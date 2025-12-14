/**
 * @fileoverview Module de cryptographie Zero-Knowledge (ZK) pour Psy2Bib
 * 
 * Ce fichier implémente toute la logique cryptographique de l'application :
 * - Hachage des mots de passe avec Argon2id (authentification)
 * - Chiffrement/déchiffrement AES-GCM (protection des données)
 * - Gestion du "vault" patient (coffre-fort Zero-Knowledge)
 * 
 * ═══════════════════════════════════════════════════════════════
 *  PRINCIPE ZERO-KNOWLEDGE (ZK)
 * ═══════════════════════════════════════════════════════════════
 * 
 * Le serveur ne connaît JAMAIS :
 * - Le mot de passe en clair
 * - Les données sensibles du profil patient (nom, prénom, date de naissance...)
 * 
 * Workflow d'inscription patient :
 * 1. L'utilisateur choisit un mot de passe
 * 2. On génère une "masterKey" aléatoire (clé maître de 32 bytes)
 * 3. Le profil patient est chiffré avec cette masterKey
 * 4. La masterKey est chiffrée avec une clé dérivée du mot de passe (Argon2id)
 * 5. On envoie au serveur : encryptedProfile + encryptedMasterKey + salt
 * 6. Le serveur stocke ces données mais ne peut rien déchiffrer
 * 
 * Workflow de connexion patient :
 * 1. Le serveur renvoie : encryptedProfile + encryptedMasterKey + salt
 * 2. L'utilisateur entre son mot de passe
 * 3. On dérive une clé AES du mot de passe (Argon2id + salt)
 * 4. On déchiffre la masterKey avec cette clé
 * 5. On déchiffre le profil avec la masterKey
 * 6. Les données sont accessibles en RAM uniquement
 * 
 * ═══════════════════════════════════════════════════════════════
 *  LIBRAIRIES UTILISÉES
 * ═══════════════════════════════════════════════════════════════
 * 
 * @noble/hashes : Fonctions de hachage (SHA-256, Argon2id)
 *   - Léger (~50KB minifié)
 *   - Sans dépendances natives (pure JavaScript)
 *   - Audité par Trail of Bits
 * 
 * @noble/ciphers : Chiffrement symétrique (AES-GCM)
 *   - AES-GCM = Chiffrement authentifié (confidentialité + intégrité)
 *   - Résistant aux attaques par modification (tampering)
 * 
 * expo-crypto : Génération de nombres aléatoires sécurisés
 *   - Utilise le RNG (Random Number Generator) natif
 *   - iOS: SecRandomCopyBytes, Android: SecureRandom
 * 
 * buffer : Polyfill Node.js pour React Native
 *   - Conversion bytes <-> base64
 * 
 * @author Psy2Bib Team
 * @since 1.0.0
 * @security Critère de sécurité : Même en cas de breach database, 
 *           les données patients restent inaccessibles sans les mots de passe.
 */

import { sha256 } from '@noble/hashes/sha2';
import { utf8ToBytes } from '@noble/hashes/utils';
import { gcm } from '@noble/ciphers/aes';
import { argon2id } from '@noble/hashes/argon2';
import * as Crypto from 'expo-crypto';
import { Buffer } from 'buffer';

/**
 * Longueur des clés cryptographiques en bytes.
 * 32 bytes = 256 bits (standard pour AES-256)
 */
const KEY_LEN = 32; // 256 bits

/**
 * Paramètres Argon2id pour le hachage du mot de passe (authentification).
 * 
 * Argon2id combine :
 * - Argon2i : Résistant aux attaques timing (side-channel)
 * - Argon2d : Résistant aux attaques GPU/ASIC (force brute)
 * 
 * Paramètres adaptés pour mobile (compromis sécurité/performance) :
 * - m (memory) : 4 MB (au lieu de 64 MB recommandé pour desktop)
 * - t (iterations) : 1 (au lieu de 3)
 * - p (parallelism) : 1 thread
 * 
 * Temps estimé : ~100-200ms sur smartphone moderne
 * 
 * COMPROMIS : Ces paramètres sont MOINS sécurisés que les recommandations OWASP,
 * mais nécessaires pour une UX acceptable sur mobile. À augmenter si possible.
 * 
 */
const ARGON_PASSWORD_HASH = {
  m: 4 * 1024, // 4 MB de mémoire
  t: 1,         // 1 itération
  p: 1,         // 1 thread (pas de parallélisme)
};

/**
 * Paramètres Argon2id pour la dérivation de clé AES (chiffrement local).
 * 
 * Mêmes paramètres que ARGON_PASSWORD_HASH car usage similaire.
 * Cette clé sert à chiffrer la masterKey côté client.
 */
const ARGON_AES_KEY = {
  m: 4 * 1024,
  t: 1,
  p: 1,
};

/**
 * Dérive un hash Argon2id du mot de passe pour l'authentification.
 * 
 * Ce hash est envoyé au backend lors du login/register à la place du mot de passe.
 * Le backend stocke ce hash et le compare lors des futures connexions.
 * 
 * Caractéristiques :
 * - Déterministe : même email + même mot de passe → toujours le même hash
 * - Salt dérivé de l'email : pas besoin de stocker un salt séparé
 * - Résistant à la force brute grâce à Argon2id (coûteux à calculer)
 * 
 * Workflow :
 * 1. L'utilisateur entre : email="john@example.com", password="MyP@ssw0rd"
 * 2. On génère un salt déterministe : SHA-256("psy2bib:john@example.com")
 * 3. On hashe le mot de passe avec Argon2id (password, salt, params)
 * 4. Résultat en base64 : "6xJ8s3...7hK9" (44 caractères)
 * 5. On envoie ce hash au backend (jamais le mot de passe clair)
 * 
 * @param email - Email de l'utilisateur (normalisé : trim + lowercase)
 * @param password - Mot de passe en clair (jamais stocké ni envoyé)
 * 
 * @returns {string} Hash Argon2id en base64 (44 caractères)
 * 
 * @example
 * ```typescript
 * // Dans RegisterScreen
 * const passwordHash = derivePasswordHash('john@example.com', 'MyP@ssw0rd');
 * console.log(passwordHash); // "6xJ8s3...7hK9"
 * 
 * // Envoyer au backend
 * await register({
 *   email: 'john@example.com',
 *   passwordHash, // Jamais le mot de passe clair !
 *   role: 'PATIENT'
 * });
 * ```
 * 
 * @security Pourquoi un salt dérivé de l'email ?
 * - Simplicité : Pas besoin de stocker/récupérer un salt avant le login
 * - Sécurité suffisante : Même si deux utilisateurs ont le même mot de passe,
 *   leurs hashs seront différents (emails différents)
 * - Trade-off : Un attaquant connaissant l'email peut préparer une rainbow table,
 *   MAIS Argon2id est tellement lent qu'elle reste impraticable.
 */
export const derivePasswordHash = (email: string, password: string) => {
  // Normaliser l'email (éviter "John@Example.com" ≠ "john@example.com")
  const normEmail = email.trim().toLowerCase();
  
  // Générer un salt déterministe de 32 bytes à partir de l'email
  const salt = sha256(utf8ToBytes(`psy2bib:${normEmail}`)); // 32 bytes
  
  // Hasher le mot de passe avec Argon2id
  const hash = argon2id(utf8ToBytes(password), salt, {
    ...ARGON_PASSWORD_HASH,
    dkLen: KEY_LEN, // Longueur de sortie : 32 bytes
  });
  
  // Retourner le hash en base64 pour stockage/transmission
  return toBase64(hash);
};

/**
 * Dérive une clé AES à partir d'un mot de passe et d'un salt aléatoire.
 * 
 * Cette clé sert à chiffrer la masterKey du patient.
 * Contrairement au hash d'authentification, le salt est aléatoire et stocké côté backend.
 * 
 * Workflow :
 * 1. Lors de l'inscription : On génère un salt aléatoire de 16 bytes
 * 2. On dérive une clé AES avec Argon2id (password, salt)
 * 3. On chiffre la masterKey avec cette clé AES
 * 4. On stocke : salt + encryptedMasterKey
 * 
 * 5. Lors de la connexion : On récupère le salt
 * 6. On redemande le mot de passe
 * 7. On re-dérive la clé AES (password, salt récupéré)
 * 8. On déchiffre la masterKey
 * 
 * @param password - Mot de passe en clair
 * @param saltB64 - Salt en base64 (16 bytes, aléatoire)
 * 
 * @returns {Uint8Array} Clé AES de 32 bytes (256 bits)
 * 
 * @example
 * ```typescript
 * // Inscription : générer un salt aléatoire
 * const salt = toBase64(Crypto.getRandomBytes(16));
 * const aesKey = deriveAesKey('MyP@ssw0rd', salt);
 * 
 * // Chiffrer la masterKey
 * const masterKey = Crypto.getRandomBytes(32);
 * const encrypted = encryptGCM(aesKey, masterKey);
 * 
 * // Stocker : salt + encrypted.iv + encrypted.ciphertext
 * await saveToBackend({ salt, ...encrypted });
 * ```
 * 
 * @example
 * ```typescript
 * // Connexion : récupérer le salt
 * const { salt, encryptedMasterKey } = await fetchFromBackend();
 * 
 * // Re-dériver la clé AES avec le même mot de passe
 * const aesKey = deriveAesKey('MyP@ssw0rd', salt);
 * 
 * // Déchiffrer la masterKey
 * const masterKey = decryptGCM(aesKey, encrypted.iv, encrypted.ciphertext);
 * ```
 * 
 * @security Pourquoi un salt aléatoire ici ?
 * - Impossible de préparer une rainbow table (salt unique par utilisateur)
 * - Même avec deux mots de passe identiques, les clés AES seront différentes
 */
export const deriveAesKey = (password: string, saltB64: string) => {
  const salt = fromBase64(saltB64);
  const key = argon2id(utf8ToBytes(password), salt, {
    ...ARGON_AES_KEY,
    dkLen: KEY_LEN,
  });
  return key;
};

/**
 * Chiffre des données avec AES-256-GCM.
 * 
 * AES-GCM (Galois/Counter Mode) est un mode de chiffrement authentifié :
 * - Confidentialité : Les données sont illisibles sans la clé
 * - Intégrité : Détection automatique de toute modification (tampering)
 * - Authentification : Garantit que le chiffreur possédait bien la clé
 * 
 * Workflow :
 * 1. Génération d'un IV (Initialization Vector) aléatoire de 12 bytes
 * 2. Chiffrement des données avec AES-GCM (clé + IV)
 * 3. Retour de l'IV + ciphertext (tous deux en base64)
 * 
 * L'IV doit être unique pour chaque chiffrement (même clé, message identique → IV différent).
 * 
 * @param key - Clé AES de 32 bytes (256 bits)
 * @param plaintext - Données à chiffrer (Uint8Array)
 * 
 * @returns {object} { iv: string (base64), ciphertext: string (base64) }
 * 
 * @example
 * ```typescript
 * // Chiffrer un message
 * const key = Crypto.getRandomBytes(32); // Clé AES
 * const message = utf8ToBytes('Données sensibles du patient');
 * 
 * const { iv, ciphertext } = encryptGCM(key, message);
 * console.log('IV:', iv); // "6xJ8s3..." (16 caractères base64)
 * console.log('Chiffré:', ciphertext); // "7hK9..." (longueur variable)
 * 
 * // Stocker iv + ciphertext (la clé reste secrète)
 * await saveToDatabase({ iv, ciphertext });
 * ```
 * 
 * @security Pourquoi GCM et pas CBC ou CTR ?
 * - GCM détecte les modifications (MAC intégré)
 * - CBC est vulnérable aux padding oracle attacks
 * - CTR nécessite un MAC séparé (HMAC-SHA256)
 * - GCM est le standard moderne (TLS 1.3, Signal Protocol...)
 */
export const encryptGCM = (key: Uint8Array, plaintext: Uint8Array) => {
  // Générer un IV aléatoire de 12 bytes (96 bits, recommandé pour GCM)
  const iv = Crypto.getRandomBytes(12);
  
  // Créer un cipher AES-GCM avec la clé et l'IV
  const cipher = gcm(key, iv);
  
  // Chiffrer les données
  const ciphertext = cipher.encrypt(plaintext);
  
  // Retourner IV + ciphertext en base64
  return { iv: toBase64(iv), ciphertext: toBase64(ciphertext) };
};

/**
 * Déchiffre des données avec AES-256-GCM.
 * 
 * Inverse de encryptGCM. Vérifie automatiquement l'intégrité des données.
 * Si le ciphertext a été modifié, une erreur sera levée (MAC invalide).
 * 
 * @param key - Clé AES de 32 bytes (256 bits, DOIT être la même que lors du chiffrement)
 * @param ivB64 - IV en base64 (12 bytes)
 * @param ciphertextB64 - Ciphertext en base64
 * 
 * @returns {Uint8Array} Données déchiffrées (plaintext)
 * 
 * @throws {Error} Si la clé est incorrecte ou si les données ont été modifiées
 * 
 * @example
 * ```typescript
 * // Récupérer depuis la database
 * const { iv, ciphertext } = await fetchFromDatabase();
 * const key = deriveAesKey(password, salt);
 * 
 * try {
 *   const plaintext = decryptGCM(key, iv, ciphertext);
 *   const message = Buffer.from(plaintext).toString('utf8');
 *   console.log('Déchiffré:', message); // "Données sensibles du patient"
 * } catch (error) {
 *   console.error('Déchiffrement échoué (mauvaise clé ou données corrompues)');
 * }
 * ```
 * 
 * @security Si cette fonction lève une erreur :
 * - Soit la clé est incorrecte (mauvais mot de passe)
 * - Soit les données ont été altérées (attaque ou corruption)
 * - GCM ne peut pas distinguer les deux cas (volontaire, pour éviter les oracles)
 */
export const decryptGCM = (key: Uint8Array, ivB64: string, ciphertextB64: string) => {
  const iv = fromBase64(ivB64);
  const cipher = gcm(key, iv);
  return cipher.decrypt(fromBase64(ciphertextB64));
};

/**
 * Structure du payload Zero-Knowledge pour un patient.
 * 
 * Ce payload contient toutes les données nécessaires pour reconstruire
 * le profil patient côté client (après saisie du mot de passe).
 */
export interface ZkPayload {
  /** Clé maître chiffrée (JSON stringifié : { iv, data }) */
  encryptedMasterKey: string;
  
  /** Profil patient chiffré (JSON stringifié : { iv, data }) */
  encryptedProfile: string;
  
  /** Salt pour la dérivation de la clé AES (base64, 16 bytes) */
  salt: string;
}

/**
 * Construit un payload Zero-Knowledge complet pour l'inscription d'un patient.
 * 
 * Cette fonction orchestre toute la création du vault patient :
 * 1. Génération d'un salt aléatoire
 * 2. Dérivation d'une clé AES depuis le mot de passe
 * 3. Génération d'une masterKey aléatoire
 * 4. Chiffrement de la masterKey avec la clé AES
 * 5. Chiffrement du profil avec la masterKey
 * 6. Retour du payload prêt à envoyer au backend
 * 
 * Architecture à double chiffrement :
 * 
 * ```
 * Mot de passe utilisateur
 *        ↓ (Argon2id + salt aléatoire)
 * Clé AES (dérivée)
 *        ↓ (chiffre)
 * masterKey (aléatoire)
 *        ↓ (chiffre)
 * Profil patient (données sensibles)
 * ```
 * 
 * Pourquoi deux couches de chiffrement ?
 * - Clé AES : Permet de changer le mot de passe sans re-chiffrer tout le profil
 * - masterKey : Reste constante, seule encryptedMasterKey est mise à jour lors
 *               d'un changement de mot de passe
 * 
 * @param password - Mot de passe en clair de l'utilisateur
 * @param profile - Objet JavaScript contenant les données patient (nom, prénom, date naissance...)
 * 
 * @returns {object} Payload complet pour le backend + masterKey en clair (à stocker en RAM)
 * 
 * @example
 * ```typescript
 * // Dans RegisterScreen, après validation du formulaire
 * const profileData = {
 *   firstName: 'Jean',
 *   lastName: 'Dupont',
 *   birthDate: '1990-05-15',
 *   address: '12 rue de la Paix, 75002 Paris',
 *   phone: '+33612345678'
 * };
 * 
 * const zkPayload = buildPatientZkPayload('MyS3cur3P@ss', profileData);
 * 
 * // Envoyer au backend (tout est chiffré)
 * await register({
 *   email: 'jean@example.com',
 *   passwordHash: derivePasswordHash('jean@example.com', 'MyS3cur3P@ss'),
 *   role: 'PATIENT',
 *   ...zkPayload // salt, encryptedMasterKey, encryptedProfile
 * });
 * 
 * // Stocker la masterKey en RAM (SecureStore)
 * await authStorage.saveVault({
 *   masterKey: zkPayload.masterKeyB64,
 *   salt: zkPayload.salt,
 *   encryptedMasterKey: zkPayload.encryptedMasterKey,
 *   encryptedProfile: zkPayload.encryptedProfile
 * });
 * ```
 * 
 * @security La masterKey en clair (masterKeyB64) ne doit JAMAIS être envoyée au backend.
 *           Elle reste uniquement en RAM (SecureStore) sur le téléphone.
 */
export const buildPatientZkPayload = (password: string, profile: object = {}) => {
  // 1. Générer un salt aléatoire de 16 bytes pour Argon2id
  const salt = toBase64(Crypto.getRandomBytes(16));
  
  // 2. Dériver une clé AES depuis le mot de passe + salt
  const aesKey = deriveAesKey(password, salt);
  
  // 3. Générer une masterKey aléatoire de 32 bytes
  const masterKey = Crypto.getRandomBytes(KEY_LEN);
  
  // 4. Chiffrer la masterKey avec la clé AES
  const masterEnc = encryptGCM(aesKey, masterKey);
  
  // 5. Sérialiser le profil en JSON puis en bytes
  const profileBytes = utf8ToBytes(JSON.stringify(profile));
  
  // 6. Chiffrer le profil avec la masterKey
  const profileEnc = encryptGCM(masterKey, profileBytes);
  
  // 7. Retourner le payload complet
  return {
    salt, // Salt pour re-dériver la clé AES lors de la connexion
    
    // encryptedMasterKey : { iv, data } en JSON
    encryptedMasterKey: JSON.stringify({
      iv: masterEnc.iv,
      data: masterEnc.ciphertext,
    }),
    
    // encryptedProfile : { iv, data } en JSON
    encryptedProfile: JSON.stringify({
      iv: profileEnc.iv,
      data: profileEnc.ciphertext,
    }),
    
    // masterKey en clair (à stocker en RAM, JAMAIS envoyer au backend)
    masterKeyB64: toBase64(masterKey),
  };
};

/**
 * Parse un blob JSON de la forme { iv, data } en sortie de l'API.
 * 
 * Le backend renvoie les données chiffrées sous forme de strings JSON.
 * Cette fonction les parse en objets TypeScript pour pouvoir les déchiffrer.
 * 
 * @param value - String JSON (ex: '{"iv":"6xJ8...","data":"7hK9..."}')
 * 
 * @returns {object|null} { iv: string, data: string } ou null si invalide
 * 
 * @example
 * ```typescript
 * const encryptedMasterKey = '{"iv":"abc123","data":"def456"}';
 * const parsed = parseEncryptedJson(encryptedMasterKey);
 * // parsed = { iv: 'abc123', data: 'def456' }
 * ```
 * 
 * @private Fonction interne, pas exportée
 */
const parseEncryptedJson = (value?: string | null) => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (!parsed.iv || !parsed.data) return null;
    return parsed as { iv: string; data: string };
  } catch {
    return null;
  }
};

/**
 * Déchiffre le vault patient complet (masterKey + profil) à partir du mot de passe.
 * 
 * Cette fonction est appelée lors de la connexion d'un patient pour récupérer
 * ses données sensibles en clair.
 * 
 * Workflow :
 * 1. Récupérer le payload depuis le backend (salt, encryptedMasterKey, encryptedProfile)
 * 2. L'utilisateur entre son mot de passe
 * 3. On re-dérive la clé AES (password + salt)
 * 4. On déchiffre la masterKey
 * 5. On déchiffre le profil avec la masterKey
 * 6. Retour de la masterKey (base64) + profil (objet JS)
 * 
 * @param password - Mot de passe en clair de l'utilisateur
 * @param payload - Vault chiffré récupéré depuis le backend
 * @param payload.salt - Salt pour Argon2id (base64)
 * @param payload.encryptedMasterKey - MasterKey chiffrée (JSON : { iv, data })
 * @param payload.encryptedProfile - Profil chiffré (JSON : { iv, data })
 * 
 * @returns {object} { masterKeyB64: string, profile: object|null }
 * 
 * @throws {Error} Si le payload est incomplet ou si le mot de passe est incorrect
 * 
 * @example
 * ```typescript
 * // Connexion : récupérer le vault depuis le backend
 * const loginResponse = await login({ email, passwordHash });
 * const vault = {
 *   salt: loginResponse.data.salt,
 *   encryptedMasterKey: loginResponse.data.encryptedMasterKey,
 *   encryptedProfile: loginResponse.data.encryptedProfile
 * };
 * 
 * // Demander le mot de passe (déjà saisi lors du login)
 * try {
 *   const { masterKeyB64, profile } = decryptPatientVault(password, vault);
 *   
 *   console.log('Profil déchiffré:', profile);
 *   // { firstName: 'Jean', lastName: 'Dupont', birthDate: '1990-05-15', ... }
 *   
 *   // Stocker la masterKey en RAM pour usage futur
 *   await authStorage.saveVault({
 *     ...vault,
 *     masterKey: masterKeyB64
 *   });
 * } catch (error) {
 *   console.error('Mot de passe incorrect ou vault corrompu');
 * }
 * ```
 * 
 * @security Si cette fonction lève une erreur, c'est soit :
 * - Le mot de passe est incorrect
 * - Les données ont été corrompues (très rare)
 * - Le vault est incomplet (bug backend)
 * 
 * @note Le profil peut être null si encryptedProfile n'est pas fourni
 *       (cas d'un profil patient pas encore rempli).
 */
export const decryptPatientVault = (
  password: string,
  payload: { 
    salt?: string | null; 
    encryptedMasterKey?: string | null; 
    encryptedProfile?: string | null 
  }
) => {
  // Validation : salt et encryptedMasterKey sont obligatoires
  if (!payload.salt || !payload.encryptedMasterKey) {
    throw new Error('Vault incomplet (salt ou encryptedMasterKey manquant)');
  }

  // Parser encryptedMasterKey (JSON → { iv, data })
  const encMaster = parseEncryptedJson(payload.encryptedMasterKey);
  if (!encMaster) throw new Error('encryptedMasterKey invalide');

  // 1. Re-dériver la clé AES depuis le mot de passe + salt
  const aesKey = deriveAesKey(password, payload.salt);
  
  // 2. Déchiffrer la masterKey (si le mot de passe est correct)
  const masterKey = decryptGCM(aesKey, encMaster.iv, encMaster.data);
  const masterKeyB64 = toBase64(masterKey);

  // 3. Déchiffrer le profil (si présent)
  let profile: any = null;
  if (payload.encryptedProfile) {
    const encProfile = parseEncryptedJson(payload.encryptedProfile);
    if (encProfile) {
      const plaintext = decryptGCM(masterKey, encProfile.iv, encProfile.data);
      try {
        // Convertir les bytes en string UTF-8 puis parser le JSON
        profile = JSON.parse(Buffer.from(plaintext).toString('utf8'));
      } catch {
        // Si le JSON est invalide, ignorer (profil reste null)
        profile = null;
      }
    }
  }

  return { masterKeyB64, profile };
};

/**
 * Déchiffre uniquement le profil patient avec une masterKey déjà connue.
 * 
 * Utilisé quand la masterKey est déjà stockée en RAM (après connexion)
 * et qu'on veut juste lire le profil sans redemander le mot de passe.
 * 
 * @param masterKeyB64 - MasterKey en base64 (récupérée depuis authStorage)
 * @param encryptedProfile - Profil chiffré (JSON : { iv, data })
 * 
 * @returns {object|null} Profil déchiffré ou null si absent/invalide
 * 
 * @example
 * ```typescript
 * // Récupérer la masterKey depuis SecureStore
 * const vault = authStorage.getPatientVault();
 * const masterKeyB64 = vault?.masterKey;
 * 
 * if (masterKeyB64 && vault.encryptedProfile) {
 *   const profile = decryptProfileWithMasterKey(masterKeyB64, vault.encryptedProfile);
 *   console.log('Nom:', profile.lastName);
 * }
 * ```
 * 
 * @note Utile pour éviter de redemander le mot de passe à chaque lecture du profil.
 */
export const decryptProfileWithMasterKey = (
  masterKeyB64: string, 
  encryptedProfile?: string | null
) => {
  if (!encryptedProfile) return null;
  
  const enc = parseEncryptedJson(encryptedProfile);
  if (!enc) return null;
  
  const masterKey = fromBase64(masterKeyB64);
  const plaintext = decryptGCM(masterKey, enc.iv, enc.data);
  
  try {
    return JSON.parse(Buffer.from(plaintext).toString('utf8'));
  } catch {
    return null;
  }
};

/**
 * Re-chiffre un profil patient avec une masterKey connue (base64).
 * 
 * Utilisé lors de la mise à jour du profil patient (changement d'adresse, téléphone...).
 * 
 * Workflow de mise à jour :
 * 1. Déchiffrer le profil actuel avec la masterKey
 * 2. Modifier les champs (ex: address = 'Nouvelle adresse')
 * 3. Re-chiffrer le profil avec cette fonction
 * 4. Envoyer le nouveau encryptedProfile au backend
 * 
 * @param masterKeyB64 - MasterKey en base64 (récupérée depuis authStorage)
 * @param profile - Profil modifié (objet JS)
 * 
 * @returns {string} encryptedProfile (JSON stringifié : { iv, data })
 * 
 * @example
 * ```typescript
 * // 1. Récupérer et déchiffrer le profil actuel
 * const vault = authStorage.getPatientVault();
 * const currentProfile = decryptProfileWithMasterKey(vault.masterKey, vault.encryptedProfile);
 * 
 * // 2. Modifier les données
 * const updatedProfile = {
 *   ...currentProfile,
 *   address: 'Nouvelle adresse 456',
 *   phone: '+33698765432'
 * };
 * 
 * // 3. Re-chiffrer
 * const newEncryptedProfile = encryptProfileWithMasterKey(vault.masterKey, updatedProfile);
 * 
 * // 4. Envoyer au backend
 * await updateMyPatientProfile({
 *   encryptedProfile: newEncryptedProfile
 * });
 * 
 * // 5. Mettre à jour le vault local
 * await authStorage.saveVault({
 *   ...vault,
 *   encryptedProfile: newEncryptedProfile
 * });
 * ```
 * 
 * @note La masterKey ne change pas lors d'une mise à jour du profil.
 *       Elle change uniquement si l'utilisateur change son mot de passe.
 */
export const encryptProfileWithMasterKey = (masterKeyB64: string, profile: object) => {
  const masterKey = fromBase64(masterKeyB64);
  const profileBytes = utf8ToBytes(JSON.stringify(profile));
  const profileEnc = encryptGCM(masterKey, profileBytes);
  return JSON.stringify({
    iv: profileEnc.iv,
    data: profileEnc.ciphertext,
  });
};

/**
 * Convertit un Uint8Array en string base64.
 * 
 * Utilisé pour encoder les données binaires (clés, IV, ciphertext) en format
 * transmissible (JSON, HTTP, database).
 * 
 * @param bytes - Données binaires (Uint8Array)
 * @returns {string} String base64
 * 
 * @example
 * ```typescript
 * const key = Crypto.getRandomBytes(32);
 * const keyB64 = toBase64(key); // "6xJ8s3...7hK9" (44 caractères)
 * ```
 * 
 * @private Fonction utilitaire interne
 */
const toBase64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');

/**
 * Convertit une string base64 en Uint8Array.
 * 
 * Inverse de toBase64. Utilisé pour décoder les données reçues du backend.
 * 
 * @param value - String base64
 * @returns {Uint8Array} Données binaires
 * 
 * @example
 * ```typescript
 * const keyB64 = "6xJ8s3...7hK9";
 * const key = fromBase64(keyB64); // Uint8Array(32)
 * ```
 * 
 * @private Fonction utilitaire interne
 */
const fromBase64 = (value: string) => new Uint8Array(Buffer.from(value, 'base64'));
