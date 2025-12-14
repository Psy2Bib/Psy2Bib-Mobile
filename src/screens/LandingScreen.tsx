/**
 * @fileoverview Écran d'accueil (Landing Page)
 * 
 * Premier écran affiché quand l'utilisateur n'est pas connecté.
 * Permet de choisir entre "Espace Patient" ou "Espace Psychologue".
 * 
 * Design :
 * - Logo Psy2Bib animé (pulsation comme LoadingScreen)
 * - Présentation rapide de l'app (slogan Zero-Knowledge)
 * - 2 boutons : "Espace Patient" (contained) et "Espace Psychologue" (outlined)
 * - Background décoratif avec cercles colorés
 * 
 * Navigation :
 * - "Espace Patient" → LoginScreen avec roleHint='PATIENT'
 * - "Espace Psychologue" → LoginScreen avec roleHint='PSY'
 * - Le roleHint pré-remplit le formulaire et affiche le bon titre
 * 
 * @author Psy2Bib Team
 * @since 1.0.0
 */

import React, { useEffect, useRef } from 'react';
import { ScrollView, View, Animated, Easing } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Background } from '../components/Background';

/**
 * Écran d'accueil de l'application.
 * 
 * Affiché quand user === null (pas connecté).
 * Permet de choisir son rôle avant de se connecter/inscrire.
 * 
 * @returns {JSX.Element} Écran d'accueil avec choix du rôle
 */
export const LandingScreen = () => {
  const nav = useNavigation<any>();
  const theme = useTheme();

  /** Couleur primaire alignée avec le thème et LoadingScreen */
  const PSY_VIOLET = '#4a37e0';

  /** Valeurs animées pour la pulsation du logo */
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.8)).current;
  const colorAnim = useRef(new Animated.Value(0)).current;

  /**
   * Animation de pulsation (identique à LoadingScreen).
   * 
   * Crée une cohérence visuelle entre le splash et l'écran d'accueil.
   */
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        // Phase montée
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1.05,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(colorAnim, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ]),
        // Phase descente
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(opacity, {
            toValue: 0.8,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(colorAnim, {
            toValue: 0,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ]),
      ])
    );

    pulse.start();
    return () => pulse.stop();
  }, [scale, opacity, colorAnim]);

  /**
   * Interpolation de couleur pour variation subtile du bouclier.
   */
  const shieldColor = colorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [PSY_VIOLET, '#7c4dff'],
  });

  /**
   * Navigation vers LoginScreen avec hint du rôle.
   * 
   * @param roleHint - Rôle pré-sélectionné ('PATIENT' ou 'PSY')
   * 
   * Le LoginScreen utilisera ce hint pour :
   * - Afficher le bon titre ("Connexion Patient" vs "Connexion Psychologue")
   * - Rediriger vers le bon formulaire d'inscription si pas de compte
   */
  const goLogin = (roleHint?: 'PATIENT' | 'PSY') =>
    nav.navigate('Login', { roleHint });

  return (
    <Background>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          padding: 20,
          paddingTop: 60,
          paddingBottom: 32,
          gap: 24,
          justifyContent: 'center',
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: 'center', gap: 16 }}>
          
          {/* Icône bouclier animée (identique à LoadingScreen) */}
          <Animated.View
            style={{
              transform: [{ scale }],
              opacity,
              marginBottom: 24,
            }}
          >
            <MaterialCommunityIcons
              name="shield-lock"
              size={96}
              color={PSY_VIOLET}
            />
          </Animated.View>

          {/* Logo texte "Psy2Bib" */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              gap: 4,
              marginBottom: 4,
            }}
          >
            <Text
              variant="displaySmall"
              style={{ fontWeight: '800', color: PSY_VIOLET, letterSpacing: -1 }}
            >
              Psy
            </Text>
            <Text
              variant="displaySmall"
              style={{ fontWeight: '800', color: PSY_VIOLET, letterSpacing: -1 }}
            >
              2
            </Text>
            <Text
              variant="displaySmall"
              style={{ fontWeight: '800', color: PSY_VIOLET, letterSpacing: -1 }}
            >
              Bib
            </Text>
          </View>

          {/* Slogan de présentation */}
          <Text
            variant="bodyLarge"
            style={{ textAlign: 'center', color: '#6b7382', maxWidth: 360 }}
          >
            Plateforme de consultation psychologique{' '}
            <Text style={{ fontWeight: '800', color: PSY_VIOLET }}>
              100% anonyme
            </Text>{' '}
            avec chiffrement Zero-Knowledge.
          </Text>

          {/* Boutons de choix du rôle */}
          <View style={{ gap: 12, width: '100%', marginTop: 20 }}>
            
            {/* Bouton Patient (contained = fond violet) */}
            <Button
              mode="contained"
              icon="account-circle"
              onPress={() => goLogin('PATIENT')}
              style={{ borderRadius: 14 }}
              contentStyle={{ paddingVertical: 8 }}
              buttonColor={PSY_VIOLET}
            >
              Espace Patient
            </Button>

            {/* Bouton Psychologue (outlined = bordure violet) */}
            <Button
              mode="outlined"
              icon="account-tie"
              onPress={() => goLogin('PSY')}
              style={{ borderRadius: 14, borderColor: PSY_VIOLET }}
              contentStyle={{ paddingVertical: 8 }}
              textColor={PSY_VIOLET}
            >
              Espace Psychologue
            </Button>
          </View>
        </View>
      </ScrollView>
    </Background>
  );
};
