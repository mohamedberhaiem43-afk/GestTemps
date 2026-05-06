import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';
import { COLORS } from '../../config/env';

/**
 * MissionApprovalScreen — version manager.
 *
 * Liste les missions de la société, filtrables par état, avec actions rapides
 * approuver / refuser sur les missions en attente. Le backend expose un PUT
 * /api/Missions/{id} qui accepte un Misetat — on réutilise ce même endpoint
 * pour transitionner Pending → Approved ou Pending → Cancelled.
 *
 * Pattern visuel calqué sur LeaveApprovalScreen pour la cohérence.
 */

interface Mission {
  id: number;
  soccod: string;
  empcod: string;
  emplib?: string;
  misobj: string;
  misdest?: string | null;
  misdatedeb: string;
  misdatefin: string;
  misnote?: string | null;
  misetat: string;
  misbudget?: number | null;
  abscod: string;
  abslib?: string;
}

const STATE_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  Pending:    { bg: '#fef3c7', fg: '#92400e', label: '⏳ En attente' },
  Approved:   { bg: '#dbeafe', fg: '#1d4ed8', label: '✅ Approuvée' },
  InProgress: { bg: '#ede9fe', fg: '#6d28d9', label: '🔄 En cours' },
  Completed:  { bg: '#d1fae5', fg: '#047857', label: '✓ Terminée' },
  Cancelled:  { bg: '#fee2e2', fg: '#b91c1c', label: '✖ Annulée' },
};

const fmtDate = (d: any) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '—'; }
};

const toIsoDate = (d: any) => {
  try { return new Date(d).toISOString().split('T')[0]; } catch { return d; }
};

