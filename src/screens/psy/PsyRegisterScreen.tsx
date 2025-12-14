/**
 * @fileoverview Écran d'inscription Psychologue
 * 
 * Formulaire d'inscription pour psychologues avec validation des informations
 * professionnelles (spécialités, numéro ADELI).
 * 
 * Champs du formulaire :
 * - Prénom* + Nom* (identité réelle, profil public)
 * - Email* (pour connexion)
 * - Spécialités* (au moins 1, sélection multi-choix via modal)
 * - Numéro ADELI (optionnel, vérification professionnelle)
 * - Mot de passe* (minimum 8 caractères)
 * - Confirmation mot de passe*
 * 
 * Workflow :
 * 1. Saisie du formulaire + sélection des spécialités
 * 2. Validation (champs obligatoires + mot de passe)
 * 3. useAuth().register() avec role='PSY'
 * 4. Hash Argon2id du mot de passe (côté client)
 * 5. Envoi au backend : création user + psychologist_profile
 * 6. Auto-login après inscription réussie
 * 
 * Spécificité Psy (vs Patient) :
 * - Pas de chiffrement ZK du profil (profil public)
 * - Validation ADELI (optionnelle mais recommandée)
 * - Sélection multi-choix des spécialités (modal avec checkboxes)
 * 
 * @author Psy2Bib Team
 * @since 1.0.0
 */

import React, { useState } from 'react';
import { ScrollView, View, TouchableOpacity } from 'react-native';
import {
  Button,
  HelperText,
  Text,
  TextInput,
  useTheme,
  Checkbox,
  Portal,
  Modal,
} from 'react-native-paper';
import { useAuth } from '../../hooks/useAuth';
import { Background } from '../../components/Background';

/**
 * Liste des spécialités disponibles pour les psychologues.
 * 
 * Constante partagée avec PsyProfileScreen pour cohérence.
 * Inclut les principales méthodes thérapeutiques en France.
 */
const SPECIALTIES = [
  'Psychologie Clinique',
  'Thérapies Comportementales et Cognitives (TCC)',
  'Psychanalyse',
  'Neuropsychologie',
  'Psychologie du travail',
  'Thérapie Systémique',
  'Psychologie de l\'enfant et de l\'adolescent',
  'Psychogérontologie',
  'EMDR',
  'Addictologie',
  'Sexologie',
  'Autre',
];

/**
 * Écran d'inscription Psychologue.
 * 
 * État local :
 * - form : Champs du formulaire (firstName, lastName, email, specialties, adeli, password, confirmPassword)
 * - loading : Inscription en cours
 * - error : Message d'erreur
 * - showModal : Affichage de la modal de sélection des spécialités
 * 
 * Validations :
 * - Champs obligatoires : firstName, lastName, email, password, confirmPassword
 * - Au moins 1 spécialité sélectionnée
 * - Mots de passe identiques
 * - Mot de passe >= 8 caractères
 * 
 * @returns {JSX.Element} Formulaire d'inscription psy avec modal spécialités
 */
