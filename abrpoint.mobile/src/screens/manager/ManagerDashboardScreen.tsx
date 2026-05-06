import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';
import { COLORS } from '../../config/env';

/**
 * ManagerDashboardScreen — point d'entrée par défaut pour les utilisateurs
 * managers / admins. Affiche les 4 cartes « actions qui demandent mon
 * attention » (validations, contrats à renouveler, équipe en retard) avec
 * une lecture en un coup d'œil.
 *
 * Toutes les valeurs viennent d'un seul endpoint agrégateur léger
 * (cf. ManagerDashboardController.GetSummary côté serveur) → 1 round-trip
 * pour 6 compteurs, optimisé pour la 4G.
 *
 * Compteurs animés : on interpole de la valeur précédente vers la nouvelle
 * sur 700 ms via requestAnimationFrame. Donne un effet « tableau de bord
 * vivant » plutôt qu'un saut sec quand le pull-to-refresh ramène une donnée.
 */

interface ManagerSummary {
  pendingLeaves: number;
  pendingAuth: number;
  pendingExpenses: number;
  pendingMissions: number;
  pendingTotal: number;
  contractsExpiring: number;
  absentToday: number;
}

// Hook compteur animé : équivalent RN du `useCountUp` web. Pas de dépendance
// externe, juste requestAnimationFrame avec ease-out cubic.
function useCountUp(target: number, durationMs = 700): number {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === display && fromRef.current === target) return;
    const startFrom = display;
    fromRef.current = startFrom;
    let startTs: number | null = null;
    const tick = (ts: number) => {
      if (startTs === null) startTs = ts;
      const elapsed = ts - startTs;
      const t = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = startFrom + (target - startFrom) * eased;
      setDisplay(current);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs]);

  return Math.round(display);
}

