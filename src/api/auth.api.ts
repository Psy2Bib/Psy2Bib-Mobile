/**
 * @fileoverview API d'authentification (inscription, connexion, déconnexion)
 * 
 * Ce module gère tout le cycle de vie de l'authentification :
 * - Inscription (register) : Création d'un nouveau compte
 * - Connexion (login) : Obtention des tokens JWT
 * - Déconnexion (logout) : Invalidation des tokens côté serveur
 * 
 * Architecture de sécurité :
 * - Le mot de passe n'est JAMAIS envoyé en clair
 * - On envoie un hash Argon2id du mot de passe
 * - Le backend vérifie ce hash et renvoie des tokens JWT
 * 
 * @author Psy2Bib Team
 * @since 1.0.0
 */

import { api } from './client';

/**
 * Type énumérant les rôles possibles dans l'application.
 * 
 * - PATIENT : Utilisateur cherchant un psychologue
 * - PSY : Psychologue proposant des consultations
 * - ADMIN : Administrateur de la plateforme (gestion, modération)
 */
export type UserRole = 'PATIENT' | 'PSY' | 'ADMIN';

/**
 * Structure de la réponse d'authentification (login et register).
 * 
 * Le backend renvoie cette structure après une inscription ou connexion réussie.
 */
export interface AuthResponse {
  /** Token JWT d'accès (courte durée, ~15min) */
  accessToken: string;
  
  /** Token JWT de rafraîchissement (longue durée, ~7 jours) */
  refreshToken: string;
  
  /** 
   * Clé maître chiffrée (uniquement pour les patients).
   * Utilisée pour chiffrer/déchiffrer le profil patient (Zero-Knowledge).
   * null pour les psychologues.
   */
  encryptedMasterKey: string | null;
  
  /** 
   * Sel cryptographique pour Argon2id (uniquement pour les patients).
   * Nécessaire pour recalculer le hash du mot de passe lors d'un déchiffrement.
   * null pour les psychologues.
   */
  salt: string | null;
  
  /** 
   * Profil patient chiffré (uniquement pour les patients).
   * Contient les données sensibles (nom, prénom, date de naissance...).
   * null pour les psychologues.
   */
  encryptedProfile: string | null;
  
  /** Rôle de l'utilisateur (PATIENT, PSY, ADMIN) */
  role: UserRole;
  
  /** ID unique de l'utilisateur (UUID) */
  userId: string;
  
  /** Pseudo de l'utilisateur (optionnel, affiché dans l'UI) */
  pseudo?: string;
}

/**
 * Inscrit un nouvel utilisateur (patient ou psychologue).
 * 
 * Workflow d'inscription :
 * 1. L'utilisateur remplit le formulaire (email, password, role...)
 * 2. Le mot de passe est hashé avec Argon2id côté client
 * 3. Cette fonction envoie les données (avec le hash) au backend
 * 4. Le backend crée le compte et renvoie les tokens + vault (si patient)
 * 5. Les tokens sont sauvegardés dans authStorage
 * 6. L'utilisateur est redirigé vers le dashboard
 * 
 * @param body - Données d'inscription (structure flexible, à typer selon les besoins)
 *               Exemple : { email, passwordHash, role, pseudo, ... }
 * 
 * @returns Promise<AuthResponse> - Tokens et métadonnées d'authentification
 * 
 * @example
 * ```typescript
 * // 1. Hasher le mot de passe
 * const passwordHash = await argon2Hash(password, salt);
 * 
 * // 2. Inscription
 * const response = await register({
 *   email: 'patient@example.com',
 *   passwordHash,
 *   role: 'PATIENT',
 *   pseudo: 'Jean D.'
 * });
 * 
 * // 3. Sauvegarder les tokens
 * await authStorage.set({
 *   accessToken: response.data.accessToken,
 *   refreshToken: response.data.refreshToken,
 *   userRole: response.data.role,
 *   userId: response.data.userId,
 *   patientVault: {
 *     encryptedMasterKey: response.data.encryptedMasterKey,
 *     salt: response.data.salt,
 *     encryptedProfile: response.data.encryptedProfile,
 *   }
 * });
 * ```
 * 
 * @throws {AxiosError} Si l'email existe déjà ou si les données sont invalides
 */
export const register = (body: any) => 
  api.post<AuthResponse>('/auth/register', body);

/**
 * Connecte un utilisateur existant.
 * 
 * Workflow de connexion :
 * 1. L'utilisateur entre son email et mot de passe
 * 2. Le mot de passe est hashé avec Argon2id (même sel que lors de l'inscription)
 * 3. Cette fonction envoie { email, passwordHash } au backend
 * 4. Le backend vérifie le hash et renvoie les tokens + vault (si patient)
 * 5. Les tokens sont sauvegardés et l'utilisateur est authentifié
 * 
 * @param body - Identifiants de connexion
 * @param body.email - Adresse email de l'utilisateur
 * @param body.passwordHash - Hash Argon2id du mot de passe (PAS le mot de passe clair !)
 * 
 * @returns Promise<AuthResponse> - Tokens et métadonnées d'authentification
 * 
 * @example
 * ```typescript
 * // 1. Récupérer le sel de l'utilisateur (endpoint GET /auth/salt/:email)
 * const saltResponse = await axios.get(`/auth/salt/${email}`);
 * const salt = saltResponse.data.salt;
 * 
 * // 2. Hasher le mot de passe avec ce sel
 * const passwordHash = await argon2Hash(password, salt);
 * 
 * // 3. Connexion
 * const response = await login({ email, passwordHash });
 * 
 * // 4. Sauvegarder les tokens
 * await authStorage.set({
 *   accessToken: response.data.accessToken,
 *   refreshToken: response.data.refreshToken,
 *   userRole: response.data.role,
 *   userId: response.data.userId,
 * });
 * ```
 * 
 * @throws {AxiosError} Si l'email n'existe pas ou si le mot de passe est incorrect
 * 
 * @security Le backend ne reçoit JAMAIS le mot de passe en clair, uniquement le hash.
 *           Même si un attaquant intercepte la requête, il ne pourra pas se connecter
 *           sans recalculer le hash avec Argon2id (très coûteux).
 */
export const login = (body: { email: string; passwordHash: string }) =>
  api.post<AuthResponse>('/auth/login', body);

/**
 * Déconnecte l'utilisateur actuel.
 * 
 * Cette fonction invalide le refreshToken côté serveur (blacklist).
 * Après un logout, le refreshToken ne pourra plus être utilisé pour obtenir
 * un nouvel accessToken.
 * 
 * Note : L'accessToken reste valide jusqu'à son expiration naturelle (~15min),
 * mais comme on le supprime côté client, l'utilisateur ne peut plus faire de requêtes.
 * 
 * @returns Promise<void> - Pas de données retournées
 * 
 * @example
 * ```typescript
 * // Dans le bouton "Se déconnecter"
 * try {
 *   await logout(); // Invalide le refreshToken côté serveur
 *   await authStorage.clear(); // Supprime les tokens côté client
 *   navigation.navigate('Login'); // Redirection vers l'écran de connexion
 * } catch (error) {
 *   console.error('Erreur lors de la déconnexion:', error);
 *   // Même en cas d'erreur, on nettoie côté client
 *   await authStorage.clear();
 * }
 * ```
 * 
 * @note Si la requête échoue (ex: pas de réseau), il est recommandé de nettoyer
 *       quand même les tokens côté client pour "déconnecter" l'utilisateur localement.
 */
export const logout = () => 
  api.post('/auth/logout');
