/**
 * @fileoverview API de gestion des disponibilités des psychologues
 * 
 * Les disponibilités (availabilities) sont les créneaux horaires que les psychologues
 * rendent disponibles à la réservation.
 * 
 * Workflow :
 * 1. Le psy crée une disponibilité (ex: "Lundi 14h-15h")
 * 2. Les patients voient ce créneau dans le calendrier du psy
 * 3. Un patient réserve → création d'un rendez-vous (appointment)
 * 4. La disponibilité devient "occupée" et disparaît des créneaux disponibles
 * 
 * @author Psy2Bib Team
 * @since 1.0.0
 */

import { api } from './client';

/**
 * Crée une nouvelle disponibilité pour le psychologue connecté.
 * 
 * Seuls les psychologues peuvent créer des disponibilités.
 * Le backend vérifie automatiquement le rôle via le JWT.
 * 
 * Workflow dans l'UI (PsyCalendarScreen) :
 * 1. Le psy ouvre le calendrier
 * 2. Il clique sur un jour → Modal "Ajouter un créneau"
 * 3. Il choisit la date, heure de début et heure de fin
 * 4. Cette fonction est appelée avec ces données
 * 5. Le créneau apparaît dans son calendrier
 * 
 * @param body - Données du créneau à créer
 * @param body.date - Date du créneau (format ISO : "2024-12-15")
 * @param body.startTime - Heure de début (format "HH:mm" : "14:00")
 * @param body.endTime - Heure de fin (format "HH:mm" : "15:00")
 * 
 * @returns Promise<Availability> - La disponibilité créée (avec son ID)
 * 
 * @example
 * ```typescript
 * // Créer un créneau le 15 décembre de 14h à 15h
 * const availability = await createPsyAvailability({
 *   date: '2024-12-15',
 *   startTime: '14:00',
 *   endTime: '15:00'
 * });
 * 
 * console.log('Créneau créé:', availability.data.id);
 * ```
 * 
 * @throws {AxiosError} Si le créneau chevauche une disponibilité existante
 *                      ou si la date est dans le passé
 * 
 * @todo Ajouter validation côté client (empêcher création dans le passé)
 * @todo Permettre la création de créneaux récurrents (ex: tous les lundis 14h-15h)
 */
export const createPsyAvailability = (body: { 
  date: string; 
  startTime: string; 
  endTime: string 
}) =>
  api.post('/psy/availabilities', body);

/**
 * Supprime une disponibilité du psychologue connecté.
 * 
 * Seul le psychologue qui a créé la disponibilité peut la supprimer.
 * 
 * Cas d'usage :
 * - Le psy se rend compte qu'il ne sera pas disponible ce jour-là
 * - Il veut modifier l'horaire (supprimer puis recréer avec new horaires)
 * 
 * 
 * @param id - ID de la disponibilité à supprimer (UUID)
 * 
 * @returns Promise<void> - Pas de données retournées
 * 
 * @example
 * ```typescript
 * // Supprimer un créneau
 * await deletePsyAvailability('550e8400-e29b-41d4-a716-446655440000');
 * console.log('Créneau supprimé');
 * 
 * // Rafraîchir le calendrier
 * const calendar = await getPsyCalendar();
 * ```
 * 
 * @throws {AxiosError} Si la disponibilité n'existe pas ou si elle est déjà réservée
 * 
 * @note Pour modifier une disponibilité, il faut supprimer puis recréer.
 *       Idéalement, ajouter une route PATCH /psy/availabilities/:id pour mettre à jour
 *       directement (évite la suppression/recréation).
 */
export const deletePsyAvailability = (id: string) =>
  api.delete(`/psy/availabilities/${id}`);
