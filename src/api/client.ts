/**
 * @fileoverview Client HTTP Axios et gestion centralisée de l'authentification
 * 
 * Ce fichier est le CŒUR de toutes les requêtes HTTP de l'application.
 * Il gère :
 * - La configuration d'Axios (base URL, timeout, headers)
 * - Le stockage sécurisé des tokens JWT (access + refresh)
 * - Le rafraîchissement automatique des tokens expirés (401)
 * - Le stockage du "vault" patient (données chiffrées Zero-Knowledge)
 * 
 * Architecture JWT :
 * - accessToken : Token courte durée (~15min) pour authentifier les requêtes
 * - refreshToken : Token longue durée (~7 jours) pour renouveler l'accessToken
 * 
 * @author Psy2Bib Team
 * @since 1.0.0
 */

import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * URL de base de l'API backend.
 * 
 * IMPORTANT : À changer selon l'environnement :
 * - Dev local : 'http://192.168.1.X:4000' (IP de ta machine sur le réseau local)
 * - Prod : 'https://api.psy2bib.com'
 * 
 * Sur iOS Simulator : Utiliser 'http://localhost:4000'
 * Sur Android Emulator : Utiliser 'http://10.0.2.2:4000'
 * Sur téléphone physique : Utiliser l'IP locale de ton Mac (cmd: ifconfig)
 * 
 * @todo Utiliser les variables d'environnement (expo-constants + app.config.js)
 */
export const API_BASE = 'http://192.168.1.78:4000';

/**
 * Variables globales pour stocker les tokens en mémoire (RAM).
 * 
 * Pourquoi en mémoire ET dans SecureStore ?
 * - SecureStore : Stockage persistant (survit au redémarrage de l'app)
 * - Variables globales : Accès rapide sans attendre SecureStore (performance)
 * 
 * Workflow au lancement :
 * 1. App démarre → variables = null
 * 2. authStorage.load() lit SecureStore → remplit les variables
 * 3. Requêtes HTTP utilisent ces variables
 * 
 * Sécurité :
 * - SecureStore utilise le Keychain (iOS) ou Keystore (Android)
 * - Chiffrement hardware si disponible
 * - Inaccessible aux autres apps
 */

/** Token JWT d'accès (courte durée, ~15min) */
let accessToken: string | null = null;

/** Token JWT de rafraîchissement (longue durée, ~7 jours) */
let refreshToken: string | null = null;

/** ID de l'utilisateur connecté (UUID) */
let userId: string | null = null;

/** Pseudo de l'utilisateur (affiché dans l'UI) */
let userPseudo: string | null = null;

/**
 * Vault patient (coffre-fort Zero-Knowledge).
 * 
 * Structure :
 * - encryptedMasterKey : Clé maître chiffrée avec le hash du mot de passe
 * - salt : Sel unique pour Argon2id (génération du hash mot de passe)
 * - encryptedProfile : Profil patient chiffré (nom, prénom, date de naissance...)
 * - masterKey : Clé maître déchiffrée (stockée en RAM uniquement après login)
 * 
 * Principe Zero-Knowledge :
 * Le backend ne connaît JAMAIS le mot de passe ni la masterKey.
 * Seul le client (cette app) peut déchiffrer les données.
 * 
 * @see crypto/zk.ts pour les fonctions de chiffrement
 */
let patientVault: {
  encryptedMasterKey?: string | null;
  salt?: string | null;
  encryptedProfile?: string | null;
  masterKey?: string | null; // ⚠️ Sensible, jamais envoyée au serveur
} | null = null;

/**
 * Object authStorage : Gestionnaire de stockage sécurisé pour l'authentification.
 * 
 * Exposé publiquement pour être utilisé dans useAuth.tsx et les autres modules.
 * Encapsule toutes les opérations liées aux tokens et au vault.
 */
