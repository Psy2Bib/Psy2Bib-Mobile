/**
 * @fileoverview Section calendrier complète pour les psychologues
 * 
 * Composant ultra-complet (900+ lignes) qui affiche un calendrier interactif avec :
 * - Vue semaine OU vue mois (toggle)
 * - Disponibilités (créneaux libres créés par le psy)
 * - Rendez-vous (RDV avec patients, statuts CONFIRMED/PENDING/CANCELLED...)
 * - Tâches personnelles (compte-rendus, admin, RDV externes...)
 * 
 * ═══════════════════════════════════════════════════════════════
 *  FONCTIONNALITÉS PRINCIPALES
 * ═══════════════════════════════════════════════════════════════
 * 
 * 1. SÉLECTION DE DATE
 *    - Vue semaine : 7 jours horizontaux (lundi-dimanche)
 *    - Vue mois : Calendrier complet avec react-native-calendars
 *    - Navigation : Flèches gauche/droite pour changer de semaine
 *    - Indicateurs visuels : Dots colorés selon le type d'événement
 * 
 * 2. AGRÉGATION PAR DATE
 *    - Regroupe disponibilités, RDV, et tâches par date
 *    - Tri automatique par heure
 *    - Calcul des dots pour le calendrier (vert=dispo, violet=RDV, orange=tâche)
 * 
 * 3. AFFICHAGE DÉTAILLÉ DU JOUR
 *    - Liste des disponibilités avec statut "Libre" ou "Réservé"
 *    - Liste des rendez-vous avec statut (pill coloré selon CONFIRMED/PENDING...)
 *    - Liste des tâches avec checkbox, type (RDV/Compte-rendu/Admin/Autre)
 *    - Actions : Supprimer dispo, cocher/décocher tâche, éditer/supprimer tâche
 * 
 * 4. GESTION DES TÂCHES
 *    - Bouton "+Tâche" pour créer une nouvelle tâche
 *    - Checkbox pour marquer comme terminée (ligne barrée)
 *    - Boutons éditer/supprimer sur chaque tâche
 *    - Badge coloré selon le type (RDV violet, Compte-rendu indigo, Admin bleu, Autre gris)
 * 
 * ═══════════════════════════════════════════════════════════════
 *  DÉPENDANCES
 * ═══════════════════════════════════════════════════════════════
 * 
 * - react-native-calendars : Affichage du calendrier mois (avec dots multi-couleurs)
 * - @expo/vector-icons (Ionicons) : Icônes Material Design
 * - react-native (FlatList) : Listes performantes des événements
 * 
 * ═══════════════════════════════════════════════════════════════
 *  ARCHITECTURE DU CODE
 * ═══════════════════════════════════════════════════════════════
 * 
 * 1. Configuration LocaleConfig (français) pour react-native-calendars
 * 2. Fonctions utilitaires :
 *    - formatDateKey() : Convertir Date → "YYYY-MM-DD"
 *    - buildWeekDays() : Générer les 7 jours de la semaine
 *    - getISOWeekNumber() : Calculer le numéro de semaine ISO
 * 3. Hook useMemo pour :
 *    - eventsByDate : Agrégation de tous les événements par date
 *    - markedDates : Génération des dots pour le calendrier
 *    - weekDays : Calcul de la semaine actuelle
 * 4. Fonctions de rendu (renderAvailability, renderAppointment, renderTask)
 * 5. JSX principal avec conditionnels (showMonth ? <Calendar> : <WeekStrip>)
 * 
 * @author Psy2Bib Team
 * @since 1.0.0
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Calendar,
  type DateData,
  LocaleConfig,
} from 'react-native-calendars';
import type { PsyTask , PsyTaskType} from '../../types/psyCalendar';

/**
 * Configuration de la locale française pour react-native-calendars.
 * 
 * Permet d'afficher le calendrier en français (mois, jours de la semaine...).
 * IMPORTANT : Cette config est globale (affecte tous les composants Calendar de l'app).
 */
