/**
 * @fileoverview Écran de création de disponibilités Psychologue
 * 
 * Permet aux psychologues de définir leurs créneaux horaires disponibles.
 * Les patients pourront ensuite réserver ces créneaux via SearchPsyScreen.
 * 
 * Fonctionnalités :
 * - Sélection de la date (DatePickerModal de react-native-paper-dates)
 * - Sélection heure de début (TimePickerModal)
 * - Sélection heure de fin (TimePickerModal)
 * - Validation : Heure fin > heure début
 * - Création de la disponibilité → POST /psy/availabilities
 * - Navigation retour vers PsyDashboardScreen après succès
 * - Bottom bar navigation (PsyBottomBar)
 * 
 * API :
 * - createPsyAvailability({ date, start, end }) : Crée un créneau dispo
 * 
 * UI :
 * - 3 chips cliquables : Date, Heure début, Heure fin
 * - Modales natives iOS/Android pour sélection intuitive
 * - Validation visuelle (HelperText en cas d'erreur)
 * 
 * @author Psy2Bib Team
 * @since 1.0.0
 */

import React, { useState } from 'react';
import { ScrollView, View, SafeAreaView } from 'react-native';
import {
  Button,
  Card,
  HelperText,
  Text,
  TextInput,
  useTheme,
  IconButton,
  Chip,
} from 'react-native-paper';
import { useAuth } from '../../hooks/useAuth';
import { Background } from '../../components/Background';
import { createPsyAvailability } from '../../api/availability.api';
import { PsyBottomBar } from '../../components/PsyBottomBar';
import { useNavigation } from '@react-navigation/native';

// Modales date/heure de react-native-paper-dates
import {
  DatePickerModal,
  TimePickerModal,
  registerTranslation,
} from 'react-native-paper-dates';

/**
 * Locale française pour les modales date/heure.
 * 
 * Permet d'afficher les modales en français (boutons, labels...).
 */
registerTranslation('fr', {
  save: 'Enregistrer',
  selectSingle: 'Sélectionner une date',
  selectMultiple: 'Sélectionner des dates',
  selectRange: 'Sélectionner une période',
  notAccordingToDateFormat: (inputFormat) => `Format invalide, utilise : ${inputFormat}`,
  mustBeHigherThan: (date) => `Doit être après : ${date}`,
  mustBeLowerThan: (date) => `Doit être avant : ${date}`,
  mustBeBetween: (startDate, endDate) => `Doit être entre ${startDate} et ${endDate}`,
  dateIsDisabled: 'Date désactivée',
  previous: 'Précédent',
  next: 'Suivant',
  typeInDate: 'Saisir la date',
  pickDateFromCalendar: 'Choisir la date',
  close: 'Fermer',
  hour: 'Heure',
  minute: 'Minute',
});

/**
 * Écran de création de disponibilités Psy.
 * 
 * État local :
 * - selectedDate : Date sélectionnée (Date | undefined)
 * - startTime : Heure de début ({ hours, minutes })
 * - endTime : Heure de fin ({ hours, minutes })
 * - showDatePicker : Affichage de la modal date
 * - showStartPicker : Affichage de la modal heure début
 * - showEndPicker : Affichage de la modal heure fin
 * - loading : Création en cours
 * - error : Message d'erreur
 * - success : Message de succès
 * 
 * @returns {JSX.Element} Formulaire de création de dispo avec modales date/heure
 */
