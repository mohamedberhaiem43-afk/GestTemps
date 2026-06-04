import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  Alert, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import { COLORS } from '../config/env';
import DatePickerModal from '../components/DatePickerModal';
import TimePickerModal from '../components/TimePickerModal';
import { useI18n } from '../i18n';

/**
 * HeuresSupScreen — écran DÉDIÉ à la déclaration d'heures supplémentaires.
 *
 * Décision produit 2026-06 : l'écran générique « Ajouter une demande »
 * (AddRequestScreen, qui couvrait congé / autorisation / mission / frais /
 * heures sup. dans un seul formulaire) est retiré. Chaque type de demande passe
 * désormais par son écran dédié — congés, autorisations, missions et notes de
 * frais ont déjà le leur ; cet écran fournit le dernier manquant : les heures
 * supplémentaires.
 *
 * Pas d'endpoint backend dédié : on réutilise /Autorisers/my-auth (même
 * structure date + heure début + heure fin) et on marque le motif « [HEURES
 * SUP] » pour que le manager identifie la demande dans sa liste de validation.
 * Comportement repris à l'identique de l'ancien AddRequestScreen (type
 * "heuressup"), y compris le préremplissage de l'heure de début sur l'heure de
 * fin du poste pour la date choisie.
 */

// Durées proposées (incréments de 30 min, plafond 5h) — alignées avec la maquette.
const OVERTIME_DURATIONS: Array<{ minutes: number; label: string }> = [
  { minutes: 30,  label: '30 min' },
  { minutes: 60,  label: '1h' },
  { minutes: 90,  label: '1h30' },
  { minutes: 120, label: '2h' },
  { minutes: 150, label: '2h30' },
  { minutes: 180, label: '3h' },
  { minutes: 240, label: '4h' },
  { minutes: 300, label: '5h' },
];

// JS getDay : 0=dim … 6=sam → préfixe DTO Horaire (lunhfam, marhfam, …).
const DAY_PREFIX: Record<number, string> = {
  0: 'dim', 1: 'lun', 2: 'mar', 3: 'mer', 4: 'jeu', 5: 'ven', 6: 'sam',
};

function trimTime(t?: string | null): string | undefined {
  if (!t) return undefined;
  const m = String(t).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return undefined;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}
