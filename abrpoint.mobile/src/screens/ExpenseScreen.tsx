import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, RefreshControl, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import { COLORS } from '../config/env';
import DatePickerModal from '../components/DatePickerModal';
import BottomTabBar, { useTabBarPadding } from '../components/BottomTabBar';

// Catégories alignées sur la web (CATEGORY_KEYS de RemboursementModern).
const CATEGORIES = [
  { id: 'Transport', label: 'Transport', icon: 'car-outline' },
  { id: 'Repas',     label: 'Repas',     icon: 'silverware-fork-knife' },
  { id: 'Equipement', label: 'Équipement', icon: 'tools' },
  { id: 'Logement',  label: 'Logement',  icon: 'bed-outline' },
  { id: 'Autre',     label: 'Autre',     icon: 'tag-outline' },
];

// Liste partagée mobile/web. ISO 4217 + symbole pour l'affichage.
const CURRENCIES: { code: string; symbol: string; label: string }[] = [
  { code: 'EUR', symbol: '€',    label: 'Euro' },
  { code: 'USD', symbol: '$',    label: 'Dollar US' },
  { code: 'GBP', symbol: '£',    label: 'Livre sterling' },
  { code: 'CHF', symbol: 'CHF',  label: 'Franc suisse' },
  { code: 'TND', symbol: 'DT',   label: 'Dinar tunisien' },
  { code: 'MAD', symbol: 'MAD',  label: 'Dirham marocain' },
  { code: 'DZD', symbol: 'DA',   label: 'Dinar algérien' },
  { code: 'CAD', symbol: 'CA$',  label: 'Dollar canadien' },
  { code: 'XOF', symbol: 'FCFA', label: 'Franc CFA (BCEAO)' },
  { code: 'AED', symbol: 'AED',  label: 'Dirham émirati' },
];

const currencySymbol = (code?: string | null): string =>
  CURRENCIES.find(c => c.code === code)?.symbol || code || '€';

// Mission attachée à une note de frais (cf. MissionsController.cs). On affiche
// l'objet + les bornes dates pour que le collaborateur identifie la mission
// concernée même quand plusieurs missions se chevauchent.
interface Mission {
  id: number;
  misobj: string;
  misdest?: string | null;
  misdatedeb: string;
  misdatefin: string;
  misetat?: string | null;
}

const fmtMissionDates = (deb?: string, fin?: string) => {
  try {
    const d1 = deb ? new Date(deb).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '—';
    const d2 = fin ? new Date(fin).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';
    return `${d1} → ${d2}`;
  } catch { return ''; }
};

const STATUS_FILTERS = [
  { key: 'all',        label: 'Tous' },
  { key: 'pending',    label: 'En attente' },
  { key: 'approved',   label: 'Validés' },
  { key: 'reimbursed', label: 'Remboursés' },
  { key: 'rejected',   label: 'Refusés' },
] as const;

type StatusFilter = typeof STATUS_FILTERS[number]['key'];

