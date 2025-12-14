/**
 * @fileoverview Écran de recherche de psychologues
 * 
 * Permet aux patients de chercher un psychologue par spécialité, ville, langue...
 * Affiche la liste des résultats avec carte de profil pour chaque psy.
 * Permet de consulter les disponibilités et réserver un créneau directement.
 * 
 * Fonctionnalités :
 * - Recherche multi-critères (spécialité, ville, langue)
 * - Liste des résultats avec infos (titre, description, spécialités, tarif...)
 * - Clic "Voir disponibilités" → Modal avec créneaux libres
 * - Réservation directe d'un créneau → Confirmation avec Alert
 * - Bottom bar navigation (PatientBottomBar)
 * 
 * API :
 * - searchPsychologists() : Recherche avec filtres
 * - getPsyAvailabilities(psychologistId) : Récupère créneaux libres
 * - bookAppointment(availabilityId) : Réserve un créneau
 * 
 * @author Psy2Bib Team
 * @since 1.0.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, View, Modal, Pressable, Alert, SafeAreaView } from 'react-native';
import {
  Button,
  Card,
  Chip,
  HelperText,
  Text,
  useTheme,
  Avatar,
  IconButton,
  ActivityIndicator,
} from 'react-native-paper';
import { Background } from '../../components/Background';
import { searchPsychologists, getPsyAvailabilities, getPsychologist } from '../../api/psychologists.api';
import { bookAppointment } from '../../api/appointments.api';
import { useNavigation } from '@react-navigation/native';
import { PatientBottomBar } from '../../components/PatientBottomBar';

/**
 * Type représentant un psychologue dans les résultats de recherche.
 */
type Psychologist = {
  id: string;
  userId?: string;
  user?: { id: string };
  pseudo?: string;
  email?: string;
  title?: string;
  description?: string;
  specialties?: string[];
  languages?: string[];
  city?: string;

  // Champs optionnels (extensions futures)
  hourlyRate?: number;
  rating?: number;
  experienceYears?: number;
  isAvailable?: boolean;
  slotsCount?: number;
};

/**
 * Écran de recherche de psychologues.
 * 
 * État local :
 * - results : Liste des psychologues trouvés
 * - loading : Chargement de la recherche
 * - refreshing : Pull-to-refresh en cours
 * - error : Message d'erreur
 * - slotsModalVisible : Affichage de la modal des disponibilités
 * - slots : Créneaux disponibles du psy sélectionné
 * - slotLoading : Chargement des créneaux
 * - selectedPsy : Psychologue sélectionné pour consulter ses dispos
 * 
 * @returns {JSX.Element} Écran de recherche avec liste et modal de réservation
 */