export const authStorage = {
  /**
   * Charge les tokens et données utilisateur depuis SecureStore au démarrage.
   * 
   * Appelé dans useAuth.tsx lors de l'initialisation de l'app.
   * Permet de restaurer la session si l'utilisateur était connecté.
   * 
   * @returns Promise<object> - Objet contenant tous les tokens et métadonnées
   * 
   * @example
   * ```typescript
   * // Dans useAuth.tsx, au montage du composant
   * const restored = await authStorage.load();
   * if (restored.accessToken) {
   *   // L'utilisateur était connecté, restaurer la session
   *   setUser({ id: restored.userId, role: restored.userRole });
   * }
   * ```
   */
  async load() {
    console.log('[authStorage] load tokens/role from SecureStore');
    
    // Lecture des clés une par une (SecureStore n'a pas de getMultiple)
    accessToken = await SecureStore.getItemAsync('accessToken');
    refreshToken = await SecureStore.getItemAsync('refreshToken');
    const userRole = await SecureStore.getItemAsync('userRole');
    userId = await SecureStore.getItemAsync('userId');
    userPseudo = await SecureStore.getItemAsync('userPseudo');
    
    // Le vault est sérialisé en JSON car SecureStore ne stocke que des strings
    const vaultRaw = await SecureStore.getItemAsync('patientVault');
    patientVault = vaultRaw ? JSON.parse(vaultRaw) : null;
    
    console.log('[authStorage] loaded', { 
      hasAccess: !!accessToken, 
      hasRefresh: !!refreshToken, 
      userRole 
    });
    
    return { accessToken, refreshToken, userRole, userId, userPseudo, patientVault };
  },

  /**
   * Enregistre les tokens et métadonnées dans SecureStore ET en mémoire.
   * 
   * Appelé après un login réussi ou un refresh de token.
   * 
   * @param tokens - Objet contenant les nouveaux tokens
   * @param tokens.accessToken - Token JWT d'accès (obligatoire)
   * @param tokens.refreshToken - Token JWT de refresh (obligatoire)
   * @param tokens.userRole - Rôle de l'utilisateur ('PATIENT', 'PSY', 'ADMIN')
   * @param tokens.userId - ID de l'utilisateur (UUID)
   * @param tokens.userPseudo - Pseudo de l'utilisateur
   * @param tokens.patientVault - Vault ZK du patient (si applicable)
   * 
   * @example
   * ```typescript
   * // Après un login réussi
   * const loginResponse = await login({ email, passwordHash });
   * await authStorage.set({
   *   accessToken: loginResponse.data.accessToken,
   *   refreshToken: loginResponse.data.refreshToken,
   *   userRole: loginResponse.data.role,
   *   userId: loginResponse.data.userId,
   * });
   * ```
   */
  async set(tokens: { 
    accessToken: string; 
    refreshToken: string; 
    userRole?: string; 
    userId?: string; 
    userPseudo?: string; 
    patientVault?: any 
  }) {
    console.log('[authStorage] set tokens', { userRole: tokens.userRole });
    
    // 1. Mise à jour des variables globales (accès rapide)
    accessToken = tokens.accessToken;
    refreshToken = tokens.refreshToken;
    
    // 2. Sauvegarde dans SecureStore (persistance)
    await SecureStore.setItemAsync('accessToken', accessToken);
    await SecureStore.setItemAsync('refreshToken', refreshToken);
    
    // Métadonnées optionnelles (pas toujours fournies lors d'un refresh)
    if (tokens.userRole) {
      await SecureStore.setItemAsync('userRole', tokens.userRole);
    }
    if (tokens.userId) {
      userId = tokens.userId;
      await SecureStore.setItemAsync('userId', tokens.userId);
    }
    if (tokens.userPseudo) {
      userPseudo = tokens.userPseudo;
      await SecureStore.setItemAsync('userPseudo', tokens.userPseudo);
    }
    if (tokens.patientVault) {
      patientVault = tokens.patientVault;
      await SecureStore.setItemAsync('patientVault', JSON.stringify(tokens.patientVault));
    }
  },

  /**
   * Sauvegarde ou supprime le vault patient.
   * 
   * Utilisé après déchiffrement du profil patient ou lors d'une mise à jour.
   * Le vault contient des données sensibles, il est mis à jour séparément.
   * 
   * @param vault - Objet vault ou null pour supprimer
   * 
   * @example
   * ```typescript
   * // Après déchiffrement du profil
   * const decryptedMasterKey = await decryptMasterKey(password);
   * await authStorage.saveVault({
   *   ...currentVault,
   *   masterKey: decryptedMasterKey // Ajout de la clé en RAM
   * });
   * ```
   */
  async saveVault(vault: any) {
    patientVault = vault;
    if (vault === null || vault === undefined) {
      await SecureStore.deleteItemAsync('patientVault');
    } else {
      await SecureStore.setItemAsync('patientVault', JSON.stringify(vault));
    }
  },

  /**
   * Efface tous les tokens et données de session (déconnexion complète).
   * 
   * Appelé lors :
   * - Déconnexion volontaire de l'utilisateur
   * - Token refresh échoué (session expirée)
   * - Erreur d'authentification critique
   * 
   * @example
   * ```typescript
   * // Dans le bouton "Se déconnecter"
   * await authStorage.clear();
   * navigation.navigate('Login');
   * ```
   */
  async clear() {
    console.log('[authStorage] clear tokens/role');
    
    // 1. Reset des variables globales
    accessToken = null;
    refreshToken = null;
    patientVault = null;
    
    // 2. Suppression dans SecureStore
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    await SecureStore.deleteItemAsync('userRole');
    await SecureStore.deleteItemAsync('userId');
    await SecureStore.deleteItemAsync('userPseudo');
    await SecureStore.deleteItemAsync('patientVault');
  },

  /**
   * Retourne les tokens actuels (lecture rapide depuis RAM).
   * 
   * @returns {object} - { accessToken, refreshToken }
   */
  getTokens() {
    return { accessToken, refreshToken };
  },

  /**
   * Retourne le vault patient actuel (lecture rapide depuis RAM).
   * 
   * @returns {object|null} - Vault patient ou null si pas de patient connecté
   */
  getPatientVault() {
    return patientVault;
  },
};

