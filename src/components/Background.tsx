/**
 * @fileoverview Composant d'arrière-plan décoratif pour les écrans
 * 
 * Fournit un fond avec des cercles colorés en semi-transparence pour un design moderne.
 * Utilisé dans les écrans de Login, Register, et autres écrans nécessitant un bg stylisé.
 * 
 * Features :
 * - 3 cercles décoratifs positionnés en absolu (primaryContainer, secondaryContainer, tertiary)
 * - KeyboardAvoidingView pour éviter que le clavier ne cache les inputs
 * - Responsive (calcul des dimensions avec Dimensions.get)
 * - Centrage automatique du contenu (maxWidth: 600px pour tablettes)
 * 
 * @author Psy2Bib Team
 * @since 1.0.0
 */

import React from 'react';
import { View, StyleSheet, Dimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { useTheme } from 'react-native-paper';

/**
 * Props du composant Background.
 */
interface BackgroundProps {
  /** Contenu à afficher par-dessus le background */
  children: React.ReactNode;
}

/**
 * Composant Background avec cercles décoratifs et gestion du clavier.
 * 
 * Utilise les couleurs du thème Material Design 3 pour les cercles.
 * Le clavier iOS/Android est géré automatiquement (KeyboardAvoidingView).
 * 
 * @param props - Props du composant
 * @returns {JSX.Element} Background stylisé
 * 
 * @example
 * ```tsx
 * // Dans LoginScreen
 * export const LoginScreen = () => {
 *   return (
 *     <Background>
 *       <View style={{ padding: 20 }}>
 *         <Text variant="headlineMedium">Connexion</Text>
 *         <TextInput label="Email" />
 *         <TextInput label="Mot de passe" secureTextEntry />
 *         <Button mode="contained">Se connecter</Button>
 *       </View>
 *     </Background>
 *   );
 * };
 * ```
 */
export const Background = ({ children }: BackgroundProps) => {
  const theme = useTheme();
  
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* 
        Cercles décoratifs d'arrière-plan.
        Positionnés en absolu pour créer un effet de "bulles" colorées.
        Les couleurs proviennent du thème (primaryContainer, secondaryContainer...).
        Opacity: 0.6 pour un effet subtil (pas trop agressif visuellement).
      */}
      <View style={[styles.circle, styles.circle1, { backgroundColor: theme.colors.primaryContainer }]} />
      <View style={[styles.circle, styles.circle2, { backgroundColor: theme.colors.secondaryContainer }]} />
      <View style={[styles.circle, styles.circle3, { backgroundColor: theme.colors.tertiaryContainer || '#E8DEF8' }]} />
      
      {/* 
        Contenu principal avec gestion du clavier.
        
        KeyboardAvoidingView :
        - iOS: behavior='padding' (ajoute un padding en bas quand clavier ouvert)
        - Android: behavior='height' (réduit la hauteur de la vue)
        
        Le contenu est centré horizontalement avec maxWidth: 600px (tablettes).
      */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        {children}
      </KeyboardAvoidingView>
    </View>
  );
};

/** Dimensions de l'écran (pour calculs responsive) */
const { width, height } = Dimensions.get('window');

/**
 * Styles du composant Background.
 */
const styles = StyleSheet.create({
  /** Container principal (plein écran) */
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  
  /** 
   * Zone de contenu (au-dessus des cercles).
   * Centré horizontalement avec maxWidth pour tablettes.
   */
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 600, // Limite la largeur sur tablettes
    alignSelf: 'center',
  },
  
  /** 
   * Style de base des cercles décoratifs.
   * Partagé par circle1, circle2, circle3.
   */
  circle: {
    position: 'absolute',
    borderRadius: 999, // Rond parfait (valeur arbitrairement grande)
    opacity: 0.6,      // Semi-transparent pour effet subtil
  },
  
  /** 
   * Cercle 1 : En haut à gauche (déborde hors de l'écran).
   * Taille : 80% de la largeur de l'écran.
   */
  circle1: {
    width: width * 0.8,
    height: width * 0.8,
    top: -width * 0.2,  // Déborde en haut
    left: -width * 0.2, // Déborde à gauche
  },
  
  /** 
   * Cercle 2 : En haut à droite (plus grand, déborde à droite).
   * Taille : 90% de la largeur de l'écran.
   */
  circle2: {
    width: width * 0.9,
    height: width * 0.9,
    top: height * 0.1,   // Un peu plus bas que circle1
    right: -width * 0.4, // Déborde fortement à droite
  },
  
  /** 
   * Cercle 3 : En bas à gauche (plus petit).
   * Taille : 60% de la largeur de l'écran.
   */
  circle3: {
    width: width * 0.6,
    height: width * 0.6,
    bottom: -width * 0.1, // Déborde en bas
    left: -width * 0.1,   // Déborde à gauche
  },
});

