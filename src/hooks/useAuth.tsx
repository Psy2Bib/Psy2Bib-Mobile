/**
 * @fileoverview Hook personnalisé React pour la gestion de l'authentification globale
 * 
 * Ce fichier implémente le Context API de React pour partager l'état d'authentification
 * dans toute l'application sans avoir à passer des props à tous les niveaux.
 * 
 * ═══════════════════════════════════════════════════════════════
 *  RÔLE DU HOOK useAuth
 * ═══════════════════════════════════════════════════════════════
 * 
 * Ce hook expose les fonctionnalités d'authentification :
 * - État : user (utilisateur connecté), patientVault (données patient), loading
 * - Actions : login(), register(), logout(), updatePatientVault()
 * 
 * Utilisé dans TOUS les écrans nécessitant des infos sur l'utilisateur :
 * - Navigation (afficher les onglets selon le rôle)
 * - Dashboards (afficher les données utilisateur)
 * - Formulaires (pré-remplir avec les données du vault)
 * 
 * ═══════════════════════════════════════════════════════════════
 *  PATTERN CONTEXT API
 * ═══════════════════════════════════════════════════════════════
 * 
 * Le Context API évite le "prop drilling" (passer les props sur 10 niveaux).
 * 
 * Architecture :
 * 1. Créer un Context : AuthContext = createContext()
 * 2. Créer un Provider : <AuthProvider> qui wrap toute l'app
 * 3. Exposer un hook : useAuth() pour consommer le context
 * 
 * Utilisation :
 * ```tsx
 * // Dans App.tsx
 * <AuthProvider>
 *   <NavigationContainer>
 *     <AppNavigator />
 *   </NavigationContainer>
 * </AuthProvider>
 * ```
 * 
 * ```tsx
 * // Dans n'importe quel écran
 * const { user, login, logout } = useAuth();
 * ```
 * 
 * @author Psy2Bib Team
 * @since 1.0.0
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authStorage } from '../api/client';
import { login, register, logout, AuthResponse, UserRole } from '../api/auth.api';
import {
  derivePasswordHash,
  buildPatientZkPayload,
  decryptPatientVault,
} from '../crypto/zk';

/**
 * Type représentant un utilisateur authentifié.
 * 
 * Stocké en état React et accessible dans toute l'app via useAuth().
 */
type AuthUser = { 
  /** ID de l'utilisateur (UUID) */
  id?: string; 
  
  /** Rôle : 'PATIENT', 'PSY', ou 'ADMIN' */
  role: UserRole; 
  
  /** Email de l'utilisateur (optionnel) */
  email?: string; 
  
  /** Pseudo affiché dans l'UI (optionnel) */
  pseudo?: string; 
};

/**
 * Type représentant le vault patient (coffre-fort Zero-Knowledge).
 * 
 * Contient les données chiffrées + la masterKey déchiffrée (en RAM uniquement).
 */
export type PatientVault = {
  /** Clé maître chiffrée (JSON : { iv, data }) */
  encryptedMasterKey?: string | null;
  
  /** Profil patient chiffré (JSON : { iv, data }) */
  encryptedProfile?: string | null;
  
  /** Salt pour Argon2id (base64) */
  salt?: string | null;
  
  /** 
   * Clé maître déchiffrée (base64).
   * ⚠️ SENSIBLE : Stockée en RAM uniquement (SecureStore), jamais envoyée au backend.
   */
  masterKeyB64?: string | null;
  
  /** 
   * Profil patient déchiffré (objet JS).
   * Exemple : { firstName: 'Jean', lastName: 'Dupont', birthDate: '1990-05-15', ... }
   */
  profile?: Record<string, any> | null;
};

/**
 * Type du payload pour l'inscription (register).
 */
type RegisterPayload = {
  /** Email de l'utilisateur */
  email: string;
  
  /** Mot de passe en clair (jamais stocké, hashé immédiatement) */
  password: string;
  
  /** Pseudo affiché dans l'UI */
  pseudo: string;
  
  /** Rôle : 'PATIENT' ou 'PSY' */
  role: UserRole;
  
  /** 
   * Profil patient (optionnel, uniquement pour role='PATIENT').
   * Sera chiffré avant envoi au backend.
   */
  profile?: Record<string, any>;
};

