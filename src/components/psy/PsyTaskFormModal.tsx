/**
 * @fileoverview Modal de création/édition de tâches pour les psychologues
 * 
 * Formulaire modal complet pour gérer les tâches personnelles du psy :
 * - Création de nouvelle tâche
 * - Édition de tâche existante
 * - Sélection du type (RDV, Compte-rendu, Admin, Autre)
 * - Saisie date, heure, titre, notes
 * 
 * Design moderne avec :
 * - Backdrop semi-transparent
 * - Card blanche arrondie avec ombre
 * - Pills cliquables pour le type de tâche (avec icônes colorées)
 * - Animation slide depuis le bas
 * 
 * Utilisé dans PsyAvailabilityScreen via PsyCalendarSection.
 * 
 * @author Psy2Bib Team
 * @since 1.0.0
 */

import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { PsyTask, PsyTaskType } from '../../types/psyCalendar';

/**
 * Type des valeurs du formulaire de tâche.
 * 
 * Légèrement différent de PsyTask car :
 * - id est optionnel (undefined lors de la création)
 * - completed n'est pas dans le formulaire (géré via checkbox dans le calendrier)
 */
type PsyTaskFormValues = {
  /** ID de la tâche (undefined si création, string si édition) */
  id?: string;
  
  /** Date de la tâche (format "YYYY-MM-DD") */
  date: string;
  
  /** Titre de la tâche */
  title: string;
  
  /** Notes optionnelles (détails) */
  notes?: string;
  
  /** Heure optionnelle (format "HH:mm") */
  time?: string;
  
  /** Type de tâche (RDV, Compte-rendu, Admin, Autre) */
  taskType: PsyTaskType;
};

/**
 * Props du composant PsyTaskFormModal.
 */
type Props = {
  /** Modal visible ou cachée */
  visible: boolean;
  
  /** Date initiale pré-remplie (date sélectionnée dans le calendrier) */
  initialDate: string;
  
  /** Tâche en cours d'édition (null si création) */
  editingTask?: PsyTask | null;
  
  /** Callback pour fermer la modal (annulation ou après soumission) */
  onClose: () => void;
  
  /** Callback pour soumettre le formulaire (création ou mise à jour) */
  onSubmit: (values: PsyTaskFormValues) => void;
};

/**
 * Configuration des types de tâche avec métadonnées visuelles.
 * 
 * Chaque type a :
 * - key : Valeur de l'enum PsyTaskType
 * - label : Texte affiché dans le pill
 * - icon : Icône Material Design (Ionicons)
 * - color : Couleur du pill quand sélectionné
 */
const TASK_TYPE_OPTIONS: { key: PsyTaskType; label: string; icon: string; color: string }[] = [
  { key: 'rdv',           label: 'RDV',            icon: 'calendar-outline',        color: '#6A4CE6' },
  { key: 'compte-rendu',  label: 'Compte rendu',   icon: 'document-text-outline',   color: '#4F46E5' },
  { key: 'admin',         label: 'Administratif',  icon: 'briefcase-outline',       color: '#0284C7' },
  { key: 'autre',         label: 'Autre',          icon: 'ellipse-outline',         color: '#6B7280' },
];

/**
 * Modal de formulaire pour créer ou éditer une tâche psy.
 * 
 * Fonctionnement :
 * 1. Si editingTask est null → Mode création (champs vides)
 * 2. Si editingTask existe → Mode édition (champs pré-remplis)
 * 3. Validation simple : Le titre est obligatoire
 * 4. Soumission : Appelle onSubmit avec les valeurs du formulaire
 * 5. Après soumission : Le parent (PsyAvailabilityScreen) gère l'API et ferme la modal
 * 
 * @param props - Props du composant
 * @returns {JSX.Element} Modal avec formulaire
 * 
 * @example
 * ```tsx
 * // Dans PsyAvailabilityScreen
 * const [showTaskModal, setShowTaskModal] = useState(false);
 * const [editingTask, setEditingTask] = useState<PsyTask | null>(null);
 * const [selectedDate, setSelectedDate] = useState('2024-12-15');
 * 
 * const handleSubmitTask = async (values: PsyTaskFormValues) => {
 *   if (values.id) {
 *     // Édition
 *     await updatePsyTask(values.id, values);
 *   } else {
 *     // Création
 *     await createPsyTask(values);
 *   }
 *   setShowTaskModal(false);
 *   refreshData();
 * };
 * 
 * return (
 *   <>
 *     <Button onPress={() => setShowTaskModal(true)}>Ajouter tâche</Button>
 *     
 *     <PsyTaskFormModal
 *       visible={showTaskModal}
 *       initialDate={selectedDate}
 *       editingTask={editingTask}
 *       onClose={() => {
 *         setShowTaskModal(false);
 *         setEditingTask(null);
 *       }}
 *       onSubmit={handleSubmitTask}
 *     />
 *   </>
 * );
 * ```
 */
