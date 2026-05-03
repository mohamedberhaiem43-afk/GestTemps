import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import { COLORS } from '../config/env';
import DatePickerModal from '../components/DatePickerModal';
import TimePickerModal from '../components/TimePickerModal';
import BottomTabBar from '../components/BottomTabBar';

export default function AuthorizationScreen({ navigation }: any) {
  const { user, isAdmin, isManager } = useAuth();
  const [auths, setAuths] = useState<any[]>([]);
  const [absences, setAbsences] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    condep: new Date(),
    condepTime: new Date(new Date().setHours(14, 0, 0, 0)),
    conretTime: new Date(new Date().setHours(16, 0, 0, 0)),
    abscod: '',
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDepTimePicker, setShowDepTimePicker] = useState(false);
  const [showRetTimePicker, setShowRetTimePicker] = useState(false);

  useEffect(() => {
    if (user?.soccod && user?.uticod) loadInitial();
  }, [user?.soccod, user?.uticod]);

  const loadInitial = async () => {
    setLoading(true);
    await Promise.all([loadAuths(), loadAbsences()]);
    setLoading(false);
  };

  const loadAbsences = async () => {
    if (!user?.soccod) return;
    try {
      const data = await apiService.getAutorisationLibs(user.soccod);
      let arr: any[] = [];
      if (Array.isArray(data)) arr = data;
      else if (data && typeof data === 'object') arr = Object.entries(data).map(([abscod, abslib]) => ({ abscod, abslib }));
      setAbsences(arr);
      if (!form.abscod && arr.length > 0) setForm((f) => ({ ...f, abscod: arr[0].abscod }));
    } catch (e) {
      console.log('Autorisation libs error:', e);
    }
  };

  const loadAuths = async () => {
    if (!user?.soccod || !user?.uticod) return;
    try {
      const data = (isAdmin || isManager)
        ? await apiService.getAuthorizations(user.soccod, user.uticod)
        : await apiService.getMyAuthorizations(user.soccod, user.uticod);
      setAuths(Array.isArray(data) ? data : []);
    } catch (e) {
      console.log('Auth load error:', e);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadAuths(), loadAbsences()]);
    setRefreshing(false);
  };

  const totalDuration = useMemo(() => {
    const diff = form.conretTime.getTime() - form.condepTime.getTime();
    if (diff <= 0) return '00h 00m';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
  }, [form.condepTime, form.conretTime]);

  const generateAuthorizationCode = () => {
    const now = new Date();
    const y = String(now.getFullYear()).slice(-2);
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return `A${y}${m}${d}${hh}${mm}`.slice(0, 10);
  };

  const applyDurationPreset = (minutes: number) => {
    setForm((f) => ({ ...f, conretTime: new Date(f.condepTime.getTime() + minutes * 60 * 1000) }));
  };

  const handleSubmit = async () => {
    if (!user?.soccod || !user?.uticod) return;
    if (!form.abscod) {
      Alert.alert('Erreur', 'Veuillez sélectionner un type d\'autorisation');
      return;
    }

    const depDate = new Date(form.condep);
    const dep = new Date(depDate.getFullYear(), depDate.getMonth(), depDate.getDate(), form.condepTime.getHours(), form.condepTime.getMinutes());
    const ret = new Date(depDate.getFullYear(), depDate.getMonth(), depDate.getDate(), form.conretTime.getHours(), form.conretTime.getMinutes());
    const hoursDiff = (ret.getTime() - dep.getTime()) / (1000 * 60 * 60);

    if (hoursDiff <= 0) {
      Alert.alert('Erreur', "L'heure de fin doit être après l'heure de début");
      return;
    }

    const selected = absences.find((a) => a.abscod === form.abscod);

    try {
      await apiService.createMyAuthorization({
        soccod: user.soccod,
        empcod: user.uticod,
        concod: generateAuthorizationCode(),
        condat: new Date().toISOString(),
        condep: dep.toISOString(),
        conret: ret.toISOString(),
        connbjour: parseFloat(hoursDiff.toFixed(2)),
        conamdep: form.condepTime.getHours() < 12 ? '1' : '0',
        conamret: form.conretTime.getHours() < 12 ? '1' : '0',
        abscod: form.abscod,
        conmotif: selected?.abslib || 'Autorisation',
      });
      Alert.alert('Succès', 'Autorisation de sortie envoyée');
      await loadAuths();
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'Impossible d\'envoyer la demande';
      Alert.alert('Erreur', msg);
    }
  };

  const getStatusInfo = (consanc: string) => {
    if (consanc === 'A') return { label: 'VALIDEE', color: COLORS.tertiary, bgColor: COLORS.tertiaryFixed };
    if (consanc === 'R') return { label: 'REFUSEE', color: COLORS.error, bgColor: COLORS.errorContainer };
    return { label: 'EN ATTENTE', color: '#b45309', bgColor: '#fff4e5' };
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topAppBar}>
        <View style={styles.topAppLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
            <MaterialCommunityIcons name="menu" size={24} color={COLORS.primaryContainer} />
          </TouchableOpacity>
          <Text style={styles.logoText}>LEDGER HR</Text>
        </View>
        <View style={styles.profileImageWrapper}>
          <MaterialCommunityIcons name="account-circle-outline" size={32} color="#cbd5e1" />
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient colors={[COLORS.primary, COLORS.primaryContainer]} style={styles.heroCard}>
          <Text style={styles.heroTitle}>Autorisation de sortie</Text>
          <Text style={styles.heroSub}>Saisie rapide et suivi du traitement</Text>
        </LinearGradient>

        <View style={styles.formCard}>
          <Text style={styles.fieldLabel}>TYPE D'AUTORISATION</Text>
          <View style={styles.typeRow}>
            {absences.map((a: any) => (
              <TouchableOpacity
                key={a.abscod}
                style={[styles.typeBtn, form.abscod === a.abscod && styles.typeBtnActive]}
                onPress={() => setForm({ ...form, abscod: a.abscod })}
              >
                <Text style={[styles.typeText, form.abscod === a.abscod && styles.typeTextActive]}>{a.abslib || a.abscod}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>DATE</Text>
          <TouchableOpacity style={styles.dateInput} onPress={() => setShowDatePicker(true)}>
            <Text style={styles.dateText}>{form.condep.toLocaleDateString('fr-FR')}</Text>
            <MaterialCommunityIcons name="calendar" size={20} color={COLORS.primary} />
          </TouchableOpacity>

          <View style={styles.timeGrid}>
            <TouchableOpacity style={styles.timeInput} onPress={() => setShowDepTimePicker(true)}>
              <MaterialCommunityIcons name="clock-outline" size={20} color={COLORS.primary} />
              <Text style={styles.timeText}>{form.condepTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.timeInput} onPress={() => setShowRetTimePicker(true)}>
              <MaterialCommunityIcons name="history" size={20} color={COLORS.primary} />
              <Text style={styles.timeText}>{form.conretTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.presetRow}>
            {[30, 60, 120].map((m) => (
              <TouchableOpacity key={m} style={styles.presetChip} onPress={() => applyDurationPreset(m)}>
                <Text style={styles.presetText}>{m < 60 ? `${m} min` : `${m / 60}h`}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.durationCard}>
            <Text style={styles.durationLabel}>Durée totale</Text>
            <Text style={styles.durationValue}>{totalDuration}</Text>
          </View>

          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
            <Text style={styles.submitText}>ENVOYER LA DEMANDE</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Historique récent</Text>
        </View>

        <View style={styles.historyList}>
          {auths.slice(0, 5).map((item, idx) => {
            const status = getStatusInfo(item.consanc);
            return (
              <View key={item.concod || idx} style={styles.historyItem}>
                <View style={styles.historyLeft}>
                  <View style={styles.historyIcon}><MaterialCommunityIcons name="briefcase-outline" size={20} color={COLORS.primary} /></View>
                  <View>
                    <Text style={styles.historyTitle}>{item.conmotif || item.abslib || 'Autorisation'}</Text>
                    <Text style={styles.historyMeta}>{new Date(item.condep).toLocaleDateString('fr-FR')} • {item.connbjour}h</Text>
                  </View>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: status.bgColor }]}>
                  <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                </View>
              </View>
            );
          })}
          {auths.length === 0 && <Text style={styles.emptyText}>Aucune autorisation récente</Text>}
        </View>
      </ScrollView>

      <DatePickerModal
        visible={showDatePicker}
        value={form.condep}
        onChange={(d) => { setForm({ ...form, condep: d }); setShowDatePicker(false); }}
        onClose={() => setShowDatePicker(false)}
        title="Date de sortie"
      />
      <TimePickerModal
        visible={showDepTimePicker}
        value={form.condepTime}
        onChange={(d) => setForm({ ...form, condepTime: d })}
        onClose={() => setShowDepTimePicker(false)}
        title="Heure de départ"
      />
      <TimePickerModal
        visible={showRetTimePicker}
        value={form.conretTime}
        onChange={(d) => setForm({ ...form, conretTime: d })}
        onClose={() => setShowRetTimePicker(false)}
        title="Heure de retour"
      />

      <BottomTabBar active="requests" navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topAppBar: {
    height: 64, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, backgroundColor: COLORS.background,
  },
  topAppLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  logoText: { fontFamily: 'Manrope', fontWeight: '900', fontSize: 18, color: COLORS.primary, letterSpacing: 2 },
  profileImageWrapper: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', borderWidth: 2, borderColor: COLORS.surfaceContainerHigh },
  scrollContent: { padding: 20, paddingBottom: 100 },
  heroCard: { borderRadius: 18, padding: 18, marginBottom: 18 },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.9)', marginTop: 4, fontSize: 12 },
  formCard: { backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 16, padding: 16, marginBottom: 24 },
  fieldLabel: { fontSize: 11, fontWeight: '800', color: COLORS.outline, marginBottom: 8, marginTop: 10, letterSpacing: 0.7 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: COLORS.surfaceContainerLow },
  typeBtnActive: { backgroundColor: COLORS.primary },
  typeText: { fontSize: 12, fontWeight: '600', color: COLORS.onSurfaceVariant },
  typeTextActive: { color: '#fff' },
  dateInput: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.surfaceContainerLow, borderRadius: 12, padding: 14,
  },
  dateText: { fontSize: 14, fontWeight: '700', color: COLORS.onSurface },
  timeGrid: { flexDirection: 'row', gap: 10, marginTop: 10 },
  timeInput: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.surfaceContainerLow, borderRadius: 12, padding: 14,
  },
  timeText: { fontSize: 14, fontWeight: '800', color: COLORS.onSurface },
  presetRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  presetChip: { backgroundColor: COLORS.primaryFixed, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  presetText: { color: COLORS.primary, fontSize: 11, fontWeight: '700' },
  durationCard: {
    marginTop: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'rgba(0,86,210,0.06)', borderRadius: 12, padding: 12,
  },
  durationLabel: { fontSize: 12, color: COLORS.primary, fontWeight: '700' },
  durationValue: { fontSize: 16, color: COLORS.primary, fontWeight: '800' },
  submitBtn: { marginTop: 16, backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 1 },
  sectionHeader: { marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.onSurface },
  historyList: { gap: 10 },
  historyItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 14, padding: 14,
  },
  historyLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  historyIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: COLORS.primaryFixed, justifyContent: 'center', alignItems: 'center' },
  historyTitle: { fontSize: 13, fontWeight: '700', color: COLORS.onSurface },
  historyMeta: { fontSize: 11, color: COLORS.outline, marginTop: 2 },
  statusBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 9, fontWeight: '800' },
  emptyText: { textAlign: 'center', color: COLORS.outline, marginTop: 10 },
});