/**
 * Type du contexte d'authentification.
 * 
 * Exposé par le hook useAuth() dans toute l'application.
 */
type AuthContextValue = {
  /** Utilisateur actuellement connecté (null si déconnecté) */
  user: AuthUser | null;
  
  /** Vault patient (null si psy ou si pas encore déchiffré) */
  patientVault: PatientVault | null;
  
  /** État de chargement initial (restauration de la session depuis SecureStore) */
  loading: boolean;
  
  /** 
   * Fonction de connexion.
   * 
   * @param email - Email de l'utilisateur
   * @param password - Mot de passe en clair
   * @returns Promise<AuthResponse> - Données d'authentification (tokens, role, vault...)
   * @throws {AxiosError} Si email/mot de passe incorrect
   */
  login: (email: string, password: string) => Promise<AuthResponse>;
  
  /** 
   * Fonction d'inscription.
   * 
   * @param payload - Données d'inscription (email, password, role, profile...)
   * @returns Promise<AuthResponse> - Données d'authentification (tokens, role, vault...)
   * @throws {AxiosError} Si email déjà utilisé ou données invalides
   */
  register: (payload: RegisterPayload) => Promise<AuthResponse>;
  
  /** 
   * Fonction de déconnexion.
   * Nettoie les tokens locaux et invalide le refreshToken côté serveur.
   * 
   * @returns Promise<void>
   */
  logout: () => Promise<void>;
  
  /** 
   * Met à jour le vault patient (après déchiffrement ou modification du profil).
   * 
   * @param vault - Nouveau vault ou null pour supprimer
   * @returns Promise<void>
   */
  updatePatientVault: (vault: PatientVault | null) => Promise<void>;
};