/**
 * Instance Axios configurée pour communiquer avec le backend.
 * 
 * Configuration :
 * - baseURL : Toutes les requêtes seront préfixées par cette URL
 * - timeout : 10 secondes max par requête (évite les blocages infinis)
 * 
 * Exemple :
 * api.get('/auth/me') → GET http://192.168.1.78:4000/auth/me
 * 
 * Cette instance est exportée et réutilisée dans tous les fichiers API.
 */
export const api = axios.create({ 
  baseURL: API_BASE, 
  timeout: 10000 
});

/**
 * =====================================================
 * INTERCEPTEUR DE REQUÊTE (Request Interceptor)
 * =====================================================
 * 
 * Exécuté AVANT chaque requête HTTP pour ajouter automatiquement
 * le token JWT dans les headers.
 * 
 * Workflow :
 * 1. L'app fait api.get('/appointments')
 * 2. Cet intercepteur ajoute "Authorization: Bearer <accessToken>"
 * 3. La requête part vers le serveur
 * 
 * Avantage : Pas besoin de passer le token manuellement à chaque appel.
 */
api.interceptors.request.use((config) => {
  console.log('[api][request]', config.method?.toUpperCase(), config.url);
  
  // Si un accessToken existe, on l'ajoute dans le header Authorization
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  
  return config; // Retourne la config modifiée
});

/**
 * =====================================================
 * INTERCEPTEUR DE RÉPONSE (Response Interceptor)
 * =====================================================
 * 
 * Exécuté APRÈS chaque requête HTTP pour gérer les erreurs globalement.
 * Particulièrement utile pour le rafraîchissement automatique des tokens.
 * 
 * Cas d'usage principal : Erreur 401 (Unauthorized)
 * 
 * Workflow du refresh automatique :
 * 1. Requête API échoue avec 401 → accessToken expiré
 * 2. Cet intercepteur détecte le 401
 * 3. Il utilise le refreshToken pour obtenir un nouvel accessToken
 * 4. Il réessaie automatiquement la requête initiale avec le nouveau token
 * 5. L'utilisateur ne voit rien, la requête fonctionne "magiquement"
 * 
 * Si le refresh échoue → Session expirée, déconnexion forcée
 */
api.interceptors.response.use(
  (res) => res, // Si succès (2xx), on retourne directement la réponse
  
  async (err) => {
    const original = err.config; // Requête originale qui a échoué
    const status = err.response?.status; // Code HTTP (401, 404, 500...)
    
    // Log des erreurs (sauf 401 sur /auth/refresh pour éviter le spam)
    if (status !== 401 || original.url.includes('/auth/refresh')) {
       console.warn(
         '[api][error]', 
         status, 
         original?.url, 
         err.response?.data?.message || err.message
       );
    }

    /**
     * Condition pour tenter un refresh :
     * - Code 401 (token expiré ou invalide)
     * - Pas déjà retentée (évite boucle infinie)
     * - Pas la route /auth/refresh elle-même
     */
    if (status === 401 && !original._retry && !original.url.includes('/auth/refresh')) {
      // Si pas de refreshToken, impossible de refresh → déconnexion
      if (!refreshToken) {
        console.warn('[api] No refresh token available, logout.');
        await authStorage.clear();
        return Promise.reject(err);
      }

      // Marquer la requête comme "déjà retentée" pour éviter boucle infinie
      original._retry = true;
      
      try {
        console.log('[api][refresh] Attempting refresh...');
        
        /**
         * IMPORTANT : Utiliser axios.post() directement au lieu de api.post()
         * Pourquoi ? Pour éviter que cet intercepteur s'applique aussi à la 
         * requête de refresh (sinon on crée une boucle infinie).
         */
        const refreshResponse = await axios.post(`${API_BASE}/auth/refresh`, {}, {
          headers: { Authorization: `Bearer ${refreshToken}` }
        });

        const { accessToken: newAccess, refreshToken: newRefresh } = refreshResponse.data;
        
        // Sauvegarder les nouveaux tokens
        await authStorage.set({ accessToken: newAccess, refreshToken: newRefresh });
        
        console.log('[api][refresh] Success');
        
        // Mettre à jour le header de la requête originale avec le nouveau token
        original.headers.Authorization = `Bearer ${newAccess}`;
        
        // Réessayer la requête originale (ex: GET /appointments)
        return api(original);
        
      } catch (refreshErr) {
        /**
         * Le refresh a échoué → refreshToken invalide ou expiré
         * Cela signifie que la session de l'utilisateur est terminée.
         * On nettoie tout et on force la déconnexion.
         */
        console.warn('[api][refresh] Failed (Token expired or invalid). Clearing session.');
        await authStorage.clear();
        
        // On propage l'erreur pour que l'UI puisse réagir (ex: redirection Login)
        return Promise.reject(refreshErr);
      }
    }
    
    // Pour toutes les autres erreurs (404, 500...), on les propage normalement
    return Promise.reject(err);
  }
);
