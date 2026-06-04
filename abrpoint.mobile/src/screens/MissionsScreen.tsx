import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import { COLORS } from '../config/env';
import DatePickerModal from '../components/DatePickerModal';
import { useI18n } from '../i18n';

/**
 * MissionsScreen — version employé.
 *
 * Liste les missions du collaborateur connecté + permet d'en créer une nouvelle.
 * Une mission = ordre de mission (déplacement, formation, événement client),
 * obligatoirement rattachée à une nature d'absence Abscng="6" (Formation et
 * mission). C'est ce rattachement qui permet au rapprochement paie de traiter
 * la période comme du temps payé hors du planning standard.
 *
 * Cf. côté web : abrpoint.client/src/components/gestionEmploye/Mission/MissionPage.tsx.
 */

interface Mission {
  id: number;
  soccod: string;
  empcod: string;
  misobj: string;
  misdest?: string | null;
  misdatedeb: string;
  misdatefin: string;
  misnote?: string | null;
  misetat: string;
  misbudget?: number | null;
  misdevise?: string | null;
  abscod: string;
}

interface AbsenceNature {
  abscod: string;
  abslib: string;
}

// Liste partagée mobile/web. ISO 4217 + symbole pour l'affichage. Étendre si
// l'entreprise opère dans une autre zone — la BD stocke le code 3 lettres.
const CURRENCIES: { code: string; symbol: string; labelKey: string }[] = [
  { code: 'EUR', symbol: '€',   labelKey: 'missions.currencyEUR' },
  { code: 'USD', symbol: '$',   labelKey: 'missions.currencyUSD' },
  { code: 'GBP', symbol: '£',   labelKey: 'missions.currencyGBP' },
  { code: 'CHF', symbol: 'CHF', labelKey: 'missions.currencyCHF' },
  { code: 'TND', symbol: 'DT',  labelKey: 'missions.currencyTND' },
  { code: 'MAD', symbol: 'MAD', labelKey: 'missions.currencyMAD' },
  { code: 'DZD', symbol: 'DA',  labelKey: 'missions.currencyDZD' },
  { code: 'CAD', symbol: 'CA$', labelKey: 'missions.currencyCAD' },
  { code: 'XOF', symbol: 'FCFA', labelKey: 'missions.currencyXOF' },
  { code: 'AED', symbol: 'AED', labelKey: 'missions.currencyAED' },
];

const currencySymbol = (code: string | null | undefined): string =>
  CURRENCIES.find(c => c.code === code)?.symbol || code || '€';

const STATE_COLORS: Record<string, { bg: string; fg: string; labelKey: string }> = {
  Pending:    { bg: '#fef3c7', fg: '#92400e', labelKey: 'missions.statePending' },
  Approved:   { bg: '#dbeafe', fg: '#1d4ed8', labelKey: 'missions.stateApproved' },
  InProgress: { bg: '#ede9fe', fg: '#6d28d9', labelKey: 'missions.stateInProgress' },
  Completed:  { bg: '#d1fae5', fg: '#047857', labelKey: 'missions.stateCompleted' },
  Cancelled:  { bg: '#fee2e2', fg: '#b91c1c', labelKey: 'missions.stateCancelled' },
};

const fmtDate = (d: any, locale: string) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '—'; }
};

const toIsoDate = (d: Date) => d.toISOString().split('T')[0];

