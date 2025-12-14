/**
 * @fileoverview API de recherche et consultation des profils psychologues (côté patient)
 * 
 * Ce module permet aux patients de :
 * - Rechercher des psychologues selon des critères (nom, spécialité, langue)
 * - Consulter le profil détaillé d'un psychologue
 * - Voir les disponibilités d'un psychologue (créneaux libres)
 * 
 * Différence avec psy.api.ts :
 * - psy.api.ts : Le psy modifie SON PROPRE profil (GET/PUT /psychologists/me)
 * - psychologists.api.ts : Les patients consultent LES profils des psy (GET /psychologists, GET /psychologists/:id)
 * 
 * @author Psy2Bib Team
 * @since 1.0.0
 */

import { api } from './client';

/**
 * Paramètres de recherche de psychologues.
 * 
 * Tous les champs sont optionnels et cumulatifs (filtre AND).
 */
export type SearchPsychologistParams = {
  /** Recherche par nom (firstName ou lastName contient cette valeur) */
  name?: string;
  
  /** Filtrer par spécialité exacte (ex: "TCC", "EMDR") */
  specialty?: string;
  
  /** Filtrer par langue parlée (ex: "Français", "Anglais") */
  language?: string;
};

/**
 * Recherche des psychologues selon des critères.
 * 
 * Le backend renvoie uniquement les psychologues avec isVisible=true.
 * Les résultats sont triés par pertinence (à définir côté backend).
 * 
 * @param params - Critères de recherche (tous optionnels)
 * 
 * @returns Promise<Psychologist[]> - Liste des psychologues correspondants
 * 
 * @example
 * ```typescript
 * // Recherche simple (tous les psy visibles)
 * const all = await searchPsychologists({});
 * console.log('Psychologues trouvés:', all.data.length);
 * ```
 * 
 * @example
 * ```typescript
 * // Recherche par spécialité
 * const tccPsychologists = await searchPsychologists({
 *   specialty: 'TCC'
 * });
 * 
 * // Afficher les résultats
 * tccPsychologists.data.forEach(psy => {
 *   console.log(`${psy.firstName} ${psy.lastName} - ${psy.hourlyRate}€/séance`);
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Recherche combinée (nom + langue)
 * const results = await searchPsychologists({
 *   name: 'Martin',
 *   language: 'Anglais'
 * });
 * ```
 * 
 * @note Les champs renvoyés incluent : id, firstName, lastName, title, 
 *       specialties, languages, city, hourlyRate, etc.
 *       Mais PAS les champs privés (email, ADELI complet...).
 */
export const searchPsychologists = (params: SearchPsychologistParams) =>
  api.get('/psychologists', { params });

/**
 * Récupère le profil public détaillé d'un psychologue.
 * 
 * Renvoie plus d'informations qu'une simple carte dans la recherche :
 * - Description complète
 * - Adresse exacte du cabinet
 * - Toutes les spécialités et langues
 * - Statistiques (nombre de patients, années d'expérience...) si disponibles
 * 
 * Utilisé pour afficher la page détaillée du psy avant de réserver un RDV.
 * 
 * @param psyId - ID du psychologue (UUID)
 * 
 * @returns Promise<PsychologistProfile> - Profil détaillé du psy
 * 
 * @example
 * ```typescript
 * // Afficher le profil complet d'un psy
 * const psy = await getPsychologist('550e8400-e29b-41d4-a716-446655440000');
 * 
 * console.log('Nom:', psy.data.firstName, psy.data.lastName);
 * console.log('Description:', psy.data.description);
 * console.log('Adresse:', psy.data.address);
 * console.log('Tarif:', psy.data.hourlyRate, '€/séance');
 * ```
 * 
 * @throws {AxiosError} Si le psychologue n'existe pas ou n'est pas visible (isVisible=false)
 * 
 * @note Ce profil est PUBLIC, n'importe quel utilisateur authentifié peut le voir.
 */
export const getPsychologist = (psyId: string) =>
  api.get(`/psychologists/${psyId}`);

/**
 * Récupère les disponibilités (créneaux libres) d'un psychologue.
 * 
 * Renvoie uniquement les créneaux :
 * - Futurs (date >= aujourd'hui)
 * - Non réservés (pas encore d'appointment lié)
 * 
 * Utilisé pour afficher le calendrier du psy dans la page de réservation.
 * 
 * @param psyId - ID du psychologue (UUID)
 * 
 * @returns Promise<Availability[]> - Liste des créneaux disponibles
 * 
 * @example
 * ```typescript
 * // Afficher les créneaux du psy pour réserver un RDV
 * const availabilities = await getPsyAvailabilities('psy-id-123');
 * 
 * // Grouper par date
 * const byDate = availabilities.data.reduce((acc, av) => {
 *   const date = new Date(av.start).toLocaleDateString();
 *   if (!acc[date]) acc[date] = [];
 *   acc[date].push(av);
 *   return acc;
 * }, {});
 * 
 * // Afficher "Lundi 15 décembre : 14h-15h, 16h-17h"
 * Object.entries(byDate).forEach(([date, slots]) => {
 *   console.log(date, ':', slots.map(s => s.startTime).join(', '));
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Réserver un créneau
 * const availabilities = await getPsyAvailabilities('psy-id-123');
 * const firstSlot = availabilities.data[0];
 * 
 * await bookAppointment({
 *   availabilityId: firstSlot.id,
 *   type: 'ONLINE'
 * });
 * 
 * console.log('RDV réservé pour le', firstSlot.date, 'à', firstSlot.startTime);
 * ```
 * 
 * @note Les créneaux déjà réservés ne sont PAS renvoyés par cette route.
 *       Dès qu'un patient réserve, le créneau disparaît de la liste.
 * 
 * @note Structure d'une Availability :
 *       { id, date, startTime, endTime, psychologist: { id, firstName, lastName } }
 */
export const getPsyAvailabilities = (psyId: string) =>
  api.get(`/psy/${psyId}/availabilities`);
