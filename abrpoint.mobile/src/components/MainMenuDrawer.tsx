import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../config/env';
import { useAuth, PlanFeatures } from '../contexts/AuthContext';
import { useT } from '../i18n';

interface Props {
  visible: boolean;
  onClose: () => void;
  navigation: any;
}

interface MenuItem {
  icon: string;
  labelKey: string;
  route?: string;
  action?: 'logout';
  managerOnly?: boolean;
  /** Si défini, l'entrée disparaît quand la feature n'est pas active sur le pack. */
  requires?: keyof PlanFeatures;
  color?: string;
  /** Marque l'entrée « Bulletins de paie » → ouvre le coffre filtré sur les bulletins. */
  vaultCategory?: 'bulletin';
}

// 2026-05-27 — chaque entrée du drawer porte un flag `requires` pour matcher
// l'écran sur le bon module pack. Sans ça, un user Starter voyait des entrées
// (Missions, Coffre, Frais, Assistant juridique…) qui menaient à des écrans
// renvoyés 402 par le backend → confusion. Maintenant l'entrée disparaît
// silencieusement quand le tenant n'a pas la feature.
const MENU: MenuItem[] = [
  { icon: 'view-dashboard-outline',  labelKey: 'nav.home',             route: 'Home' },
  { icon: 'account-circle-outline',  labelKey: 'nav.profile',          route: 'Profile' },
  { icon: 'bell-outline',            labelKey: 'nav.notifications',    route: 'Notifications' },
  { icon: 'cog-outline',             labelKey: 'nav.notifPrefs',       route: 'NotificationPreferences' },
  { icon: 'calendar-month-outline',  labelKey: 'nav.leave',           route: 'LeaveRequest',         requires: 'leaveManagement' },
  { icon: 'piggy-bank-outline',      labelKey: 'nav.cet',             route: 'AlimenterCet',         requires: 'leaveManagement' },
  { icon: 'exit-run',                labelKey: 'nav.authorizations',  route: 'DemandeAutorisation',  requires: 'authorizationManagement' },
  { icon: 'receipt',                 labelKey: 'nav.expenses',        route: 'Expense',              requires: 'expenseReports' },
  { icon: 'briefcase-outline',       labelKey: 'nav.missions',        route: 'Missions',             requires: 'missions' },
  { icon: 'history',                 labelKey: 'nav.history',         route: 'PresenceHistory' },
  { icon: 'calendar-clock-outline',  labelKey: 'nav.schedule',        route: 'Schedule' },
  { icon: 'folder-lock',             labelKey: 'nav.vault',           route: 'DigitalVault',         requires: 'digitalVault' },
  { icon: 'cash-multiple',           labelKey: 'nav.payslips',        route: 'DigitalVault',         requires: 'digitalVault', vaultCategory: 'bulletin' },
  { icon: 'calendar-star',           labelKey: 'nav.holidays',        route: 'Holidays' },
  { icon: 'scale-balance',           labelKey: 'nav.legalAssistant',  route: 'ChatRag',              requires: 'ragAi' },
  { icon: 'view-dashboard',          labelKey: 'nav.teamDashboard',   route: 'ManagerDashboard',     managerOnly: true, requires: 'advancedDashboards' },
  { icon: 'calendar-check-outline',  labelKey: 'nav.validateLeave',   route: 'LeaveApproval',        managerOnly: true, requires: 'leaveManagement' },
  { icon: 'exit-run',                labelKey: 'nav.validateAuth',    route: 'AuthorizationApproval',managerOnly: true, requires: 'authorizationManagement' },
  { icon: 'receipt-text-check-outline', labelKey: 'nav.validateExpenses', route: 'ExpenseApproval', managerOnly: true, requires: 'expenseReports' },
  { icon: 'briefcase-check-outline', labelKey: 'nav.validateMissions', route: 'MissionApproval',     managerOnly: true, requires: 'missions' },
  { icon: 'account-group-outline',   labelKey: 'nav.myTeam',          route: 'EmployeeList',         managerOnly: true },
  { icon: 'calendar-today',          labelKey: 'nav.dailyPointage',   route: 'DailyPointage',        managerOnly: true },
];