export default function MissionsScreen({ navigation }: any) {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const locale = lang === 'en' ? 'en-GB' : 'fr-FR';
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  // id de la mission en cours d'édition (null = création). Seules les missions
  // « Pending » sont éditables/supprimables côté salarié (le serveur le re-vérifie).
  const [editingId, setEditingId] = useState<number | null>(null);

  const defaultForm = {
    misobj: '',
    misdest: '',
    misdatedeb: new Date(),
    misdatefin: new Date(Date.now() + 24 * 3600 * 1000),
    misnote: '',
    misbudget: '',
    misdevise: 'EUR',
    abscod: '',
  };
  const [form, setForm] = useState(defaultForm);
  // Nature d'absence forcée à « mission ». Décision produit 2026-06 : côté
  // mobile, missions ET formations sont systématiquement rattachées à la nature
  // « mission » (toutes deux Abscng="6"), et le champ Nature n'est plus exposé à
  // l'utilisateur. On mémorise le code retenu pour le réinjecter à chaque reset.
  const [missionAbscod, setMissionAbscod] = useState('');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  useEffect(() => { loadAll(); }, [user?.soccod, user?.uticod]);

  const loadAll = async () => {
    if (!user?.soccod || !user?.uticod) return;
    try {
      const [missionsRes, naturesRes] = await Promise.all([
        apiService.getMissionsByEmp(user.soccod, user.uticod),
        apiService.getMissionNatures(user.soccod),
      ]);
      setMissions(Array.isArray(missionsRes) ? missionsRes : []);
      const naturesList: AbsenceNature[] = Array.isArray(naturesRes) ? naturesRes : [];
      // Sélection automatique de la nature « mission » : on privilégie le libellé
      // contenant « mission » (et pas « formation ») ; à défaut on prend la
      // première nature configurée (Abscng="6"). Aucune liste déroulante affichée.
      const forced =
        naturesList.find(n => /mission/i.test(n.abslib) && !/formation/i.test(n.abslib))?.abscod
        || naturesList[0]?.abscod
        || '';
      setMissionAbscod(forced);
      setForm(f => ({ ...f, abscod: forced }));
    } catch (e) {
      console.log('Missions load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const openCreateForm = () => {
    setEditingId(null);
    setForm({ ...defaultForm, abscod: missionAbscod });
    setShowForm(true);
  };

  // Pré-remplit le formulaire avec une mission existante pour édition. Réservé aux
  // missions « Pending » (cf. onMissionPress) — les autres sont figées côté salarié.
  const openEditForm = (m: Mission) => {
    setEditingId(m.id);
    setForm({
      misobj: m.misobj || '',
      misdest: m.misdest || '',
      misdatedeb: m.misdatedeb ? new Date(m.misdatedeb) : new Date(),
      misdatefin: m.misdatefin ? new Date(m.misdatefin) : new Date(Date.now() + 24 * 3600 * 1000),
      misnote: m.misnote || '',
      misbudget: m.misbudget != null ? String(m.misbudget) : '',
      misdevise: m.misdevise || 'EUR',
      abscod: m.abscod || missionAbscod,
    });
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditingId(null); setForm({ ...defaultForm, abscod: missionAbscod }); };

  const confirmDelete = (m: Mission) => {
    Alert.alert(
      t('missions.deleteTitle'),
      t('missions.deleteConfirm', { obj: m.misobj }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteMission(m.id);
              Alert.alert(t('missions.successTitle'), t('missions.deleteSuccess'));
              loadAll();
            } catch (e: any) {
              const msg = e?.response?.data?.message || t('missions.deleteError');
              Alert.alert(t('common.error'), msg);
            }
          },
        },
      ],
    );
  };

  // Tap sur une carte : si la mission est encore « Pending », on propose modifier /
  // supprimer ; sinon on explique qu'une mission traitée n'est plus modifiable.
  const onMissionPress = (m: Mission) => {
    if (m.misetat !== 'Pending') {
      Alert.alert(t('missions.processedTitle'), t('missions.processedMessage'));
      return;
    }
    Alert.alert(
      m.misobj,
      t('missions.actionPrompt'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('missions.edit'), onPress: () => openEditForm(m) },
        { text: t('common.delete'), style: 'destructive', onPress: () => confirmDelete(m) },
      ],
    );
  };

  const handleSubmit = async () => {
    if (!user?.soccod || !user?.uticod) return;
    if (!form.misobj.trim()) { Alert.alert(t('common.error'), t('missions.errObjRequired')); return; }
    if (!form.abscod) { Alert.alert(t('common.error'), t('missions.errNatureRequired')); return; }
    if (form.misdatefin < form.misdatedeb) {
      Alert.alert(t('common.error'), t('missions.errDateOrder'));
      return;
    }

    setSubmitting(true);
    try {
      const budget = form.misbudget.trim() === ''
        ? null
        : Number(form.misbudget.replace(',', '.'));
      const payload = {
        soccod: user.soccod,
        empcod: user.uticod,
        misobj: form.misobj.trim(),
        misdest: form.misdest.trim() || null,
        misdatedeb: toIsoDate(form.misdatedeb),
        misdatefin: toIsoDate(form.misdatefin),
        misnote: form.misnote.trim() || null,
        misetat: 'Pending',
        misbudget: Number.isFinite(budget!) ? budget : null,
        // On n'envoie la devise que si un budget est saisi — sinon NULL côté serveur
        // (devise sans montant n'a pas de sens et pollue le suivi comptable).
        misdevise: Number.isFinite(budget!) ? form.misdevise : null,
        abscod: form.abscod,
      };
      if (editingId != null) {
        await apiService.updateMission(editingId, payload);
        Alert.alert(t('missions.successTitle'), t('missions.updateSuccess'));
      } else {
        await apiService.createMission(payload);
        Alert.alert(t('missions.successTitle'), t('missions.createSuccess'));
      }
      closeForm();
      loadAll();
    } catch (e: any) {
      const msg = e?.response?.data?.message
        || (editingId != null ? t('missions.updateError') : t('missions.createError'));
      Alert.alert(t('common.error'), msg);
    } finally {
      setSubmitting(false);
    }
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
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.onSurface} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{t('missions.title')}</Text>
        <TouchableOpacity onPress={openCreateForm} style={styles.iconBtn}>
          <MaterialCommunityIcons name="plus" size={26} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {missions.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="briefcase-outline" size={64} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>{t('missions.emptyTitle')}</Text>
            <Text style={styles.emptyText}>
              {t('missions.emptyText')}
            </Text>
            <TouchableOpacity style={styles.emptyCta} onPress={openCreateForm}>
              <LinearGradient colors={[COLORS.primary, COLORS.primaryContainer]} style={styles.emptyCtaGradient}>
                <MaterialCommunityIcons name="plus" size={18} color="#fff" />
                <Text style={styles.emptyCtaText}>{t('missions.newMission')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          missions.map(m => {
            const sc = STATE_COLORS[m.misetat];
            const chipBg = sc?.bg || '#f1f5f9';
            const chipFg = sc?.fg || '#475569';
            const chipLabel = sc ? t(sc.labelKey) : m.misetat;
            const editable = m.misetat === 'Pending';
            return (
              <TouchableOpacity key={m.id} style={styles.card} onPress={() => onMissionPress(m)} activeOpacity={0.7}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle} numberOfLines={2}>{m.misobj}</Text>
                  <View style={[styles.stateChip, { backgroundColor: chipBg }]}>
                    <Text style={[styles.stateChipText, { color: chipFg }]}>{chipLabel}</Text>
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
                    {fmtDate(m.misdatedeb, locale)} → {fmtDate(m.misdatefin, locale)}
                  </Text>
                </View>
                {m.misbudget != null && (
                  <View style={styles.cardRow}>
                    <MaterialCommunityIcons name="cash-multiple" size={14} color={COLORS.outline} />
                    <Text style={styles.cardRowText}>{m.misbudget.toFixed(2)} {currencySymbol(m.misdevise)}</Text>
                  </View>
                )}
                {!!m.misnote && (
                  <Text style={styles.cardNote}>{m.misnote}</Text>
                )}
                {editable && (
                  <View style={styles.cardActionsHint}>
                    <MaterialCommunityIcons name="gesture-tap" size={13} color={COLORS.outline} />
                    <Text style={styles.cardActionsHintText}>{t('missions.tapHint')}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Formulaire bottom sheet */}
      {showForm && (
        <View style={styles.formOverlay}>
          <View style={styles.formSheet}>
            <View style={styles.formHandle} />
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>{editingId != null ? t('missions.editTitle') : t('missions.newMission')}</Text>
              <TouchableOpacity onPress={closeForm}>
                <MaterialCommunityIcons name="close" size={24} color={COLORS.outline} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>{t('missions.fieldObject')}</Text>
              <TextInput
                style={styles.input}
                value={form.misobj}
                onChangeText={v => setForm({ ...form, misobj: v })}
                placeholder={t('missions.placeholderObject')}
                placeholderTextColor="#94a3b8"
              />

              {/* Champ NATURE retiré : la nature est forcée à « mission » côté
                  mobile (cf. missionAbscod). Aucune liste déroulante exposée. */}

              <Text style={styles.fieldLabel}>{t('missions.fieldDestination')}</Text>
              <TextInput
                style={styles.input}
                value={form.misdest}
                onChangeText={v => setForm({ ...form, misdest: v })}
                placeholder={t('missions.placeholderDestination')}
                placeholderTextColor="#94a3b8"
              />

              <View style={styles.row2}>
                <View style={styles.col2}>
                  <Text style={styles.fieldLabel}>{t('missions.fieldStart')}</Text>
                  <TouchableOpacity style={styles.input} onPress={() => setShowStartPicker(true)}>
                    <Text style={styles.inputText}>{fmtDate(form.misdatedeb, locale)}</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.col2}>
                  <Text style={styles.fieldLabel}>{t('missions.fieldEnd')}</Text>
                  <TouchableOpacity style={styles.input} onPress={() => setShowEndPicker(true)}>
                    <Text style={styles.inputText}>{fmtDate(form.misdatefin, locale)}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.fieldLabel}>{t('missions.fieldBudget')}</Text>
              <View style={styles.budgetRow}>
                <TextInput
                  style={[styles.input, styles.budgetInput]}
                  value={form.misbudget}
                  onChangeText={v => setForm({ ...form, misbudget: v })}
                  placeholder="0.00"
                  placeholderTextColor="#94a3b8"
                  keyboardType="decimal-pad"
                />
                <TouchableOpacity style={styles.currencyBtn} onPress={() => setShowCurrencyPicker(true)}>
                  <Text style={styles.currencyBtnText}>{form.misdevise}</Text>
                  <MaterialCommunityIcons name="chevron-down" size={16} color={COLORS.outline} />
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>{t('missions.fieldNote')}</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={form.misnote}
                onChangeText={v => setForm({ ...form, misnote: v })}
                placeholder={t('missions.placeholderNote')}
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleSubmit}
                disabled={submitting}
                activeOpacity={0.85}
              >
                <LinearGradient colors={[COLORS.primary, COLORS.primaryContainer]} style={styles.submitGradient}>
                  {submitting
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.submitText}>{editingId != null ? t('missions.btnSave') : t('missions.btnCreate')}</Text>}
                </LinearGradient>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      )}

      {/* Picker devise : liste ISO 4217 en bottom sheet */}
      {showCurrencyPicker && (
        <View style={styles.formOverlay}>
          <View style={[styles.formSheet, { maxHeight: '60%' }]}>
            <View style={styles.formHandle} />
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>{t('missions.currencyTitle')}</Text>
              <TouchableOpacity onPress={() => setShowCurrencyPicker(false)}>
                <MaterialCommunityIcons name="close" size={24} color={COLORS.outline} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {CURRENCIES.map(c => (
                <TouchableOpacity
                  key={c.code}
                  style={[styles.natureItem, form.misdevise === c.code && styles.natureItemActive]}
                  onPress={() => { setForm({ ...form, misdevise: c.code }); setShowCurrencyPicker(false); }}
                >
                  <Text style={styles.natureCode}>{c.symbol}</Text>
                  <Text style={styles.natureLib}>{c.code} — {t(c.labelKey)}</Text>
                  {form.misdevise === c.code && (
                    <MaterialCommunityIcons name="check-circle" size={20} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Picker nature retiré : nature forcée à « mission » côté mobile. */}

      <DatePickerModal
        visible={showStartPicker}
        value={form.misdatedeb}
        onClose={() => setShowStartPicker(false)}
        onChange={(d: Date) => setForm({ ...form, misdatedeb: d })}
      />
      <DatePickerModal
        visible={showEndPicker}
        value={form.misdatefin}
        onClose={() => setShowEndPicker(false)}
        onChange={(d: Date) => setForm({ ...form, misdatefin: d })}
      />
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
  scrollContent: { padding: 20, paddingBottom: 60 },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.onSurface, marginTop: 8 },
  emptyText: { fontSize: 13, color: COLORS.outline, textAlign: 'center', paddingHorizontal: 32, lineHeight: 18 },
  emptyCta: { marginTop: 16 },
  emptyCtaGradient: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12,
  },
  emptyCtaText: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: COLORS.onSurface },
  stateChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  stateChipText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  cardRowText: { fontSize: 12, color: COLORS.onSurfaceVariant, fontWeight: '500' },
  cardNote: {
    marginTop: 8, padding: 10, backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 8, fontSize: 12, color: COLORS.onSurfaceVariant, fontStyle: 'italic',
  },
  cardActionsHint: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10,
    paddingTop: 8, borderTopWidth: 1, borderTopColor: COLORS.surfaceContainerLow,
  },
  cardActionsHintText: { fontSize: 11, color: COLORS.outline, fontWeight: '600' },
  // elevation: 30 → modal au-dessus du BottomTabBar (elevation: 8) sur Android,
  // sinon le bouton "Envoyer" est masqué/intaproachable sous la barre persistante.
  formOverlay: {
    position: 'absolute', inset: 0,
    backgroundColor: 'rgba(15,23,42,0.4)',
    justifyContent: 'flex-end',
    zIndex: 1000,
    elevation: 30,
  },
  formSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, maxHeight: '85%',
  },
  formHandle: { alignSelf: 'center', width: 40, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, marginBottom: 8 },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  formTitle: { fontSize: 18, fontWeight: '800', color: COLORS.onSurface, fontFamily: 'Manrope' },
  fieldLabel: { fontSize: 10, fontWeight: '800', color: COLORS.outline, letterSpacing: 1, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: COLORS.surfaceContainerLow, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: COLORS.onSurface,
  },
  inputText: { fontSize: 14, color: COLORS.onSurface },
  placeholder: { color: '#94a3b8' },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  row2: { flexDirection: 'row', gap: 12 },
  col2: { flex: 1 },
  // Ligne budget = montant + bouton devise (pickup ouvre le bottom sheet).
  budgetRow: { flexDirection: 'row', gap: 8 },
  budgetInput: { flex: 1 },
  currencyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.surfaceContainerLow, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, minWidth: 84,
    justifyContent: 'space-between',
  },
  currencyBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.onSurface },
  submitBtn: { marginTop: 24 },
  submitGradient: {
    height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center',
  },
  submitText: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  natureItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.surfaceContainerLow,
  },
  natureItemActive: { backgroundColor: 'rgba(0,64,161,0.04)' },
  natureCode: { fontSize: 12, fontWeight: '700', color: COLORS.primary, fontFamily: 'monospace', minWidth: 50 },
  natureLib: { flex: 1, fontSize: 14, color: COLORS.onSurface },
  naturesEmpty: { padding: 20, fontSize: 13, color: COLORS.outline, textAlign: 'center' },
});
