/**
 * @fileoverview Écran de profil Patient (chiffré Zero-Knowledge)
 * 
 * Permet au patient de consulter et modifier son profil chiffré.
 * Les données sont stockées chiffrées côté serveur et déchiffrées localement.
 * 
 * Champs du profil :
 * - Téléphone
 * - Email
 * - Date de naissance
 * - Âge
 * - Historique médical (optionnel, sensible)
 * - Objectifs de la thérapie (optionnel)
 * 
 * Workflow Zero-Knowledge :
 * 1. Chargement : getMyPatient() → Récupère encryptedData + iv
 * 2. Déchiffrement local avec masterKey (dérivée du mot de passe)
 * 3. Affichage des données déchiffrées dans le formulaire
 * 4. Modification : Rechiffrement avec masterKey
 * 5. Envoi au backend : updateMyPatientProfile({ encryptedData, iv })
 * 6. Le serveur stocke uniquement le ciphertext
 * 
 * Sécurité :
 * - Le serveur ne peut PAS lire le profil (chiffré)
 * - La masterKey ne quitte jamais le device
 * - Seul le patient (avec son mot de passe) peut déchiffrer
 * 
 * @author Psy2Bib Team
 * @since 1.0.0
 */

import React, { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Card, HelperText, Text, TextInput, useTheme } from 'react-native-paper';
import { useAuth } from '../../hooks/useAuth';
import { Background } from '../../components/Background';
import { getMyPatient, updateMyPatientProfile } from '../../api/patient.api';
import { decryptProfileWithMasterKey, encryptProfileWithMasterKey } from '../../crypto/zk';

/**
 * Type du formulaire de profil patient.
 */
type ProfileForm = {
  phone: string;
  email: string;
  birthDate: string;
  age: string;
  medicalHistory: string;
  objectives: string;
};

/**
 * Écran de profil Patient (chiffré ZK).
 * 
 * État local :
 * - form : Champs du profil (phone, email, birthDate, age, medicalHistory, objectives)
 * - loading : Chargement du profil
 * - saving : Sauvegarde en cours
 * - error : Message d'erreur
 * - info : Message de succès
 * 
 * Utilise :
 * - decryptProfileWithMasterKey() pour déchiffrer à l'ouverture
 * - encryptProfileWithMasterKey() pour rechiffrer avant sauvegarde
 * 
 * @returns {JSX.Element} Formulaire de profil chiffré avec bouton déconnexion
 */
export const PatientProfileScreen = () => {
  const { user, patientVault, updatePatientVault, logout } = useAuth();
  const theme = useTheme();
  const [form, setForm] = useState<ProfileForm>({
    phone: '',
    email: '',
    birthDate: '',
    age: '',
    medicalHistory: '',
    objectives: '',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const mergeProfileIntoForm = (profile: any) => {
    if (!profile) return;
    setForm((prev) => ({
      phone: profile.phone ?? prev.phone,
      email: profile.email ?? prev.email ?? user?.email ?? '',
      birthDate: profile.birthDate ?? prev.birthDate,
      age: profile.age ? String(profile.age) : prev.age,
      medicalHistory: profile.medicalHistory ?? prev.medicalHistory,
      objectives: profile.objectives ?? prev.objectives,
    }));
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!user) return;
      setLoading(true);
      setError(null);
      setInfo(null);
      try {
        const res = await getMyPatient();
        const latestVault = {
          ...patientVault,
          encryptedMasterKey: res.data?.encryptedMasterKey ?? patientVault?.encryptedMasterKey,
          encryptedProfile: res.data?.encryptedProfile ?? patientVault?.encryptedProfile,
          salt: res.data?.salt ?? patientVault?.salt,
          masterKeyB64: patientVault?.masterKeyB64,
        };

        if (latestVault.masterKeyB64 && latestVault.encryptedProfile) {
          const profile = decryptProfileWithMasterKey(latestVault.masterKeyB64, latestVault.encryptedProfile);
          if (profile && mounted) mergeProfileIntoForm(profile);
          latestVault.profile = profile;
        }

        if (mounted) {
          await updatePatientVault(latestVault);
        }
      } catch (e: any) {
        const msg = e?.response?.data?.message ?? e?.message ?? 'Impossible de charger le profil';
        if (mounted) setError(msg);
        console.warn('[patientProfile] load error', msg);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSave = async () => {
    if (!patientVault?.masterKeyB64) {
      setError('Clé maître manquante. Reconnectez-vous pour déchiffrer le profil.');
      return;
    }
    setError(null);
    setInfo(null);
    setSaving(true);
    try {
      const profilePayload = {
        ...form,
        updatedAt: new Date().toISOString(),
      };
      const encryptedProfile = encryptProfileWithMasterKey(patientVault.masterKeyB64, profilePayload);
      const res = await updateMyPatientProfile({ encryptedProfile });

      const updatedVault = {
        ...patientVault,
        encryptedProfile: res.data?.encryptedProfile ?? encryptedProfile,
        profile: profilePayload,
      };
      await updatePatientVault(updatedVault);
      setInfo('Profil mis à jour et re-chiffré.');
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? 'Enregistrement impossible';
      setError(msg);
      console.warn('[patientProfile] save error', msg);
    } finally {
      setSaving(false);
    }
  };

  const disabled = loading || saving;

  return (
    <Background>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Card>
        <View style={{ padding: 20 }}>
          <Text variant="headlineSmall" style={{ fontWeight: '700', color: theme.colors.primary }}>
            Modifier votre profil
          </Text>
        </View>
          <Card.Content style={{ gap: 10 }}>
            <TextInput
              label="Email (référence)"
              value={form.email}
              onChangeText={(email) => setForm({ ...form, email })}
              autoCapitalize="none"
              keyboardType="email-address"
              disabled={disabled}
            />
            <TextInput
              label="Téléphone"
              value={form.phone}
              onChangeText={(phone) => setForm({ ...form, phone })}
              keyboardType="phone-pad"
              disabled={disabled}
            />
            <TextInput
              label="Date de naissance"
              value={form.birthDate}
              onChangeText={(birthDate) => setForm({ ...form, birthDate })}
              placeholder="YYYY-MM-DD"
              disabled={disabled}
            />
            <TextInput
              label="Âge"
              value={form.age}
              onChangeText={(age) => setForm({ ...form, age })}
              keyboardType="numeric"
              disabled={disabled}
            />
            <TextInput
              label="Antécédents médicaux"
              value={form.medicalHistory}
              onChangeText={(medicalHistory) => setForm({ ...form, medicalHistory })}
              multiline
              disabled={disabled}
            />
            <TextInput
              label="Objectifs / attentes"
              value={form.objectives}
              onChangeText={(objectives) => setForm({ ...form, objectives })}
              multiline
              disabled={disabled}
            />

            {error && <HelperText type="error">{error}</HelperText>}
            {info && <HelperText type="info">{info}</HelperText>}

            <Button mode="contained" onPress={onSave} loading={saving} disabled={disabled} style={{ borderRadius: 12 }}>
              Enregistrer (chiffré)
            </Button>
          </Card.Content>
        </Card>

        <Card>
          <Card.Content>
            <Button mode="outlined" icon="logout" onPress={logout} style={{ borderRadius: 12 }}>
              Déconnexion
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>
    </Background>
  );
};
