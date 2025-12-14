/**
 * @fileoverview Navigation principale de l'application Psy2Bib
 * 
 * Ce fichier orchestre toute la navigation de l'app selon l'état d'authentification.
 * Il utilise React Navigation (Stack Navigator) pour gérer les écrans.
 * 
 * ═══════════════════════════════════════════════════════════════
 *  ARCHITECTURE DE NAVIGATION
 * ═══════════════════════════════════════════════════════════════
 * 
 * Deux stacks principales selon l'état d'authentification :
 * 
 * 1. STACK NON AUTHENTIFIÉ (user === null) :
 *    - Landing → Écran d'accueil avec choix "Patient" ou "Psy"
 *    - Login → Connexion
 *    - PatientRegister → Inscription patient
 *    - PsyRegister → Inscription psychologue
 * 
 * 2. STACK AUTHENTIFIÉ (user !== null) :
 *    Varie selon le rôle (user.role) :
 *    
 *    a) PATIENT :
 *       - PatientDashboard → Tableau de bord patient
 *       - PatientProfile → Profil patient (données chiffrées)
 *       - PatientAppointments → Liste des RDV
 *       - SearchPsy → Recherche de psychologues
 *       - Messages → Liste des conversations
 *       - ChatConversation → Discussion avec un psy
 *    
 *    b) PSY :
 *       - PsyDashboard → Tableau de bord psy
 *       - PsyProfile → Profil psy (public)
 *       - PsyAvailability → Gestion des disponibilités (calendrier)
 *       - PsyAppointments → Liste des RDV avec patients
 *       - Messages → Liste des conversations
 *       - ChatConversation → Discussion avec un patient
 * 
 * ═══════════════════════════════════════════════════════════════
 *  REACT NAVIGATION
 * ═══════════════════════════════════════════════════════════════
 * 
 * Librairie utilisée : @react-navigation/native + @react-navigation/native-stack
 * 
 * Stack Navigator : Navigation en pile (écrans empilés, bouton "retour" automatique)
 * Alternative : Bottom Tabs (onglets en bas), Drawer (menu latéral)
 * 
 * Ici on utilise Stack car :
 * - Convient pour des flux linéaires (Login → Register → Dashboard)
 * - Gestion automatique du "retour" iOS/Android
 * - Animations natives (slide, modal...)
 * 
 * @author Psy2Bib Team
 * @since 1.0.0
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '../screens/LoginScreen';
import { LandingScreen } from '../screens/LandingScreen';
import { LoadingScreen } from '../screens/LoadingScreen';
import { PatientRegisterScreen } from '../screens/patient/PatientRegisterScreen';
import { PsyRegisterScreen } from '../screens/psy/PsyRegisterScreen';
import { PatientDashboardScreen } from '../screens/patient/PatientDashboardScreen';
import { PatientProfileScreen } from '../screens/patient/PatientProfileScreen';
import { PatientAppointmentsScreen } from '../screens/patient/PatientAppointmentsScreen';
import { PsyDashboardScreen } from '../screens/psy/PsyDashboardScreen';
import { PsyProfileScreen } from '../screens/psy/PsyProfileScreen';
import { PsyAvailabilityScreen } from '../screens/psy/PsyAvailabilityScreen';
import { PsyAppointmentsScreen } from '../screens/psy/PsyAppointmentsScreen';
import { MessagesListScreen } from '../screens/chat/MessagesListScreen';
import { ChatConversationScreen } from '../screens/chat/ChatConversationScreen';
import { SearchPsyScreen } from '../screens/patient/SearchPsyScreen';
import { useAuth } from '../hooks/useAuth';

/**
 * Stack Navigator instance.
 * 
 * Créé avec createNativeStackNavigator() pour bénéficier des animations natives
 * iOS/Android (au lieu des animations JavaScript).
 */
const Stack = createNativeStackNavigator();

