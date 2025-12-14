/**
 * @fileoverview Écran de gestion des rendez-vous Patient
 * 
 * Liste tous les RDV du patient (à venir, passés, annulés...).
 * Permet de consulter les détails, annuler un RDV ou le replanifier.
 * 
 * Fonctionnalités :
 * - Liste des RDV triée par date (plus récent en haut)
 * - Statut du RDV (CONFIRMED, PENDING, CANCELLED...)
 * - Bouton "Annuler" (si statut permet)
 * - Bouton "Modifier" → Modal de replanification avec nouveaux créneaux
 * - Pull-to-refresh pour actualiser
 * - Bottom bar navigation (PatientBottomBar)
 * 
 * API :
 * - getMyAppointments() : Récupère tous les RDV du patient
 * - cancelAppointment(appointmentId) : Annule un RDV
 * - getPsyAvailabilities(psychologistId) : Pour replanification
 * - bookAppointment(availabilityId) : Nouveau RDV après annulation
 * 
 * @author Psy2Bib Team
 * @since 1.0.0
 */

import React, { useCallback, useState } from 'react';
import { View, FlatList, RefreshControl, Alert, Pressable, SafeAreaView } from 'react-native';
import {
  Text,
  useTheme,
  Card,
  Button,
  Chip,
  IconButton,
  ActivityIndicator,
  Modal,
  Portal,
} from 'react-native-paper';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Background } from '../../components/Background';
import { PatientBottomBar } from '../../components/PatientBottomBar';
import {
  getMyAppointments,
  cancelAppointment,
  bookAppointment,
  type Appointment,
} from '../../api/appointments.api';
import { getPsyAvailabilities } from '../../api/psychologists.api';

/**
 * Écran de gestion des RDV Patient.
 * 
 * État local :
 * - appointments : Liste des RDV du patient
 * - loading : Chargement initial
 * - refreshing : Pull-to-refresh en cours
 * - error : Message d'erreur
 * - rescheduleModalVisible : Modal de replanification
 * - selectedAppointment : RDV sélectionné pour modification
 * - availableSlots : Nouveaux créneaux disponibles pour replanification
 * - slotsLoading : Chargement des créneaux
 * 
 * @returns {JSX.Element} Liste des RDV avec actions (annuler, modifier)
 */