LocaleConfig.locales.fr = {
  monthNames: [
    'Janvier','Février','Mars','Avril','Mai','Juin',
    'Juillet','Août','Septembre','Octobre','Novembre','Décembre',
  ],
  monthNamesShort: [
    'Janv.','Févr.','Mars','Avr.','Mai','Juin',
    'Juil.','Août','Sept.','Oct.','Nov.','Déc.',
  ],
  dayNames: [
    'Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi',
  ],
  dayNamesShort: ['Dim.','Lun.','Mar.','Mer.','Jeu.','Ven.','Sam.'],
  today: "Aujourd'hui",
};
LocaleConfig.defaultLocale = 'fr';

/**
 * Type représentant une disponibilité (créneau libre créé par le psy).
 */
export type Availability = {
  /** ID unique de la disponibilité */
  id: string;
  
  /** Date/heure de début (ISO 8601 : "2024-12-15T14:00:00Z") */
  start: string;
  
  /** Date/heure de fin (ISO 8601 : "2024-12-15T15:00:00Z") */
  end: string;
  
  /** Le créneau est-il déjà réservé par un patient ? */
  isBooked: boolean;
};

/**
 * Type représentant un rendez-vous (RDV entre psy et patient).
 */
export type Appointment = {
  /** ID unique du RDV */
  id: string;
  
  /** Informations du patient (côté psy) */
  patient?: { id?: string; pseudo?: string; email?: string };
  
  /** Informations du psy (côté patient) */
  psy?: { id?: string; pseudo?: string; email?: string; title?: string; firstName?: string; lastName?: string };
  
  /** Date/heure de début (ISO 8601) */
  start?: string;
  
  /** Date/heure de fin (ISO 8601) */
  end?: string;
  
  /** Statut du RDV ('CONFIRMED', 'PENDING', 'CANCELLED', 'IN_PROGRESS', 'DONE') */
  status?: string;
  
  /** Titre custom du RDV (ex: "Séance TCC n°5") */
  title?: string;
};

/**
 * Props du composant PsyCalendarSection.
 */
type Props = {
  /** Liste des disponibilités à afficher */
  availabilities: Availability[];
  
  /** Liste des rendez-vous à afficher */
  appointments: Appointment[];
  
  /** Liste des tâches personnelles à afficher */
  tasks: PsyTask[];
  
  /** Callback quand on veut ajouter une tâche (ouvre la modal de création) */
  onAddTaskRequest?: (date: string) => void;
  
  /** Callback quand on coche/décoche une tâche (marquer comme terminée) */
  onToggleTask?: (taskId: string) => void;
  
  /** Callback quand on veut éditer une tâche (ouvre la modal d'édition) */
  onEditTaskRequest?: (task: PsyTask) => void;
  
  /** Callback quand on supprime une tâche */
  onDeleteTask?: (taskId: string) => void;
  
  /** Callback quand on supprime une disponibilité */
  onDeleteAvailability?: (id: string) => void;
  
  /** Afficher ou masquer les disponibilités (défaut: true) */
  showAvailabilities?: boolean;
};

/**
 * Type interne pour regrouper les événements par date.
 * 
 * Structure : { "2024-12-15": { availabilities: [...], appointments: [...], tasks: [...] } }
 */
type EventsByDate = {
  [date: string]: {
    availabilities: Availability[];
    appointments: Appointment[];
    tasks: PsyTask[];
  };
};

/**
 * Type pour les dates marquées dans react-native-calendars.
 * 
 * Permet d'afficher des dots colorés sous chaque date qui a des événements.
 */
type MarkedDates = {
  [date: string]: {
    marked?: boolean;
    dots?: { key: string; color: string }[];
    selected?: boolean;
    selectedColor?: string;
  };
};

/** Couleur primaire Psy2Bib (violet) */
const PRIMARY = '#6A4CE6';

/** Couleur verte pour disponibilités */
const GREEN = '#2f9e62';

/** Couleur orange pour tâches */
const ORANGE = '#f97316';

