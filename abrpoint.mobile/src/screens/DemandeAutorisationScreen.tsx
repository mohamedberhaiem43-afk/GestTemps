import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, RefreshControl, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import { COLORS } from '../config/env';
import DatePickerModal from '../components/DatePickerModal';
import TimePickerModal from '../components/TimePickerModal';

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
  'Refusé': { bg: '#fee2e2', text: '#991b1b' },
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
  const [demandes, setDemandes] = useState<DemandeAutorisation[]>([]);
  const [absences, setAbsences] = useState<AbsenceOption[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editDemande, setEditDemande] = useState<DemandeAutorisation | null>(null);
  const [showAbsencePicker, setShowAbsencePicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Form state
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
        // Manager: load all, filter by service
        const data = await apiService.getDemandeAutorisations(user.soccod, user.uticod);
        const all = Array.isArray(data) ? data : [];
        // Filter: show own + those from same service (if sercod available in response)
        const own = all.filter((d: any) => d.empcod === user.uticod);
        const service = all.filter((d: any) => d.empcod !== user.uticod && (!d.sercod || d.sercod === user.sercod));
        setDemandes([...own, ...service]);
      } else {
        // Admin: sees all
        const data = await apiService.getDemandeAutorisations(user.soccod, user.uticod);
        setDemandes(Array.isArray(data) ? data : []);
      }
    } catch (e) { console.log('Load demandes error:', e); }
  };

  const loadAbsences = async () => {
  if (!user?.soccod) return;
  try {
    // Même backend que le web (useGetAutorisationLibs) — renvoie un array d'AbsenceOption.
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

  const openNewForm = () => {
    setEditDemande(null);
    setFormCondep(new Date());
    setFormConret(new Date());
    setFormConmotif('');
    // Reset abscod to default
    const defaultAbs = absences.find((a) => a.abscng === 'B');
    if (defaultAbs) setFormAbscod(defaultAbs.abscod);
    else if (absences.length > 0) setFormAbscod(absences[0].abscod);
    setShowForm(true);
  };

  const openEditForm = (d: DemandeAutorisation) => {
    setEditDemande(d);
    setFormCondep(d.condep ? new Date(d.condep) : new Date());
    setFormConret(d.conret ? new Date(d.conret) : new Date());
    setFormConmotif(d.conmotif || '');
    setFormAbscod(d.abscod || '');
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!formConmotif) {
      Alert.alert('Erreur', 'Veuillez remplir le motif');
      return;
    }
    if (!user?.soccod || !user?.uticod) return;

    try {
      const payload = {
        soccod: user.soccod,
        empcod: user.uticod,
        concod: editDemande?.concod || `DA${Date.now().toString().slice(-6)}`,
        condat: new Date().toISOString().split('T')[0],
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
        Alert.alert('✅ Succès', 'Demande d\'autorisation envoyée');
      }
      setShowForm(false);
      setEditDemande(null);
      loadDemandes();
    } catch (e) {
      Alert.alert('Erreur', 'Impossible d\'envoyer la demande');
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
        }
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
          } catch { Alert.alert('Erreur', 'Impossible d\'approuver'); }
        }
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
        }
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

  const pending = demandes.filter((d) => getStatus(d) === 'En attente');
  const approved = demandes.filter((d) => getStatus(d) === 'Approuvé');
  const refused = demandes.filter((d) => getStatus(d) === 'Refusé');

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Demande d'Autorisation</Text>
        <TouchableOpacity onPress={openNewForm}>
          <Text style={styles.addBtn}>+ Nouveau</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
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

      {/* Form Modal */}
      <Modal visible={showForm} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editDemande ? '✏️ Modifier la demande' : '📝 Nouvelle demande'}
              </Text>
              <TouchableOpacity onPress={() => { setShowForm(false); setEditDemande(null); }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {/* Type d'autorisation */}
              <Text style={styles.label}>Type d'autorisation</Text>
              <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowAbsencePicker(true)}>
                <Text style={styles.pickerBtnText}>{getSelectedAbsenceLabel()}</Text>
                <Text style={styles.pickerArrow}>▼</Text>
              </TouchableOpacity>

              {/* Début : date + heure séparés */}
              <Text style={styles.label}>Date/Heure début</Text>
              <View style={styles.dateTimeRow}>
                <TouchableOpacity style={[styles.pickerBtn, styles.dateTimeBtn]} onPress={() => setShowDepDatePicker(true)}>
                  <Text style={styles.pickerBtnText}>📅 {fmtDate(formCondep.toISOString())}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.pickerBtn, styles.dateTimeBtn]} onPress={() => setShowDepTimePicker(true)}>
                  <Text style={styles.pickerBtnText}>🕐 {fmtTime(formCondep.toISOString())}</Text>
                </TouchableOpacity>
              </View>

              {/* Retour : date + heure séparés */}
              <Text style={styles.label}>Date/Heure fin</Text>
              <View style={styles.dateTimeRow}>
                <TouchableOpacity style={[styles.pickerBtn, styles.dateTimeBtn]} onPress={() => setShowRetDatePicker(true)}>
                  <Text style={styles.pickerBtnText}>📅 {fmtDate(formConret.toISOString())}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.pickerBtn, styles.dateTimeBtn]} onPress={() => setShowRetTimePicker(true)}>
                  <Text style={styles.pickerBtnText}>🕐 {fmtTime(formConret.toISOString())}</Text>
                </TouchableOpacity>
              </View>

              {/* Duration */}
              <View style={styles.durationCard}>
                <Text style={styles.durationLabel}>Durée</Text>
                <Text style={styles.durationValue}>{fmtDuration(calcDuration())}</Text>
              </View>

              {/* Motif */}
              <Text style={styles.label}>Motif *</Text>
              <TextInput
                style={[styles.input, { height: 70 }]}
                value={formConmotif}
                multiline
                onChangeText={setFormConmotif}
                placeholder="Raison de la demande d'autorisation..."
                placeholderTextColor="#aaa"
              />

              {/* Submit */}
              <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
                <Text style={styles.submitBtnText}>
                  {editDemande ? '📤 Modifier la demande' : '📤 Envoyer la demande'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Absence Picker Modal */}
      <Modal visible={showAbsencePicker} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Type d'autorisation</Text>
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

      {/* Date pickers (préservent l'heure existante) */}
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

      {/* Time pickers — heure et minute pour début & retour */}
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

      {/* List */}
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
      >
        {demandes.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>Aucune demande d'autorisation</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={openNewForm}>
              <Text style={styles.emptyBtnText}>Créer une demande</Text>
            </TouchableOpacity>
          </View>
        ) : (
          demandes.map((item, i) => {
            const status = getStatus(item);
            const statusColors = STATUS_COLORS[status];
            return (
              <View key={item.id || i} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardDate}>📅 {fmtDate(item.condep)}</Text>
                    {item.emplib ? <Text style={styles.cardEmp}>👤 {item.emplib}</Text> : null}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: statusColors.text }]}>{status}</Text>
                  </View>
                </View>

                {/* Period & Duration */}
                <View style={styles.cardDetails}>
                  <Text style={styles.cardTime}>
                    🕐 {fmtTime(item.condep)} → {fmtTime(item.conret)}
                  </Text>
                  <Text style={styles.cardDuration}>⏱️ {fmtDuration(item.connbjour)}</Text>
                </View>

                {/* Absence type */}
                {item.abslib ? (
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeBadgeText}>{item.abslib}</Text>
                  </View>
                ) : null}

                {/* Motif */}
                {item.conmotif ? (
                  <Text style={styles.cardMotif} numberOfLines={2}>{item.conmotif}</Text>
                ) : null}

                {/* Actions */}
                <View style={styles.cardFooter}>
                  <Text style={styles.cardRef}>#{item.concod || item.id}</Text>
                  <View style={styles.cardActions}>
                    {/* Employee: edit/delete pending */}
                    {isEmployee && item.empcod === user?.uticod && status === 'En attente' && (
                      <>
                        <TouchableOpacity style={styles.editBtn} onPress={() => openEditForm(item)}>
                          <Text style={styles.editBtnText}>✏️ Modifier</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.deleteBtnSmall} onPress={() => handleDelete(item)}>
                          <Text style={styles.deleteBtnText}>🗑️</Text>
                        </TouchableOpacity>
                      </>
                    )}
                    {/* Admin/Manager: approve/refuse pending */}
                    {(isAdmin || isManager) && status === 'En attente' && (
                      <>
                        <TouchableOpacity style={styles.refuseBtn} onPress={() => handleRefuse(item)}>
                          <Text style={styles.refuseBtnText}>✗ Refuser</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(item)}>
                          <Text style={styles.approveBtnText}>✓ Approuver</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, backgroundColor: '#fff', elevation: 2,
  },
  backBtn: { fontSize: 16, color: COLORS.primary, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, flex: 1, marginLeft: 12 },
  addBtn: { fontSize: 14, color: COLORS.primary, fontWeight: 'bold' },

  // Stats
  statsRow: { flexDirection: 'row', gap: 8, padding: 12 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 12,
    borderLeftWidth: 4, elevation: 1,
  },
  statValue: { fontSize: 22, fontWeight: 'bold' },
  statLabel: { fontSize: 10, color: COLORS.textSecondary, marginTop: 2 },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '85%', paddingBottom: 20,
  },
  modalScroll: { padding: 20 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  modalClose: { fontSize: 20, color: '#999', fontWeight: 'bold' },

  // Form
  label: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 4, marginTop: 12 },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 10,
    fontSize: 14, backgroundColor: '#fafafa', color: COLORS.text,
  },
  pickerBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 12,
    backgroundColor: '#fafafa',
  },
  pickerBtnText: { fontSize: 14, color: COLORS.text },
  pickerArrow: { fontSize: 12, color: '#999' },
  dateTimeRow: { flexDirection: 'row', gap: 8 },
  dateTimeBtn: { flex: 1 },

  // Duration
  durationCard: {
    backgroundColor: '#f0f5ff', borderRadius: 10, padding: 14,
    alignItems: 'center', marginTop: 12, borderWidth: 1, borderColor: '#bfdbfe',
  },
  durationLabel: { fontSize: 10, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
  durationValue: { fontSize: 24, fontWeight: '800', color: COLORS.primary, marginTop: 4 },

  // Submit
  submitBtn: {
    backgroundColor: COLORS.primary, borderRadius: 10, padding: 14,
    alignItems: 'center', marginTop: 20,
  },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },

  // Absence picker modal
  pickerModalContent: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '60%', paddingBottom: 20,
  },
  absenceItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 14, borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  absenceItemActive: { backgroundColor: COLORS.primary + '10' },
  absenceItemText: { fontSize: 14, color: COLORS.text },
  absenceItemTextActive: { color: COLORS.primary, fontWeight: 'bold' },
  defaultBadge: {
    fontSize: 10, color: '#fff', backgroundColor: COLORS.primary,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, overflow: 'hidden',
  },

  // Cards
  card: {
    backgroundColor: '#fff', marginHorizontal: 4, marginTop: 8, borderRadius: 12,
    padding: 14, elevation: 1,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardDate: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  cardEmp: { fontSize: 12, color: COLORS.primary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusBadgeText: { fontSize: 10, fontWeight: '600' },
  cardDetails: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f5f5f5',
  },
  cardTime: { fontSize: 12, color: COLORS.textSecondary },
  cardDuration: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  typeBadge: {
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 10, backgroundColor: COLORS.primary + '20', marginTop: 8,
  },
  typeBadgeText: { fontSize: 10, color: COLORS.primary, fontWeight: '600' },
  cardMotif: { fontSize: 12, color: COLORS.textSecondary, marginTop: 6, lineHeight: 16 },
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f5f5f5',
  },
  cardRef: { fontSize: 10, color: '#aaa' },
  cardActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  editBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: '#e0f2fe' },
  editBtnText: { fontSize: 11, color: COLORS.primary, fontWeight: '600' },
  deleteBtnSmall: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#fee2e2' },
  deleteBtnText: { fontSize: 12 },
  refuseBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: '#fee2e2' },
  refuseBtnText: { fontSize: 11, color: '#991b1b', fontWeight: '600' },
  approveBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: '#dcfce7' },
  approveBtnText: { fontSize: 11, color: '#166534', fontWeight: '600' },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: COLORS.textSecondary, marginBottom: 16 },
  emptyBtn: {
    backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 12,
  },
  emptyBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
});