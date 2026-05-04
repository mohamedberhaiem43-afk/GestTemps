import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, RefreshControl, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import { COLORS } from '../config/env';
import DatePickerModal from '../components/DatePickerModal';
import TimePickerModal from '../components/TimePickerModal';
import BottomTabBar, { useTabBarPadding } from '../components/BottomTabBar';

// ── Types ──
interface DemandeAutorisation {
  id: number;
  soccod: string | null;
  empcod: string | null;
  concod: string | null;
  condat?: string;
  condep?: string;
  conret?: string;
  connbjour?: number;
  conmotif: string | null;
  statut: string;
  dateDemande?: string;
  traitePar: string | null;
  dateTraitement?: string;
  commentaire: string | null;
  abscod: string | null;
  emplib?: string;
  abslib?: string;
}

interface AbsenceOption {
  abscod: string;
  soccod: string;
  abslib: string;
  abscng: string;
}

// ── Helpers ──
const getStatus = (d: DemandeAutorisation): 'Approuvé' | 'Refusé' | 'En attente' => {
  const s = d.statut?.trim() ?? '';
  if (s.includes('Approuv') || s.includes('Accept')) return 'Approuvé';
  if (s.includes('Refus')) return 'Refusé';
  return 'En attente';
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  'Approuvé': { bg: '#dcfce7', text: '#166534' },
  'Refusé':   { bg: '#fee2e2', text: '#991b1b' },
  'En attente': { bg: '#fef9c3', text: '#854d0e' },
};

const fmtDate = (d: string | null | undefined) => {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
};

