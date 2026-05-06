import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';
import { COLORS } from '../../config/env';
import DatePickerModal from '../../components/DatePickerModal';

/**
 * ContractRenewalScreen — version manager.
 *
 * Liste les contrats dont la date de fin (Empsort) tombe dans les 30 prochains
 * jours et permet d'en renouveler un avec une nouvelle période + type +
 * éventuelle conversion en CDI (date de fin nulle / dépassée).
 *
 * Utilise l'endpoint serveur existant POST /api/Contrats/renew qui crée une
 * nouvelle ligne contractuelle référencée à l'ancien Concod (cf.
 * IContratRepository.RenewAsync).
 */

interface Contract {
  concod: string;
  soccod: string;
  empcod: string;
  emplib?: string;
  empcontrat?: string | null;
  contype?: string | null;
  empemb?: string | null;
  empsort?: string | null;
  empmotif?: string | null;
}

const fmtDate = (d: any) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '—'; }
};

const toIsoDate = (d: Date) => d.toISOString().split('T')[0];

const daysUntil = (d: any): number => {
  if (!d) return Infinity;
  const t = (new Date(d).getTime() - Date.now()) / (1000 * 3600 * 24);
  return Math.round(t);
};

const CONTRACT_TYPES = ['CDI', 'CDD', 'STAGE', 'FREELANCE'] as const;