/**
 * Contexte React pour l'authentification.
 * 
 * Créé avec createContext, consommé via useAuth().
 * undefined par défaut → erreur si useAuth() appelé hors du Provider.
 */
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Composant Provider pour le contexte d'authentification.
 * 
 * Wrap toute l'application (dans App.tsx) pour rendre le contexte accessible partout.
 * Gère l'état d'authentification (user, vault, loading) et expose les actions (login, register, logout).
 * 
 * Architecture :
 * ```
 * <AuthProvider>
 *   └─ <NavigationContainer>
 *        └─ <AppNavigator>
 *             └─ Tous les écrans peuvent utiliser useAuth()
 * </AuthProvider>
 * ```
 * 
 * @param children - Composants enfants (toute l'app)
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  /** Utilisateur actuellement connecté (null si déconnecté) */
  const [user, setUser] = useState<AuthUser | null>(null);
  
  /** Vault patient (null si psy ou si pas encore déchiffré) */
  const [patientVault, setPatientVault] = useState<PatientVault | null>(null);
  
  /** 
   * État de chargement initial.
   * true pendant la restauration de la session depuis SecureStore.
   * false une fois terminé (même si pas de session).
   */
  const [loading, setLoading] = useState(true);

  /**
   * useEffect au montage du composant (une seule fois).
   * 
   * Rôle : Restaurer la session si l'utilisateur était déjà connecté.
   * 
   * Workflow :
   * 1. L'app démarre
   * 2. authStorage.load() lit les tokens depuis SecureStore
   * 3. Si des tokens valides existent → setUser() (session restaurée)
   * 4. Sinon → user reste null (affichage de l'écran Login)
   * 5. setLoading(false) → navigation peut s'initialiser
   * 
   * Ce pattern évite le "flash" de l'écran Login si l'utilisateur est déjà connecté.
   */
  useEffect(() => {
    authStorage
      .load()
      .then(({ 
        userRole, 
        accessToken: storedAccess, 
        refreshToken: storedRefresh, 
        patientVault: storedVault, 
        userId, 
        userPseudo 
      }) => {
        // Si tous les tokens sont présents, restaurer la session
        if (userRole && storedAccess && storedRefresh) {
          console.log('[auth] restored session', { userRole });
          setUser({ 
            id: userId ?? undefined, 
            role: userRole as UserRole, 
            pseudo: userPseudo ?? undefined 
          });
          
          // Si un vault patient était stocké, le restaurer aussi
          if (storedVault) setPatientVault(storedVault);
        }
      })
      .finally(() => {
        // Dans tous les cas (session restaurée ou non), arrêter le loading
        setLoading(false);
      });
  }, []); // [] = exécuté une seule fois au montage

  /**
   * Fonction interne pour persister une session après login/register.
   * 
   * Workflow :
   * 1. Sauvegarder les tokens dans SecureStore (authStorage.set)
   * 2. Mettre à jour l'état React (setUser, setPatientVault)
   * 3. La navigation détectera le changement et affichera le dashboard
   * 
   * @param data - Données d'authentification (tokens, role, vault...)
   */
  const persistSession = useCallback(
    async (data: AuthResponse & { 
      email?: string; 
      pseudo?: string; 
      patientVault?: PatientVault | null 
    }) => {
      // 1. Sauvegarder dans SecureStore (persistance)
      await authStorage.set({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        userRole: data.role,
        userId: data.userId,
        userPseudo: data.pseudo,
        patientVault: data.patientVault,
      });
      
      // 2. Mettre à jour l'état React (interface réactive)
      setUser({ 
        id: data.userId, 
        role: data.role, 
        email: data.email, 
        pseudo: data.pseudo 
      });
      
      // 3. Si vault patient, le mettre à jour aussi
      if (data.patientVault) setPatientVault(data.patientVault);
    },
    []
  );

  /**
   * Fonction de connexion (login).
   * 
   * Workflow complet :
   * 1. Normaliser l'email (trim + lowercase)
   * 2. Hasher le mot de passe avec Argon2id (derivePasswordHash)
   * 3. Envoyer email + passwordHash au backend (login API)
   * 4. Récupérer les tokens + vault (si patient)
   * 5. Déchiffrer le vault patient avec le mot de passe (decryptPatientVault)
   * 6. Persister la session (tokens + vault)
   * 7. Retourner les données d'authentification
   * 
   * @param email - Email de l'utilisateur
   * @param password - Mot de passe en clair (jamais stocké)
   * 
   * @returns Promise<AuthResponse> - Données d'authentification
   * 
   * @throws {AxiosError} Si email/mot de passe incorrect
   * 
   * @example
   * ```tsx
   * // Dans LoginScreen
   * const { login } = useAuth();
   * 
   * const handleSubmit = async () => {
   *   try {
   *     await login(email, password);
   *     // La navigation redirigera automatiquement vers le dashboard
   *   } catch (error) {
   *     alert('Email ou mot de passe incorrect');
   *   }
   * };
   * ```
   */
  const handleLogin = useCallback(
    async (email: string, password: string) => {
      // 1. Normaliser l'email
      const normalizedEmail = email.trim().toLowerCase();
      console.log('[auth] login attempt', normalizedEmail);
      
      // 2. Hasher le mot de passe
      const passwordHash = derivePasswordHash(normalizedEmail, password);
      
      // 3. Appel API login
      const res = await login({ email: normalizedEmail, passwordHash });
      console.log('[auth] login success', { role: res.data.role });
      
      // 4. Si patient, déchiffrer le vault
      let vault: PatientVault | null = null;
      if (res.data.role === 'PATIENT') {
        try {
          // Déchiffrer la masterKey + le profil
          vault = decryptPatientVault(password, {
            salt: res.data.salt,
            encryptedMasterKey: res.data.encryptedMasterKey,
            encryptedProfile: res.data.encryptedProfile,
          });
          
          // Ajouter les données chiffrées au vault (pour re-chiffrement futur)
          vault = {
            ...vault,
            encryptedMasterKey: res.data.encryptedMasterKey,
            encryptedProfile: res.data.encryptedProfile,
            salt: res.data.salt,
          };
        } catch (err) {
          console.warn('[auth] unable to decrypt patient vault', err);
          // En cas d'erreur de déchiffrement, continuer sans vault
          // (l'utilisateur pourra ressaisir son mot de passe plus tard)
        }
      }
      
      // 5. Persister la session
      await persistSession({ ...res.data, email: normalizedEmail, patientVault: vault });
      
      // 6. Retourner les données pour l'appelant
      return res.data;
    },
    [persistSession]
  );

  /**
   * Fonction d'inscription (register).
   * 
   * Workflow complet :
   * 1. Normaliser l'email
   * 2. Hasher le mot de passe
   * 3. Si role='PATIENT' : Construire le vault ZK (buildPatientZkPayload)
   * 4. Envoyer les données au backend (register API)
   * 5. Récupérer les tokens
   * 6. Persister la session
   * 7. Retourner les données d'authentification
   * 
   * @param payload - Données d'inscription (email, password, role, profile...)
   * 
   * @returns Promise<AuthResponse> - Données d'authentification
   * 
   * @throws {AxiosError} Si email déjà utilisé ou données invalides
   * 
   * @example
   * ```tsx
   * // Dans RegisterScreen
   * const { register } = useAuth();
   * 
   * const handleSubmit = async () => {
   *   try {
   *     await register({
   *       email: 'john@example.com',
   *       password: 'MyP@ssw0rd',
   *       pseudo: 'John D.',
   *       role: 'PATIENT',
   *       profile: {
   *         firstName: 'John',
   *         lastName: 'Doe',
   *         birthDate: '1990-01-01'
   *       }
   *     });
   *     // Redirection automatique vers le dashboard
   *   } catch (error) {
   *     alert('Email déjà utilisé');
   *   }
   * };
   * ```
   */
  const handleRegister = useCallback(
    async (payload: RegisterPayload) => {
      // 1. Normaliser l'email
      const normalizedEmail = payload.email.trim().toLowerCase();
      console.log('[auth] register attempt', { email: normalizedEmail, role: payload.role });
      
      // 2. Hasher le mot de passe
      const passwordHash = derivePasswordHash(normalizedEmail, payload.password);
      
      // 3. Si patient, construire le vault ZK
      let zk = { encryptedMasterKey: null, encryptedProfile: null, salt: null } as any;

      if (payload.role === 'PATIENT') {
        const { masterKeyB64, ...zkPayload } = buildPatientZkPayload(
          payload.password, 
          payload.profile ?? {}
        );
        zk = { ...zkPayload, masterKeyB64 };
      }

      // 4. Appel API register
      const res = await register({
        email: normalizedEmail,
        passwordHash,
        pseudo: payload.pseudo,
        role: payload.role,
        // Ajouter les champs ZK uniquement si patient
        ...(zk.masterKeyB64
          ? {
              encryptedMasterKey: zk.encryptedMasterKey,
              encryptedProfile: zk.encryptedProfile,
              salt: zk.salt,
            }
          : {}),
      });

      console.log('[auth] register success', { role: res.data.role });
      
      // 5. Construire le vault pour stockage local
      const vault: PatientVault | null =
        res.data.role === 'PATIENT'
          ? {
              encryptedMasterKey: zk.encryptedMasterKey,
              encryptedProfile: zk.encryptedProfile,
              salt: zk.salt,
              masterKeyB64: (zk as any).masterKeyB64,
              profile: payload.profile ?? {},
            }
          : null;
      
      // 6. Persister la session
      await persistSession({ 
        ...res.data, 
        email: normalizedEmail, 
        pseudo: payload.pseudo, 
        patientVault: vault 
      });
      
      // 7. Retourner les données
      return res.data;
    },
    [persistSession]
  );

  /**
   * Fonction de déconnexion (logout).
   * 
   * Workflow :
   * 1. Appeler l'API logout (invalide le refreshToken côté serveur)
   * 2. Nettoyer les tokens locaux (authStorage.clear)
   * 3. Reset l'état React (setUser(null), setPatientVault(null))
   * 4. La navigation redirigera automatiquement vers Login
   * 
   * @example
   * ```tsx
   * // Dans PsyProfileScreen (bouton "Se déconnecter")
   * const { logout } = useAuth();
   * 
   * const handleLogout = async () => {
   *   await logout();
   *   // Redirection automatique vers Login
   * };
   * ```
   * 
   * @note Même si l'API logout échoue (ex: pas de réseau), on nettoie quand même
   *       les tokens locaux pour "déconnecter" l'utilisateur côté client.
   */
  const handleLogout = useCallback(async () => {
    console.log('[auth] logout');
    try {
      // Invalider le refreshToken côté serveur
      await logout();
    } finally {
      // Dans tous les cas (succès ou échec), nettoyer côté client
      await authStorage.clear();
      setUser(null);
      setPatientVault(null);
    }
  }, []);

  /**
   * Met à jour le vault patient (après déchiffrement ou modification du profil).
   * 
   * Utilisé dans :
   * - PatientDashboardScreen : Après déchiffrement du profil
   * - PatientProfileScreen : Après modification du profil
   * 
   * @param vault - Nouveau vault ou null pour supprimer
   * 
   * @example
   * ```tsx
   * // Après modification du profil
   * const { updatePatientVault, patientVault } = useAuth();
   * 
   * const updatedProfile = {
   *   ...patientVault.profile,
   *   address: 'Nouvelle adresse'
   * };
   * 
   * const newEncryptedProfile = encryptProfileWithMasterKey(
   *   patientVault.masterKeyB64,
   *   updatedProfile
   * );
   * 
   * await updatePatientVault({
   *   ...patientVault,
   *   encryptedProfile: newEncryptedProfile,
   *   profile: updatedProfile
   * });
   * ```
   */
  const updatePatientVault = useCallback(
    async (vault: PatientVault | null) => {
      // 1. Mettre à jour l'état React
      setPatientVault(vault);
      
      // 2. Sauvegarder dans SecureStore
      if (vault) {
        await authStorage.saveVault(vault);
      } else {
        await authStorage.saveVault(null);
      }
    },
    []
  );

  /**
   * Valeur du contexte exposée à tous les composants enfants.
   */
  const value: AuthContextValue = {
    user,
    patientVault,
    loading,
    login: handleLogin,
    register: handleRegister,
    logout: handleLogout,
    updatePatientVault,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Hook personnalisé pour accéder au contexte d'authentification.
 * 
 * Doit être appelé UNIQUEMENT dans des composants wrappés par <AuthProvider>.
 * 
 * @returns {AuthContextValue} Contexte d'authentification
 * 
 * @throws {Error} Si appelé hors du AuthProvider
 * 
 * @example
 * ```tsx
 * // Dans n'importe quel écran
 * const MyScreen = () => {
 *   const { user, login, logout } = useAuth();
 *   
 *   if (!user) {
 *     return <Text>Non connecté</Text>;
 *   }
 *   
 *   return (
 *     <View>
 *       <Text>Bonjour {user.pseudo}</Text>
 *       <Button title="Se déconnecter" onPress={logout} />
 *     </View>
 *   );
 * };
 * ```
 * 
 * @example
 * ```tsx
 * // Dans un formulaire de connexion
 * const LoginScreen = () => {
 *   const { login } = useAuth();
 *   const [email, setEmail] = useState('');
 *   const [password, setPassword] = useState('');
 *   
 *   const handleSubmit = async () => {
 *     try {
 *       await login(email, password);
 *       // Navigation automatique après succès
 *     } catch (error) {
 *       alert('Connexion échouée');
 *     }
 *   };
 *   
 *   return (
 *     <View>
 *       <TextInput value={email} onChangeText={setEmail} />
 *       <TextInput value={password} onChangeText={setPassword} secureTextEntry />
 *       <Button title="Se connecter" onPress={handleSubmit} />
 *     </View>
 *   );
 * };
 * ```
 */
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
};