export const PsyRegisterScreen = () => {
  const { register } = useAuth();
  const theme = useTheme();

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    specialties: [] as string[],
    adeli: '',
    password: '',
    confirmPassword: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const toggleSpecialty = (spec: string) => {
    if (form.specialties.includes(spec)) {
      setForm({
        ...form,
        specialties: form.specialties.filter((s) => s !== spec),
      });
    } else {
      setForm({
        ...form,
        specialties: [...form.specialties, spec],
      });
    }
  };

  const onSubmit = async () => {
    setError(null);

    if (
      !form.firstName ||
      !form.lastName ||
      !form.email ||
      form.specialties.length === 0 ||
      !form.password ||
      !form.confirmPassword
    ) {
      setError(
        'Veuillez remplir les champs obligatoires et choisir au moins une spécialité.',
      );
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    if (form.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }

    setLoading(true);
    try {
      const pseudo =
        `${form.firstName}${form.lastName}`.toLowerCase().replace(/\s+/g, '') +
        Math.floor(Math.random() * 10000);
      console.log('[ui] psy register submit', form.email, 'specialties', form.specialties);
      await register({
        email: form.email,
        password: form.password,
        pseudo,
        role: 'PSY',
      });
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ??
        e?.message ??
        'Inscription impossible (réseau ou serveur indisponible)';
      setError(msg);
      console.warn('Psy register error', msg);
    } finally {
      setLoading(false);
    }
  };

  const specialtiesDisplay =
    form.specialties.length > 0 ? form.specialties.join(', ') : '';
  const PSY_VIOLET = '#4a37e0';
  return (
    <Background>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
        <View style={{ alignItems: 'center', gap: 6, marginBottom: 10 }}>
          
          {/* Logo Psy2Bib */}
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
            <Text variant="titleLarge" style={{ fontWeight: '800', color: theme.colors.primary, letterSpacing: -1 }}>
              Psy
            </Text>
            <Text variant="titleLarge" style={{ fontWeight: '800', color: theme.colors.primary, letterSpacing: -1 }}>
              2
            </Text>
            <Text variant="titleLarge" style={{ fontWeight: '800', color: theme.colors.primary, letterSpacing: -1 }}>
              Bib
            </Text>
          </View>

          <Text variant="headlineSmall" style={{ fontWeight: '800', color: theme.colors.onBackground }}>
            Inscription Psychologue
          </Text>
          <Text
            variant="bodyMedium"
            style={{
              color: theme.colors.onSurfaceVariant,
              textAlign: 'center',
            }}
          >
            Rejoignez notre réseau sécurisé.
          </Text>
        </View>

        <TextInput
          label="Prénom *"
          value={form.firstName}
          onChangeText={(firstName) => setForm({ ...form, firstName })}
        />

        <TextInput
          label="Nom *"
          value={form.lastName}
          onChangeText={(lastName) => setForm({ ...form, lastName })}
        />

        <TextInput
          label="Email professionnel *"
          keyboardType="email-address"
          autoCapitalize="none"
          value={form.email}
          onChangeText={(email) => setForm({ ...form, email })}
        />

        {/* Champ 'select' pour les spécialités */}
        <TouchableOpacity
          onPress={() => setShowModal(true)}
          activeOpacity={0.7}
        >
          <View pointerEvents="none">
            <TextInput
              label="Spécialités *"
              value={specialtiesDisplay}
              placeholder="Sélectionnez vos spécialités..."
              editable={false}
              right={<TextInput.Icon icon="menu-down" />}
              multiline
            />
          </View>
        </TouchableOpacity>

        <TextInput
          label="Numéro ADELI"
          value={form.adeli}
          onChangeText={(adeli) => setForm({ ...form, adeli })}
        />

        <TextInput
          label="Mot de passe *"
          secureTextEntry
          value={form.password}
          onChangeText={(password) => setForm({ ...form, password })}
        />

        <TextInput
          label="Confirmer le mot de passe *"
          secureTextEntry
          value={form.confirmPassword}
          onChangeText={(confirmPassword) =>
            setForm({ ...form, confirmPassword })
          }
        />

        {error && <HelperText type="error">{error}</HelperText>}

        <Button
          mode="contained"
          onPress={onSubmit}
          loading={loading}
          disabled={loading}
          style={{ marginTop: 10 }}
        >
          {loading ? 'Chiffrement / inscription...' : "S'inscrire"}
        </Button>
      </ScrollView>

      {/* Modal sélection de spécialités */}
      <Portal>
        <Modal
          visible={showModal}
          onDismiss={() => setShowModal(false)}
          contentContainerStyle={{
            backgroundColor: 'white',
            margin: 20,
            paddingTop: 20,
            paddingHorizontal: 20,
            paddingBottom: 20, // padding normal, mais pas de maxHeight sur le Modal
            borderRadius: 10,
          }}
        >
          <Text
            variant="titleLarge"
            style={{
              marginBottom: 15,
              fontWeight: 'bold',
              textAlign: 'center',
            }}
          >
            Choisir les spécialités
          </Text>

          {/* On limite la hauteur UNIQUEMENT sur la liste */}
          <ScrollView
            style={{ maxHeight: 320 }}
            contentContainerStyle={{ paddingBottom: 8 }}
          >
            {SPECIALTIES.map((spec) => {
              const isSelected = form.specialties.includes(spec);
              return (
                <Checkbox.Item
                  key={spec}
                  label={spec}
                  status={isSelected ? 'checked' : 'unchecked'}
                  onPress={() => toggleSpecialty(spec)}
                  color={theme.colors.primary}
                />
              );
            })}
          </ScrollView>

          <Button
            mode="contained"
            onPress={() => setShowModal(false)}
            style={{ marginTop: 12 }}
          >
            Valider
          </Button>
        </Modal>
      </Portal>
    </Background>
  );
};
