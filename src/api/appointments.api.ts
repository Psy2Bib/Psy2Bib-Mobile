/**
 * @fileoverview Module API pour la gestion des rendez-vous
 * 
 * Ce fichier centralise toutes les opérations liées aux rendez-vous :
 * - Réservation d'un créneau disponible
 * - Récupération de mes rendez-vous (patient ou psy)
 * - Annulation d'un rendez-vous
 * 
 * Les rendez-vous passent par plusieurs états :
 * PENDING → CONFIRMED → DONE (ou CANCELLED si annulé)
 * 
 * @author Psy2Bib Team
 * @since 1.0.0
 */

import { api } from './client';

/**
 * Type énumérant les différents statuts d'un rendez-vous.
 * 
 * - PENDING : En attente de confirmation du psy
 * - CONFIRMED : Accepté par le psy, RDV confirmé
 * - CANCELLED : Annulé (par patient ou psy)
 * - DONE : Rendez-vous terminé (passé)
 */
export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'DONE';

/**
 * Interface représentant un rendez-vous (appointment).
 * 
 * Un rendez-vous lie un patient à un psychologue pour un créneau horaire précis.
 * Il est créé lorsqu'un patient réserve une disponibilité proposée par le psy.
 */
export interface Appointment {
  /** Identifiant unique du rendez-vous (UUID généré par le backend) */
  id: string;
  
  /** Statut actuel du rendez-vous (voir AppointmentStatus) */
  status: AppointmentStatus;
  
  /** 
   * Date/heure de début du RDV (format ISO 8601)
   * Exemple : "2024-12-15T14:00:00.000Z"
   */
  scheduledStart: string;
  
  /** 
   * Date/heure de fin du RDV (format ISO 8601)
   * Exemple : "2024-12-15T15:00:00.000Z"
   */
  scheduledEnd: string;
  
  /** 
   * Informations du psychologue associé au RDV.
   * Le backend renvoie ces infos pour afficher le nom du psy côté patient.
   */
  psy: {
    /** ID du psychologue */
    id: string;
    /** Email du psy (parfois utilisé comme fallback si pas de pseudo) */
    email: string;
    /** Pseudo du psy (optionnel, affiché en priorité dans l'UI) */
    pseudo?: string;
  };
  
  /** 
   * Référence vers la disponibilité réservée (optionnel).
   * Utile pour retrouver le créneau initial si besoin.
   */
  availability?: {
    id: string;
  };
}

/**
 * Réserve un rendez-vous sur une disponibilité existante.
 * 
 * Workflow :
 * 1. Le patient choisit un créneau libre dans le calendrier du psy
 * 2. Il clique sur "Réserver"
 * 3. Cette fonction est appelée avec l'ID de la disponibilité
 * 4. Le backend crée un rendez-vous avec status="PENDING"
 * 5. Le psy reçoit une notification (à implémenter) et peut accepter/refuser
 * 
 * @param body - Objet contenant les détails de la réservation
 * @param body.availabilityId - ID de la disponibilité à réserver (ex: "550e8400-e29b-41d4-a716-446655440000")
 * @param body.type - Type de consultation : 'ONLINE' (visio) ou 'IN_PERSON' (cabinet)
 * 
 * @returns Promise<Appointment> - Le rendez-vous créé
 * 
 * @example
 * ```typescript
 * try {
 *   const rdv = await bookAppointment({
 *     availabilityId: 'abc-123',
 *     type: 'ONLINE'
 *   });
 *   console.log('RDV créé :', rdv.data);
 * } catch (error) {
 *   console.error('Erreur réservation :', error.response?.data?.message);
 * }
 * ```
 * 
 * @throws {AxiosError} Si la disponibilité n'existe pas ou est déjà réservée
 */
export const bookAppointment = (body: { availabilityId: string; type: 'ONLINE' | 'IN_PERSON' }) =>
  api.post('/appointments/book', body);

/**
 * Récupère la liste de MES rendez-vous (patient ou psy, selon l'utilisateur connecté).
 * 
 * Côté patient : Renvoie les RDV où je suis le patient
 * Côté psy : Renvoie les RDV où je suis le psychologue
 * 
 * Le backend filtre automatiquement selon le JWT (token) envoyé dans les headers.
 * 
 * @returns Promise<{ appointments: Appointment[] }> - Tableau de rendez-vous
 * 
 * @example
 * ```typescript
 * const response = await getMyAppointments();
 * const rdvs = response.data.appointments;
 * 
 * // Filtrer les RDV confirmés à venir
 * const prochains = rdvs.filter(rdv => 
 *   rdv.status === 'CONFIRMED' && 
 *   new Date(rdv.scheduledStart) > new Date()
 * );
 * ```
 * 
 * @note Les rendez-vous sont triés par date (plus récent en premier) côté backend
 */
export const getMyAppointments = () => 
  api.get<{ appointments: Appointment[] }>('/appointments/my');

/**
 * Annule un rendez-vous existant.
 * 
 * Peut être appelé par :
 * - Le patient (pour annuler sa demande ou un RDV confirmé)
 * - Le psy (pour refuser une demande ou annuler un RDV confirmé)
 * 
 * Après annulation, le status passe à 'CANCELLED' et la disponibilité redevient libre
 * (si le backend est bien implémenté, sinon le créneau reste bloqué).
 * 
 * @param appointmentId - ID du rendez-vous à annuler
 * 
 * @returns Promise<void> - Pas de données retournées, juste un status 200
 * 
 * @example
 * ```typescript
 * await cancelAppointment('rdv-123');
 * console.log('RDV annulé avec succès');
 * 
 * // Rafraîchir la liste des RDV
 * const updated = await getMyAppointments();
 * ```
 * 
 * @throws {AxiosError} Si le RDV n'existe pas ou si l'utilisateur n'a pas le droit de l'annuler
 * 
 * @todo Ajouter une route backend pour "reschedule" (reprogrammer) directement
 *       plutôt que de forcer à annuler + re-réserver
 */
export const cancelAppointment = (appointmentId: string) =>
  api.patch(`/appointments/${appointmentId}/cancel`);

/**
 * NOTE TECHNIQUE : Modification de rendez-vous
 * 
 * Actuellement, pour modifier un RDV (changer l'heure), on doit :
 * 1. Annuler le RDV existant (cancelAppointment)
 * 2. Réserver un nouveau créneau (bookAppointment)
 * 
 * Limitations :
 * - Si le nouveau créneau n'est plus disponible entre-temps, échec
 * - Deux appels API au lieu d'un seul
 * - Historique perdu (l'ancien RDV reste en CANCELLED)
 * 
 * Solution recommandée (backend) :
 * Ajouter une route PATCH /appointments/:id/reschedule { newAvailabilityId }
 * qui gère le changement atomiquement (transaction SQL).
 * 
 * Pour l'instant, on gère ce cas dans l'UI en enchaînant les appels.
 */
