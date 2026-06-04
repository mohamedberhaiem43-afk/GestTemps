import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Modal, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS } from '../config/env';
import { useI18n } from '../i18n';
import apiService from '../services/api';
import DatePickerModal from '../components/DatePickerModal';
import BottomTabBar, { useTabBarPadding } from '../components/BottomTabBar';

/**
 * Écran « Mes demandes de télétravail » côté mobile.
 *
 * Volontairement minimal : pas de KPIs / pas de calendrier (cf. LeaveRequestScreen
 * qui empile beaucoup de widgets — on ne reproduit pas tout ce chrome ici, le
 * télétravail est un flux léger). Liste + bouton « Nouvelle demande » +
 * annulation tant que c'est en Pending.
 *
 * API : /Teletravail/me (liste), /Teletravail (création), /Teletravail/{id}/cancel.
 * Côté backend, le caller (claim NameIdentifier == Uticod == Empcod) est résolu
 * automatiquement, donc rien à passer en URL.
 */
type Status = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';

interface RemoteWorkRequest {
  id: number;
  empcod: string | null;
  employeeName: string | null;
  requestedAt: string;
  startDate: string;
  endDate: string;
  daysCount: number | null;
  reason: string | null;
  status: Status;
  decidedBy: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionComment: string | null;
}

const STATUS_LABEL_KEY: Record<Status, string> = {
  Pending: 'teletravail.statusPending',
  Approved: 'teletravail.statusApproved',
  Rejected: 'teletravail.statusRejected',
  Cancelled: 'teletravail.statusCancelled',
};
const STATUS_COLOR: Record<Status, { bg: string; fg: string }> = {
  Pending:   { bg: '#fef9c3', fg: '#854d0e' },
  Approved:  { bg: '#dcfce7', fg: '#166534' },
  Rejected:  { bg: '#fee2e2', fg: '#991b1b' },
  Cancelled: { bg: '#e2e8f0', fg: '#475569' },
};

const fmt = (iso: string | null | undefined, locale: string) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso; }
};

