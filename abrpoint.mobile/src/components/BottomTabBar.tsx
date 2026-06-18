import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../config/env';
import { useAuth, PlanFeatures } from '../contexts/AuthContext';
import { useT } from '../i18n';

export type TabKey = 'home' | 'history' | 'requests' | 'profile';

// Nom de glyphe MaterialCommunityIcons (typage strict apporté par @expo/vector-icons).
type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface TabSpec {
  key: TabKey;
  labelKey: string;
  icon: MCIName;
  route: string;
  /** Si défini, la tab disparaît quand la feature n'est pas active sur le pack. */
  requires?: keyof PlanFeatures;
}

const TABS: TabSpec[] = [
  { key: 'home', labelKey: 'tab.home', icon: 'home-variant', route: 'Home' },
  { key: 'history', labelKey: 'tab.history', icon: 'history', route: 'PresenceHistory' },
  // 2026-05-27 — Tab Demandes gated sur leaveManagement : sur le pack Starter
  // (positionnement « pointage simple sans workflow RH ») l'écran LeaveRequest
  // n'a pas de sens — on retire l'entrée de la barre du bas.
  { key: 'requests', labelKey: 'tab.requests', icon: 'inbox-multiple-outline', route: 'LeaveRequest', requires: 'leaveManagement' },
  { key: 'profile', labelKey: 'tab.profile', icon: 'account-circle-outline', route: 'Profile' },
];

interface Props {
  active: TabKey;
  navigation: any;
}

// Hauteur visible de la barre (sans le padding bas dynamique). Sert aux écrans
// pour calculer le `paddingBottom` de leur ScrollView via `useTabBarPadding`.
export const TAB_BAR_HEIGHT = 64;

/**
 * Hook utilitaire à utiliser dans les écrans qui posent un `<BottomTabBar />`.
 * Renvoie le `paddingBottom` à appliquer au contentContainerStyle de leur ScrollView
 * pour que le dernier élément ne soit jamais masqué par la barre + les boutons de
 * navigation système (gesture bar iOS, nav bar Android Samsung en mode 3-boutons).
 */
export function useTabBarPadding(extra: number = 16): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + insets.bottom + extra;
}

/**
 * Barre de navigation persistante affichée au bas des écrans principaux côté employé.
 * On reste sur le stack navigator natif (pas de switch en BottomTabNavigator) pour
 * minimiser le risque de régression — chaque tab fait juste un navigate. L'item actif
 * est mis en avant via `active`.
 *
 * Le padding bas est calculé dynamiquement avec `useSafeAreaInsets()` pour ne pas
 * être recouvert par la barre de navigation système (gestures iOS, boutons Samsung).
 * Avant, on utilisait `Platform.select({ ios: 24, android: 12 })` ce qui faisait
 * disparaître les labels et rendait la moitié inférieure des items intoutchable
 * sur les Galaxy avec barre de gestes activée.
 */
export default function BottomTabBar({ active, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { planAllows } = useAuth();
  const t = useT();
  // Sur Android on garde un minimum de 8px même si insets.bottom est 0 (cas mode
  // 3-boutons sur certains constructeurs où Android ne les reporte pas comme inset).
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 0);

  const visibleTabs = TABS.filter(t => !t.requires || planAllows(t.requires));

  return (
    <View style={[styles.bar, { paddingBottom: bottomPad + 6 }]}>
      {visibleTabs.map((tab) => {
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
            <Text style={[styles.label, isActive && styles.labelActive]}>{t(tab.labelKey)}</Text>
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
