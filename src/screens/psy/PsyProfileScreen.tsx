import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  Button,
  Card,
  HelperText,
  Switch,
  Text,
  TextInput,
  useTheme,
  Portal,
  Modal,
  Checkbox,
} from 'react-native-paper';
import { useAuth } from '../../hooks/useAuth';
import { Background } from '../../components/Background';
import { getMyPsyProfile, updateMyPsyProfile } from '../../api/psy.api';

const SPECIALTIES = [
  'Psychologie Clinique',
  'Thérapies Comportementales et Cognitives (TCC)',
  'Psychanalyse',
  'Neuropsychologie',
  'Psychologie du travail',
  'Thérapie Systémique',
  "Psychologie de l'enfant et de l'adolescent",
  'Psychogérontologie',
  'EMDR',
  'Addictologie',
  'Sexologie',
  'Autre',
];

const LANGUAGES = ['Français', 'Anglais', 'Espagnol', 'Allemand', 'Arabe', 'Italien'];

type FormState = {
  title: string;
  description: string;
  specialties: string[];
  languages: string[];
  city: string;
  address: string;
  hourlyRate: string;
  adeli: string;
  isVisible: boolean;
  firstName: string;
  lastName: string;
};

export const PsyProfileScreen = () => {
  const { user, logout } = useAuth();
  const theme = useTheme();

  const [form, setForm] = useState<FormState>({
    title: '',
    description: '',
    specialties: [],
    languages: [],
    city: '',
    address: '',
    hourlyRate: '',
    adeli: '',
    isVisible: true,
    firstName: '',
    lastName: '',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showSpecialties, setShowSpecialties] = useState(false);
  const [showLanguages, setShowLanguages] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getMyPsyProfile();
        const data = res.data || {};
        if (!mounted) return;
        setForm({
          title: data.title ?? '',
          description: data.description ?? '',
          specialties: Array.isArray(data.specialties) ? data.specialties : [],
          languages: Array.isArray(data.languages) ? data.languages : [],
          city: data.city ?? '',
          address: data.address ?? '',
          hourlyRate: data.hourlyRate ? String(data.hourlyRate) : '',
          adeli: data.adeli ?? '',
          isVisible: data.isVisible ?? true,
          firstName: data.firstName ?? '',
          lastName: data.lastName ?? '',
        });
      } catch (e: any) {
        const msg = e?.response?.data?.message ?? e?.message ?? 'Impossible de charger le profil';
        if (mounted) setError(msg);
        console.warn('[psy-profile] load error', msg);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  const onSave = async () => {
    setError(null);
    setInfo(null);
    setSaving(true);
    try {
      const payload = {
        title: form.title || undefined,
        description: form.description || undefined,
        specialties: form.specialties,
        languages: form.languages,
        city: form.city || undefined,
        address: form.address || undefined,
        hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : undefined,
        adeli: form.adeli || undefined,
        isVisible: form.isVisible,
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
      };
      await updateMyPsyProfile(payload);
      setInfo('Profil mis à jour');
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Erreur de sauvegarde';
      setError(msg);
      console.warn('[psy-profile] save error', msg);
    } finally {
      setSaving(false);
    }
  };

  const disabled = loading || saving;

  return (
    <Background>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
        <Card>
          <Card.Content style={{ gap: 10, paddingTop: 20 }}>
            <Text variant="headlineSmall" style={{ fontWeight: '700', color: theme.colors.primary, marginBottom: 8 }}>
              Modifier votre profil
            </Text>
            <TextInput
              label="Prénom"
              value={form.firstName}
              onChangeText={(firstName) => setForm({ ...form, firstName })}
              disabled={disabled}
            />
            <TextInput
              label="Nom"
              value={form.lastName}
              onChangeText={(lastName) => setForm({ ...form, lastName })}
              disabled={disabled}
            />
            <TextInput label="Titre" value={form.title} onChangeText={(title) => setForm({ ...form, title })} disabled={disabled} />
            <TextInput
              label="Description"
              value={form.description}
              onChangeText={(description) => setForm({ ...form, description })}
              multiline
              disabled={disabled}
            />
            <TextInput
              label="Spécialités *"
              value={Array.isArray(form.specialties) ? form.specialties.join(', ') : ''}
              editable={false}
              right={<TextInput.Icon icon="menu-down" />}
              onFocus={() => setShowSpecialties(true)}
              onPressIn={() => setShowSpecialties(true)}
            />
            <TextInput
              label="Langues *"
              value={Array.isArray(form.languages) ? form.languages.join(', ') : ''}
              editable={false}
              right={<TextInput.Icon icon="menu-down" />}
              onFocus={() => setShowLanguages(true)}
              onPressIn={() => setShowLanguages(true)}
            />
            <TextInput label="Ville" value={form.city} onChangeText={(city) => setForm({ ...form, city })} disabled={disabled} />
            <TextInput label="Adresse" value={form.address} onChangeText={(address) => setForm({ ...form, address })} disabled={disabled} />
            <TextInput
              label="Tarif / séance (€)"
              value={form.hourlyRate}
              onChangeText={(hourlyRate) => setForm({ ...form, hourlyRate })}
              keyboardType="numeric"
              disabled={disabled}
            />
            <TextInput label="Numéro ADELI" value={form.adeli} onChangeText={(adeli) => setForm({ ...form, adeli })} disabled={disabled} />

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text>Profil visible publiquement</Text>
              <Switch value={form.isVisible} onValueChange={(isVisible) => setForm({ ...form, isVisible })} disabled={disabled} />
            </View>

            {error && <HelperText type="error">{error}</HelperText>}
            {info && <HelperText type="info">{info}</HelperText>}

            <Button mode="contained" onPress={onSave} loading={saving} disabled={disabled} style={{ borderRadius: 12 }}>
              Enregistrer
            </Button>
          </Card.Content>
        </Card>

        <Card>
          <Card.Content style={{ gap: 8 }}>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>
              Déconnecter le compte et nettoyer les tokens locaux.
            </Text>
            <Button mode="outlined" icon="logout" onPress={logout} style={{ borderRadius: 12 }}>
              Déconnexion
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>

      <Portal>
        <Modal
          visible={showSpecialties}
          onDismiss={() => setShowSpecialties(false)}
          contentContainerStyle={{
            backgroundColor: 'white',
            margin: 20,
            padding: 16,
            borderRadius: 12,
          }}
        >
          <Text variant="titleMedium" style={{ marginBottom: 8, fontWeight: '700' }}>
            Choisir les spécialités
          </Text>
          <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ paddingBottom: 8 }}>
            {SPECIALTIES.map((spec) => {
              const isSelected = form.specialties.includes(spec);
              return (
                <Checkbox.Item
                  key={spec}
                  label={spec}
                  status={isSelected ? 'checked' : 'unchecked'}
                  onPress={() => {
                    const next = isSelected
                      ? form.specialties.filter((s) => s !== spec)
                      : [...form.specialties, spec];
                    setForm({ ...form, specialties: next });
                  }}
                  color={theme.colors.primary}
                />
              );
            })}
          </ScrollView>
          <Button mode="contained" style={{ marginTop: 8 }} onPress={() => setShowSpecialties(false)}>
            Fermer
          </Button>
        </Modal>

        <Modal
          visible={showLanguages}
          onDismiss={() => setShowLanguages(false)}
          contentContainerStyle={{
            backgroundColor: 'white',
            margin: 20,
            padding: 16,
            borderRadius: 12,
          }}
        >
          <Text variant="titleMedium" style={{ marginBottom: 8, fontWeight: '700' }}>
            Choisir les langues
          </Text>
          <ScrollView style={{ maxHeight: 260 }} contentContainerStyle={{ paddingBottom: 8 }}>
            {LANGUAGES.map((lang) => {
              const isSelected = form.languages.includes(lang);
              return (
                <Checkbox.Item
                  key={lang}
                  label={lang}
                  status={isSelected ? 'checked' : 'unchecked'}
                  onPress={() => {
                    const next = isSelected
                      ? form.languages.filter((l) => l !== lang)
                      : [...form.languages, lang];
                    setForm({ ...form, languages: next });
                  }}
                  color={theme.colors.primary}
                />
              );
            })}
          </ScrollView>
          <Button mode="contained" style={{ marginTop: 8 }} onPress={() => setShowLanguages(false)}>
            Fermer
          </Button>
        </Modal>
      </Portal>
    </Background>
  );
};
