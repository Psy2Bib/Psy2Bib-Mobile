/**
 * @fileoverview Barre de navigation inférieure pour les psychologues
 * 
 * Affiche 5 onglets : Accueil, Dispos (Disponibilités), RDV, Messages, Profil.
 * Design identique à PatientBottomBar mais avec un onglet "Disponibilités" au lieu de "Rechercher".
 * 
 * @author Psy2Bib Team
 * @since 1.0.0
 */

import React from 'react';
import { View } from 'react-native';
import { IconButton, Text } from 'react-native-paper';

/**
 * Type des onglets possibles dans la navigation psy.
 */
type TabKey = 'home' | 'availability' | 'appointments' | 'messages' | 'profile';

/**
 * Props du composant PsyBottomBar.
 */
type Props = {
  /** Onglet actuellement actif */
  activeTab: TabKey;
  
  /** Callback "Accueil" (dashboard psy) */
  onPressHome?: () => void;
  
  /** Callback "Dispos" (gestion disponibilités/calendrier) */
  onPressAvailability?: () => void;
  
  /** Callback "RDV" (rendez-vous avec patients) */
  onPressAppointments?: () => void;
  
  /** Callback "Messages" (messagerie) */
  onPressMessages?: () => void;
  
  /** Callback "Profil" (profil psy public) */
  onPressProfile?: () => void;
};

/**
 * Barre de navigation inférieure pour les psychologues.
 * 
 * Différence avec PatientBottomBar :
 * - "Rechercher" remplacé par "Dispos" (availability)
 * - Icône clock-outline au lieu de magnify
 * 
 * Le reste du design est identique (violet #6A4CE6, ombre, arrondi...).
 * 
 * @param props - Props du composant
 * @returns {JSX.Element} Barre de navigation stylisée
 * 
 * @example
 * ```tsx
 * // Dans PsyDashboardScreen
 * const [activeTab, setActiveTab] = useState<TabKey>('home');
 * 
 * return (
 *   <View style={{ flex: 1 }}>
 *     {activeTab === 'home' && <DashboardContent />}
 *     {activeTab === 'availability' && <CalendarSection />}
 *     {activeTab === 'appointments' && <AppointmentsList />}
 *     {activeTab === 'messages' && <MessagesList />}
 *     {activeTab === 'profile' && <ProfileForm />}
 *     
 *     <PsyBottomBar
 *       activeTab={activeTab}
 *       onPressHome={() => setActiveTab('home')}
 *       onPressAvailability={() => setActiveTab('availability')}
 *       onPressAppointments={() => setActiveTab('appointments')}
 *       onPressMessages={() => setActiveTab('messages')}
 *       onPressProfile={() => setActiveTab('profile')}
 *     />
 *   </View>
 * );
 * ```
 */
export const PsyBottomBar = ({
  activeTab,
  onPressHome,
  onPressAvailability,
  onPressAppointments,
  onPressMessages,
  onPressProfile,
}: Props) => {
  
  /** Couleur primaire Psy2Bib (violet/mauve) */
  const primary = '#6A4CE6';
  
  /** Couleur grise pour onglets inactifs */
  const inactive = '#7f7f7f';

  /**
   * Fonction interne pour rendre un onglet.
   * Logique identique à PatientBottomBar.
   */
  const renderItem = (
    key: TabKey,
    label: string,
    icon: string,
    onPress?: () => void
  ) => {
    const isActive = activeTab === key;

    return (
      <View style={{ flex: 1, alignItems: 'center' }}>
        <IconButton
          icon={icon}
          size={24}
          onPress={onPress}
          style={{
            margin: 0,
            borderRadius: 999,
            backgroundColor: isActive ? `${primary}22` : 'transparent',
          }}
          iconColor={isActive ? primary : inactive}
        />
        <Text
          variant="labelSmall"
          style={{
            marginTop: -4,
            color: isActive ? primary : inactive,
            fontWeight: isActive ? '700' : '400',
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
      <View
        style={{
          flexDirection: 'row',
          borderRadius: 999,
          paddingVertical: 8,
          paddingHorizontal: 12,
          backgroundColor: 'white',
          alignItems: 'center',
          justifyContent: 'space-between',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.12,
          shadowRadius: 8,
          elevation: 6,
        }}
      >
        {/* 5 onglets psy */}
        {renderItem('home', 'Accueil', 'home-outline', onPressHome)}
        {renderItem('availability', 'Dispos', 'clock-outline', onPressAvailability)}
        {renderItem('appointments', 'RDV', 'calendar-month-outline', onPressAppointments)}
        {renderItem('messages', 'Messages', 'message-text-outline', onPressMessages)}
        {renderItem('profile', 'Profil', 'account-circle-outline', onPressProfile)}
      </View>
    </View>
  );
};
