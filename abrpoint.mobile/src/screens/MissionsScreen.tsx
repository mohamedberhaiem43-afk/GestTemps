import React, { useState, useEffect, useMemo } from 'react';
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
  abscod: string;
}

interface AbsenceNature {
  abscod: string;
  abslib: string;
}

const STATE_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  Pending:    { bg: '#fef3c7', fg: '#92400e', label: 'En attente' },
  Approved:   { bg: '#dbeafe', fg: '#1d4ed8', label: 'Approuvée' },
  InProgress: { bg: '#ede9fe', fg: '#6d28d9', label: 'En cours' },
  Completed:  { bg: '#d1fae5', fg: '#047857', label: 'Terminée' },
  Cancelled:  { bg: '#fee2e2', fg: '#b91c1c', label: 'Annulée' },
};

const fmtDate = (d: any) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '—'; }
};

const toIsoDate = (d: Date) => d.toISOString().split('T')[0];

export default function MissionsScreen({ navigation }: any) {
  const { user } = useAuth();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [natures, setNatures] = useState<AbsenceNature[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const defaultForm = {
    misobj: '',
    misdest: '',
    misdatedeb: new Date(),
    misdatefin: new Date(Date.now() + 24 * 3600 * 1000),
    misnote: '',
    misbudget: '',
    abscod: '',
  };
  const [form, setForm] = useState(defaultForm);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showNaturePicker, setShowNaturePicker] = useState(false);

  useEffect(() => { loadAll(); }, [user?.soccod, user?.uticod]);

  const loadAll = async () => {
    if (!user?.soccod || !user?.uticod) return;
    try {
      const [missionsRes, naturesRes] = await Promise.all([
        apiService.getMissionsByEmp(user.soccod, user.uticod),
        apiService.getMissionNatures(user.soccod),
      ]);
      setMissions(Array.isArray(missionsRes) ? missionsRes : []);
      setNatures(Array.isArray(naturesRes) ? naturesRes : []);
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

  const handleSubmit = async () => {
    if (!user?.soccod || !user?.uticod) return;
    if (!form.misobj.trim()) { Alert.alert('Erreur', "L'objet de la mission est requis."); return; }
    if (!form.abscod) { Alert.alert('Erreur', 'La nature d\'absence est requise.'); return; }
    if (form.misdatefin < form.misdatedeb) {
      Alert.alert('Erreur', 'La date de fin doit être postérieure à la date de début.');
      return;
    }

    setSubmitting(true);
    try {
      const budget = form.misbudget.trim() === ''
        ? null
        : Number(form.misbudget.replace(',', '.'));
      await apiService.createMission({
        soccod: user.soccod,
        empcod: user.uticod,
        misobj: form.misobj.trim(),
        misdest: form.misdest.trim() || null,
        misdatedeb: toIsoDate(form.misdatedeb),
        misdatefin: toIsoDate(form.misdatefin),
        misnote: form.misnote.trim() || null,
        misetat: 'Pending',
        misbudget: Number.isFinite(budget!) ? budget : null,
        abscod: form.abscod,
      });
      Alert.alert('✅ Succès', 'Mission créée avec succès.');
      setShowForm(false);
      setForm(defaultForm);
      loadAll();
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Impossible de créer la mission.';
      Alert.alert('Erreur', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedNatureLib = useMemo(
    () => natures.find(n => n.abscod === form.abscod)?.abslib || '',
    [form.abscod, natures]
  );

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
        <Text style={styles.topTitle}>Mes missions</Text>
        <TouchableOpacity onPress={() => setShowForm(true)} style={styles.iconBtn}>
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
            <Text style={styles.emptyTitle}>Aucune mission</Text>
            <Text style={styles.emptyText}>
              Créez un ordre de mission pour vos déplacements, formations ou événements.
            </Text>
            <TouchableOpacity style={styles.emptyCta} onPress={() => setShowForm(true)}>
              <LinearGradient colors={[COLORS.primary, COLORS.primaryContainer]} style={styles.emptyCtaGradient}>
                <MaterialCommunityIcons name="plus" size={18} color="#fff" />
                <Text style={styles.emptyCtaText}>Nouvelle mission</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          missions.map(m => {
            const sc = STATE_COLORS[m.misetat] || { bg: '#f1f5f9', fg: '#475569', label: m.misetat };
            return (
              <View key={m.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle} numberOfLines={2}>{m.misobj}</Text>
                  <View style={[styles.stateChip, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.stateChipText, { color: sc.fg }]}>{sc.label}</Text>
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
                    {fmtDate(m.misdatedeb)} → {fmtDate(m.misdatefin)}
                  </Text>
                </View>
                {m.misbudget != null && (
                  <View style={styles.cardRow}>
                    <MaterialCommunityIcons name="cash-multiple" size={14} color={COLORS.outline} />
                    <Text style={styles.cardRowText}>{m.misbudget.toFixed(2)} €</Text>
                  </View>
                )}
                {!!m.misnote && (
                  <Text style={styles.cardNote}>{m.misnote}</Text>
                )}
              </View>
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
              <Text style={styles.formTitle}>Nouvelle mission</Text>
              <TouchableOpacity onPress={() => { setShowForm(false); setForm(defaultForm); }}>
                <MaterialCommunityIcons name="close" size={24} color={COLORS.outline} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>OBJET *</Text>
              <TextInput
                style={styles.input}
                value={form.misobj}
                onChangeText={t => setForm({ ...form, misobj: t })}
                placeholder="Ex : Formation TypeScript avancé"
                placeholderTextColor="#94a3b8"
              />

              <Text style={styles.fieldLabel}>NATURE *</Text>
              <TouchableOpacity style={styles.input} onPress={() => setShowNaturePicker(true)}>
                <Text style={[styles.inputText, !form.abscod && styles.placeholder]}>
                  {selectedNatureLib || 'Sélectionner une nature…'}
                </Text>
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>DESTINATION</Text>
              <TextInput
                style={styles.input}
                value={form.misdest}
                onChangeText={t => setForm({ ...form, misdest: t })}
                placeholder="Ex : Paris, Lyon, Tunis…"
                placeholderTextColor="#94a3b8"
              />

              <View style={styles.row2}>
                <View style={styles.col2}>
                  <Text style={styles.fieldLabel}>DÉBUT *</Text>
                  <TouchableOpacity style={styles.input} onPress={() => setShowStartPicker(true)}>
                    <Text style={styles.inputText}>{fmtDate(form.misdatedeb)}</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.col2}>
                  <Text style={styles.fieldLabel}>FIN *</Text>
                  <TouchableOpacity style={styles.input} onPress={() => setShowEndPicker(true)}>
                    <Text style={styles.inputText}>{fmtDate(form.misdatefin)}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.fieldLabel}>BUDGET PRÉVISIONNEL (€)</Text>
              <TextInput
                style={styles.input}
                value={form.misbudget}
                onChangeText={t => setForm({ ...form, misbudget: t })}
                placeholder="0.00"
                placeholderTextColor="#94a3b8"
                keyboardType="decimal-pad"
              />

              <Text style={styles.fieldLabel}>NOTE</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={form.misnote}
                onChangeText={t => setForm({ ...form, misnote: t })}
                placeholder="Détails complémentaires…"
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
                    : <Text style={styles.submitText}>CRÉER LA MISSION</Text>}
                </LinearGradient>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      )}

      {/* Picker nature : liste simple en bottom sheet */}
      {showNaturePicker && (
        <View style={styles.formOverlay}>
          <View style={[styles.formSheet, { maxHeight: '60%' }]}>
            <View style={styles.formHandle} />
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>Nature de mission</Text>
              <TouchableOpacity onPress={() => setShowNaturePicker(false)}>
                <MaterialCommunityIcons name="close" size={24} color={COLORS.outline} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {natures.length === 0 ? (
                <Text style={styles.naturesEmpty}>
                  Aucune nature de mission n'est encore configurée. Demandez à votre administrateur d'en créer une.
                </Text>
              ) : natures.map(n => (
                <TouchableOpacity
                  key={n.abscod}
                  style={[styles.natureItem, form.abscod === n.abscod && styles.natureItemActive]}
                  onPress={() => { setForm({ ...form, abscod: n.abscod }); setShowNaturePicker(false); }}
                >
                  <Text style={styles.natureCode}>{n.abscod}</Text>
                  <Text style={styles.natureLib}>{n.abslib}</Text>
                  {form.abscod === n.abscod && (
                    <MaterialCommunityIcons name="check-circle" size={20} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

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
  formOverlay: {
    position: 'absolute', inset: 0,
    backgroundColor: 'rgba(15,23,42,0.4)',
    justifyContent: 'flex-end',
  },
  formSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12, maxHeight: '85%',
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