export default function TeletravailScreen({ navigation }: any) {
  const tabBarPadding = useTabBarPadding();
  const { t, lang } = useI18n();
  const locale = lang === 'en' ? 'en-GB' : 'fr-FR';
  const [items, setItems] = useState<RemoteWorkRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const today = new Date();
  const [startDate, setStartDate] = useState<Date>(today);
  const [endDate, setEndDate] = useState<Date>(today);
  const [reason, setReason] = useState('');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiService.listMyRemoteWorkRequests();
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      // 402 plan_feature_locked = pack ne couvre pas le télétravail.
      // 401 = session expirée → AuthContext gère le redirect.
      const status = e?.response?.status;
      if (status !== 401 && status !== 402) {
        console.log('Failed to load télétravail requests:', e);
      }
      setItems([]);
    }
  }, []);

  useEffect(() => {
    (async () => { setLoading(true); await load(); setLoading(false); })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const resetForm = () => {
    const d = new Date();
    setStartDate(d);
    setEndDate(d);
    setReason('');
  };

  const submit = async () => {
    if (endDate < startDate) {
      Alert.alert(t('teletravail.invalidDatesTitle'), t('teletravail.invalidDatesMsg'));
      return;
    }
    setSubmitting(true);
    try {
      // Format ISO date (yyyy-mm-dd) — le backend parse en DateTime puis tronque
      // sur Date(). On utilise toISOString() puis on coupe au T.
      const isoDate = (d: Date) => d.toISOString().split('T')[0];
      await apiService.createRemoteWorkRequest({
        startDate: isoDate(startDate),
        endDate: isoDate(endDate),
        reason: reason.trim() || null,
      });
      Alert.alert(t('teletravail.sentTitle'), t('teletravail.sentMsg'));
      setShowForm(false);
      resetForm();
      await load();
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? t('teletravail.sendError');
      Alert.alert(t('common.error'), msg);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmCancel = (item: RemoteWorkRequest) => {
    Alert.alert(
      t('teletravail.cancelTitle'),
      t('teletravail.cancelConfirm', { start: fmt(item.startDate, locale), end: fmt(item.endDate, locale) }),
      [
        { text: t('teletravail.keep'), style: 'cancel' },
        {
          text: t('teletravail.cancelTitle'),
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.cancelRemoteWorkRequest(item.id);
              await load();
            } catch (e: any) {
              const msg = e?.response?.data?.error ?? t('teletravail.cancelError');
              Alert.alert(t('common.error'), msg);
            }
          },
        },
      ]
    );
  };

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
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{t('teletravail.title')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: tabBarPadding + 80 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {items.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons name="home-account" size={48} color="#94a3b8" />
            <Text style={styles.emptyTitle}>{t('teletravail.emptyTitle')}</Text>
            <Text style={styles.emptySub}>{t('teletravail.emptySub')}</Text>
          </View>
        ) : items.map((it) => {
          const c = STATUS_COLOR[it.status];
          return (
            <View key={it.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.badge, { backgroundColor: c.bg }]}>
                  <Text style={[styles.badgeText, { color: c.fg }]}>{t(STATUS_LABEL_KEY[it.status])}</Text>
                </View>
                {it.daysCount != null && (
                  <Text style={styles.daysText}>
                    {it.daysCount > 1
                      ? t('teletravail.daysPlural', { count: it.daysCount })
                      : t('teletravail.daysSingular', { count: it.daysCount })}
                  </Text>
                )}
              </View>
              <Text style={styles.datesText}>
                {t('teletravail.fromLabel')} <Text style={styles.bold}>{fmt(it.startDate, locale)}</Text> {t('teletravail.toLabel')} <Text style={styles.bold}>{fmt(it.endDate, locale)}</Text>
              </Text>
              {!!it.reason && <Text style={styles.reasonText}>« {it.reason} »</Text>}
              {it.status === 'Rejected' && !!it.decisionComment && (
                <View style={[styles.alertBox, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
                  <Text style={[styles.alertText, { color: '#991b1b' }]}>{t('teletravail.rejectReason', { comment: it.decisionComment })}</Text>
                </View>
              )}
              {it.status === 'Approved' && !!it.decisionComment && (
                <View style={[styles.alertBox, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                  <Text style={[styles.alertText, { color: '#166534' }]}>{it.decisionComment}</Text>
                </View>
              )}
              <Text style={styles.metaText}>
                {t('teletravail.submittedOn', { date: fmt(it.requestedAt, locale) })}
                {it.decidedAt && it.decidedByName ? t('teletravail.decidedOn', { date: fmt(it.decidedAt, locale), name: it.decidedByName }) : ''}
              </Text>
              {it.status === 'Pending' && (
                <TouchableOpacity style={styles.cancelBtn} onPress={() => confirmCancel(it)}>
                  <MaterialCommunityIcons name="close-circle-outline" size={18} color="#991b1b" />
                  <Text style={styles.cancelBtnText}>{t('teletravail.cancelMyRequest')}</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>

      <TouchableOpacity style={[styles.fab, { bottom: tabBarPadding + 16 }]} onPress={() => { resetForm(); setShowForm(true); }}>
        <MaterialCommunityIcons name="plus" size={26} color="#fff" />
        <Text style={styles.fabText}>{t('teletravail.newRequest')}</Text>
      </TouchableOpacity>

      {/* Formulaire de création — Modal plein écran pour rester cohérent avec
          le pattern utilisé par LeaveRequestScreen et DemandeAutorisationScreen. */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowForm(false)}>
        <SafeAreaView style={styles.container}>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => setShowForm(false)} style={styles.iconBtn}>
              <MaterialCommunityIcons name="close" size={24} color={COLORS.primary} />
            </TouchableOpacity>
            <Text style={styles.topTitle}>{t('teletravail.newRequest')}</Text>
            <View style={{ width: 32 }} />
          </View>
          <ScrollView contentContainerStyle={styles.scroll}>
            <View style={styles.formField}>
              <Text style={styles.label}>{t('teletravail.startDate')}</Text>
              <TouchableOpacity style={styles.dateField} onPress={() => setShowStartPicker(true)}>
                <MaterialCommunityIcons name="calendar" size={20} color={COLORS.primary} />
                <Text style={styles.dateText}>{fmt(startDate.toISOString(), locale)}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.formField}>
              <Text style={styles.label}>{t('teletravail.endDate')}</Text>
              <TouchableOpacity style={styles.dateField} onPress={() => setShowEndPicker(true)}>
                <MaterialCommunityIcons name="calendar-check" size={20} color={COLORS.primary} />
                <Text style={styles.dateText}>{fmt(endDate.toISOString(), locale)}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.formField}>
              <Text style={styles.label}>{t('teletravail.reasonLabel')}</Text>
              <TextInput
                style={styles.textarea}
                value={reason}
                onChangeText={(v) => setReason(v.slice(0, 500))}
                placeholder={t('teletravail.reasonPlaceholder')}
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={4}
              />
              <Text style={styles.charCount}>{reason.length}/500</Text>
            </View>

            <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.6 }]} disabled={submitting} onPress={submit}>
              {submitting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitBtnText}>{t('teletravail.submitRequest')}</Text>}
            </TouchableOpacity>
          </ScrollView>

          {/* DatePickerModal n'expose pas minimumDate — la validation est
              donc faite au moment du submit (cf. submit() qui rejette si
              endDate < startDate). On force aussi endDate à recaller sur
              startDate quand l'utilisateur recule la date de début. */}
          <DatePickerModal
            visible={showStartPicker}
            value={startDate}
            onClose={() => setShowStartPicker(false)}
            onChange={(d: Date) => { setStartDate(d); if (endDate < d) setEndDate(d); }}
          />
          <DatePickerModal
            visible={showEndPicker}
            value={endDate}
            onClose={() => setShowEndPicker(false)}
            onChange={(d: Date) => setEndDate(d)}
          />
        </SafeAreaView>
      </Modal>

      {/* Onglet « requests » dans la barre du bas — c'est la catégorie qui
          regroupe les demandes RH (congés, autorisations, télétravail). */}
      <BottomTabBar navigation={navigation} active="requests" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, textAlign: 'center', fontWeight: '700', fontSize: 16, color: '#0f172a' },
  scroll: { padding: 16, gap: 12 },
  emptyCard: { padding: 24, alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', borderStyle: 'dashed', marginTop: 24, gap: 6 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#475569', marginTop: 4 },
  emptySub: { fontSize: 13, color: '#94a3b8', textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  daysText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  datesText: { fontSize: 14, color: '#0f172a' },
  bold: { fontWeight: '700' },
  reasonText: { fontSize: 13, color: '#64748b', fontStyle: 'italic', marginTop: 4 },
  alertBox: { borderWidth: 1, borderRadius: 8, padding: 8, marginTop: 8 },
  alertText: { fontSize: 12 },
  metaText: { fontSize: 11, color: '#94a3b8', marginTop: 8 },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, marginTop: 10, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' },
  cancelBtnText: { color: '#991b1b', fontWeight: '600', fontSize: 13 },
  fab: { position: 'absolute', right: 16, backgroundColor: COLORS.primary, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 6, elevation: 4, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  formField: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 6 },
  dateField: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  dateText: { fontSize: 15, color: '#0f172a' },
  textarea: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', padding: 12, minHeight: 96, textAlignVertical: 'top', color: '#0f172a' },
  charCount: { fontSize: 11, color: '#94a3b8', textAlign: 'right', marginTop: 4 },
  submitBtn: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 12 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
