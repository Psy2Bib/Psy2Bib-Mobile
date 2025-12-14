/**
 * @fileoverview Types TypeScript pour les tâches du calendrier psy
 * 
 * Définit les structures de données pour les tâches personnelles des psychologues.
 * Ces tâches apparaissent dans PsyAvailabilityScreen (calendrier) aux côtés des RDV.
 * 
 * @author Psy2Bib Team
 * @since 1.0.0
 */

/**
 * Type de tâche psychologue.
 * 
 * Permet de catégoriser les tâches pour filtrage/affichage différencié.
 */
export type PsyTaskType = 
  /** Rendez-vous avec un patient (normalement géré via appointments, mais peut être utilisé pour RDV externes) */
  | 'rdv'
  
  /** Rédaction de compte-rendu de séance */
  | 'compte-rendu'
  
  /** Tâches administratives (facturation, courriers, déclarations...) */
  | 'admin'
  
  /** Autres tâches (formation, supervision, réunion...) */
  | 'autre';

/**
 * Structure d'une tâche personnelle du psychologue.
 * 
 * Utilisée dans PsyAvailabilityScreen pour afficher les tâches dans le calendrier.
 * Exemple : "Rédiger compte-rendu patient X" le 15/12 à 14h.
 */
export type PsyTask = {
  /** ID unique de la tâche (UUID généré par le backend) */
  id: string;
  
  /** 
   * Date de la tâche (format ISO 8601 : "YYYY-MM-DD").
   * Exemple : "2024-12-15"
   */
  date: string;
  
  /** 
   * Titre de la tâche (affiché dans le calendrier).
   * Exemple : "Rédiger compte-rendu patient Dupont"
   */
  title: string;
  
  /** 
   * Notes optionnelles (détails supplémentaires).
   * Exemple : "Séance n°5, focus sur gestion anxiété"
   */
  notes?: string;
  
  /** 
   * Heure de la tâche (optionnel, format "HH:mm").
   * Exemple : "14:00"
   * Si absent, la tâche est "toute la journée".
   */
  time?: string;
  
  /** 
   * Tâche terminée ?
   * Si true, affichée barrée ou grisée dans le calendrier.
   */
  completed: boolean;
  
  /** 
   * Type de tâche (pour catégorisation et filtrage).
   * @see PsyTaskType
   */
  taskType: PsyTaskType;
};

/**
 * ═══════════════════════════════════════════════════════════════
 *  EXEMPLES D'UTILISATION
 * ═══════════════════════════════════════════════════════════════
 * 
 * 1. CRÉER UNE TÂCHE :
 * 
 * ```typescript
 * const newTask: PsyTask = {
 *   id: 'abc-123',
 *   date: '2024-12-15',
 *   title: 'Rédiger compte-rendu patient X',
 *   notes: 'Séance n°5, focus gestion anxiété',
 *   time: '14:00',
 *   completed: false,
 *   taskType: 'compte-rendu'
 * };
 * 
 * await createPsyTask(newTask);
 * ```
 * 
 * 2. AFFICHER DANS LE CALENDRIER :
 * 
 * ```typescript
 * const tasks = await listPsyTasks();
 * 
 * // Filtrer les tâches du jour
 * const today = new Date().toISOString().split('T')[0];
 * const todayTasks = tasks.data.filter(t => t.date === today);
 * 
 * // Afficher
 * todayTasks.forEach(task => {
 *   console.log(
 *     task.time ? `${task.time} -` : '',
 *     task.title,
 *     task.completed ? '✓' : ''
 *   );
 * });
 * ```
 * 
 * 3. MARQUER COMME TERMINÉE :
 * 
 * ```typescript
 * await updatePsyTask('task-id-123', {
 *   completed: true
 * });
 * ```
 * 
 * 4. FILTRER PAR TYPE :
 * 
 * ```typescript
 * const tasks = await listPsyTasks();
 * 
 * // Uniquement les comptes-rendus à rédiger
 * const reports = tasks.data.filter(t => 
 *   t.taskType === 'compte-rendu' && !t.completed
 * );
 * 
 * console.log('Comptes-rendus en attente:', reports.length);
 * ```
 */
  