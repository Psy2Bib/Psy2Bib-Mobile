/**
 * @fileoverview Tableau de bord Patient (Dashboard)
 * 
 * Écran principal pour les patients connectés. Affiche :
 * - Statistiques : Prochains RDV, Messages non lus
 * - Liste des rendez-vous à venir
 * - Calendrier avec les RDV confirmés
 * - Bouton "Test matériel" (désactivé temporairement, alert)
 * - Bottom bar de navigation (PatientBottomBar)
 * 
 * Navigation :
 * - "Rechercher un psy" → SearchPsyScreen
 * - Clic sur un RDV → Détails (futur: PsyProfileScreen ou RDV detail)
 * - "Messages" → MessagesListScreen via bottom bar
 * 
 * Refresh :
 * - Pull-to-refresh pour actualiser les données
 * - useFocusEffect pour recharger au retour sur cet écran
 * 
 * @author Psy2Bib Team
 * @since 1.0.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View, SafeAreaView, Alert } from 'react-native';
import { Button, Card, IconButton, Text, useTheme } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { Background } from '../../components/Background';
import { api } from '../../api/client';
import { getUnreadCount } from '../../api/chat.api';
import { PatientBottomBar } from '../../components/PatientBottomBar';
import { getPatientCalendar } from '../../api/calendar.api';
import PsyCalendarSection, {
  Availability,
  Appointment as CalendarAppointment,
} from '../../components/psy/PsyCalendarSection';

/**
 * Type local pour les rendez-vous patient.
 * Structure flexible pour supporter différents formats d'API.
 */
type Appointment = {
  id: string;
  date?: string;
  start?: string;
  end?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  time?: string;
  psychologist?: string;
  specialty?: string;
  psy?: { id?: string; pseudo?: string; email?: string; firstName?: string; lastName?: string; title?: string };
};

/**
 * Tableau de bord Patient.
 * 
 * État local :
 * - appointments : Liste des RDV du patient
 * - calendarAppointments : RDV formatés pour le calendrier
 * - availabilities : Disponibilités (vides côté patient)
 * - unreadMessages : Nombre de messages non lus
 * - loading : Chargement initial
 * - refreshing : Pull-to-refresh en cours
 * - error : Message d'erreur
 * 
 * @returns {JSX.Element} Dashboard patient avec stats, RDV et calendrier
 */
export const PatientDashboardScreen = () => {
  const { user } = useAuth();
  const theme = useTheme();
  const nav = useNavigation<any>();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [calendarAppointments, setCalendarAppointments] = useState<CalendarAppointment[]>([]);
  const [availabilities, setAvailabilities] = useState<Availability[]>([]);
  const [unreadMessages, setUnreadMessages] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/appointments/my');
      const raw = res.data;
      const items = Array.isArray(raw) ? raw : raw?.appointments;
      setAppointments(items ?? []);

      const calRes = await getPatientCalendar();
      const apps = Array.isArray(calRes.data?.appointments) ? calRes.data.appointments : [];
      let mapped: CalendarAppointment[] = apps.map((a: any) => ({
        ...a,
        start: a.scheduledStart || a.start || a.availability?.start,
        end: a.scheduledEnd || a.end || a.availability?.end,
        title: a.psy
          ? `Rendez-vous avec ${a.psy.title ?? 'Dr'} ${a.psy.pseudo ?? a.psy.email ?? ''}`.trim()
          : a.title,
      }));

      // Fallback si le calendrier back ne renvoie rien : on se base sur /appointments/my
      if (mapped.length === 0 && Array.isArray(items) && items.length > 0) {
        mapped = items.map((a: any) => ({
          id: a.id,
          start: a.start || a.date || a.availability?.start,
          end: a.end || a.availability?.end,
          status: a.status,
          patient: a.patient,
          psy: a.psy,
          title: a.psy
            ? `Rendez-vous avec ${a.psy.title ?? 'Dr'} ${a.psy.pseudo ?? a.psy.email ?? ''}`.trim()
            : a.title,
        }));
      }
      setCalendarAppointments(mapped);
      setAvailabilities([]);

      const unreadRes = await getUnreadCount();
      setUnreadMessages(unreadRes.data?.count ?? 0);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Erreur de chargement des rendez-vous';
      setError(msg);
      console.warn('[patient-dashboard] load error', msg);
    } finally {
      setLoading(false);
    }
  }, []);

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
    const list = Array.isArray(appointments) ? appointments : [];
    const upcoming = list
      .map((apt) => {
        const dateStr = apt.scheduledStart || apt.start || apt.date || (apt as any)?.availability?.start;
        const d = dateStr ? new Date(dateStr) : null;
        return { ...apt, _d: d };
      })
      .filter(
        (apt) =>
          apt._d &&
          apt._d >= new Date() &&
          (apt as any).status === 'CONFIRMED',
      )
      .sort((a, b) => (a._d as any) - (b._d as any));

    const today = new Date();
    const todayCount = upcoming.filter((apt) => {
      if (!apt._d) return false;
      const d = apt._d;
      return (
        d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear()
      );
    }).length;

    return {
      totalAppointments: list.length,
      todayCount,
      unreadMessages,
      upcomingCount: upcoming.length,
      nextAppointment: upcoming[0] ?? null,
    };
  }, [appointments, unreadMessages]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Background>
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingTop: 32, gap: 16 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
          }
        >
          {/* HEADER */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <IconButton
              icon="account"
              onPress={() => nav.navigate('PatientProfile' as never)}
              style={{ backgroundColor: theme.colors.surfaceVariant, borderRadius: 999 }}
            />
            <View style={{ flex: 1, marginLeft: 8 }}>

              <Text style={{ color: theme.colors.onSurfaceVariant,fontWeight: '800', fontSize: 18 }}>
                Bienvenue, <Text>{user?.pseudo ?? user?.email ?? ''}</Text>
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

          {/* Statistiques rapides (design harmonisé avec psy) */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Card style={{ flex: 1, backgroundColor: '#4b3cc4' }}>
              <Card.Content>
                <Text style={{ color: '#ddd' }}>Messages non lus</Text>
                <Text variant="headlineMedium" style={{ color: 'white', fontWeight: '800' }}>
                  {stats.unreadMessages}
                </Text>
              </Card.Content>
            </Card>
            <Card style={{ flex: 1, backgroundColor: '#2f9e62' }}>
              <Card.Content>
                <Text style={{ color: '#ddd' }}>RDV à venir</Text>
                <Text variant="headlineMedium" style={{ color: 'white', fontWeight: '800' }}>
                  {stats.upcomingCount}
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
                Vérifie ta caméra, ton micro et l’avatar de suivi avant une visio.
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


          {/* Agenda synchronisé (RDV) */}
          <PsyCalendarSection
            availabilities={availabilities}
            appointments={calendarAppointments}
            tasks={[]}
            showAvailabilities={false}
          />
        </ScrollView>

        <PatientBottomBar
          activeTab="home"
          onPressHome={() => nav.navigate('PatientDashboard' as never)}
          onPressSearch={() => nav.navigate('SearchPsy' as never)}
          onPressAppointments={() => nav.navigate('PatientAppointments' as never)}
          onPressMessages={() => nav.navigate('Messages' as never)}
          onPressProfile={() => nav.navigate('PatientProfile' as never)}
        />
      </Background>
    </SafeAreaView>
  );
};
