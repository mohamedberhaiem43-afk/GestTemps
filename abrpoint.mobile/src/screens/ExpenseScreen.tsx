import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, RefreshControl, Image, Dimensions, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import { COLORS, THEME } from '../config/env';
import DatePickerModal from '../components/DatePickerModal';

const { width } = Dimensions.get('window');

const CATEGORIES = [
  { id: 'Auto', label: 'Auto', icon: 'car-outline' },
  { id: 'Repas', label: 'Repas', icon: 'silverware-fork-knife' },
  { id: 'Hôtel', label: 'Nuit', icon: 'bed-outline' },
];

export default function ExpenseScreen({ navigation }: any) {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Form
  const defaultForm = { titre: '', categorie: 'Repas', montant: '', dateDepense: new Date() };
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
    finally { setLoading(false); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadExpenses(); setRefreshing(false); };

  const handleCapture = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Erreur', 'Accès caméra requis'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!form.montant) {
      Alert.alert('Erreur', 'Veuillez saisir un montant');
      return;
    }
    if (!user?.soccod || !user?.uticod) return;
    try {
      await apiService.createExpense({
        soccod: user.soccod,
        empcod: user.uticod,
        titre: form.titre || `${form.categorie} - ${form.dateDepense.toLocaleDateString('fr-FR')}`,
        categorie: form.categorie,
        montant: parseFloat(form.montant.replace(',', '.')),
        dateDepense: form.dateDepense.toISOString().split('T')[0],
      }, imageUri || undefined);
      Alert.alert('✅ Succès', 'Note de frais soumise');
      setForm(defaultForm);
      setImageUri(null);
      loadExpenses();
    } catch (e) { Alert.alert('Erreur', 'Impossible d\'ajouter la note de frais'); }
  };

  const totalMonthly = useMemo(() => {
    const now = new Date();
    return expenses
      .filter(e => {
        const d = new Date(e.dateDepense);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, e) => sum + (e.montant || 0), 0);
  }, [expenses]);

  const getStatusInfo = (etat: string) => {
    switch (etat) {
      case 'Reimbursed': return { label: 'Remboursé', color: COLORS.secondary, bgColor: COLORS.secondaryContainer };
      case 'Approved': return { label: 'Validé', color: COLORS.onTertiaryFixedVariant, bgColor: COLORS.tertiaryFixed };
      case 'Rejected': return { label: 'Refusé', color: COLORS.error, bgColor: COLORS.errorContainer };
      default: return { label: 'En attente', color: '#b45309', bgColor: '#fff4e5' };
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
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.profileWrapper}>
            <Image
              source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDnSDj32L-3hiURsWE-8dyndY5Vob55JI-ysQwhQeIM_tnHeShD8oab7NBYYJClipiU2o4lTm37B4aY2eG1CjuEiqTjfIXmR8lgj97UKSzTQlxsDdJKKYw5CsiN4zG9VmNDCNrnHtQQujcwSL_F-_8Hgls94iuGqodihiE16lsbE3cnwi3yj98C7n0kBmiAJilI0NXBZ4XrkYFezVCqQEg2kbsUz2j561Xh9D2gYW9mtxXsB_I7C35f0FLt6zgteyoGQcGLuZrKx-U' }}
              style={styles.profileImage}
            />
          </TouchableOpacity>
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
        <View style={styles.headerTitleContainer}>
          <Text style={styles.subHeader}>Gestion financière</Text>
          <Text style={styles.mainTitle}>Notes de Frais</Text>
        </View>

        {/* Bento Stats & Actions */}
        <View style={styles.bentoContainer}>
          {/* Monthly Distribution */}
          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <View>
                <Text style={styles.chartLabel}>TOTAL MENSUEL</Text>
                <Text style={styles.chartValue}>{totalMonthly.toLocaleString('fr-FR')} €</Text>
              </View>
              <View style={styles.chartTrend}>
                <Text style={styles.trendValue}>+12%</Text>
                <Text style={styles.trendLabel}>vs mois dernier</Text>
              </View>
            </View>
            
            <View style={styles.chartBars}>
              <View style={[styles.bar, { height: '40%', backgroundColor: COLORS.surfaceContainerLow }]} />
              <View style={[styles.bar, { height: '60%', backgroundColor: COLORS.surfaceContainerLow }]} />
              <View style={[styles.bar, { height: '85%', backgroundColor: COLORS.primaryContainer }]} />
              <View style={[styles.bar, { height: '45%', backgroundColor: COLORS.surfaceContainerLow }]} />
              <View style={[styles.bar, { height: '30%', backgroundColor: COLORS.surfaceContainerLow }]} />
              <View style={[styles.bar, { height: '100%', backgroundColor: COLORS.primary }]} />
            </View>
            
            <View style={styles.chartLegend}>
              <Text style={styles.legendText}>TRANSPORT</Text>
              <Text style={styles.legendText}>REPAS</Text>
              <Text style={styles.legendText}>LOGEMENT</Text>
            </View>
          </View>

          {/* New Expense Action */}
          <LinearGradient
            colors={[COLORS.primary, COLORS.primaryContainer]}
            style={styles.actionCard}
          >
            <View style={styles.actionHeader}>
              <Text style={styles.actionTitle}>Nouveau Frais</Text>
              <Text style={styles.actionSubTitle}>Capturez vos reçus instantanément</Text>
            </View>
            
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryStack}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryBtn, form.categorie === cat.id && styles.categoryBtnActive]}
                  onPress={() => setForm({ ...form, categorie: cat.id })}
                >
                  <MaterialCommunityIcons name={cat.icon as any} size={24} color="#fff" />
                  <Text style={styles.categoryLabel}>{cat.label.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </LinearGradient>
        </View>

        {/* Submission Form */}
        <View style={styles.formContainer}>
          <Text style={styles.sectionHeader}>DÉTAILS DE LA DÉPENSE</Text>
          
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>MONTANT & DEVISE</Text>
            <View style={styles.amountRow}>
              <TextInput
                style={styles.amountInput}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={COLORS.primary}
                value={form.montant}
                onChangeText={(t) => setForm({ ...form, montant: t })}
              />
              <View style={styles.currencyBadge}>
                <Text style={styles.currencyText}>EUR</Text>
              </View>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>JUSTIFICATIF</Text>
            <TouchableOpacity style={styles.uploadArea} onPress={handleCapture}>
              <View style={styles.uploadIconWrapper}>
                <MaterialCommunityIcons name="camera-plus" size={24} color={COLORS.primary} />
              </View>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.uploadedPreview} />
              ) : (
                <Text style={styles.uploadText}>Prendre une photo ou {"\n"}choisir un reçu</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
            <MaterialCommunityIcons name="send" size={20} color="#fff" />
            <Text style={styles.submitButtonText}>SOUMETTRE LA NOTE</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Expenses */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Frais Récents</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>VOIR TOUT</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.expenseList}>
            {expenses.map((exp, idx) => {
              const status = getStatusInfo(exp.etat);
              const iconName = exp.categorie === 'Auto' ? 'car-outline' : exp.categorie === 'Hôtel' ? 'bed-outline' : 'silverware-fork-knife';
              return (
                <View key={exp.id || idx} style={styles.expenseItem}>
                  <View style={styles.expenseLeft}>
                    <View style={styles.expenseIconWrapper}>
                      <MaterialCommunityIcons name={iconName as any} size={24} color={COLORS.secondary} />
                    </View>
                    <View style={styles.expenseInfo}>
                      <Text style={styles.expenseTitre}>{exp.titre}</Text>
                      <Text style={styles.expenseMeta}>
                        {new Date(exp.dateDepense).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} • {exp.categorie.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.expenseRight}>
                    <Text style={styles.expenseAmount}>{exp.montant?.toFixed(2)} €</Text>
                    <View style={[styles.statusBadge, { backgroundColor: status.bgColor }]}>
                      <Text style={[styles.statusText, { color: status.color }]}>{status.label.toUpperCase()}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
            {expenses.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Aucune dépense enregistrée</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

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
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Authorization')}>
          <MaterialCommunityIcons name="exit-to-app" size={24} color="#94a3b8" />
          <Text style={styles.navLabel}>SORTIES</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('PresenceHistory')}>
          <MaterialCommunityIcons name="history" size={24} color="#94a3b8" />
          <Text style={styles.navLabel}>POINTAGE</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => {}}>
          <MaterialCommunityIcons name="receipt-long" size={24} color={COLORS.primary} />
          <Text style={[styles.navLabel, { color: COLORS.primary }]}>FRAIS</Text>
        </TouchableOpacity>
      </View>

      <DatePickerModal visible={showDatePicker} value={form.dateDepense}
        onChange={(d) => { setForm({ ...form, dateDepense: d }); setShowDatePicker(false); }}
        onClose={() => setShowDatePicker(false)} title="Date de dépense" />
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
  profileWrapper: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
  profileImage: { width: '100%', height: '100%' },
  logoText: { fontFamily: 'Manrope', fontWeight: '800', fontSize: 18, color: COLORS.primary, letterSpacing: -0.5 },
  iconButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 },
  headerTitleContainer: { marginBottom: 32 },
  subHeader: { fontSize: 10, fontWeight: '700', color: COLORS.secondary, letterSpacing: 1.2, textTransform: 'uppercase' },
  mainTitle: { fontSize: 32, fontWeight: '800', color: COLORS.onSurface, letterSpacing: -0.5 },
  bentoContainer: { gap: 16, marginBottom: 32 },
  chartCard: { backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 16, padding: 24, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 16 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 },
  chartLabel: { fontSize: 10, fontWeight: '700', color: COLORS.secondary, letterSpacing: 1 },
  chartValue: { fontSize: 28, fontWeight: '800', color: COLORS.primary, letterSpacing: -1 },
  chartTrend: { alignItems: 'flex-end' },
  trendValue: { fontSize: 14, fontWeight: '800', color: COLORS.tertiary },
  trendLabel: { fontSize: 9, color: COLORS.outline, fontWeight: '600' },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 80, marginBottom: 12 },
  bar: { flex: 1, borderRadius: 4 },
  chartLegend: { flexDirection: 'row', justifyContent: 'space-between' },
  legendText: { fontSize: 9, fontWeight: '800', color: COLORS.outline, letterSpacing: 0.5 },
  actionCard: { borderRadius: 16, padding: 24, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 4 },
  actionHeader: { marginBottom: 20 },
  actionTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  actionSubTitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  categoryStack: { gap: 12 },
  categoryBtn: { width: 80, height: 80, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, justifyContent: 'center', alignItems: 'center', gap: 8 },
  categoryBtnActive: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(255,255,255,0.3)' },
  categoryLabel: { fontSize: 9, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
  formContainer: { backgroundColor: COLORS.surfaceContainerLow, borderRadius: 24, padding: 24, marginBottom: 32 },
  sectionHeader: { fontSize: 12, fontWeight: '800', color: COLORS.onSurface, letterSpacing: 1.5, marginBottom: 24 },
  fieldGroup: { marginBottom: 24 },
  fieldLabel: { fontSize: 10, fontWeight: '800', color: COLORS.secondary, letterSpacing: 1, marginBottom: 12 },
  amountRow: { flexDirection: 'row', gap: 12 },
  amountInput: { flex: 1, backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 12, padding: 16, fontSize: 24, fontWeight: '800', color: COLORS.primary },
  currencyBadge: { width: 80, backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  currencyText: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  uploadArea: { borderWidth: 2, borderStyle: 'dashed', borderColor: COLORS.outlineVariant, borderRadius: 16, padding: 32, alignItems: 'center', gap: 12, backgroundColor: COLORS.surfaceContainerLowest },
  uploadIconWrapper: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.primaryFixed, justifyContent: 'center', alignItems: 'center' },
  uploadText: { fontSize: 11, fontWeight: '700', color: COLORS.outline, textAlign: 'center', lineHeight: 16 },
  uploadedPreview: { width: '100%', height: 100, borderRadius: 8, resizeMode: 'cover' },
  submitButton: { backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 18, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 4 },
  submitButtonText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  section: { marginBottom: 24 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: COLORS.onSurface, letterSpacing: 1.5, textTransform: 'uppercase' },
  seeAllText: { fontSize: 10, fontWeight: '800', color: COLORS.primary },
  expenseList: { gap: 12 },
  expenseItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 16, padding: 16, elevation: 1 },
  expenseLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  expenseIconWrapper: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.surfaceContainerLow, justifyContent: 'center', alignItems: 'center' },
  expenseInfo: { gap: 4 },
  expenseTitre: { fontSize: 15, fontWeight: '700', color: COLORS.onSurface },
  expenseMeta: { fontSize: 10, fontWeight: '700', color: COLORS.outline, letterSpacing: 0.5 },
  expenseRight: { alignItems: 'flex-end', gap: 6 },
  expenseAmount: { fontSize: 14, fontWeight: '800', color: COLORS.onSurface },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  statusText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.2 },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, color: COLORS.outline, fontWeight: '600' },
  bottomNav: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)', paddingBottom: 20,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  navItem: { alignItems: 'center', gap: 4 },
  navLabel: { fontSize: 9, fontWeight: '700', color: '#94a3b8' },
});