const fmtMoney = (n: number) =>
  (n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: any) => {
  try { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
};

export default function ExpenseScreen({ navigation }: any) {
  const { user } = useAuth();
  const tabBarPadding = useTabBarPadding();
  // Coussin bas du modal — voir LeaveRequestScreen pour le contexte.
  const insets = useSafeAreaInsets();
  const formCardPaddingBottom = Math.max(24, insets.bottom + 12);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Form (modal)
  // categorieDetail : précision libre saisie quand l'utilisateur choisit "Autre".
  // À l'envoi, on encode dans la colonne `categorie` ("Autre: <détail>") pour
  // que la comptabilité voie la nature exacte sans changer le schéma BD.
  // missionId : optionnel — permet de rattacher la dépense à une mission existante
  // (ordre de mission), aligné sur le comportement web (RemboursementModern.tsx).
  const defaultForm = { titre: '', categorie: 'Repas', categorieDetail: '', montant: '', devise: 'EUR', projet: '', dateDepense: new Date(), missionId: null as number | null };
  const [form, setForm] = useState(defaultForm);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [showMissionPicker, setShowMissionPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Missions du collaborateur courant. Chargées au mount + à chaque refresh —
  // le serveur renvoie déjà la liste triée par date décroissante côté
  // MissionsController.GetByEmp. Une mission Cancelled est filtrée côté UI
  // (l'utilisateur ne devrait pas pouvoir rattacher une note à une mission annulée).
  const [missions, setMissions] = useState<Mission[]>([]);

  useEffect(() => { loadExpenses(); loadMissions(); }, [user]);

  const loadExpenses = async () => {
    if (!user?.soccod || !user?.uticod) return;
    try {
      const data = await apiService.getMyExpenses(user.soccod, user.uticod);
      setExpenses(Array.isArray(data) ? data : []);
    } catch (e) { console.log('Expenses load error:', e); }
    finally { setLoading(false); }
  };

  const loadMissions = async () => {
    if (!user?.soccod || !user?.uticod) return;
    try {
      const data = await apiService.getMissionsByEmp(user.soccod, user.uticod);
      const list: Mission[] = Array.isArray(data) ? data : [];
      setMissions(list.filter(m => (m.misetat || '').toLowerCase() !== 'cancelled'));
    } catch (e) { console.log('Missions load error:', e); }
  };

  const selectedMission = useMemo(
    () => missions.find(m => m.id === form.missionId) || null,
    [missions, form.missionId]
  );

  const onRefresh = async () => { setRefreshing(true); await loadExpenses(); setRefreshing(false); };

  const handleCapture = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Erreur', 'Accès caméra requis'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true });
    if (!result.canceled && result.assets[0]) setImageUri(result.assets[0].uri);
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ImagePicker.MediaTypeOptions.Images });
    if (!result.canceled && result.assets[0]) setImageUri(result.assets[0].uri);
  };

  const openNewForm = () => {
    setForm(defaultForm);
    setImageUri(null);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.titre.trim()) { Alert.alert('Erreur', 'Veuillez saisir un motif'); return; }
    if (!form.montant || isNaN(parseFloat(form.montant.replace(',', '.')))) {
      Alert.alert('Erreur', 'Veuillez saisir un montant valide');
      return;
    }
    if (form.categorie === 'Autre' && !form.categorieDetail.trim()) {
      Alert.alert('Erreur', 'Précisez la nature de la dépense (catégorie "Autre")');
      return;
    }
    if (!user?.soccod || !user?.uticod) return;

    // Pour "Autre" on encode la précision dans la valeur de catégorie
    // ("Autre: <détail>") afin que la comptabilité dispose de l'info.
    // La colonne BD est StringLength(50) → on tronque à 43 caractères de
    // précision (50 - "Autre: ".length).
    const categorieFinale = form.categorie === 'Autre' && form.categorieDetail.trim()
      ? `Autre: ${form.categorieDetail.trim()}`.slice(0, 50)
      : form.categorie;

    setSubmitting(true);
    try {
      await apiService.createExpense({
        soccod: user.soccod,
        empcod: user.uticod,
        titre: form.titre,
        categorie: categorieFinale,
        montant: parseFloat(form.montant.replace(',', '.')),
        dateDepense: form.dateDepense.toISOString().split('T')[0],
        projet: form.projet || undefined,
        devise: form.devise || 'EUR',
        missionId: form.missionId ?? undefined,
      }, imageUri || undefined);
      Alert.alert('Succès', 'Note de frais soumise');
      setShowForm(false);
      setForm(defaultForm);
      setImageUri(null);
      loadExpenses();
    } catch (e) {
      Alert.alert('Erreur', "Impossible d'ajouter la note de frais");
    } finally {
      setSubmitting(false);
    }
  };

  // Stats — alignées sur les rmb-stat-card du web (Pending, Reimbursed, YTD).
  const stats = useMemo(() => {
    const yearStart = new Date(new Date().getFullYear(), 0, 1);
    let pendingTotal = 0, reimbursedTotal = 0, ytdTotal = 0;
    for (const e of expenses) {
      const m = Number(e.montant) || 0;
      const etat = (e.etat || '').toLowerCase();
      const d = e.dateDepense ? new Date(e.dateDepense) : null;
      if (etat === 'pending') pendingTotal += m;
      if (etat === 'reimbursed') reimbursedTotal += m;
      if (d && d >= yearStart) ytdTotal += m;
    }
    return { pendingTotal, reimbursedTotal, ytdTotal };
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses.filter((e) => {
      const st = (e.etat || '').toLowerCase();
      const statusOk = statusFilter === 'all' || st === statusFilter;
      const searchOk = !q
        || (e.titre || '').toLowerCase().includes(q)
        || (e.categorie || '').toLowerCase().includes(q)
        || (e.projet || '').toLowerCase().includes(q);
      return statusOk && searchOk;
    });
  }, [expenses, search, statusFilter]);

  const getStatusInfo = (etat: string) => {
    const k = (etat || '').toLowerCase();
    if (k === 'reimbursed') return { label: 'REMBOURSÉ', color: '#0040a1', bg: '#dbeafe' };
    if (k === 'approved')   return { label: 'VALIDÉ',    color: '#059669', bg: '#dcfce7' };
    if (k === 'rejected')   return { label: 'REFUSÉ',    color: '#dc2626', bg: '#fee2e2' };
    return                       { label: 'EN ATTENTE', color: '#b45309', bg: '#fef3c7' };
  };

  const getCategoryIcon = (cat: string): any => {
    const c = (cat || '').toLowerCase();
    if (c.includes('transport') || c.includes('auto')) return 'car-outline';
    if (c.includes('repas')) return 'silverware-fork-knife';
    if (c.includes('equip')) return 'tools';
    if (c.includes('logem') || c.includes('hot')) return 'bed-outline';
    return 'tag-outline';
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
            <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.logoText}>Notes de frais</Text>
        </View>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Notifications')}>
          <MaterialCommunityIcons name="bell-outline" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {/* En-tête avec bouton d'ajout — équivalent rmb-header / rmb-new-btn */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.subHeader}>Gestion financière</Text>
            <Text style={styles.mainTitle}>Mes notes de frais</Text>
          </View>
          <TouchableOpacity style={styles.newBtn} onPress={openNewForm}>
            <MaterialCommunityIcons name="plus" size={18} color="#fff" />
            <Text style={styles.newBtnText}>Nouveau</Text>
          </TouchableOpacity>
        </View>

        {/* 3 stats cards — équivalent rmb-stats-grid */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderLeftColor: '#f59e0b' }]}>
            <Text style={styles.statLabel}>EN ATTENTE</Text>
            <View style={styles.statValueRow}>
              <Text style={[styles.statValue, { color: '#b45309' }]}>{fmtMoney(stats.pendingTotal)}</Text>
              <Text style={styles.statCurrency}>€</Text>
            </View>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#0040a1' }]}>
            <Text style={styles.statLabel}>REMBOURSÉ</Text>
            <View style={styles.statValueRow}>
              <Text style={[styles.statValue, { color: '#0040a1' }]}>{fmtMoney(stats.reimbursedTotal)}</Text>
              <Text style={styles.statCurrency}>€</Text>
            </View>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#059669' }]}>
            <Text style={styles.statLabel}>TOTAL ANNÉE</Text>
            <View style={styles.statValueRow}>
              <Text style={[styles.statValue, { color: '#059669' }]}>{fmtMoney(stats.ytdTotal)}</Text>
              <Text style={styles.statCurrency}>€</Text>
            </View>
          </View>
        </View>

        {/* Liste + filtres — équivalent rmb-table-card */}
        <View style={styles.tableCard}>
          <View style={styles.tableToolbar}>
            <Text style={styles.tableTitle}>Mes dépenses</Text>
            <Text style={styles.tableCount}>{filteredExpenses.length}</Text>
          </View>

          <View style={styles.searchBox}>
            <MaterialCommunityIcons name="magnify" size={18} color={COLORS.outline} />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher par motif, catégorie, projet…"
              placeholderTextColor={COLORS.outline}
              value={search}
              onChangeText={setSearch}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {STATUS_FILTERS.map((c) => (
              <TouchableOpacity
                key={c.key}
                style={[styles.chip, statusFilter === c.key && styles.chipActive]}
                onPress={() => setStatusFilter(c.key)}
              >
                <Text style={[styles.chipText, statusFilter === c.key && styles.chipTextActive]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.expenseList}>
            {filteredExpenses.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="file-document-outline" size={48} color={COLORS.outlineVariant} />
                <Text style={styles.emptyText}>Aucune dépense enregistrée</Text>
              </View>
            ) : (
              filteredExpenses.map((exp, idx) => {
                const status = getStatusInfo(exp.etat);
                const iconName = getCategoryIcon(exp.categorie);
                return (
                  <View key={exp.id || idx} style={styles.expenseItem}>
                    <View style={styles.expenseLeft}>
                      <View style={styles.expenseIconWrapper}>
                        <MaterialCommunityIcons name={iconName} size={22} color={COLORS.primary} />
                      </View>
                      <View style={styles.expenseInfo}>
                        <Text style={styles.expenseTitre} numberOfLines={1}>{exp.titre || '—'}</Text>
                        {!!exp.projet && <Text style={styles.expenseSub} numberOfLines={1}>{exp.projet}</Text>}
                        <Text style={styles.expenseMeta}>
                          {fmtDate(exp.dateDepense)} • {(exp.categorie || '').toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.expenseRight}>
                      <Text style={styles.expenseAmount}>{fmtMoney(exp.montant)} {currencySymbol(exp.devise)}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                        <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                        <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      {/* ── Form Overlay (style LeaveRequestScreen) ── */}
      {showForm && (
        <View style={styles.modalOverlay}>
          <View style={[styles.formCard, { paddingBottom: formCardPaddingBottom }]}>
            <View style={styles.formHeader}>
              <Text style={styles.formHeaderTitle}>Nouvelle note de frais</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Catégorie</Text>
              <View style={styles.typeRow}>
                {CATEGORIES.map((c) => {
                  const active = form.categorie === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.typeBtn, active && styles.typeBtnActive]}
                      onPress={() => setForm({ ...form, categorie: c.id })}
                    >
                      <Text style={[styles.typeText, active && styles.typeTextActive]}>{c.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {form.categorie === 'Autre' && (
                <>
                  <Text style={styles.label}>Précisez la nature *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Ex. Cadeau client, abonnement logiciel…"
                    placeholderTextColor={COLORS.outline}
                    maxLength={43}
                    value={form.categorieDetail}
                    onChangeText={(t) => setForm({ ...form, categorieDetail: t })}
                  />
                </>
              )}

              <Text style={styles.label}>Motif</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Ex. Déjeuner client"
                placeholderTextColor={COLORS.outline}
                value={form.titre}
                onChangeText={(t) => setForm({ ...form, titre: t })}
              />

              <Text style={styles.label}>Date de la dépense</Text>
              <TouchableOpacity style={styles.dateInput} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.dateInputText}>
                  {form.dateDepense.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </Text>
                <MaterialCommunityIcons name="calendar" size={20} color={COLORS.primary} />
              </TouchableOpacity>

              <Text style={styles.label}>Montant</Text>
              <View style={styles.amountRow}>
                <TextInput
                  style={[styles.textInput, { flex: 1 }]}
                  placeholder="0.00"
                  placeholderTextColor={COLORS.outline}
                  keyboardType="decimal-pad"
                  value={form.montant}
                  onChangeText={(t) => setForm({ ...form, montant: t })}
                />
                <TouchableOpacity style={styles.currencyBtn} onPress={() => setShowCurrencyPicker(true)}>
                  <Text style={styles.currencyBtnText}>{form.devise}</Text>
                  <MaterialCommunityIcons name="chevron-down" size={16} color={COLORS.outline} />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Mission rattachée (optionnel)</Text>
              <TouchableOpacity
                style={styles.missionInput}
                onPress={() => setShowMissionPicker(true)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  {selectedMission ? (
                    <>
                      <Text style={styles.missionInputText} numberOfLines={1}>
                        {selectedMission.misobj}
                      </Text>
                      <Text style={styles.missionInputMeta} numberOfLines={1}>
                        {fmtMissionDates(selectedMission.misdatedeb, selectedMission.misdatefin)}
                        {selectedMission.misdest ? ` · ${selectedMission.misdest}` : ''}
                      </Text>
                    </>
                  ) : (
                    <Text style={[styles.missionInputText, { color: COLORS.outline, fontWeight: '500' }]}>
                      {missions.length === 0 ? 'Aucune mission disponible' : 'Choisir une mission…'}
                    </Text>
                  )}
                </View>
                {selectedMission ? (
                  <TouchableOpacity
                    onPress={(e) => { e.stopPropagation(); setForm({ ...form, missionId: null }); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <MaterialCommunityIcons name="close-circle" size={18} color={COLORS.outline} />
                  </TouchableOpacity>
                ) : (
                  <MaterialCommunityIcons name="chevron-down" size={20} color={COLORS.outline} />
                )}
              </TouchableOpacity>

              <Text style={styles.label}>Projet (optionnel)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Ex. Mission Acme - Q2"
                placeholderTextColor={COLORS.outline}
                value={form.projet}
                onChangeText={(t) => setForm({ ...form, projet: t })}
              />

              <Text style={styles.label}>Justificatif</Text>
              <View style={styles.uploadArea}>
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={styles.uploadedPreview} />
                ) : (
                  <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                    <MaterialCommunityIcons name="cloud-upload-outline" size={32} color={COLORS.primary} />
                    <Text style={styles.uploadText}>Joindre un reçu (image ou PDF)</Text>
                  </View>
                )}
                <View style={styles.uploadActions}>
                  <TouchableOpacity style={styles.uploadBtn} onPress={handleCapture}>
                    <MaterialCommunityIcons name="camera-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.uploadBtnText}>Photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.uploadBtn} onPress={handlePickImage}>
                    <MaterialCommunityIcons name="image-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.uploadBtnText}>Galerie</Text>
                  </TouchableOpacity>
                  {imageUri && (
                    <TouchableOpacity style={[styles.uploadBtn, { backgroundColor: '#fee2e2' }]} onPress={() => setImageUri(null)}>
                      <MaterialCommunityIcons name="trash-can-outline" size={16} color="#dc2626" />
                      <Text style={[styles.uploadBtnText, { color: '#dc2626' }]}>Retirer</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.formFooter}>
                <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitting}>
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitBtnText}>SOUMETTRE LA DÉPENSE</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      )}

      <DatePickerModal
        visible={showDatePicker}
        value={form.dateDepense}
        onChange={(d) => { setForm({ ...form, dateDepense: d }); setShowDatePicker(false); }}
        onClose={() => setShowDatePicker(false)}
        title="Date de dépense"
      />

      {/* Picker devise — bottom sheet ISO 4217 */}
      {showCurrencyPicker && (
        <View style={styles.modalOverlay}>
          <View style={[styles.formCard, { maxHeight: '60%', paddingBottom: formCardPaddingBottom }]}>
            <View style={styles.formHeader}>
              <Text style={styles.formHeaderTitle}>Devise</Text>
              <TouchableOpacity onPress={() => setShowCurrencyPicker(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialCommunityIcons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {CURRENCIES.map(c => (
                <TouchableOpacity
                  key={c.code}
                  style={[styles.currencyItem, form.devise === c.code && styles.currencyItemActive]}
                  onPress={() => { setForm({ ...form, devise: c.code }); setShowCurrencyPicker(false); }}
                >
                  <Text style={styles.currencyItemSymbol}>{c.symbol}</Text>
                  <Text style={styles.currencyItemLabel}>{c.code} — {c.label}</Text>
                  {form.devise === c.code && (
                    <MaterialCommunityIcons name="check-circle" size={20} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      )}

      {/* Picker mission — bottom sheet scrollable. Liste les missions du
          collaborateur courant (filtrées Cancelled), avec objet + bornes + destination.
          Tap → sélection ; bouton X dans le champ → désélection. */}
      {showMissionPicker && (
        <View style={styles.modalOverlay}>
          <View style={[styles.formCard, { maxHeight: '70%', paddingBottom: formCardPaddingBottom }]}>
            <View style={styles.formHeader}>
              <Text style={styles.formHeaderTitle}>Choisir une mission</Text>
              <TouchableOpacity onPress={() => setShowMissionPicker(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialCommunityIcons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            {missions.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 36, gap: 8 }}>
                <MaterialCommunityIcons name="briefcase-off-outline" size={42} color={COLORS.outlineVariant} />
                <Text style={{ fontSize: 13, color: COLORS.outline, fontWeight: '600' }}>
                  Aucune mission active à rattacher.
                </Text>
                <Text style={{ fontSize: 11, color: COLORS.outline, textAlign: 'center', paddingHorizontal: 20 }}>
                  Créez une mission depuis l'écran « Missions » avant d'y attacher des notes de frais.
                </Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <TouchableOpacity
                  style={[styles.missionItem, form.missionId == null && styles.missionItemActive]}
                  onPress={() => { setForm({ ...form, missionId: null }); setShowMissionPicker(false); }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.missionItemTitle}>Aucune mission</Text>
                    <Text style={styles.missionItemMeta}>Note de frais hors ordre de mission</Text>
                  </View>
                  {form.missionId == null && (
                    <MaterialCommunityIcons name="check-circle" size={20} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
                {missions.map((m) => {
                  const active = form.missionId === m.id;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.missionItem, active && styles.missionItemActive]}
                      onPress={() => { setForm({ ...form, missionId: m.id }); setShowMissionPicker(false); }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.missionItemTitle} numberOfLines={1}>{m.misobj}</Text>
                        <Text style={styles.missionItemMeta} numberOfLines={1}>
                          {fmtMissionDates(m.misdatedeb, m.misdatefin)}
                          {m.misdest ? ` · ${m.misdest}` : ''}
                        </Text>
                      </View>
                      {active && (
                        <MaterialCommunityIcons name="check-circle" size={20} color={COLORS.primary} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      )}

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
  iconButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  logoText: { fontFamily: 'Manrope', fontWeight: '800', fontSize: 18, color: COLORS.primary, letterSpacing: -0.3 },

  scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 110 },

  headerRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 },
  subHeader: { fontSize: 10, fontWeight: '700', color: COLORS.secondary, letterSpacing: 1.2, textTransform: 'uppercase' },
  mainTitle: { fontSize: 24, fontWeight: '800', color: COLORS.onSurface, letterSpacing: -0.4, marginTop: 2 },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primary, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 3,
  },
  newBtnText: { color: '#fff', fontWeight: '800', fontSize: 12, letterSpacing: 0.3 },

  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  statCard: {
    flex: 1, backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 12,
    padding: 12, borderLeftWidth: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  statLabel: { fontSize: 9, fontWeight: '800', color: COLORS.outline, letterSpacing: 0.6 },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 6, gap: 2 },
  statValue: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
  statCurrency: { fontSize: 11, fontWeight: '700', color: COLORS.outline },

  tableCard: { backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 16, padding: 14, marginBottom: 12 },
  tableToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  tableTitle: { fontSize: 14, fontWeight: '800', color: COLORS.onSurface, letterSpacing: 0.3 },
  tableCount: { fontSize: 11, fontWeight: '700', color: COLORS.outline, backgroundColor: COLORS.surfaceContainerLow, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: 10,
    backgroundColor: COLORS.surfaceContainerLow,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 13, color: COLORS.onSurface, padding: 0 },

  chipsRow: { gap: 8, paddingRight: 8, paddingBottom: 12 },
  chip: {
    borderWidth: 1, borderColor: COLORS.outlineVariant, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 6, backgroundColor: COLORS.surfaceContainerLow,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 11, fontWeight: '700', color: COLORS.onSurfaceVariant },
  chipTextActive: { color: '#fff' },

  expenseList: { gap: 10 },
  expenseItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceContainerLow, borderRadius: 12, padding: 12,
  },
  expenseLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  expenseIconWrapper: { width: 40, height: 40, borderRadius: 10, backgroundColor: COLORS.primaryFixed, justifyContent: 'center', alignItems: 'center' },
  expenseInfo: { flex: 1, gap: 2 },
  expenseTitre: { fontSize: 13, fontWeight: '700', color: COLORS.onSurface },
  expenseSub:   { fontSize: 11, color: COLORS.primary, fontWeight: '600' },
  expenseMeta:  { fontSize: 10, fontWeight: '700', color: COLORS.outline, letterSpacing: 0.4, marginTop: 2 },
  expenseRight: { alignItems: 'flex-end', gap: 6 },
  expenseAmount: { fontSize: 14, fontWeight: '800', color: COLORS.onSurface },

  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusDot:   { width: 6, height: 6, borderRadius: 3 },
  statusText:  { fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },

  emptyState: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyText:  { fontSize: 13, color: COLORS.outline, fontWeight: '600' },

  // ── Form Overlay (aligné sur LeaveRequestScreen) ──
  // elevation: 30 pour passer au-dessus du BottomTabBar (elevation: 8)
  // sur Android — sinon les boutons de la barre persistante restent
  // tappables et masquent le bouton "Envoyer" du modal.
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    zIndex: 1000,
    elevation: 30,
  },
  formCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    maxHeight: '90%',
  },
  formHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 24,
  },
  formHeaderTitle: { fontSize: 20, fontWeight: '800', color: COLORS.onSurface },
  formScroll: { flexGrow: 0 },

  label: {
    fontSize: 12, fontWeight: '700', color: COLORS.outline,
    marginBottom: 8, marginTop: 16, letterSpacing: 0.5,
  },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.surfaceContainerLow,
  },
  typeBtnActive: { backgroundColor: COLORS.primary },
  typeText: { fontSize: 12, fontWeight: '600', color: COLORS.onSurfaceVariant },
  typeTextActive: { color: '#fff' },

  textInput: {
    backgroundColor: COLORS.surfaceContainerLow, borderRadius: 12,
    padding: 16, fontSize: 14, color: COLORS.onSurface,
  },
  amountRow: { flexDirection: 'row', gap: 8 },
  currencyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.surfaceContainerLow, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    minWidth: 88, justifyContent: 'space-between',
  },
  currencyBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.onSurface },
  currencyItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: COLORS.outlineVariant,
  },
  currencyItemActive: { backgroundColor: COLORS.primaryFixed },
  currencyItemSymbol: { fontSize: 18, fontWeight: '800', color: COLORS.primary, minWidth: 50 },
  currencyItemLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: COLORS.onSurface },
  dateInput: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.surfaceContainerLow, borderRadius: 12, padding: 16,
  },
  dateInputText: { fontSize: 14, fontWeight: '600', color: COLORS.onSurface },

  missionInput: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.surfaceContainerLow, borderRadius: 12, padding: 16,
  },
  missionInputText: { fontSize: 14, fontWeight: '700', color: COLORS.onSurface },
  missionInputMeta: { fontSize: 11, fontWeight: '600', color: COLORS.outline, marginTop: 2 },
  missionItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: COLORS.outlineVariant,
  },
  missionItemActive: { backgroundColor: COLORS.primaryFixed },
  missionItemTitle: { fontSize: 13, fontWeight: '700', color: COLORS.onSurface },
  missionItemMeta: { fontSize: 11, fontWeight: '600', color: COLORS.outline, marginTop: 2 },

  uploadArea: {
    backgroundColor: COLORS.surfaceContainerLow, borderRadius: 12,
    borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.outlineVariant,
    padding: 12, gap: 10,
  },
  uploadText: { fontSize: 12, color: COLORS.outline, fontWeight: '600', marginTop: 6 },
  uploadedPreview: { width: '100%', height: 140, borderRadius: 8, resizeMode: 'cover' },
  uploadActions: { flexDirection: 'row', gap: 8, justifyContent: 'center', flexWrap: 'wrap' },
  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primaryFixed, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
  },
  uploadBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },

  formFooter: { marginTop: 32, marginBottom: 24 },
  submitBtn: {
    backgroundColor: COLORS.primary, borderRadius: 16,
    paddingVertical: 18, alignItems: 'center',
  },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 1 },
});