/**
 * Composant principal de navigation.
 * 
 * Workflow d'initialisation :
 * 1. App démarre → useAuth().loading = true (restauration tokens depuis SecureStore)
 * 2. Affichage de LoadingScreen pendant 800ms minimum (splash screen)
 * 3. Si user existe → Stack authentifié (Patient ou Psy)
 * 4. Sinon → Stack non authentifié (Landing, Login, Register)
 * 
 * Le switch entre les stacks se fait automatiquement quand user change.
 * Exemple : Login réussi → setUser() → re-render avec Stack authentifié
 * 
 * @returns {JSX.Element} Arbre de navigation
 */
export const AppNavigator = () => {
  /** État d'authentification (user, loading) depuis le contexte */
  const { user, loading } = useAuth();
  
  /**
   * État local pour forcer un délai minimum du splash screen.
   * 
   * Pourquoi ? Pour éviter un "flash" si les tokens sont chargés trop vite.
   * 800ms = durée confortable pour afficher un logo/animation.
   */
  const [showSplash, setShowSplash] = React.useState(true);

  /**
   * useEffect au montage pour gérer le délai du splash screen.
   * 
   * Même si loading devient false après 50ms, on attend 800ms avant
   * d'afficher la navigation réelle (meilleure UX).
   */
  React.useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 800);
    return () => clearTimeout(timer); // Cleanup du timer
  }, []);

  /**
   * Pendant le chargement initial (loading OU showSplash), afficher le LoadingScreen.
   * 
   * LoadingScreen = Écran blanc avec logo Psy2Bib animé (ou spinner).
   */
  if (loading || showSplash) {
    return <LoadingScreen />;
  }

  /**
   * Navigation conditionnelle selon l'état d'authentification.
   * 
   * NavigationContainer : Wrapper React Navigation (gère l'état de navigation global)
   * Stack.Navigator : Container pour les écrans empilés
   * Stack.Screen : Définition d'un écran (name + component + options)
   */
  return (
    <NavigationContainer>
      {user ? (
        /**
         * ═════════════════════════════════════════════════════════
         * STACK AUTHENTIFIÉ (utilisateur connecté)
         * ═════════════════════════════════════════════════════════
         * 
         * Varie selon user.role (PATIENT ou PSY).
         */
        <Stack.Navigator>
          {user.role === 'PATIENT' ? (
            /**
             * ────────────────────────────────────────────────────
             * ÉCRANS PATIENT
             * ────────────────────────────────────────────────────
             */
            <>
              {/* Écran principal : Dashboard patient */}
              <Stack.Screen 
                name="PatientDashboard" 
                component={PatientDashboardScreen} 
                options={{ 
                  title: 'Tableau de bord',
                  headerShown: false // Pas de header (custom dans le screen)
                }} 
              />
              
              {/* Profil patient (données chiffrées) */}
              <Stack.Screen 
                name="PatientProfile" 
                component={PatientProfileScreen} 
                options={{ title: 'Profil Patient' }} 
              />
              
              {/* Liste des rendez-vous du patient */}
              <Stack.Screen 
                name="PatientAppointments" 
                component={PatientAppointmentsScreen} 
                options={{ 
                  title: 'Mes Rendez-vous',
                  headerShown: false 
                }} 
              />
              
              {/* Recherche de psychologues */}
              <Stack.Screen 
                name="SearchPsy" 
                component={SearchPsyScreen} 
                options={{ 
                  title: 'Trouver un psy',
                  headerShown: false 
                }} 
              />
              
              {/* Liste des conversations (threads) */}
              <Stack.Screen 
                name="Messages" 
                component={MessagesListScreen} 
                options={{ 
                  title: 'Messagerie',
                  headerShown: false 
                }} 
              />
              
              {/* Conversation individuelle avec un psy */}
              <Stack.Screen 
                name="ChatConversation" 
                component={ChatConversationScreen} 
                options={{ headerShown: false }} 
              />
            </>
          ) : (
            /**
             * ────────────────────────────────────────────────────
             * ÉCRANS PSYCHOLOGUE
             * ────────────────────────────────────────────────────
             */
            <>
              {/* Écran principal : Dashboard psy */}
              <Stack.Screen 
                name="PsyDashboard" 
                component={PsyDashboardScreen} 
                options={{ 
                  title: 'Espace Psy',
                  headerShown: false 
                }} 
              />
              
              {/* Profil psy (public, visible par patients) */}
              <Stack.Screen 
                name="PsyProfile" 
                component={PsyProfileScreen} 
                options={{ title: 'Profil Psy' }} 
              />
              
              {/* Gestion des disponibilités (calendrier) */}
              <Stack.Screen 
                name="PsyAvailability" 
                component={PsyAvailabilityScreen} 
                options={{ 
                  title: 'Mes disponibilités',
                  headerShown: false 
                }} 
              />
              
              {/* Liste des rendez-vous avec patients */}
              <Stack.Screen 
                name="PsyAppointments" 
                component={PsyAppointmentsScreen} 
                options={{ 
                  title: 'Mes rendez-vous',
                  headerShown: false 
                }} 
              />
              
              {/* Liste des conversations (threads) */}
              <Stack.Screen 
                name="Messages" 
                component={MessagesListScreen} 
                options={{ 
                  title: 'Messagerie',
                  headerShown: false 
                }} 
              />
              
              {/* Conversation individuelle avec un patient */}
              <Stack.Screen 
                name="ChatConversation" 
                component={ChatConversationScreen} 
                options={{ headerShown: false }} 
              />
            </>
          )}
        </Stack.Navigator>
      ) : (
        /**
         * ═════════════════════════════════════════════════════════
         * STACK NON AUTHENTIFIÉ (utilisateur non connecté)
         * ═════════════════════════════════════════════════════════
         */
        <Stack.Navigator>
          {/* Écran d'accueil : Choix "Je suis patient" ou "Je suis psy" */}
          <Stack.Screen 
            name="Landing" 
            component={LandingScreen} 
            options={{ headerShown: false }} 
          />
          
          {/* Écran de connexion */}
          <Stack.Screen 
            name="Login" 
            component={LoginScreen} 
            options={{ title: 'Connexion' }} 
          />
          
          {/* Formulaire d'inscription patient */}
          <Stack.Screen 
            name="PatientRegister" 
            component={PatientRegisterScreen} 
            options={{ title: 'Inscription Patient' }} 
          />
          
          {/* Formulaire d'inscription psychologue */}
          <Stack.Screen 
            name="PsyRegister" 
            component={PsyRegisterScreen} 
            options={{ title: 'Inscription Psychologue' }} 
          />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
};

/**
 * ═══════════════════════════════════════════════════════════════
 *  NOTES TECHNIQUES
 * ═══════════════════════════════════════════════════════════════
 * 
 * 1. NAVIGATION CONDITIONNELLE :
 *    Le switch user ? <StackAuth> : <StackGuest> est le pattern standard
 *    pour gérer authentification dans React Navigation.
 *    
 *    Avantage : Pas besoin de guards dans chaque écran.
 *    Inconvénient : Perd l'historique de navigation après login/logout
 *                   (acceptable ici car flows différents).
 * 
 * 2. HEADER NAVIGATION :
 *    - headerShown: false → Pas de barre de navigation iOS/Android native
 *    - Utilisé quand on veut un header custom (dans le Screen lui-même)
 *    - Permet plus de flexibilité design (gradients, avatars, badges...)
 * 
 * 3. TYPAGE TYPESCRIPT :
 *    Pour typer la navigation (autocomplete des noms d'écrans), on peut ajouter :
 *    ```typescript
 *    export type RootStackParamList = {
 *      PatientDashboard: undefined;
 *      SearchPsy: { specialty?: string };
 *      ChatConversation: { userId: string; pseudo: string };
 *      // ...
 *    };
 *    const Stack = createNativeStackNavigator<RootStackParamList>();
 *    ```
 *    Non implémenté ici mais recommandé pour un projet en production.
 * 
 * 4. AMÉLIORATION FUTURE :
 *    - Ajouter un Bottom Tab Navigator dans les stacks authentifiés
 *      (Dashboard, Appointments, Messages en onglets)
 *    - Implémenter Deep Linking (ouvrir l'app via URL)
 *    - Ajouter des animations de transition custom
 */
