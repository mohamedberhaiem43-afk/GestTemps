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
function formatDateLong(d: Date) {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}
function parseHHMM(s: string): { h: number; m: number } | null {
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return { h: Number(m[1]), m: Number(m[2]) };
}

export default function HeuresSupScreen({ navigation, route }: any) {
  const { user } = useAuth();
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

  const handleSubmit = async () => {
    if (!user?.soccod || !user?.uticod) {
      Alert.alert('Session expirée', 'Veuillez vous reconnecter.');
      return;
    }
    if (!overtimeMinutes || overtimeMinutes <= 0) {
      Alert.alert('Champ manquant', 'Veuillez sélectionner une durée.');
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
        condat: new Date().toISOString(),
        condep: condep.toISOString(),
        conret: conret.toISOString(),
        conjour: '1',
        conmotif: `[HEURES SUP] ${notes || `${overtimeMinutes / 60}h`}`,
      });
      Alert.alert('Demande envoyée', 'Votre déclaration d\'heures supplémentaires a été transmise au manager.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      const msg = e?.response?.data?.message
        ?? e?.response?.data?.error
        ?? e?.message
        ?? 'Échec de l\'envoi de la demande.';
      Alert.alert('Erreur', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const durationLabel = OVERTIME_DURATIONS.find(d => d.minutes === overtimeMinutes)?.label ?? 'Sélectionner';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.onSurface} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Heures supplémentaires</Text>
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
              Déclarez les heures travaillées au-delà de votre planning. Votre manager les validera.
            </Text>
          </View>

          {/* Date */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Jour concerné</Text>
            <TouchableOpacity style={styles.inputPlaceholder} onPress={() => setShowDatePicker(true)}>
              <MaterialCommunityIcons name="calendar-outline" size={18} color="#737785" />
              <Text style={styles.inputPlaceholderText}>{formatDateLong(day)}</Text>
            </TouchableOpacity>
          </View>

          {/* Heure de début + durée */}
          <View style={styles.row}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Heure de début</Text>
              <TouchableOpacity
                style={styles.inputPlaceholder}
                onPress={() => { setOvertimeStartTouched(true); setShowStartTimePicker(true); }}
              >
                <MaterialCommunityIcons name="clock-outline" size={18} color="#737785" />
                <Text style={styles.inputPlaceholderText}>{formatHHMM(startTime)}</Text>
              </TouchableOpacity>
              {overtimeStartFromSchedule && !overtimeStartTouched && (
                <Text style={styles.hintText}>Heure de fin du poste (modifiable)</Text>
              )}
            </View>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Durée</Text>
              <TouchableOpacity style={styles.inputPlaceholder} onPress={() => setDurationPickerOpen(true)}>
                <MaterialCommunityIcons name="timer-outline" size={18} color="#737785" />
                <Text style={styles.inputPlaceholderText}>{durationLabel}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Notes */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Motif / précisions</Text>
            <View style={styles.inputWrap}>
              <MaterialCommunityIcons name="text-box-outline" size={18} color="#737785" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="Ex : surcharge de fin de mois, astreinte…"
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
            <Text style={styles.submitText}>{submitting ? 'Envoi…' : 'Envoyer la demande'}</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Duration picker */}
      <Modal visible={durationPickerOpen} transparent animationType="slide" onRequestClose={() => setDurationPickerOpen(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDurationPickerOpen(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Durée</Text>
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
});
