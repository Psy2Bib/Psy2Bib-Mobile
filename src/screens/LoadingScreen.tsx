/**
 * @fileoverview Écran de chargement initial (Splash Screen)
 * 
 * Affiché pendant la restauration de la session depuis SecureStore.
 * Animation de pulsation du logo Psy2Bib avec icône bouclier (sécurité).
 * 
 * Durée d'affichage :
 * - Minimum 800ms (pour éviter un "flash" si les tokens chargent vite)
 * - Maximum ~2 secondes (le temps de lire SecureStore)
 * 
 * Design :
 * - Background décoratif Psy2Bib (cercles colorés)
 * - Logo "Psy2Bib" en violet (#4a37e0)
 * - Icône bouclier animée (scale + opacity)
 * - Slogan "CONNEXION SÉCURISÉE ZERO-KNOWLEDGE"
 * 
 * @author Psy2Bib Team
 * @since 1.0.0
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Background } from '../components/Background';

/**
 * Écran de chargement avec animation.
 * 
 * Workflow :
 * 1. App démarre → <LoadingScreen> affiché
 * 2. authStorage.load() lit les tokens depuis SecureStore
 * 3. Après 800ms minimum → Transition vers Stack authentifié ou Landing
 * 
 * Animation :
 * - Pulsation infinie du bouclier (scale 1.0 → 1.05 → 1.0)
 * - Changement d'opacité (0.8 → 1.0 → 0.8)
 * - Changement subtil de couleur (violet → violet clair → violet)
 * - Durée : 3 secondes par cycle (1.5s montée + 1.5s descente)
 * 
 * @returns {JSX.Element} Écran de chargement animé
 */
export const LoadingScreen = () => {
  /** Valeur animée pour le scale (taille) de l'icône */
  const scale = useRef(new Animated.Value(1)).current;
  
  /** Valeur animée pour l'opacité de l'icône */
  const opacity = useRef(new Animated.Value(0.8)).current;
  
  /** Valeur animée pour l'interpolation de couleur (0 → 1 → 0) */
  const colorAnim = useRef(new Animated.Value(0)).current;

  /** Couleur primaire Psy2Bib (violet vibrant) */
  const PSY_VIOLET = '#4a37e0';

  /**
   * useEffect au montage pour démarrer l'animation en boucle.
   * 
   * L'animation tourne en continu jusqu'à ce que le composant soit démonté
   * (quand AppNavigator décide d'afficher un autre screen).
   */
  useEffect(() => {
    // Animation de pulsation (scale + opacity + color) en boucle infinie
    const pulse = Animated.loop(
      Animated.sequence([
        // Phase 1 : Montée (1.5 secondes)
        Animated.parallel([
          Animated.timing(scale, { 
            toValue: 1.05, 
            duration: 1500, 
            easing: Easing.inOut(Easing.ease), 
            useNativeDriver: false // false car colorAnim n'est pas supporté par native driver
          }),
          Animated.timing(opacity, { 
            toValue: 1, 
            duration: 1500, 
            easing: Easing.inOut(Easing.ease), 
            useNativeDriver: false 
          }),
          Animated.timing(colorAnim, { 
            toValue: 1, 
            duration: 1500, 
            easing: Easing.inOut(Easing.ease), 
            useNativeDriver: false 
          }),
        ]),
        // Phase 2 : Descente (1.5 secondes)
        Animated.parallel([
          Animated.timing(scale, { 
            toValue: 1, 
            duration: 1500, 
            easing: Easing.inOut(Easing.ease), 
            useNativeDriver: false 
          }),
          Animated.timing(opacity, { 
            toValue: 0.8, 
            duration: 1500, 
            easing: Easing.inOut(Easing.ease), 
            useNativeDriver: false 
          }),
          Animated.timing(colorAnim, { 
            toValue: 0, 
            duration: 1500, 
            easing: Easing.inOut(Easing.ease), 
            useNativeDriver: false 
          }),
        ]),
      ])
    );
    
    pulse.start();
    
    // Cleanup : Arrêter l'animation quand le composant est démonté
    return () => pulse.stop();
  }, []);

  /**
   * Interpolation de couleur pour le bouclier.
   * 
   * 0 → Violet standard (#4a37e0)
   * 1 → Violet plus lumineux (#7c4dff)
   * 
   * Crée un effet de "respiration" subtil.
   */
  const shieldColor = colorAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [PSY_VIOLET, '#7c4dff']
  });

  return (
    <Background>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        
        {/* Icône bouclier avec animation (pulsation + changement couleur) */}
        <Animated.View style={{ transform: [{ scale }], opacity, marginBottom: 24 }}>
          <MaterialCommunityIcons 
            name="shield-lock" 
            size={96} 
            color={PSY_VIOLET} 
          />
        </Animated.View>

        {/* Logo texte "Psy2Bib" */}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: 12 }}>
          <Text variant="displaySmall" style={{ fontWeight: '800', color: PSY_VIOLET, letterSpacing: -1 }}>
            Psy
          </Text>
          <Text variant="displaySmall" style={{ fontWeight: '800', color: PSY_VIOLET, letterSpacing: -1 }}>
            2
          </Text>
          <Text variant="displaySmall" style={{ fontWeight: '800', color: PSY_VIOLET, letterSpacing: -1 }}>
            Bib
          </Text>
        </View>

        {/* Slogan Zero-Knowledge */}
        <Text variant="bodyMedium" style={{ color: '#6b7382', textAlign: 'center', letterSpacing: 0.5, marginBottom: 30 }}>
          CONNEXION SÉCURISÉE ZERO-KNOWLEDGE
        </Text>

      </View>
    </Background>
  );
};