export default function ManagerDashboardScreen({ navigation }: any) {
  const { user } = useAuth();
  const [summary, setSummary] = useState<ManagerSummary>({
    pendingLeaves: 0,
    pendingAuth: 0,
    pendingExpenses: 0,
    pendingMissions: 0,
    pendingTotal: 0,
    contractsExpiring: 0,
    absentToday: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { load(); }, [user?.soccod]);

  const load = async () => {
    if (!user?.soccod) return;
    try {
      const data = await apiService.getManagerSummary(user.soccod);
      setSummary(data);
    } catch (e) {
      console.log('Manager summary error:', e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const animatedTotal = useCountUp(summary.pendingTotal);
  const animatedExpiring = useCountUp(summary.contractsExpiring);
  const animatedAbsent = useCountUp(summary.absentToday);

  // Détail "ce qui compose le total à valider" : utilisé dans le sous-texte
  // de la première carte et lors de la navigation vers les écrans dédiés.
  const breakdown = [
    { label: 'congés', count: summary.pendingLeaves },
    { label: 'autorisations', count: summary.pendingAuth },
    { label: 'frais', count: summary.pendingExpenses },
    { label: 'missions', count: summary.pendingMissions },
  ].filter(b => b.count > 0);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    );
  }

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Bonjour';
    if (h < 18) return 'Bon après-midi';
    return 'Bonsoir';
  })();
  const firstName = (user?.utilib || '').split(' ')[0] || 'Manager';

  return (
    <SafeAreaView style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.greeting}>{greeting}, {firstName}</Text>
          <Text style={styles.subgreet}>Voici ce qui demande votre attention.</Text>
        </View>
        <TouchableOpacity
          style={styles.profileBtn}
          onPress={() => navigation.navigate('Profile')}
        >
          <MaterialCommunityIcons name="account-circle-outline" size={32} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Carte hero : total des validations */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => {
            // Si le manager a plusieurs types pending, on l'envoie sur le plus gros pile
            // pour minimiser les clics ; sinon directement sur la liste correspondante.
            if (summary.pendingLeaves >= Math.max(summary.pendingAuth, summary.pendingExpenses, summary.pendingMissions)) {
              navigation.navigate('LeaveApproval');
            } else if (summary.pendingMissions >= Math.max(summary.pendingAuth, summary.pendingExpenses)) {
              navigation.navigate('MissionApproval');
            } else if (summary.pendingExpenses >= summary.pendingAuth) {
              navigation.navigate('ExpenseApproval');
            } else {
              navigation.navigate('LeaveApproval');
            }
          }}
        >
          <LinearGradient
            colors={[COLORS.primary, COLORS.primaryContainer]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroIconWrap}>
              <MaterialCommunityIcons name="clipboard-check-multiple-outline" size={26} color="#fff" />
            </View>
            <Text style={styles.heroLabel}>À VALIDER</Text>
            <Text style={styles.heroNumber}>{animatedTotal}</Text>
            <Text style={styles.heroSubtext}>
              {breakdown.length === 0
                ? 'Tout est à jour, bon travail !'
                : breakdown.map(b => `${b.count} ${b.label}`).join(' · ')}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Grille 2x2 : 4 actions principales */}
        <View style={styles.gridRow}>
          <TouchableOpacity
            style={[styles.gridCard, styles.gridCardOrange]}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('LeaveApproval')}
          >
            <MaterialCommunityIcons name="calendar-check-outline" size={22} color="#92400e" />
            <Text style={styles.gridCount}>{summary.pendingLeaves}</Text>
            <Text style={styles.gridLabel}>Congés en attente</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.gridCard, styles.gridCardPurple]}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('MissionApproval')}
          >
            <MaterialCommunityIcons name="briefcase-outline" size={22} color="#6d28d9" />
            <Text style={styles.gridCount}>{summary.pendingMissions}</Text>
            <Text style={styles.gridLabel}>Missions en attente</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.gridRow}>
          <TouchableOpacity
            style={[styles.gridCard, styles.gridCardGreen]}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('ExpenseApproval')}
          >
            <MaterialCommunityIcons name="receipt" size={22} color="#047857" />
            <Text style={styles.gridCount}>{summary.pendingExpenses}</Text>
            <Text style={styles.gridLabel}>Frais à valider</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.gridCard, styles.gridCardBlue]}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('DailyPointage')}
          >
            <MaterialCommunityIcons name="account-clock-outline" size={22} color={COLORS.primary} />
            <Text style={styles.gridCount}>{animatedAbsent}</Text>
            <Text style={styles.gridLabel}>Absents aujourd'hui</Text>
          </TouchableOpacity>
        </View>

        {/* Carte alerte : contrats expirant bientôt */}
        {summary.contractsExpiring > 0 && (
          <TouchableOpacity
            style={styles.alertCard}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('ContractRenewal')}
          >
            <View style={styles.alertIconWrap}>
              <MaterialCommunityIcons name="alert-circle-outline" size={22} color="#b91c1c" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>
                {animatedExpiring} contrat{summary.contractsExpiring > 1 ? 's' : ''} à renouveler
              </Text>
              <Text style={styles.alertSubtitle}>Échéance dans les 30 prochains jours</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color="#b91c1c" />
          </TouchableOpacity>
        )}

        {/* Sections secondaires : raccourcis vers les écrans manager */}
        <Text style={styles.sectionTitle}>Gestion d'équipe</Text>

        <TouchableOpacity
          style={styles.menuItem}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('EmployeeList')}
        >
          <View style={styles.menuIconWrap}>
            <MaterialCommunityIcons name="account-group-outline" size={22} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuTitle}>Mes collaborateurs</Text>
            <Text style={styles.menuSub}>Liste, recherche, ajout</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={COLORS.outline} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('DailyPointage')}
        >
          <View style={styles.menuIconWrap}>
            <MaterialCommunityIcons name="calendar-today" size={22} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuTitle}>Pointage du jour</Text>
            <Text style={styles.menuSub}>Présences, retards, absences</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={COLORS.outline} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('Home')}
        >
          <View style={styles.menuIconWrap}>
            <MaterialCommunityIcons name="view-dashboard-outline" size={22} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuTitle}>Mon espace personnel</Text>
            <Text style={styles.menuSub}>Mon pointage, mes demandes</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={COLORS.outline} />
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topBar: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, backgroundColor: COLORS.background,
  },
  greeting: { fontSize: 22, fontWeight: '800', color: COLORS.onSurface, fontFamily: 'Manrope' },
  subgreet: { fontSize: 13, color: COLORS.outline, marginTop: 2 },
  profileBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  heroCard: {
    borderRadius: 18, padding: 20, marginBottom: 16,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 12, elevation: 4,
  },
  heroIconWrap: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center', alignItems: 'center', marginBottom: 14,
  },
  heroLabel: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.85)', letterSpacing: 1.5 },
  heroNumber: { fontSize: 48, fontWeight: '900', color: '#fff', fontFamily: 'Manrope', letterSpacing: -1, marginVertical: 4 },
  heroSubtext: { fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: '500' },
  gridRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  gridCard: {
    flex: 1, padding: 16, borderRadius: 14, gap: 8,
    backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  gridCardOrange: { backgroundColor: '#fef3c7' },
  gridCardPurple: { backgroundColor: '#ede9fe' },
  gridCardGreen: { backgroundColor: '#d1fae5' },
  gridCardBlue: { backgroundColor: '#dbeafe' },
  gridCount: { fontSize: 26, fontWeight: '900', color: COLORS.onSurface, fontFamily: 'Manrope' },
  gridLabel: { fontSize: 11, fontWeight: '700', color: COLORS.onSurfaceVariant },
  alertCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 16, borderRadius: 14, marginTop: 8,
    backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fecaca',
  },
  alertIconWrap: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
  },
  alertTitle: { fontSize: 14, fontWeight: '800', color: '#7f1d1d' },
  alertSubtitle: { fontSize: 12, color: '#b91c1c', fontWeight: '500', marginTop: 2 },
  sectionTitle: {
    fontSize: 11, fontWeight: '800', color: COLORS.outline, letterSpacing: 1.5,
    marginTop: 28, marginBottom: 10, paddingHorizontal: 4,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10,
  },
  menuIconWrap: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.primaryFixed,
    justifyContent: 'center', alignItems: 'center',
  },
  menuTitle: { fontSize: 14, fontWeight: '700', color: COLORS.onSurface },
  menuSub: { fontSize: 12, color: COLORS.outline, marginTop: 2 },
});
