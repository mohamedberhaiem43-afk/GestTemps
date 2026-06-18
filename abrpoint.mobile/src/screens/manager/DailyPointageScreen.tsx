import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, FlatList,
  RefreshControl, ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../i18n';
import apiService from '../../services/api';
import { COLORS } from '../../config/env';

interface PointageEntry {
  empcod: string;
  emplib: string;
  empmat: string;
  codposte: string;
  poslib: string;
  entree1: string;
  sortie1: string;
  entree2: string;
  sortie2: string;
  totalHeure: string;
  status: string; // "present", "absent", "conge", "repos", "ferie", "en_cours"
  motif: string;
  isExpected: boolean;
}

export default function DailyPointageScreen({ navigation }: any) {
  const { user, isEmployee } = useAuth();
  const { t, lang } = useI18n();
  const locale = lang === 'en' ? 'en-GB' : 'fr-FR';
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [pointageData, setPointageData] = useState<PointageEntry[]>([]);
  const [filteredData, setFilteredData] = useState<PointageEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (date?: string) => {
    if (!user?.soccod) return;
    setLoading(true);
    try {
      const targetDate = date || selectedDate;
      const data = await apiService.getDailyPointage(user.soccod, targetDate);
      const entries: PointageEntry[] = data || [];
      setPointageData(entries);
      applyFilter(entries, searchQuery);
    } catch (error) {
      console.log('Failed to load pointage data:', error);
      setPointageData([]);
      setFilteredData([]);
    } finally {
      setLoading(false);
    }
  }, [user?.soccod, selectedDate, searchQuery]);

  const applyFilter = (data: PointageEntry[], query: string) => {
    if (!query.trim()) {
      setFilteredData(data);
      return;
    }
    const q = query.toLowerCase();
    setFilteredData(data.filter(e =>
      (e.emplib || '').toLowerCase().includes(q) ||
      (e.empcod || '').toLowerCase().includes(q)
    ));
  };

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const changeDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    const newDate = d.toISOString().split('T')[0];
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const formatDateDisplay = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(locale, {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  };

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  const stats = {
    total: filteredData.length,
    presents: filteredData.filter(e => e.status === 'present' || e.status === 'en_cours').length,
    absents: filteredData.filter(e => e.status === 'absent').length,
    enRetard: filteredData.filter(e => e.motif && e.motif.toLowerCase().includes('retard')).length,
    enConge: filteredData.filter(e => e.status === 'conge').length,
    enRepos: filteredData.filter(e => e.status === 'repos').length,
    enCours: filteredData.filter(e => e.status === 'en_cours').length,
  };

  const renderEntry = ({ item, index }: { item: PointageEntry; index: number }) => {
    let statusColor = '#94a3b8';
    let statusText = t('mgrPointage.statusAbsent');
    let statusBg = '#f1f5f9';
    let statusIcon = '⛔';

    switch (item.status) {
      case 'present':
        statusColor = '#16a34a'; statusText = t('mgrPointage.statusCompleted'); statusBg = '#dcfce7'; statusIcon = '✅';
        break;
      case 'en_cours':
        statusColor = '#2563eb'; statusText = t('mgrPointage.statusInProgress'); statusBg = '#dbeafe'; statusIcon = '🔄';
        break;
      case 'absent':
        statusColor = '#dc2626'; statusText = t('mgrPointage.statusAbsent'); statusBg = '#fee2e2'; statusIcon = '⛔';
        break;
      case 'conge':
        statusColor = '#d97706'; statusText = item.motif || t('mgrPointage.statusLeave'); statusBg = '#fef3c7'; statusIcon = '🏖️';
        break;
      case 'repos':
        statusColor = '#8b5cf6'; statusText = t('mgrPointage.statusRest'); statusBg = '#ede9fe'; statusIcon = '😴';
        break;
      case 'ferie':
        statusColor = '#0891b2'; statusText = item.motif || t('mgrPointage.statusHoliday'); statusBg = '#cffafe'; statusIcon = '🎉';
        break;
    }

    return (
      <View style={[styles.row, index % 2 === 0 && styles.rowEven]}>
        <View style={styles.rowMain}>
          <View style={styles.empInfo}>
            <Text style={styles.empName}>{item.emplib || item.empcod}</Text>
            <Text style={styles.empCode}>{item.empcod} {item.poslib ? `• ${item.poslib}` : ''}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{statusIcon} {statusText}</Text>
          </View>
        </View>
        <View style={styles.timeRow}>
          <View style={styles.timeSlot}>
            <Text style={styles.timeLabel}>E1</Text>
            <Text style={styles.timeValue}>{item.entree1 || '—'}</Text>
          </View>
          <View style={styles.timeSlot}>
            <Text style={styles.timeLabel}>S1</Text>
            <Text style={styles.timeValue}>{item.sortie1 || '—'}</Text>
          </View>
          <View style={styles.timeSlot}>
            <Text style={styles.timeLabel}>E2</Text>
            <Text style={styles.timeValue}>{item.entree2 || '—'}</Text>
          </View>
          <View style={styles.timeSlot}>
            <Text style={styles.timeLabel}>S2</Text>
            <Text style={styles.timeValue}>{item.sortie2 || '—'}</Text>
          </View>
          <View style={styles.timeSlot}>
            <Text style={styles.timeLabel}>{t('mgrPointage.total')}</Text>
            <Text style={[styles.timeValue, { fontWeight: '700', color: '#0d1f3c' }]}>
              {item.totalHeure || '00:00'}
            </Text>
          </View>
        </View>
        {item.motif && (item.status === 'absent' || item.status === 'conge') && (
          <Text style={styles.etatText}>📋 {item.motif}</Text>
        )}
      </View>
    );
  };

  if (isEmployee) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.accessDenied}>
          <Text style={styles.accessDeniedIcon}>🔒</Text>
          <Text style={styles.accessDeniedText}>{t('mgrPointage.accessDenied')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← {t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>📋 {t('mgrPointage.title')}</Text>
      </View>

      {/* Date Navigation */}
      <View style={styles.dateNav}>
        <TouchableOpacity style={styles.dateArrow} onPress={() => changeDate(-1)}>
          <Text style={styles.dateArrowText}>◀</Text>
        </TouchableOpacity>
        <View style={styles.dateCenter}>
          <Text style={styles.dateDisplay}>{formatDateDisplay(selectedDate)}</Text>
          {!isToday && (
            <TouchableOpacity onPress={goToToday} style={styles.todayBtn}>
              <Text style={styles.todayBtnText}>{t('common.today')}</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.dateArrow} onPress={() => changeDate(1)}>
          <Text style={styles.dateArrowText}>▶</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderLeftColor: '#2563eb' }]}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>{t('mgrPointage.total')}</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: '#16a34a' }]}>
          <Text style={styles.statValue}>{stats.presents}</Text>
          <Text style={styles.statLabel}>{t('mgrPointage.present')}</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: '#dc2626' }]}>
          <Text style={styles.statValue}>{stats.absents}</Text>
          <Text style={styles.statLabel}>{t('mgrPointage.absent')}</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: '#d97706' }]}>
          <Text style={styles.statValue}>{stats.enConge}</Text>
          <Text style={styles.statLabel}>{t('mgrPointage.leaveAbs')}</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder={t('mgrPointage.searchPlaceholder')}
          value={searchQuery}
          onChangeText={(q) => { setSearchQuery(q); applyFilter(pointageData, q); }}
          placeholderTextColor="#94a3b8"
        />
      </View>

      {/* Data */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('mgrPointage.loadingPointage')}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredData}
          keyExtractor={(item, i) => `${item.empcod}_${i}`}
          renderItem={renderEntry}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📊</Text>
              <Text style={styles.emptyText}>{t('mgrPointage.empty')}</Text>
            </View>
          }
          contentContainerStyle={filteredData.length === 0 ? { flex: 1 } : { paddingBottom: 20 }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4,
  },
  backBtn: { padding: 8 },
  backBtnText: { fontSize: 15, color: COLORS.primary, fontWeight: '600' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.text, marginLeft: 8 },
  dateNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e8ecf0',
  },
  dateArrow: { padding: 12 },
  dateArrowText: { fontSize: 16, color: COLORS.primary, fontWeight: '600' },
  dateCenter: { alignItems: 'center' },
  dateDisplay: { fontSize: 14, fontWeight: '600', color: COLORS.text, textAlign: 'center' },
  todayBtn: { marginTop: 4, paddingHorizontal: 12, paddingVertical: 3, backgroundColor: '#dbeafe', borderRadius: 10 },
  todayBtnText: { fontSize: 11, color: '#2563eb', fontWeight: '600' },
  statsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 10,
    borderLeftWidth: 3, elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4,
  },
  statValue: { fontSize: 20, fontWeight: 'bold', color: COLORS.text },
  statLabel: { fontSize: 9, color: '#64748b', fontWeight: '600', textTransform: 'uppercase', marginTop: 2 },
  searchContainer: { paddingHorizontal: 12, paddingBottom: 8 },
  searchInput: {
    backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, borderWidth: 1, borderColor: '#e8ecf0',
  },
  row: { backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 6, borderRadius: 10, padding: 12, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  rowEven: { backgroundColor: '#f8fafc' },
  rowMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  empInfo: { flex: 1 },
  empName: { fontSize: 14, fontWeight: '700', color: '#0d1f3c' },
  empCode: { fontSize: 11, color: '#64748b', marginTop: 1 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusText: { fontSize: 10, fontWeight: '700' },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  timeSlot: { flex: 1, alignItems: 'center' },
  timeLabel: { fontSize: 9, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' },
  timeValue: { fontSize: 12, fontWeight: '600', color: '#334155', fontFamily: 'monospace', marginTop: 2 },
  etatText: { fontSize: 11, color: '#d97706', marginTop: 6, fontStyle: 'italic' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 8, color: '#64748b', fontSize: 13 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 40, marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#64748b' },
  accessDenied: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  accessDeniedIcon: { fontSize: 48, marginBottom: 12 },
  accessDeniedText: { fontSize: 16, color: '#64748b', fontWeight: '600' },
});