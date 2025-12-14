/**
 * @fileoverview API de gestion du profil psychologue
 * 
 * Contrairement aux patients (profil chiffré), les psychologues ont un profil
 * public NON chiffré, car il doit être visible par les patients lors de la recherche.
 * 
 * Le profil psy contient :
 * - Informations personnelles (firstName, lastName, title)
 * - Spécialités (TCC, EMDR, Psychanalyse...)
 * - Langues parlées (Français, Anglais...)
 * - Coordonnées (ville, adresse, tarif)
 * - Numéro ADELI (identifiant professionnel)
 * - Visibilité publique (isVisible)
 * 
 * @author Psy2Bib Team
 * @since 1.0.0
 */

import { api } from './client';

/**
 * Récupère le profil complet du psychologue connecté.
 * 
 * Renvoie toutes les informations du profil, y compris celles non publiques
 * (ex: email, créé à...).
 * 
 * Utilisé dans PsyProfileScreen pour pré-remplir le formulaire d'édition.
 * 
 * @returns Promise<PsychologistProfile> - Profil complet du psy
 * 
 * @example
 * ```typescript
 * const profile = await getMyPsyProfile();
 * 
 * // Pré-remplir le formulaire
 * setForm({
 *   title: profile.data.title || '',
 *   description: profile.data.description || '',
 *   specialties: profile.data.specialties || [],
 *   hourlyRate: profile.data.hourlyRate || '',
 * });
 * ```
 * 
 * @security Seul le psy connecté peut voir son propre profil complet.
 *           Les patients voient une version filtrée via GET /psychologists/:id
 */
export const getMyPsyProfile = () => 
  api.get('/psychologists/me');

/**
 * Met à jour le profil du psychologue connecté.
 * 
 * Permet de modifier :
 * - Informations personnelles (title, description)
 * - Spécialités (array de strings)
 * - Langues parlées (array de strings)
 * - Coordonnées (city, address)
 * - Tarif horaire (hourlyRate en euros)
 * - Numéro ADELI (adeli)
 * - Visibilité publique (isVisible : true/false)
 * 
 * Tous les champs sont optionnels (update partiel).
 * Seuls les champs fournis seront mis à jour.
 * 
 * @param body - Données à mettre à jour (champs optionnels)
 * @param body.title - Titre professionnel (ex: "Psychologue clinicien")
 * @param body.description - Présentation du psy (texte libre, ~500 caractères)
 * @param body.specialties - Liste des spécialités (ex: ["TCC", "EMDR"])
 * @param body.languages - Liste des langues (ex: ["Français", "Anglais"])
 * @param body.city - Ville d'exercice (ex: "Paris")
 * @param body.address - Adresse du cabinet (ex: "12 rue de la Paix, 75002 Paris")
 * @param body.hourlyRate - Tarif par séance (ex: 70.0 pour 70€)
 * @param body.adeli - Numéro ADELI (9 chiffres, ex: "123456789")
 * @param body.isVisible - Profil visible dans la recherche publique ?
 * 
 * @returns Promise<PsychologistProfile> - Le profil mis à jour
 * 
 * @example
 * ```typescript
 * // Mise à jour complète
 * await updateMyPsyProfile({
 *   title: 'Psychologue TCC',
 *   description: 'Spécialisé en troubles anxieux et dépression',
 *   specialties: ['TCC', 'EMDR'],
 *   languages: ['Français', 'Anglais'],
 *   city: 'Paris',
 *   address: '12 rue de la Paix, 75002',
 *   hourlyRate: 70,
 *   adeli: '123456789',
 *   isVisible: true
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Mise à jour partielle (juste le tarif)
 * await updateMyPsyProfile({
 *   hourlyRate: 80
 * });
 * ```
 * 
 * @throws {AxiosError} Si les spécialités ou langues sont invalides
 * 
 * @note Si isVisible=false, le psy n'apparaîtra plus dans les recherches patients,
 *       mais ses RDV existants restent valides.
 * 
 * @note Les spécialités doivent correspondre à une liste prédéfinie côté backend
 *       (ou être validées dans l'UI avec une liste de choix).
 */
export const updateMyPsyProfile = (body: {
  title?: string;
  description?: string;
  specialties?: string[];
  languages?: string[];
  city?: string;
  address?: string;
  hourlyRate?: number;
  adeli?: string;
  isVisible?: boolean;
  firstName?: string;
  lastName?: string;
}) => 
  api.put('/psychologists/me', body);
