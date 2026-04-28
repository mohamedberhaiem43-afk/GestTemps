import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import { COLORS } from '../config/env';
import BottomTabBar from '../components/BottomTabBar';
import { withCacheFallback } from '../services/cache';

type DayStatus = 'present' | 'late' | 'absent' | 'repos' | 'conge' | 'ferier' | 'partial';

interface DayInfo {
  date: Date;
  raw: any | null;
  status: DayStatus;
  totalMinutes: number;
  hasLate: boolean;
  events: { type: 'IN' | 'OUT'; label: string; time: string; color: string; icon: string }[];
}

const MONTH_NAMES = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const DAY_LABELS = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function formatYMD(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

function parseTime(str?: string | null): number | null {
  if (!str) return null;
  const [h, m] = String(str).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function isTrue(v: any): boolean {
  if (v === true) return true;
  if (typeof v === 'string') return ['1', 'true', 'True', 'O', 'Oui'].includes(v.trim());
  return false;
}

function computeTotalMinutes(p: any): number {
  let total = 0;
  const a = parseTime(p?.preentmatup);
  const b = parseTime(p?.presortmatup);
  const c = parseTime(p?.preentamidiup);
  const d = parseTime(p?.presortamidiup);
  if (a !== null && b !== null && b > a) total += b - a;
  if (c !== null && d !== null && d > c) total += d - c;
  return total;
}

function deriveStatus(p: any): DayStatus {
  if (!p) return 'absent';
  if (isTrue(p.prerepos)) return 'repos';
  if (p.concod || p.conge || isTrue(p.preconge)) return 'conge';
  if (isTrue(p.preferier) || p.ferier) return 'ferier';
  const hasIn = !!(p.preentmatup || p.preentamidiup);
  const hasOut = !!(p.presortmatup || p.presortamidiup);
  const tothre = parseTime(p.tothre);
  if (hasIn && tothre && tothre > 0) return 'late';
  if (hasIn && hasOut) return 'present';
  if (hasIn) return 'partial';
  return 'absent';
}

function statusMeta(s: DayStatus): { label: string; color: string; bg: string; icon: string } {
  switch (s) {
    case 'present': return { label: 'Présent', color: COLORS.tertiary, bg: COLORS.tertiaryFixed, icon: 'check-circle' };
    case 'late':    return { label: 'En retard', color: COLORS.warning, bg: '#fff1c2', icon: 'clock-alert' };
    case 'partial': return { label: 'Sortie manquante', color: COLORS.warning, bg: '#fff1c2', icon: 'progress-clock' };
    case 'absent':  return { label: 'Absent', color: COLORS.error, bg: COLORS.errorContainer, icon: 'close-circle' };
    case 'repos':   return { label: 'Repos', color: COLORS.secondary, bg: COLORS.secondaryFixed, icon: 'sleep' };
    case 'conge':   return { label: 'Congé', color: COLORS.primary, bg: COLORS.primaryFixed, icon: 'palm-tree' };
    case 'ferier':  return { label: 'Férié', color: COLORS.accent, bg: COLORS.primaryFixed, icon: 'star-circle' };
  }
}

function formatHM(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h${pad(m)}`;
}

export default function PresenceHistoryScreen({ navigation }: any) {
  const { user } = useAuth();
  const today = useMemo(() => new Date(), []);
  const [refMonth, setRefMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [presences, setPresences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [filter, setFilter] = useState<'all' | DayStatus>('all');

  const loadPresences = useCallback(async () => {
    if (!user?.soccod || !user?.uticod) return;
    const firstDay = new Date(refMonth.getFullYear(), refMonth.getMonth(), 1);
    const lastDay = new Date(refMonth.getFullYear(), refMonth.getMonth() + 1, 0);
    const cacheKey = `history_${user.soccod}_${user.uticod}_${refMonth.getFullYear()}_${refMonth.getMonth() + 1}`;
    try {
      const { data } = await withCacheFallback(cacheKey, () =>
        apiService.getMyPresenceHistory(user.soccod!, user.uticod!, formatYMD(firstDay), formatYMD(lastDay))
      );
      setPresences(Array.isArray(data) ? data : []);
    } catch (error) {
      console.log('Failed to load presences:', error);
      setPresences([]);
    } finally {
      setLoading(false);
    }
  }, [user, refMonth]);

  useEffect(() => { setLoading(true); loadPresences(); }, [loadPresences]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPresences();
    setRefreshing(false);
  };

  // Map presence par date pour lookup rapide
  const byDate = useMemo(() => {
    const m = new Map<string, any>();
    for (const p of presences) {
      const k = (p?.predat || '').slice(0, 10);
      if (k) m.set(k, p);
    }
    return m;
  }, [presences]);

  // Liste de jours du mois courant avec status calculé
  const monthDays = useMemo<DayInfo[]>(() => {
    const days: DayInfo[] = [];
    const lastDayOfMonth = new Date(refMonth.getFullYear(), refMonth.getMonth() + 1, 0).getDate();
    for (let i = 1; i <= lastDayOfMonth; i++) {
      const date = new Date(refMonth.getFullYear(), refMonth.getMonth(), i);
      const key = formatYMD(date);
      const raw = byDate.get(key) || null;
      const status = deriveStatus(raw);
      const totalMinutes = raw ? computeTotalMinutes(raw) : 0;
      const tothre = parseTime(raw?.tothre);
      const events: DayInfo['events'] = [];
      if (raw?.preentmatup) events.push({ type: 'IN', label: 'Entrée matin', time: raw.preentmatup, color: COLORS.tertiary, icon: 'login' });
      if (raw?.presortmatup) events.push({ type: 'OUT', label: 'Sortie matin', time: raw.presortmatup, color: COLORS.error, icon: 'logout' });
      if (raw?.preentamidiup) events.push({ type: 'IN', label: 'Reprise après-midi', time: raw.preentamidiup, color: COLORS.tertiary, icon: 'login' });
      if (raw?.presortamidiup) events.push({ type: 'OUT', label: 'Sortie après-midi', time: raw.presortamidiup, color: COLORS.error, icon: 'logout' });
      days.push({
        date, raw, status, totalMinutes,
        hasLate: !!(tothre && tothre > 0),
        events,
      });
    }
    return days;
  }, [refMonth, byDate]);

  // Stats du mois
  const monthStats = useMemo(() => {
    let workedMinutes = 0;
    let presentDays = 0;
    let lateDays = 0;
    let absentDays = 0;
    for (const d of monthDays) {
      if (d.date > today) continue;
      workedMinutes += d.totalMinutes;
      if (d.status === 'present') presentDays++;
      if (d.status === 'late') lateDays++;
      if (d.status === 'absent') absentDays++;
    }
    return { workedMinutes, presentDays, lateDays, absentDays };
  }, [monthDays, today]);

  // Jour sélectionné
  const selectedInfo = useMemo<DayInfo | null>(() => {
    const key = formatYMD(selectedDate);
    return monthDays.find(d => formatYMD(d.date) === key) || null;
  }, [selectedDate, monthDays]);

  // Liste des jours filtrés (les plus récents en premier, jours futurs exclus)
  const filteredDays = useMemo(() => {
    const past = monthDays.filter(d => d.date <= today);
    const filtered = filter === 'all' ? past : past.filter(d => d.status === filter);
    return [...filtered].sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [monthDays, filter, today]);

  const goPrevMonth = () => setRefMonth(new Date(refMonth.getFullYear(), refMonth.getMonth() - 1, 1));
  const goNextMonth = () => {
    // Ne pas aller au-delà du mois courant
    const next = new Date(refMonth.getFullYear(), refMonth.getMonth() + 1, 1);
    if (next <= today) setRefMonth(next);
  };

  // Bandeau hebdomadaire (5 jours autour de selectedDate)
  const weekBand = useMemo(() => {
    const days: DayInfo[] = [];
    for (let i = -2; i <= 2; i++) {
      const d = new Date(selectedDate);
      d.setDate(selectedDate.getDate() + i);
      const key = formatYMD(d);
      const found = monthDays.find(md => formatYMD(md.date) === key);
      if (found) {
        days.push(found);
      } else {
        days.push({
          date: d, raw: null, status: 'absent', totalMinutes: 0, hasLate: false, events: [],
        });
      }
    }
    return days;
  }, [selectedDate, monthDays]);

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    );
  }

  const monthLabel = `${MONTH_NAMES[refMonth.getMonth()]} ${refMonth.getFullYear()}`;
  const isFuture = (d: Date) => d > today;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topAppBar}>
        <View>
          <Text style={styles.subHeader}>Suivi temporel</Text>
          <Text style={styles.mainTitle}>Historique</Text>
        </View>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Profile')}>
          <MaterialCommunityIcons name="bell-outline" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Calendrier compact */}
        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <Text style={styles.calendarMonth}>{monthLabel}</Text>
            <View style={styles.calendarNav}>
              <TouchableOpacity onPress={goPrevMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialCommunityIcons name="chevron-left" size={22} color={COLORS.onSurface} />
              </TouchableOpacity>
              <TouchableOpacity onPress={goNextMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialCommunityIcons name="chevron-right" size={22} color={COLORS.onSurface} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.calendarDays}>
            {weekBand.map((d, i) => {
              const isSelected = formatYMD(d.date) === formatYMD(selectedDate);
              const future = isFuture(d.date);
              const meta = statusMeta(d.status);
              return (
                <View key={i} style={styles.dayCol}>
                  <Text style={styles.dayName}>{DAY_LABELS[d.date.getDay()]}</Text>
                  <TouchableOpacity
                    style={[
                      styles.dayBtn,
                      isSelected && styles.dayBtnSelected,
                      future && styles.dayBtnFuture,
                    ]}
                    disabled={future}
                    onPress={() => setSelectedDate(d.date)}
                  >
                    <Text style={[styles.dayNum, isSelected && styles.dayNumSelected]}>{d.date.getDate()}</Text>
                    {!future && d.raw && <View style={[styles.dayDot, { backgroundColor: meta.color }]} />}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>

        {/* Stats mensuelles */}
        <View style={styles.statsRow}>
          <View style={[styles.statBento, { backgroundColor: COLORS.primaryFixed }]}>
            <MaterialCommunityIcons name="clock-outline" size={22} color={COLORS.primary} />
            <View>
              <Text style={[styles.bentoLabel, { color: COLORS.onPrimaryFixedVariant }]}>TOTAL MOIS</Text>
              <Text style={[styles.bentoValue, { color: COLORS.onPrimaryFixed }]}>{formatHM(monthStats.workedMinutes)}</Text>
            </View>
          </View>
          <View style={[styles.statBento, { backgroundColor: COLORS.tertiaryFixed }]}>
            <MaterialCommunityIcons name="check-circle-outline" size={22} color={COLORS.tertiary} />
            <View>
              <Text style={[styles.bentoLabel, { color: COLORS.onTertiaryFixedVariant }]}>JOURS PRÉSENTS</Text>
              <Text style={[styles.bentoValue, { color: COLORS.onTertiaryFixed }]}>{monthStats.presentDays + monthStats.lateDays}</Text>
            </View>
          </View>
        </View>

        {/* Détail jour sélectionné */}
        {selectedInfo && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {selectedDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </Text>
              <View style={[styles.statusPill, { backgroundColor: statusMeta(selectedInfo.status).bg }]}>
                <MaterialCommunityIcons
                  name={statusMeta(selectedInfo.status).icon}
                  size={12}
                  color={statusMeta(selectedInfo.status).color}
                />
                <Text style={[styles.statusPillText, { color: statusMeta(selectedInfo.status).color }]}>
                  {statusMeta(selectedInfo.status).label}
                </Text>
              </View>
            </View>

            {selectedInfo.events.length > 0 ? (
              <View style={styles.ledgerList}>
                {selectedInfo.events.map((event, idx) => (
                  <View key={idx} style={[styles.ledgerItem, { borderLeftColor: event.color }]}>
                    <View style={styles.ledgerLeft}>
                      <View style={[styles.ledgerIconWrapper, { backgroundColor: `${event.color}15` }]}>
                        <MaterialCommunityIcons name={event.icon} size={20} color={event.color} />
                      </View>
                      <View>
                        <Text style={styles.ledgerTitle}>{event.label}</Text>
                        <Text style={styles.ledgerSub}>{event.type === 'IN' ? 'Pointage entrée' : 'Pointage sortie'}</Text>
                      </View>
                    </View>
                    <Text style={styles.ledgerTime}>{event.time}</Text>
                  </View>
                ))}
                <View style={styles.daySummaryCard}>
                  <Text style={styles.daySummaryLabel}>Total travaillé</Text>
                  <Text style={styles.daySummaryValue}>{formatHM(selectedInfo.totalMinutes)}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.emptyLedger}>
                <MaterialCommunityIcons name={statusMeta(selectedInfo.status).icon} size={36} color={statusMeta(selectedInfo.status).color} />
                <Text style={styles.emptyText}>Aucun pointage enregistré</Text>
              </View>
            )}
          </View>
        )}

        {/* Filtres */}
        <View style={styles.filterRow}>
          {[
            { k: 'all', label: 'Tout' },
            { k: 'present', label: 'Présent' },
            { k: 'late', label: 'Retard' },
            { k: 'absent', label: 'Absent' },
            { k: 'conge', label: 'Congé' },
            { k: 'repos', label: 'Repos' },
          ].map(f => (
            <TouchableOpacity
              key={f.k}
              style={[styles.filterChip, filter === f.k && styles.filterChipActive]}
              onPress={() => setFilter(f.k as any)}
            >
              <Text style={[styles.filterChipText, filter === f.k && styles.filterChipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Liste mensuelle */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tous les jours</Text>
          <View style={styles.archiveList}>
            {filteredDays.map((d, idx) => {
              const meta = statusMeta(d.status);
              return (
                <TouchableOpacity
                  key={idx}
                  style={styles.archiveItem}
                  onPress={() => setSelectedDate(d.date)}
                  activeOpacity={0.7}
                >
                  <View style={styles.archiveLeft}>
                    <View style={[styles.archiveDateBadge, { backgroundColor: meta.bg }]}>
                      <Text style={[styles.archiveDateText, { color: meta.color }]}>{d.date.getDate()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.archiveDay}>
                        {d.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })}
                      </Text>
                      <View style={styles.archiveMetaRow}>
                        <View style={[styles.statusDot, { backgroundColor: meta.color }]} />
                        <Text style={styles.archiveMeta}>{meta.label}</Text>
                        {d.totalMinutes > 0 && (
                          <Text style={styles.archiveMeta}> · {formatHM(d.totalMinutes)}</Text>
                        )}
                      </View>
                    </View>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.outline} />
                </TouchableOpacity>
              );
            })}
            {filteredDays.length === 0 && (
              <View style={styles.emptyLedger}>
                <Text style={styles.emptyText}>Aucun jour ne correspond à ce filtre.</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <BottomTabBar active="history" navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topAppBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12, backgroundColor: COLORS.background,
  },
  subHeader: { fontSize: 10, fontWeight: '700', color: COLORS.secondary, letterSpacing: 1.5, textTransform: 'uppercase' },
  mainTitle: { fontSize: 28, fontWeight: '800', color: COLORS.onSurface, letterSpacing: -0.5 },
  iconButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.primaryFixed },
  scrollContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 100 },
  calendarCard: { backgroundColor: '#fff', borderRadius: 24, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  calendarMonth: { fontSize: 16, fontWeight: '800', color: COLORS.onSurface, textTransform: 'capitalize' },
  calendarNav: { flexDirection: 'row', gap: 16 },
  calendarDays: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCol: { alignItems: 'center', gap: 8 },
  dayName: { fontSize: 10, fontWeight: '800', color: COLORS.outline, textTransform: 'uppercase' },
  dayBtn: { width: 44, height: 56, borderRadius: 14, backgroundColor: COLORS.surfaceContainerLow, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  dayBtnSelected: { backgroundColor: COLORS.primary, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  dayBtnFuture: { opacity: 0.4 },
  dayNum: { fontSize: 14, fontWeight: '700', color: COLORS.onSurfaceVariant },
  dayNumSelected: { color: '#fff' },
  dayDot: { position: 'absolute', bottom: 6, width: 5, height: 5, borderRadius: 3 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statBento: { flex: 1, borderRadius: 18, padding: 16, gap: 10 },
  bentoLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  bentoValue: { fontSize: 22, fontWeight: '900' },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.onSurface, textTransform: 'capitalize' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusPillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  ledgerList: { gap: 8 },
  ledgerItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    borderLeftWidth: 3,
  },
  ledgerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  ledgerIconWrapper: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  ledgerTitle: { fontSize: 14, fontWeight: '700', color: COLORS.onSurface },
  ledgerSub: { fontSize: 11, fontWeight: '500', color: COLORS.outline, marginTop: 2 },
  ledgerTime: { fontSize: 18, fontWeight: '900', color: COLORS.onSurface },
  daySummaryCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.primaryFixed, borderRadius: 14, padding: 14, marginTop: 4,
  },
  daySummaryLabel: { fontSize: 11, fontWeight: '700', color: COLORS.onPrimaryFixedVariant, letterSpacing: 0.3 },
  daySummaryValue: { fontSize: 18, fontWeight: '900', color: COLORS.onPrimaryFixed },
  emptyLedger: { padding: 24, alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 14 },
  emptyText: { fontSize: 13, color: COLORS.outline, fontWeight: '600', textAlign: 'center' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.surfaceContainerLow },
  filterChipActive: { backgroundColor: COLORS.primary },
  filterChipText: { fontSize: 12, fontWeight: '700', color: COLORS.onSurfaceVariant },
  filterChipTextActive: { color: '#fff' },
  archiveList: { gap: 10 },
  archiveItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 14, padding: 12 },
  archiveLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  archiveDateBadge: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  archiveDateText: { fontSize: 16, fontWeight: '900' },
  archiveDay: { fontSize: 13, fontWeight: '700', color: COLORS.onSurface, textTransform: 'capitalize' },
  archiveMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  archiveMeta: { fontSize: 11, color: COLORS.outline, fontWeight: '600' },
});
