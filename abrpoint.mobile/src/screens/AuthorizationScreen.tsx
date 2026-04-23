import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, RefreshControl, Dimensions, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import { COLORS, THEME } from '../config/env';
import DatePickerModal from '../components/DatePickerModal';
import TimePickerModal from '../components/TimePickerModal';

const { width } = Dimensions.get('window');

const REASONS = [
  { id: 'Personnel', label: 'Personnel', icon: 'account' },
  { id: 'Professionnel', label: 'Pro', icon: 'briefcase' },
  { id: 'Médical', label: 'Médical', icon: 'medical-bag' },
];

export default function AuthorizationScreen({ navigation }: any) {
  const { user, isAdmin, isManager, isEmployee } = useAuth();
  const [auths, setAuths] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Form state
  const [form, setForm] = useState({
    condep: new Date(),
    condepTime: new Date(new Date().setHours(14, 0, 0, 0)),
    conretTime: new Date(new Date().setHours(16, 30, 0, 0)),
    conmotif: 'Personnel',
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDepTimePicker, setShowDepTimePicker] = useState(false);
  const [showRetTimePicker, setShowRetTimePicker] = useState(false);

  useEffect(() => { loadAuths(); }, [user]);

  const loadAuths = async () => {
    if (!user?.soccod || !user?.uticod) return;
    try {
      let data: any[] = [];
      if (isAdmin || isManager) {
        data = await apiService.getAuthorizations(user.soccod, user.uticod);
      } else {
        data = await apiService.getMyAuthorizations(user.soccod, user.uticod);
      }
      setAuths(Array.isArray(data) ? data : []);
    } catch (e) {
      console.log('Auth load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAuths();
    setRefreshing(false);
  };

  const totalDuration = useMemo(() => {
    const diff = form.conretTime.getTime() - form.condepTime.getTime();
    if (diff <= 0) return '00h 00m';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
  }, [form.condepTime, form.conretTime]);

  const handleSubmit = async () => {
    if (!user?.soccod || !user?.uticod) return;
    try {
      const depDate = new Date(form.condep);
      const depTime = form.condepTime;
      const depDateTime = new Date(depDate.getFullYear(), depDate.getMonth(), depDate.getDate(),
        depTime.getHours(), depTime.getMinutes());
      const retTime = form.conretTime;
      const retDateTime = new Date(depDate.getFullYear(), depDate.getMonth(), depDate.getDate(),
        retTime.getHours(), retTime.getMinutes());

      const hoursDiff = (retDateTime.getTime() - depDateTime.getTime()) / (1000 * 60 * 60);

      await apiService.createMyAuthorization({
        soccod: user.soccod,
        empcod: user.uticod,
        concod: `AUT${Date.now()}`,
        condep: depDateTime.toISOString(),
        conret: retDateTime.toISOString(),
        condat: new Date().toISOString().split('T')[0],
        conmotif: form.conmotif,
        connbjour: parseFloat(hoursDiff.toFixed(2)) || 1,
        conamdep: depTime.getHours() < 12 ? '1' : '0',
        conamret: retTime.getHours() < 12 ? '1' : '0',
      });
      Alert.alert('✅ Succès', 'Autorisation de sortie envoyée');
      loadAuths();
    } catch (e) { Alert.alert('Erreur', 'Impossible d\'envoyer la demande'); }
  };

  const getStatusInfo = (consanc: string) => {
    switch (consanc) {
      case 'A': return { label: 'VALIDÉ', color: COLORS.tertiary, bgColor: COLORS.tertiaryFixed };
      case 'R': return { label: 'REFUSÉ', color: COLORS.error, bgColor: COLORS.errorContainer };
      default: return { label: 'EN ATTENTE', color: '#b45309', bgColor: '#fff4e5' };
    }
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
      {/* TopAppBar */}
      <View style={styles.topAppBar}>
        <View style={styles.topAppLeft}>
          <View style={styles.profileWrapper}>
            <Image
              source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCpH0P-TIviIZgyzpcdr5V5OvD8tIpoJXxC_ijCe9YSBChJbivkajx6JaBUlFUC7rEZzv94VlWr_mZPHhjztnDXNx7pOylmEsePRzKcCE2H8ojiIpV-ItcWLCdUhbzpo_TC6h5b3YkH-XAwXeJWdrFJFe2ccROcmG8uGwqBq4qpTTx3AhaQpBkpElU1yUcwBj01Rr07fOXj2EDv-c-whqUOePQ6R5XHWO6gqmcMx6v1CE-RnFdYZaKNbC9M7hyi9tDS5oXzdly7DpI' }}
              style={styles.profileImage}
            />
          </View>
          <Text style={styles.logoText}>L'Architecte RH</Text>
        </View>
        <TouchableOpacity style={styles.iconButton}>
          <MaterialCommunityIcons name="bell-outline" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerSection}>
          <Text style={styles.subTitle}>NOUVELLE REQUÊTE</Text>
          <Text style={styles.mainTitle}>Autorisation de Sortie</Text>
        </View>

        {/* Reason Selector */}
        <View style={styles.reasonContainer}>
          <TouchableOpacity
            style={[styles.mainReasonCard, form.conmotif === 'Personnel' && styles.reasonCardActive]}
            onPress={() => setForm({ ...form, conmotif: 'Personnel' })}
          >
            <MaterialCommunityIcons name="account" size={32} color={form.conmotif === 'Personnel' ? COLORS.primary : COLORS.onSurfaceVariant} />
            <Text style={[styles.reasonLabel, form.conmotif === 'Personnel' && styles.reasonLabelActive]}>PERSONNEL</Text>
            {form.conmotif === 'Personnel' && (
              <MaterialCommunityIcons name="check-circle" size={20} color={COLORS.primary} style={styles.checkIcon} />
            )}
          </TouchableOpacity>
          
          <View style={styles.sideReasons}>
            <TouchableOpacity
              style={[styles.smallReasonCard, form.conmotif === 'Professionnel' && styles.reasonCardActive]}
              onPress={() => setForm({ ...form, conmotif: 'Professionnel' })}
            >
              <MaterialCommunityIcons name="briefcase" size={20} color={form.conmotif === 'Professionnel' ? COLORS.primary : COLORS.onSurfaceVariant} />
              <Text style={[styles.reasonLabelSmall, form.conmotif === 'Professionnel' && styles.reasonLabelActive]}>PRO</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.smallReasonCard, form.conmotif === 'Médical' && styles.reasonCardActive]}
              onPress={() => setForm({ ...form, conmotif: 'Médical' })}
            >
              <MaterialCommunityIcons name="medical-bag" size={20} color={form.conmotif === 'Médical' ? COLORS.primary : COLORS.onSurfaceVariant} />
              <Text style={[styles.reasonLabelSmall, form.conmotif === 'Médical' && styles.reasonLabelActive]}>MÉDICAL</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Date & Time Card */}
        <View style={styles.formCard}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>DATE DE LA SORTIE</Text>
            <TouchableOpacity style={styles.dateInput} onPress={() => setShowDatePicker(true)}>
              <MaterialCommunityIcons name="calendar-today" size={20} color={COLORS.primary} />
              <Text style={styles.dateValue}>{form.condep.toLocaleDateString('fr-FR')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.timeGrid}>
            <View style={styles.timeField}>
              <Text style={styles.fieldLabel}>HEURE DÉBUT</Text>
              <TouchableOpacity style={styles.timeInput} onPress={() => setShowDepTimePicker(true)}>
                <MaterialCommunityIcons name="clock-outline" size={20} color={COLORS.primary} />
                <Text style={styles.timeValue}>{form.condepTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.timeField}>
              <Text style={styles.fieldLabel}>HEURE FIN</Text>
              <TouchableOpacity style={styles.timeInput} onPress={() => setShowRetTimePicker(true)}>
                <MaterialCommunityIcons name="history" size={20} color={COLORS.primary} />
                <Text style={styles.timeValue}>{form.conretTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Duration Indicator */}
          <View style={styles.durationCard}>
            <View style={styles.durationLeft}>
              <View style={styles.durationIconWrapper}>
                <MaterialCommunityIcons name="timelapse" size={24} color="#fff" />
              </View>
              <View>
                <Text style={styles.durationLabel}>DURÉE TOTALE</Text>
                <Text style={styles.durationValue}>{totalDuration}</Text>
              </View>
            </View>
            <View style={styles.autoBadge}>
              <Text style={styles.autoBadgeText}>AUTOMATIQUE</Text>
            </View>
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <LinearGradient
            colors={[COLORS.primary, COLORS.primaryContainer]}
            style={styles.submitGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.submitText}>SOUMETTRE LA DEMANDE</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* History Section */}
        <View style={styles.historySection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Historique Récent</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>VOIR TOUT</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.historyList}>
            {auths.slice(0, 5).map((item, idx) => {
              const status = getStatusInfo(item.consanc);
              const icon = REASONS.find(r => r.id === item.conmotif) || REASONS[0];
              return (
                <View key={item.concod || idx} style={[styles.historyItem, { borderLeftColor: status.color }]}>
                  <View style={styles.historyIconWrapper}>
                    <MaterialCommunityIcons name={icon.icon as any} size={24} color={COLORS.primary} />
                  </View>
                  <View style={styles.historyContent}>
                    <View style={styles.historyTop}>
                      <Text style={styles.historyReason}>Démarche {item.conmotif}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: status.bgColor }]}>
                        <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                      </View>
                    </View>
                    <Text style={styles.historyMeta}>
                      {new Date(item.condep).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} • {item.connbjour}h
                    </Text>
                  </View>
                </View>
              );
            })}
            {auths.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Aucun historique récent</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Modals */}
      <DatePickerModal visible={showDatePicker} value={form.condep}
        onChange={(d) => { setForm({ ...form, condep: d }); setShowDatePicker(false); }}
        onClose={() => setShowDatePicker(false)} title="Date de sortie" />
      <TimePickerModal visible={showDepTimePicker} value={form.condepTime}
        onChange={(d) => { setForm({ ...form, condepTime: d }); }}
        onClose={() => setShowDepTimePicker(false)} title="Heure de départ" />
      <TimePickerModal visible={showRetTimePicker} value={form.conretTime}
        onChange={(d) => { setForm({ ...form, conretTime: d }); }}
        onClose={() => setShowRetTimePicker(false)} title="Heure de retour" />

      {/* BottomNavBar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Home')}>
          <MaterialCommunityIcons name="view-dashboard-outline" size={24} color="#94a3b8" />
          <Text style={styles.navLabel}>TABLEAU</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('LeaveRequest')}>
          <MaterialCommunityIcons name="calendar-month-outline" size={24} color="#94a3b8" />
          <Text style={styles.navLabel}>CONGÉS</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => {}}>
          <MaterialCommunityIcons name="exit-to-app" size={24} color={COLORS.primary} />
          <Text style={[styles.navLabel, { color: COLORS.primary }]}>SORTIES</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('PresenceHistory')}>
          <MaterialCommunityIcons name="history" size={24} color="#94a3b8" />
          <Text style={styles.navLabel}>POINTAGE</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Expense')}>
          <MaterialCommunityIcons name="receipt-long" size={24} color="#94a3b8" />
          <Text style={styles.navLabel}>FRAIS</Text>
        </TouchableOpacity>
      </View>
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
  profileWrapper: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', backgroundColor: COLORS.surfaceContainerHigh },
  profileImage: { width: '100%', height: '100%' },
  logoText: { fontFamily: 'Manrope', fontWeight: '800', fontSize: 18, color: COLORS.primary, letterSpacing: -0.5 },
  iconButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 },
  headerSection: { marginBottom: 32 },
  subTitle: { fontSize: 12, fontWeight: '700', color: COLORS.secondary, letterSpacing: 2, marginBottom: 4 },
  mainTitle: { fontSize: 32, fontWeight: '800', color: COLORS.onSurface, letterSpacing: -1 },
  reasonContainer: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  mainReasonCard: {
    flex: 1, height: 128, backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 24, padding: 20, justifyContent: 'space-between',
    borderWidth: 2, borderColor: 'transparent',
  },
  reasonCardActive: { borderColor: COLORS.primary, backgroundColor: 'rgba(0, 86, 210, 0.02)' },
  reasonLabel: { fontSize: 12, fontWeight: '800', color: COLORS.onSurfaceVariant, letterSpacing: 1 },
  reasonLabelActive: { color: COLORS.primary },
  checkIcon: { position: 'absolute', bottom: 16, right: 16 },
  sideReasons: { flex: 1, gap: 12 },
  smallReasonCard: {
    flex: 1, backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16,
    borderWidth: 2, borderColor: 'transparent',
  },
  reasonLabelSmall: { fontSize: 10, fontWeight: '800', color: COLORS.onSurfaceVariant, letterSpacing: 1 },
  formCard: { backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 24, padding: 24, marginBottom: 24 },
  fieldGroup: { marginBottom: 24 },
  fieldLabel: { fontSize: 10, fontWeight: '800', color: COLORS.secondary, letterSpacing: 1.5, marginBottom: 12 },
  dateInput: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: COLORS.surfaceContainerLow, borderRadius: 16, padding: 16 },
  dateValue: { fontSize: 16, fontWeight: '700', color: COLORS.onSurface },
  timeGrid: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  timeField: { flex: 1 },
  timeInput: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.surfaceContainerLow, borderRadius: 16, padding: 16 },
  timeValue: { fontSize: 18, fontWeight: '800', color: COLORS.onSurface },
  durationCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(0, 86, 210, 0.05)', borderRadius: 20, padding: 16 },
  durationLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  durationIconWrapper: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  durationLabel: { fontSize: 9, fontWeight: '800', color: COLORS.primary, letterSpacing: 1 },
  durationValue: { fontSize: 20, fontWeight: '800', color: COLORS.primary, letterSpacing: -0.5 },
  autoBadge: { backgroundColor: 'rgba(0, 86, 210, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  autoBadgeText: { fontSize: 9, fontWeight: '800', color: COLORS.primary },
  submitButton: { marginBottom: 48 },
  submitGradient: { height: 64, borderRadius: 20, justifyContent: 'center', alignItems: 'center', shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 8 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  historySection: { marginBottom: 32 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: COLORS.onSurface, letterSpacing: -0.5 },
  seeAllText: { fontSize: 10, fontWeight: '800', color: COLORS.primary },
  historyList: { gap: 12 },
  historyItem: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 16, padding: 16,
    borderLeftWidth: 4, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 8,
  },
  historyIconWrapper: { width: 48, height: 48, borderRadius: 12, backgroundColor: COLORS.surfaceContainerLow, justifyContent: 'center', alignItems: 'center' },
  historyContent: { flex: 1 },
  historyTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  historyReason: { fontSize: 14, fontWeight: '700', color: COLORS.onSurface },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 2, borderRadius: 12 },
  statusText: { fontSize: 9, fontWeight: '800' },
  historyMeta: { fontSize: 11, fontWeight: '600', color: COLORS.onSurfaceVariant },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, color: COLORS.outline, fontWeight: '500' },
  bottomNav: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)', paddingBottom: 20,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  navItem: { alignItems: 'center', gap: 4 },
  navLabel: { fontSize: 9, fontWeight: '700', color: '#94a3b8' },
});