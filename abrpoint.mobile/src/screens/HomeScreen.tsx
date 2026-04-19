import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  RefreshControl, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import { COLORS } from '../config/env';

interface TodayStatus {
  hasEntry: boolean;
  hasExit: boolean;
  entryTime?: string;
  exitTime?: string;
  isRepos?: boolean;
}

interface EntryReminder {
  shouldRemind: boolean;
  poste: string;
  heureEntree?: string;
  hasMarkedEntry: boolean;
  isRepos: boolean;
  isConge: boolean;
  isFerie: boolean;
  message: string;
}

interface KPISummary {
  soldeConge: number;
  congeAcquis: number;
  heuresTravailleesSemaine: number;
  demandesEnAttente: number;
  pourcentageObjectif: number;
}

export default function HomeScreen({ navigation }: any) {
  const { user, logout, isEmployee, isAdmin, isManager } = useAuth();
  const [todayStatus, setTodayStatus] = useState<TodayStatus>({ hasEntry: false, hasExit: false });
  const [entryReminder, setEntryReminder] = useState<EntryReminder | null>(null);
  const [kpiSummary, setKpiSummary] = useState<KPISummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (user?.soccod && user?.uticod) {
      loadTodayStatus();
      loadKPISummary();
      if (isEmployee) loadEntryReminder();
    }
  }, [user]);

  const loadEntryReminder = async () => {
    if (!user?.soccod || !user?.uticod) return;
    try {
      const data = await apiService.getEntryReminder(user.soccod, user.uticod);
      if (data) setEntryReminder(data);
    } catch (error) {
      console.log('Failed to load entry reminder:', error);
    }
  };

  const loadTodayStatus = async () => {
    if (!user?.soccod || !user?.uticod) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      const data = await apiService.getMyPresenceByDate(user.soccod, user.uticod, today, today);
      if (data && data.length > 0) {
        const p = data[0];
        const isRepos = p.prerepos === true || p.prerepos === 'True' || p.prerepos === 'true' || p.prerepos === '1';
        setTodayStatus({
          hasEntry: isRepos || !!(p.preentmatup || p.preentamidiup),
          hasExit: !!(p.presortmatup || p.presortamidiup),
          entryTime: p.preentmatup || p.preentamidiup || undefined,
          exitTime: p.presortmatup || p.presortamidiup || undefined,
          isRepos,
        });
      }
    } catch (error) {
      console.log('Failed to load today status:', error);
    }
  };

  const loadKPISummary = async () => {
    if (!user?.soccod || !user?.uticod) return;
    try {
      const data = await apiService.getMyKPIs(user.soccod, user.uticod);
      if (data) {
        setKpiSummary({
          soldeConge: data.soldeConge || 0,
          congeAcquis: data.congeAcquis || 0,
          heuresTravailleesSemaine: data.heuresTravailleesSemaine || 0,
          demandesEnAttente: data.demandesEnAttente || 0,
          pourcentageObjectif: data.pourcentageObjectif || 0,
        });
      }
    } catch (error) {
      console.log('Failed to load KPI summary:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    const promises: Promise<any>[] = [loadTodayStatus(), loadKPISummary()];
    if (isEmployee) promises.push(loadEntryReminder());
    await Promise.all(promises);
    setRefreshing(false);
  };

  const handlePointer = async () => {
    if (!user?.soccod || !user?.uticod) return;
    try {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const result = await apiService.markPresence(user.soccod, user.uticod);
      
      // Update status based on result - the backend handles entry/exit logic
      const hasEntry = !!(result?.preentmatup || result?.preentamidiup);
      const hasExit = !!(result?.presortmatup || result?.presortamidiup);
      
      setTodayStatus({
        hasEntry: hasEntry || todayStatus.hasEntry,
        hasExit: hasExit || todayStatus.hasExit,
        entryTime: result?.preentmatup || result?.preentamidiup || todayStatus.entryTime || timeStr,
        exitTime: result?.presortmatup || result?.presortamidiup || todayStatus.exitTime,
        isRepos: todayStatus.isRepos,
      });
      
      const msg = result?.presortmatup || result?.presortamidiup
        ? `Sortie marquée à ${result.presortmatup || result.presortamidiup || timeStr}`
        : result?.preentmatup || result?.preentamidiup
          ? `Entrée marquée à ${result.preentmatup || result.preentamidiup || timeStr}`
          : `Pointage enregistré à ${timeStr}`;
      
      Alert.alert('✅ Succès', msg);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de pointer');
    }
  };

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnexion', style: 'destructive', onPress: logout },
    ]);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  const greeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon après-midi';
    return 'Bonsoir';
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{greeting()},</Text>
            <Text style={styles.userName}>{user?.utilib || 'Utilisateur'}</Text>
            {user?.soclib && <Text style={styles.companyName}>{user.soclib}</Text>}
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.avatarBtn}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(user?.utilib || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Clock */}
        <View style={styles.clockCard}>
          <Text style={styles.clockTime}>{formatTime(currentTime)}</Text>
          <Text style={styles.clockDate}>{formatDate(currentTime)}</Text>
        </View>

        {/* Entry Reminder Notification */}
        {isEmployee && entryReminder && entryReminder.shouldRemind && (
          <TouchableOpacity
            style={styles.reminderBanner}
            onPress={handlePointer}
            activeOpacity={0.8}
          >
            <Text style={styles.reminderIcon}>⏰</Text>
            <View style={styles.reminderContent}>
              <Text style={styles.reminderTitle}>Rappel de pointage</Text>
              <Text style={styles.reminderMessage}>{entryReminder.message}</Text>
              {entryReminder.poste ? (
                <Text style={styles.reminderPoste}>Poste: {entryReminder.poste}</Text>
              ) : null}
            </View>
            <Text style={styles.reminderAction}>Pointer →</Text>
          </TouchableOpacity>
        )}

        {/* KPI Summary Cards */}
        {isEmployee && kpiSummary && (
          <TouchableOpacity onPress={() => navigation.navigate('Dashboard')} activeOpacity={0.7}>
            <View style={styles.kpiRow}>
              <View style={styles.kpiMiniCard}>
                <Text style={styles.kpiMiniIcon}>🏖️</Text>
                <Text style={styles.kpiMiniValue}>{kpiSummary.soldeConge.toFixed(1)}</Text>
                <Text style={styles.kpiMiniLabel}>Congés restants</Text>
              </View>
              <View style={styles.kpiMiniCard}>
                <Text style={styles.kpiMiniIcon}>⏱️</Text>
                <Text style={styles.kpiMiniValue}>{kpiSummary.heuresTravailleesSemaine.toFixed(1)}h</Text>
                <Text style={styles.kpiMiniLabel}>Cette semaine</Text>
              </View>
              <View style={styles.kpiMiniCard}>
                <Text style={styles.kpiMiniIcon}>⏳</Text>
                <Text style={styles.kpiMiniValue}>{kpiSummary.demandesEnAttente}</Text>
                <Text style={styles.kpiMiniLabel}>En attente</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* Presence Actions */}
        {isEmployee && (
          <View style={styles.presenceSection}>
            <Text style={styles.sectionTitle}>🕐 Pointage du jour</Text>
            {todayStatus.isRepos ? (
              <View style={[styles.pointerBtn, { backgroundColor: '#8b5cf6' }]}>
                <Text style={styles.pointerBtnIcon}>🔨</Text>
                <Text style={styles.pointerBtnText}>Repos Travaillé</Text>
              </View>
            ) : todayStatus.hasEntry && todayStatus.hasExit ? (
              <View style={[styles.pointerBtn, styles.pointerBtnDone]}>
                <Text style={styles.pointerBtnIcon}>✅</Text>
                <Text style={styles.pointerBtnText}>
                  Complet: {todayStatus.entryTime} → {todayStatus.exitTime}
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.pointerBtn, todayStatus.hasEntry && { backgroundColor: '#f59e0b' }]}
                onPress={handlePointer}
                activeOpacity={0.7}
              >
                <Text style={styles.pointerBtnIcon}>
                  {todayStatus.hasEntry ? '📤' : '📥'}
                </Text>
                <Text style={styles.pointerBtnText}>
                  {todayStatus.hasEntry
                    ? `Entrée: ${todayStatus.entryTime} • Pointer Sortie`
                    : '📍 Pointer'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Quick Actions Grid */}
        <Text style={styles.sectionTitle}>⚡ Accès rapide</Text>
        <View style={styles.grid}>
          {isEmployee && (
            <>
              <TouchableOpacity style={styles.gridItem} onPress={() => navigation.navigate('Dashboard')}>
                <Text style={styles.gridIcon}>📊</Text>
                <Text style={styles.gridLabel}>Tableau{'\n'}de Bord</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.gridItem} onPress={() => navigation.navigate('PresenceHistory')}>
                <Text style={styles.gridIcon}>📅</Text>
                <Text style={styles.gridLabel}>Historique{'\n'}Présence</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.gridItem} onPress={() => navigation.navigate('LeaveRequest')}>
                <Text style={styles.gridIcon}>🏖️</Text>
                <Text style={styles.gridLabel}>Demande{'\n'}de Congé</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.gridItem} onPress={() => navigation.navigate('Expense')}>
                <Text style={styles.gridIcon}>💰</Text>
                <Text style={styles.gridLabel}>Notes{'\n'}de Frais</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.gridItem} onPress={() => navigation.navigate('Balance')}>
                <Text style={styles.gridIcon}>📋</Text>
                <Text style={styles.gridLabel}>Solde{'\n'}Congés</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.gridItem} onPress={() => navigation.navigate('DigitalVault')}>
                <Text style={styles.gridIcon}>📁</Text>
                <Text style={styles.gridLabel}>Coffre{'\n'}Numérique</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.gridItem} onPress={() => navigation.navigate('Authorization')}>
            <Text style={styles.gridIcon}>🚪</Text>
            <Text style={styles.gridLabel}>Autorisation{'\n'}de Sortie</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.gridItem} onPress={() => navigation.navigate('DemandeAutorisation')}>
            <Text style={styles.gridIcon}>📋</Text>
            <Text style={styles.gridLabel}>Demande{'\n'}d'Autorisation</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.gridItem} onPress={() => navigation.navigate('Profile')}>
            <Text style={styles.gridIcon}>👤</Text>
            <Text style={styles.gridLabel}>Mon{'\n'}Profil</Text>
          </TouchableOpacity>

          {(isAdmin || isManager) && (
            <>
              <TouchableOpacity
                style={[styles.gridItem, { backgroundColor: '#e3f2fd' }]}
                onPress={() => navigation.navigate('DailyPointage')}
              >
                <Text style={styles.gridIcon}>📋</Text>
                <Text style={styles.gridLabel}>Pointage{'\n'}du Jour</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.gridItem, { backgroundColor: '#f3e5f5' }]}
                onPress={() => navigation.navigate('EmployeeList')}
              >
                <Text style={styles.gridIcon}>👥</Text>
                <Text style={styles.gridLabel}>Gestion{'\n'}Employés</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.gridItem, { backgroundColor: '#fce4ec' }]}
                onPress={() => navigation.navigate('LeaveApproval')}
              >
                <Text style={styles.gridIcon}>✅</Text>
                <Text style={styles.gridLabel}>Approbation{'\n'}Congés</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.gridItem, { backgroundColor: '#e8f5e9' }]}
                onPress={() => navigation.navigate('ExpenseApproval')}
              >
                <Text style={styles.gridIcon}>💰</Text>
                <Text style={styles.gridLabel}>Approbation{'\n'}Frais</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>🚪 Se Déconnecter</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: 16, paddingBottom: 40 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
  },
  greeting: { fontSize: 14, color: COLORS.textSecondary },
  userName: { fontSize: 24, fontWeight: 'bold', color: COLORS.text },
  companyName: { fontSize: 12, color: COLORS.primary, marginTop: 2 },
  avatarBtn: { padding: 4 },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center', elevation: 3,
  },
  avatarText: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  clockCard: {
    backgroundColor: COLORS.primary, borderRadius: 16, padding: 20,
    alignItems: 'center', marginBottom: 16, elevation: 4,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8,
  },
  clockTime: { fontSize: 40, fontWeight: 'bold', color: '#fff', letterSpacing: 2 },
  clockDate: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4, textAlign: 'center' },
  kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  kpiMiniCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 12,
    alignItems: 'center', elevation: 2, shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3,
  },
  kpiMiniIcon: { fontSize: 20, marginBottom: 4 },
  kpiMiniValue: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  kpiMiniLabel: { fontSize: 10, color: COLORS.textSecondary, marginTop: 2, textAlign: 'center' },
  presenceSection: { marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginBottom: 12 },
  pointerBtn: {
    flexDirection: 'row', backgroundColor: COLORS.secondary, borderRadius: 12, padding: 18,
    alignItems: 'center', justifyContent: 'center', elevation: 3, gap: 10,
  },
  pointerBtnDone: { backgroundColor: COLORS.success },
  pointerBtnIcon: { fontSize: 24 },
  pointerBtnText: { color: '#fff', fontSize: 15, fontWeight: '700', textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  gridItem: {
    width: '31%', backgroundColor: '#fff', borderRadius: 12, padding: 14,
    alignItems: 'center', elevation: 2, shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2,
  },
  gridIcon: { fontSize: 28, marginBottom: 4 },
  gridLabel: { fontSize: 11, color: COLORS.text, textAlign: 'center', fontWeight: '500', lineHeight: 15 },
  reminderBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff3cd',
    borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#ffc107',
    elevation: 3, shadowColor: '#ffc107', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4,
  },
  reminderIcon: { fontSize: 32, marginRight: 12 },
  reminderContent: { flex: 1 },
  reminderTitle: { fontSize: 14, fontWeight: 'bold', color: '#856404' },
  reminderMessage: { fontSize: 12, color: '#856404', marginTop: 2 },
  reminderPoste: { fontSize: 11, color: '#6c5a0e', marginTop: 2, fontStyle: 'italic' },
  reminderAction: { fontSize: 13, fontWeight: '700', color: '#d97706', marginLeft: 8 },
  logoutBtn: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center',
    marginTop: 24, borderWidth: 1, borderColor: COLORS.border,
  },
  logoutText: { color: COLORS.error, fontSize: 15, fontWeight: '600' },
});
