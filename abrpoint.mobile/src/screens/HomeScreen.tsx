import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  RefreshControl, Alert, ActivityIndicator, Image, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import { COLORS, THEME } from '../config/env';

const { width } = Dimensions.get('window');

interface TodayStatus {
  hasEntry: boolean;
  hasExit: boolean;
  entryTime?: string;
  exitTime?: string;
  isRepos?: boolean;
}

interface KPISummary {
  soldeConge: number;
  congeAcquis: number;
  heuresTravailleesSemaine: number;
  demandesEnAttente: number;
  pourcentageObjectif: number;
}

interface VaultDoc {
  id: number;
  titre: string;
  dateAjout: string;
  type: string;
}

export default function HomeScreen({ navigation }: any) {
  const { user, logout, isEmployee, isAdmin, isManager } = useAuth();
  const [todayStatus, setTodayStatus] = useState<TodayStatus>({ hasEntry: false, hasExit: false });
  const [kpiSummary, setKpiSummary] = useState<KPISummary | null>(null);
  const [recentDocs, setRecentDocs] = useState<VaultDoc[]>([]);
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
      loadRecentDocs();
    }
  }, [user]);

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

  const loadRecentDocs = async () => {
    if (!user?.soccod || !user?.uticod) return;
    try {
      const data = await apiService.getMyPresence(user.soccod, user.uticod); // Mocking vault for now or use actual service if available
      // In a real app, you'd call apiService.getVaultDocuments
      // For now let's set some mock recent docs if service not ready
      setRecentDocs([
        { id: 1, titre: 'Fiche de paie - Avril 2024', dateAjout: 'Il y a 2 jours', type: 'PDF' }
      ]);
    } catch (error) {
      console.log('Failed to load recent docs:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadTodayStatus(), loadKPISummary(), loadRecentDocs()]);
    setRefreshing(false);
  };

  const handlePointer = async () => {
    if (!user?.soccod || !user?.uticod) return;
    try {
      const result = await apiService.markPresence(user.soccod, user.uticod);
      loadTodayStatus();
      Alert.alert('✅ Succès', 'Pointage enregistré avec succès');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de pointer');
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* TopAppBar */}
      <View style={styles.topAppBar}>
        <View style={styles.topAppLeft}>
          <TouchableOpacity style={styles.iconButton}>
            <MaterialCommunityIcons name="menu" size={24} color={COLORS.primaryContainer} />
          </TouchableOpacity>
          <Text style={styles.logoText}>LEDGER HR</Text>
        </View>
        <View style={styles.topAppRight}>
          <View style={styles.notificationWrapper}>
            <MaterialCommunityIcons name="bell-outline" size={24} color="#64748b" />
            <View style={styles.notificationDot} />
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')}>
            <Image
              source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAvAHpecvSxPFvNp0WiI32s75TOod9EfS859bgnvDcccilKQKfh5e4vMEDD_wO5dwMGzL0B245pIvD5_NADth7meBVNm-mUMMdQzjBtVtqk70SJNnincuv9kgEgFrl3janzeg5qQFmI_fw3E2OvZyQtwz1SpezTqNCPETmq0ZFbHMPK_VyHzFU6tN4Qs8HfCcZR5u7UW-q8N8Zfax8VOae0-wTo5oF8FyhJrjkBQaHdAuD5uHwFuKukdgOSGr4-aeJHLOySXd_KA80' }}
              style={styles.profileImage}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <Text style={styles.dateLabel}>{formatDate(currentTime).toUpperCase()}</Text>
          <Text style={styles.welcomeTitle}>Bonjour, {user?.utilib?.split(' ')[0] || 'Marc'}.</Text>
        </View>

        {/* Punch-in/out Glass Card */}
        <View style={styles.punchCard}>
          <View style={styles.gpsStatus}>
            <View style={styles.gpsDot} />
            <Text style={styles.gpsLabel}>STATUT GPS VALIDÉ</Text>
          </View>
          <Text style={styles.currentTimeText}>{formatTime(currentTime)}</Text>
          <Text style={styles.serverTimeLabel}>Heure du serveur de Paris</Text>
          
          <TouchableOpacity 
            style={styles.pointerButton} 
            onPress={handlePointer}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[COLORS.primary, COLORS.primaryContainer]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.pointerGradient}
            >
              <MaterialCommunityIcons name="fingerprint" size={24} color="#fff" />
              <Text style={styles.pointerButtonText}>
                {todayStatus.hasEntry && !todayStatus.hasExit ? 'Pointer la Sortie' : 'Pointer l\'Entrée'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
          <Text style={styles.lastExitLabel}>
            {todayStatus.hasEntry ? `Entrée à ${todayStatus.entryTime}` : 'Dernière sortie : Ven. 18:05'}
          </Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          {/* Vacation Balance */}
          <View style={styles.vacationCard}>
            <View style={styles.cardHeader}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons name="calendar-blank" size={20} color={COLORS.primary} />
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>1 DEMANDE</Text>
              </View>
            </View>
            <Text style={styles.statLabel}>SOLDE CONGÉS</Text>
            <View style={styles.statValueRow}>
              <Text style={styles.statValue}>{kpiSummary?.soldeConge?.toFixed(1) || '18'}</Text>
              <Text style={styles.statUnit}>Jours</Text>
            </View>
          </View>

          {/* Weekly Hours */}
          <View style={styles.hoursCard}>
            <MaterialCommunityIcons name="clock-outline" size={20} color={COLORS.primaryContainer} />
            <Text style={[styles.statLabel, { color: '#cbd5e1', marginTop: 12 }]}>SEMAINE</Text>
            <View style={styles.statValueRow}>
              <Text style={[styles.statValue, { color: '#fff' }]}>
                {kpiSummary?.heuresTravailleesSemaine?.toFixed(1) || '32.5'}
              </Text>
              <Text style={[styles.statUnit, { color: '#64748b' }]}>H</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${kpiSummary?.pourcentageObjectif || 85}%` }]} />
            </View>
          </View>
        </View>

        {/* Attendance Graph Section */}
        <View style={styles.attendanceSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Présence Hebdo</Text>
            <TouchableOpacity onPress={() => navigation.navigate('PresenceHistory')}>
              <Text style={styles.seeDetail}>VOIR DÉTAIL</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.graphContainer}>
            {['L', 'M', 'M', 'J', 'V'].map((day, i) => (
              <View key={i} style={styles.graphBarWrapper}>
                <View style={styles.graphBarBackground}>
                  <View style={[styles.graphBarFill, { height: `${[100, 85, 90, 95, 0][i]}%` }]} />
                </View>
                <Text style={[styles.graphDayLabel, i === 3 && { color: COLORS.primary }]}>{day}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Vault Preview */}
        <View style={styles.vaultSection}>
          <View style={styles.vaultHeader}>
            <MaterialCommunityIcons name="folder-account-outline" size={18} color={COLORS.onSurface} />
            <Text style={styles.vaultTitle}>Coffre-fort récent</Text>
          </View>
          
          {recentDocs.map((doc) => (
            <TouchableOpacity 
              key={doc.id} 
              style={styles.vaultItem}
              onPress={() => navigation.navigate('DigitalVault')}
            >
              <View style={styles.vaultIconContainer}>
                <MaterialCommunityIcons name="file-pdf-box" size={24} color={COLORS.error} />
              </View>
              <View style={styles.vaultItemContent}>
                <Text style={styles.vaultItemTitle}>{doc.titre}</Text>
                <Text style={styles.vaultItemSubtitle}>{doc.dateAjout.toUpperCase()}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color="#cbd5e1" />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* BottomNavBar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => {}}>
          <MaterialCommunityIcons name="view-dashboard" size={24} color={COLORS.primaryContainer} />
          <Text style={[styles.navLabel, { color: COLORS.primaryContainer }]}>DASHBOARD</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('LeaveRequest')}>
          <MaterialCommunityIcons name="calendar-month-outline" size={24} color="#94a3b8" />
          <Text style={styles.navLabel}>LEAVES</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('DigitalVault')}>
          <MaterialCommunityIcons name="folder-account-outline" size={24} color="#94a3b8" />
          <Text style={styles.navLabel}>VAULT</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Authorization')}>
          <MaterialCommunityIcons name="draw-pen" size={24} color="#94a3b8" />
          <Text style={styles.navLabel}>SIGN</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topAppBar: {
    height: 64, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, backgroundColor: COLORS.background,
  },
  topAppLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  logoText: { fontFamily: 'Manrope', fontWeight: '900', fontSize: 18, color: COLORS.primary, letterSpacing: 2 },
  topAppRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  notificationWrapper: { position: 'relative' },
  notificationDot: { position: 'absolute', top: 0, right: 0, width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.error },
  profileImage: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: '#fff' },
  scrollContent: { padding: 20, paddingBottom: 100 },
  welcomeSection: { marginBottom: 24 },
  dateLabel: { fontSize: 10, fontWeight: '700', color: '#64748b', letterSpacing: 1.2 },
  welcomeTitle: { fontSize: 32, fontWeight: '800', color: COLORS.onSurface, marginTop: 4 },
  punchCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)', borderRadius: 40, padding: 32,
    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.5)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.05, shadowRadius: 20,
    marginBottom: 32,
  },
  gpsStatus: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  gpsDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4edea3' },
  gpsLabel: { fontSize: 10, fontWeight: '700', color: '#005236', letterSpacing: 1 },
  currentTimeText: { fontSize: 48, fontWeight: '800', color: COLORS.primary, letterSpacing: -1 },
  serverTimeLabel: { fontSize: 12, color: '#94a3b8', fontWeight: '500', marginTop: 4 },
  pointerButton: { width: '100%', marginTop: 24, borderRadius: 30, overflow: 'hidden' },
  pointerGradient: { paddingVertical: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  pointerButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  lastExitLabel: { fontSize: 11, color: '#94a3b8', marginTop: 16 },
  statsGrid: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  vacationCard: {
    flex: 3, backgroundColor: '#fff', borderRadius: 16, padding: 20,
    borderBottomWidth: 2, borderBottomColor: 'rgba(0, 64, 161, 0.1)',
  },
  hoursCard: { flex: 2, backgroundColor: COLORS.onSurface, borderRadius: 16, padding: 20 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  iconContainer: { padding: 8, backgroundColor: '#dae2ff', borderRadius: 8 },
  badge: { backgroundColor: 'rgba(0, 108, 73, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 9, fontWeight: '800', color: '#005236' },
  statLabel: { fontSize: 9, fontWeight: '800', color: '#64748b', letterSpacing: 1 },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 },
  statValue: { fontSize: 28, fontWeight: '900', color: COLORS.onSurface },
  statUnit: { fontSize: 12, fontWeight: '600', color: '#94a3b8' },
  progressBar: { height: 4, backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 2, marginTop: 12, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#b2c5ff', borderRadius: 2 },
  attendanceSection: { backgroundColor: COLORS.surfaceContainerLow, borderRadius: 16, padding: 20, marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.onSurface },
  seeDetail: { fontSize: 10, fontWeight: '800', color: COLORS.primary, letterSpacing: 0.5 },
  graphContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 100 },
  graphBarWrapper: { alignItems: 'center', gap: 8 },
  graphBarBackground: { width: 8, height: 80, backgroundColor: COLORS.surfaceContainerHighest, borderRadius: 4, justifyContent: 'flex-end' },
  graphBarFill: { width: '100%', backgroundColor: COLORS.primary, borderRadius: 4 },
  graphDayLabel: { fontSize: 10, fontWeight: '700', color: '#94a3b8' },
  vaultSection: { marginBottom: 32 },
  vaultHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  vaultTitle: { fontSize: 14, fontWeight: '800', color: COLORS.onSurface },
  vaultItem: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8,
  },
  vaultIconContainer: { width: 48, height: 48, borderRadius: 12, backgroundColor: 'rgba(186, 26, 26, 0.05)', justifyContent: 'center', alignItems: 'center' },
  vaultItemContent: { flex: 1 },
  vaultItemTitle: { fontSize: 14, fontWeight: '700', color: COLORS.onSurface },
  vaultItemSubtitle: { fontSize: 9, fontWeight: '700', color: '#94a3b8', marginTop: 2 },
  bottomNav: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)', paddingBottom: 20,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  navItem: { alignItems: 'center', gap: 4 },
  navLabel: { fontSize: 9, fontWeight: '700', color: '#94a3b8' },
});

