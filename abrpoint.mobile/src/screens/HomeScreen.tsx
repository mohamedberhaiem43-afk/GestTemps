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
import { resolveAssetUrl } from '../config/assetUrl';
import BottomTabBar, { useTabBarPadding } from '../components/BottomTabBar';
import MainMenuDrawer from '../components/MainMenuDrawer';
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

interface RttKpi {
  methode: string; // 'N' | 'M' | 'H' | 'F'
  droitAnnuel: number;
  pris: number;
  solde: number;
}

interface KPISummary {
  soldeConge: number;
  congeAcquis: number;
  heuresTravailleesSemaine: number;
  demandesEnAttente: number;
  pourcentageObjectif: number;
  rtt: RttKpi | null;
}

interface VaultDoc {
  id: number;
  titre: string;
  dateAjout: string;
  type: string;
}

export default function HomeScreen({ navigation }: any) {
  const { user, logout, isEmployee, isAdmin, isManager } = useAuth();
  const tabBarPadding = useTabBarPadding();
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
  const [menuOpen, setMenuOpen] = useState(false);

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
          // Le backend ne renvoie `rtt` que si l'employé est éligible (méthode ≠ 'N').
          rtt: data.rtt
            ? {
                methode: data.rtt.methode,
                droitAnnuel: data.rtt.droitAnnuel || 0,
                pris: data.rtt.pris || 0,
                solde: data.rtt.solde || 0,
              }
            : null,
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
      // Refresh à la fois le statut du jour ET les KPIs (heures travaillées,
      // % objectif) pour que la home reflète immédiatement le nouveau pointage.
      await Promise.all([loadTodayStatus(), loadKPISummary()]);
      const gpsHint = gps.status === 'granted'
        ? `📍 Position enregistrée (±${Math.round(gps.coords?.accuracy || 0)}m)`
        : gps.status === 'blocked' || gps.status === 'denied'
        ? '⚠️ Position non autorisée — activez la localisation dans les réglages'
        : '⚠️ Position indisponible — pointage validé sans GPS';
      Alert.alert('✅ Pointage enregistré', gpsHint);
    } catch (error: any) {
      // Le backend renvoie 422 avec {message, code} pour les pointages hors
      // période d'emploi (avant Empemb / après Empsort) ou hors zone GPS.
      // 400 = données invalides côté serveur (ex: Soccod/Empcod inconnu).
      // 401 = session expirée. Sinon : on affiche le message serveur ou
      // un fallback générique avec le code d'erreur pour faciliter le debug.
      const status = error?.response?.status;
      const serverMsg = error?.response?.data?.message || error?.response?.data?.title;
      const text = serverMsg
        ?? (status === 401
          ? 'Session expirée, veuillez vous reconnecter.'
          : status === 403
          ? "Vous n'êtes pas autorisé à pointer pour cet utilisateur."
          : status
          ? `Impossible de pointer (erreur ${status}).`
          : 'Impossible de pointer — vérifiez votre connexion réseau.');
      Alert.alert('Pointage refusé', text);
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
          <TouchableOpacity style={styles.iconButton} onPress={() => setMenuOpen(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialCommunityIcons name="menu" size={24} color={COLORS.primaryContainer} />
          </TouchableOpacity>
          <Image source={require('../../assets/Concorde.png')} style={styles.logoImage} resizeMode="contain" />
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
            {(() => {
              // Avatar du header : photo persistée du user, fallback initiales
              // colorées (gradient bleu) si pas encore d'image. Le fallback a
              // exactement les mêmes dimensions pour ne pas changer le layout.
              const avatarUri = resolveAssetUrl(user?.utiimg);
              if (avatarUri) {
                return <Image source={{ uri: avatarUri }} style={styles.profileImage} />;
              }
              const initials = (user?.utilib || '?').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
              return (
                <View style={[styles.profileImage, { backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{initials}</Text>
                </View>
              );
            })()}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <Text style={styles.dateLabel}>{formatDate(currentTime).toUpperCase()}</Text>
          <Text style={styles.welcomeTitle}>Bonjour, {user?.utilib?.split(' ')[0] || 'Marc'}.</Text>
        </View>

        {/* CTA manager : raccourci vers le tableau de bord d'équipe — visible
            uniquement si l'utilisateur a un rôle manager/admin (pas pour
            l'employé standard qui n'a rien à valider). */}
        {(isAdmin || isManager) && (
          <TouchableOpacity
            style={styles.managerCta}
            activeOpacity={0.9}
            onPress={() => navigation.navigate('ManagerDashboard')}
          >
            <LinearGradient
              colors={[COLORS.primary, COLORS.primaryContainer]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.managerCtaInner}
            >
              <View style={styles.managerCtaIcon}>
                <MaterialCommunityIcons name="view-dashboard-outline" size={20} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.managerCtaTitle}>Tableau de bord équipe</Text>
                <Text style={styles.managerCtaSub}>Validations, contrats, absences du jour</Text>
              </View>
              <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        )}

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
                  ? 'Pointer la sortie'
                  : todayStatus.hasEntry && todayStatus.hasExit
                  ? 'Reprendre le pointage'
                  : "Pointer l'entrée"}
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
            onPress={() => navigation.navigate('Missions')}
          >
            <View style={[styles.quickIconBox, { backgroundColor: '#ede9fe' }]}>
              <MaterialCommunityIcons name="briefcase-outline" size={22} color="#6d28d9" />
            </View>
            <Text style={styles.quickLabel}>Missions</Text>
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

          {/* Raccourci direct "Bulletin de paie" : ouvre le coffre déjà filtré
               sur la catégorie 'bulletin' (équivalent du `#payslips` du web). */}
          <TouchableOpacity
            style={styles.quickAction}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('DigitalVault', { category: 'bulletin' })}
          >
            <View style={[styles.quickIconBox, { backgroundColor: '#fef3c7' }]}>
              <MaterialCommunityIcons name="cash-multiple" size={22} color="#92400e" />
            </View>
            <Text style={styles.quickLabel}>Bulletin</Text>
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

        {/* Carte RTT — affichée uniquement si l'employé est éligible (méthode ≠ 'N'
            côté backend). Style aligné sur la carte solde CP de LeaveRequestScreen. */}
        {kpiSummary?.rtt && (
          <TouchableOpacity
            style={styles.rttCard}
            onPress={() => navigation.navigate('LeaveRequest')}
            activeOpacity={0.85}
          >
            <View style={styles.rttIconWrap}>
              <MaterialCommunityIcons name="briefcase-clock-outline" size={24} color="#10b981" />
            </View>
            <View style={styles.rttContent}>
              <Text style={styles.rttLabel}>SOLDE RTT</Text>
              <View style={styles.rttValueRow}>
                <Text style={styles.rttValue}>{kpiSummary.rtt.solde.toFixed(1)}</Text>
                <Text style={styles.rttUnit}>j</Text>
                <Text style={styles.rttSub}>
                  {`· sur ${kpiSummary.rtt.droitAnnuel.toFixed(1)} acquis`}
                </Text>
              </View>
              <View style={styles.rttProgressBar}>
                <View
                  style={[
                    styles.rttProgressFill,
                    {
                      width: `${
                        kpiSummary.rtt.droitAnnuel > 0
                          ? Math.min(100, (kpiSummary.rtt.pris / kpiSummary.rtt.droitAnnuel) * 100)
                          : 0
                      }%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.rttFooter}>{kpiSummary.rtt.pris.toFixed(1)} j pris cette année</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color="#10b981" />
          </TouchableOpacity>
        )}

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

      {/* FAB Assistant RH (chat RAG sur les documents juridiques du tenant) */}
      <TouchableOpacity
        style={[styles.ragFab, { bottom: tabBarPadding - 8 }]}
        onPress={() => navigation.navigate('ChatRag')}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={['#7c3aed', '#5b21b6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.ragFabGradient}
        >
          <MaterialCommunityIcons name="scale-balance" size={26} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

      <BottomTabBar active="home" navigation={navigation} />

      <MainMenuDrawer visible={menuOpen} onClose={() => setMenuOpen(false)} navigation={navigation} />
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
  logoImage: { width: 110, height: 32 },
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
  managerCta: {
    marginBottom: 18,
    borderRadius: 14,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 10, elevation: 3,
  },
  managerCtaInner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 14,
  },
  managerCtaIcon: {
    width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center',
  },
  managerCtaTitle: { fontSize: 14, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },
  managerCtaSub: { fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: '500', marginTop: 2 },
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
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  // basis: '22%' → 4 items par ligne avec ~12px d'espacement, le 7e passe à la
  // ligne suivante (Coffre / Bulletin / Fériés). Évite l'écrasement quand on a
  // ajouté le raccourci "Bulletin de paie".
  quickAction: {
    flexBasis: '22%',
    flexGrow: 1,
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
  rttCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: '#10b981',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  rttIconWrap: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  rttContent: { flex: 1, gap: 4 },
  rttLabel: { fontSize: 9, fontWeight: '800', color: '#065f46', letterSpacing: 1 },
  rttValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  rttValue: { fontSize: 26, fontWeight: '900', color: '#065f46', letterSpacing: -0.5 },
  rttUnit: { fontSize: 12, fontWeight: '700', color: '#10b981' },
  rttSub: { fontSize: 10, fontWeight: '600', color: COLORS.outline, marginLeft: 4 },
  rttProgressBar: {
    height: 4, backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderRadius: 2, overflow: 'hidden', marginTop: 4,
  },
  rttProgressFill: { height: '100%', backgroundColor: '#10b981', borderRadius: 2 },
  rttFooter: { fontSize: 10, color: COLORS.outline, fontWeight: '600', marginTop: 2 },
  ragFab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#5b21b6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  ragFabGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

