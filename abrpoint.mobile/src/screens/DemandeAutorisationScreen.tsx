import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../i18n';
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

const STATUS_LABEL_KEYS: Record<string, string> = {
  'Approuvé': 'common.approved',
  'Refusé': 'common.refused',
  'En attente': 'common.pending',
};

const fmtDate = (d: string | null | undefined, locale: string = 'fr-FR') => {
  if (!d) return '-';
  try { return new Date(d).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
};

const fmtTime = (d: string | null | undefined, locale: string = 'fr-FR') => {
  if (!d) return '';
  try { return new Date(d).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }); }
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
  const { t, lang } = useI18n();
  const locale = lang === 'en' ? 'en-GB' : 'fr-FR';
  const tabBarPadding = useTabBarPadding();
  // Coussin bas du modal — voir LeaveRequestScreen pour le contexte.
  const insets = useSafeAreaInsets();
  const formCardPaddingBottom = Math.max(24, insets.bottom + 12);
  const [demandes, setDemandes] = useState<DemandeAutorisation[]>([]);
  const [absences, setAbsences] = useState<AbsenceOption[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editDemande, setEditDemande] = useState<DemandeAutorisation | null>(null);

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
    // Fallback offline : la colonne BDD impose StringLength(10), donc on retire
    // le préfixe "DA" et on conserve uniquement AAMMJJHHmm = 10 caractères.
    // En usage normal, on appelle plutôt apiService.getNextDemandeAutorisationCode
    // (cf. openNewForm) qui suit le format attendu par le backend.
    const n = new Date();
    const pad = (x: number) => String(x).padStart(2, '0');
    return `${String(n.getFullYear()).slice(-2)}${pad(n.getMonth() + 1)}${pad(n.getDate())}${pad(n.getHours())}${pad(n.getMinutes())}`;
  };

  const openNewForm = () => {
    setEditDemande(null);
    // Pré-remplit avec un fallback synchrone (cohérent avec la contrainte de
    // 10 caractères côté BDD) puis tente de récupérer le vrai N° depuis le
    // backend ; si le réseau échoue, le fallback est valide pour l'envoi.
    setFormConcod(generateConcod());
    if (user?.soccod) {
      apiService
        .getNextDemandeAutorisationCode(user.soccod)
        .then((res) => {
          if (res?.concod) setFormConcod(res.concod);
        })
        .catch(() => { /* fallback déjà appliqué */ });
    }
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
      Alert.alert(t('common.error'), t('authorization.errorSelectType'));
      return;
    }
    if (!formConmotif) {
      Alert.alert(t('common.error'), t('authorization.errorFillReason'));
      return;
    }
    if (!user?.soccod || !user?.uticod) return;

    try {
      // Tronque le concod à 10 caractères pour respecter la contrainte
      // [StringLength(10)] côté serveur (sinon ModelState invalide → 400).
      const concod = (formConcod || generateConcod()).slice(0, 10);
      const payload = {
        soccod: user.soccod,
        empcod: user.uticod,
        concod,
        condat: formCondat.toISOString().split('T')[0],
        condep: formCondep.toISOString(),
        conret: formConret.toISOString(),
        conmotif: formConmotif,
        abscod: formAbscod || null,
      };

      if (editDemande) {
        await apiService.updateDemandeAutorisation({ ...payload, id: editDemande.id });
        Alert.alert(t('authorization.successTitle'), t('authorization.successUpdated'));
      } else {
        await apiService.createDemandeAutorisation(payload);
        Alert.alert(t('authorization.successTitle'), t('authorization.successCreated'));
      }
      setShowForm(false);
      setEditDemande(null);
      loadDemandes();
    } catch (e: any) {
      // Même filet de sécurité que LeaveRequestScreen : on a vu des 500 remontés
      // alors que le record était bien créé (notif manager qui échoue côté serveur).
      const status = e?.response?.status;
      const wasNetworkOrServerHiccup = !status || status >= 500;
      try { await loadDemandes(); } catch { /* best-effort */ }
      if (wasNetworkOrServerHiccup) {
        Alert.alert(t('authorization.partialActionTitle'),
          t('authorization.partialActionMessage'));
        setShowForm(false);
        setEditDemande(null);
        return;
      }
      Alert.alert(t('common.error'), t('authorization.errorSubmit'));
    }
  };

  const handleDelete = (d: DemandeAutorisation) => {
    Alert.alert(t('common.delete'), t('authorization.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'), style: 'destructive', onPress: async () => {
          try {
            await apiService.deleteDemandeAutorisation(d.id);
            loadDemandes();
          } catch { Alert.alert(t('common.error'), t('authorization.errorDelete')); }
        },
      },
    ]);
  };

  const handleApprove = (d: DemandeAutorisation) => {
    Alert.alert(t('authorization.approveTitle'), t('authorization.approveConfirm', { name: d.emplib || d.empcod || '' }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('authorization.approveTitle'), onPress: async () => {
          try {
            await apiService.approveDemandeAutorisation(d.id, user!.uticod!);
            Alert.alert(t('authorization.successTitle'), t('authorization.successApproved'));
            loadDemandes();
          } catch { Alert.alert(t('common.error'), t('authorization.errorApprove')); }
        },
      },
    ]);
  };

  const handleRefuse = (d: DemandeAutorisation) => {
    Alert.alert(t('authorization.refuseTitle'), t('authorization.refuseConfirm', { name: d.emplib || d.empcod || '' }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('authorization.refuseTitle'), style: 'destructive', onPress: async () => {
          try {
            await apiService.refuseDemandeAutorisation(d.id, user!.uticod!);
            Alert.alert(t('common.success'), t('authorization.successRefused'));
            loadDemandes();
          } catch { Alert.alert(t('common.error'), t('authorization.errorRefuse')); }
        },
      },
    ]);
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
        <Text style={styles.topAppTitle}>{t('authorization.title')}</Text>
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
          <Text style={styles.heroTitle}>{t('authorization.heroTitle')}</Text>
          <Text style={styles.heroSub}>{t('authorization.heroSubtitle')}</Text>
          <TouchableOpacity style={styles.addBtn} onPress={openNewForm} activeOpacity={0.85}>
            <MaterialCommunityIcons name="plus-circle" size={18} color="#fff" />
            <Text style={styles.addBtnText}>{t('authorization.newRequest')}</Text>
          </TouchableOpacity>
        </LinearGradient>

        {/* ── Stats Row ── */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderLeftColor: '#22c55e' }]}>
            <Text style={[styles.statValue, { color: '#22c55e' }]}>{approved.length}</Text>
            <Text style={styles.statLabel}>{t('authorization.statApproved')}</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#ef4444' }]}>
            <Text style={[styles.statValue, { color: '#ef4444' }]}>{refused.length}</Text>
            <Text style={styles.statLabel}>{t('authorization.statRefused')}</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#f59e0b' }]}>
            <Text style={[styles.statValue, { color: '#f59e0b' }]}>{pending.length}</Text>
            <Text style={styles.statLabel}>{t('common.pending')}</Text>
          </View>
        </View>

        {/* ── History ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('authorization.historyTitle')}</Text>
        </View>

        <View style={styles.historyList}>
          {demandes.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>{t('authorization.emptyText')}</Text>
              <TouchableOpacity style={styles.emptyBtn} onPress={openNewForm}>
                <Text style={styles.emptyBtnText}>{t('authorization.createRequest')}</Text>
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
                        {item.conmotif || item.abslib || t('authorization.itemDefaultTitle')}
                      </Text>
                      <Text style={styles.historyMeta}>
                        {fmtDate(item.condep, locale)} • {fmtDuration(item.connbjour)}
                      </Text>
                      {item.emplib && (
                        <Text style={styles.historyEmp}>👤 {item.emplib}</Text>
                      )}
                    </View>
                  </View>

                  <View style={{ alignItems: 'flex-end', gap: 8 }}>
                    <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
                      <Text style={[styles.statusText, { color: statusColors.text }]}>{t(STATUS_LABEL_KEYS[status])}</Text>
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

      {/* ── Form Overlay (style LeaveRequestScreen) ── */}
      {showForm && (
        <View style={styles.modalOverlay}>
          <View style={[styles.formCard, { paddingBottom: formCardPaddingBottom }]}>
            <View style={styles.formHeader}>
              <Text style={styles.formHeaderTitle}>
                {editDemande ? t('authorization.formTitleEdit') : t('authorization.formTitleNew')}
              </Text>
              <TouchableOpacity onPress={() => { setShowForm(false); setEditDemande(null); }}>
                <MaterialCommunityIcons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>{t('authorization.labelType')}</Text>
              <View style={styles.typeRow}>
                {absences.map((abs) => (
                  <TouchableOpacity
                    key={abs.abscod}
                    style={[styles.typeBtn, formAbscod === abs.abscod && styles.typeBtnActive]}
                    onPress={() => setFormAbscod(abs.abscod)}
                  >
                    <Text style={[styles.typeText, formAbscod === abs.abscod && styles.typeTextActive]}>
                      {abs.abslib || abs.abscod}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>{t('authorization.labelStartDateTime')}</Text>
              <View style={styles.dateTimeRow}>
                <TouchableOpacity style={[styles.dateInput, styles.dateTimeBtn]} onPress={() => setShowDepDatePicker(true)}>
                  <Text style={styles.dateInputText}>{fmtDate(formCondep.toISOString(), locale)}</Text>
                  <MaterialCommunityIcons name="calendar" size={20} color={COLORS.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.dateInput, styles.dateTimeBtn]} onPress={() => setShowDepTimePicker(true)}>
                  <Text style={styles.dateInputText}>{fmtTime(formCondep.toISOString(), locale)}</Text>
                  <MaterialCommunityIcons name="clock-outline" size={20} color={COLORS.primary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>{t('authorization.labelEndDateTime')}</Text>
              <View style={styles.dateTimeRow}>
                <TouchableOpacity style={[styles.dateInput, styles.dateTimeBtn]} onPress={() => setShowRetDatePicker(true)}>
                  <Text style={styles.dateInputText}>{fmtDate(formConret.toISOString(), locale)}</Text>
                  <MaterialCommunityIcons name="calendar" size={20} color={COLORS.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.dateInput, styles.dateTimeBtn]} onPress={() => setShowRetTimePicker(true)}>
                  <Text style={styles.dateInputText}>{fmtTime(formConret.toISOString(), locale)}</Text>
                  <MaterialCommunityIcons name="clock-outline" size={20} color={COLORS.primary} />
                </TouchableOpacity>
              </View>

              <View style={styles.durationCard}>
                <Text style={styles.durationLabel}>{t('authorization.durationLabel')}</Text>
                <Text style={styles.durationValue}>{fmtDuration(calcDuration())}</Text>
              </View>

              <Text style={styles.label}>{t('authorization.labelReason')}</Text>
              <TextInput
                style={styles.motifInput}
                value={formConmotif}
                multiline
                onChangeText={setFormConmotif}
                placeholder={t('authorization.reasonPlaceholder')}
                placeholderTextColor={COLORS.outline}
              />

              <View style={styles.formFooter}>
                <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
                  <Text style={styles.submitBtnText}>
                    {editDemande ? t('authorization.submitUpdate') : t('authorization.submitSend')}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      )}

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
        title={t('authorization.pickerStartDate')}
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
        title={t('authorization.pickerEndDate')}
      />

      {/* ── Time Pickers ── */}
      <TimePickerModal
        visible={showDepTimePicker}
        value={formCondep}
        onChange={(d) => { setFormCondep(d); }}
        onClose={() => setShowDepTimePicker(false)}
        title={t('authorization.pickerStartTime')}
      />
      <TimePickerModal
        visible={showRetTimePicker}
        value={formConret}
        onChange={(d) => { setFormConret(d); }}
        onClose={() => setShowRetTimePicker(false)}
        title={t('authorization.pickerEndTime')}
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
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4,
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

  // ── Form Overlay (aligné sur LeaveRequestScreen) ──
  // elevation: 30 force le modal au-dessus du BottomTabBar (elevation: 8)
  // sur Android, sinon la barre persistante reste cliquable et masque les
  // boutons de validation.
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
    maxHeight: '85%',
  },
  formHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 24,
  },
  formHeaderTitle: { fontSize: 20, fontWeight: '800', color: COLORS.onSurface },
  formScroll: { flexGrow: 0 },

  // ── Form Fields ──
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

  dateInput: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.surfaceContainerLow, borderRadius: 12, padding: 16,
  },
  dateInputText: { fontSize: 14, fontWeight: '600', color: COLORS.onSurface },
  dateTimeRow: { flexDirection: 'row', gap: 8 },
  dateTimeBtn: { flex: 1 },

  durationCard: {
    marginTop: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'rgba(0,86,210,0.06)', borderRadius: 12, padding: 12,
  },
  durationLabel: { fontSize: 12, color: COLORS.primary, fontWeight: '700' },
  durationValue: { fontSize: 16, color: COLORS.primary, fontWeight: '800' },

  motifInput: {
    backgroundColor: COLORS.surfaceContainerLow, borderRadius: 12,
    padding: 14, fontSize: 14, color: COLORS.onSurface,
    minHeight: 80, textAlignVertical: 'top',
  },

  formFooter: { marginTop: 32, marginBottom: 24 },
  submitBtn: {
    backgroundColor: COLORS.primary, borderRadius: 16,
    paddingVertical: 18, alignItems: 'center',
  },
  submitBtnText: { color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: 1 },
});