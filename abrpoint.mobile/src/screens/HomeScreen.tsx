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
import BottomTabBar from '../components/BottomTabBar';
import { withCacheFallback } from '../services/cache';
import { captureCurrentPosition } from '../services/geolocation';

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
  // True quand l'API a échoué et qu'on sert des données cachées en attendant le réseau.
  const [offlineMode, setOfflineMode] = useState(false);
  const [pointing, setPointing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [silentUntil, setSilentUntil] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (user?.soccod && user?.uticod) {
      loadTodayStatus();
      loadKPISummary();
      loadRecentDocs();
      loadUnreadCount();
    }
  }, [user]);

  // Refresh le badge à chaque retour sur le HomeScreen (focus event de React Navigation).
  useEffect(() => {
    const unsub = navigation?.addListener?.('focus', () => {
      if (user?.soccod && user?.uticod) loadUnreadCount();
    });
    return unsub;
  }, [navigation, user]);

  const loadUnreadCount = async () => {
    try {
      const res = await apiService.unreadNotificationsCount();
      setUnreadCount(res?.count ?? 0);
    } catch { /* noop */ }
    try {
      const status = await apiService.getQuietStatus();
      setSilentUntil(status?.silent ? (status.until || '...') : null);
    } catch { /* noop */ }
  };

  const loadTodayStatus = async () => {
    if (!user?.soccod || !user?.uticod) return;
    try {
      const today = new Date().toISOString().split('T')[0];
      // withCacheFallback : sert le dernier snapshot connu si l'API échoue (avion, mauvais réseau).
      const { data, fromCache } = await withCacheFallback(
        `today_${user.soccod}_${user.uticod}_${today}`,
        () => apiService.getMyPresenceByDate(user.soccod!, user.uticod!, today, today)
      );
      if (fromCache) setOfflineMode(true); else setOfflineMode(false);
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
      const { data } = await withCacheFallback(
        `kpis_${user.soccod}_${user.uticod}`,
        () => apiService.getMyKPIs(user.soccod!, user.uticod!)
      );
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
      const data = await apiService.getVaultDocuments(user.soccod, user.uticod);
      const list = Array.isArray(data) ? data : [];
      // On garde les 3 plus récents pour l'aperçu Home.
      const sorted = [...list].sort((a: any, b: any) => {
        const da = new Date(a.dateAjout || a.createdAt || 0).getTime();
        const db = new Date(b.dateAjout || b.createdAt || 0).getTime();
        return db - da;
      }).slice(0, 3);
      setRecentDocs(sorted.map((d: any) => ({
        id: d.id,
        titre: d.titre || d.docType || d.fileName || 'Document',
        dateAjout: formatRelativeDate(d.dateAjout || d.createdAt),
        type: (d.fileName || '').split('.').pop()?.toUpperCase() || 'PDF',
      })));
    } catch (error) {
      console.log('Failed to load recent docs:', error);
      setRecentDocs([]);
    }
  };

  const formatRelativeDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const diffMs = Date.now() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return 'Hier';
    if (diffDays < 7) return `Il y a ${diffDays} jours`;
    if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} sem.`;
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadTodayStatus(), loadKPISummary(), loadRecentDocs()]);
    setRefreshing(false);
  };

  const handlePointer = async () => {
    if (!user?.soccod || !user?.uticod || pointing) return;
    setPointing(true);
    try {
      // Capture GPS en best-effort : on ne bloque pas le pointage si refusé/timeout.
      // Le backend journalise les coords pour l'audit anti-fraude (validation de zone à venir).
      const gps = await captureCurrentPosition(5000);
      await apiService.markPresence(
        user.soccod,
        user.uticod,
        undefined,
        gps.coords ?? undefined
      );
      loadTodayStatus();
      const gpsHint = gps.status === 'granted'
        ? `📍 Position enregistrée (±${Math.round(gps.coords?.accuracy || 0)}m)`
        : gps.status === 'blocked' || gps.status === 'denied'
        ? '⚠️ Position non autorisée — activez la localisation dans les réglages'
        : '⚠️ Position indisponible — pointage validé sans GPS';
      Alert.alert('✅ Pointage enregistré', gpsHint);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de pointer');
    } finally {
      setPointing(false);
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
          <TouchableOpacity
            style={styles.notificationWrapper}
            onPress={() => navigation.navigate('Notifications')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="bell-outline" size={24} color="#64748b" />
            {unreadCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
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

        {/* Offline indicator : visible uniquement quand on sert le cache (réseau KO) */}
        {offlineMode && (
          <View style={styles.offlineBanner}>
            <MaterialCommunityIcons name="cloud-off-outline" size={16} color={COLORS.warning} />
            <Text style={styles.offlineText}>Mode hors-ligne — données du dernier accès</Text>
          </View>
        )}

        {/* Indicateur "actuellement silencieux" : push muets jusqu'à HH:mm */}
        {silentUntil && (
          <TouchableOpacity
            style={styles.silentChip}
            onPress={() => navigation.navigate('NotificationPreferences')}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="bell-sleep-outline" size={14} color="#92400e" />
            <Text style={styles.silentChipText}>
              Notifications silencieuses jusqu'à {silentUntil}
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={14} color="#92400e" />
          </TouchableOpacity>
        )}

        {/* Punch-in/out Glass Card */}
        <View style={styles.punchCard}>
          <View style={styles.gpsStatus}>
            <View style={styles.gpsDot} />
            <Text style={styles.gpsLabel}>STATUT GPS VALIDÉ</Text>
          </View>
          <Text style={styles.currentTimeText}>{formatTime(currentTime)}</Text>
          <Text style={styles.serverTimeLabel}>Heure du serveur de Paris</Text>
          
          <TouchableOpacity
            style={[styles.pointerButton, pointing && { opacity: 0.6 }]}
            onPress={handlePointer}
            disabled={pointing}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[COLORS.primary, COLORS.primaryContainer]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.pointerGradient}
            >
              {pointing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <MaterialCommunityIcons name="fingerprint" size={24} color="#fff" />
              )}
              <Text style={styles.pointerButtonText}>
                {pointing
                  ? 'Localisation en cours...'
                  : todayStatus.hasEntry && !todayStatus.hasExit
                  ? 'Pointer'
                  : "Pointer"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
          <Text style={styles.lastExitLabel}>
            {todayStatus.hasEntry ? `Entrée à ${todayStatus.entryTime}` : 'Dernière sortie : Ven. 18:05'}
          </Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickAction}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('LeaveRequest')}
          >
            <View style={[styles.quickIconBox, { backgroundColor: '#dae2ff' }]}>
              <MaterialCommunityIcons name="calendar-plus" size={22} color={COLORS.primary} />
            </View>
            <Text style={styles.quickLabel}>Congé</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickAction}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('DemandeAutorisation')}
          >
            <View style={[styles.quickIconBox, { backgroundColor: '#d1fadf' }]}>
              <MaterialCommunityIcons name="exit-run" size={22} color={COLORS.tertiary} />
            </View>
            <Text style={styles.quickLabel}>Sortie</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickAction}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Expense')}
          >
            <View style={[styles.quickIconBox, { backgroundColor: '#fff1c2' }]}>
              <MaterialCommunityIcons name="receipt" size={22} color="#92400e" />
            </View>
            <Text style={styles.quickLabel}>Frais</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickAction}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('DigitalVault')}
          >
            <View style={[styles.quickIconBox, { backgroundColor: '#fde2e7' }]}>
              <MaterialCommunityIcons name="folder-lock" size={22} color={COLORS.error} />
            </View>
            <Text style={styles.quickLabel}>Coffre</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickAction}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('Holidays')}
          >
            <View style={[styles.quickIconBox, { backgroundColor: '#e0e7ff' }]}>
              <MaterialCommunityIcons name="calendar-star" size={22} color={COLORS.primary} />
            </View>
            <Text style={styles.quickLabel}>Fériés</Text>
          </TouchableOpacity>
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

      <BottomTabBar active="home" navigation={navigation} />
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
  notificationWrapper: { position: 'relative', padding: 4 },
  notificationBadge: {
    position: 'absolute', top: -2, right: -4,
    minWidth: 16, height: 16, borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: COLORS.error,
    justifyContent: 'center', alignItems: 'center',
  },
  notificationBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },
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
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff7e6',
    borderColor: '#fde2a7',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  offlineText: {
    fontSize: 12,
    color: COLORS.warning,
    fontWeight: '700',
  },
  silentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 16,
  },
  silentChipText: { fontSize: 11, color: '#92400e', fontWeight: '700', flex: 1 },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  quickAction: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  quickIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.onSurface,
    letterSpacing: 0.3,
  },
});

