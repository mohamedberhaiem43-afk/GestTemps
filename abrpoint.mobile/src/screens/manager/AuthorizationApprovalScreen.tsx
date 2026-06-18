import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
  RefreshControl, ActivityIndicator, Modal, TextInput, Platform, KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../i18n';
import apiService from '../../services/api';
import { COLORS } from '../../config/env';

// Statut backend : "En attente" / "Approuvé" / "Refusé" (ou variantes "Accept…" / "Refus…").
// On s'aligne sur le helper utilisé dans DemandeAutorisationScreen côté employé.
type StatusKey = 'pending' | 'approved' | 'refused';

const fmtDate = (d: string | null | undefined, locale: string) => {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  catch { return d; }
};

const fmtTime = (d: string | null | undefined, locale: string) => {
  if (!d) return '';
  try { return new Date(d).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
};

const getStatus = (statut: string | null | undefined): 'Approuvé' | 'Refusé' | 'En attente' => {
  const s = (statut || '').trim();
  if (s.includes('Approuv') || s.includes('Accept')) return 'Approuvé';
  if (s.includes('Refus')) return 'Refusé';
  return 'En attente';
};

export default function AuthorizationApprovalScreen({ navigation }: any) {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const locale = lang === 'en' ? 'en-GB' : 'fr-FR';
  const [requests, setRequests] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusKey | 'all'>('pending');

  // Modal motif refus / commentaire optionnel approbation.
  const [actionModal, setActionModal] = useState<{ kind: 'approve' | 'refuse'; req: any } | null>(null);
  const [commentaire, setCommentaire] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadRequests(); }, [user?.soccod, user?.uticod]);

  const loadRequests = async () => {
    if (!user?.soccod || !user?.uticod) return;
    try {
      const data = await apiService.getDemandeAutorisations(user.soccod, user.uticod);
      setRequests(Array.isArray(data) ? data : []);
    } catch (e) {
      console.log('Authorization requests load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => { setRefreshing(true); await loadRequests(); setRefreshing(false); };

  const openApprove = (req: any) => { setCommentaire(''); setActionModal({ kind: 'approve', req }); };
  const openRefuse = (req: any) => { setCommentaire(''); setActionModal({ kind: 'refuse', req }); };

  const submitAction = async () => {
    if (!actionModal || !user?.uticod) return;
    const { kind, req } = actionModal;
    if (kind === 'refuse' && commentaire.trim().length === 0) {
      Alert.alert(t('mgrAuth.reasonRequiredTitle'), t('mgrAuth.reasonRequiredMsg'));
      return;
    }
    setSubmitting(true);
    try {
      if (kind === 'approve') {
        await apiService.approveDemandeAutorisation(req.id, user.uticod, commentaire.trim() || undefined);
      } else {
        await apiService.refuseDemandeAutorisation(req.id, user.uticod, commentaire.trim());
      }
      setActionModal(null);
      setCommentaire('');
      await loadRequests();
      Alert.alert(
        kind === 'approve' ? t('mgrAuth.approvedTitle') : t('mgrAuth.refusedTitle'),
        kind === 'approve' ? t('mgrAuth.approvedMsg') : t('mgrAuth.refusedMsg'),
      );
    } catch (e: any) {
      Alert.alert(
        t('common.error'),
        e?.response?.data?.message || (kind === 'approve' ? t('mgrAuth.approveFailed') : t('mgrAuth.refuseFailed')),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const isPending = (r: any) => getStatus(r.statut) === 'En attente';
  const isApproved = (r: any) => getStatus(r.statut) === 'Approuvé';
  const isRefused = (r: any) => getStatus(r.statut) === 'Refusé';

  const filtered = requests.filter(r => {
    if (filter === 'pending') return isPending(r);
    if (filter === 'approved') return isApproved(r);
    if (filter === 'refused') return isRefused(r);
    return true;
  });

  const pendingCount = requests.filter(isPending).length;
  const approvedCount = requests.filter(isApproved).length;
  const refusedCount = requests.filter(isRefused).length;

  const statusBadge = (statut: string | null | undefined) => {
    const s = getStatus(statut);
    if (s === 'Approuvé') return { label: t('mgrAuth.badgeApproved'), color: COLORS.success };
    if (s === 'Refusé') return { label: t('mgrAuth.badgeRefused'), color: COLORS.error };
    return { label: t('mgrAuth.badgePending'), color: COLORS.warning };
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.backBtn}>← {t('common.back')}</Text></TouchableOpacity>
        <Text style={styles.title}>{t('mgrAuth.title')}</Text>
      </View>

      <View style={styles.statusFilterRow}>
        {([
          { key: 'pending', label: t('mgrAuth.filterPending', { count: pendingCount }) },
          { key: 'all', label: t('mgrAuth.filterAll', { count: requests.length }) },
          { key: 'approved', label: t('mgrAuth.filterApproved', { count: approvedCount }) },
          { key: 'refused', label: t('mgrAuth.filterRefused', { count: refusedCount }) },
        ] as const).map(f => (
          <TouchableOpacity key={f.key}
            style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]}
            onPress={() => setFilter(f.key)}>
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 12 }}>
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyText}>{t('mgrAuth.emptyState')}</Text>
          </View>
        ) : (
          filtered.map(req => {
            const badge = statusBadge(req.statut);
            return (
              <View key={req.id} style={styles.requestCard}>
                <View style={styles.requestHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.empName}>{req.emplib || req.empcod || t('mgrAuth.employeeFallback')}</Text>
                    <Text style={styles.requestType}>{req.abslib || req.abscod || t('mgrAuth.outingFallback')}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: badge.color }]}>
                    <Text style={styles.statusText}>{badge.label}</Text>
                  </View>
                </View>

                <View style={styles.requestDetails}>
                  <Text style={styles.detailMain}>
                    🛫 {fmtDate(req.condep, locale)} {fmtTime(req.condep, locale)}
                    {'  →  '}
                    🛬 {fmtDate(req.conret, locale)} {fmtTime(req.conret, locale)}
                  </Text>
                  {req.connbjour ? <Text style={styles.detailText}>{t('mgrAuth.duration', { hours: req.connbjour })}</Text> : null}
                  {req.conmotif ? <Text style={styles.detailText}>📝 {req.conmotif}</Text> : null}
                </View>

                <View style={styles.requestFooter}>
                  <Text style={styles.requestSysDate}>{t('mgrAuth.requestedOn', { date: fmtDate(req.dateDemande || req.condat, locale) })}</Text>
                  {!isPending(req) && req.traitePar ? (
                    <Text style={styles.requestSysDate}>
                      {t('mgrAuth.processedBy', { name: req.traitePar })}{req.dateTraitement ? ` · ${fmtDate(req.dateTraitement, locale)}` : ''}
                    </Text>
                  ) : null}
                  {!isPending(req) && req.commentaire ? (
                    <Text style={styles.commentLine}>💬 {req.commentaire}</Text>
                  ) : null}

                  {isPending(req) && (
                    <View style={styles.actionRow}>
                      <TouchableOpacity style={styles.approveBtn} onPress={() => openApprove(req)}>
                        <Text style={styles.actionBtnText}>{t('mgrAuth.approveBtn')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.rejectBtn} onPress={() => openRefuse(req)}>
                        <Text style={styles.actionBtnText}>{t('mgrAuth.refuseBtn')}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Modal de confirmation : optionnel pour approve, motif requis pour refuse */}
      <Modal
        visible={actionModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => !submitting && setActionModal(null)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {actionModal?.kind === 'approve' ? t('mgrAuth.modalApproveTitle') : t('mgrAuth.modalRefuseTitle')}
            </Text>
            <Text style={styles.modalSub}>
              {actionModal?.kind === 'approve'
                ? t('mgrAuth.modalApproveSub')
                : t('mgrAuth.modalRefuseSub')}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder={actionModal?.kind === 'approve' ? t('mgrAuth.commentPlaceholder') : t('mgrAuth.reasonPlaceholder')}
              placeholderTextColor={COLORS.outline}
              value={commentaire}
              onChangeText={setCommentaire}
              multiline
              numberOfLines={3}
              editable={!submitting}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancel]}
                disabled={submitting}
                onPress={() => { setActionModal(null); setCommentaire(''); }}>
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, actionModal?.kind === 'approve' ? styles.modalApprove : styles.modalRefuse, submitting && { opacity: 0.6 }]}
                disabled={submitting}
                onPress={submitAction}>
                {submitting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.modalSubmitText}>{actionModal?.kind === 'approve' ? t('mgrAuth.modalApproveSubmit') : t('mgrAuth.modalRefuseSubmit')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 6 },
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
  commentLine: { fontSize: 12, color: COLORS.textSecondary, fontStyle: 'italic', marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  approveBtn: { flex: 1, backgroundColor: COLORS.success, borderRadius: 8, padding: 10, alignItems: 'center' },
  rejectBtn: { flex: 1, backgroundColor: COLORS.error, borderRadius: 8, padding: 10, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontSize: 13, fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: COLORS.text, marginBottom: 4 },
  modalSub: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 14 },
  modalInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 12,
    minHeight: 80, textAlignVertical: 'top', fontSize: 14, color: COLORS.text, marginBottom: 16,
  },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalBtn: { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center' },
  modalCancel: { backgroundColor: COLORS.background },
  modalCancelText: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  modalApprove: { backgroundColor: COLORS.success },
  modalRefuse: { backgroundColor: COLORS.error },
  modalSubmitText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