export const SearchPsyScreen = () => {
  const theme = useTheme();
  const navigation = useNavigation<any>();

  const [results, setResults] = useState<Psychologist[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slotsModalVisible, setSlotsModalVisible] = useState(false);
  const [slots, setSlots] = useState<any[]>([]);
  const [slotLoading, setSlotLoading] = useState(false);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [selectedPsy, setSelectedPsy] = useState<Psychologist | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [messageLoading, setMessageLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await searchPsychologists({});
      const data = Array.isArray(res.data)
        ? res.data
        : res.data?.items || res.data?.psychologists || [];
      const normalized = data.map((p: any) => {
        const slotsCount =
          typeof p?.slotsCount === 'number'
            ? p.slotsCount
            : Array.isArray(p?.slots)
            ? p.slots.length
            : typeof p?.availabilitiesCount === 'number'
            ? p.availabilitiesCount
            : undefined;
        return { ...p, slotsCount };
      });
      setResults(normalized);
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ?? e?.message ?? 'Erreur lors du chargement';
      setError(msg);
      console.warn('[search-psy] load error', msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const openSlots = async (psy: Psychologist) => {
    const psyUserId = psy.user?.id || psy.userId || psy.id;
    if (!psyUserId) {
      setSlotError('Impossible de récupérer les disponibilités (id psy manquant).');
      return;
    }
    setSelectedPsy(psy);
    setSlotsModalVisible(true);
    setSlotError(null);
    setSlots([]);
    setSlotLoading(true);
    try {
      const res = await getPsyAvailabilities(psyUserId);
      const raw = res.data;
      const data = Array.isArray(raw?.slots)
        ? raw.slots
        : Array.isArray(raw)
        ? raw
        : raw?.availabilities || raw?.items || [];
      const availableOnly = data.filter((s: any) => !s.isBooked);
      const count = typeof raw?.count === 'number' ? raw.count : data.length;
      setSlots(availableOnly);
      setResults((prev) =>
        prev.map((p) => (p.id === psy.id ? { ...p, slotsCount: count } : p)),
      );
      setSelectedPsy((prev) =>
        prev && prev.id === psy.id ? { ...prev, slotsCount: count } : prev,
      );
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Impossible de charger les créneaux';
      setSlotError(msg);
    } finally {
      setSlotLoading(false);
    }
  };

  const handleBook = async (slotId: string) => {
    Alert.alert(
      'Confirmer ce créneau ?',
      'Valider pour envoyer la demande, ou Annuler pour choisir un autre créneau.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Valider',
          onPress: async () => {
            try {
              await bookAppointment({ availabilityId: slotId, type: 'ONLINE' });
              setSlotsModalVisible(false);
              Alert.alert(
                'Réservation',
                'Votre demande de rendez-vous est bien prise en compte. En attente de validation du psy.',
              );
            } catch (e: any) {
              const msg = e?.response?.data?.message ?? e?.message ?? 'Réservation impossible';
              setSlotError(msg);
            }
          },
        },
      ],
    );
  };

  const formatDisplayName = (p: Psychologist) => {
    const last = (p as any)?.lastName || (p as any)?.user?.lastName;
    const first = (p as any)?.firstName || (p as any)?.user?.firstName;
    if (last || first) {
      const full = `${last ? String(last).toUpperCase() : ''} ${first ?? ''}`.trim();
      if (full) return full;
    }
    return p.title || p.pseudo || p.email || 'Psychologue';
  };

  const renderItem = ({ item }: { item: Psychologist }) => {
    const displayName = formatDisplayName(item);
    const subtitle = item.pseudo && item.email ? item.email : item.pseudo || item.email;
    const initials = displayName.charAt(0)?.toUpperCase() || 'P';
    const isAvailable = item.isAvailable ?? true;
    const slotsInfo =
      typeof item.slotsCount === 'number'
        ? `Créneau${item.slotsCount > 1 ? 'x' : ''} (${item.slotsCount})`
        : 'Prendre un RDV';
    const rating = item.rating;
    const stars = rating ? '★'.repeat(Math.floor(rating)) : null;

    return (
      <Card
        style={{
          marginBottom: 14,
          borderRadius: 18,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: 'rgba(148,163,184,0.3)',
        }}
      >
        <Card.Content style={{ paddingTop: 12, paddingBottom: 12, gap: 8 }}>
          {/* Header psy (avatar + nom + rating) */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Avatar.Text
              size={52}
              label={initials}
              style={{
                backgroundColor: 'rgba(106,76,230,0.18)',
              }}
              color={theme.colors.primary}
            />
            <View style={{ flex: 1 }}>
              <Text
                variant="titleMedium"
                style={{ fontWeight: '700', color: theme.colors.onSurface }}
              >
                {displayName}
              </Text>
              {!!subtitle && (
                <Text
                  style={{
                    color: theme.colors.onSurfaceVariant,
                    fontSize: 12,
                  }}
                  numberOfLines={1}
                >
                  {subtitle}
                </Text>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                {rating && stars ? (
                  <>
                    <Text style={{ color: '#FACC15', fontSize: 13 }}>{stars}</Text>
                    <Text
                      style={{
                        marginLeft: 4,
                        fontSize: 11,
                        color: theme.colors.onSurfaceVariant,
                      }}
                    >
                      ({rating.toFixed(1)})
                    </Text>
                  </>
                ) : (
                  <Text
                    style={{
                      fontSize: 11,
                      color: theme.colors.onSurfaceVariant,
                    }}
                  >
                    Psychologue certifié
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Ville */}
          {item.city && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
              <Text style={{ fontSize: 12, color: theme.colors.onSurfaceVariant }}>
                📍 {item.city}
              </Text>
            </View>
          )}

          {/* Spécialités */}
          {item.specialties && item.specialties.length > 0 && (
            <View style={{ marginTop: 4 }}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '600',
                  color: theme.colors.onSurface,
                  marginBottom: 4,
                }}
              >
                Spécialités
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {item.specialties.map((s) => (
                  <Chip
                    key={s}
                    compact
                    style={{
                      backgroundColor: '#EEF2FF',
                      borderRadius: 999,
                    }}
                    textStyle={{ fontSize: 11 }}
                  >
                    {s}
                  </Chip>
                ))}
              </View>
            </View>
          )}

          {/* Langues */}
          {item.languages && item.languages.length > 0 && (
            <View style={{ marginTop: 4 }}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '600',
                  color: theme.colors.onSurface,
                  marginBottom: 4,
                }}
              >
                Langues
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {item.languages.map((l) => (
                  <Chip
                    key={l}
                    compact
                    style={{
                      backgroundColor: '#ECFEFF',
                      borderRadius: 999,
                    }}
                    textStyle={{ fontSize: 11 }}
                  >
                    {l}
                  </Chip>
                ))}
              </View>
            </View>
          )}

          {/* Description */}
          {item.description && (
            <Text
              numberOfLines={3}
              style={{
                marginTop: 4,
                fontSize: 12,
                color: theme.colors.onSurfaceVariant,
              }}
            >
              {item.description}
            </Text>
          )}

          {/* Prix + expérience si dispo */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 8,
            }}
          >
            {typeof item.hourlyRate === 'number' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text
                  style={{
                    color: theme.colors.primary,
                    fontWeight: '700',
                    fontSize: 16,
                  }}
                >
                  {item.hourlyRate} €
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: theme.colors.onSurfaceVariant,
                  }}
                >
                  / séance
                </Text>
              </View>
            ) : null}

            {typeof item.experienceYears === 'number' && (
              <Text
                style={{
                  fontSize: 11,
                  color: theme.colors.onSurfaceVariant,
                }}
              >
                {item.experienceYears} ans d&apos;expérience
              </Text>
            )}
          </View>

          {/* Boutons actions : RDV + message */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: 10,
              gap: 8,
            }}
          >
            {isAvailable ? (
              <>
                <Button
                  mode="contained"
                  icon="calendar-plus"
                  style={{ flex: 1, borderRadius: 999 }}
                  contentStyle={{ paddingVertical: 2 }}
                  onPress={() => openSlots(item)}
                >
                  {slotsInfo}
                </Button>
                <Button
                  mode="outlined"
                  icon="message-text-outline"
                  style={{ flex: 1, borderRadius: 999 }}
                  contentStyle={{ paddingVertical: 2 }}
                  loading={messageLoading}
                  onPress={async () => {
                    setMessageError(null);
                    setMessageLoading(true);
                    try {
                      const recipientId =
                        item.user?.id || item.userId || item.id;
                      let resolvedId = recipientId;
                      if (!resolvedId) {
                        const res = await getPsychologist(item.id);
                        resolvedId =
                          res.data?.user?.id ||
                          res.data?.userId ||
                          res.data?.id;
                      }
                      if (!resolvedId) {
                        setMessageError('Impossible de trouver le compte du psy.');
                        return;
                      }
                      navigation.navigate('ChatConversation' as never, {
                        peerId: resolvedId,
                        peerName: displayName,
                      });
                    } catch (e: any) {
                      const msg =
                        e?.response?.data?.message ??
                        e?.message ??
                        'Impossible d’ouvrir la messagerie';
                      setMessageError(msg);
                    } finally {
                      setMessageLoading(false);
                    }
                  }}
                >
                  Envoyer un message
                </Button>
              </>
            ) : (
              <Button
                mode="outlined"
                disabled
                icon="close-circle-outline"
                style={{ flex: 1, borderRadius: 999 }}
                textColor={theme.colors.onSurfaceVariant}
              >
                Non disponible
              </Button>
            )}
          </View>

          {/* Badges Confidentialité / Visio */}
          <View
            style={{
              marginTop: 8,
              paddingTop: 8,
              borderTopWidth: 1,
              borderTopColor: 'rgba(226,232,240,0.9)',
              flexDirection: 'row',
              gap: 6,
              flexWrap: 'wrap',
            }}
          >
            <Chip
              compact
              icon="shield-check"
              style={{
                backgroundColor: 'rgba(34,197,94,0.08)',
                borderRadius: 999,
              }}
              textStyle={{ fontSize: 10 }}
            >
              E2EE & Zero-Knowledge
            </Chip>
            <Chip
              compact
              icon="video-outline"
              style={{
                backgroundColor: 'rgba(59,130,246,0.08)',
                borderRadius: 999,
              }}
              textStyle={{ fontSize: 10 }}
            >
              Visio avec avatar
            </Chip>
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
    <Background>
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
          />
        }
        ListHeaderComponent={
          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: 20,
              paddingBottom: 12,
              gap: 8,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <IconButton
                icon="account-heart-outline"
                size={22}
                style={{
                  margin: 0,
                  backgroundColor: 'rgba(129,140,248,0.15)',
                }}
                iconColor={theme.colors.primary}
              />
      <View style={{ flex: 1 }}>
        {messageError && (
          <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
            <Text style={{ color: theme.colors.error }}>{messageError}</Text>
          </View>
        )}
                <Text variant="headlineSmall" style={{ fontWeight: '700', color: theme.colors.primary }}>
                  Trouvez un psychologue
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: theme.colors.onSurfaceVariant,
                  }}
                >
                  Trouvez le psychologue qui vous correspond, puis prenez un rendez-vous ou
                  commencez à échanger par message.
                </Text>
              </View>
            </View>

            {error && <HelperText type="error">{error}</HelperText>}

            <Text
              style={{
                marginTop: 4,
                fontSize: 11,
                color: theme.colors.onSurfaceVariant,
              }}
            >
              <Text style={{ fontWeight: '600' }}>{results.length}</Text> psychologue(s)
              disponible(s)
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 96 }}
        ListEmptyComponent={
          !loading
            ? (
                <View
                  style={{
                    paddingHorizontal: 20,
                paddingVertical: 16,
              }}
            >
              <Card
                style={{
                  borderRadius: 14,
                  backgroundColor: 'rgba(239,246,255,0.95)',
                  borderWidth: 1,
                  borderColor: 'rgba(191,219,254,1)',
                }}
              >
                <Card.Content style={{ flexDirection: 'row', gap: 8 }}>
                  <IconButton
                    icon="information-outline"
                    size={20}
                    style={{
                      margin: 0,
                      marginTop: -2,
                      backgroundColor: 'rgba(59,130,246,0.1)',
                    }}
                    iconColor={theme.colors.primary}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '600',
                        color: theme.colors.onSurface,
                      }}
                    >
                      Aucun psychologue disponible
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: theme.colors.onSurfaceVariant,
                        marginTop: 2,
                      }}
                    >
                      Réessaie un peu plus tard ou contacte le support si le
                      problème persiste.
                    </Text>
                  </View>
                </Card.Content>
              </Card>
            </View>
            )
            : null
        }
      />

      {/* Modal disponibilités */}
      <Modal transparent visible={slotsModalVisible} animationType="slide" onRequestClose={() => setSlotsModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: '90%', maxHeight: '75%', borderRadius: 14, backgroundColor: 'white', padding: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text variant="titleMedium" style={{ fontWeight: '700' }}>
                Disponibilités {selectedPsy?.pseudo || selectedPsy?.email || ''}
              </Text>
              <Pressable onPress={() => setSlotsModalVisible(false)} hitSlop={10}>
                <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>Fermer</Text>
              </Pressable>
            </View>
            {slotError && <HelperText type="error">{slotError}</HelperText>}
            {slotLoading ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <ActivityIndicator />
              </View>
            ) : slots.length === 0 ? (
              <Text style={{ color: theme.colors.onSurfaceVariant }}>Aucun créneau disponible.</Text>
            ) : (
              <View>
                {/* Regroupement par jour */}
                {Object.entries(
                  slots.reduce((acc: any, slot: any) => {
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
                            onPress={() => handleBook(slot.id)}
                            style={({ pressed }) => ({
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
          </View>
        </View>
      </Modal>
      <PatientBottomBar
        activeTab="search"
        onPressHome={() => navigation.navigate('PatientDashboard')}
        onPressSearch={() => {}}
        onPressAppointments={() => navigation.navigate('PatientAppointments')}
        onPressMessages={() => navigation.navigate('Messages')}
        onPressProfile={() => navigation.navigate('PatientProfile')}
      />
    </Background>
    </SafeAreaView>
  );
};
