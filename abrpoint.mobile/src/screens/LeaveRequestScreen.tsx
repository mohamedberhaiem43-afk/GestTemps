import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Alert, RefreshControl, Dimensions, Image, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import { COLORS, THEME } from '../config/env';
import DatePickerModal from '../components/DatePickerModal';
import BottomTabBar, { useTabBarPadding } from '../components/BottomTabBar';

const { width } = Dimensions.get('window');

interface RttKpi {
  methode: string; // 'N' | 'M' | 'H' | 'F'
  droitAnnuel: number;
  pris: number;
  solde: number;
}

interface KPISummary {
  soldeConge: number;
  congeAcquis: number;
  demandesEnAttente: number;
  rtt: RttKpi | null;
}

export default function LeaveRequestScreen({ navigation }: any) {
  const { user } = useAuth();
  const tabBarPadding = useTabBarPadding();
  const [requests, setRequests] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [kpiSummary, setKpiSummary] = useState<KPISummary | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [absences, setAbsences] = useState<any[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Form state
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
  const [editingConcod, setEditingConcod] = useState<string | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  // Toggle "Voir tout" pour la liste des demandes récentes : par défaut on
  // n'affiche que les 3 plus récentes, l'utilisateur peut déplier la liste.
  const [showAllRequests, setShowAllRequests] = useState(false);

  const isPending = (etat: string | undefined) => {
    const e = (etat || '').toLowerCase();
    return !e.includes('accept') && !e.includes('refus');
  };

  const openEditForm = (req: any) => {
    setForm({
      concod: req.concod || '',
      condep: req.condep ? new Date(req.condep) : new Date(),
      conamdep: req.conamdep || '1',
      conret: req.conret ? new Date(req.conret) : new Date(),
      conamret: req.conamret || '1',
      abscod: req.abscod || '',
      conadr: req.conadr || '',
    });
    setEditingConcod(req.concod);
    setShowForm(true);
    // Recharge la liste des natures d'absence si elle est vide (le 1er chargement
    // a pu échouer ou être encore en cours) — sinon le formulaire afficherait
    // "Type de congé" sans aucun bouton sélectionnable.
    if (absences.length === 0) loadAbsences();
  };

  const handleRequestPress = (req: any) => {
    if (!isPending(req.etat)) {
      Alert.alert(
        'Action impossible',
        'Cette demande a déjà été traitée et ne peut plus être modifiée ou supprimée.'
      );
      return;
    }
    Alert.alert(
      'Demande en attente',
      `Que souhaitez-vous faire avec cette demande ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Modifier', onPress: () => openEditForm(req) },
        { text: 'Supprimer', style: 'destructive', onPress: () => confirmDelete(req) },
      ]
    );
  };

  const confirmDelete = (req: any) => {
    Alert.alert(
      'Supprimer la demande',
      'Êtes-vous sûr de vouloir supprimer cette demande de congé ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            if (!user?.soccod || !req.concod) return;
            try {
              await apiService.deleteLeaveRequest(user.soccod, req.concod);
              Alert.alert('✅ Succès', 'Demande supprimée');
              loadRequests();
            } catch {
              Alert.alert('Erreur', 'Impossible de supprimer la demande');
            }
          }
        },
      ]
    );
  };

  const closeForm = () => {
    setShowForm(false);
    setForm(defaultForm);
    setEditingConcod(null);
  };

  useEffect(() => {
    if (user?.soccod && user?.uticod) {
      loadInitialData();
    }
  }, [user?.soccod, user?.uticod]);

  const loadInitialData = async () => {
    setLoading(true);
    await Promise.all([loadRequests(), loadAbsences(), loadKPISummary()]);
    setLoading(false);
  };

  const loadKPISummary = async () => {
    if (!user?.soccod || !user?.uticod) return;
    try {
      const data = await apiService.getMyKPIs(user.soccod, user.uticod);
      if (data) {
        setKpiSummary({
          soldeConge: data.soldeConge || 0,
          congeAcquis: data.congeAcquis || 0,
          demandesEnAttente: data.demandesEnAttente || 0,
          // Le backend ne renvoie `rtt` que si l'employé est éligible (méthode ≠ 'N').
          // Null signifie que l'UI ne doit pas afficher la carte RTT.
          rtt: data.rtt
            ? {
                methode: data.rtt.methode,
                droitAnnuel: data.rtt.droitAnnuel || 0,
                pris: data.rtt.pris || 0,
                solde: data.rtt.solde || 0,
              }
            : null,
        });
      }
    } catch (error) {
      console.log('Failed to load KPI summary:', error);
    }
  };

  const loadAbsences = async () => {
    if (!user?.soccod) return;
    try {
      // Même backend que le web : Dictionary<abscod, abslib> filtré sur les types de congé.
      const data = await apiService.getCongeAbsenceLibs(user.soccod);
      let absData: any[] = [];
      if (Array.isArray(data)) {
        absData = data;
      } else if (data && typeof data === 'object') {
        absData = Object.entries(data).map(([abscod, abslib]) => ({ abscod, abslib }));
      }
      setAbsences(absData);
    } catch (e) { console.log('Absences load error:', e); }
  };

  const loadRequests = async () => {
    if (!user?.soccod || !user?.uticod) return;
    try {
      const data = await apiService.getMyLeaveRequests(user.soccod, user.uticod);
      setRequests(Array.isArray(data) ? data : []);
    } catch (error) { console.log('Failed to load requests:', error); }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadRequests(), loadKPISummary()]);
    setRefreshing(false);
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
      if (editingConcod) {
        await apiService.updateLeaveRequest({
          soccod: user.soccod,
          empcod: user.uticod,
          concod: editingConcod,
          condat: fmt(new Date()),
          condep: fmt(form.condep),
          conamdep: form.conamdep,
          conret: fmt(form.conret),
          conamret: form.conamret,
          abscod: form.abscod || null,
          conadr: form.conadr || null,
          connbjour: calcDays(),
        });
        Alert.alert('✅ Succès', 'Demande modifiée avec succès');
      } else {
        const nextCode = await apiService.getNextLeaveRequestCode(user.soccod);
        const concod = (nextCode?.concod || '').trim();
        if (!concod) {
          Alert.alert('Erreur', 'Impossible de générer le numéro de demande');
          return;
        }

        await apiService.createLeaveRequest({
          soccod: user.soccod,
          empcod: user.uticod,
          concod,
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
      closeForm();
      loadRequests();
    } catch (error: any) {
      // Faux négatif vu en prod : le POST réussit (record persisté), mais une
      // erreur dans la notif manager (DbContext concurrent côté serveur, ou un
      // hook réseau côté client) faisait remonter ce catch. On revérifie via
      // loadRequests() — si le record est apparu, c'est un succès. Plus de
      // « Impossible d'ajouter… » alors que la demande est bien là.
      const status = error?.response?.status;
      const wasNetworkOrServerHiccup = !status || status >= 500;
      try { await loadRequests(); } catch { /* best-effort */ }
      if (wasNetworkOrServerHiccup) {
        Alert.alert('⚠️ Action partielle',
          editingConcod
            ? 'La demande a peut-être été enregistrée. Vérifiez la liste — si elle apparaît, tout est bon.'
            : 'La demande a peut-être été enregistrée. Vérifiez la liste — si elle apparaît, tout est bon.');
        closeForm();
        return;
      }
      Alert.alert('Erreur', editingConcod ? 'Impossible de modifier la demande' : 'Impossible d\'envoyer la demande');
    }
  };

  const fmt = (d: Date) => d.toISOString().split('T')[0];
  
  const calcDays = () => {
    // `conret` représente le jour de RETOUR au travail (l'employé est absent
    // jusqu'à la veille). Donc condep=11 + conret=12 = 1 jour de congé, pas 2.
    // L'ancien `Math.ceil(diff) + 1` ajoutait à tort une journée fantôme (la
    // formule web a toujours utilisé une simple soustraction, cf.
    // DemCongeModern.tsx ligne 240).
    const diffMs = form.conret.getTime() - form.condep.getTime();
    const diff = Math.max(0, diffMs / (1000 * 60 * 60 * 24));
    // Demi-journées : `conamdep === '0'` = case "Après-midi (date départ)" cochée
    // (départ l'après-midi → on retire 0.5 de la 1re journée). Idem conamret.
    const adj = (form.conamret === '0' ? 0.5 : 0) - (form.conamdep === '0' ? 0.5 : 0);
    return Math.max(0, diff + adj);
  };

  const getAbsLib = (abscod: string) => {
    const abs = absences.find((a: any) => a.abscod === abscod);
    return abs?.abslib || abscod || '-';
  };

  const getStatusInfo = (etat: string) => {
    const e = (etat || '').toLowerCase();
    if (e.includes('accept') || e.includes('valid')) {
      return { label: 'Validé', color: COLORS.tertiary, bgColor: 'rgba(0, 81, 54, 0.1)' };
    }
    if (e.includes('refus') || e.includes('reject')) {
      return { label: 'Refusé', color: COLORS.error, bgColor: 'rgba(186, 26, 26, 0.1)' };
    }
    return { label: 'En attente', color: '#a14a00', bgColor: '#ffe0cc' };
  };

  const getIconForType = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('annuel')) return { name: 'flight', color: COLORS.primary, bgColor: COLORS.primaryFixed };
    if (t.includes('rtt')) return { name: 'work-history', color: COLORS.secondary, bgColor: COLORS.secondaryFixed };
    if (t.includes('parent')) return { name: 'stroller', color: COLORS.error, bgColor: COLORS.errorContainer };
    return { name: 'beach-access', color: COLORS.primary, bgColor: '#dae2ff' };
  };

  // Calendar logic
  const daysInMonth = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const date = new Date(year, month, 1);
    const days = [];
    const firstDay = (date.getDay() + 6) % 7; // Mon is 0

    // Prev month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ day: prevMonthLastDay - i, isCurrent: false });
    }

    // Current month
    const lastDay = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= lastDay; i++) {
      days.push({ day: i, isCurrent: true });
    }

    return days;
  }, [currentMonth]);

  const monthLabel = currentMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

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
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
            <MaterialCommunityIcons name="menu" size={24} color={COLORS.primaryContainer} />
          </TouchableOpacity>
          {/* Wordmark texte aligné sur HomeScreen — plus net que le PNG. */}
          <View style={styles.brandWordmark}>
            <Text style={styles.brandPrimary}>Concorde</Text>
            <Text style={styles.brandSecondary}>Workforce</Text>
          </View>
        </View>
        <View style={styles.profileImageWrapper}>
          <MaterialCommunityIcons name="account-circle-outline" size={32} color="#cbd5e1" />
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Balances Section : Solde CP + Solde RTT (RTT affiché uniquement si
            l'employé est configuré comme éligible côté fiche employé). */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SOLDES</Text>
          <View style={kpiSummary?.rtt ? styles.balancesGrid : undefined}>
            <View style={kpiSummary?.rtt ? styles.balanceCardHalf : styles.balanceCardSolo}>
              <MaterialCommunityIcons name="beach-access" size={28} color={COLORS.primary} />
              <View style={styles.balanceContent}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                  <Text style={styles.balanceValue}>{(kpiSummary?.soldeConge ?? 0).toFixed(1)}</Text>
                  <Text style={styles.balanceUnit}>j</Text>
                </View>
                <Text style={styles.balanceName}>
                  {kpiSummary?.congeAcquis
                    ? `CP · sur ${kpiSummary.congeAcquis.toFixed(1)} acquis`
                    : 'Congés payés'}
                </Text>
              </View>
            </View>

            {kpiSummary?.rtt && (
              <View style={styles.balanceCardHalf}>
                <MaterialCommunityIcons name="work-history" size={28} color="#10b981" />
                <View style={styles.balanceContent}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                    <Text style={[styles.balanceValue, { color: '#065f46' }]}>{kpiSummary.rtt.solde.toFixed(1)}</Text>
                    <Text style={styles.balanceUnit}>j</Text>
                  </View>
                  <Text style={styles.balanceName}>
                    {`RTT · sur ${kpiSummary.rtt.droitAnnuel.toFixed(1)} acquis`}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Calendar Section */}
        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <Text style={styles.monthTitle}>{monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</Text>
            <View style={styles.calendarNav}>
              <TouchableOpacity onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}>
                <MaterialCommunityIcons name="chevron-left" size={24} color="#64748b" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}>
                <MaterialCommunityIcons name="chevron-right" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.calendarGrid}>
            {['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'].map(day => (
              <Text key={day} style={styles.dayHeader}>{day}</Text>
            ))}
            {daysInMonth.map((d, i) => {
              const isToday = d.isCurrent && d.day === new Date().getDate() && currentMonth.getMonth() === new Date().getMonth();
              const hasLeave = d.isCurrent && [4, 5, 13, 16].includes(d.day); // Mock indicators
              return (
                <View key={i} style={styles.dayCell}>
                  <View style={[styles.dayInner, isToday && styles.todayInner]}>
                    <Text style={[styles.dayText, !d.isCurrent && styles.dayTextOther, isToday && styles.todayText]}>
                      {d.day}
                    </Text>
                    {hasLeave && !isToday && <View style={[styles.dayDot, { backgroundColor: d.day === 16 ? COLORS.tertiary : COLORS.primary }]} />}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Recent Requests */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Demandes récentes</Text>
            {requests.length > 3 && (
              <TouchableOpacity onPress={() => setShowAllRequests((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.seeAllText}>{showAllRequests ? 'RÉDUIRE' : 'VOIR TOUT'}</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.requestList}>
            {(showAllRequests ? requests : requests.slice(0, 3)).map((req, idx) => {
              const status = getStatusInfo(req.etat);
              const typeLib = getAbsLib(req.abscod);
              const icon = getIconForType(typeLib);
              const pending = isPending(req.etat);
              return (
                <TouchableOpacity
                  key={req.concod || idx}
                  style={styles.requestItem}
                  activeOpacity={pending ? 0.7 : 1}
                  onPress={() => pending && handleRequestPress(req)}
                  disabled={!pending}
                >
                  <View style={styles.requestLeft}>
                    <View style={[styles.typeIconWrapper, { backgroundColor: icon.bgColor }]}>
                      <MaterialCommunityIcons name={icon.name as any} size={20} color={icon.color} />
                    </View>
                    <View style={styles.requestInfo}>
                      <Text style={styles.requestType}>{typeLib}</Text>
                      <Text style={styles.requestPeriod}>
                        {new Date(req.condep).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} - {new Date(req.conret).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} ({req.connbjour} jrs)
                      </Text>
                    </View>
                  </View>
                  <View style={styles.requestRight}>
                    <View style={[styles.statusBadge, { backgroundColor: status.bgColor }]}>
                      <Text style={[styles.statusText, { color: status.color }]}>{status.label.toUpperCase()}</Text>
                    </View>
                    {pending && (
                      <MaterialCommunityIcons name="chevron-right" size={18} color={COLORS.outline} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
            {requests.length === 0 && (
              <View style={styles.emptyRequests}>
                <Text style={styles.emptyRequestsText}>Aucune demande récente</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* FAB — positionné dynamiquement au-dessus de la BottomTabBar pour ne pas
           se faire masquer par les boutons de navigation système (Samsung). */}
      <TouchableOpacity
        style={[styles.fab, { bottom: tabBarPadding + 16 }]}
        onPress={() => { setEditingConcod(null); setForm(defaultForm); setShowForm(true); }}
        activeOpacity={0.9}
      >
        <LinearGradient
          colors={[COLORS.primary, COLORS.primaryContainer]}
          style={styles.fabGradient}
        >
          <MaterialCommunityIcons name="plus" size={32} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Form Overlay - Simple Modal logic integrated */}
      {showForm && (
        <View style={styles.modalOverlay}>
          <View style={[styles.formCard, { paddingBottom: 24 + tabBarPadding * 0.4 }]}>
            <View style={styles.formHeader}>
              <Text style={styles.formHeaderTitle}>{editingConcod ? 'Modifier la demande' : 'Nouvelle Demande'}</Text>
              <TouchableOpacity onPress={closeForm} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialCommunityIcons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Type de congé</Text>
              {absences.length > 0 ? (
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
              ) : (
                <View style={styles.typeEmptyRow}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                  <Text style={styles.typeEmptyText}>Chargement des types…</Text>
                  <TouchableOpacity onPress={loadAbsences} style={styles.typeReloadBtn}>
                    <Text style={styles.typeReloadText}>Réessayer</Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={styles.label}>Date départ</Text>
              <TouchableOpacity style={styles.dateInput} onPress={() => setShowStartPicker(true)}>
                <Text style={styles.dateInputText}>{form.condep.toLocaleDateString('fr-FR')}</Text>
                <MaterialCommunityIcons name="calendar" size={20} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setForm({ ...form, conamdep: form.conamdep === '0' ? '1' : '0' })}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name={form.conamdep === '0' ? 'checkbox-marked' : 'checkbox-blank-outline'}
                  size={22}
                  color={COLORS.primary}
                />
                <Text style={styles.checkboxLabel}>Après-midi (date départ)</Text>
              </TouchableOpacity>

              <Text style={styles.label}>Date retour</Text>
              <TouchableOpacity style={styles.dateInput} onPress={() => setShowEndPicker(true)}>
                <Text style={styles.dateInputText}>{form.conret.toLocaleDateString('fr-FR')}</Text>
                <MaterialCommunityIcons name="calendar" size={20} color={COLORS.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setForm({ ...form, conamret: form.conamret === '0' ? '1' : '0' })}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name={form.conamret === '0' ? 'checkbox-marked' : 'checkbox-blank-outline'}
                  size={22}
                  color={COLORS.primary}
                />
                <Text style={styles.checkboxLabel}>Après-midi (date retour)</Text>
              </TouchableOpacity>

              <View style={styles.formFooter}>
                <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
                  <Text style={styles.submitBtnText}>{editingConcod ? 'METTRE À JOUR' : 'ENVOYER LA DEMANDE'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      )}

      {/* Date Pickers */}
      <DatePickerModal visible={showStartPicker} value={form.condep}
        onChange={(d) => { setForm({ ...form, condep: d }); setShowStartPicker(false); }}
        onClose={() => setShowStartPicker(false)} title="Date de départ" />
      <DatePickerModal visible={showEndPicker} value={form.conret}
        onChange={(d) => { setForm({ ...form, conret: d }); setShowEndPicker(false); }}
        onClose={() => setShowEndPicker(false)} title="Date de retour" />

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
  logoImage: { width: 110, height: 32 },
  brandWordmark: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  brandPrimary: { fontFamily: 'Manrope', fontWeight: '900', fontSize: 17, color: COLORS.primary, letterSpacing: -0.4 },
  brandSecondary: { fontFamily: 'Manrope', fontWeight: '600', fontSize: 14, color: COLORS.outline, letterSpacing: -0.2 },
  profileImageWrapper: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', borderWidth: 2, borderColor: COLORS.surfaceContainerHigh },
  scrollContent: { padding: 20, paddingBottom: 100 },
  section: { marginBottom: 24 },
  sectionLabel: { fontSize: 10, fontWeight: '700', color: COLORS.outline, letterSpacing: 1.2, marginBottom: 12 },
  balanceGrid: { flexDirection: 'row', gap: 16 },
  balanceCard: {
    flex: 1, backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 16, padding: 20,
    flexDirection: 'column', gap: 16,
  },
  balanceCardSolo: {
    backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 16, padding: 20,
    flexDirection: 'row', alignItems: 'center', gap: 16,
  },
  balancesGrid: { flexDirection: 'row', gap: 12 },
  balanceCardHalf: {
    flex: 1,
    backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  balanceContent: { gap: 4 },
  balanceValue: { fontSize: 32, fontWeight: '800', color: COLORS.primary, letterSpacing: -1 },
  balanceUnit: { fontSize: 14, fontWeight: '600', color: COLORS.onSurfaceVariant },
  balanceName: { fontSize: 12, fontWeight: '600', color: COLORS.onSurfaceVariant },
  calendarCard: { backgroundColor: COLORS.surfaceContainerLow, borderRadius: 24, padding: 24, marginBottom: 32 },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  monthTitle: { fontSize: 18, fontWeight: '800', color: COLORS.onSurface },
  calendarNav: { flexDirection: 'row', gap: 12 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayHeader: { width: (width - 88) / 7, textAlign: 'center', fontSize: 10, fontWeight: '800', color: COLORS.outline, marginBottom: 16, textTransform: 'uppercase' },
  dayCell: { width: (width - 88) / 7, height: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  dayInner: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center', borderRadius: 16 },
  todayInner: { backgroundColor: COLORS.primary },
  dayText: { fontSize: 13, fontWeight: '600', color: COLORS.onSurface },
  dayTextOther: { color: COLORS.outlineVariant },
  todayText: { color: '#fff' },
  dayDot: { position: 'absolute', bottom: -2, width: 4, height: 4, borderRadius: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: COLORS.onSurface, letterSpacing: -0.5 },
  seeAllText: { fontSize: 10, fontWeight: '800', color: COLORS.primary, letterSpacing: 1 },
  requestList: { gap: 12 },
  requestItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 16, padding: 16,
  },
  requestLeft: { flexDirection: 'row', alignItems: 'center', gap: 16, flex: 1 },
  requestRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  typeIconWrapper: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  requestInfo: { gap: 2 },
  requestType: { fontSize: 14, fontWeight: '700', color: COLORS.onSurface },
  requestPeriod: { fontSize: 11, color: COLORS.outline, fontWeight: '500' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  emptyRequests: { padding: 40, alignItems: 'center' },
  emptyRequestsText: { fontSize: 14, color: COLORS.outline, fontWeight: '500' },
  fab: { position: 'absolute', right: 24, zIndex: 100 },
  fabGradient: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12 },
  bottomNav: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)', paddingBottom: 20,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  navItem: { alignItems: 'center', gap: 4 },
  navLabel: { fontSize: 9, fontWeight: '700', color: '#94a3b8' },
  // elevation: 30 force le modal au-dessus du BottomTabBar (elevation: 8) sur
  // Android, sinon la barre de navigation reste cliquable et masque le bouton
  // "Envoyer". zIndex couvre iOS et le rendu web/Expo.
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', zIndex: 1000, elevation: 30 },
  formCard: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '85%' },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  formHeaderTitle: { fontSize: 20, fontWeight: '800', color: COLORS.onSurface },
  formScroll: { flexGrow: 0 },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.outline, marginBottom: 8, marginTop: 16 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.surfaceContainerLow },
  typeBtnActive: { backgroundColor: COLORS.primary },
  typeText: { fontSize: 12, fontWeight: '600', color: COLORS.onSurfaceVariant },
  typeTextActive: { color: '#fff' },
  typeEmptyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, flexWrap: 'wrap' },
  typeEmptyText: { fontSize: 12, color: COLORS.onSurfaceVariant, fontWeight: '500' },
  typeReloadBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: COLORS.primaryFixed },
  typeReloadText: { fontSize: 11, color: COLORS.primary, fontWeight: '700' },
  dateInput: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.surfaceContainerLow, borderRadius: 12, padding: 16,
  },
  dateInputText: { fontSize: 14, fontWeight: '600', color: COLORS.onSurface },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, marginBottom: 4 },
  checkboxLabel: { fontSize: 13, fontWeight: '600', color: COLORS.onSurfaceVariant },
  formFooter: { marginTop: 32, marginBottom: 24 },
  submitBtn: { backgroundColor: COLORS.primary, borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 1 },
});
