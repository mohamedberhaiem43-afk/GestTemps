import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, RefreshControl, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import { COLORS } from '../config/env';
import DatePickerModal from '../components/DatePickerModal';

// Backend: NoteDeFrais model
// Etat values from backend: "Pending", "Approved", "Reimbursed", "Rejected"

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

const CATEGORIES = [
  'Transport', 'Repas', 'Hébergement', 'Matériel', 'Carburant',
  'Téléphone', 'Internet', 'Formation', 'Autre',
];

export default function ExpenseScreen({ navigation }: any) {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Form
  const defaultForm = { titre: '', categorie: '', montant: '', projet: '', dateDepense: new Date() };
  const [form, setForm] = useState(defaultForm);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => { loadExpenses(); }, [user]);

  const loadExpenses = async () => {
    if (!user?.soccod || !user?.uticod) return;
    try {
      const data = await apiService.getMyExpenses(user.soccod, user.uticod);
      setExpenses(Array.isArray(data) ? data : []);
    } catch (e) { console.log('Expenses load error:', e); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadExpenses(); setRefreshing(false); };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Erreur', 'Accès caméra requis'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!form.titre || !form.categorie || !form.montant) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
      return;
    }
    if (!user?.soccod || !user?.uticod) return;
    try {
      await apiService.createExpense({
        soccod: user.soccod,
        empcod: user.uticod,
        titre: form.titre,
        categorie: form.categorie,
        montant: parseFloat(form.montant),
        projet: form.projet || undefined,
        dateDepense: form.dateDepense.toISOString().split('T')[0],
      }, imageUri || undefined);
      Alert.alert('✅ Succès', 'Note de frais ajoutée');
      setShowForm(false);
      setForm(defaultForm);
      setImageUri(null);
      loadExpenses();
    } catch (e) { Alert.alert('Erreur', 'Impossible d\'ajouter la note de frais'); }
  };

  const handleDelete = (exp: any) => {
    Alert.alert('Supprimer', 'Supprimer cette note de frais ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive', onPress: async () => {
          try { await apiService.deleteExpense(exp.id); loadExpenses(); }
          catch { Alert.alert('Erreur', 'Impossible de supprimer'); }
        }
      },
    ]);
  };

  // Status mapping - backend uses English, display in French
  const getEtatLabel = (etat: string) => {
    switch (etat) {
      case 'Approved': return '✅ Approuvé';
      case 'Pending': return '⏳ En attente';
      case 'Rejected': return '❌ Rejeté';
      case 'Reimbursed': return '💰 Remboursé';
      default: return '⏳ En attente';
    }
  };

  const getEtatColor = (etat: string) => {
    switch (etat) {
      case 'Approved': return COLORS.success;
      case 'Pending': return COLORS.warning;
      case 'Rejected': return COLORS.error;
      case 'Reimbursed': return '#4caf50';
      default: return COLORS.warning;
    }
  };

  const isPending = (e: string) => !e || e === 'Pending';
  const isApproved = (e: string) => e === 'Approved';
  const isRejected = (e: string) => e === 'Rejected';

  const filtered = expenses.filter((exp: any) => {
    if (statusFilter === 'pending') return isPending(exp.etat);
    if (statusFilter === 'approved') return isApproved(exp.etat);
    if (statusFilter === 'rejected') return isRejected(exp.etat);
    return true;
  });

  const fmtDate = (d: string) => {
    if (!d) return '-';
    try { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
    catch { return d; }
  };

  const fmtMoney = (n: number) => n?.toLocaleString('fr-FR', { style: 'currency', currency: 'TND' }) || '-';

  const pendingC = expenses.filter(e => isPending(e.etat)).length;
  const approvedC = expenses.filter(e => isApproved(e.etat)).length;
  const rejectedC = expenses.filter(e => isRejected(e.etat)).length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.backBtn}>← Retour</Text></TouchableOpacity>
        <Text style={styles.title}>Notes de Frais</Text>
        <TouchableOpacity onPress={() => setShowForm(!showForm)}>
          <Text style={styles.addBtn}>{showForm ? '✕' : '+ Nouveau'}</Text>
        </TouchableOpacity>
      </View>

      {/* Status filter */}
      <View style={styles.statusFilterRow}>
        {([
          { key: 'all' as StatusFilter, label: `📋 Toutes (${expenses.length})` },
          { key: 'pending' as StatusFilter, label: `⏳ Attente (${pendingC})` },
          { key: 'approved' as StatusFilter, label: `✅ Approuvées (${approvedC})` },
          { key: 'rejected' as StatusFilter, label: `❌ Rejetées (${rejectedC})` },
        ]).map((f) => (
          <TouchableOpacity key={f.key}
            style={[styles.filterBtn, statusFilter === f.key && styles.filterBtnActive]}
            onPress={() => setStatusFilter(f.key)}>
            <Text style={[styles.filterText, statusFilter === f.key && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Form */}
      {showForm && (
        <ScrollView style={styles.formScroll} nestedScrollEnabled>
          <View style={styles.form}>
            <Text style={styles.formTitle}>💰 Nouvelle Note de Frais</Text>

            <Text style={styles.label}>Titre *</Text>
            <TextInput style={styles.input} value={form.titre}
              onChangeText={(t: string) => setForm({ ...form, titre: t })} placeholder="Titre de la dépense" />

            <Text style={styles.label}>Catégorie *</Text>
            <View style={styles.catRow}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity key={cat}
                  style={[styles.catBtn, form.categorie === cat && styles.catBtnActive]}
                  onPress={() => setForm({ ...form, categorie: cat })}>
                  <Text style={[styles.catText, form.categorie === cat && styles.catTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Montant (TND) *</Text>
            <TextInput style={styles.input} value={form.montant} keyboardType="decimal-pad"
              onChangeText={(t: string) => setForm({ ...form, montant: t })} placeholder="0.00" />

            <Text style={styles.label}>Projet</Text>
            <TextInput style={styles.input} value={form.projet}
              onChangeText={(t: string) => setForm({ ...form, projet: t })} placeholder="Nom du projet (optionnel)" />

            <Text style={styles.label}>Date dépense</Text>
            <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>
              <Text style={styles.dateBtnText}>📅 {fmtDate(form.dateDepense.toISOString().split('T')[0])}</Text>
            </TouchableOpacity>

            {/* Image picker */}
            <Text style={styles.label}>📷 Justificatif</Text>
            <View style={styles.imageRow}>
              <TouchableOpacity style={styles.imgBtn} onPress={pickImage}>
                <Text style={styles.imgBtnText}>🖼️ Galerie</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.imgBtn} onPress={takePhoto}>
                <Text style={styles.imgBtnText}>📸 Caméra</Text>
              </TouchableOpacity>
            </View>
            {imageUri && (
              <View style={styles.imagePreview}>
                <Image source={{ uri: imageUri }} style={styles.previewImg} />
                <TouchableOpacity onPress={() => setImageUri(null)} style={styles.removeImg}>
                  <Text style={styles.removeImgText}>✕</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.formBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowForm(false); setForm(defaultForm); setImageUri(null); }}>
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
                <Text style={styles.submitBtnText}>📤 Envoyer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}

      <DatePickerModal visible={showDatePicker} value={form.dateDepense}
        onChange={(d) => { setForm({ ...form, dateDepense: d }); setShowDatePicker(false); }}
        onClose={() => setShowDatePicker(false)} title="Date de dépense" />

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 12 }}>
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💰</Text>
            <Text style={styles.emptyText}>Aucune note de frais</Text>
          </View>
        ) : (
          filtered.map((exp: any) => (
            <View key={exp.id} style={styles.expCard}>
              <View style={styles.expHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.expTitle}>{exp.titre}</Text>
                  <Text style={styles.expCat}>{exp.categorie}{exp.projet ? ` • ${exp.projet}` : ''}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getEtatColor(exp.etat) }]}>
                  <Text style={styles.statusText}>{getEtatLabel(exp.etat)}</Text>
                </View>
              </View>
              <View style={styles.expDetails}>
                <Text style={styles.expAmount}>{fmtMoney(exp.montant)}</Text>
                <Text style={styles.expDate}>📅 {fmtDate(exp.dateDepense)}</Text>
              </View>
              <View style={styles.expFooter}>
                <Text style={styles.expCreated}>Créée: {fmtDate(exp.createdAt)}</Text>
                {(isPending(exp.etat)) && (
                  <TouchableOpacity onPress={() => handleDelete(exp)}>
                    <Text style={styles.deleteBtn}>🗑️ Supprimer</Text>
                  </TouchableOpacity>
                )}
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
  statusFilterRow: { flexDirection: 'row', padding: 12, gap: 6, backgroundColor: '#fff', flexWrap: 'wrap' },
  filterBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: COLORS.background },
  filterBtnActive: { backgroundColor: COLORS.primary },
  filterText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '500' },
  filterTextActive: { color: '#fff' },
  formScroll: { maxHeight: 450 },
  form: { backgroundColor: '#fff', margin: 12, borderRadius: 12, padding: 16, elevation: 3 },
  formTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.primary, marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 4, marginTop: 8 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 10, fontSize: 14, backgroundColor: '#fafafa', color: COLORS.text },
  dateBtn: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 10, backgroundColor: '#fafafa', alignItems: 'center' },
  dateBtnText: { fontSize: 13, color: COLORS.text, fontWeight: '500' },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  catBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: COLORS.border },
  catBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catText: { fontSize: 11, color: COLORS.textSecondary },
  catTextActive: { color: '#fff', fontWeight: '600' },
  imageRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  imgBtn: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 10, alignItems: 'center', backgroundColor: '#fafafa' },
  imgBtnText: { fontSize: 13, color: COLORS.primary },
  imagePreview: { position: 'relative', marginTop: 8, alignItems: 'center' },
  previewImg: { width: 120, height: 120, borderRadius: 8, resizeMode: 'cover' },
  removeImg: { position: 'absolute', top: -6, right: '30%', backgroundColor: COLORS.error, width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  removeImgText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  formBtnRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 14, alignItems: 'center' },
  cancelBtnText: { color: COLORS.textSecondary, fontWeight: '600' },
  submitBtn: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 8, padding: 14, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: COLORS.textSecondary },
  expCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, elevation: 1 },
  expHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  expTitle: { fontSize: 15, fontWeight: 'bold', color: COLORS.text },
  expCat: { fontSize: 12, color: COLORS.primary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  expDetails: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f5f5f5' },
  expAmount: { fontSize: 16, fontWeight: 'bold', color: COLORS.success },
  expDate: { fontSize: 12, color: COLORS.textSecondary },
  expFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  expCreated: { fontSize: 10, color: COLORS.textSecondary },
  deleteBtn: { fontSize: 12, color: COLORS.error, fontWeight: '600' },
});