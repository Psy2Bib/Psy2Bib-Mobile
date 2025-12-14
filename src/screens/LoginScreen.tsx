/**
 * @fileoverview Écran de connexion (Login)
 * 
 * Formulaire de connexion pour patients et psychologues.
 * Gère le hachage Argon2id du mot de passe avant envoi.
 * 
 * Features :
 * - Titre dynamique selon roleHint (Patient vs Psychologue)
 * - Champs email + mot de passe
 * - Gestion d'erreurs (email incorrect, mot de passe invalide...)
 * - Lien vers inscription si pas de compte
 * - Background décoratif Psy2Bib
 * 
 * Workflow :
 * 1. L'utilisateur arrive depuis LandingScreen avec roleHint
 * 2. Il entre email + mot de passe
 * 3. Clic "Se connecter" → useAuth().login()
 * 4. Hash Argon2id du mot de passe (derivePasswordHash)
 * 5. Envoi au backend → Récupération des tokens
 * 6. Si patient : Déchiffrement du vault ZK
 * 7. Navigation automatique vers Dashboard (gérée par AppNavigator)
 * 
 * @author Psy2Bib Team
 * @since 1.0.0
 */

import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Button, Card, HelperText, Text, TextInput } from 'react-native-paper';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { Background } from '../components/Background';

/**
 * Type des paramètres de navigation pour LoginScreen.
 */
type LoginRouteParams = { 
  /** Hint du rôle (pré-sélectionné depuis LandingScreen) */
  roleHint?: 'PATIENT' | 'PSY' 
};

/**
 * Écran de connexion.
 * 
 * État local :
 * - form : { email, password }
 * - loading : Connexion en cours
 * - error : Message d'erreur (email/password incorrect...)
 * 
 * @returns {JSX.Element} Formulaire de connexion
 */
export const LoginScreen = () => {
  const { login } = useAuth();
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  
  /** Hint du rôle passé depuis LandingScreen */
  const roleHint: LoginRouteParams['roleHint'] | undefined = route.params?.roleHint;
  
  /** État du formulaire */
  const [form, setForm] = useState({ email: '', password: '' });
  
  /** Loading pendant la connexion */
  const [loading, setLoading] = useState(false);
  
  /** Message d'erreur (affiché sous les champs) */
  const [error, setError] = useState<string | null>(null);

  /**
   * Titre dynamique selon le roleHint.
   * 
   * Permet de personnaliser l'écran selon le rôle choisi :
   * - 'PATIENT' → "Connexion Patient"
   * - 'PSY' → "Connexion Psychologue"
   * - undefined → "Connexion" (générique)
   */
  const title = useMemo(() => {
    if (roleHint === 'PATIENT') return 'Connexion Patient';
    if (roleHint === 'PSY') return 'Connexion Psychologue';
    return 'Connexion';
  }, [roleHint]);

  /**
   * Soumission du formulaire de connexion.
   * 
   * Workflow :
   * 1. Réinitialiser l'erreur
   * 2. Appeler useAuth().login(email, password)
   * 3. useAuth gère :
   *    - Hash Argon2id du mot de passe
   *    - Appel API POST /auth/login
   *    - Déchiffrement du vault patient (si applicable)
   *    - Sauvegarde des tokens dans SecureStore
   * 4. Si succès : Navigation automatique vers Dashboard
   * 5. Si erreur : Afficher le message d'erreur
   * 
   * @example
   * Erreurs possibles :
   * - "Email ou mot de passe incorrect" (401)
   * - "Connexion impossible (réseau indisponible)" (network error)
   * - "Serveur indisponible" (500)
   */
  const onSubmit = async () => {
    setError(null);
    setLoading(true);
    try {
      console.log('[ui] login submit', form.email);
      await login(form.email, form.password);
      // La navigation vers le dashboard est automatique (gérée par AppNavigator)
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ??
        e?.message ??
        'Connexion impossible (réseau ou serveur indisponible)';
      setError(msg);
      console.warn('Login error', msg);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Background>
      <View style={{ padding: 20, flex: 1, justifyContent: 'center' }}>
        
        {/* Card blanche avec formulaire */}
        <Card mode="elevated" style={{ borderRadius: 18 }}>
          <Card.Content style={{ gap: 14 }}>
            
            {/* Titre dynamique */}
            <Text variant="headlineSmall" style={{ fontWeight: '700' }}>
              {title}
            </Text>
            
            {/* Description */}
            <Text variant="bodyMedium" style={{ color: '#6c757d' }}>
              Connectez-vous pour accéder à vos rendez-vous, visios et messages sécurisés.
            </Text>
            
            {/* Champ Email */}
            <TextInput 
              label="Email" 
              value={form.email} 
              onChangeText={(email) => setForm({ ...form, email })} 
              autoCapitalize="none" 
              keyboardType="email-address" 
            />
            
            {/* Champ Mot de passe */}
            <TextInput 
              label="Mot de passe" 
              secureTextEntry 
              value={form.password} 
              onChangeText={(password) => setForm({ ...form, password })} 
            />
            
            {/* Message d'erreur */}
            {error && <HelperText type="error">{error}</HelperText>}
            
            {/* Bouton de soumission */}
            <Button 
              mode="contained" 
              onPress={onSubmit} 
              loading={loading} 
              disabled={loading}
            >
              {loading ? 'Connexion en cours...' : 'Se connecter'}
            </Button>
            
            {/* Lien vers inscription */}
            <Button
              mode="text"
              onPress={() => nav.navigate(roleHint === 'PSY' ? 'PsyRegister' : 'PatientRegister')}
            >
              Pas de compte ? Créer un compte
            </Button>
            
          </Card.Content>
        </Card>
      </View>
    </Background>
  );
};
