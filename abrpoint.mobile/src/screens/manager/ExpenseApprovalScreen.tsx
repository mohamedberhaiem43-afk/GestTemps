import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, ActivityIndicator, Image, Modal, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../i18n';
import apiService from '../../services/api';
import { COLORS } from '../../config/env';
import { resolveAssetUrl } from '../../config/assetUrl';

// Admin expense approval screen
// Etat values: "Pending", "Approved", "Rejected", "Reimbursed"

type Filter = 'all' | 'pending' | 'approved' | 'rejected';

export default function ExpenseApprovalScreen({ navigation }: any) {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const locale = lang === 'en' ? 'en-GB' : 'fr-FR';
  const [expenses, setExpenses] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('pending');
  const [previewUri, setPreviewUri] = useState<string | null>(null);

  useEffect(() => { loadExpenses(); }, [user]);

  const loadExpenses = async () => {
    if (!user?.soccod) return;
    try {
      const data = await apiService.getAllExpenses(user.soccod);
      setExpenses(Array.isArray(data) ? data : []);
    } catch (e) { console.log('Expenses load error:', e); }
    finally { setLoading(false); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadExpenses(); setRefreshing(false); };

  const handleApprove = (exp: any) => {
    Alert.alert(t('mgrExpense.approve'), t('mgrExpense.approveConfirm', { title: exp.titre, amount: (exp.montant ?? 0).toFixed(2) }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('mgrExpense.approve'), onPress: async () => {
        try {
          await apiService.updateExpenseStatus(exp.id, 'Approved');
          Alert.alert(t('mgrExpense.successTitle'), t('mgrExpense.expenseApproved'));
          loadExpenses();
        } catch { Alert.alert(t('common.error'), t('mgrExpense.approveError')); }
      }},
    ]);
  };

  const handleReject = (exp: any) => {
    Alert.alert(t('mgrExpense.reject'), t('mgrExpense.rejectConfirm', { title: exp.titre }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('mgrExpense.reject'), style: 'destructive', onPress: async () => {
        try {
          await apiService.updateExpenseStatus(exp.id, 'Rejected');
          Alert.alert(t('mgrExpense.rejectedTitle'), t('mgrExpense.expenseRejected'));
          loadExpenses();
        } catch { Alert.alert(t('common.error'), t('mgrExpense.rejectError')); }
      }},
    ]);
  };

  const handleDelete = (exp: any) => {
    Alert.alert(t('common.delete'), t('mgrExpense.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => {
        try { await apiService.deleteExpense(exp.id); loadExpenses(); }
        catch { Alert.alert(t('common.error'), t('mgrExpense.deleteError')); }
      }},
    ]);
  };

  const isPending = (e: string) => !e || e === 'Pending';
  const isApproved = (e: string) => e === 'Approved';
  const isRejected = (e: string) => e === 'Rejected';

  const getEtatLabel = (etat: string) => {
    switch (etat) {
      case 'Approved': return `✅ ${t('mgrExpense.statusApproved')}`;
      case 'Pending': return `⏳ ${t('mgrExpense.statusPending')}`;
      case 'Rejected': return `❌ ${t('mgrExpense.statusRejected')}`;
      case 'Reimbursed': return `💰 ${t('mgrExpense.statusReimbursed')}`;
      default: return `⏳ ${t('mgrExpense.statusPending')}`;
    }
  };

  const getEtatColor = (etat: string) => {
    switch (etat) {
      case 'Approved': return COLORS.success;
      case 'Pending': return COLORS.warning;
      case 'Rejected': return COLORS.error;
      case 'Reimbursed': return '#4caf50';
      default: return COLORS.warning;
    }
  };

  const filtered = expenses.filter((exp: any) => {
    if (filter === 'pending') return isPending(exp.etat);
    if (filter === 'approved') return isApproved(exp.etat);
    if (filter === 'rejected') return isRejected(exp.etat);
    return true;
  });

  const pendingC = expenses.filter(e => isPending(e.etat)).length;
  const approvedC = expenses.filter(e => isApproved(e.etat)).length;
  const rejectedC = expenses.filter(e => isRejected(e.etat)).length;

  const fmtDate = (d: string) => {
    if (!d) return '-';
    try { return new Date(d).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }); }
    catch { return d; }
  };

  const fmtMoney = (n: number) => n?.toLocaleString(locale, { style: 'currency', currency: 'EUR' }) || '-';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.backBtn}>← {t('common.back')}</Text></TouchableOpacity>
        <Text style={styles.title}>{t('mgrExpense.title')}</Text>
      </View>

      <View style={styles.statusFilterRow}>
        {([
          { key: 'pending' as const, label: `⏳ ${t('mgrExpense.filterPending', { count: pendingC })}` },
          { key: 'all' as const, label: `📋 ${t('mgrExpense.filterAll', { count: expenses.length })}` },
          { key: 'approved' as const, label: `✅ ${t('mgrExpense.filterApproved', { count: approvedC })}` },
          { key: 'rejected' as const, label: `❌ ${t('mgrExpense.filterRejected', { count: rejectedC })}` },
        ]).map((f) => (
          <TouchableOpacity key={f.key}
            style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]}
            onPress={() => setFilter(f.key)}>
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 12 }}>
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💰</Text>
            <Text style={styles.emptyText}>{t('mgrExpense.emptyText')}</Text>
          </View>
        ) : (
          filtered.map((exp: any) => (
            <View key={exp.id} style={styles.expCard}>
              <View style={styles.expHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.expTitle}>{exp.titre}</Text>
                  <Text style={styles.expEmp}>👤 {exp.empcod || '-'}</Text>
                  <Text style={styles.expCat}>{exp.categorie}{exp.projet ? ` • ${exp.projet}` : ''}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getEtatColor(exp.etat) }]}>
                  <Text style={styles.statusText}>{getEtatLabel(exp.etat)}</Text>
                </View>
              </View>

              <View style={styles.expDetails}>
                <Text style={styles.expAmount}>{fmtMoney(exp.montant)}</Text>
                <Text style={styles.expDate}>📅 {fmtDate(exp.dateDepense)}</Text>
              </View>

              {exp.justificatif ? (
                <TouchableOpacity
                  style={styles.justifRow}
                  onPress={() => setPreviewUri(resolveAssetUrl(exp.justificatif))}
                  activeOpacity={0.8}
                >
                  <Image
                    source={{ uri: resolveAssetUrl(exp.justificatif) }}
                    style={styles.justifThumb}
                    resizeMode="cover"
                  />
                  <Text style={styles.justifLink}>📎 {t('mgrExpense.viewReceipt')}</Text>
                </TouchableOpacity>
              ) : null}

              <View style={styles.expFooter}>
                <Text style={styles.expCreated}>{t('mgrExpense.createdAt', { date: fmtDate(exp.createdAt) })}</Text>
                <View style={styles.actionRow}>
                  {isPending(exp.etat) && (
                    <>
                      <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(exp)}>
                        <Text style={styles.actionBtnText}>✅ {t('mgrExpense.approve')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(exp)}>
                        <Text style={styles.actionBtnText}>❌ {t('mgrExpense.reject')}</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  <TouchableOpacity onPress={() => handleDelete(exp)}>
                    <Text style={styles.deleteBtn}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={!!previewUri} transparent animationType="fade" onRequestClose={() => setPreviewUri(null)}>
        <View style={styles.previewOverlay}>
          <TouchableOpacity style={styles.previewClose} onPress={() => setPreviewUri(null)}>
            <Text style={styles.previewCloseText}>✕</Text>
          </TouchableOpacity>
          {previewUri ? (
            <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="contain" />
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', elevation: 2 },
  backBtn: { fontSize: 16, color: COLORS.primary, fontWeight: '600', marginRight: 16 },
  title: { fontSize: 20, fontWeight: 'bold', color: COLORS.text },
  statusFilterRow: { flexDirection: 'row', padding: 12, gap: 6, backgroundColor: '#fff', flexWrap: 'wrap' },
  filterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: COLORS.background },
  filterBtnActive: { backgroundColor: COLORS.primary },
  filterText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },
  filterTextActive: { color: '#fff' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: COLORS.textSecondary },
  expCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, elevation: 1 },
  expHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  expTitle: { fontSize: 15, fontWeight: 'bold', color: COLORS.text },
  expEmp: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  expCat: { fontSize: 12, color: COLORS.primary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  expDetails: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f5f5f5' },
  expAmount: { fontSize: 16, fontWeight: 'bold', color: COLORS.success },
  expDate: { fontSize: 12, color: COLORS.textSecondary },
  justifRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, padding: 6, backgroundColor: '#f8fafc', borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' },
  justifThumb: { width: 56, height: 56, borderRadius: 6, backgroundColor: '#e2e8f0' },
  justifLink: { fontSize: 13, color: COLORS.primary, fontWeight: '600', flex: 1 },
  previewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  previewImage: { width: Dimensions.get('window').width, height: Dimensions.get('window').height * 0.85 },
  previewClose: { position: 'absolute', top: 40, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.18)', justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  previewCloseText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  expFooter: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f5f5f5' },
  expCreated: { fontSize: 10, color: COLORS.textSecondary, marginBottom: 4 },
  actionRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  approveBtn: { backgroundColor: COLORS.success, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  rejectBtn: { backgroundColor: COLORS.error, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  actionBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  deleteBtn: { fontSize: 16, color: COLORS.error },
});