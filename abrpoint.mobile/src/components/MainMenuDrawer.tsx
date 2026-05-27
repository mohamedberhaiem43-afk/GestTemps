import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS } from '../config/env';
import { useAuth, PlanFeatures } from '../contexts/AuthContext';

interface Props {
  visible: boolean;
  onClose: () => void;
  navigation: any;
}

interface MenuItem {
  icon: string;
  label: string;
  route?: string;
  action?: 'logout';
  managerOnly?: boolean;
  /** Si défini, l'entrée disparaît quand la feature n'est pas active sur le pack. */
  requires?: keyof PlanFeatures;
  color?: string;
}

// 2026-05-27 — chaque entrée du drawer porte un flag `requires` pour matcher
// l'écran sur le bon module pack. Sans ça, un user Starter voyait des entrées
// (Missions, Coffre, Frais, Assistant juridique…) qui menaient à des écrans
// renvoyés 402 par le backend → confusion. Maintenant l'entrée disparaît
// silencieusement quand le tenant n'a pas la feature.
const MENU: MenuItem[] = [
  { icon: 'view-dashboard-outline',  label: 'Accueil',                route: 'Home' },
  { icon: 'account-circle-outline',  label: 'Mon profil',             route: 'Profile' },
  { icon: 'bell-outline',            label: 'Notifications',          route: 'Notifications' },
  { icon: 'cog-outline',             label: 'Préférences notifications', route: 'NotificationPreferences' },
  { icon: 'calendar-month-outline',  label: 'Mes congés',             route: 'LeaveRequest',         requires: 'leaveManagement' },
  { icon: 'exit-run',                label: 'Autorisations sortie',   route: 'DemandeAutorisation',  requires: 'authorizationManagement' },
  { icon: 'receipt',                 label: 'Notes de frais',         route: 'Expense',              requires: 'expenseReports' },
  { icon: 'briefcase-outline',       label: 'Missions',               route: 'Missions',             requires: 'missions' },
  { icon: 'history',                 label: 'Historique pointage',    route: 'PresenceHistory' },
  { icon: 'calendar-clock-outline',  label: 'Mon planning',           route: 'Schedule' },
  { icon: 'folder-lock',             label: 'Coffre-fort',            route: 'DigitalVault',         requires: 'digitalVault' },
  { icon: 'cash-multiple',           label: 'Bulletins de paie',      route: 'DigitalVault',         requires: 'digitalVault' },
  { icon: 'calendar-star',           label: 'Jours fériés',           route: 'Holidays' },
  { icon: 'scale-balance',           label: 'Assistant juridique',    route: 'ChatRag',              requires: 'ragAi' },
  { icon: 'view-dashboard',          label: 'Tableau de bord équipe', route: 'ManagerDashboard',     managerOnly: true, requires: 'advancedDashboards' },
  { icon: 'calendar-check-outline',  label: 'Valider congés',         route: 'LeaveApproval',        managerOnly: true, requires: 'leaveManagement' },
  { icon: 'exit-run',                label: 'Valider autorisations',  route: 'AuthorizationApproval',managerOnly: true, requires: 'authorizationManagement' },
  { icon: 'receipt-text-check-outline', label: 'Valider notes de frais', route: 'ExpenseApproval',  managerOnly: true, requires: 'expenseReports' },
  { icon: 'briefcase-check-outline', label: 'Valider missions',       route: 'MissionApproval',      managerOnly: true, requires: 'missions' },
  { icon: 'account-group-outline',   label: 'Mes collaborateurs',     route: 'EmployeeList',         managerOnly: true },
  { icon: 'calendar-today',          label: 'Pointage du jour',       route: 'DailyPointage',        managerOnly: true },
];

const LOGOUT_ITEM: MenuItem = { icon: 'logout', label: 'Déconnexion', action: 'logout', color: COLORS.error };

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

  const onItemPress = (item: MenuItem) => {
    onClose();
    if (item.action === 'logout') {
      Alert.alert('🔐 Déconnexion', 'Voulez-vous vous déconnecter ?', [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Déconnexion', style: 'destructive', onPress: logout },
      ]);
      return;
    }
    if (item.route) {
      // setTimeout pour laisser le modal se fermer avant la navigation —
      // évite un flash visuel sur certains Android.
      const params = item.route === 'DigitalVault' && item.label.toLowerCase().includes('bulletin')
        ? { category: 'bulletin' }
        : undefined;
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
              <Text style={styles.userName} numberOfLines={1}>{user?.utilib || 'Utilisateur'}</Text>
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
                <Text style={styles.itemLabel}>{it.label}</Text>
                <MaterialCommunityIcons name="chevron-right" size={18} color={COLORS.outlineVariant} />
              </TouchableOpacity>
            ))}

            <View style={styles.divider} />

            <TouchableOpacity style={styles.item} onPress={() => onItemPress(LOGOUT_ITEM)} activeOpacity={0.6}>
              <View style={[styles.itemIconBox, { backgroundColor: COLORS.errorContainer }]}>
                <MaterialCommunityIcons name="logout" size={20} color={COLORS.error} />
              </View>
              <Text style={[styles.itemLabel, { color: COLORS.error }]}>Déconnexion</Text>
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
