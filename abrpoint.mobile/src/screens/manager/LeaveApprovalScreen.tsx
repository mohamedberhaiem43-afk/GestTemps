import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../i18n';
import apiService from '../../services/api';
import { COLORS } from '../../config/env';
import DatePickerModal from '../../components/DatePickerModal';

// DemcongeEmpAbsDto: Concod, Soccod, Empcod, Condat, Condep, Conamdep, Conret, Conamret,
// Abscod, Conadr, Contel, Condg, Conrefus, Connbjour, Conref, Consolde, Etat + Emplib, Abslib
// Etat values: "En attente", "Accepté", "Refusé"

export default function LeaveApprovalScreen({ navigation }: any) {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const locale = lang === 'en' ? 'en-GB' : 'fr-FR';
  const [requests, setRequests] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'refused'>('pending');

  // Period filter
  const now = new Date();
  const [filterDebut, setFilterDebut] = useState(new Date(now.getFullYear(), 0, 1));
  const [filterFin, setFilterFin] = useState(new Date(now.getFullYear(), 11, 31));
  const [showFilterDebut, setShowFilterDebut] = useState(false);
  const [showFilterFin, setShowFilterFin] = useState(false);

  useEffect(() => { loadRequests(); }, [user, filterDebut, filterFin]);

  const loadRequests = async () => {
    if (!user?.soccod || !user?.uticod) return;
    try {
      const dd = fmt(filterDebut);
      const df = fmt(filterFin);
      let data: any[];
      try {
        data = await apiService.getAllLeaveRequestsByPeriod(user.soccod, user.uticod, dd, df);
      } catch {
        data = await apiService.getAllLeaveRequests(user.soccod, user.uticod);
      }
      setRequests(Array.isArray(data) ? data : []);
    } catch (e) { console.log('Requests load error:', e); }
    finally { setLoading(false); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadRequests(); setRefreshing(false); };

  const handleApprove = (req: any) => {
    Alert.alert(t('mgrLeave.approveTitle'), t('mgrLeave.approveConfirm', { name: req.emplib || req.empcod }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('mgrLeave.approveAction'), onPress: () => approveRequest(req) },
    ]);
  };

  const approveRequest = async (req: any) => {
    if (!user?.soccod) return;
    try {
      await apiService.acceptLeaveRequest(user.soccod, req.concod, req.empcod);
      Alert.alert(t('mgrLeave.successTitle'), t('mgrLeave.approvedMsg'));
      loadRequests();
    } catch (e) { Alert.alert(t('common.error'), t('mgrLeave.approveError')); }
  };

  const handleReject = (req: any) => {
    Alert.alert(t('mgrLeave.rejectTitle'), t('mgrLeave.rejectConfirm', { name: req.emplib || req.empcod }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('mgrLeave.rejectAction'), style: 'destructive', onPress: () => rejectRequest(req) },
    ]);
  };

  const rejectRequest = async (req: any) => {
    if (!user?.soccod) return;
    try {
      await apiService.refuseLeaveRequest(user.soccod, req.concod, req.empcod);
      Alert.alert(t('mgrLeave.refusedTitle'), t('mgrLeave.refusedMsg'));
      loadRequests();
    } catch (e) { Alert.alert(t('common.error'), t('mgrLeave.rejectError')); }
  };

  // Status helpers - backend returns exact French values
  const isPending = (etat: string) => !etat || etat === 'En attente';
  const isAccepted = (etat: string) => etat === 'Accepté';
  const isRefused = (etat: string) => etat === 'Refusé';

  const getFiltered = () => {
    if (filter === 'pending') return requests.filter((r: any) => isPending(r.etat));
    if (filter === 'accepted') return requests.filter((r: any) => isAccepted(r.etat));
    if (filter === 'refused') return requests.filter((r: any) => isRefused(r.etat));
    return requests;
  };

  const getStatusColor = (etat: string) => {
    if (isPending(etat)) return COLORS.warning;
    if (isAccepted(etat)) return COLORS.success;
    if (isRefused(etat)) return COLORS.error;
    return COLORS.warning;
  };

  const getStatusLabel = (etat: string) => {
    if (isPending(etat)) return '⏳ ' + t('mgrLeave.statusPending');
    if (isAccepted(etat)) return '✅ ' + t('mgrLeave.statusAccepted');
    if (isRefused(etat)) return '❌ ' + t('mgrLeave.statusRefused');
    return '⏳ ' + t('mgrLeave.statusPending');
  };

  const fmt = (d: Date) => d.toISOString().split('T')[0];
  const fmtDisplay = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    try { return new Date(dateStr).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }); }
    catch { return dateStr; }
  };

  const filteredRequests = getFiltered();
  const pendingCount = requests.filter(r => isPending(r.etat)).length;
  const acceptedCount = requests.filter(r => isAccepted(r.etat)).length;
  const refusedCount = requests.filter(r => isRefused(r.etat)).length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.backBtn}>← {t('common.back')}</Text></TouchableOpacity>
        <Text style={styles.title}>{t('mgrLeave.title')}</Text>
      </View>

      {/* Period Filter */}
      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>📆 {t('mgrLeave.filterByPeriod')}</Text>
        <View style={styles.filterRow}>
          <TouchableOpacity style={styles.filterDateBtn} onPress={() => setShowFilterDebut(true)}>
            <Text style={styles.filterDateText}>{t('mgrLeave.fromLabel')} {fmtDisplay(fmt(filterDebut))}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterDateBtn} onPress={() => setShowFilterFin(true)}>
            <Text style={styles.filterDateText}>{t('mgrLeave.toLabel')} {fmtDisplay(fmt(filterFin))}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Status filter */}
      <View style={styles.statusFilterRow}>
        {([
          { key: 'pending' as const, label: `⏳ ${t('mgrLeave.tabPending', { count: pendingCount })}` },
          { key: 'all' as const, label: `📋 ${t('mgrLeave.tabAll', { count: requests.length })}` },
          { key: 'accepted' as const, label: `✅ ${t('mgrLeave.tabAccepted', { count: acceptedCount })}` },
          { key: 'refused' as const, label: `❌ ${t('mgrLeave.tabRefused', { count: refusedCount })}` },
        ]).map((f) => (
          <TouchableOpacity key={f.key}
            style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]}
            onPress={() => setFilter(f.key)}>
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Date Pickers */}
      <DatePickerModal visible={showFilterDebut} value={filterDebut}
        onChange={(d) => { setFilterDebut(d); setShowFilterDebut(false); }}
        onClose={() => setShowFilterDebut(false)} title={t('mgrLeave.periodStart')} />
      <DatePickerModal visible={showFilterFin} value={filterFin}
        onChange={(d) => { setFilterFin(d); setShowFilterFin(false); }}
        onClose={() => setShowFilterFin(false)} title={t('mgrLeave.periodEnd')} />

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 12 }}>
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : filteredRequests.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyText}>{t('mgrLeave.emptyState')}</Text>
          </View>
        ) : (
          filteredRequests.map((req: any, i: number) => (
            <View key={req.concod || i} style={styles.requestCard}>
              <View style={styles.requestHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.empName}>{req.emplib || req.empcod || t('mgrLeave.employeeFallback')}</Text>
                  <Text style={styles.requestType}>{req.abslib || req.abscod || '-'}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(req.etat) }]}>
                  <Text style={styles.statusText}>{getStatusLabel(req.etat)}</Text>
                </View>
              </View>

              <View style={styles.requestDetails}>
                <Text style={styles.detailMain}>
                  🛫 {fmtDisplay(req.condep)} ({req.conamdep === '1' ? t('mgrLeave.morning') : t('mgrLeave.afternoon')})
                  {' → '}
                  🛬 {fmtDisplay(req.conret)} ({req.conamret === '1' ? t('mgrLeave.morning') : t('mgrLeave.afternoon')})
                </Text>
                {req.connbjour ? <Text style={styles.detailText}>📅 {t('mgrLeave.daysCount', { count: req.connbjour })}</Text> : null}
                {req.conadr ? <Text style={styles.detailText}>📍 {req.conadr}</Text> : null}
              </View>

              <View style={styles.requestFooter}>
                <Text style={styles.requestSysDate}>{t('mgrLeave.requestedOn', { date: fmtDisplay(req.condat) })}</Text>
                {isPending(req.etat) && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(req)}>
                      <Text style={styles.actionBtnText}>✅ {t('mgrLeave.acceptBtn')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(req)}>
                      <Text style={styles.actionBtnText}>❌ {t('mgrLeave.refuseBtn')}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 6 },
  backBtn: { fontSize: 16, color: COLORS.primary, fontWeight: '600', marginRight: 16 },
  title: { fontSize: 20, fontWeight: 'bold', color: COLORS.text },
  filterSection: { backgroundColor: '#fff', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  filterLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterDateBtn: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 8, backgroundColor: '#fafafa', alignItems: 'center' },
  filterDateText: { fontSize: 12, color: COLORS.text, fontWeight: '500' },
  statusFilterRow: { flexDirection: 'row', padding: 12, gap: 6, backgroundColor: '#fff', flexWrap: 'wrap' },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: COLORS.background },
  filterBtnActive: { backgroundColor: COLORS.primary },
  filterText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  filterTextActive: { color: '#fff' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: COLORS.textSecondary },
  requestCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  requestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  empName: { fontSize: 15, fontWeight: 'bold', color: COLORS.text },
  requestType: { fontSize: 12, color: COLORS.primary, fontWeight: '500', marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  requestDetails: { marginTop: 8, borderTopWidth: 1, borderTopColor: '#f5f5f5', paddingTop: 8 },
  detailMain: { fontSize: 13, color: COLORS.text, fontWeight: '500' },
  detailText: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  requestFooter: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f5f5f5' },
  requestSysDate: { fontSize: 10, color: COLORS.textSecondary, marginBottom: 4 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  approveBtn: { flex: 1, backgroundColor: COLORS.success, borderRadius: 8, padding: 10, alignItems: 'center' },
  rejectBtn: { flex: 1, backgroundColor: COLORS.error, borderRadius: 8, padding: 10, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },
});