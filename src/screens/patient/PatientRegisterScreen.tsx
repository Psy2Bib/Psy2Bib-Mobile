/**
 * @fileoverview Écran d'inscription Patient (avec Zero-Knowledge)
 * 
 * Formulaire d'inscription pour patients avec chiffrement client-side
 * des données sensibles (profil chiffré avec Argon2id).
 * 
 * Champs du formulaire :
 * - Pseudo* (identifiant public anonymisé)
 * - Email* (pour connexion)
 * - Téléphone (optionnel)
 * - Date de naissance (optionnel)
 * - Mot de passe* (minimum 8 caractères)
 * - Confirmation mot de passe*
 * 
 * Workflow Zero-Knowledge :
 * 1. L'utilisateur saisit ses infos + mot de passe
 * 2. useAuth().register() est appelé
 * 3. Hash Argon2id du mot de passe (derivePasswordHash)
 * 4. Chiffrement AES-GCM du profil avec clé dérivée (deriveAesKey)
 * 5. Envoi au backend : encryptedData + iv + passwordHash
 * 6. Le serveur stocke uniquement les données chiffrées
 * 7. Auto-login après inscription réussie
 * 
 * Sécurité :
 * - Le serveur ne voit JAMAIS le mot de passe en clair
 * - Le serveur ne peut PAS déchiffrer le profil patient
 * - Seul le patient (avec son mot de passe) peut déchiffrer
 * 
 * @author Psy2Bib Team
 * @since 1.0.0
 */

import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, HelperText, Text, TextInput, useTheme } from 'react-native-paper';
import { useAuth } from '../../hooks/useAuth';
import { Background } from '../../components/Background';

/**
 * Écran d'inscription Patient.
 * 
 * État local :
 * - form : Champs du formulaire (pseudo, email, phone, birthDate, password, confirmPassword)
 * - loading : Inscription en cours
 * - error : Message d'erreur (validation ou réseau)
 * 
 * Validations :
 * - Champs obligatoires : pseudo, email, password, confirmPassword
 * - Mots de passe identiques
 * - Mot de passe >= 8 caractères
 * 
 * @returns {JSX.Element} Formulaire d'inscription avec logo Psy2Bib
 */
export const PatientRegisterScreen = () => {
  const { register } = useAuth();
  const theme = useTheme();
  const [form, setForm] = useState({
    pseudo: '',
    email: '',
    phone: '',
    birthDate: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    if (!form.pseudo || !form.email || !form.password || !form.confirmPassword) {
      setError('Veuillez remplir les champs obligatoires.');
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
      console.log('[ui] patient register submit', form.email);
      await register({
        email: form.email,
        password: form.password,
        pseudo: form.pseudo,
        role: 'PATIENT',
        profile: {
          pseudo: form.pseudo,
          email: form.email,
          phone: form.phone || null,
          birthDate: form.birthDate || null,
          registeredAt: new Date().toISOString(),
        },
      });
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ??
        e?.message ??
        'Inscription impossible (réseau ou serveur indisponible)';
      setError(msg);
      console.warn('Patient register error', msg);
    } finally {
      setLoading(false);
    }
  };
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
            Inscription Patient
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
            Vos données sont chiffrées localement (Argon2). Le serveur reste aveugle.
          </Text>
        </View>

        <TextInput label="Pseudo *" value={form.pseudo} onChangeText={(pseudo) => setForm({ ...form, pseudo })} />
        <TextInput label="Email *" keyboardType="email-address" autoCapitalize="none" value={form.email} onChangeText={(email) => setForm({ ...form, email })} />
        <TextInput label="Téléphone" keyboardType="phone-pad" value={form.phone} onChangeText={(phone) => setForm({ ...form, phone })} />
        <TextInput label="Date de naissance" value={form.birthDate} onChangeText={(birthDate) => setForm({ ...form, birthDate })} />
        <TextInput label="Mot de passe *" secureTextEntry value={form.password} onChangeText={(password) => setForm({ ...form, password })} />
        <TextInput
          label="Confirmer le mot de passe *"
          secureTextEntry
          value={form.confirmPassword}
          onChangeText={(confirmPassword) => setForm({ ...form, confirmPassword })}
        />

        {error && <HelperText type="error">{error}</HelperText>}

        <Button mode="contained" onPress={onSubmit} loading={loading} disabled={loading} style={{ marginTop: 10 }}>
          {loading ? 'Chiffrement / inscription...' : "S'inscrire (Zero-Knowledge)"}
        </Button>
      </ScrollView>
    </Background>
  );
};
