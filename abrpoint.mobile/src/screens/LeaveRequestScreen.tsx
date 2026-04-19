import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import { COLORS } from '../config/env';
import DatePickerModal from '../components/DatePickerModal';

// Backend returns Etat as: "En attente", "Accepté", "Refusé"
// Backend fields: Concod, Soccod, Empcod, Condat, Conjour,
// Condep, Conamdep, Conret, Conamret, Abscod, Conadr, Contel, Condg,
// Conrefus, Connbjour, Conref, Consolde, Etat

type StatusFilter = 'all' | 'pending' | 'accepted' | 'refused';

export default function LeaveRequestScreen({ navigation }: any) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [absences, setAbsences] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [editingRequest, setEditingRequest] = useState<any>(null);

  // Period filter - default to current year
  const now = new Date();
  const [filterDebut, setFilterDebut] = useState(new Date(now.getFullYear(), 0, 1));
  const [filterFin, setFilterFin] = useState(new Date(now.getFullYear(), 11, 31));
  const [showFilterDebut, setShowFilterDebut] = useState(false);
  const [showFilterFin, setShowFilterFin] = useState(false);

  // Form state - using real backend field names
  const defaultForm = {
    concod: '',
    condep: new Date(),
    conamdep: '1',
    conret: new Date(),
    conamret: '1',
    abscod: '',
    conadr: '',
  };
  const [form, setForm] = useState(defaultForm);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  useEffect(() => { loadAbsences(); }, []);
  useEffect(() => { loadRequests(); }, [user, filterDebut, filterFin]);

  const loadAbsences = async () => {
    try {
      const data = await apiService.getAbsences();
      setAbsences(Array.isArray(data) ? data : []);
    } catch (e) { console.log('Absences load error:', e); }
  };

  const loadRequests = async () => {
    if (!user?.soccod || !user?.uticod) return;
    try {
      const dd = fmt(filterDebut);
      const df = fmt(filterFin);
      let data: any[];
      try {
        data = await apiService.getMyLeaveRequestsByPeriod(user.soccod, user.uticod, dd, df);
      } catch {
        data = await apiService.getMyLeaveRequests(user.soccod, user.uticod);
      }
      setRequests(Array.isArray(data) ? data : []);
    } catch (error) { console.log('Failed to load requests:', error); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadRequests(); setRefreshing(false); };

  const handleDelete = (req: any) => {
    Alert.alert('Supprimer', 'Voulez-vous supprimer cette demande ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive', onPress: async () => {
          try {
            await apiService.deleteLeaveRequest(user!.soccod!, req.concod);
            loadRequests();
          } catch { Alert.alert('Erreur', 'Impossible de supprimer'); }
        }
      },
    ]);
  };

  const handleEdit = (req: any) => {
    setEditingRequest(req);
    setForm({
      concod: req.concod || '',
      condep: req.condep ? new Date(req.condep) : new Date(),
      conamdep: req.conamdep || '1',
      conret: req.conret ? new Date(req.conret) : new Date(),
      conamret: req.conamret || '1',
      abscod: req.abscod || '',
      conadr: req.conadr || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.abscod) {
      Alert.alert('Erreur', 'Veuillez sélectionner un type de congé');
      return;
    }
    if (form.conret < form.condep) {
      Alert.alert('Erreur', 'La date de retour doit être après la date de départ');
      return;
    }
    if (!user?.soccod || !user?.uticod) return;

    try {
      if (editingRequest) {
        await apiService.updateLeaveRequest({
          soccod: user.soccod,
          empcod: user.uticod,
          concod: editingRequest.concod,
          condat: editingRequest.condat,
          condep: fmt(form.condep),
          conamdep: form.conamdep,
          conret: fmt(form.conret),
          conamret: form.conamret,
          abscod: form.abscod,
          conadr: form.conadr || null,
          connbjour: calcDays(),
          conjour: editingRequest.conjour,
        });
        Alert.alert('✅ Succès', 'Demande de congé modifiée');
      } else {
        await apiService.createLeaveRequest({
          soccod: user.soccod,
          empcod: user.uticod,
          concod: `DEM${Date.now()}`,
          condat: fmt(new Date()),
          condep: fmt(form.condep),
          conamdep: form.conamdep,
          conret: fmt(form.conret),
          conamret: form.conamret,
          abscod: form.abscod || null,
          conadr: form.conadr || null,
          connbjour: calcDays(),
        });
        Alert.alert('✅ Succès', 'Demande de congé envoyée');
      }
      setShowForm(false);
      setEditingRequest(null);
      setForm(defaultForm);
      loadRequests();
    } catch (error) { Alert.alert('Erreur', 'Impossible d\'envoyer la demande'); }
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingRequest(null);
    setForm(defaultForm);
  };

  // Status helpers - backend returns exact French values
  const isPending = (etat: string) => !etat || etat === 'En attente';
  const isAccepted = (etat: string) => etat === 'Accepté';
  const isRefused = (etat: string) => etat === 'Refusé';

  const getStatusColor = (etat: string) => {
    if (isPending(etat)) return COLORS.warning;
    if (isAccepted(etat)) return COLORS.success;
    if (isRefused(etat)) return COLORS.error;
    return COLORS.warning;
  };

  const getStatusLabel = (etat: string) => {
    if (isPending(etat)) return '⏳ En attente';
    if (isAccepted(etat)) return '✅ Accepté';
    if (isRefused(etat)) return '❌ Refusé';
    return '⏳ En attente';
  };

  const fmt = (d: Date) => d.toISOString().split('T')[0];

  const fmtDisplay = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return dateStr; }
  };

  const calcDays = () => {
    const diff = form.conret.getTime() - form.condep.getTime();
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1);
  };

  const getAbsLib = (abscod: string) => {
    const abs = absences.find((a: any) => a.abscod === abscod);
    return abs?.abslib || abscod || '-';
  };

  // Filtering
  const filteredRequests = requests.filter((r: any) => {
    if (statusFilter === 'pending') return isPending(r.etat);
    if (statusFilter === 'accepted') return isAccepted(r.etat);
    if (statusFilter === 'refused') return isRefused(r.etat);
    return true;
  });

  const pendingCount = requests.filter(r => isPending(r.etat)).length;
  const acceptedCount = requests.filter(r => isAccepted(r.etat)).length;
  const refusedCount = requests.filter(r => isRefused(r.etat)).length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Demandes de Congé</Text>
        <TouchableOpacity onPress={() => { setEditingRequest(null); setForm(defaultForm); setShowForm(!showForm); }}>
          <Text style={styles.addBtn}>{showForm ? '✕' : '+ Nouveau'}</Text>
        </TouchableOpacity>
      </View>

      {/* Period Filter */}
      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>📆 Filtrer par période</Text>
        <View style={styles.filterRow}>
          <TouchableOpacity style={styles.filterDateBtn} onPress={() => setShowFilterDebut(true)}>
            <Text style={styles.filterDateText}>Du: {fmtDisplay(fmt(filterDebut))}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterDateBtn} onPress={() => setShowFilterFin(true)}>
            <Text style={styles.filterDateText}>Au: {fmtDisplay(fmt(filterFin))}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Status Filter */}
      <View style={styles.statusFilterRow}>
        {([
          { key: 'all' as StatusFilter, label: `📋 Toutes (${requests.length})` },
          { key: 'pending' as StatusFilter, label: `⏳ Attente (${pendingCount})` },
          { key: 'accepted' as StatusFilter, label: `✅ Acceptées (${acceptedCount})` },
          { key: 'refused' as StatusFilter, label: `❌ Refusées (${refusedCount})` },
        ]).map((f) => (
          <TouchableOpacity key={f.key}
            style={[styles.filterBtn, statusFilter === f.key && styles.filterBtnActive]}
            onPress={() => setStatusFilter(f.key)}>
            <Text style={[styles.filterText, statusFilter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Form */}
      {showForm && (
        <ScrollView style={styles.formScroll} nestedScrollEnabled>
          <View style={styles.form}>
            <Text style={styles.formTitle}>{editingRequest ? '✏️ Modifier Demande' : '📝 Nouvelle Demande'}</Text>

            <Text style={styles.label}>Type de congé *</Text>
            <View style={styles.typeRow}>
              {absences.map((abs: any) => (
                <TouchableOpacity key={abs.abscod}
                  style={[styles.typeBtn, form.abscod === abs.abscod && styles.typeBtnActive]}
                  onPress={() => setForm({ ...form, abscod: abs.abscod })}>
                  <Text style={[styles.typeText, form.abscod === abs.abscod && styles.typeTextActive]}>
                    {abs.abslib || abs.abscod}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {absences.length === 0 && (
              <Text style={styles.noDataText}>Chargement des types...</Text>
            )}

            <Text style={styles.label}>Date départ</Text>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setShowStartPicker(true)}>
              <Text style={styles.dateBtnText}>📅 {fmtDisplay(fmt(form.condep))}</Text>
            </TouchableOpacity>
            <View style={styles.amRow}>
              <TouchableOpacity style={[styles.amBtn, form.conamdep === '1' && styles.amBtnActive]} onPress={() => setForm({ ...form, conamdep: '1' })}>
                <Text style={[styles.amText, form.conamdep === '1' && styles.amTextActive]}>Matin</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.amBtn, form.conamdep === '0' && styles.amBtnActive]} onPress={() => setForm({ ...form, conamdep: '0' })}>
                <Text style={[styles.amText, form.conamdep === '0' && styles.amTextActive]}>Après-midi</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Date retour</Text>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setShowEndPicker(true)}>
              <Text style={styles.dateBtnText}>📅 {fmtDisplay(fmt(form.conret))}</Text>
            </TouchableOpacity>
            <View style={styles.amRow}>
              <TouchableOpacity style={[styles.amBtn, form.conamret === '1' && styles.amBtnActive]} onPress={() => setForm({ ...form, conamret: '1' })}>
                <Text style={[styles.amText, form.conamret === '1' && styles.amTextActive]}>Matin</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.amBtn, form.conamret === '0' && styles.amBtnActive]} onPress={() => setForm({ ...form, conamret: '0' })}>
                <Text style={[styles.amText, form.conamret === '0' && styles.amTextActive]}>Après-midi</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>📆 Durée: {calcDays()} jour(s)</Text>
            </View>

            <Text style={styles.label}>Adresse pendant le congé</Text>
            <TextInput style={styles.input} value={form.conadr}
              onChangeText={(t) => setForm({ ...form, conadr: t })}
              placeholder="Adresse (optionnel)" placeholderTextColor={COLORS.textSecondary} />

            <View style={styles.formBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={cancelForm}>
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
                <Text style={styles.submitBtnText}>
                  {editingRequest ? '✏️ Modifier' : '📤 Envoyer'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}

      {/* Date Pickers */}
      <DatePickerModal visible={showStartPicker} value={form.condep}
        onChange={(d) => { setForm({ ...form, condep: d }); setShowStartPicker(false); }}
        onClose={() => setShowStartPicker(false)} title="Date de départ" />
      <DatePickerModal visible={showEndPicker} value={form.conret}
        onChange={(d) => { setForm({ ...form, conret: d }); setShowEndPicker(false); }}
        onClose={() => setShowEndPicker(false)} title="Date de retour" />
      <DatePickerModal visible={showFilterDebut} value={filterDebut}
        onChange={(d) => { setFilterDebut(d); setShowFilterDebut(false); }}
        onClose={() => setShowFilterDebut(false)} title="Début période" />
      <DatePickerModal visible={showFilterFin} value={filterFin}
        onChange={(d) => { setFilterFin(d); setShowFilterFin(false); }}
        onClose={() => setShowFilterFin(false)} title="Fin période" />

      {/* Request List */}
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16 }}>
        {filteredRequests.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏖️</Text>
            <Text style={styles.emptyText}>Aucune demande pour cette période</Text>
          </View>
        ) : (
          filteredRequests.map((req: any, i: number) => (
            <View key={req.concod || i} style={styles.requestCard}>
              <View style={styles.requestHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.requestTypeBadge}>{getAbsLib(req.abscod)}</Text>
                  <Text style={styles.requestDate}>
                    🛫 {fmtDisplay(req.condep)} → 🛬 {fmtDisplay(req.conret)}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(req.etat) }]}>
                  <Text style={styles.statusText}>{getStatusLabel(req.etat)}</Text>
                </View>
              </View>
              <View style={styles.requestDetails}>
                {req.connbjour ? <Text style={styles.detailText}>📅 {req.connbjour} jour(s)</Text> : null}
                <Text style={styles.detailText}>
                  Départ: {req.conamdep === '1' ? 'Matin' : req.conamdep === '0' ? 'Après-midi' : '-'}
                  {' | '}Retour: {req.conamret === '1' ? 'Matin' : req.conamret === '0' ? 'Après-midi' : '-'}
                </Text>
                {req.conadr ? <Text style={styles.detailText}>📍 {req.conadr}</Text> : null}
              </View>
              <View style={styles.requestFooter}>
                <Text style={styles.requestSysDate}>Créée le: {fmtDisplay(req.condat)}</Text>
                <View style={styles.actionRow}>
                  {isPending(req.etat) && req.concod && (
                    <>
                      <TouchableOpacity onPress={() => handleEdit(req)} style={styles.editBtn}>
                        <Text style={styles.editBtnText}>✏️ Modifier</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDelete(req)}>
                        <Text style={styles.deleteBtn}>🗑️ Supprimer</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', elevation: 2 },
  backBtn: { fontSize: 16, color: COLORS.primary, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, flex: 1, marginLeft: 12 },
  addBtn: { fontSize: 14, color: COLORS.primary, fontWeight: 'bold' },
  filterSection: { backgroundColor: '#fff', padding: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  filterLabel: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 6 },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterDateBtn: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 8, backgroundColor: '#fafafa', alignItems: 'center' },
  filterDateText: { fontSize: 12, color: COLORS.text, fontWeight: '500' },
  statusFilterRow: { flexDirection: 'row', padding: 12, gap: 6, backgroundColor: '#fff', flexWrap: 'wrap', paddingBottom: 8 },
  filterBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: COLORS.background },
  filterBtnActive: { backgroundColor: COLORS.primary },
  filterText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '500' },
  filterTextActive: { color: '#fff' },
  formScroll: { maxHeight: 400 },
  form: { backgroundColor: '#fff', margin: 12, borderRadius: 12, padding: 16, elevation: 3 },
  formTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.primary, marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 4, marginTop: 8 },
  noDataText: { fontSize: 12, color: COLORS.textSecondary, fontStyle: 'italic', marginTop: 4 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 10, fontSize: 14, backgroundColor: '#fafafa', color: COLORS.text },
  dateBtn: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 10, backgroundColor: '#fafafa', alignItems: 'center', marginTop: 2 },
  dateBtnText: { fontSize: 13, color: COLORS.text, fontWeight: '500' },
  amRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  amBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: COLORS.border },
  amBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  amText: { fontSize: 11, color: COLORS.textSecondary },
  amTextActive: { color: '#fff', fontWeight: '600' },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  typeBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: COLORS.border },
  typeBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeText: { fontSize: 11, color: COLORS.textSecondary },
  typeTextActive: { color: '#fff', fontWeight: '600' },
  durationBadge: { backgroundColor: '#e3f2fd', borderRadius: 8, padding: 8, alignItems: 'center', marginTop: 8 },
  durationText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  formBtnRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 14, alignItems: 'center' },
  cancelBtnText: { color: COLORS.textSecondary, fontWeight: '600', fontSize: 14 },
  submitBtn: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 8, padding: 14, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: COLORS.textSecondary },
  requestCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 1 },
  requestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  requestTypeBadge: { fontSize: 12, color: COLORS.primary, fontWeight: '600', marginBottom: 2 },
  requestDate: { fontSize: 13, fontWeight: '500', color: COLORS.text },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  requestDetails: { marginTop: 6 },
  detailText: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  requestFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f5f5f5' },
  requestSysDate: { fontSize: 10, color: COLORS.textSecondary },
  actionRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  editBtn: { paddingHorizontal: 6, paddingVertical: 2 },
  editBtnText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  deleteBtn: { fontSize: 12, color: COLORS.error, fontWeight: '600' },
});