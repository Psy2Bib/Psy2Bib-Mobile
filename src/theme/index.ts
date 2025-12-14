/**
 * @fileoverview Thème global de l'application Psy2Bib
 * 
 * Définit la palette de couleurs, les espacements, et la configuration visuelle
 * de toute l'application via react-native-paper (Material Design 3).
 * 
 * ═══════════════════════════════════════════════════════════════
 *  DESIGN SYSTEM
 * ═══════════════════════════════════════════════════════════════
 * 
 * Basé sur Material Design 3 (MD3) de Google :
 * - Couleurs adaptatives (primary, secondary, surface...)
 * - Système d'élévation (ombres)
 * - Composants cohérents (Button, Card, TextInput...)
 * 
 * React Native Paper applique automatiquement ce thème à tous ses composants.
 * 
 * @see https://callstack.github.io/react-native-paper/docs/guides/theming
 * @author Psy2Bib Team
 * @since 1.0.0
 */

import { MD3LightTheme } from 'react-native-paper';

/**
 * Palette de couleurs officielle Psy2Bib.
 * 
 * Inspirée du Material Design 3 avec une couleur primaire violette (#4a37e0).
 * 
 * Structure des couleurs MD3 :
 * - primary : Couleur principale de la marque (boutons, liens, focus...)
 * - onPrimary : Couleur du texte sur fond primary (blanc pour lisibilité)
 * - primaryContainer : Version claire de primary (pour backgrounds secondaires)
 * - onPrimaryContainer : Couleur du texte sur primaryContainer
 * 
 * Même logique pour secondary, tertiary, error, surface...
 */
const colors = {
  /**
   * ──────────────────────────────────────────────────────────────
   * COULEURS PRIMAIRES (Brand Psy2Bib)
   * ──────────────────────────────────────────────────────────────
   */
  
  /** Violet vibrant - Couleur de marque principale */
  primary: '#4a37e0',
  
  /** Texte sur fond primary (blanc pour contraste max) */
  onPrimary: '#ffffff',
  
  /** Container léger avec teinte primary (pour backgrounds secondaires) */
  primaryContainer: '#eaddff',
  
  /** Texte sur primaryContainer (violet très foncé) */
  onPrimaryContainer: '#21005d',
  
  /**
   * ──────────────────────────────────────────────────────────────
   * COULEURS SECONDAIRES (Éléments UI non prioritaires)
   * ──────────────────────────────────────────────────────────────
   */
  
  /** Gris neutre pour éléments secondaires (icônes, textes secondaires...) */
  secondary: '#625b71',
  
  /** Texte sur fond secondary */
  onSecondary: '#ffffff',
  
  /** Container léger avec teinte secondary */
  secondaryContainer: '#e8def8',
  
  /** Texte sur secondaryContainer */
  onSecondaryContainer: '#1d192b',
  
  /**
   * ──────────────────────────────────────────────────────────────
   * COULEURS TERTIAIRES (Accents, CTA secondaires...)
   * ──────────────────────────────────────────────────────────────
   */
  
  /** Couleur tertiaire (rosé) pour accents */
  tertiary: '#7d5260',
  
  /**
   * ──────────────────────────────────────────────────────────────
   * COULEURS DE FOND (Background, Surface)
   * ──────────────────────────────────────────────────────────────
   */
  
  /** Fond de l'application (gris très clair) */
  background: '#f8f9fa',
  
  /** Surface des composants (Cards, Modals... blanc pur) */
  surface: '#ffffff',
  
  /** Texte principal sur surface (presque noir, pas 100% noir pour éviter fatigue visuelle) */
  onSurface: '#1f1f1f',
  
  /** Variant de surface (pour séparateurs, dividers...) */
  surfaceVariant: '#e7e0ec',
  
  /** Texte secondaire sur surfaceVariant (gris moyen) */
  onSurfaceVariant: '#49454f',
  
  /**
   * ──────────────────────────────────────────────────────────────
   * COULEURS SYSTÈME (Error, Success...)
   * ──────────────────────────────────────────────────────────────
   */
  
  /** Rouge pour erreurs (formulaires, messages d'alerte...) */
  error: '#ba1a1a',
  
  /**
   * ──────────────────────────────────────────────────────────────
   * COULEURS UTILITAIRES (Bordures, lignes...)
   * ──────────────────────────────────────────────────────────────
   */
  
  /** Couleur des bordures (TextInput, dividers...) */
  outline: '#79747e',
};

