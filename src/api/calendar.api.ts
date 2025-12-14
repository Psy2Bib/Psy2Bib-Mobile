/**
 * @fileoverview API de gestion des calendriers (patient et psychologue)
 * 
 * Deux types de calendriers existent :
 * 
 * 1. Calendrier Patient :
 *    - Affiche uniquement les rendez-vous du patient (confirmés, en attente...)
 *    - Liste des RDV avec les psychologues
 * 
 * 2. Calendrier Psy :
 *    - Affiche les rendez-vous avec les patients
 *    - Affiche les disponibilités créées (créneaux libres)
 *    - Affiche les tâches personnelles (tasks)
 * 
 * @author Psy2Bib Team
 * @since 1.0.0
 */

import { api } from './client';

/**
 * Récupère le calendrier du psychologue connecté.
 * 
 * Le backend renvoie :
 * - appointments : Rendez-vous avec les patients (avec statut PENDING, CONFIRMED, DONE...)
 * - availabilities : Créneaux disponibles créés par le psy (encore libres)
 * - tasks : Tâches personnelles du psy (ex: "Rédiger compte-rendu patient X")
 * 
 * Ces données sont ensuite fusionnées dans l'UI pour afficher un calendrier unifié.
 * 
 * @returns Promise<PsyCalendarData> - Données du calendrier psy
 * 
 * @example
 * ```typescript
 * const calendar = await getPsyCalendar();
 * 
 * // Afficher les RDV confirmés
 * const confirmedAppts = calendar.data.appointments.filter(a => a.status === 'CONFIRMED');
 * console.log('RDV confirmés:', confirmedAppts.length);
 * 
 * // Afficher les créneaux libres
 * console.log('Créneaux disponibles:', calendar.data.availabilities.length);
 * ```
 * 
 * @note Les appointments incluent les informations du patient (firstName, lastName)
 *       pour affichage dans le calendrier.
 * 
 * @security Seul le psy connecté peut voir son propre calendrier (vérifié via JWT).
 */
export const getPsyCalendar = () => 
  api.get('/calendar/psy');

/**
 * Récupère le calendrier du patient connecté.
 * 
 * Le backend renvoie :
 * - appointments : Rendez-vous du patient (avec les infos du psy)
 * 
 * Plus simple que le calendrier psy (pas de disponibilités ni de tasks).
 * 
 * @returns Promise<PatientCalendarData> - Données du calendrier patient
 * 
 * @example
 * ```typescript
 * const calendar = await getPatientCalendar();
 * 
 * // Afficher les prochains RDV
 * const upcoming = calendar.data.appointments.filter(a => 
 *   new Date(a.scheduledStart) > new Date() && 
 *   a.status === 'CONFIRMED'
 * );
 * 
 * console.log('Prochains RDV:', upcoming);
 * ```
 * 
 * @note Les appointments incluent les informations du psychologue (pseudo, email)
 *       pour affichage dans le calendrier.
 * 
 * @security Seul le patient connecté peut voir son propre calendrier (vérifié via JWT).
 */
export const getPatientCalendar = () => 
  api.get('/calendar/patient');