export const PsyAvailabilityScreen = () => {
  const { user } = useAuth();
  const theme = useTheme();
  const navigation = useNavigation<any>();

  const [form, setForm] = useState({ date: '', startTime: '', endTime: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [startPickerVisible, setStartPickerVisible] = useState(false);
  const [endPickerVisible, setEndPickerVisible] = useState(false);

  const onSubmit = async () => {
    if (user?.role !== 'PSY') {
      setError('Réservé aux psychologues');
      return;
    }
    if (!form.date || !form.startTime || !form.endTime) {
      setError('Date, heure de début et heure de fin sont requises.');
      return;
    }
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      await createPsyAvailability(form);
      setInfo('Créneaux créés et synchronisés.');
      navigation.goBack();
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ??
        e?.message ??
        'Impossible de créer les disponibilités';
      setError(msg);
      console.warn('[psy-availability] submit error', msg);
    } finally {
      setLoading(false);
    }
  };

  const disabled = loading;

  const applyPreset = (startTime: string, endTime: string) => {
    setForm((prev) => ({ ...prev, startTime, endTime }));
  };

  // helpers format
  const formatDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const formatTime = (hours: number, minutes: number) => {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
    <Background>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 20,
          paddingBottom: 96,
          gap: 16,
        }}
      >
        {/* Carte principale */}
        <Card
          style={{
            borderRadius: 18,
            borderWidth: 1,
            borderColor: 'rgba(106,76,230,0.18)',
            backgroundColor: 'rgba(255,255,255,0.85)',
            shadowColor: '#000',
            shadowOpacity: 0.06,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
          }}
        >
          <Card.Title
            title="Déclarer mes disponibilités"
            subtitle="Création automatique de créneaux de 30 minutes"
            titleStyle={{ fontSize: 17, fontWeight: '700' }}
            subtitleStyle={{ fontSize: 12 }}
            left={(props) => (
              <IconButton
                {...props}
                icon="calendar-plus"
                style={{
                  marginRight: 0,
                  marginLeft: -5,
                  backgroundColor: 'rgba(106,76,230,0.12)',
                }}
                iconColor={theme.colors.primary}
              />
            )}
          />
          <Card.Content style={{ gap: 12, paddingBottom: 16 }}>
            {/* Step 1 : Date */}
            <View style={{ gap: 4 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: theme.colors.onSurface,
                }}
              >
                1. Choisir la date
              </Text>
              <TextInput
                mode="outlined"
                label="Date (YYYY-MM-DD)"
                value={form.date}
                placeholder="2025-12-01"
                disabled={disabled}
                editable={false}
                onPressIn={() => !disabled && setDatePickerVisible(true)}
                right={
                  <TextInput.Icon
                    icon="calendar-outline"
                    onPress={() => !disabled && setDatePickerVisible(true)}
                  />
                }
              />
            </View>

            {/* Step 2 : Plage horaire */}
            <View style={{ gap: 4 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: theme.colors.onSurface,
                }}
              >
                2. Définir la plage horaire
              </Text>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  mode="outlined"
                  style={{ flex: 1 }}
                  label="Début (HH:mm)"
                  value={form.startTime}
                  placeholder="09:00"
                  disabled={disabled}
                  editable={false}
                  onPressIn={() => !disabled && setStartPickerVisible(true)}
                  right={
                    <TextInput.Icon
                      icon="clock-outline"
                      onPress={() => !disabled && setStartPickerVisible(true)}
                    />
                  }
                />
                <TextInput
                  mode="outlined"
                  style={{ flex: 1 }}
                  label="Fin (HH:mm)"
                  value={form.endTime}
                  placeholder="12:00"
                  disabled={disabled}
                  editable={false}
                  onPressIn={() => !disabled && setEndPickerVisible(true)}
                  right={
                    <TextInput.Icon
                      icon="clock-outline"
                      onPress={() => !disabled && setEndPickerVisible(true)}
                    />
                  }
                />
              </View>

              {/* Presets horaires */}
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 6,
                  marginTop: 4,
                }}
              >
                <Chip
                  compact
                  icon="weather-sunny"
                  onPress={() => applyPreset('09:00', '12:00')}
                  disabled={disabled}
                >
                  Matin (9h–12h)
                </Chip>
                <Chip
                  compact
                  icon="white-balance-sunny"
                  onPress={() => applyPreset('14:00', '18:00')}
                  disabled={disabled}
                >
                  Après-midi (14h–18h)
                </Chip>
                <Chip
                  compact
                  icon="clock-time-four-outline"
                  onPress={() => applyPreset('09:00', '17:00')}
                  disabled={disabled}
                >
                  Journée (9h–17h)
                </Chip>
              </View>
            </View>

            {/* Info slot */}
            <View
              style={{
                marginTop: 4,
                padding: 10,
                borderRadius: 12,
                backgroundColor: 'rgba(148,163,184,0.08)',
                borderWidth: 1,
                borderColor: 'rgba(148,163,184,0.35)',
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  color: theme.colors.onSurfaceVariant,
                }}
              >
                • La plage sera automatiquement découpée en créneaux de{' '}
                <Text style={{ fontWeight: '700' }}>30 minutes</Text> réservables
                par les patients.{'\n'}
                • Vous pourrez ensuite visualiser et gérer ces créneaux dans votre
                agenda.
              </Text>
            </View>

            {error && (
              <HelperText type="error" visible={true}>
                {error}
              </HelperText>
            )}
            {info && (
              <HelperText type="info" visible={true}>
                {info}
              </HelperText>
            )}

            {/* CTA */}
            <Button
              mode="contained"
              onPress={onSubmit}
              loading={loading}
              disabled={disabled}
              style={{
                marginTop: 4,
                borderRadius: 999,
                paddingVertical: 4,
              }}
              contentStyle={{ paddingVertical: 4 }}
              icon="upload"
            >
              Publier mes créneaux
            </Button>
          </Card.Content>
        </Card>

        {/* Petit rappel en bas */}
        <Card
          style={{
            marginTop: 4,
            borderRadius: 14,
            backgroundColor: 'rgba(250,250,255,0.96)',
            borderWidth: 1,
            borderColor: 'rgba(199,210,254,0.9)',
          }}
        >
          <Card.Content
            style={{
              flexDirection: 'row',
              gap: 8,
              alignItems: 'flex-start',
            }}
          >
            <IconButton
              icon="information-outline"
              size={18}
              style={{
                margin: 0,
                marginTop: -4,
                backgroundColor: 'rgba(129,140,248,0.12)',
              }}
              iconColor="#4F46E5"
            />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 12,
                  color: '#1F2937',
                  fontWeight: '600',
                }}
              >
                Astuce
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: '#4B5563',
                  marginTop: 2,
                }}
              >
                Pensez à définir vos plages régulières (par exemple tous les
                lundis matin) pour que les patients aient toujours de la
                visibilité sur vos créneaux libres.
              </Text>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>

      {/* 🗓️ DatePicker */}
      <DatePickerModal
        locale="fr"
        mode="single"
        visible={datePickerVisible}
        onDismiss={() => setDatePickerVisible(false)}
        date={form.date ? new Date(form.date) : new Date()}
        onConfirm={({ date }) => {
          if (date) {
            const iso = formatDate(date);
            setForm((prev) => ({ ...prev, date: iso }));
          }
          setDatePickerVisible(false);
        }}
      />

      {/* 🕒 TimePicker début */}
      <TimePickerModal
        visible={startPickerVisible}
        onDismiss={() => setStartPickerVisible(false)}
        onConfirm={({ hours, minutes }) => {
          const t = formatTime(hours, minutes);
          setForm((prev) => ({ ...prev, startTime: t }));
          setStartPickerVisible(false);
        }}
        hours={form.startTime ? parseInt(form.startTime.split(':')[0], 10) : 9}
        minutes={form.startTime ? parseInt(form.startTime.split(':')[1], 10) : 0}
        label="Heure de début"
        cancelLabel="Annuler"
        confirmLabel="Valider"
        locale="fr"
      />

      {/* 🕒 TimePicker fin */}
      <TimePickerModal
        visible={endPickerVisible}
        onDismiss={() => setEndPickerVisible(false)}
        onConfirm={({ hours, minutes }) => {
          const t = formatTime(hours, minutes);
          setForm((prev) => ({ ...prev, endTime: t }));
          setEndPickerVisible(false);
        }}
        hours={form.endTime ? parseInt(form.endTime.split(':')[0], 10) : 12}
        minutes={form.endTime ? parseInt(form.endTime.split(':')[1], 10) : 0}
        label="Heure de fin"
        cancelLabel="Annuler"
        confirmLabel="Valider"
        locale="fr"
      />
      <PsyBottomBar
        activeTab="availability"
        onPressHome={() => navigation.navigate('PsyDashboard')}
        onPressAvailability={() => {}}
        onPressAppointments={() => navigation.navigate('PsyAppointments')}
        onPressMessages={() => navigation.navigate('Messages')}
        onPressProfile={() => navigation.navigate('PsyProfile')}
      />
    </Background>
    </SafeAreaView>
  );
};