const LOGOUT_ITEM: MenuItem = { icon: 'logout', labelKey: 'nav.logout', action: 'logout', color: COLORS.error };

/**
 * Drawer latéral activé par le burger menu (top-left). Liste l'ensemble des
 * destinations atteignables depuis l'app — utile sur les écrans qui ne sont
 * pas dans la BottomTabBar (Notifications, Schedule, Missions, ChatRag…).
 *
 * Le drawer se ferme automatiquement lors d'une navigation.
 */
export default function MainMenuDrawer({ visible, onClose, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { user, isAdmin, isManager, logout, planAllows } = useAuth();
  const t = useT();

  const onItemPress = (item: MenuItem) => {
    onClose();
    if (item.action === 'logout') {
      Alert.alert(`🔐 ${t('logout.title')}`, t('logout.confirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('nav.logout'), style: 'destructive', onPress: logout },
      ]);
      return;
    }
    if (item.route) {
      // setTimeout pour laisser le modal se fermer avant la navigation —
      // évite un flash visuel sur certains Android.
      const params = item.vaultCategory ? { category: item.vaultCategory } : undefined;
      setTimeout(() => navigation.navigate(item.route!, params), 80);
    }
  };

  const visibleItems = MENU.filter(it => {
    if (it.managerOnly && !isAdmin && !isManager) return false;
    if (it.requires && !planAllows(it.requires)) return false;
    return true;
  });
  const initials = (user?.utilib || '?').split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <TouchableOpacity activeOpacity={1} style={styles.overlay} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[styles.drawer, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
          {/* En-tête utilisateur */}
          <View style={styles.header}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName} numberOfLines={1}>{user?.utilib || t('common.user')}</Text>
              <Text style={styles.userEmail} numberOfLines={1}>{user?.uticod || ''}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialCommunityIcons name="close" size={24} color={COLORS.outline} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {visibleItems.map((it, idx) => (
              <TouchableOpacity key={`${it.route}-${idx}`} style={styles.item} onPress={() => onItemPress(it)} activeOpacity={0.6}>
                <View style={styles.itemIconBox}>
                  <MaterialCommunityIcons name={it.icon as any} size={20} color={COLORS.primary} />
                </View>
                <Text style={styles.itemLabel}>{t(it.labelKey)}</Text>
                <MaterialCommunityIcons name="chevron-right" size={18} color={COLORS.outlineVariant} />
              </TouchableOpacity>
            ))}

            <View style={styles.divider} />

            <TouchableOpacity style={styles.item} onPress={() => onItemPress(LOGOUT_ITEM)} activeOpacity={0.6}>
              <View style={[styles.itemIconBox, { backgroundColor: COLORS.errorContainer }]}>
                <MaterialCommunityIcons name="logout" size={20} color={COLORS.error} />
              </View>
              <Text style={[styles.itemLabel, { color: COLORS.error }]}>{t('nav.logout')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', flexDirection: 'row' },
  drawer: {
    width: '82%', maxWidth: 340, backgroundColor: '#fff',
    paddingHorizontal: 20,
    shadowColor: '#000', shadowOffset: { width: 4, height: 0 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 24,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingBottom: 20, marginBottom: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.outlineVariant,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  userName: { fontSize: 14, fontWeight: '800', color: COLORS.onSurface },
  userEmail: { fontSize: 11, color: COLORS.outline, marginTop: 2 },
  scrollContent: { paddingBottom: 20 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 12, paddingHorizontal: 4,
  },
  itemIconBox: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.primaryFixed,
    justifyContent: 'center', alignItems: 'center',
  },
  itemLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: COLORS.onSurface },
  divider: { height: 1, backgroundColor: COLORS.outlineVariant, marginVertical: 8 },
});
