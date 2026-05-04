import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import { COLORS } from '../config/env';
import BottomTabBar from '../components/BottomTabBar';
import { withCacheFallback } from '../services/cache';

interface HolidayRow {
  ferdate?: string | null;
  fermotif?: string | null;
  ferfixe?: string | null;
  fertype?: string | null;
  fernpaye?: string | null;
}

const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];
const DAYS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

function isPaid(h: HolidayRow): boolean {
  // Fernpaye = 'O' / '1' / true → JOUR NON PAYÉ. Sinon payé par défaut.
  const v = h.fernpaye;
  if (v == null) return true;
  const s = String(v).trim();
  return !(s === '1' || s.toUpperCase() === 'O' || s.toLowerCase() === 'true');
}

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return Number.POSITIVE_INFINITY;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function formatLongDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${DAYS_FR[d.getDay()]} ${d.getDate()} ${MONTHS_FR[d.getMonth()]}`;
}

function formatRelative(d: number): string {
  if (d === 0) return "Aujourd'hui";
  if (d === 1) return 'Demain';
  if (d <= 7) return `Dans ${d} jours`;
  if (d <= 30) return `Dans ${Math.round(d / 7)} sem.`;
  return `Dans ${Math.round(d / 30)} mois`;
}

export default function HolidaysScreen({ navigation }: any) {
  const { user } = useAuth();
  const [holidays, setHolidays] = useState<HolidayRow[]>([]);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    if (!user?.soccod) return;
    setError(null);
    try {
      const { data, fromCache } = await withCacheFallback(
        `holidays_${user.soccod}_${year}`,
        () => apiService.getUpcomingHolidays(user.soccod!, year)
      );
      setOffline(fromCache);
      setHolidays(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.log('Failed to load holidays:', e?.message);
      setError("Impossible de charger les jours fériés. Réessayez plus tard.");
      setHolidays([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.soccod, year]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  // Trie par date croissante et regroupe par mois.
  const grouped = useMemo(() => {
    const valid = holidays.filter(h => !!h.ferdate);
    valid.sort((a, b) => (a.ferdate! < b.ferdate! ? -1 : 1));
    const byMonth: Record<string, HolidayRow[]> = {};
    valid.forEach(h => {
      const d = new Date(h.ferdate!);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      (byMonth[key] = byMonth[key] || []).push(h);
    });
    return Object.entries(byMonth)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, items]) => {
        const [y, m] = k.split('-').map(Number);
        return {
          key: k,
          label: `${MONTHS_FR[m - 1].toUpperCase()} ${y}`,
          items,
        };
      });
  }, [holidays]);

  const next = grouped[0]?.items?.[0];
  const nextDays = next?.ferdate ? daysUntil(next.ferdate) : null;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Jours fériés</Text>
        <View style={styles.yearSwitcher}>
          <TouchableOpacity onPress={() => setYear(y => y - 1)} hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}>
            <MaterialCommunityIcons name="chevron-left" size={22} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.yearText}>{year}</Text>
          <TouchableOpacity onPress={() => setYear(y => y + 1)} hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}>
            <MaterialCommunityIcons name="chevron-right" size={22} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {offline && (
          <View style={styles.offlineBanner}>
            <MaterialCommunityIcons name="cloud-off-outline" size={16} color={COLORS.warning} />
            <Text style={styles.offlineText}>Mode hors-ligne — données mises en cache</Text>
          </View>
        )}

        {/* Hero card : prochain jour férié */}
        {next && next.ferdate && (
          <View style={styles.heroCard}>
            <View style={styles.heroIconRow}>
              <View style={styles.heroIconBox}>
                <MaterialCommunityIcons name="calendar-star" size={28} color="#fff" />
              </View>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>{nextDays != null ? formatRelative(nextDays).toUpperCase() : ''}</Text>
              </View>
            </View>
            <Text style={styles.heroLabel}>PROCHAIN JOUR FÉRIÉ</Text>
            <Text style={styles.heroTitle}>{next.fermotif || 'Jour férié'}</Text>
            <Text style={styles.heroDate}>{formatLongDate(next.ferdate)}</Text>
            <View style={styles.heroChips}>
              <View style={[styles.chip, isPaid(next) ? styles.chipPaid : styles.chipUnpaid]}>
                <MaterialCommunityIcons
                  name={isPaid(next) ? 'currency-eur' : 'currency-eur-off'}
                  size={12}
                  color={isPaid(next) ? '#fff' : '#fff'}
                />
                <Text style={styles.chipText}>{isPaid(next) ? 'Payé' : 'Non payé'}</Text>
              </View>
              {next.ferfixe && (
                <View style={[styles.chip, styles.chipMuted]}>
                  <MaterialCommunityIcons name="pin-outline" size={12} color="#cbd5e1" />
                  <Text style={styles.chipText}>{String(next.ferfixe).toUpperCase() === 'O' ? 'Date fixe' : 'Mobile'}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* États : loading / vide / erreur */}
        {loading && !holidays.length && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        )}

        {!loading && error && (
          <View style={styles.errorBox}>
            <MaterialCommunityIcons name="alert-circle-outline" size={20} color={COLORS.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!loading && !error && grouped.length === 0 && (
          <View style={styles.emptyBox}>
            <MaterialCommunityIcons name="calendar-blank-outline" size={48} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>Aucun jour férié à venir</Text>
            <Text style={styles.emptySub}>
              {year === new Date().getFullYear()
                ? "Tous les jours fériés de l'année sont passés."
                : `Aucun jour férié programmé pour ${year}.`}
            </Text>
          </View>
        )}

        {/* Liste groupée par mois */}
        {grouped.map(group => (
          <View key={group.key} style={styles.monthBlock}>
            <Text style={styles.monthLabel}>{group.label}</Text>
            {group.items.map((h, idx) => {
              const d = new Date(h.ferdate!);
              const days = daysUntil(h.ferdate!);
              const paid = isPaid(h);
              return (
                <View key={`${h.ferdate}-${idx}`} style={styles.row}>
                  <View style={styles.dateCircle}>
                    <Text style={styles.dateDay}>{d.getDate()}</Text>
                    <Text style={styles.dateMonth}>{MONTHS_FR[d.getMonth()].slice(0, 3).toUpperCase()}</Text>
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{h.fermotif || 'Jour férié'}</Text>
                    <Text style={styles.rowSub}>{DAYS_FR[d.getDay()]} · {days >= 0 ? formatRelative(days) : 'Passé'}</Text>
                  </View>
                  <View style={[styles.tag, paid ? styles.tagPaid : styles.tagUnpaid]}>
                    <Text style={[styles.tagText, paid ? styles.tagTextPaid : styles.tagTextUnpaid]}>
                      {paid ? 'Payé' : 'Non payé'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <BottomTabBar active="home" navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    height: 64, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.background,
  },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: COLORS.onSurface },
  yearSwitcher: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  yearText: { fontSize: 14, fontWeight: '800', color: COLORS.primary, minWidth: 40, textAlign: 'center' },
  scrollContent: { padding: 20, paddingBottom: 120 },
  offlineBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff7e6', borderColor: '#fde2a7', borderWidth: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 16 },
  offlineText: { fontSize: 12, color: COLORS.warning, fontWeight: '700' },
  heroCard: {
    backgroundColor: COLORS.primary, borderRadius: 24, padding: 20, marginBottom: 24,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 6,
  },
  heroIconRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  heroIconBox: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  heroBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  heroBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  heroLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '900', lineHeight: 26 },
  heroDate: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600', marginTop: 4 },
  heroChips: { flexDirection: 'row', gap: 8, marginTop: 16 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  chipPaid: { backgroundColor: 'rgba(78,222,163,0.25)' },
  chipUnpaid: { backgroundColor: 'rgba(255,180,180,0.25)' },
  chipMuted: { backgroundColor: 'rgba(255,255,255,0.1)' },
  chipText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  center: { paddingVertical: 60, alignItems: 'center', justifyContent: 'center' },

  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.errorContainer, padding: 14, borderRadius: 12, marginBottom: 16 },
  errorText: { flex: 1, color: COLORS.error, fontSize: 13, fontWeight: '600' },

  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: COLORS.onSurface, marginTop: 12 },
  emptySub: { fontSize: 13, color: '#94a3b8', textAlign: 'center', paddingHorizontal: 32 },

  monthBlock: { marginBottom: 20 },
  monthLabel: { fontSize: 11, fontWeight: '900', color: '#64748b', letterSpacing: 1.2, marginBottom: 10, paddingHorizontal: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  dateCircle: {
    width: 52, height: 52, borderRadius: 14, backgroundColor: COLORS.primaryFixed,
    justifyContent: 'center', alignItems: 'center',
  },
  dateDay: { fontSize: 18, fontWeight: '900', color: COLORS.primary, lineHeight: 20 },
  dateMonth: { fontSize: 9, fontWeight: '800', color: COLORS.primary, letterSpacing: 0.5 },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: COLORS.onSurface },
  rowSub: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  tagPaid: { backgroundColor: '#d1fae5' },
  tagUnpaid: { backgroundColor: '#fee2e2' },
  tagText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  tagTextPaid: { color: '#065f46' },
  tagTextUnpaid: { color: '#991b1b' },
});