export const PsyTaskFormModal: React.FC<Props> = ({
  visible,
  initialDate,
  editingTask,
  onClose,
  onSubmit,
}) => {
  /** État local du formulaire */
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState('');
  const [taskType, setTaskType] = useState<PsyTaskType>('autre');

  /**
   * useEffect pour pré-remplir le formulaire selon le mode (création vs édition).
   * 
   * Déclenché à chaque fois que :
   * - visible change (ouverture/fermeture de la modal)
   * - editingTask change (switch entre création et édition)
   * - initialDate change (changement de date sélectionnée)
   */
  useEffect(() => {
    if (editingTask) {
      // Mode édition : Pré-remplir avec les valeurs existantes
      setTitle(editingTask.title);
      setNotes(editingTask.notes ?? '');
      setDate(editingTask.date);
      setTime(editingTask.time ?? '');
      setTaskType(editingTask.taskType ?? 'autre');
    } else {
      // Mode création : Réinitialiser avec valeurs par défaut
      setTitle('');
      setNotes('');
      setDate(initialDate);
      setTime('');
      setTaskType('autre');
    }
  }, [visible, editingTask, initialDate]);

  /**
   * Gère la soumission du formulaire.
   * 
   * Validation :
   * - Le titre est obligatoire (trim pour éviter les espaces vides)
   * - Si titre vide, on ne soumet pas (return early)
   * 
   * Nettoyage :
   * - title et notes sont trim() pour enlever espaces début/fin
   * - time vide → undefined (pour éviter d'envoyer "" au backend)
   */
  const handleSubmit = () => {
    if (!title.trim()) return; // Validation : titre obligatoire
    
    onSubmit({
      id: editingTask?.id, // undefined si création, string si édition
      title: title.trim(),
      notes: notes.trim() || undefined, // undefined si vide
      date,
      time: time.trim() || undefined, // undefined si vide
      taskType,
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide" // Animation depuis le bas
      transparent // Pour afficher le backdrop
      onRequestClose={onClose} // Bouton retour Android
    >
      {/* Backdrop semi-transparent */}
      <View style={styles.backdrop}>
        
        {/* Card blanche avec formulaire */}
        <View style={styles.container}>
          
          {/* Header avec titre et bouton fermer */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {editingTask ? 'Modifier la tâche' : 'Nouvelle tâche'}
            </Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={20} color="#4B5563" />
            </Pressable>
          </View>

          {/* Body avec les champs du formulaire */}
          <View style={styles.body}>
            
            {/* Sélection du type de tâche (pills horizontales) */}
            <Text style={styles.label}>Type de tâche</Text>
            <View style={styles.typeRow}>
              {TASK_TYPE_OPTIONS.map((opt) => {
                const isActive = opt.key === taskType;
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => setTaskType(opt.key)}
                    style={[
                      styles.typePill,
                      // Style actif : Bordure + fond de la couleur du type
                      isActive && { 
                        borderColor: opt.color, 
                        backgroundColor: opt.color + '22' // 22 = 13% opacité
                      },
                    ]}
                  >
                    {/* Icône du type */}
                    <Ionicons
                      name={opt.icon as any}
                      size={14}
                      color={isActive ? opt.color : '#6B7280'}
                      style={{ marginRight: 4 }}
                    />
                    
                    {/* Label du type */}
                    <Text
                      style={[
                        styles.typePillText,
                        isActive && { color: opt.color, fontWeight: '600' },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Champ Titre */}
            <Text style={styles.label}>Titre</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Ex : Compte rendu de la séance 14h"
              style={styles.input}
              placeholderTextColor="#9CA3AF"
            />

            {/* Champ Date */}
            <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
            <TextInput
              value={date}
              onChangeText={setDate}
              placeholder="2025-12-07"
              style={styles.input}
              placeholderTextColor="#9CA3AF"
            />

            {/* Champ Heure (optionnel) */}
            <Text style={styles.label}>Heure (optionnel, HH:mm)</Text>
            <TextInput
              value={time}
              onChangeText={setTime}
              placeholder="09:30"
              style={styles.input}
              placeholderTextColor="#9CA3AF"
            />

            {/* Champ Notes (optionnel, multiline) */}
            <Text style={styles.label}>Notes (optionnel)</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Détails, lien visio, éléments à préparer..."
              style={[styles.input, styles.textarea]}
              placeholderTextColor="#9CA3AF"
              multiline
            />
          </View>

          {/* Footer avec boutons Annuler / Enregistrer */}
          <View style={styles.footer}>
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Annuler</Text>
            </Pressable>
            <Pressable style={styles.saveButton} onPress={handleSubmit}>
              <Text style={styles.saveButtonText}>
                {editingTask ? 'Enregistrer' : 'Ajouter'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '92%',
    maxWidth: 420,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      },
      android: {
        elevation: 6,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  body: {
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: '#4B5563',
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#111827',
  },
  textarea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  footer: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },
  saveButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#6A4CE6',
  },
  saveButtonText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  // types
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  
  typePillActive: {
    borderColor: '#6A4CE6',
    backgroundColor: '#EEF2FF',
  },
  typePillText: {
    fontSize: 11,
    color: '#4B5563',
    fontWeight: '500',
  },
  typePillTextActive: {
    color: '#4C1D95',
  },
});