export const PatientAppointmentsScreen = () => {
  const theme = useTheme();
  const navigation = useNavigation<any>();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pour la modification
  const [rescheduleModalVisible, setRescheduleModalVisible] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMyAppointments();
      // Le back retourne { count, appointments: [...] }
      const data = res.data?.appointments || [];
      setAppointments(data);
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ??
        e?.message ??
        'Impossible de charger vos rendez-vous';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleCancel = async (appt: Appointment) => {
    const start = new Date(appt.scheduledStart);
    const now = new Date();
    const diffHours = (start.getTime() - now.getTime()) / (1000 * 60 * 60);
    const isConfirmed = appt.status === 'CONFIRMED';

    // Règle : si confirmé => blocage < 24h, sinon toujours possible
    if (isConfirmed && diffHours < 24) {
      Alert.alert(
        'Annulation impossible',
        "Vous ne pouvez pas annuler un rendez-vous confirmé moins de 24h à l'avance."
      );
      return;
    }

    Alert.alert(
      'Annuler le rendez-vous',
      'Voulez-vous vraiment annuler ce rendez-vous ?',
      [
        { text: 'Non', style: 'cancel' },
        {
          text: 'Oui, annuler',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelAppointment(appt.id);
              load(); // recharge la liste
            } catch (e: any) {
              Alert.alert(
                'Erreur',
                e?.response?.data?.message ?? "Impossible d'annuler"
              );
            }
          },
        },
      ]
    );
  };

  const openReschedule = async (appt: Appointment) => {
    const start = new Date(appt.scheduledStart);
    const now = new Date();
    const diffHours = (start.getTime() - now.getTime()) / (1000 * 60 * 60);
    const isConfirmed = appt.status === 'CONFIRMED';

    // Règle : si confirmé => blocage < 24h, sinon toujours possible
    if (isConfirmed && diffHours < 24) {
      Alert.alert(
        'Modification impossible',
        "Vous ne pouvez pas modifier un rendez-vous confirmé moins de 24h à l'avance."
      );
      return;
    }

    setSelectedAppointment(appt);
    setRescheduleModalVisible(true);
    setSlotsLoading(true);
    setAvailableSlots([]);

    try {
      // On récupère les créneaux du psy
      const res = await getPsyAvailabilities(appt.psy.id);
      const raw = res.data; 
      // Adapter selon le format retourné par getPsyAvailabilities (slots ou items)
      const slots = (Array.isArray(raw?.slots)
        ? raw.slots
        : Array.isArray(raw)
        ? raw
        : raw?.availabilities || []).filter((s: any) => !s.isBooked);
      
      setAvailableSlots(slots);
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de charger les disponibilités du psy');
      setRescheduleModalVisible(false);
    } finally {
      setSlotsLoading(false);
    }
  };

  const confirmReschedule = async (newSlotId: string) => {
    if (!selectedAppointment) return;
    
    // Logique: Annuler l'ancien + Réserver le nouveau
    // Idéalement ce serait une route PATCH /reschedule atomique, mais on compose ici.
    try {
      // 1. Annuler
      await cancelAppointment(selectedAppointment.id);
      // 2. Booker le nouveau
      await bookAppointment({ availabilityId: newSlotId, type: 'ONLINE' });
      
      setRescheduleModalVisible(false);
      Alert.alert('Succès', 'Rendez-vous déplacé avec succès.');
      load();
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message ?? 'Échec de la modification');
    }
  };

  const handleJoinVisio = (appt: Appointment) => {
    Alert.alert('Visio', 'La fonctionnalité de visio sera bientôt disponible !');
    // navigation.navigate('VisioRoom', { appointmentId: appt.id });
  };

  const formatPsyName = (u?: { firstName?: string; lastName?: string; pseudo?: string; email?: string }) => {
    if (!u) return 'Psychologue';
    if (u.lastName || u.firstName) {
      const last = u.lastName ? u.lastName.toUpperCase() : '';
      const first = u.firstName ? u.firstName : '';
      const full = `${last} ${first}`.trim();
      if (full) return full;
    }
    return u.pseudo || u.email || 'Psychologue';
  };

  const renderItem = ({ item }: { item: Appointment }) => {
    const start = new Date(item.scheduledStart);
    const end = new Date(item.scheduledEnd);
    const now = new Date();
    
    // État visuel
    let statusColor = theme.colors.primary;
    let statusLabel = 'À venir';

    if (item.status === 'CANCELLED') {
      statusColor = theme.colors.error;
      statusLabel = 'Annulé';
    } else if (item.status === 'DONE' || (item.status === 'CONFIRMED' && end < now)) {
      statusColor = theme.colors.outline;
      statusLabel = 'Terminé';
    } else if (item.status === 'CONFIRMED') {
      statusColor = '#10b981'; // vert
      statusLabel = 'Confirmé';
    } else if (item.status === 'PENDING') {
      statusColor = '#f59e0b'; // orange
      statusLabel = 'En attente';
    }

    const isFuture = start > now && item.status !== 'CANCELLED' && item.status !== 'DONE';
    const canJoin = isFuture && (start.getTime() - now.getTime()) < 15 * 60 * 1000; // 15 min avant
    const diffHours = (start.getTime() - now.getTime()) / (1000 * 60 * 60);
    const isConfirmed = item.status === 'CONFIRMED';
    // Si pas confirmé: toujours autorisé. Si confirmé: seulement si >=24h
    const canModifyOrCancel = isFuture && (!isConfirmed || diffHours >= 24);

    return (
      <Card style={{ marginBottom: 12, backgroundColor: theme.colors.surface, borderRadius: 12 }}>
        <Card.Content>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                {item.psy.pseudo || item.psy.email || 'Psychologue'}
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {start.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </Text>
              <Text variant="bodySmall" style={{ fontWeight: '700', marginTop: 2 }}>
                {start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} -{' '}
                {end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <Chip
              compact
              style={{ backgroundColor: 'transparent', borderWidth: 1, borderColor: statusColor }}
              textStyle={{ color: statusColor, fontSize: 11, fontWeight: '700' }}
            >
              {statusLabel}
            </Chip>
          </View>

          {/* Actions */}
          <View style={{ flexDirection: 'row', marginTop: 16, gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            
            {/* Bouton rejoindre */}
            {item.status !== 'CANCELLED' && (
              <Button
                mode="contained"
                icon="video"
                disabled={!canJoin && item.status !== 'CONFIRMED' && item.status !== 'PENDING'} // Pour démo on laisse actif si futur
                onPress={() => handleJoinVisio(item)}
                style={{ borderRadius: 8 }}
                contentStyle={{ paddingHorizontal: 4 }}
                compact
              >
                Rejoindre
              </Button>
            )}

            {/* Modifier / Annuler si > 24h */}
            {canModifyOrCancel && (
              <>
                <Button
                  mode="outlined"
                  icon="pencil"
                  onPress={() => openReschedule(item)}
                  style={{ borderRadius: 8 }}
                  compact
                >
                  Modifier
                </Button>
                <Button
                  mode="outlined"
                  icon="close"
                  textColor={theme.colors.error}
                  style={{ borderRadius: 8, borderColor: theme.colors.error }}
                  onPress={() => handleCancel(item)}
                  compact
                >
                  Annuler
                </Button>
              </>
            )}
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
    <Background>
      <View style={{ flex: 1 }}>
        <View style={{ padding: 20 }}>
          <Text variant="headlineSmall" style={{ fontWeight: '700', color: theme.colors.primary }}>
            Mes Rendez-vous
          </Text>
        </View>

        {loading && !refreshing ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator />
          </View>
        ) : (
          <FlatList
            data={appointments}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
            }
            ListEmptyComponent={
              <View style={{ alignItems: 'center', marginTop: 40 }}>
                <Text style={{ color: theme.colors.onSurfaceVariant }}>Aucun rendez-vous trouvé.</Text>
                <Button 
                  mode="contained" 
                  style={{ marginTop: 16 }}
                  onPress={() => navigation.navigate('SearchPsy')}
                >
                  Prendre rendez-vous
                </Button>
              </View>
            }
          />
        )}

        {/* Modal de modification (liste des créneaux) */}
        <Portal>
          <Modal
            visible={rescheduleModalVisible}
            onDismiss={() => setRescheduleModalVisible(false)}
            style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}
            contentContainerStyle={{
              backgroundColor: 'white',
              margin: 16,
              borderRadius: 12,
              padding: 20,
              width: '92%',
              alignSelf: 'center',
            }}
          >
            <Text variant="titleMedium" style={{ marginBottom: 16, fontWeight: '700' }}>
              Modifier le rendez-vous
            </Text>
            {slotsLoading ? (
              <ActivityIndicator />
            ) : availableSlots.length === 0 ? (
              <Text>Aucun autre créneau disponible pour ce psychologue.</Text>
            ) : (
              <View>
                {/* Regroupement par jour */}
                {Object.entries(
                  availableSlots.reduce((acc: any, slot: any) => {
                    const date = new Date(slot.start).toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    });
                    if (!acc[date]) acc[date] = [];
                    acc[date].push(slot);
                    return acc;
                  }, {})
                ).map(([date, daySlots]) => (
                  <View key={date} style={{ marginBottom: 16 }}>
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: '700',
                        color: theme.colors.onSurface,
                        marginBottom: 8,
                        textTransform: 'capitalize',
                      }}
                    >
                      {date}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {(daySlots as any[])
                        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
                        .map((slot) => (
                          <Pressable
                            key={slot.id}
                            onPress={() => confirmReschedule(slot.id)}
                            style={({ pressed }: { pressed: boolean }) => ({
                              backgroundColor: pressed ? '#E0E7FF' : '#F1F5F9',
                              paddingVertical: 8,
                              paddingHorizontal: 12,
                              borderRadius: 8,
                              minWidth: 70,
                              alignItems: 'center',
                              borderWidth: 1,
                              borderColor: pressed ? theme.colors.primary : 'transparent',
                            })}
                          >
                            <Text
                              style={{
                                color: theme.colors.primary,
                                fontWeight: '600',
                                fontSize: 13,
                              }}
                            >
                              {new Date(slot.start).toLocaleTimeString('fr-FR', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </Text>
                          </Pressable>
                        ))}
                    </View>
                  </View>
                ))}
              </View>
            )}
            <Button 
              onPress={() => setRescheduleModalVisible(false)} 
              style={{ marginTop: 12 }}
              textColor={theme.colors.secondary}
            >
              Fermer
            </Button>
          </Modal>
        </Portal>

      </View>
      <PatientBottomBar
        activeTab="appointments"
        onPressHome={() => navigation.navigate('PatientDashboard')}
        onPressSearch={() => navigation.navigate('SearchPsy')}
        onPressAppointments={() => {}}
        onPressMessages={() => navigation.navigate('Messages')}
        onPressProfile={() => navigation.navigate('PatientProfile')}
      />
    </Background>
    </SafeAreaView>
  );
};

