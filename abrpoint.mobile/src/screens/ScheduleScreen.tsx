import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';
import { useT } from '../i18n';
import apiService from '../services/api';
import { COLORS } from '../config/env';
import BottomTabBar, { useTabBarPadding } from '../components/BottomTabBar';
import { withCacheFallback } from '../services/cache';

type DayKey = 'lun' | 'mar' | 'mer' | 'jeu' | 'ven' | 'sam' | 'dim';

interface DaySlots {
  matStart?: string | null;
  matEnd?: string | null;
  amStart?: string | null;
  amEnd?: string | null;
  repos: boolean;
}

interface HoraireRow {
  codposte?: string | null;
  libposte?: string | null;
  // Lun..Dim : matin/aprem/repos. Le DTO backend les envoie séparément par jour.
  [k: string]: any;
}

const DAY_DEFS: { key: DayKey; labelKey: string; shortKey: string }[] = [
  { key: 'lun', labelKey: 'schedule.dayMon', shortKey: 'schedule.dayMonShort' },
  { key: 'mar', labelKey: 'schedule.dayTue', shortKey: 'schedule.dayTueShort' },
  { key: 'mer', labelKey: 'schedule.dayWed', shortKey: 'schedule.dayWedShort' },
  { key: 'jeu', labelKey: 'schedule.dayThu', shortKey: 'schedule.dayThuShort' },
  { key: 'ven', labelKey: 'schedule.dayFri', shortKey: 'schedule.dayFriShort' },
  { key: 'sam', labelKey: 'schedule.daySat', shortKey: 'schedule.daySatShort' },
  { key: 'dim', labelKey: 'schedule.daySun', shortKey: 'schedule.daySunShort' },
];

// JS getDay() : 0 = dimanche … 6 = samedi
const JS_DAY_TO_KEY: Record<number, DayKey> = {
  0: 'dim', 1: 'lun', 2: 'mar', 3: 'mer', 4: 'jeu', 5: 'ven', 6: 'sam',
};

function isReposFlag(v: any): boolean {
  if (v == null) return false;
  if (v === true) return true;
  const s = String(v).trim();
  return s === '1' || s.toUpperCase() === 'O' || s.toLowerCase() === 'true';
}