export default function ContractRenewalScreen({ navigation, route }: any) {
  const { user } = useAuth();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [target, setTarget] = useState<Contract | null>(null);
  const [form, setForm] = useState({
    startDate: new Date(),
    endDate: new Date(Date.now() + 365 * 24 * 3600 * 1000),
    empcontrat: 'CDD' as string,
    empmotif: '',
    asCdi: false,
  });
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Si la nav reçoit un concod en param (cas push notification J-30 → renouvellement
  // d'un contrat précis), on pré-ouvre le formulaire après le chargement.
  const concodFromNav = route?.params?.concod as string | undefined;

  useEffect(() => { load(); }, [user?.soccod]);

  useEffect(() => {
    if (!concodFromNav || contracts.length === 0) return;
    const found = contracts.find(c => c.concod === concodFromNav);
    if (found) openRenewalForm(found);
  }, [concodFromNav, contracts]);

  const load = async () => {
    if (!user?.soccod || !user?.uticod) return;
    try {
      const data = await apiService.getContractsForRenewal(user.soccod, user.uticod);
      const list: Contract[] = Array.isArray(data) ? data : (data?.$values ?? []);
      // Filtre côté client : empsort dans [today-7, today+30]. On inclut les contrats
      // expirés depuis moins d'une semaine pour rattraper les oublis.
      const filtered = list.filter(c => {
        const d = daysUntil(c.empsort);
        return c.empsort && d <= 30 && d >= -7;
      }).sort((a, b) => daysUntil(a.empsort) - daysUntil(b.empsort));
      setContracts(filtered);
    } catch (e) {
      console.log('Contracts load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openRenewalForm = (c: Contract) => {
    setTarget(c);
    // Date de début par défaut : J+1 après l'ancienne fin (continuité naturelle).
    const startBase = c.empsort ? new Date(new Date(c.empsort).getTime() + 24 * 3600 * 1000) : new Date();
    setForm({
      startDate: startBase,
      endDate: new Date(startBase.getTime() + 365 * 24 * 3600 * 1000),
      empcontrat: c.empcontrat || 'CDD',
      empmotif: c.empmotif || '',
      asCdi: false,
    });
  };

  const closeForm = () => {
    setTarget(null);
  };

  const handleSubmit = async () => {
    if (!target || !user?.soccod) return;
    if (!form.asCdi && form.endDate <= form.startDate) {
      Alert.alert('Erreur', 'La date de fin doit être postérieure à la date de début.');
      return;
    }
    setSubmitting(true);
    try {
      const nextConcod = await apiService.getNextConcod(user.soccod);
      const newConcod = (nextConcod?.concod || nextConcod) as string;
      // Conversion en CDI : on envoie la même date pour start/end côté backend
      // (le repo détecte la durée 0 et bascule en CDI sans terme). On force
      // empcontrat='CDI' pour que le statut soit clair côté reporting.
      const finalEndDate = form.asCdi ? form.startDate : form.endDate;
      const finalContractType = form.asCdi ? 'CDI' : form.empcontrat;
      await apiService.renewContract({
        soccod: user.soccod,
        sourceConcod: target.concod,
        newConcod,
        condat: toIsoDate(new Date()),
        startDate: toIsoDate(form.startDate),
        endDate: toIsoDate(finalEndDate),
        monthNumber: null,
        contype: null,
        empcontrat: finalContractType,
        empmotif: form.empmotif.trim() || null,
      });
      Alert.alert('✅ Succès', `Contrat renouvelé pour ${target.emplib || target.empcod}.`);
      closeForm();
      load();
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Renouvellement impossible.';
      Alert.alert('Erreur', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const grouped = useMemo(() => {
    const overdue: Contract[] = [];
    const week: Contract[] = [];
    const month: Contract[] = [];
    contracts.forEach(c => {
      const d = daysUntil(c.empsort);
      if (d < 0) overdue.push(c);
      else if (d <= 7) week.push(c);
      else month.push(c);
    });
    return { overdue, week, month };
  }, [contracts]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    );
  }

  const renderCard = (c: Contract, urgent: boolean) => {
    const d = daysUntil(c.empsort);
    let chipBg = '#dbeafe', chipFg = '#1d4ed8', chipLabel = `J-${d}`;
    if (d < 0) { chipBg = '#fee2e2'; chipFg = '#b91c1c'; chipLabel = `Expiré J+${Math.abs(d)}`; }
    else if (d <= 7) { chipBg = '#fef3c7'; chipFg = '#92400e'; chipLabel = d === 0 ? 'Aujourd\'hui' : `Dans ${d}j`; }

    return (
      <View key={c.concod} style={[styles.card, urgent && styles.cardUrgent]}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.empName}>{c.emplib || c.empcod}</Text>
            <Text style={styles.cardTitle}>
              {c.empcontrat || 'Contrat'} · {c.concod}
            </Text>
          </View>
          <View style={[styles.stateChip, { backgroundColor: chipBg }]}>
            <Text style={[styles.stateChipText, { color: chipFg }]}>{chipLabel}</Text>
          </View>
        </View>
        <View style={styles.cardRow}>
          <MaterialCommunityIcons name="calendar-end" size={14} color={COLORS.outline} />
          <Text style={styles.cardRowText}>Fin : {fmtDate(c.empsort)}</Text>
        </View>
        {!!c.empemb && (
          <View style={styles.cardRow}>
            <MaterialCommunityIcons name="calendar-start" size={14} color={COLORS.outline} />
            <Text style={styles.cardRowText}>Embauche : {fmtDate(c.empemb)}</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.renewBtn}
          activeOpacity={0.85}
          onPress={() => openRenewalForm(c)}
        >
          <MaterialCommunityIcons name="autorenew" size={16} color="#fff" />
          <Text style={styles.renewBtnText}>Renouveler</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.onSurface} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Contrats à renouveler</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scrollContent}
      >
        {contracts.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="check-circle-outline" size={64} color="#10b981" />
            <Text style={styles.emptyTitle}>Tout est à jour</Text>
            <Text style={styles.emptyText}>
              Aucun contrat n'arrive à échéance dans les 30 prochains jours.
            </Text>
          </View>
        ) : (
          <>
            {grouped.overdue.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>⚠ Expirés à régulariser ({grouped.overdue.length})</Text>
                {grouped.overdue.map(c => renderCard(c, true))}
              </>
            )}
            {grouped.week.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Cette semaine ({grouped.week.length})</Text>
                {grouped.week.map(c => renderCard(c, true))}
              </>
            )}
            {grouped.month.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Dans le mois ({grouped.month.length})</Text>
                {grouped.month.map(c => renderCard(c, false))}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Formulaire de renouvellement en bottom sheet */}
      {target && (
        <View style={styles.formOverlay}>
          <View style={styles.formSheet}>
            <View style={styles.formHandle} />
            <View style={styles.formHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.formTitle}>Renouveler le contrat</Text>
                <Text style={styles.formSubtitle}>{target.emplib || target.empcod}</Text>
              </View>
              <TouchableOpacity onPress={closeForm}>
                <MaterialCommunityIcons name="close" size={24} color={COLORS.outline} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Toggle conversion CDI */}
              <TouchableOpacity
                style={[styles.toggleCard, form.asCdi && styles.toggleCardActive]}
                activeOpacity={0.85}
                onPress={() => setForm({ ...form, asCdi: !form.asCdi })}
              >
                <View style={styles.toggleIconWrap}>
                  <MaterialCommunityIcons
                    name={form.asCdi ? 'check-circle' : 'circle-outline'}
                    size={22}
                    color={form.asCdi ? COLORS.primary : COLORS.outline}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleTitle}>Convertir en CDI</Text>
                  <Text style={styles.toggleSub}>Sans date de fin contractuelle</Text>
                </View>
              </TouchableOpacity>

              {!form.asCdi && (
                <>
                  <Text style={styles.fieldLabel}>TYPE DE CONTRAT</Text>
                  <View style={styles.typeRow}>
                    {CONTRACT_TYPES.map(t => (
                      <TouchableOpacity
                        key={t}
                        style={[styles.typeChip, form.empcontrat === t && styles.typeChipActive]}
                        onPress={() => setForm({ ...form, empcontrat: t })}
                      >
                        <Text style={[styles.typeChipText, form.empcontrat === t && styles.typeChipTextActive]}>
                          {t}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <View style={styles.row2}>
                <View style={styles.col2}>
                  <Text style={styles.fieldLabel}>DÉBUT *</Text>
                  <TouchableOpacity style={styles.input} onPress={() => setShowStartPicker(true)}>
                    <Text style={styles.inputText}>{fmtDate(form.startDate)}</Text>
                  </TouchableOpacity>
                </View>
                {!form.asCdi && (
                  <View style={styles.col2}>
                    <Text style={styles.fieldLabel}>FIN *</Text>
                    <TouchableOpacity style={styles.input} onPress={() => setShowEndPicker(true)}>
                      <Text style={styles.inputText}>{fmtDate(form.endDate)}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <Text style={styles.fieldLabel}>MOTIF</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={form.empmotif}
                onChangeText={t => setForm({ ...form, empmotif: t })}
                placeholder="Ex : continuité, projet en cours…"
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
                    : <Text style={styles.submitText}>VALIDER LE RENOUVELLEMENT</Text>}
                </LinearGradient>
              </TouchableOpacity>
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      )}

      <DatePickerModal
        visible={showStartPicker}
        value={form.startDate}
        onClose={() => setShowStartPicker(false)}
        onChange={(d: Date) => setForm({ ...form, startDate: d })}
      />
      <DatePickerModal
        visible={showEndPicker}
        value={form.endDate}
        onClose={() => setShowEndPicker(false)}
        onChange={(d: Date) => setForm({ ...form, endDate: d })}
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
  scrollContent: { padding: 16, paddingBottom: 60 },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.onSurface, marginTop: 8 },
  emptyText: { fontSize: 13, color: COLORS.outline, textAlign: 'center', paddingHorizontal: 32 },
  sectionTitle: {
    fontSize: 11, fontWeight: '800', color: COLORS.outline, letterSpacing: 1.2,
    marginTop: 18, marginBottom: 8,
  },
  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1,
  },
  cardUrgent: { borderLeftWidth: 4, borderLeftColor: '#f59e0b' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  empName: { fontSize: 14, fontWeight: '800', color: COLORS.onSurface },
  cardTitle: { fontSize: 11, color: COLORS.outline, marginTop: 2, fontFamily: 'monospace' },
  stateChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  stateChipText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  cardRowText: { fontSize: 12, color: COLORS.onSurfaceVariant, fontWeight: '500' },
  renewBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: COLORS.primary,
  },
  renewBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  formOverlay: {
    position: 'absolute', inset: 0,
    backgroundColor: 'rgba(15,23,42,0.4)',
    justifyContent: 'flex-end',
  },
  formSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12, maxHeight: '90%',
  },
  formHandle: { alignSelf: 'center', width: 40, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, marginBottom: 8 },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12 },
  formTitle: { fontSize: 18, fontWeight: '800', color: COLORS.onSurface, fontFamily: 'Manrope' },
  formSubtitle: { fontSize: 13, color: COLORS.outline, marginTop: 2 },
  toggleCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 12, backgroundColor: COLORS.surfaceContainerLow,
    marginBottom: 8,
  },
  toggleCardActive: { backgroundColor: 'rgba(0,64,161,0.08)' },
  toggleIconWrap: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  toggleTitle: { fontSize: 14, fontWeight: '700', color: COLORS.onSurface },
  toggleSub: { fontSize: 12, color: COLORS.outline, marginTop: 2 },
  fieldLabel: { fontSize: 10, fontWeight: '800', color: COLORS.outline, letterSpacing: 1, marginTop: 14, marginBottom: 6 },
  typeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  typeChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.surfaceContainerLow, borderWidth: 1, borderColor: 'transparent',
  },
  typeChipActive: { backgroundColor: 'rgba(0,64,161,0.08)', borderColor: COLORS.primary },
  typeChipText: { fontSize: 12, fontWeight: '700', color: COLORS.onSurfaceVariant },
  typeChipTextActive: { color: COLORS.primary },
  input: {
    backgroundColor: COLORS.surfaceContainerLow, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: COLORS.onSurface,
  },
  inputText: { fontSize: 14, color: COLORS.onSurface },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  row2: { flexDirection: 'row', gap: 12 },
  col2: { flex: 1 },
  submitBtn: { marginTop: 24 },
  submitGradient: {
    height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center',
  },
  submitText: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 1 },
});
