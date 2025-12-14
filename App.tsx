/**
 * @fileoverview Point d'entrée principal de l'application Psy2Bib (Mobile)
 * 
 * Ce fichier est le CŒUR de l'application. Il orchestre tous les Providers
 * et initialise la navigation.
 * 
 * ═══════════════════════════════════════════════════════════════
 * 🏗️ ARCHITECTURE DES PROVIDERS (Wrapper Pattern)
 * ═══════════════════════════════════════════════════════════════
 * 
 * Structure en "poupées russes" (nested providers) :
 * 
 * ```
 * <PaperProvider>           ← Thème Material Design 3
 *   └─ <AuthProvider>       ← État d'authentification global
 *        └─ <AppNavigator>  ← Navigation React Navigation
 *             └─ Tous les écrans
 * ```
 * 
 * Ordre important :
 * 1. PaperProvider en premier (applique le thème à tous les composants Paper)
 * 2. AuthProvider après (peut utiliser les composants Paper dans useAuth)
 * 3. AppNavigator à l'intérieur (peut utiliser useAuth() pour navigation conditionnelle)
 * 
 * ═══════════════════════════════════════════════════════════════
 * 📚 PROVIDERS UTILISÉS
 * ═══════════════════════════════════════════════════════════════
 * 
 * 1. PaperProvider (react-native-paper)
 *    - Applique le thème global (couleurs, roundness, fonts...)
 *    - Permet l'utilisation de Portal (Modals, Snackbars...)
 *    - Tous les composants Paper (Button, Card, TextInput...) héritent du thème
 * 
 * 2. AuthProvider (custom)
 *    - Gère l'état d'authentification (user, tokens, vault patient...)
 *    - Expose le hook useAuth() dans toute l'app
 *    - Restaure la session au démarrage (SecureStore)
 * 
 * 3. AppNavigator (react-navigation)
 *    - Gère la navigation entre écrans
 *    - Affiche différents stacks selon l'état d'authentification
 *    - Gère le splash screen (LoadingScreen) pendant l'initialisation
 * 
 * ═══════════════════════════════════════════════════════════════
 * 🚀 WORKFLOW DE DÉMARRAGE
 * ═══════════════════════════════════════════════════════════════
 * 
 * 1. App démarre → <App> monté
 * 2. <PaperProvider> applique le thème
 * 3. <AuthProvider> initialise :
 *    - authStorage.load() lit les tokens depuis SecureStore
 *    - Si tokens valides → setUser() (session restaurée)
 *    - Sinon → user reste null
 *    - setLoading(false)
 * 4. <AppNavigator> affiche :
 *    - Si loading=true → <LoadingScreen> (splash)
 *    - Si user=null → Stack non authentifié (Landing, Login, Register)
 *    - Si user !== null → Stack authentifié (Dashboard Patient/Psy)
 * 
 * @author Psy2Bib Team
 * @since 1.0.0
 */

import * as React from 'react';
import { Provider as PaperProvider } from 'react-native-paper';
import { AppNavigator } from './src/navigation/AppNavigator';
import { AuthProvider } from './src/hooks/useAuth';
import { appTheme } from './src/theme';

/**
 * Composant racine de l'application.
 * 
 * Simple et épuré : Uniquement les Providers nécessaires.
 * Pas de logique métier ici (déléguée aux Providers et à AppNavigator).
 * 
 * @returns {JSX.Element} Arbre de l'application
 */
