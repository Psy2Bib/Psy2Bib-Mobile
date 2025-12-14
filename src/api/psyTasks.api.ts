/**
 * @fileoverview API de gestion des tâches personnelles du psychologue
 * 
 * Les tâches (tasks) permettent aux psychologues d'organiser leur travail :
 * - "Rédiger compte-rendu pour patient X"
 * - "Préparer séance thérapeutique"
 * - "Renouveler assurance professionnelle"
 * 
 * Les tâches apparaissent dans le calendrier du psy (PsyCalendarScreen)
 * aux côtés des rendez-vous et disponibilités.
 * 
 * @author Psy2Bib Team
 * @since 1.0.0
 */

import { api } from './client';
import type { PsyTask } from '../types/psyCalendar';

/**
 * Récupère toutes les tâches du psychologue connecté.
 * 
 * Renvoie la liste complète des tâches (terminées et non terminées).
 * L'UI peut les filtrer selon les besoins.
 * 
 * @returns Promise<PsyTask[]> - Liste des tâches
 * 
 * @example
 * ```typescript
 * const tasks = await listPsyTasks();
 * 
 * // Filtrer les tâches non terminées
 * const pending = tasks.data.filter(t => !t.isCompleted);
 * console.log('Tâches en cours:', pending.length);
 * 
 * // Filtrer les tâches d'aujourd'hui
 * const today = tasks.data.filter(t => {
 *   const taskDate = new Date(t.date).toDateString();
 *   return taskDate === new Date().toDateString();
 * });
 * ```
 * 
 * @note Structure de PsyTask : { id, title, description, date, time, isCompleted }
 */
export const listPsyTasks = () => 
  api.get<PsyTask[]>('/psy-tasks');

/**
 * Crée une nouvelle tâche personnelle.
 * 
 * @param body - Données de la tâche à créer
 * @param body.title - Titre de la tâche (obligatoire, ex: "Rédiger compte-rendu")
 * @param body.description - Description détaillée (optionnel)
 * @param body.date - Date de la tâche (format ISO : "2024-12-15")
 * @param body.time - Heure de la tâche (optionnel, format "HH:mm" : "14:00")
 * @param body.isCompleted - Tâche terminée ? (défaut : false)
 * 
 * @returns Promise<PsyTask> - La tâche créée (avec son ID)
 * 
 * @example
 * ```typescript
 * // Créer une tâche pour demain
 * const task = await createPsyTask({
 *   title: 'Préparer séance patient X',
 *   description: 'Revoir notes précédentes et préparer exercices TCC',
 *   date: '2024-12-15',
 *   time: '10:00',
 *   isCompleted: false
 * });
 * 
 * console.log('Tâche créée:', task.data.id);
 * ```
 * 
 * @note Les tâches sont privées, seul le psy qui les crée peut les voir.
 */
export const createPsyTask = (body: Partial<PsyTask>) => 
  api.post<PsyTask>('/psy-tasks', body);

/**
 * Met à jour une tâche existante.
 * 
 * Permet de modifier n'importe quel champ (titre, date, statut...).
 * Update partiel : seuls les champs fournis sont modifiés.
 * 
 * @param id - ID de la tâche à modifier
 * @param body - Champs à mettre à jour (tous optionnels)
 * 
 * @returns Promise<PsyTask> - La tâche mise à jour
 * 
 * @example
 * ```typescript
 * // Marquer une tâche comme terminée
 * await updatePsyTask('task-id-123', {
 *   isCompleted: true
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Repousser une tâche à demain
 * await updatePsyTask('task-id-123', {
 *   date: '2024-12-16',
 *   time: '09:00'
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Modifier le titre et la description
 * await updatePsyTask('task-id-123', {
 *   title: 'Nouveau titre',
 *   description: 'Nouvelle description'
 * });
 * ```
 * 
 * @throws {AxiosError} Si la tâche n'existe pas ou n'appartient pas au psy connecté
 */
export const updatePsyTask = (id: string, body: Partial<PsyTask>) => 
  api.patch<PsyTask>(`/psy-tasks/${id}`, body);

/**
 * Supprime une tâche.
 * 
 * Suppression définitive, pas de corbeille.
 * 
 * @param id - ID de la tâche à supprimer
 * 
 * @returns Promise<void> - Pas de données retournées
 * 
 * @example
 * ```typescript
 * // Supprimer une tâche obsolète
 * await deletePsyTask('task-id-123');
 * console.log('Tâche supprimée');
 * 
 * // Rafraîchir la liste
 * const updated = await listPsyTasks();
 * ```
 * 
 * @throws {AxiosError} Si la tâche n'existe pas ou n'appartient pas au psy connecté
 * 
 * @note Aucune confirmation côté backend, penser à ajouter une confirmation dans l'UI.
 */
export const deletePsyTask = (id: string) => 
  api.delete(`/psy-tasks/${id}`);