/**
 * Convertit une Date en string "YYYY-MM-DD".
 * 
 * @param date - Objet Date JavaScript
 * @returns String format "YYYY-MM-DD"
 * 
 * @example
 * formatDateKey(new Date('2024-12-15T14:30:00Z')) // "2024-12-15"
 */
const formatDateKey = (date: Date) => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/**
 * Construit un tableau de 7 jours (lundi à dimanche) pour la vue semaine.
 * 
 * @param anchorDate - Date de référence (ex: "2024-12-15")
 * @returns Tableau de 7 objets { date: "YYYY-MM-DD", weekday: "Lun", dayNumber: "15" }
 * 
 * @example
 * buildWeekDays("2024-12-15")
 * // → [
 * //   { date: "2024-12-09", weekday: "Lun", dayNumber: "09" }, // Lundi de cette semaine
 * //   { date: "2024-12-10", weekday: "Mar", dayNumber: "10" },
 * //   ...
 * //   { date: "2024-12-15", weekday: "Dim", dayNumber: "15" }
 * // ]
 */
function buildWeekDays(anchorDate: string) {
  const base = new Date(anchorDate);
  if (Number.isNaN(base.getTime())) return [];
  
  // Calcul du lundi de la semaine
  const day = base.getDay(); // 0 = dimanche, 1 = lundi, ...
  const diffToMonday = (day + 6) % 7; // Nombre de jours à soustraire pour atteindre lundi
  const monday = new Date(base);
  monday.setDate(base.getDate() - diffToMonday);

  const formatter = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: '2-digit',
  });

  const days: { date: string; weekday: string; dayNumber: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const formatted = formatter.format(d).replace('.', ''); // "lun. 09" → "lun 09"
    const [weekdayRaw, dayRaw] = formatted.split(' ');
    const weekday = weekdayRaw.charAt(0).toUpperCase() + weekdayRaw.slice(1); // Capitaliser
    const dayNumber = dayRaw ?? '';
    days.push({ date: iso, weekday, dayNumber });
  }
  return days;
}

/**
 * Calcule le numéro de semaine ISO 8601 d'une date.
 * 
 * La norme ISO 8601 définit que :
 * - La semaine 1 est la première semaine qui contient un jeudi
 * - Les semaines commencent le lundi
 * 
 * @param dateStr - Date au format "YYYY-MM-DD"
 * @returns Numéro de semaine (1-53) ou null si date invalide
 * 
 * @example
 * getISOWeekNumber("2024-12-15") // 50 (semaine 50 de 2024)
 */
function getISOWeekNumber(dateStr: string): number | null {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  
  // Conversion en UTC pour éviter les problèmes de timezone
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = tmp.getUTCDay() || 7; // Dimanche = 7 au lieu de 0
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day); // Jeudi de la semaine
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((+tmp - +yearStart) / 86400000 + 1) / 7);
  return weekNo;
}

