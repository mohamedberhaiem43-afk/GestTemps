import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import { COLORS } from '../config/env';
import { useSecureScreen } from '../hooks/useSecureScreen';

interface EligibiliteLine {
  abscod: string;
  abslib?: string | null;
  categorie: string;
  soldeDisponible: number;
  dejaTransfere: number;
  plafondAnnuel?: number | null;
  resteTransferable: number;
}
interface AlimentationLine {
  id: number;
  abscod?: string | null;
  abslib?: string | null;
  nbjours: number;
  datedemande: string;
  statut: string;
  motifrefus?: string | null;
}

const statutMeta = (s: string) => {
  switch (s) {
    case 'approved': return { label: 'Approuvée', color: COLORS.tertiary, bg: '#d7f5e6' };
    case 'refused': return { label: 'Refusée', color: COLORS.error, bg: COLORS.errorContainer };
    default: return { label: 'En attente', color: '#92400e', bg: '#fde68a' };
  }
};

export default function AlimenterCetScreen({ navigation }: any) {
  // Soldes / CET = données RH personnelles.
  useSecureScreen();
  const { user } = useAuth();
  const [eligibilite, setEligibilite] = useState<EligibiliteLine[]>([]);
  const [requests, setRequests] = useState<AlimentationLine[]>([]);
  const [abscod, setAbscod] = useState('');
  const [jours, setJours] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const selected = useMemo(() => eligibilite.find((e) => e.abscod === abscod) || null, [eligibilite, abscod]);

  const load = async () => {
    if (!user?.soccod || !user?.uticod) return;
    try {
      const elig = await apiService.getCetEligibilite(user.soccod, user.uticod);
      setEligibilite(elig);
    } catch (e) { console.log('CET eligibilite error:', e); }
    try {
      const mine = await apiService.getMyCetAlimentations(user.soccod, user.uticod);
      setRequests(mine);
    } catch (e) { console.log('CET mine error:', e); }
  };

  useEffect(() => { load(); }, [user]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const submit = async () => {
    if (!user?.soccod || !user?.uticod) return;
    const n = Number(jours.replace(',', '.'));
    if (!abscod) { Alert.alert('Type requis', 'Sélectionnez un type de congé à transférer.'); return; }
    if (!n || n <= 0) { Alert.alert('Jours invalides', 'Saisissez un nombre de jours valide.'); return; }
    if (selected && n > selected.resteTransferable) {
      Alert.alert('Limite dépassée', `Vous ne pouvez transférer que ${selected.resteTransferable.toFixed(1)} jour(s) pour ce type.`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiService.requestCetAlimentation(user.soccod, user.uticod, abscod, n);
      Alert.alert(
        res.applied ? 'Transfert effectué' : 'Demande envoyée',
        res.applied
          ? 'Les jours ont été transférés vers votre CET.'
          : 'Votre demande a été envoyée pour validation.',
      );
      setJours('');
      setAbscod('');
      await load();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Échec de la demande d'alimentation.";
      Alert.alert('Erreur', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Alimenter le CET</Text>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16 }}
      >
        <Text style={styles.sectionLabel}>Type de congé à transférer</Text>
        {eligibilite.length === 0 ? (
          <Text style={styles.empty}>Aucun type de congé éligible n'est configuré par votre société.</Text>
        ) : (
          eligibilite.map((e) => {
            const active = e.abscod === abscod;
            return (
              <TouchableOpacity
                key={e.abscod}
                style={[styles.typeCard, active && styles.typeCardActive]}
                activeOpacity={0.8}
                onPress={() => setAbscod(e.abscod)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.typeTitle}>{e.abslib || e.abscod} <Text style={styles.typeCat}>· {e.categorie}</Text></Text>
                  <Text style={styles.typeSub}>
                    Disponible {e.soldeDisponible.toFixed(1)} j · Reste transférable {e.resteTransferable.toFixed(1)} j
                    {e.plafondAnnuel ? ` · Plafond ${e.plafondAnnuel.toFixed(1)} j/an` : ''}
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name={active ? 'radiobox-marked' : 'radiobox-blank'}
                  size={22}
                  color={active ? COLORS.primary : COLORS.outline}
                />
              </TouchableOpacity>
            );
          })
        )}

        <Text style={[styles.sectionLabel, { marginTop: 16 }]}>Nombre de jours</Text>
        <TextInput
          style={styles.input}
          value={jours}
          onChangeText={setJours}
          keyboardType="decimal-pad"
          placeholder="Ex : 3"
          placeholderTextColor={COLORS.outline}
        />
        {selected ? (
          <Text style={styles.hint}>Reste transférable pour ce type : {selected.resteTransferable.toFixed(1)} j</Text>
        ) : null}

        <TouchableOpacity
          style={[styles.submitBtn, (submitting || !abscod) && { opacity: 0.6 }]}
          onPress={submit}
          disabled={submitting || !abscod}
          activeOpacity={0.85}
        >
          {submitting
            ? <ActivityIndicator color={COLORS.onPrimary} />
            : <Text style={styles.submitText}>Demander le transfert</Text>}
        </TouchableOpacity>

        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Mes demandes</Text>
        {requests.length === 0 ? (
          <Text style={styles.empty}>Aucune demande pour le moment.</Text>
        ) : (
          requests.map((r) => {
            const m = statutMeta(r.statut);
            return (
              <View key={r.id} style={styles.reqCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reqTitle}>{r.abslib || r.abscod} — {r.nbjours.toFixed(1)} j</Text>
                  <Text style={styles.reqSub}>{new Date(r.datedemande).toLocaleDateString('fr-FR')}</Text>
                  {r.statut === 'refused' && r.motifrefus ? (
                    <Text style={styles.reqRefus}>{r.motifrefus}</Text>
                  ) : null}
                </View>
                <View style={[styles.badge, { backgroundColor: m.bg }]}>
                  <Text style={[styles.badgeText, { color: m.color }]}>{m.label}</Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.surfaceContainerLowest,
    borderBottomWidth: 1, borderBottomColor: COLORS.outlineVariant,
  },
  backBtn: { color: COLORS.primary, fontSize: 15, marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.onBackground },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: COLORS.onSurfaceVariant, marginBottom: 8 },
  empty: { color: COLORS.outline, fontStyle: 'italic', paddingVertical: 8 },
  typeCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: 12, padding: 14, marginBottom: 8,
  },
  typeCardActive: { borderColor: COLORS.primary, borderWidth: 2 },
  typeTitle: { fontSize: 15, fontWeight: '700', color: COLORS.onBackground },
  typeCat: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  typeSub: { fontSize: 12, color: COLORS.onSurfaceVariant, marginTop: 2 },
  input: {
    backgroundColor: COLORS.surfaceContainerLowest, borderWidth: 1, borderColor: COLORS.outlineVariant,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: COLORS.onBackground,
  },
  hint: { fontSize: 12, color: COLORS.onSurfaceVariant, marginTop: 6 },
  submitBtn: {
    backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16,
  },
  submitText: { color: COLORS.onPrimary, fontSize: 16, fontWeight: '700' },
  reqCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceContainerLowest,
    borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: 12, padding: 14, marginBottom: 8,
  },
  reqTitle: { fontSize: 14, fontWeight: '700', color: COLORS.onBackground },
  reqSub: { fontSize: 12, color: COLORS.onSurfaceVariant, marginTop: 2 },
  reqRefus: { fontSize: 12, color: COLORS.error, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '700' },
});
