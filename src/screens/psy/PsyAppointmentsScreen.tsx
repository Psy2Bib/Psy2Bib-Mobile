/**
 * @fileoverview Écran de gestion des rendez-vous Psychologue
 * 
 * Liste tous les RDV du psychologue (à venir, passés, annulés...).
 * Affiche les détails de chaque RDV avec informations patient (pseudo anonyme).
 * 
 * Fonctionnalités :
 * - Liste des RDV triée par date/heure
 * - Statut du RDV (CONFIRMED, PENDING, CANCELLED, IN_PROGRESS, DONE)
 * - Affichage date + heure de début et fin
 * - Nom du patient (pseudo ou email)
 * - Pull-to-refresh pour actualiser
 * - Bottom bar navigation (PsyBottomBar)
 * 
 * API :
 * - GET /psy/appointments : Récupère tous les RDV du psy connecté
 * 
 * Note :
 * - Pas de fonctionnalité d'annulation côté psy (seul le patient peut annuler)
 * - Les RDV sont en lecture seule pour le psy
 * - Futur: Bouton "Commencer la séance" pour passer en IN_PROGRESS
 * 
 * @author Psy2Bib Team
 * @since 1.0.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View, FlatList, RefreshControl, SafeAreaView } from 'react-native';
import {
  Button,
  Card,
  HelperText,
  Text,
  useTheme,
  ActivityIndicator,
  Chip,
} from 'react-native-paper';
import { Background } from '../../components/Background';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../api/client';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { PsyBottomBar } from '../../components/PsyBottomBar';

/**
 * Type représentant un rendez-vous côté psychologue.
 */
type Appointment = {
  id: string;
  patient?: { id?: string; pseudo?: string; email?: string; firstName?: string; lastName?: string };
  start?: string;
  end?: string;
  status?: string;
  type?: string;
};

/**
 * Écran de gestion des RDV Psy.
 * 
 * État local :
 * - appointments : Liste des RDV du psy
 * - loading : Chargement initial
 * - error : Message d'erreur
 * 
 * @returns {JSX.Element} Liste des RDV en lecture seule
 */
export const PsyAppointmentsScreen = () => {
  const { user } = useAuth();
  const theme = useTheme();
  const navigation = useNavigation<any>();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (user?.role !== 'PSY') {
      setError('Accès réservé aux psychologues');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/psy/appointments');
      const payload = Array.isArray(res.data) ? res.data : res.data?.appointments;
      const normalized = (payload ?? []).map((a: any) => ({
        ...a,
        // Normalisation des champs de date pour l'affichage
        start: a?.scheduledStart ?? a?.start ?? a?.availability?.start ?? null,
        end: a?.scheduledEnd ?? a?.end ?? a?.availability?.end ?? null,
        patient: a?.patient ?? a?.user ?? null,
      }));
      setAppointments(normalized);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Impossible de charger les rendez-vous';
      setError(msg);
      console.warn('[psy-appointments] load error', msg);
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    await load();
  };

  const handleConfirm = async (id: string) => {
    try {
      await api.patch(`/appointments/${id}/confirm`);
      load();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Impossible de confirmer';
      setError(msg);
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await api.patch(`/appointments/${id}/cancel`);
      load();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Impossible de refuser/annuler';
      setError(msg);
    }
  };

  const handleJoin = (id: string) => {
    navigation.navigate('Visio' as never, { appointmentId: id });
  };

  const formatUserName = (u?: { firstName?: string; lastName?: string; pseudo?: string; email?: string }) => {
    if (!u) return 'Patient';
    if (u.lastName || u.firstName) {
      const last = u.lastName ? u.lastName.toUpperCase() : '';
      const first = u.firstName ? u.firstName : '';
      const full = `${last} ${first}`.trim();
      if (full) return full;
    }
    return u.pseudo || u.email || 'Patient';
  };

  const renderItem = ({ item }: { item: Appointment }) => {
    const start = item.start ? new Date(item.start) : null;
    const end = item.end ? new Date(item.end) : null;

    // État visuel
    let statusColor = theme.colors.primary;
    let statusLabel = 'À venir';
    if (item.status === 'CANCELLED') {
      statusColor = theme.colors.error;
      statusLabel = 'Annulé';
    } else if (item.status === 'DONE') {
      statusColor = theme.colors.outline;
      statusLabel = 'Terminé';
    } else if (item.status === 'CONFIRMED') {
      statusColor = '#10b981';
      statusLabel = 'Confirmé';
    } else if (item.status === 'PENDING') {
      statusColor = '#f59e0b';
      statusLabel = 'En attente';
    }

    return (
      <Card style={{ marginBottom: 12, backgroundColor: theme.colors.surface, borderRadius: 12 }}>
        <Card.Content>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View>
              <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                {formatUserName(item.patient)}
              </Text>
              {start && (
                <>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {start.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </Text>
                  <Text variant="bodySmall" style={{ fontWeight: '700', marginTop: 2 }}>
                    {start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    {end ? ` - ${end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}
                  </Text>
                </>
              )}
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
            {item.status !== 'CONFIRMED' && item.status !== 'DONE' && item.status !== 'CANCELLED' ? (
              <>
                <Button mode="contained" onPress={() => handleConfirm(item.id)} compact style={{ borderRadius: 8 }}>
                  Confirmer
                </Button>
                <Button
                  mode="outlined"
                  onPress={() => handleCancel(item.id)}
                  compact
                  style={{ borderRadius: 8, borderColor: theme.colors.error }}
                  textColor={theme.colors.error}
                >
                  Refuser
                </Button>
              </>
            ) : null}

            {item.status === 'CONFIRMED' ? (
              <>
                <Button mode="contained" onPress={() => handleJoin(item.id)} compact style={{ borderRadius: 8 }}>
                  Rejoindre
                </Button>
                <Button
                  mode="outlined"
                  onPress={() => handleCancel(item.id)}
                  compact
                  style={{ borderRadius: 8, borderColor: theme.colors.error }}
                  textColor={theme.colors.error}
                >
                  Annuler
                </Button>
              </>
            ) : null}
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
            Mes rendez-vous
          </Text>
        </View>

        {error && (
          <HelperText type="error" style={{ paddingHorizontal: 20 }}>
            {error}
          </HelperText>
        )}

        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator />
          </View>
        ) : (
          <FlatList
            data={appointments}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 96 }}
            refreshControl={
              <RefreshControl refreshing={false} onRefresh={onRefresh} tintColor={theme.colors.primary} />
            }
            ListEmptyComponent={
              <Card>
                <Card.Content>
                  <Text style={{ color: theme.colors.onSurfaceVariant }}>Aucun rendez-vous.</Text>
                </Card.Content>
              </Card>
            }
          />
        )}
      </View>
      <PsyBottomBar
        activeTab="appointments"
        onPressHome={() => navigation.navigate('PsyDashboard')}
        onPressAvailability={() => navigation.navigate('PsyAvailability')}
        onPressAppointments={() => {}}
        onPressMessages={() => navigation.navigate('Messages')}
        onPressProfile={() => navigation.navigate('PsyProfile')}
      />
    </Background>
    </SafeAreaView>
  );
};
