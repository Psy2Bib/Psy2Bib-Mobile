/**
 * @fileoverview Tableau de bord Psychologue (Dashboard)
 * 
 * Écran principal pour les psychologues connectés. Affiche :
 * - Statistiques : Patients uniques, RDV du jour (confirmés), Messages non lus
 * - Calendrier complet avec :
 *   - Disponibilités (créneaux libres)
 *   - Rendez-vous (confirmés/en attente/annulés)
 *   - Tâches personnelles (compte-rendus, admin, autre)
 * - Bouton "Test matériel" (désactivé temporairement, alert)
 * - Bottom bar de navigation (PsyBottomBar)
 * 
 * Fonctionnalités Calendrier :
 * - Vue semaine ou mois (toggle)
 * - Ajout/édition/suppression de tâches (modal PsyTaskFormModal)
 * - Suppression de disponibilités
 * - Checkbox pour marquer une tâche comme terminée
 * 
 * Navigation :
 * - "Créer disponibilité" → PsyAvailabilityScreen
 * - "Voir mes RDV" → PsyAppointmentsScreen
 * - Bottom bar → Messages, Profile...
 * 
 * @author Psy2Bib Team
 * @since 1.0.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View, RefreshControl, SafeAreaView, Alert } from 'react-native';
import { Button, Card, IconButton, Text, useTheme } from 'react-native-paper';
import { useAuth } from '../../hooks/useAuth';
import { Background } from '../../components/Background';
import { getPsyCalendar } from '../../api/calendar.api';
import { getUnreadCount } from '../../api/chat.api';
import { PsyBottomBar } from '../../components/PsyBottomBar';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';

import PsyCalendarSection, {
  Availability,
  Appointment,
} from '../../components/psy/PsyCalendarSection';
import { PsyTaskFormModal } from '../../components/psy/PsyTaskFormModal';
import type { PsyTask , PsyTaskType} from '../../types/psyCalendar';
import { createPsyTask, deletePsyTask, listPsyTasks, updatePsyTask } from '../../api/psyTasks.api';
import { deletePsyAvailability } from '../../api/availability.api';

/**
 * Tableau de bord Psychologue.
 * 
 * État local :
 * - appointments : Liste des RDV du psy (tous statuts)
 * - availabilities : Disponibilités (créneaux libres)
 * - tasks : Tâches personnelles (PsyTask[])
 * - unreadMessages : Nombre de messages non lus
 * - loading : Chargement initial
 * - refreshing : Pull-to-refresh en cours
 * - error : Message d'erreur
 * - taskModalVisible : Affichage de la modal d'ajout/édition de tâche
 * - taskInitialDate : Date pré-remplie pour nouvelle tâche
 * - editingTask : Tâche en cours d'édition (null si création)
 * 
 * @returns {JSX.Element} Dashboard psy avec stats, calendrier et tâches
 */
