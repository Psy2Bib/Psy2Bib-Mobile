/**
 * @fileoverview API de gestion du profil patient (Zero-Knowledge)
 * 
 * Le profil patient contient des données sensibles (nom, prénom, date de naissance...)
 * qui sont chiffrées côté client AVANT envoi au serveur.
 * 
 * Architecture Zero-Knowledge :
 * - Le backend ne connaît PAS les données en clair
 * - Seul le patient (avec son mot de passe) peut déchiffrer son profil
 * - Le backend stocke uniquement des blobs chiffrés (encryptedProfile)
 * 
 * @see crypto/zk.ts pour les fonctions de chiffrement/déchiffrement
 * @author Psy2Bib Team
 * @since 1.0.0
 */

import { api } from './client';

/**
 * Récupère le profil patient chiffré de l'utilisateur connecté.
 * 
 * Le backend renvoie :
 * - encryptedProfile : Profil chiffré (JSON stringifié puis chiffré avec AES-GCM)
 * - encryptedMasterKey : Clé maître chiffrée (utilisée pour déchiffrer le profil)
 * - salt : Sel pour Argon2id (nécessaire pour recalculer le hash du mot de passe)
 * 
 * Workflow de déchiffrement (dans l'UI) :
 * 1. Récupérer ces données
 * 2. Demander le mot de passe au patient
 * 3. Hasher le mot de passe avec Argon2id + salt
 * 4. Déchiffrer encryptedMasterKey avec ce hash → obtenir masterKey
 * 5. Déchiffrer encryptedProfile avec masterKey → obtenir les données en clair
 * 
 * @returns Promise<PatientVault> - Vault patient (données chiffrées)
 * 
 * @example
 * ```typescript
 * // 1. Récupérer le vault chiffré
 * const vaultResponse = await getMyPatient();
 * const vault = vaultResponse.data;
 * 
 * // 2. Demander le mot de passe (modal dans l'UI)
 * const password = await askPasswordModal();
 * 
 * // 3. Déchiffrer le profil
 * const decrypted = await decryptPatientProfile(vault, password);
 * console.log('Nom:', decrypted.lastName);
 * console.log('Prénom:', decrypted.firstName);
 * ```
 * 
 * @security Le backend ne peut jamais accéder aux données en clair.
 *           Même un admin ne peut pas lire le profil sans le mot de passe.
 */
export const getMyPatient = () => 
  api.get('/patients/me');

/**
 * Met à jour le profil patient chiffré.
 * 
 * Workflow complet de mise à jour :
 * 1. Récupérer le profil actuel (getMyPatient)
 * 2. Déchiffrer avec le mot de passe
 * 3. Modifier les données en clair (ex: changer l'adresse)
 * 4. Re-chiffrer le profil avec la masterKey
 * 5. Envoyer le nouveau blob chiffré au backend
 * 
 * Le backend remplace simplement l'ancien blob par le nouveau, sans jamais
 * connaître le contenu.
 * 
 * @param body - Données chiffrées à sauvegarder
 * @param body.encryptedProfile - Profil chiffré (base64)
 * @param body.encryptedMasterKey - Clé maître chiffrée (base64, optionnel si inchangée)
 * @param body.salt - Sel Argon2id (optionnel si inchangé)
 * 
 * @returns Promise<PatientProfile> - Le profil mis à jour (encore chiffré)
 * 
 * @example
 * ```typescript
 * // 1. Récupérer et déchiffrer le profil actuel
 * const vault = await getMyPatient();
 * const decrypted = await decryptPatientProfile(vault.data, password);
 * 
 * // 2. Modifier les données
 * const updated = {
 *   ...decrypted,
 *   address: 'Nouvelle adresse 123'
 * };
 * 
 * // 3. Re-chiffrer
 * const encryptedProfile = await encryptData(JSON.stringify(updated), masterKey);
 * 
 * // 4. Sauvegarder
 * await updateMyPatientProfile({
 *   encryptedProfile
 * });
 * 
 * console.log('Profil mis à jour (serveur ne connaît pas le contenu)');
 * ```
 * 
 * @security Si l'utilisateur change son mot de passe, il faut :
 *           1. Générer un nouveau sel
 *           2. Hasher le nouveau mot de passe
 *           3. Re-chiffrer la masterKey avec ce nouveau hash
 *           4. Envoyer les 3 champs (encryptedProfile, encryptedMasterKey, salt)
 * 
 * @note Le profil contient généralement : firstName, lastName, birthDate, address, phone
 */
export const updateMyPatientProfile = (body: {
  encryptedProfile: string;
  encryptedMasterKey?: string | null;
  salt?: string | null;
}) => 
  api.patch('/patients/me', body);