export default function MissionApprovalScreen({ navigation }: any) {
  const { user } = useAuth();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'completed'>('pending');

  useEffect(() => { loadMissions(); }, [user?.soccod]);

  const loadMissions = async () => {
    if (!user?.soccod) return;
    try {
      const data = await apiService.getMissionsBySoc(user.soccod);
      setMissions(Array.isArray(data) ? data : []);
    } catch (e) {
      console.log('Missions load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMissions();
    setRefreshing(false);
  };

  // Transition d'état : on doit ré-envoyer tout le payload car le backend
  // partage le PUT entre édition et changement d'état (cf. MissionsController.Update).
  const transition = async (m: Mission, nextState: string) => {
    try {
      await apiService.updateMissionState(m.id, {
        soccod: m.soccod,
        empcod: m.empcod,
        misobj: m.misobj,
        misdest: m.misdest,
        misdatedeb: toIsoDate(m.misdatedeb),
        misdatefin: toIsoDate(m.misdatefin),
        misnote: m.misnote,
        misetat: nextState,
        misbudget: m.misbudget,
        abscod: m.abscod,
      });
      loadMissions();
    } catch (e: any) {
      Alert.alert('Erreur', e?.response?.data?.message || 'Mise à jour impossible');
    }
  };

  const handleApprove = (m: Mission) => {
    Alert.alert('Approuver', `Approuver la mission "${m.misobj}" de ${m.emplib || m.empcod} ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Approuver', onPress: () => transition(m, 'Approved') },
    ]);
  };

  const handleReject = (m: Mission) => {
    Alert.alert('Refuser', `Refuser la mission "${m.misobj}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Refuser', style: 'destructive', onPress: () => transition(m, 'Cancelled') },
    ]);
  };

  const filtered = useMemo(() => {
    if (filter === 'pending') return missions.filter(m => m.misetat === 'Pending');
    if (filter === 'approved') return missions.filter(m => m.misetat === 'Approved' || m.misetat === 'InProgress');
    if (filter === 'completed') return missions.filter(m => m.misetat === 'Completed' || m.misetat === 'Cancelled');
    return missions;
  }, [missions, filter]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.onSurface} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Validation missions</Text>
        <View style={styles.iconBtn} />
      </View>

      {/* Filtres */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {([
          { key: 'pending', label: 'En attente', count: missions.filter(m => m.misetat === 'Pending').length },
          { key: 'approved', label: 'Approuvées', count: missions.filter(m => m.misetat === 'Approved' || m.misetat === 'InProgress').length },
          { key: 'completed', label: 'Terminées', count: missions.filter(m => m.misetat === 'Completed' || m.misetat === 'Cancelled').length },
          { key: 'all', label: 'Tous', count: missions.length },
        ] as const).map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}>
              {f.label}
            </Text>
            <View style={[styles.filterBadge, filter === f.key && styles.filterBadgeActive]}>
              <Text style={[styles.filterBadgeText, filter === f.key && styles.filterBadgeTextActive]}>
                {f.count}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scrollContent}
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="briefcase-check-outline" size={64} color="#cbd5e1" />
            <Text style={styles.emptyText}>Aucune mission dans cette catégorie.</Text>
          </View>
        ) : filtered.map(m => {
          const sc = STATE_COLORS[m.misetat] || { bg: '#f1f5f9', fg: '#475569', label: m.misetat };
          const isPending = m.misetat === 'Pending';
          return (
            <View key={m.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.empName}>{m.emplib || m.empcod}</Text>
                  <Text style={styles.cardTitle} numberOfLines={2}>{m.misobj}</Text>
                </View>
                <View style={[styles.stateChip, { backgroundColor: sc.bg }]}>
                  <Text style={[styles.stateChipText, { color: sc.fg }]}>{sc.label}</Text>
                </View>
              </View>
              {!!m.misdest && (
                <View style={styles.cardRow}>
                  <MaterialCommunityIcons name="map-marker-outline" size={14} color={COLORS.outline} />
                  <Text style={styles.cardRowText}>{m.misdest}</Text>
                </View>
              )}
              <View style={styles.cardRow}>
                <MaterialCommunityIcons name="calendar-range" size={14} color={COLORS.outline} />
                <Text style={styles.cardRowText}>
                  {fmtDate(m.misdatedeb)} → {fmtDate(m.misdatefin)}
                </Text>
              </View>
              {m.misbudget != null && (
                <View style={styles.cardRow}>
                  <MaterialCommunityIcons name="cash-multiple" size={14} color={COLORS.outline} />
                  <Text style={styles.cardRowText}>{m.misbudget.toFixed(2)} €</Text>
                </View>
              )}
              {!!m.misnote && (
                <Text style={styles.cardNote}>{m.misnote}</Text>
              )}

              {isPending && (
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.refuseBtn]}
                    onPress={() => handleReject(m)}
                  >
                    <MaterialCommunityIcons name="close-circle-outline" size={18} color="#b91c1c" />
                    <Text style={[styles.actionText, { color: '#b91c1c' }]}>Refuser</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.approveBtn]}
                    onPress={() => handleApprove(m)}
                  >
                    <MaterialCommunityIcons name="check-circle-outline" size={18} color="#fff" />
                    <Text style={[styles.actionText, { color: '#fff' }]}>Approuver</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topBar: {
    height: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: COLORS.surfaceContainerLow,
  },
  iconBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 20 },
  topTitle: { fontSize: 18, fontWeight: '800', color: COLORS.onSurface, fontFamily: 'Manrope' },
  filterRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.surfaceContainerLow,
  },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipText: { fontSize: 12, fontWeight: '700', color: COLORS.onSurfaceVariant },
  filterChipTextActive: { color: '#fff' },
  filterBadge: {
    minWidth: 22, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 11,
    backgroundColor: COLORS.surfaceContainerLow, alignItems: 'center', justifyContent: 'center',
  },
  filterBadgeActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  filterBadgeText: { fontSize: 10, fontWeight: '800', color: COLORS.outline },
  filterBadgeTextActive: { color: '#fff' },
  scrollContent: { padding: 16, paddingBottom: 60 },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 13, color: COLORS.outline, marginTop: 8 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  empName: { fontSize: 11, fontWeight: '700', color: COLORS.primary, letterSpacing: 0.3, marginBottom: 4 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.onSurface },
  stateChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  stateChipText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  cardRowText: { fontSize: 12, color: COLORS.onSurfaceVariant, fontWeight: '500' },
  cardNote: {
    marginTop: 8, padding: 10, backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 8, fontSize: 12, color: COLORS.onSurfaceVariant, fontStyle: 'italic',
  },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11, borderRadius: 10,
  },
  refuseBtn: { backgroundColor: '#fee2e2' },
  approveBtn: { backgroundColor: COLORS.primary },
  actionText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
});