export default function App() {
  
  return (
    /**
     * PaperProvider : Provider react-native-paper pour le thème.
     * 
     * Props :
     * - theme : Objet thème personnalisé (appTheme défini dans src/theme/index.ts)
     * 
     * Fonctionnalités :
     * - Applique colors, roundness, fonts à tous les composants Paper
     * - Permet l'utilisation de <Portal> pour Modals/Snackbars
     * - Fournit le hook useTheme() dans tous les composants enfants
     * 
     * Exemple d'usage dans un composant enfant :
     * ```tsx
     * import { useTheme } from 'react-native-paper';
     * 
     * const MyScreen = () => {
     *   const theme = useTheme();
     *   return <View style={{ backgroundColor: theme.colors.primary }} />;
     * };
     * ```
     */
    <PaperProvider theme={appTheme}>
      
      {/**
       * AuthProvider : Provider custom pour l'authentification.
       * 
       * Fonctionnalités :
       * - Gère l'état global : user, patientVault, loading
       * - Expose les actions : login(), register(), logout(), updatePatientVault()
       * - Restaure la session au démarrage (authStorage.load)
       * - Fournit le hook useAuth() dans tous les composants enfants
       * 
       * Exemple d'usage dans un composant enfant :
       * ```tsx
       * import { useAuth } from './hooks/useAuth';
       * 
       * const MyScreen = () => {
       *   const { user, login, logout } = useAuth();
       *   
       *   if (!user) return <Text>Non connecté</Text>;
       *   
       *   return (
       *     <View>
       *       <Text>Bonjour {user.pseudo}</Text>
       *       <Button onPress={logout}>Se déconnecter</Button>
       *     </View>
       *   );
       * };
       * ```
       */}
      <AuthProvider>
        
        {/**
         * AppNavigator : Composant de navigation principal.
         * 
         * Responsabilités :
         * - Afficher LoadingScreen pendant l'initialisation (loading=true)
         * - Afficher Stack non authentifié si user=null (Landing, Login, Register)
         * - Afficher Stack authentifié si user !== null (Dashboard Patient/Psy)
         * - Gérer les transitions entre stacks lors du login/logout
         * 
         * Navigation conditionnelle :
         * Le switch entre stacks se fait automatiquement quand user change :
         * - Login réussi → setUser() → re-render → Stack authentifié affiché
         * - Logout → setUser(null) → re-render → Stack non authentifié affiché
         * 
         * Pas besoin de navigation manuelle (navigate('Dashboard')) !
         * Le re-render automatique gère tout.
         */}
        <AppNavigator />
        
      </AuthProvider>
    </PaperProvider>
  );
}

/**
 * ═══════════════════════════════════════════════════════════════
 * 📝 NOTES TECHNIQUES
 * ═══════════════════════════════════════════════════════════════
 * 
 * 1. POURQUOI PAS DE useState, useEffect ICI ?
 * 
 *    App.tsx est volontairement simple car :
 *    - La logique d'authentification est dans AuthProvider (useAuth.tsx)
 *    - La logique de navigation est dans AppNavigator.tsx
 *    - Le thème est défini dans src/theme/index.ts
 *    
 *    Principe : Séparation des responsabilités (Separation of Concerns).
 *    App.tsx = Point d'entrée uniquement, pas de logique métier.
 * 
 * 2. ORDRE DES PROVIDERS
 * 
 *    L'ordre est CRITIQUE :
 *    - PaperProvider en premier → Tous les enfants peuvent utiliser useTheme()
 *    - AuthProvider après → Peut utiliser les composants Paper (Button, Card...)
 *    - AppNavigator à l'intérieur → Peut utiliser useAuth() et useTheme()
 *    
 *    Si on inverse, erreur : "useAuth must be used within AuthProvider"
 * 
 * 3. AJOUTER UN NOUVEAU PROVIDER
 * 
 *    Pour ajouter un Provider (ex: NotificationProvider) :
 *    ```tsx
 *    export default function App() {
 *      return (
 *        <PaperProvider theme={appTheme}>
 *          <AuthProvider>
 *            <NotificationProvider>  // Nouveau provider
 *              <AppNavigator />
 *            </NotificationProvider>
 *          </AuthProvider>
 *        </PaperProvider>
 *      );
 *    }
 *    ```
 *    
 *    Règle : Plus on est proche d'App, plus on est "global" (accessible partout).
 * 
 * 4. GESTION DU SPLASH SCREEN
 * 
 *    Le splash screen (écran de chargement initial) est géré dans AppNavigator :
 *    - Si loading=true → <LoadingScreen> affiché
 *    - Délai minimum de 800ms pour éviter un "flash"
 *    - Permet de charger les tokens, fonts, assets...
 *    
 *    Pas de splash natif (expo-splash-screen) car on veut un contrôle total.
 * 
 * 5. HOT RELOAD / FAST REFRESH
 * 
 *    Expo utilise Fast Refresh pour recharger l'app en développement.
 *    App.tsx est rechargé à chaque modification de fichier.
 *    
 *    Attention : L'état des Providers est réinitialisé lors d'un Fast Refresh.
 *    Pour préserver l'état (ex: rester connecté), utiliser SecureStore (déjà fait).
 * 
 * 6. PERFORMANCE
 * 
 *    App.tsx ne re-render jamais (pas de state local).
 *    Seuls les Providers internes re-render (AuthProvider, AppNavigator).
 *    
 *    Si App.tsx re-rendait souvent, toute l'app serait re-rendue (lent).
 *    Ici, pas de problème car composant statique.
 * 
 * 7. TESTS
 * 
 *    Pour tester l'app, il faut wrapper dans tous les Providers :
 *    ```tsx
 *    import { render } from '@testing-library/react-native';
 *    import App from './App';
 *    
 *    test('App renders correctly', () => {
 *      const { getByText } = render(<App />);
 *      // Tests...
 *    });
 *    ```
 *    
 *    Ou créer un TestWrapper custom pour réutiliser les Providers.
 */