function pad2(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function formatHHMM(d: Date) { return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
// Sérialise l'heure MURALE locale (sans conversion UTC). toISOString() décale de
// l'offset du fuseau (ex. 17:00 en UTC+1 → "16:00Z"), et comme la colonne SQL est
// « timestamp without time zone », cette valeur décalée était figée puis réaffichée
// telle quelle côté web → 17h saisi mais 16h affiché. On envoie donc le mur local.
function toLocalIso(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
    + `T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}
function formatDateLong(d: Date, locale: string) {
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'long', year: 'numeric' });
}
function parseHHMM(s: string): { h: number; m: number } | null {
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return { h: Number(m[1]), m: Number(m[2]) };
}

// Statuts des demandes d'heures sup. (Conetat côté serveur). NULL = en attente.
const OT_STATE: Record<string, { bg: string; fg: string; labelKey: string }> = {
  Pending:  { bg: '#fef3c7', fg: '#92400e', labelKey: 'common.pending' },
  Approved: { bg: '#d1fae5', fg: '#047857', labelKey: 'common.approved' },
  Refused:  { bg: '#fee2e2', fg: '#b91c1c', labelKey: 'common.refused' },
  Rejected: { bg: '#fee2e2', fg: '#b91c1c', labelKey: 'common.refused' },
};
function otStatus(conetat?: string | null): { bg: string; fg: string; labelKey?: string; labelText?: string } {
  if (!conetat) return OT_STATE.Pending;
  return OT_STATE[conetat] || { bg: '#f1f5f9', fg: '#475569', labelText: conetat };
}
const isPendingReq = (conetat?: string | null) =>
  !conetat || conetat.toLowerCase() === 'pending';
function fmtReqDate(d?: string | null, locale: string = 'fr-FR') {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return '—'; }
}
function fmtReqRange(dep?: string | null, ret?: string | null) {
  try {
    if (!dep || !ret) return '';
    const a = new Date(dep), b = new Date(ret);
    const mins = Math.round((b.getTime() - a.getTime()) / 60000);
    if (!Number.isFinite(mins) || mins <= 0) return `${formatHHMM(a)}`;
    const h = Math.floor(mins / 60), m = mins % 60;
    const dur = h > 0 ? (m > 0 ? `${h}h${pad2(m)}` : `${h}h`) : `${m} min`;
    return `${formatHHMM(a)} → ${formatHHMM(b)} · ${dur}`;
  } catch { return ''; }
}
function cleanMotif(motif?: string | null) {
  if (!motif) return '';
  return motif.replace(/\[HEURES SUP\]/i, '').trim();
}

export default function HeuresSupScreen({ navigation, route }: any) {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const locale = lang === 'en' ? 'en-GB' : 'fr-FR';
  const presetDate = route?.params?.presetDate ? new Date(route.params.presetDate) : new Date();

  const [day, setDay] = useState<Date>(presetDate);
  const [startTime, setStartTime] = useState<Date>(() => {
    const d = new Date(presetDate); d.setHours(17, 0, 0, 0); return d;
  });
  const [overtimeMinutes, setOvertimeMinutes] = useState<number>(60);
  const [notes, setNotes] = useState('');

  const [horaireRow, setHoraireRow] = useState<any | null>(null);
  const [overtimeStartTouched, setOvertimeStartTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Mes demandes d'heures sup. déjà transmises (pour consultation + suppression).
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [durationPickerOpen, setDurationPickerOpen] = useState(false);

  // Horaire du salarié — pour préremplir l'heure de début (= fin de journée).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.soccod || !user?.uticod) return;
      try {
        const horaires = await apiService.getMyHoraires(user.soccod, user.uticod).catch(() => []);
        if (cancelled) return;
        const rows = Array.isArray(horaires) ? horaires : [];
        setHoraireRow(rows[0] ?? null);
      } catch {
        // best-effort : sans horaire, l'utilisateur saisit l'heure manuellement.
      }
    })();
    return () => { cancelled = true; };
  }, [user?.soccod, user?.uticod]);

  // Heure de fin du poste pour le jour choisi (fin après-midi > fin matin).
  const overtimeStartFromSchedule = useMemo(() => {
    if (!horaireRow) return null;
    const dayKey = DAY_PREFIX[day.getDay()];
    if (!dayKey) return null;
    const candidates = [
      trimTime(horaireRow[`${dayKey}hfam`]),
      trimTime(horaireRow[`${dayKey}hfmat`]),
    ];
    return candidates.find(Boolean) ?? null;
  }, [horaireRow, day]);

  // Tant que l'utilisateur n'a pas modifié l'heure manuellement, on la cale sur
  // l'heure naturelle de fin du poste (recalculée à chaque changement de date).
  useEffect(() => {
    if (!overtimeStartFromSchedule || overtimeStartTouched) return;
    const parts = parseHHMM(overtimeStartFromSchedule);
    if (!parts) return;
    const d = new Date(day);
    d.setHours(parts.h, parts.m, 0, 0);
    setStartTime(d);
  }, [overtimeStartFromSchedule, day, overtimeStartTouched]);

  // Charge les autorisations du salarié et ne garde que les heures sup. (motif
  // préfixé « [HEURES SUP] ») — les autorisations de sortie classiques sont exclues.
  const loadMyRequests = async () => {
    if (!user?.soccod || !user?.uticod) { setLoadingList(false); return; }
    try {
      const res = await apiService.getMyAuthorizations(user.soccod, user.uticod);
      const list = Array.isArray(res) ? res : [];
      const overtime = list.filter((a: any) =>
        typeof a?.conmotif === 'string' && a.conmotif.toUpperCase().includes('[HEURES SUP]'));
      // Tri du plus récent au plus ancien (par date de la période déclarée).
      overtime.sort((a: any, b: any) =>
        new Date(b?.condep || b?.condat || 0).getTime() - new Date(a?.condep || a?.condat || 0).getTime());
      setMyRequests(overtime);
    } catch {
      // best-effort : on n'empêche pas la saisie si la liste ne charge pas.
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => { loadMyRequests(); }, [user?.soccod, user?.uticod]);

  const confirmDeleteRequest = (req: any) => {
    if (!user?.soccod || !req?.concod) return;
    Alert.alert(
      t('overtime.deleteTitle'),
      t('overtime.deleteMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteMyAuthorization(user.soccod!, req.concod);
              loadMyRequests();
            } catch (e: any) {
              const msg = e?.response?.data?.message || t('overtime.deleteError');
              Alert.alert(t('common.error'), msg);
            }
          },
        },
      ],
    );
  };

  const handleSubmit = async () => {
    if (!user?.soccod || !user?.uticod) {
      Alert.alert(t('overtime.sessionExpiredTitle'), t('overtime.sessionExpiredMessage'));
      return;
    }
    if (!overtimeMinutes || overtimeMinutes <= 0) {
      Alert.alert(t('overtime.missingFieldTitle'), t('overtime.missingDurationMessage'));
      return;
    }
    setSubmitting(true);
    try {
      const condep = new Date(day);
      condep.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
      const conret = new Date(condep.getTime() + overtimeMinutes * 60_000);
      const next = await apiService.getNextLeaveRequestCode(user.soccod); // partage la séquence concod
      await apiService.createMyAuthorization({
        concod: next.concod,
        soccod: user.soccod,
        empcod: user.uticod,
        condat: toLocalIso(new Date()),
        condep: toLocalIso(condep),
        conret: toLocalIso(conret),
        conjour: '1',
        conmotif: `[HEURES SUP] ${notes || `${overtimeMinutes / 60}h`}`,
      });
      setNotes('');
      loadMyRequests();
      Alert.alert(t('overtime.submittedTitle'), t('overtime.submittedMessage'));
    } catch (e: any) {
      const msg = e?.response?.data?.message
        ?? e?.response?.data?.error
        ?? e?.message
        ?? t('overtime.submitError');
      Alert.alert(t('common.error'), msg);
    } finally {
      setSubmitting(false);
    }
  };

  const durationLabel = OVERTIME_DURATIONS.find(d => d.minutes === overtimeMinutes)?.label ?? t('overtime.select');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('overtime.title')}</Text>
        <View style={styles.iconBtn} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.intro}>
            <MaterialCommunityIcons name="clock-plus-outline" size={20} color={COLORS.primary} />
            <Text style={styles.introText}>
              {t('overtime.intro')}
            </Text>
          </View>

          {/* Date */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t('overtime.dayLabel')}</Text>
            <TouchableOpacity style={styles.inputPlaceholder} onPress={() => setShowDatePicker(true)}>
              <MaterialCommunityIcons name="calendar-outline" size={18} color="#737785" />
              <Text style={styles.inputPlaceholderText}>{formatDateLong(day, locale)}</Text>
            </TouchableOpacity>
          </View>

          {/* Heure de début + durée */}
          <View style={styles.row}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>{t('overtime.startTimeLabel')}</Text>
              <TouchableOpacity
                style={styles.inputPlaceholder}
                onPress={() => { setOvertimeStartTouched(true); setShowStartTimePicker(true); }}
              >
                <MaterialCommunityIcons name="clock-outline" size={18} color="#737785" />
                <Text style={styles.inputPlaceholderText}>{formatHHMM(startTime)}</Text>
              </TouchableOpacity>
              {overtimeStartFromSchedule && !overtimeStartTouched && (
                <Text style={styles.hintText}>{t('overtime.startTimeHint')}</Text>
              )}
            </View>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>{t('overtime.durationLabel')}</Text>
              <TouchableOpacity style={styles.inputPlaceholder} onPress={() => setDurationPickerOpen(true)}>
                <MaterialCommunityIcons name="timer-outline" size={18} color="#737785" />
                <Text style={styles.inputPlaceholderText}>{durationLabel}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Notes */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t('overtime.notesLabel')}</Text>
            <View style={styles.inputWrap}>
              <MaterialCommunityIcons name="text-box-outline" size={18} color="#737785" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder={t('overtime.notesPlaceholder')}
                value={notes}
                onChangeText={setNotes}
                placeholderTextColor="#9ca3af"
                multiline
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            <Text style={styles.submitText}>{submitting ? t('overtime.submitting') : t('overtime.submitButton')}</Text>
          </TouchableOpacity>

          {/* Liste de mes demandes d'heures sup. — consultation + suppression. */}
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>{t('overtime.myRequests')}</Text>
            {myRequests.length > 0 && (
              <View style={styles.countBadge}><Text style={styles.countBadgeText}>{myRequests.length}</Text></View>
            )}
          </View>

          {loadingList ? (
            <Text style={styles.listEmpty}>{t('common.loading')}</Text>
          ) : myRequests.length === 0 ? (
            <Text style={styles.listEmpty}>{t('overtime.emptyList')}</Text>
          ) : (
            myRequests.map((req: any) => {
              const st = otStatus(req.conetat);
              const pending = isPendingReq(req.conetat);
              const motif = cleanMotif(req.conmotif);
              return (
                <View key={`${req.soccod}-${req.concod}`} style={styles.reqCard}>
                  <View style={styles.reqMain}>
                    <View style={styles.reqRow}>
                      <MaterialCommunityIcons name="calendar-outline" size={14} color={COLORS.outline} />
                      <Text style={styles.reqDate}>{fmtReqDate(req.condep || req.condat, locale)}</Text>
                      <View style={[styles.reqChip, { backgroundColor: st.bg }]}>
                        <Text style={[styles.reqChipText, { color: st.fg }]}>{st.labelKey ? t(st.labelKey) : st.labelText}</Text>
                      </View>
                    </View>
                    <View style={styles.reqRow}>
                      <MaterialCommunityIcons name="clock-outline" size={14} color={COLORS.outline} />
                      <Text style={styles.reqRange}>{fmtReqRange(req.condep, req.conret)}</Text>
                    </View>
                    {!!motif && <Text style={styles.reqMotif} numberOfLines={2}>{motif}</Text>}
                  </View>
                  {pending ? (
                    <TouchableOpacity onPress={() => confirmDeleteRequest(req)} style={styles.reqDeleteBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <MaterialCommunityIcons name="trash-can-outline" size={20} color="#b91c1c" />
                    </TouchableOpacity>
                  ) : (
                    <MaterialCommunityIcons name="lock-outline" size={18} color="#cbd5e1" />
                  )}
                </View>
              );
            })
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Duration picker */}
      <Modal visible={durationPickerOpen} transparent animationType="slide" onRequestClose={() => setDurationPickerOpen(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDurationPickerOpen(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('overtime.durationLabel')}</Text>
            {OVERTIME_DURATIONS.map(d => (
              <TouchableOpacity
                key={d.minutes}
                style={[styles.modalItem, overtimeMinutes === d.minutes && styles.modalItemActive]}
                onPress={() => { setOvertimeMinutes(d.minutes); setDurationPickerOpen(false); }}
              >
                <Text style={[styles.modalItemText, overtimeMinutes === d.minutes && styles.modalItemTextActive]}>{d.label}</Text>
                {overtimeMinutes === d.minutes && (
                  <MaterialCommunityIcons name="check-circle" size={20} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <DatePickerModal
        visible={showDatePicker}
        value={day}
        onClose={() => setShowDatePicker(false)}
        onChange={(d: Date) => setDay(d)}
      />
      <TimePickerModal
        visible={showStartTimePicker}
        value={startTime}
        onClose={() => setShowStartTimePicker(false)}
        onChange={(d: Date) => setStartTime(d)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: COLORS.surfaceContainerLow,
  },
  iconBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 20 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: COLORS.onSurface, fontFamily: 'Manrope' },
  scroll: { padding: 20 },
  intro: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: 'rgba(0,64,161,0.05)', borderRadius: 12, padding: 14, marginBottom: 20,
  },
  introText: { flex: 1, fontSize: 13, color: COLORS.onSurfaceVariant, lineHeight: 18 },
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: COLORS.outline, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 12 },
  inputPlaceholder: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.surfaceContainerLow,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14,
  },
  inputPlaceholderText: { fontSize: 14, color: COLORS.onSurface, fontWeight: '500' },
  hintText: { fontSize: 11, color: COLORS.outline, marginTop: 6, fontStyle: 'italic' },
  inputWrap: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.surfaceContainerLow,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
  },
  inputIcon: { marginTop: 2 },
  input: { flex: 1, fontSize: 14, color: COLORS.onSurface, padding: 0 },
  inputMultiline: { minHeight: 60, textAlignVertical: 'top' },
  submitBtn: {
    marginTop: 12, backgroundColor: COLORS.primary, borderRadius: 14,
    height: 52, justifyContent: 'center', alignItems: 'center',
  },
  submitText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 },
  modalHandle: { alignSelf: 'center', width: 40, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, marginBottom: 12 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: COLORS.onSurface, marginBottom: 8 },
  modalItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.surfaceContainerLow,
  },
  modalItemActive: {},
  modalItemText: { fontSize: 15, color: COLORS.onSurface },
  modalItemTextActive: { color: COLORS.primary, fontWeight: '700' },
  // Liste « Mes demandes »
  listHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 28, marginBottom: 12 },
  listTitle: { fontSize: 15, fontWeight: '800', color: COLORS.onSurface, fontFamily: 'Manrope' },
  countBadge: { backgroundColor: COLORS.surfaceContainerLow, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  countBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.onSurfaceVariant },
  listEmpty: { fontSize: 13, color: COLORS.outline, fontStyle: 'italic', paddingVertical: 8 },
  reqCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.surfaceContainerLow,
  },
  reqMain: { flex: 1, gap: 6 },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reqDate: { fontSize: 13, fontWeight: '700', color: COLORS.onSurface },
  reqChip: { marginLeft: 'auto', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8 },
  reqChipText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  reqRange: { fontSize: 12, color: COLORS.onSurfaceVariant, fontWeight: '500' },
  reqMotif: { fontSize: 12, color: COLORS.onSurfaceVariant, fontStyle: 'italic', marginTop: 2 },
  reqDeleteBtn: { padding: 4 },
});