function trimTime(t?: string | null): string | undefined {
  if (!t) return undefined;
  // Format venant du backend : "08:00" ou "08:00:00"
  const m = String(t).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return undefined;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

function extractDay(row: HoraireRow, key: DayKey): DaySlots {
  // Le DTO utilise "lunhdmat" / "lunhfmat" / "lunhdam" / "lunhfam" / "lunrepos"…
  return {
    matStart: trimTime(row[`${key}hdmat`]),
    matEnd: trimTime(row[`${key}hfmat`]),
    amStart: trimTime(row[`${key}hdam`]),
    amEnd: trimTime(row[`${key}hfam`]),
    repos: isReposFlag(row[`${key}repos`]),
  };
}

function diffMinutes(a?: string | null, b?: string | null): number {
  if (!a || !b) return 0;
  const [ah, am] = a.split(':').map(Number);
  const [bh, bm] = b.split(':').map(Number);
  const d = (bh * 60 + bm) - (ah * 60 + am);
  return d > 0 ? d : 0;
}

function formatHm(min: number): string {
  if (min <= 0) return '0h';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h${String(m).padStart(2, '0')}`;
  if (h) return `${h}h`;
  return `${m}min`;
}

function dayTotalMinutes(slot: DaySlots): number {
  if (slot.repos) return 0;
  return diffMinutes(slot.matStart, slot.matEnd) + diffMinutes(slot.amStart, slot.amEnd);
}

export default function ScheduleScreen({ navigation }: any) {
  const { user } = useAuth();
  const t = useT();
  const tabBarPadding = useTabBarPadding();
  const [rows, setRows] = useState<HoraireRow[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);

  const todayKey = JS_DAY_TO_KEY[new Date().getDay()];

  const load = useCallback(async () => {
    if (!user?.soccod || !user?.uticod) return;
    setError(null);
    try {
      const { data, fromCache } = await withCacheFallback(
        `schedule_${user.soccod}_${user.uticod}`,
        () => apiService.getMyHoraires(user.soccod!, user.uticod!)
      );
      setOffline(fromCache);
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.log('Failed to load schedule:', e?.message);
      setError(t('schedule.loadError'));
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.soccod, user?.uticod, t]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const activeRow = rows[activeIdx];

  const weekTotal = useMemo(() => {
    if (!activeRow) return 0;
    return DAY_DEFS.reduce((sum, d) => sum + dayTotalMinutes(extractDay(activeRow, d.key)), 0);
  }, [activeRow]);

  const reposCount = useMemo(() => {
    if (!activeRow) return 0;
    return DAY_DEFS.filter(d => extractDay(activeRow, d.key).repos).length;
  }, [activeRow]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('schedule.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarPadding }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {offline && (
          <View style={styles.offlineBanner}>
            <MaterialCommunityIcons name="cloud-off-outline" size={16} color={COLORS.warning} />
            <Text style={styles.offlineText}>{t('schedule.offlineCached')}</Text>
          </View>
        )}

        {loading && !rows.length && (
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

        {!loading && !error && !rows.length && (
          <View style={styles.emptyBox}>
            <MaterialCommunityIcons name="calendar-clock-outline" size={48} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>{t('schedule.emptyTitle')}</Text>
            <Text style={styles.emptySub}>
              {t('schedule.emptySub')}
            </Text>
          </View>
        )}

        {/* Sélecteur de poste si plusieurs */}
        {rows.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.posteSwitcher}
          >
            {rows.map((r, idx) => {
              const active = idx === activeIdx;
              return (
                <TouchableOpacity
                  key={`${r.codposte}-${idx}`}
                  onPress={() => setActiveIdx(idx)}
                  activeOpacity={0.85}
                  style={[styles.posteChip, active && styles.posteChipActive]}
                >
                  <Text style={[styles.posteChipText, active && styles.posteChipTextActive]}>
                    {r.libposte || r.codposte || '—'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {activeRow && (
          <>
            {/* Header card : poste + totaux */}
            <View style={styles.posteCard}>
              <View style={styles.posteIconBox}>
                <MaterialCommunityIcons name="briefcase-clock-outline" size={26} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.posteLabel}>{t('schedule.posteLabel')}</Text>
                <Text style={styles.posteName} numberOfLines={2}>{activeRow.libposte || activeRow.codposte || t('schedule.unnamed')}</Text>
                <Text style={styles.posteCode}>{activeRow.codposte}</Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <MaterialCommunityIcons name="clock-outline" size={20} color={COLORS.primary} />
                <Text style={styles.statValue}>{formatHm(weekTotal)}</Text>
                <Text style={styles.statLabel}>{t('schedule.statWeek')}</Text>
              </View>
              <View style={styles.statCard}>
                <MaterialCommunityIcons name="sleep" size={20} color="#94a3b8" />
                <Text style={styles.statValue}>{reposCount}</Text>
                <Text style={styles.statLabel}>{reposCount > 1 ? t('schedule.statRestDaysPlural') : t('schedule.statRestDays')}</Text>
              </View>
            </View>

            {/* Liste des jours */}
            <Text style={styles.sectionTitle}>{t('schedule.dailyDetail')}</Text>
            {DAY_DEFS.map(d => {
              const slot = extractDay(activeRow, d.key);
              const isToday = todayKey === d.key;
              const total = dayTotalMinutes(slot);
              return (
                <View key={d.key} style={[styles.dayCard, isToday && styles.dayCardToday]}>
                  <View style={styles.dayHeader}>
                    <View style={[styles.dayBadge, isToday && styles.dayBadgeToday]}>
                      <Text style={[styles.dayShort, isToday && styles.dayShortToday]}>{t(d.shortKey)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dayLabel}>
                        {t(d.labelKey)}
                        {isToday && <Text style={styles.todayTag}>  · {t('schedule.todayTag')}</Text>}
                      </Text>
                      {!slot.repos ? (
                        <Text style={styles.dayTotal}>{formatHm(total)}</Text>
                      ) : (
                        <Text style={styles.dayReposLabel}>{t('schedule.weeklyRest')}</Text>
                      )}
                    </View>
                    {slot.repos && (
                      <MaterialCommunityIcons name="sleep" size={18} color="#94a3b8" />
                    )}
                  </View>

                  {!slot.repos && (
                    <View style={styles.slotRow}>
                      {slot.matStart || slot.matEnd ? (
                        <View style={styles.slotChip}>
                          <MaterialCommunityIcons name="weather-sunset-up" size={14} color={COLORS.primary} />
                          <Text style={styles.slotText}>
                            {slot.matStart || '—'} → {slot.matEnd || '—'}
                          </Text>
                        </View>
                      ) : null}
                      {slot.amStart || slot.amEnd ? (
                        <View style={styles.slotChip}>
                          <MaterialCommunityIcons name="weather-sunset-down" size={14} color="#ea580c" />
                          <Text style={styles.slotText}>
                            {slot.amStart || '—'} → {slot.amEnd || '—'}
                          </Text>
                        </View>
                      ) : null}
                      {!slot.matStart && !slot.matEnd && !slot.amStart && !slot.amEnd && (
                        <Text style={styles.dayUnplanned}>{t('schedule.noScheduleDefined')}</Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })}

            {/* Tolérances entrée/sortie si disponibles */}
            {(activeRow.avantEnt != null || activeRow.avantSort != null) && (
              <View style={styles.toleranceCard}>
                <MaterialCommunityIcons name="information-outline" size={18} color={COLORS.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.toleranceTitle}>{t('schedule.tolerancesTitle')}</Text>
                  <Text style={styles.toleranceText}>
                    {t('schedule.toleranceBefore')} <Text style={styles.toleranceVal}>{t('schedule.minutes', { count: activeRow.avantEnt ?? 0 })}</Text> · {t('schedule.toleranceAfter')} <Text style={styles.toleranceVal}>{t('schedule.minutes', { count: activeRow.avantSort ?? 0 })}</Text>
                  </Text>
                </View>
              </View>
            )}
          </>
        )}
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
  scrollContent: { padding: 20, paddingBottom: 120 },
  offlineBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff7e6', borderColor: '#fde2a7', borderWidth: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 16 },
  offlineText: { fontSize: 12, color: COLORS.warning, fontWeight: '700' },

  center: { paddingVertical: 60, alignItems: 'center', justifyContent: 'center' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.errorContainer, padding: 14, borderRadius: 12, marginBottom: 16 },
  errorText: { flex: 1, color: COLORS.error, fontSize: 13, fontWeight: '600' },
  emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: COLORS.onSurface, marginTop: 12 },
  emptySub: { fontSize: 13, color: '#94a3b8', textAlign: 'center', paddingHorizontal: 32 },

  posteSwitcher: { gap: 8, paddingBottom: 12 },
  posteChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  posteChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  posteChipText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  posteChipTextActive: { color: '#fff' },

  posteCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: COLORS.primary, borderRadius: 20, padding: 18, marginBottom: 16,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 4,
  },
  posteIconBox: { width: 52, height: 52, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  posteLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  posteName: { color: '#fff', fontSize: 17, fontWeight: '900', marginTop: 2 },
  posteCode: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600', marginTop: 2 },

  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, gap: 6 },
  statValue: { fontSize: 22, fontWeight: '900', color: COLORS.onSurface, marginTop: 4 },
  statLabel: { fontSize: 9, fontWeight: '900', color: '#94a3b8', letterSpacing: 1 },

  sectionTitle: { fontSize: 11, fontWeight: '900', color: '#64748b', letterSpacing: 1.2, marginBottom: 10, paddingHorizontal: 4 },

  dayCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  dayCardToday: { borderWidth: 2, borderColor: COLORS.primary },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dayBadge: {
    width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.primaryFixed,
    justifyContent: 'center', alignItems: 'center',
  },
  dayBadgeToday: { backgroundColor: COLORS.primary },
  dayShort: { fontSize: 14, fontWeight: '900', color: COLORS.primary },
  dayShortToday: { color: '#fff' },
  dayLabel: { fontSize: 14, fontWeight: '800', color: COLORS.onSurface },
  todayTag: { fontSize: 9, fontWeight: '900', color: COLORS.primary, letterSpacing: 1 },
  dayTotal: { fontSize: 11, color: '#64748b', fontWeight: '700', marginTop: 1 },
  dayReposLabel: { fontSize: 12, fontStyle: 'italic', color: '#94a3b8', marginTop: 1 },

  slotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  slotChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  slotText: { fontSize: 12, fontWeight: '700', color: COLORS.onSurface },
  dayUnplanned: { fontSize: 12, color: '#cbd5e1', fontStyle: 'italic' },

  toleranceCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.primaryFixed, borderRadius: 14, padding: 14, marginTop: 12,
  },
  toleranceTitle: { fontSize: 11, fontWeight: '900', color: COLORS.primary, letterSpacing: 0.5 },
  toleranceText: { fontSize: 12, color: COLORS.onSurface, marginTop: 2 },
  toleranceVal: { fontWeight: '800' },
});