export default function PsyCalendarSection({
  availabilities,
  appointments,
  tasks,
  onAddTaskRequest,
  onToggleTask,
  onEditTaskRequest,
  onDeleteTask,
  onDeleteAvailability,
  showAvailabilities = true,
}: Props) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [showMonth, setShowMonth] = useState(false);

  // Agrégation par date
  const eventsByDate: EventsByDate = useMemo(() => {
    const map: EventsByDate = {};

    const addAvail = (dateKey: string, slot: Availability) => {
      if (!map[dateKey]) map[dateKey] = { availabilities: [], appointments: [], tasks: [] };
      map[dateKey].availabilities.push(slot);
    };

    const addApt = (dateKey: string, apt: Appointment) => {
      if (!map[dateKey]) map[dateKey] = { availabilities: [], appointments: [], tasks: [] };
      map[dateKey].appointments.push(apt);
    };

    const addTask = (dateKey: string, task: PsyTask) => {
      if (!map[dateKey]) map[dateKey] = { availabilities: [], appointments: [], tasks: [] };
      map[dateKey].tasks.push(task);
    };

    for (const slot of availabilities) {
      const d = new Date(slot.start);
      if (Number.isNaN(d.getTime())) continue;
      const key = formatDateKey(d);
      addAvail(key, slot);
    }

    for (const apt of appointments) {
      if (!apt.start) continue;
      const d = new Date(apt.start);
      if (Number.isNaN(d.getTime())) continue;
      const key = formatDateKey(d);
      addApt(key, apt);
    }

    for (const t of tasks) {
      if (!t.date) continue;
      addTask(t.date, t);
    }

    // tri léger
    Object.keys(map).forEach((date) => {
      map[date].appointments.sort((a, b) => (a.start ?? '').localeCompare(b.start ?? ''));
      map[date].availabilities.sort((a, b) => a.start.localeCompare(b.start));
      map[date].tasks.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
    });

    return map;
  }, [availabilities, appointments, tasks]);

  const currentDayData = eventsByDate[selectedDate] ?? {
    availabilities: [],
    appointments: [],
    tasks: [],
  };

  // Dots calendrier
  const markedDates: MarkedDates = useMemo(() => {
    const obj: MarkedDates = {};

    Object.keys(eventsByDate).forEach((date) => {
      const data = eventsByDate[date];
      const dots: { key: string; color: string }[] = [];
      if (data.availabilities.length > 0) dots.push({ key: 'slot', color: GREEN });
      if (data.appointments.length > 0) dots.push({ key: 'apt', color: PRIMARY });
      if (data.tasks.length > 0) dots.push({ key: 'task', color: ORANGE });

      if (dots.length > 0) {
        obj[date] = {
          marked: true,
          dots,
        };
        
      }
    });

    obj[selectedDate] = {
      ...(obj[selectedDate] ?? {}),
      selected: true,
      selectedColor: PRIMARY,
    };

    return obj;
  }, [eventsByDate, selectedDate]);

  const weekDays = useMemo(() => buildWeekDays(selectedDate), [selectedDate]);
  const currentWeekNumber = useMemo(
    () => getISOWeekNumber(selectedDate),
    [selectedDate],
  );

  const handleDayPress = (day: DateData) => {
    setSelectedDate(day.dateString);
  };

  const shiftWeek = (offset: number) => {
    const d = new Date(selectedDate);
    if (Number.isNaN(d.getTime())) return;
    d.setDate(d.getDate() + offset * 7);
    const iso = d.toISOString().slice(0, 10);
    setSelectedDate(iso);
  };

  const hasAnyEvents =
    currentDayData.availabilities.length > 0 ||
    currentDayData.appointments.length > 0 ||
    currentDayData.tasks.length > 0;

  // Renders

  const renderAvailability = ({ item }: { item: Availability }) => (
    <View style={styles.slotRow}>
      <View>
        <Text style={styles.slotTime}>
          {new Date(item.start).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          })}{' '}
          –{' '}
          {new Date(item.end).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text
          style={[
            styles.slotStatus,
            { color: item.isBooked ? '#EF4444' : GREEN },
          ]}
        >
          {item.isBooked ? 'Réservé' : 'Libre'}
        </Text>
        {!item.isBooked && onDeleteAvailability && (
          <Pressable onPress={() => onDeleteAvailability(item.id)} hitSlop={8}>
            <Ionicons name="trash-outline" size={16} color="#dc2626" />
          </Pressable>
        )}
      </View>
    </View>
  );

  const renderAppointment = ({ item }: { item: Appointment }) => (
    <View style={styles.aptRow}>
      <View style={styles.aptLeft}>
        <Text style={styles.aptTitle}>
          {item.title ||
            item.patient?.pseudo ||
            item.patient?.email ||
            item.psy?.pseudo ||
            item.psy?.email ||
            'Rendez-vous'}
        </Text>
        <Text style={styles.aptTime}>
          {item.start
            ? new Date(item.start).toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
              })
            : ''}
        </Text>
        <Text style={styles.aptStatus}>
          Statut :{' '}
          {item.status === 'CONFIRMED'
            ? 'Confirmé'
            : item.status === 'PENDING'
            ? 'En attente'
            : item.status === 'CANCELLED'
            ? 'Annulé'
            : item.status === 'IN_PROGRESS'
            ? 'En cours'
            : item.status === 'DONE'
            ? 'Terminé'
            : item.status ?? '—'}
        </Text>
      </View>
      <View>
        <View
          style={[
            styles.statusPill,
            item.status === 'CONFIRMED'
              ? { backgroundColor: '#DCFCE7', borderColor: '#22C55E' }
              : item.status === 'PENDING'
              ? { backgroundColor: '#FEF9C3', borderColor: '#F59E0B' }
              : item.status === 'CANCELLED'
              ? { backgroundColor: '#FEE2E2', borderColor: '#EF4444' }
              : item.status === 'IN_PROGRESS'
              ? { backgroundColor: '#DBEAFE', borderColor: '#3B82F6' }
              : { backgroundColor: '#E5E7EB', borderColor: '#9CA3AF' },
          ]}
        >
          <Text style={styles.statusPillText}>
            {item.status === 'CONFIRMED'
              ? 'Confirmé'
              : item.status === 'PENDING'
              ? 'En attente'
              : item.status === 'CANCELLED'
              ? 'Annulé'
              : item.status === 'IN_PROGRESS'
              ? 'En cours'
              : item.status === 'DONE'
              ? 'Terminé'
              : item.status ?? '—'}
          </Text>
        </View>
      </View>
    </View>
  );
  const TASK_TYPE_META: Record<PsyTaskType, { icon: string; color: string; label: string }> = {
    'rdv':           { icon: 'calendar-outline',        color: '#6A4CE6', label: 'RDV' },
    'compte-rendu':  { icon: 'document-text-outline',   color: '#4F46E5', label: 'Compte rendu' },
    'admin':         { icon: 'briefcase-outline',       color: '#0284C7', label: 'Administratif' },
    'autre':         { icon: 'ellipse-outline',         color: '#6B7280', label: 'Autre' },
  };
  
  const renderTask = ({ item }: { item: PsyTask }) => {
    const isDone = !!item.completed;
    const meta = TASK_TYPE_META[item.taskType];

    return (
      <View style={styles.taskRow}>

        {/* Checkbox */}
        <Pressable
          onPress={() => onToggleTask && onToggleTask(item.id)}
          style={[styles.taskCheck, isDone && styles.taskCheckDone]}
        >
          {isDone && (
            <Ionicons name="checkmark" size={14} color="#FFFFFF" />
          )}
        </Pressable>
  
        {/* Icône + texte */}
        <View style={styles.taskTextContainer}>
  
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {/* ICON */}
            <Ionicons name={meta.icon as any} size={16} color={meta.color} />
  
            {/* TITRE */}
            <Text
              style={[
                styles.taskTitle,
                isDone && styles.taskTitleDone,
              ]}
            >
              {item.title}
            </Text>
  
            {/* BADGE TYPE */}
            <View style={[styles.taskTypeBadge, { backgroundColor: meta.color + '22' }]}>
              <Text style={[styles.taskTypeBadgeText, { color: meta.color }]}>
                {meta.label}
              </Text>
            </View>
          </View>
  
          {/* Heure + notes */}
          {!!item.time && (
            <Text style={[styles.taskMeta, isDone && styles.taskMetaDone]}>
              {item.time}
            </Text>
          )}
  
          {!!item.notes && (
            <Text
              style={[styles.taskMeta, isDone && styles.taskMetaDone]}
              numberOfLines={1}
            >
              {item.notes}
            </Text>
          )}
        </View>
  
        {/* Action buttons */}
        <View style={styles.taskActions}>
          <Pressable
            onPress={() => onEditTaskRequest && onEditTaskRequest(item)}
            style={styles.taskActionEdit}
          >
            <Ionicons name="create-outline" size={14} color="#4B5563" />
          </Pressable>
          <Pressable
            onPress={() => onDeleteTask && onDeleteTask(item.id)}
            style={styles.taskActionDelete}
          >
            <Ionicons name="trash-outline" size={14} color="#DC2626" />
          </Pressable>
        </View>
      </View>
    );
  };
  

  return (
    <View style={styles.card}>
      {/* HEADER */}
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Agenda</Text>
        <View style={styles.headerRight}>
          {onAddTaskRequest && (
          <Pressable
            onPress={() => onAddTaskRequest && onAddTaskRequest(selectedDate)}
            style={styles.addTaskButton}
          >
            <Ionicons name="add" size={14} color="#FFFFFF" />
            <Text style={styles.addTaskText}>Tâche</Text>
          </Pressable>
          )}
          <Pressable
            onPress={() => setShowMonth((prev) => !prev)}
            style={styles.toggleButton}
          >
            <Text style={styles.toggleButtonText}>
              {showMonth ? 'Semaine' : 'Mois'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* WEEK HEADER */}
      {!showMonth && (
        <View style={styles.weekHeader}>
          <Pressable
            onPress={() => shiftWeek(-1)}
            hitSlop={10}
            style={styles.weekHeaderButton}
          >
            <Ionicons name="chevron-back" size={20} color={PRIMARY} />
          </Pressable>
          <Text style={styles.weekHeaderText}>
            {currentWeekNumber ? `Semaine ${currentWeekNumber}` : 'Semaine'}
          </Text>
          <Pressable
            onPress={() => shiftWeek(1)}
            hitSlop={10}
            style={styles.weekHeaderButton}
          >
            <Ionicons name="chevron-forward" size={20} color={PRIMARY} />
          </Pressable>
        </View>
      )}

      {/* WEEK STRIP */}
      {!showMonth && (
        <View style={styles.weekStrip}>
          {weekDays.map((d) => {
            const isSelected = d.date === selectedDate;
            const dayData = eventsByDate[d.date];
            const hasEvents =
              dayData &&
              (dayData.availabilities.length > 0 ||
                dayData.appointments.length > 0 ||
                dayData.tasks.length > 0);

            return (
              <Pressable
                key={d.date}
                style={[
                  styles.weekDay,
                  isSelected && styles.weekDaySelected,
                ]}
                onPress={() => setSelectedDate(d.date)}
              >
                <Text
                  style={[
                    styles.weekDayLabel,
                    isSelected && styles.weekDayLabelSelected,
                  ]}
                >
                  {d.weekday}
                </Text>
                <Text
                  style={[
                    styles.weekDayNumber,
                    isSelected && styles.weekDayNumberSelected,
                  ]}
                >
                  {d.dayNumber}
                </Text>
                {hasEvents && <View style={styles.weekDot} />}
              </Pressable>
            );
          })}
        </View>
      )}

      {/* MONTH VIEW */}
      {showMonth && (
        <Calendar
          current={selectedDate}
          onDayPress={handleDayPress}
          markedDates={markedDates}
          markingType="multi-dot"
          hideExtraDays
          theme={{
            backgroundColor: 'transparent',
            calendarBackground: 'transparent',
            todayTextColor: PRIMARY,
            dayTextColor: '#2D3B32',
            textDisabledColor: '#B4BDB7',
            arrowColor: PRIMARY,
            monthTextColor: '#1F2A24',
            textDayFontSize: 14,
            textMonthFontSize: 16,
            textMonthFontWeight: '600',
            textDayHeaderFontSize: 11,
          }}
          style={styles.calendar}
        />
      )}

      {/* HEADER JOUR */}
      <View style={styles.dayHeader}>
        <Text style={styles.dayHeaderTitle}>Jour sélectionné</Text>
        <Text style={styles.dayHeaderDate}>
          {selectedDate === todayStr ? "Aujourd’hui" : selectedDate}
        </Text>
      </View>

      {!hasAnyEvents ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={20} color="#A0A7A3" />
          <Text style={styles.emptyText}>
            Aucun créneau, rendez-vous ou tâche pour ce jour.
          </Text>
        </View>
      ) : (
        <>
          {/* Dispos (optionnel) */}
          {showAvailabilities && (
            <View style={{ marginTop: 6 }}>
              <Text style={styles.sectionTitle}>Disponibilités</Text>
              {currentDayData.availabilities.length === 0 ? (
                <Text style={styles.sectionEmpty}>Aucune disponibilité.</Text>
              ) : (
                <FlatList
                  data={currentDayData.availabilities}
                  renderItem={renderAvailability}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                />
              )}
            </View>
          )}

          {/* RDV */}
          <View style={{ marginTop: 10 }}>
            <Text style={styles.sectionTitle}>Rendez-vous</Text>
            {currentDayData.appointments.length === 0 ? (
              <Text style={styles.sectionEmpty}>Aucun rendez-vous.</Text>
            ) : (
              <FlatList
                data={currentDayData.appointments}
                renderItem={renderAppointment}
                keyExtractor={(item) => item.id}
                scrollEnabled={false}
              />
            )}
          </View>

          {/* TÂCHES */}
          {onAddTaskRequest && (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.sectionTitle}>Tâches</Text>
              {currentDayData.tasks.length === 0 ? (
                <Text style={styles.sectionEmpty}>Aucune tâche pour ce jour.</Text>
              ) : (
                <FlatList
                  data={currentDayData.tasks}
                  renderItem={renderTask}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                />
              )}
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#c8c6c5',
    backgroundColor: 'rgba(255,255,255,0.5)',
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2A24',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addTaskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  addTaskText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  toggleButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D4E2D9',
    backgroundColor: '#F6FBF8',
  },
  toggleButtonText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#3B4A40',
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    marginTop: 2,
  },
  weekHeaderButton: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  weekHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2A24',
    marginHorizontal: 8,
  },
  weekStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 6,
  },
  weekDay: {
    flex: 1,
    marginHorizontal: 2,
    borderRadius: 12,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDaySelected: {
    backgroundColor: '#E0D7FB',
  },
  weekDayLabel: {
    fontSize: 11,
    color: '#6B746E',
  },
  weekDayLabelSelected: {
    color: '#3F2B96',
    fontWeight: '600',
  },
  weekDayNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#252F2A',
    marginTop: 2,
  },
  weekDayNumberSelected: {
    color: '#3F2B96',
  },
  weekDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#6A4CE6',
    marginTop: 4,
  },
  calendar: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 4,
  },
  dayHeader: {
    marginTop: 8,
    marginBottom: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayHeaderTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3B32',
  },
  dayHeaderDate: {
    fontSize: 12,
    color: '#7B857F',
  },
  emptyState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  emptyText: {
    fontSize: 13,
    color: '#8C9690',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2D3B32',
    marginBottom: 4,
  },
  sectionEmpty: {
    fontSize: 12,
    color: '#8C9690',
  },
  slotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  slotTime: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1F2933',
  },
  slotStatus: {
    fontSize: 13,
    fontWeight: '600',
  },
  aptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    alignItems: 'center',
  },
  aptLeft: {
    flex: 1,
    paddingRight: 8,
  },
  aptTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  aptTime: {
    fontSize: 12,
    color: '#4B5563',
  },
  aptStatus: {
    fontSize: 12,
    color: '#6B7280',
  },
  aptDetailsButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D4C4FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#F4EEFF',
  },
  aptDetailsText: {
    fontSize: 11,
    color: '#4C1D95',
    fontWeight: '500',
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#111827',
  },
  // TASKS
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  taskCheck: {
    width: 20,
    height: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  taskCheckDone: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  taskTextContainer: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  taskMeta: {
    fontSize: 11,
    color: '#6B7280',
  },
  taskMetaDone: {
    color: '#9CA3AF',
  },
  taskActions: {
    flexDirection: 'row',
    gap: 6,
    marginLeft: 8,
  },
  taskActionEdit: {
    padding: 4,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
  },
  taskActionDelete: {
    padding: 4,
    borderRadius: 999,
    backgroundColor: '#FEE2E2',
  },
  taskTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
  },
  taskTypeBadgeText: {
    fontSize: 10,
    color: '#4C1D95',
    fontWeight: '500',
  },
  
});