export const PsyDashboardScreen = () => {
  const { user } = useAuth();
  const theme = useTheme();
  const navigation = useNavigation<any>();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tasks, setTasks] = useState<PsyTask[]>([]);
  const [taskModalVisible, setTaskModalVisible] = useState(false);
  const [taskInitialDate, setTaskInitialDate] = useState<string>(new Date().toISOString().slice(0,10));
  const [editingTask, setEditingTask] = useState<PsyTask | null>(null);

  const fetchData = useCallback(async () => {
    if (user?.role !== 'PSY') {
      setError('Accès réservé aux psychologues');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const calRes = await getPsyCalendar();
      const avs = Array.isArray(calRes.data?.availabilities)
        ? calRes.data.availabilities
        : [];
      const appsRaw = Array.isArray(calRes.data?.appointments)
        ? calRes.data.appointments
        : [];
      const apps = appsRaw.map((a: any) => ({
        ...a,
        // Normaliser les dates pour l'agenda
        start: a.start || a.scheduledStart || a.availability?.start,
        end: a.end || a.scheduledEnd || a.availability?.end,
        title: a.patient
          ? `Rendez-vous avec ${a.patient?.pseudo ?? a.patient?.email ?? ''}`.trim()
          : a.title,
      }));
      setAvailabilities(avs);
      setAppointments(apps);

      // charger les tâches persistées
      const tasksRes = await listPsyTasks();
      setTasks(tasksRes.data ?? []);

      const unreadRes = await getUnreadCount();
      setUnreadMessages(unreadRes.data?.count ?? 0);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Erreur de chargement';
      setError(msg);
      console.warn('[psy-dashboard] load error', msg);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const stats = useMemo(() => {
    const uniquePatients = new Set(
      appointments
        .map((a) => a.patient?.id || a.patient?.email || a.patient?.pseudo)
        .filter(Boolean) as string[],
    );
    const today = new Date();
    const todayAppointments = appointments.filter((a) => {
      const d = a.start ? new Date(a.start) : null;
      return (
        d &&
        d.toDateString() === today.toDateString() &&
        a.status === 'CONFIRMED'
      );
    });

    return {
      patients: uniquePatients.size,
      appointmentsToday: todayAppointments.length,
      unreadMessages,
    };
  }, [appointments, unreadMessages]);

  const handleAddTaskRequest = (date: string) => {
    setTaskInitialDate(date);
    setEditingTask(null);
    setTaskModalVisible(true);
  };

  const handleEditTaskRequest = (task: PsyTask) => {
    setTaskInitialDate(task.date);
    setEditingTask(task);
    setTaskModalVisible(true);
  };

  const handleToggleTask = async (taskId: string) => {
    try {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      const updated = { ...task, completed: !task.completed };
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      await updatePsyTask(taskId, { completed: updated.completed });
    } catch (e: any) {
      console.warn('[tasks] toggle error', e?.message ?? e);
      fetchData();
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      await deletePsyTask(taskId);
    } catch (e: any) {
      console.warn('[tasks] delete error', e?.message ?? e);
      fetchData();
    }
  };

  const handleDeleteAvailability = async (availabilityId: string) => {
    try {
      await deletePsyAvailability(availabilityId);
      setAvailabilities((prev) => prev.filter((a) => a.id !== availabilityId));
    } catch (e: any) {
      console.warn('[availabilities] delete error', e?.message ?? e);
      fetchData();
    }
  };

  const handleTaskSubmit = async (values: {
    id?: string;
    date: string;
    title: string;
    notes?: string;
    time?: string;
    taskType: PsyTaskType;
  }) => {
    try {
      if (values.id) {
        const res = await updatePsyTask(values.id, values);
        const saved = res.data;
        setTasks((prev) => prev.map((t) => (t.id === values.id ? (saved as any) : t)));
      } else {
        const res = await createPsyTask(values);
        setTasks((prev) => [...prev, res.data as any]);
      }
    } catch (e: any) {
      console.warn('[tasks] save error', e?.message ?? e);
      fetchData();
    } finally {
      setTaskModalVisible(false);
      setEditingTask(null);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Background>
        <View style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{ padding: 20, paddingTop: 32, gap: 16 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
            }
          >
            {/* HEADER */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <IconButton
                icon="briefcase"
                style={{ backgroundColor: theme.colors.surfaceVariant, borderRadius: 999 }}
              />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={{ color: theme.colors.onSurfaceVariant, fontWeight: '800', fontSize: 18 }}>
                  Espace Professionnel
                </Text>
                <Text style={{ color: theme.colors.onSurfaceVariant }}>
                  Bienvenue,{` `}
                  <Text style={{ fontWeight: '700' }}>
                    {(() => {
                      const last =
                        (user as any)?.lastName ||
                        (user as any)?.profile?.lastName ||
                        (user as any)?.psychologistProfile?.lastName;
                      const first =
                        (user as any)?.firstName ||
                        (user as any)?.profile?.firstName ||
                        (user as any)?.psychologistProfile?.firstName;
                      const full = `${last ? String(last).toUpperCase() : ''} ${first ?? ''}`.trim();
                      return full || user?.pseudo || user?.email || '';
                    })()}
                  </Text>
                </Text>
              </View>
            </View>

            {error && (
              <Card>
                <Card.Content>
                  <Text style={{ color: theme.colors.error }}>{error}</Text>
                </Card.Content>
              </Card>
            )}

            {/* STATS */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
            <Card style={{ flex: 1, backgroundColor: '#4b3cc4' }}>
              <Card.Content>
                <Text style={{ color: '#ddd' }}>Patients</Text>
                <Text> </Text>
                <Text variant="headlineMedium" style={{ color: 'white', fontWeight: '800' }}>
                  {stats.patients}
                </Text>
              </Card.Content>
            </Card>
              <Card style={{ flex: 1, backgroundColor: '#2f9e62' }}>
                <Card.Content>
                  <Text style={{ color: '#ddd' }}>RDV aujourd&apos;hui</Text>
                  <Text variant="headlineMedium" style={{ color: 'white', fontWeight: '800' }}>
                    {stats.appointmentsToday}
                  </Text>
                </Card.Content>
              </Card>
              <Card style={{ flex: 1, backgroundColor: '#4ba7d4' }}>
                <Card.Content>
                  <Text style={{ color: '#ddd' }}>Messages non lus</Text>
                  <Text variant="headlineMedium" style={{ color: 'white', fontWeight: '800' }}>
                    {stats.unreadMessages}
                  </Text>
                </Card.Content>
              </Card>
            </View>

            {/* Test matériel (caméra/micro) */}
            <Card style={{ borderRadius: 14, borderWidth: 1, borderColor: 'rgba(148,163,184,0.3)' }}>
              <Card.Content style={{ gap: 8 }}>
                <Text variant="titleMedium" style={{ fontWeight: '700', color: theme.colors.onSurface }}>
                  Test matériel
                </Text>
                <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}>
                  Vérifiez caméra, micro et avatar de suivi avant vos visios.
                </Text>
                <Button
                  mode="contained"
                  icon="video"
                  onPress={() =>
                    Alert.alert(
                      'Bientôt disponible',
                      'Le test matériel (caméra/micro/avatar) arrive bientôt.',
                    )
                  }
                  style={{ borderRadius: 10, alignSelf: 'flex-start' }}
                >
                  Lancer le test
                </Button>
              </Card.Content>
            </Card>

            {/* NOUVEL AGENDA CALENDRIER */}
            <PsyCalendarSection
              availabilities={availabilities}
              appointments={appointments}
              tasks={tasks}
              onAddTaskRequest={handleAddTaskRequest}
              onToggleTask={handleToggleTask}
              onEditTaskRequest={handleEditTaskRequest}
              onDeleteTask={handleDeleteTask}
              onDeleteAvailability={handleDeleteAvailability}
            />
          </ScrollView>

          <PsyBottomBar
            activeTab="home"
            onPressHome={() => navigation.navigate('PsyDashboard' as never)}
            onPressAvailability={() => navigation.navigate('PsyAvailability' as never)}
            onPressAppointments={() => navigation.navigate('PsyAppointments' as never)}
            onPressMessages={() => navigation.navigate('Messages' as never)}
            onPressProfile={() => navigation.navigate('PsyProfile' as never)}

          />

          {/* MODAL TÂCHE */}
          <PsyTaskFormModal
            visible={taskModalVisible}
            initialDate={taskInitialDate}
            editingTask={editingTask ?? undefined}
            onClose={() => {
              setTaskModalVisible(false);
              setEditingTask(null);
            }}
            onSubmit={handleTaskSubmit}
          />

        </View>
      </Background>
    </SafeAreaView>
  );
};
