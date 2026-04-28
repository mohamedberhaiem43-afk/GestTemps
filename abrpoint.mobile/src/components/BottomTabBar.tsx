import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS } from '../config/env';

export type TabKey = 'home' | 'history' | 'requests' | 'profile';

interface TabSpec {
  key: TabKey;
  label: string;
  icon: string;
  route: string;
}

const TABS: TabSpec[] = [
  { key: 'home', label: 'Accueil', icon: 'home-variant', route: 'Home' },
  { key: 'history', label: 'Historique', icon: 'history', route: 'PresenceHistory' },
  { key: 'requests', label: 'Demandes', icon: 'inbox-multiple-outline', route: 'LeaveRequest' },
  { key: 'profile', label: 'Profil', icon: 'account-circle-outline', route: 'Profile' },
];

interface Props {
  active: TabKey;
  navigation: any;
}

/**
 * Barre de navigation persistante affichée au bas des écrans principaux côté employé.
 * On reste sur le stack navigator natif (pas de switch en BottomTabNavigator) pour
 * minimiser le risque de régression — chaque tab fait juste un navigate. L'item actif
 * est mis en avant via `active`.
 */
export default function BottomTabBar({ active, navigation }: Props) {
  return (
    <View style={styles.bar}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.item}
            activeOpacity={0.7}
            onPress={() => {
              if (isActive) return;
              // navigate avec replace si on quitte l'écran courant pour éviter une pile infinie
              // d'écrans accumulés en pressant les tabs successivement.
              navigation.navigate(tab.route);
            }}
          >
            <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
              <MaterialCommunityIcons
                name={tab.icon}
                size={22}
                color={isActive ? COLORS.onPrimary : COLORS.outline}
              />
            </View>
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: Platform.select({ ios: 24, android: 12 }),
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: COLORS.outlineVariant,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  iconWrap: {
    width: 44,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapActive: {
    backgroundColor: COLORS.primary,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.outline,
    letterSpacing: 0.2,
  },
  labelActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },
});
