/**
 * @fileoverview Barre de navigation inférieure pour les patients
 * 
 * Affiche 5 onglets : Accueil, Rechercher, RDV, Messages, Profil.
 * Design moderne avec icônes Material Design, fond arrondi et ombre.
 * 
 * Pattern de navigation :
 * - Pas de React Navigation (Bottom Tabs) ici, juste un composant UI
 * - Les onPress callbacks sont gérés par le screen parent (PatientDashboardScreen)
 * - Permet une navigation custom entre sections d'un même screen
 * 
 * @author Psy2Bib Team
 * @since 1.0.0
 */

import React from 'react';
import { View } from 'react-native';
import { IconButton, Text } from 'react-native-paper';

/**
 * Type des onglets possibles dans la navigation patient.
 */
type TabKey = 'home' | 'search' | 'appointments' | 'messages' | 'profile';

/**
 * Props du composant PatientBottomBar.
 */
type Props = {
  /** Onglet actuellement actif (pour l'highlight visuel) */
  activeTab: TabKey;
  
  /** Callback quand on appuie sur "Accueil" */
  onPressHome?: () => void;
  
  /** Callback quand on appuie sur "Rechercher" (chercher un psy) */
  onPressSearch?: () => void;
  
  /** Callback quand on appuie sur "RDV" (rendez-vous) */
  onPressAppointments?: () => void;
  
  /** Callback quand on appuie sur "Messages" (messagerie) */
  onPressMessages?: () => void;
  
  /** Callback quand on appuie sur "Profil" (profil patient) */
  onPressProfile?: () => void;
};

/**
 * Barre de navigation inférieure pour les patients.
 * 
 * Design :
 * - 5 onglets avec icône + label
 * - Fond blanc arrondi (borderRadius: 999) avec ombre
 * - Couleur primaire (#6A4CE6) pour l'onglet actif
 * - Gris (#7f7f7f) pour les onglets inactifs
 * 
 * Utilisation typique :
 * Le parent (ex: PatientDashboardScreen) gère l'état activeTab et change
 * le contenu affiché en fonction du tab sélectionné.
 * 
 * @param props - Props du composant
 * @returns {JSX.Element} Barre de navigation stylisée
 * 
 * @example
 * ```tsx
 * const [activeTab, setActiveTab] = useState<TabKey>('home');
 * 
 * return (
 *   <View style={{ flex: 1 }}>
 *     {activeTab === 'home' && <HomeSection />}
 *     {activeTab === 'search' && <SearchSection />}
 *     {activeTab === 'appointments' && <AppointmentsSection />}
 *     {activeTab === 'messages' && <MessagesSection />}
 *     {activeTab === 'profile' && <ProfileSection />}
 *     
 *     <PatientBottomBar
 *       activeTab={activeTab}
 *       onPressHome={() => setActiveTab('home')}
 *       onPressSearch={() => setActiveTab('search')}
 *       onPressAppointments={() => setActiveTab('appointments')}
 *       onPressMessages={() => setActiveTab('messages')}
 *       onPressProfile={() => setActiveTab('profile')}
 *     />
 *   </View>
 * );
 * ```
 */
export const PatientBottomBar = ({
  activeTab,
  onPressHome,
  onPressSearch,
  onPressAppointments,
  onPressMessages,
  onPressProfile,
}: Props) => {
  /** Couleur primaire Psy2Bib (violet) */
  const primary = '#6A4CE6';
  
  /** Couleur grise pour onglets inactifs */
  const inactive = '#7f7f7f';

  /**
   * Fonction interne pour rendre un onglet.
   * 
   * @param key - Clé de l'onglet (pour comparaison avec activeTab)
   * @param label - Texte affiché sous l'icône
   * @param icon - Nom de l'icône Material Design (ex: 'home-outline')
   * @param onPress - Callback au clic
   * @returns {JSX.Element} Item de navigation
   */
  const renderItem = (
    key: TabKey,
    label: string,
    icon: string,
    onPress?: () => void
  ) => {
    const isActive = activeTab === key;
    return (
      <View style={{ flex: 1, alignItems: 'center', minWidth: 60 }}>
        {/* IconButton de react-native-paper avec style custom */}
        <IconButton
          icon={icon}
          size={24}
          onPress={onPress}
          style={{
            margin: 0,
            borderRadius: 999,
            // Fond violet transparent si actif, sinon transparent
            backgroundColor: isActive ? `${primary}22` : 'transparent',
          }}
          iconColor={isActive ? primary : inactive}
        />
        
        {/* Label sous l'icône */}
        <Text
          variant="labelSmall"
          style={{
            marginTop: -4, // Rapprocher du bouton
            color: isActive ? primary : inactive,
            fontWeight: isActive ? '700' : '400', // Bold si actif
            letterSpacing: 0.1,
            includeFontPadding: false,
            textAlign: 'center',
            flexWrap: 'nowrap',
          }}
        >
          {label}
        </Text>
      </View>
    );
  };

  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingBottom: 24, // Marge pour éviter l'encoche iPhone / Home Indicator
        paddingTop: 6,
      }}
    >
      {/* Container blanc arrondi avec ombre */}
      <View
        style={{
          flexDirection: 'row',
          borderRadius: 999, // Arrondi complet (forme "pill")
          paddingVertical: 8,
          paddingHorizontal: 12,
          backgroundColor: 'white',
          alignItems: 'center',
          justifyContent: 'space-between',
          // Ombre iOS
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.12,
          shadowRadius: 8,
          // Ombre Android
          elevation: 6,
        }}
      >
        {/* Rendu des 5 onglets */}
        {renderItem('home', 'Accueil', 'home-outline', onPressHome)}
        {renderItem('search', 'Rechercher', 'magnify', onPressSearch)}
        {renderItem('appointments', 'RDV', 'calendar-month-outline', onPressAppointments)}
        {renderItem('messages', 'Messages', 'message-text-outline', onPressMessages)}
        {renderItem('profile', 'Profil', 'account-circle-outline', onPressProfile)}
      </View>
    </View>
  );
};