/**
 * Thème complet de l'application.
 * 
 * Fusionne le thème MD3 Light par défaut avec notre palette personnalisée.
 * 
 * Extensions personnalisées :
 * - elevation : Système d'ombres (level0 à level5)
 * - roundness : Arrondi global des composants (14px)
 * 
 * Utilisé dans App.tsx :
 * ```tsx
 * <PaperProvider theme={appTheme}>
 *   <App />
 * </PaperProvider>
 * ```
 */
export const appTheme = {
  ...MD3LightTheme, // Hérite du thème Material Design 3 Light
  colors: {
    ...MD3LightTheme.colors, // Hérite des couleurs MD3 par défaut
    ...colors, // Override avec notre palette Psy2Bib
    
    /**
     * Système d'élévation (ombres portées).
     * 
     * MD3 utilise des niveaux d'élévation pour créer une hiérarchie visuelle :
     * - level0 : Pas d'ombre (éléments au même niveau que le fond)
     * - level1 : Ombre légère (Cards légèrement surélevées)
     * - level2-5 : Ombres progressivement plus prononcées (Modals, FABs...)
     * 
     * Ici on utilise des couleurs plates au lieu d'ombres (design plus épuré).
     */
    elevation: {
      level0: 'transparent',     // Pas de fond
      level1: '#f3f3f6',         // Gris très léger
      level2: '#ffffff',         // Blanc
      level3: '#ffffff',         // Blanc
      level4: '#ffffff',         // Blanc
      level5: '#ffffff',         // Blanc
    },
  },
  
  /**
   * Arrondi global des composants (Button, Card, TextInput...).
   * 
   * 14px = Arrondi moderne et doux (ni trop carré, ni trop round).
   * Material Design 3 utilise généralement 8-16px.
   */
  roundness: 14,
};

/**
 * ═══════════════════════════════════════════════════════════════
 *  NOTES D'UTILISATION
 * ═══════════════════════════════════════════════════════════════
 * 
 * 1. ACCÉDER AU THÈME DANS UN COMPOSANT :
 * 
 * ```tsx
 * import { useTheme } from 'react-native-paper';
 * 
 * const MyComponent = () => {
 *   const theme = useTheme();
 *   
 *   return (
 *     <View style={{ backgroundColor: theme.colors.primary }}>
 *       <Text style={{ color: theme.colors.onPrimary }}>
 *         Hello Psy2Bib
 *       </Text>
 *     </View>
 *   );
 * };
 * ```
 * 
 * 2. COMPOSANTS STYLISÉS AUTOMATIQUEMENT :
 * 
 * Tous les composants react-native-paper utilisent ce thème :
 * - <Button mode="contained"> → backgroundColor = primary
 * - <Card> → backgroundColor = surface
 * - <TextInput> → borderColor = outline
 * 
 * Pas besoin de style manuel pour la cohérence !
 * 
 * 3. DARK MODE (À IMPLÉMENTER) :
 * 
 * Pour ajouter un mode sombre :
 * ```tsx
 * import { MD3DarkTheme } from 'react-native-paper';
 * 
 * export const appDarkTheme = {
 *   ...MD3DarkTheme,
 *   colors: {
 *     ...MD3DarkTheme.colors,
 *     primary: '#bb86fc', // Violet plus clair pour dark mode
 *     background: '#121212',
 *     surface: '#1f1f1f',
 *   },
 * };
 * ```
 * 
 * Puis dans App.tsx :
 * ```tsx
 * const isDarkMode = useColorScheme() === 'dark';
 * const theme = isDarkMode ? appDarkTheme : appTheme;
 * ```
 * 
 * 4. PERSONNALISATION AVANCÉE :
 * 
 * Pour ajouter des couleurs custom (non MD3) :
 * ```tsx
 * export const appTheme = {
 *   ...MD3LightTheme,
 *   colors: {
 *     ...MD3LightTheme.colors,
 *     ...colors,
 *     success: '#4caf50', // Vert pour succès
 *     warning: '#ff9800', // Orange pour warnings
 *   },
 * };
 * ```
 */