const fmtTime = (d: string | null | undefined) => {
  if (!d) return '';
  try { return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
};

const fmtDuration = (hours: number | null | undefined) => {
  if (!hours) return '0h00';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h${m.toString().padStart(2, '0')}`;
};

export default function DemandeAutorisationScreen({ navigation }: any) {
  const { user, isEmployee, isAdmin, isManager } = useAuth();
  const tabBarPadding = useTabBarPadding();
  const [demandes, setDemandes] = useState<DemandeAutorisation[]>([]);
  const [absences, setAbsences] = useState<AbsenceOption[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editDemande, setEditDemande] = useState<DemandeAutorisation | null>(null);
  const [showAbsencePicker, setShowAbsencePicker] = useState(false);

  // Form state
  const [formConcod, setFormConcod] = useState('');
  const [formCondat, setFormCondat] = useState(new Date());
  const [formCondep, setFormCondep] = useState(new Date());
  const [formConret, setFormConret] = useState(new Date());
  const [formConmotif, setFormConmotif] = useState('');
  const [formAbscod, setFormAbscod] = useState('');
  const [showDepDatePicker, setShowDepDatePicker] = useState(false);
  const [showRetDatePicker, setShowRetDatePicker] = useState(false);
  const [showDepTimePicker, setShowDepTimePicker] = useState(false);
  const [showRetTimePicker, setShowRetTimePicker] = useState(false);

  useEffect(() => { loadDemandes(); loadAbsences(); }, [user]);

  const loadDemandes = async () => {
    if (!user?.soccod || !user?.uticod) return;
    try {
      if (isEmployee && !isAdmin && !isManager) {
        const data = await apiService.getDemandeAutorisationsByEmp(user.soccod, user.uticod);
        setDemandes(Array.isArray(data) ? data : []);
      } else if (isManager && user.sercod) {
        const data = await apiService.getDemandeAutorisations(user.soccod, user.uticod);
        const all = Array.isArray(data) ? data : [];
        const own = all.filter((d: any) => d.empcod === user.uticod);
        const service = all.filter((d: any) => d.empcod !== user.uticod && (!d.sercod || d.sercod === user.sercod));
        setDemandes([...own, ...service]);
      } else {
        const data = await apiService.getDemandeAutorisations(user.soccod, user.uticod);
        setDemandes(Array.isArray(data) ? data : []);
      }
    } catch (e) { console.log('Load demandes error:', e); }
  };

  const loadAbsences = async () => {
    if (!user?.soccod) return;
    try {
      const data = await apiService.getAutorisationLibs(user.soccod);

      let absData: AbsenceOption[] = [];
      if (Array.isArray(data)) {
        absData = data as AbsenceOption[];
      } else if (data && typeof data === 'object') {
        absData = Object.entries(data).map(([key, value]) => ({
          abscod: key,
          soccod: user.soccod!,
          abslib: value as string,
          abscng: '',
        }));
      }

      setAbsences(absData);

      const defaultAbs = absData.find((a) => a.abscng === 'B')
        || absData.find((a) => a.abslib?.toLowerCase().includes('autorisation'));
      if (defaultAbs) setFormAbscod(defaultAbs.abscod);
      else if (absData.length > 0) setFormAbscod(absData[0].abscod);
    } catch (e) { console.log('Load absences error:', e); }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadDemandes(), loadAbsences()]);
    setRefreshing(false);
  };

  const generateConcod = () => {
    // Numéro d'ordre : DA + AAMMJJHHmm (équivalent du generateNumeroOrdre côté web).
    const n = new Date();
    const pad = (x: number) => String(x).padStart(2, '0');
    return `DA${String(n.getFullYear()).slice(-2)}${pad(n.getMonth() + 1)}${pad(n.getDate())}${pad(n.getHours())}${pad(n.getMinutes())}`;
  };

  const openNewForm = () => {
    setEditDemande(null);
    setFormConcod(generateConcod());
    setFormCondat(new Date());
    setFormCondep(new Date());
    setFormConret(new Date());
    setFormConmotif('');
    const defaultAbs = absences.find((a) => a.abscng === 'B');
    if (defaultAbs) setFormAbscod(defaultAbs.abscod);
    else if (absences.length > 0) setFormAbscod(absences[0].abscod);
    setShowForm(true);
  };

  const openEditForm = (d: DemandeAutorisation) => {
    setEditDemande(d);
    setFormConcod(d.concod || '');
    setFormCondat(d.condat ? new Date(d.condat) : new Date());
    setFormCondep(d.condep ? new Date(d.condep) : new Date());
    setFormConret(d.conret ? new Date(d.conret) : new Date());
    setFormConmotif(d.conmotif || '');
    setFormAbscod(d.abscod || '');
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!formAbscod) {
      Alert.alert('Erreur', 'Veuillez sélectionner un type de sortie');
      return;
    }
    if (!formConmotif) {
      Alert.alert('Erreur', 'Veuillez remplir le motif');
      return;
    }
    if (!user?.soccod || !user?.uticod) return;

    try {
      const payload = {
        soccod: user.soccod,
        empcod: user.uticod,
        concod: formConcod || generateConcod(),
        condat: formCondat.toISOString().split('T')[0],
        condep: formCondep.toISOString(),
        conret: formConret.toISOString(),
        conmotif: formConmotif,
        abscod: formAbscod || null,
      };

      if (editDemande) {
        await apiService.updateDemandeAutorisation({ ...payload, id: editDemande.id });
        Alert.alert('✅ Succès', 'Demande modifiée avec succès');
      } else {
        await apiService.createDemandeAutorisation(payload);
        Alert.alert('✅ Succès', "Demande de sortie envoyée");
      }
      setShowForm(false);
      setEditDemande(null);
      loadDemandes();
    } catch (e) {
      Alert.alert('Erreur', "Impossible d'envoyer la demande");
    }
  };

  const handleDelete = (d: DemandeAutorisation) => {
    Alert.alert('Supprimer', 'Voulez-vous supprimer cette demande ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive', onPress: async () => {
          try {
            await apiService.deleteDemandeAutorisation(d.id);
            loadDemandes();
          } catch { Alert.alert('Erreur', 'Impossible de supprimer'); }
        },
      },
    ]);
  };

  const handleApprove = (d: DemandeAutorisation) => {
    Alert.alert('Approuver', `Approuver la demande de ${d.emplib || d.empcod} ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Approuver', onPress: async () => {
          try {
            await apiService.approveDemandeAutorisation(d.id, user!.uticod!);
            Alert.alert('✅ Succès', 'Demande approuvée');
            loadDemandes();
          } catch { Alert.alert('Erreur', "Impossible d'approuver"); }
        },
      },
    ]);
  };

  const handleRefuse = (d: DemandeAutorisation) => {
    Alert.alert('Refuser', `Refuser la demande de ${d.emplib || d.empcod} ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Refuser', style: 'destructive', onPress: async () => {
          try {
            await apiService.refuseDemandeAutorisation(d.id, user!.uticod!);
            Alert.alert('Succès', 'Demande refusée');
            loadDemandes();
          } catch { Alert.alert('Erreur', 'Impossible de refuser'); }
        },
      },
    ]);
  };

  const getSelectedAbsenceLabel = () => {
    const found = absences.find((a) => a.abscod === formAbscod);
    return found ? `${found.abscod} - ${found.abslib}` : 'Sélectionner un type...';
  };

  const calcDuration = () => {
    const diff = (formConret.getTime() - formCondep.getTime()) / 3600000;
    return Math.max(0, Math.round(diff * 100) / 100);
  };

  const pending  = demandes.filter((d) => getStatus(d) === 'En attente');
  const approved = demandes.filter((d) => getStatus(d) === 'Approuvé');
  const refused  = demandes.filter((d) => getStatus(d) === 'Refusé');

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Top App Bar ── */}
      <View style={styles.topAppBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.onSurface} />
        </TouchableOpacity>
        <Text style={styles.topAppTitle}>Demandes de sortie</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero Card ── */}
        <LinearGradient colors={[COLORS.primary, COLORS.primaryContainer]} style={styles.heroCard}>
          <View style={styles.heroIconBubble}>
            <MaterialCommunityIcons name="logout-variant" size={24} color="#fff" />
          </View>
          <Text style={styles.heroTitle}>Mes demandes de sortie</Text>
          <Text style={styles.heroSub}>Suivez l'état de vos sorties et créez-en de nouvelles.</Text>
          <TouchableOpacity style={styles.addBtn} onPress={openNewForm} activeOpacity={0.85}>
            <MaterialCommunityIcons name="plus-circle" size={18} color="#fff" />
            <Text style={styles.addBtnText}>Nouvelle sortie</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* ── Stats Row ── */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderLeftColor: '#22c55e' }]}>
            <Text style={[styles.statValue, { color: '#22c55e' }]}>{approved.length}</Text>
            <Text style={styles.statLabel}>Approuvées</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#ef4444' }]}>
            <Text style={[styles.statValue, { color: '#ef4444' }]}>{refused.length}</Text>
            <Text style={styles.statLabel}>Refusées</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#f59e0b' }]}>
            <Text style={[styles.statValue, { color: '#f59e0b' }]}>{pending.length}</Text>
            <Text style={styles.statLabel}>En attente</Text>
          </View>
        </View>

        {/* ── History ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Historique des demandes</Text>
        </View>

        <View style={styles.historyList}>
          {demandes.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>Aucune demande de sortie</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={openNewForm}>
                <Text style={styles.emptyBtnText}>Créer une demande</Text>
              </TouchableOpacity>
            </View>
          ) : (
            demandes.map((item, i) => {
              const status = getStatus(item);
              const statusColors = STATUS_COLORS[status];
              return (
                <View key={item.id || i} style={styles.historyItem}>
                  <View style={styles.historyLeft}>
                    <View style={styles.historyIcon}>
                      <MaterialCommunityIcons name="briefcase-outline" size={20} color={COLORS.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyTitle}>
                        {item.conmotif || item.abslib || "Demande de sortie"}
                      </Text>
                      <Text style={styles.historyMeta}>
                        {fmtDate(item.condep)} • {fmtDuration(item.connbjour)}
                      </Text>
                      {item.emplib && (
                        <Text style={styles.historyEmp}>👤 {item.emplib}</Text>
                      )}
                    </View>
                  </View>

                  <View style={{ alignItems: 'flex-end', gap: 8 }}>
                    <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
                      <Text style={[styles.statusText, { color: statusColors.text }]}>{status}</Text>
                    </View>

                    {status === 'En attente' && (
                      <View style={styles.itemActions}>
                        {/* Employee: edit / delete own requests */}
                        {isEmployee && item.empcod === user?.uticod && (
                          <>
                            <TouchableOpacity style={styles.editBtn} onPress={() => openEditForm(item)}>
                              {/* BUG FIX: size={16} not size: 16 */}
                              <MaterialCommunityIcons name="pencil" size={16} color={COLORS.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
                              <MaterialCommunityIcons name="delete" size={16} color="#ef4444" />
                            </TouchableOpacity>
                          </>
                        )}
                        {/* Admin / Manager: approve or refuse */}
                        {(isAdmin || isManager) && (
                          <>
                            <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(item)}>
                              {/* BUG FIX: size={16} not size: 16 */}
                              <MaterialCommunityIcons name="check" size={16} color="#22c55e" />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.refuseBtn} onPress={() => handleRefuse(item)}>
                              {/* BUG FIX: size={16} not size: 16 */}
                              <MaterialCommunityIcons name="close" size={16} color="#ef4444" />
                            </TouchableOpacity>
                          </>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* ── Form Modal ── */}
      <Modal visible={showForm} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editDemande ? '✏️ Modifier la demande de sortie' : '📝 Nouvelle demande de sortie'}
              </Text>
              <TouchableOpacity onPress={() => { setShowForm(false); setEditDemande(null); }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalHero}>
              <Text style={styles.modalHeroTitle}>Saisie de sortie</Text>
              <Text style={styles.modalHeroSub}>Remplissez les détails de votre sortie pour une validation rapide.</Text>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {/* Numéro d'ordre + Date de demande : lecture seule, alignés sur la maquette web */}
              <View style={styles.dateTimeRow}>
                <View style={styles.dateTimeBtn}>
                  <Text style={styles.label}>N° d'ordre</Text>
                  <View style={[styles.pickerBtn, styles.readonlyField]}>
                    <Text style={styles.pickerBtnText}>{formConcod || '—'}</Text>
                  </View>
                </View>
                <View style={styles.dateTimeBtn}>
                  <Text style={styles.label}>Date de demande</Text>
                  <View style={[styles.pickerBtn, styles.readonlyField]}>
                    <Text style={styles.pickerBtnText}>{fmtDate(formCondat.toISOString())}</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.label}>Type de sortie</Text>
              <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowAbsencePicker(true)}>
                <Text style={styles.pickerBtnText}>{getSelectedAbsenceLabel()}</Text>
                <Text style={styles.pickerArrow}>▼</Text>
              </TouchableOpacity>

              <Text style={styles.label}>Date/Heure début</Text>
              <View style={styles.dateTimeRow}>
                <TouchableOpacity style={[styles.pickerBtn, styles.dateTimeBtn]} onPress={() => setShowDepDatePicker(true)}>
                  <Text style={styles.pickerBtnText}>📅 {fmtDate(formCondep.toISOString())}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.pickerBtn, styles.dateTimeBtn]} onPress={() => setShowDepTimePicker(true)}>
                  <Text style={styles.pickerBtnText}>🕐 {fmtTime(formCondep.toISOString())}</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Date/Heure fin</Text>
              <View style={styles.dateTimeRow}>
                <TouchableOpacity style={[styles.pickerBtn, styles.dateTimeBtn]} onPress={() => setShowRetDatePicker(true)}>
                  <Text style={styles.pickerBtnText}>📅 {fmtDate(formConret.toISOString())}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.pickerBtn, styles.dateTimeBtn]} onPress={() => setShowRetTimePicker(true)}>
                  <Text style={styles.pickerBtnText}>🕐 {fmtTime(formConret.toISOString())}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.durationCard}>
                <Text style={styles.durationLabel}>Durée</Text>
                <Text style={styles.durationValue}>{fmtDuration(calcDuration())}</Text>
              </View>

              <Text style={styles.label}>Motif *</Text>
              <TextInput
                style={[styles.input, { height: 70 }]}
                value={formConmotif}
                multiline
                onChangeText={setFormConmotif}
                placeholder="Raison de la sortie..."
                placeholderTextColor="#aaa"
              />

              <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
                <Text style={styles.submitBtnText}>
                  {editDemande ? '📤 Modifier la sortie' : '📤 Envoyer la sortie'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Absence Picker Modal ── */}
      <Modal visible={showAbsencePicker} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Type de sortie</Text>
              <TouchableOpacity onPress={() => setShowAbsencePicker(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={absences}
              keyExtractor={(item) => `${item.abscod}-${item.soccod}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.absenceItem, item.abscod === formAbscod && styles.absenceItemActive]}
                  onPress={() => { setFormAbscod(item.abscod); setShowAbsencePicker(false); }}
                >
                  <Text style={[styles.absenceItemText, item.abscod === formAbscod && styles.absenceItemTextActive]}>
                    {item.abscod} - {item.abslib}
                  </Text>
                  {item.abscng === 'B' && <Text style={styles.defaultBadge}>Défaut</Text>}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* ── Date Pickers ── */}
      <DatePickerModal
        visible={showDepDatePicker}
        value={formCondep}
        onChange={(d) => {
          const next = new Date(d);
          next.setHours(formCondep.getHours(), formCondep.getMinutes(), 0, 0);
          setFormCondep(next);
          setShowDepDatePicker(false);
        }}
        onClose={() => setShowDepDatePicker(false)}
        title="Date début"
      />
      <DatePickerModal
        visible={showRetDatePicker}
        value={formConret}
        onChange={(d) => {
          const next = new Date(d);
          next.setHours(formConret.getHours(), formConret.getMinutes(), 0, 0);
          setFormConret(next);
          setShowRetDatePicker(false);
        }}
        onClose={() => setShowRetDatePicker(false)}
        title="Date fin"
      />

      {/* ── Time Pickers ── */}
      <TimePickerModal
        visible={showDepTimePicker}
        value={formCondep}
        onChange={(d) => { setFormCondep(d); }}
        onClose={() => setShowDepTimePicker(false)}
        title="Heure de début"
      />
      <TimePickerModal
        visible={showRetTimePicker}
        value={formConret}
        onChange={(d) => { setFormConret(d); }}
        onClose={() => setShowRetTimePicker(false)}
        title="Heure de retour"
      />

      <BottomTabBar active="requests" navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ── Layout ──
  container: { flex: 1, backgroundColor: COLORS.background },

  // ── Top Bar ──
  topAppBar: {
    height: 56, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 12, backgroundColor: COLORS.background,
    borderBottomWidth: 1, borderBottomColor: COLORS.surfaceContainerHigh,
  },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  topAppTitle: {
    fontFamily: 'Manrope', fontWeight: '800', fontSize: 17,
    color: COLORS.onSurface, letterSpacing: -0.3,
  },

  // ── Scroll ──
  scrollContent: { padding: 20, paddingBottom: 100 },

  // ── Hero ──
  heroCard: { borderRadius: 18, padding: 20, marginBottom: 20 },
  heroIconBubble: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  heroSub: { color: 'rgba(255,255,255,0.9)', marginTop: 6, fontSize: 13, lineHeight: 18 },
  addBtn: {
    marginTop: 14, backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    alignSelf: 'flex-start',
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // ── Stats ──
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  statCard: {
    flex: 1, backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 10,
    padding: 12, borderLeftWidth: 4, elevation: 1,
  },
  statValue: { fontSize: 22, fontWeight: 'bold' },
  statLabel: { fontSize: 10, color: COLORS.outline, marginTop: 2 },

  // ── Section Header ──
  sectionHeader: { marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.onSurface },

  // ── History List ──
  historyList: { gap: 10 },
  historyItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 14, padding: 14,
  },
  historyLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  historyIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: COLORS.primaryFixed, justifyContent: 'center', alignItems: 'center',
  },
  historyTitle: { fontSize: 13, fontWeight: '700', color: COLORS.onSurface },
  // BUG FIX: historyMeta & historyEmp were missing from StyleSheet
  historyMeta: { fontSize: 11, color: COLORS.outline, marginTop: 2 },
  historyEmp:  { fontSize: 11, color: COLORS.primary, marginTop: 2 },

  // ── Status Badge ──
  statusBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  statusText:  { fontSize: 9, fontWeight: '800' },

  // ── Item Action Buttons ──
  itemActions: { flexDirection: 'row', gap: 8 },
  editBtn:    { padding: 6, borderRadius: 6, backgroundColor: '#e0f2fe' },
  deleteBtn:  { padding: 6, borderRadius: 6, backgroundColor: '#fee2e2' },
  approveBtn: { padding: 6, borderRadius: 6, backgroundColor: '#dcfce7' },
  refuseBtn:  { padding: 6, borderRadius: 6, backgroundColor: '#fee2e2' },

  // ── Empty State ──
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon:  { fontSize: 48, marginBottom: 12 },
  emptyText:  { fontSize: 16, color: COLORS.outline, marginBottom: 16 },
  emptyBtn:   {
    backgroundColor: COLORS.primary, borderRadius: 10,
    paddingHorizontal: 20, paddingVertical: 12,
  },
  emptyBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },

  // ── Modal Shared ──
  // BUG FIX: all modal styles were missing from StyleSheet
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  pickerModalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.surfaceContainerHigh,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: COLORS.onSurface },
  modalClose: { fontSize: 18, color: COLORS.outline, padding: 4 },
  modalScroll: { padding: 16 },
  modalHero: { backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 16, padding: 16, marginHorizontal: 16, marginBottom: 12 },
  modalHeroTitle: { fontSize: 16, fontWeight: '800', color: COLORS.onSurface },
  modalHeroSub: { fontSize: 12, color: COLORS.onSurfaceVariant, marginTop: 6, lineHeight: 18 },

  // ── Form Fields ──
  label: {
    fontSize: 12, fontWeight: '700', color: COLORS.outline,
    marginTop: 12, marginBottom: 6, letterSpacing: 0.5,
  },
  pickerBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.surfaceContainerLow, borderRadius: 12, padding: 14,
  },
  pickerBtnText: { fontSize: 14, color: COLORS.onSurface, flex: 1 },
  pickerArrow:   { fontSize: 12, color: COLORS.outline },
  readonlyField: { backgroundColor: COLORS.surfaceContainerHigh, opacity: 0.85 },
  dateTimeRow:   { flexDirection: 'row', gap: 8 },
  dateTimeBtn:   { flex: 1 },
  durationCard: {
    marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'rgba(0,86,210,0.06)', borderRadius: 12, padding: 12,
  },
  durationLabel: { fontSize: 12, color: COLORS.primary, fontWeight: '700' },
  durationValue: { fontSize: 16, color: COLORS.primary, fontWeight: '800' },
  input: {
    backgroundColor: COLORS.surfaceContainerLow, borderRadius: 12,
    padding: 14, fontSize: 14, color: COLORS.onSurface,
  },
  submitBtn: {
    marginTop: 16, backgroundColor: COLORS.primary,
    borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 8,
  },
  // BUG FIX: submitBtnText was missing from StyleSheet
  submitBtnText: { color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 1 },

  // ── Absence Picker List ──
  absenceItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.surfaceContainerHigh,
  },
  absenceItemActive:     { backgroundColor: COLORS.primaryFixed },
  absenceItemText:       { fontSize: 14, color: COLORS.onSurface },
  absenceItemTextActive: { color: COLORS.primary, fontWeight: '700' },
  defaultBadge: {
    fontSize: 10, fontWeight: '700', color: COLORS.primary,
    backgroundColor: COLORS.primaryFixed, paddingHorizontal: 8,
    paddingVertical: 3, borderRadius: 999,
  },
});