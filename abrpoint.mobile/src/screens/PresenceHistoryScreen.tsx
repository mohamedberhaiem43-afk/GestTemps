import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import { COLORS } from '../config/env';
import BottomTabBar, { useTabBarPadding } from '../components/BottomTabBar';
import { withCacheFallback } from '../services/cache';

type DayStatus = 'present' | 'late' | 'absent' | 'repos' | 'conge' | 'ferier' | 'partial';

interface DayInfo {
  date: Date;
  raw: any | null;
  status: DayStatus;
  totalMinutes: number;
  hasLate: boolean;
  events: { type: 'IN' | 'OUT'; label: string; time: string; color: string; icon: string }[];
  // Catégories visuelles superposées au statut de présence — utilisées par la grille
  // mensuelle pour appliquer une couleur de fond distincte (cf. maquette transmise
  // par le produit le 2026-05-22 : férié, congé approuvé, congé en attente,
  // autorisation, jour avec heures supplémentaires, aujourd'hui).
  isHoliday: boolean;          // jour férié (table feriers)
  holidayLabel?: string;       // libellé du férié pour le tooltip / détail
  isLeaveApproved: boolean;    // congé validé qui chevauche ce jour
  isLeavePending: boolean;     // congé en attente de validation
  isAuthorization: boolean;    // autorisation de sortie qui chevauche ce jour
  hasOvertime: boolean;        // tothsup > 0 sur la présence du jour
}

// Catégorie de couleur principale appliquée à la cellule de la grille mensuelle.
// L'ordre de priorité reflète l'importance commerciale du marquage : un congé
// validé masque l'overtime éventuel (un congé n'a pas d'heures supp), un férié
// masque le congé (un férié payé prime côté paie), aujourd'hui passe en dernier
// pour ne pas écraser l'info métier — il est dessiné avec un cadre vert seul.
type DayCategory = 'ferier' | 'conge' | 'autorisation' | 'overtime' | 'normal' | 'outside';

const MONTH_NAMES = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
// Grille mensuelle façon européenne : lundi en premier, dimanche en dernier.
const GRID_DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function formatYMD(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

function parseTime(str?: string | null): number | null {
  if (!str) return null;
  const [h, m] = String(str).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function isTrue(v: any): boolean {
  if (v === true) return true;
  if (typeof v === 'string') return ['1', 'true', 'True', 'O', 'Oui'].includes(v.trim());
  return false;
}

function computeTotalMinutes(p: any): number {
  let total = 0;
  const a = parseTime(p?.preentmatup);
  const b = parseTime(p?.presortmatup);
  const c = parseTime(p?.preentamidiup);
  const d = parseTime(p?.presortamidiup);
  if (a !== null && b !== null && b > a) total += b - a;
  if (c !== null && d !== null && d > c) total += d - c;
  return total;
}

// La présence porte un champ `tothsup` au format "HH:MM" (heures supplémentaires
// totalisées en fin de journée par le moteur de calcul backend). Une valeur vide,
// "00:00" ou null = pas d'heures sup ; tout ce qui parse en minutes > 0 = HS.
function hasOvertime(p: any): boolean {
  if (!p) return false;
  const t = parseTime(p.tothsup);
  return t !== null && t > 0;
}

function deriveStatus(p: any): DayStatus {
  if (!p) return 'absent';
  if (isTrue(p.prerepos)) return 'repos';
  if (p.concod || p.conge || isTrue(p.preconge)) return 'conge';
  if (isTrue(p.preferier) || p.ferier) return 'ferier';
  const hasIn = !!(p.preentmatup || p.preentamidiup);
  const hasOut = !!(p.presortmatup || p.presortamidiup);
  const tothre = parseTime(p.tothre);
  if (hasIn && tothre && tothre > 0) return 'late';
  if (hasIn && hasOut) return 'present';
  if (hasIn) return 'partial';
  return 'absent';
}

function statusMeta(s: DayStatus): { label: string; color: string; bg: string; icon: string } {
  switch (s) {
    case 'present': return { label: 'Présent', color: COLORS.tertiary, bg: COLORS.tertiaryFixed, icon: 'check-circle' };
    case 'late':    return { label: 'En retard', color: COLORS.warning, bg: '#fff1c2', icon: 'clock-alert' };
    case 'partial': return { label: 'Sortie manquante', color: COLORS.warning, bg: '#fff1c2', icon: 'progress-clock' };
    case 'absent':  return { label: 'Absent', color: COLORS.error, bg: COLORS.errorContainer, icon: 'close-circle' };
    case 'repos':   return { label: 'Repos', color: COLORS.secondary, bg: COLORS.secondaryFixed, icon: 'sleep' };
    case 'conge':   return { label: 'Congé', color: COLORS.primary, bg: COLORS.primaryFixed, icon: 'palm-tree' };
    case 'ferier':  return { label: 'Férié', color: COLORS.accent, bg: COLORS.primaryFixed, icon: 'star-circle' };
  }
}

function formatHM(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h${pad(m)}`;
}

export default function PresenceHistoryScreen({ navigation }: any) {
  const { user } = useAuth();
  const tabBarPadding = useTabBarPadding();
  const today = useMemo(() => new Date(), []);
  const [refMonth, setRefMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [presences, setPresences] = useState<any[]>([]);
  // Données superposées au calendrier — toutes filtrées sur le mois visible et
  // l'utilisateur connecté. Fournies par 3 endpoints distincts en parallèle :
  //   • /Feriers/upcoming/{soccod}              → liste des jours fériés
  //   • /DemConges/get-emp-demconge/{soccod}/{empcod} → demandes de congé du salarié
  //   • /Autorisers/my-auths/{soccod}/{empcod}  → autorisations de sortie
  const [holidays, setHolidays] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [authorizations, setAuthorizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [filter, setFilter] = useState<'all' | DayStatus>('all');
  // Détail d'une journée ouvert depuis la liste mensuelle (le chevron-right
  // indiquait une navigation, mais aucune action n'était câblée). Modal local
  // = pas de nouvel écran à enregistrer côté navigateur.
  const [detailDay, setDetailDay] = useState<DayInfo | null>(null);

  const loadPresences = useCallback(async () => {
    if (!user?.soccod || !user?.uticod) return;
    const firstDay = new Date(refMonth.getFullYear(), refMonth.getMonth(), 1);
    const lastDay = new Date(refMonth.getFullYear(), refMonth.getMonth() + 1, 0);
    const year = refMonth.getFullYear();
    const cacheKey = `history_${user.soccod}_${user.uticod}_${year}_${refMonth.getMonth() + 1}`;
    try {
      // Toutes les sources chargées en parallèle. On encapsule chacune dans un
      // catch silencieux pour qu'une panne isolée (ex : endpoint Autorisers
      // momentanément 500) n'empêche pas le rendu du calendrier — les autres
      // catégories restent visibles.
      const [presResp, holResp, leaveResp, authResp] = await Promise.all([
        withCacheFallback(cacheKey, () =>
          apiService.getMyPresenceHistory(user.soccod!, user.uticod!, formatYMD(firstDay), formatYMD(lastDay))
        ),
        withCacheFallback(`holidays_${user.soccod}_${year}`, () =>
          apiService.getUpcomingHolidays(user.soccod!, year)
        ).catch(() => ({ data: [] })),
        // empcod = uticod côté employé connecté (cf. /DemConges/get-emp-demconge).
        withCacheFallback(`leaves_${user.soccod}_${user.uticod}`, () =>
          apiService.getMyLeaveRequests(user.soccod!, user.uticod!)
        ).catch(() => ({ data: [] })),
        withCacheFallback(`auths_${user.soccod}_${user.uticod}`, () =>
          apiService.getMyAuthorizations(user.soccod!, user.uticod!)
        ).catch(() => ({ data: [] })),
      ]);
      setPresences(Array.isArray(presResp.data) ? presResp.data : []);
      setHolidays(Array.isArray(holResp.data) ? holResp.data : []);
      setLeaves(Array.isArray(leaveResp.data) ? leaveResp.data : []);
      setAuthorizations(Array.isArray(authResp.data) ? authResp.data : []);
    } catch (error) {
      console.log('Failed to load presences:', error);
      setPresences([]);
      setHolidays([]);
      setLeaves([]);
      setAuthorizations([]);
    } finally {
      setLoading(false);
    }
  }, [user, refMonth]);

  useEffect(() => { setLoading(true); loadPresences(); }, [loadPresences]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPresences();
    setRefreshing(false);
  };

  // Map presence par date pour lookup rapide
  const byDate = useMemo(() => {
    const m = new Map<string, any>();
    for (const p of presences) {
      const k = (p?.predat || '').slice(0, 10);
      if (k) m.set(k, p);
    }
    return m;
  }, [presences]);

  // Set des dates fériées (ferdate au format YYYY-MM-DD). Stocké séparément du
  // libellé pour permettre un lookup O(1) en rendu de grille.
  const holidayMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const h of holidays) {
      const k = (h?.ferdate || '').slice(0, 10);
      if (k) m.set(k, h?.fermotif || 'Jour férié');
    }
    return m;
  }, [holidays]);

  // Sets de dates couvertes par un congé validé OU en attente, et par une
  // autorisation. Les enregistrements DemConge/Autoriser stockent l'intervalle
  // dans (condep, conret) inclus. Le critère de validation côté backend :
  //   • condg === 'O' (ou '1') → congé approuvé par le manager
  //   • Sinon, en attente. Refus = présence dans conrefus ; on l'exclut.
  const { leaveApprovedSet, leavePendingSet } = useMemo(() => {
    const approved = new Set<string>();
    const pending = new Set<string>();
    for (const l of leaves) {
      const start = l?.condep;
      const end = l?.conret || l?.condep;
      if (!start) continue;
      // Refus explicite — on n'affiche rien sur le calendrier.
      if (l?.conrefus) continue;
      const isApproved = String(l?.condg ?? '').toUpperCase() === 'O'
                         || String(l?.condg ?? '') === '1';
      const target = isApproved ? approved : pending;
      const s = new Date(start);
      const e = new Date(end);
      if (isNaN(s.getTime()) || isNaN(e.getTime())) continue;
      const cur = new Date(s.getFullYear(), s.getMonth(), s.getDate());
      const last = new Date(e.getFullYear(), e.getMonth(), e.getDate());
      while (cur <= last) {
        target.add(formatYMD(cur));
        cur.setDate(cur.getDate() + 1);
      }
    }
    return { leaveApprovedSet: approved, leavePendingSet: pending };
  }, [leaves]);

  const authorizationSet = useMemo(() => {
    const s = new Set<string>();
    for (const a of authorizations) {
      const start = a?.condep;
      const end = a?.conret || a?.condep;
      if (!start) continue;
      const sd = new Date(start);
      const ed = new Date(end);
      if (isNaN(sd.getTime()) || isNaN(ed.getTime())) continue;
      const cur = new Date(sd.getFullYear(), sd.getMonth(), sd.getDate());
      const last = new Date(ed.getFullYear(), ed.getMonth(), ed.getDate());
      while (cur <= last) {
        s.add(formatYMD(cur));
        cur.setDate(cur.getDate() + 1);
      }
    }
    return s;
  }, [authorizations]);

  // Liste de jours du mois courant avec status calculé
  const monthDays = useMemo<DayInfo[]>(() => {
    const days: DayInfo[] = [];
    const lastDayOfMonth = new Date(refMonth.getFullYear(), refMonth.getMonth() + 1, 0).getDate();
    for (let i = 1; i <= lastDayOfMonth; i++) {
      const date = new Date(refMonth.getFullYear(), refMonth.getMonth(), i);
      const key = formatYMD(date);
      const raw = byDate.get(key) || null;
      const status = deriveStatus(raw);
      const totalMinutes = raw ? computeTotalMinutes(raw) : 0;
      const tothre = parseTime(raw?.tothre);
      const events: DayInfo['events'] = [];
      if (raw?.preentmatup) events.push({ type: 'IN', label: 'Entrée matin', time: raw.preentmatup, color: COLORS.tertiary, icon: 'login' });
      if (raw?.presortmatup) events.push({ type: 'OUT', label: 'Sortie matin', time: raw.presortmatup, color: COLORS.error, icon: 'logout' });
      if (raw?.preentamidiup) events.push({ type: 'IN', label: 'Reprise après-midi', time: raw.preentamidiup, color: COLORS.tertiary, icon: 'login' });
      if (raw?.presortamidiup) events.push({ type: 'OUT', label: 'Sortie après-midi', time: raw.presortamidiup, color: COLORS.error, icon: 'logout' });
      days.push({
        date, raw, status, totalMinutes,
        hasLate: !!(tothre && tothre > 0),
        events,
        isHoliday: holidayMap.has(key),
        holidayLabel: holidayMap.get(key),
        isLeaveApproved: leaveApprovedSet.has(key),
        isLeavePending: leavePendingSet.has(key),
        isAuthorization: authorizationSet.has(key),
        hasOvertime: hasOvertime(raw),
      });
    }
    return days;
  }, [refMonth, byDate, holidayMap, leaveApprovedSet, leavePendingSet, authorizationSet]);

  // Catégorie principale par date (priorité férié > congé > autorisation > HS).
  // Aujourd'hui est traité à part : juste un cadre vert, sans changer la couleur.
  const dayCategoryFor = useCallback((d: DayInfo, sameMonth: boolean): DayCategory => {
    if (!sameMonth) return 'outside';
    if (d.isHoliday) return 'ferier';
    if (d.isLeaveApproved || d.isLeavePending) return 'conge';
    if (d.isAuthorization) return 'autorisation';
    if (d.hasOvertime) return 'overtime';
    return 'normal';
  }, []);

  // Construction de la grille mensuelle 7 × N (Lun → Dim, lundi-first style
  // européen + style maquette transmise). On précalcule l'offset du 1er jour :
  // pour un mois qui commence un mercredi (getDay() === 3), on insère 2 cellules
  // « jour du mois précédent ». Idem pour les trailing days.
  const monthGrid = useMemo(() => {
    const firstOfMonth = new Date(refMonth.getFullYear(), refMonth.getMonth(), 1);
    // JS getDay : 0=dim … 6=sam. On convertit en lundi=0 … dimanche=6 pour
    // calculer l'offset à partir du début de la grille.
    const offset = (firstOfMonth.getDay() + 6) % 7;
    const lastOfMonth = new Date(refMonth.getFullYear(), refMonth.getMonth() + 1, 0).getDate();
    const totalCells = Math.ceil((offset + lastOfMonth) / 7) * 7;
    const cells: Array<{ date: Date; sameMonth: boolean; info: DayInfo | null }> = [];
    for (let i = 0; i < totalCells; i++) {
      const d = new Date(firstOfMonth);
      d.setDate(firstOfMonth.getDate() + (i - offset));
      const sameMonth = d.getMonth() === refMonth.getMonth();
      const info = sameMonth
        ? monthDays.find(md => formatYMD(md.date) === formatYMD(d)) ?? null
        : null;
      cells.push({ date: d, sameMonth, info });
    }
    // Regroupement par semaines de 7 cases.
    const weeks: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  }, [refMonth, monthDays]);

  // Stats du mois
  const monthStats = useMemo(() => {
    let workedMinutes = 0;
    let presentDays = 0;
    let lateDays = 0;
    let absentDays = 0;
    for (const d of monthDays) {
      if (d.date > today) continue;
      workedMinutes += d.totalMinutes;
      if (d.status === 'present') presentDays++;
      if (d.status === 'late') lateDays++;
      if (d.status === 'absent') absentDays++;
    }
    return { workedMinutes, presentDays, lateDays, absentDays };
  }, [monthDays, today]);

  // Jour sélectionné
  const selectedInfo = useMemo<DayInfo | null>(() => {
    const key = formatYMD(selectedDate);
    return monthDays.find(d => formatYMD(d.date) === key) || null;
  }, [selectedDate, monthDays]);

  // Liste des jours filtrés (les plus récents en premier, jours futurs exclus)
  const filteredDays = useMemo(() => {
    const past = monthDays.filter(d => d.date <= today);
    const filtered = filter === 'all' ? past : past.filter(d => d.status === filter);
    return [...filtered].sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [monthDays, filter, today]);

  const goPrevMonth = () => setRefMonth(new Date(refMonth.getFullYear(), refMonth.getMonth() - 1, 1));
  const goNextMonth = () => {
    // Ne pas aller au-delà du mois courant
    const next = new Date(refMonth.getFullYear(), refMonth.getMonth() + 1, 1);
    if (next <= today) setRefMonth(next);
  };


  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    );
  }

  const monthLabel = `${MONTH_NAMES[refMonth.getMonth()]} ${refMonth.getFullYear()}`;
  const isFuture = (d: Date) => d > today;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topAppBar}>
        <View>
          <Text style={styles.subHeader}>Suivi temporel</Text>
          <Text style={styles.mainTitle}>Historique</Text>
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
        {/* Calendrier mensuel — grille 7 colonnes (Lun → Dim) avec cellules
            colorées par catégorie (férié, congé, autorisation, heures sup).
            Réf. maquette transmise par le produit le 2026-05-22 — palette :
              • férié           → rouge clair (saumon)
              • congé approuvé  → tan/brun
              • congé en attente→ tan avec bordure pointillée
              • autorisation    → ambre clair
              • HS              → teal/turquoise
              • aujourd'hui     → cadre vert (par-dessus la couleur de catégorie)
              • hors mois       → texte grisé, fond transparent */}
        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <View>
              <Text style={styles.calendarMonth}>{monthLabel}</Text>
              <Text style={styles.calendarHint}>Votre calendrier</Text>
            </View>
            <View style={styles.calendarNav}>
              <TouchableOpacity onPress={goPrevMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.navBtn}>
                <MaterialCommunityIcons name="chevron-left" size={22} color={COLORS.onSurface} />
              </TouchableOpacity>
              <TouchableOpacity onPress={goNextMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={styles.navBtn}>
                <MaterialCommunityIcons name="chevron-right" size={22} color={COLORS.onSurface} />
              </TouchableOpacity>
            </View>
          </View>

          {/* En-tête jours de la semaine */}
          <View style={styles.gridHeaderRow}>
            {GRID_DAY_LABELS.map((lbl) => (
              <Text key={lbl} style={styles.gridHeaderCell}>{lbl}</Text>
            ))}
          </View>

          {/* Grille des semaines */}
          {monthGrid.map((week, wi) => (
            <View key={wi} style={styles.gridWeekRow}>
              {week.map((cell, ci) => {
                const category = cell.info
                  ? dayCategoryFor(cell.info, cell.sameMonth)
                  : (cell.sameMonth ? 'normal' : 'outside');
                const isToday = formatYMD(cell.date) === formatYMD(today);
                const isSelected = formatYMD(cell.date) === formatYMD(selectedDate);
                const future = cell.date > today;
                const cellStyle = [
                  styles.gridCell,
                  category === 'ferier' && styles.gridCellFerier,
                  category === 'conge' && (cell.info?.isLeaveApproved
                    ? styles.gridCellCongeApproved
                    : styles.gridCellCongePending),
                  category === 'autorisation' && styles.gridCellAutorisation,
                  category === 'overtime' && styles.gridCellOvertime,
                  isToday && cell.sameMonth && styles.gridCellToday,
                  isSelected && cell.sameMonth && !isToday && styles.gridCellSelected,
                ];
                const textStyle = [
                  styles.gridCellText,
                  !cell.sameMonth && styles.gridCellTextOutside,
                  future && cell.sameMonth && styles.gridCellTextFuture,
                  category === 'ferier' && styles.gridCellTextFerier,
                  category === 'conge' && styles.gridCellTextConge,
                  category === 'autorisation' && styles.gridCellTextAutorisation,
                  category === 'overtime' && styles.gridCellTextOvertime,
                  isToday && cell.sameMonth && styles.gridCellTextToday,
                ];
                return (
                  <TouchableOpacity
                    key={ci}
                    style={cellStyle}
                    disabled={!cell.sameMonth}
                    onPress={() => cell.sameMonth && setSelectedDate(cell.date)}
                    activeOpacity={0.7}
                  >
                    <Text style={textStyle}>{cell.date.getDate()}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          {/* Légende des couleurs — toujours visible pour aider à décoder la grille */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, styles.gridCellOvertime]} />
              <Text style={styles.legendLabel}>Heures sup.</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, styles.gridCellCongeApproved]} />
              <Text style={styles.legendLabel}>Congé</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, styles.gridCellCongePending]} />
              <Text style={styles.legendLabel}>En attente</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, styles.gridCellAutorisation]} />
              <Text style={styles.legendLabel}>Autorisation</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, styles.gridCellFerier]} />
              <Text style={styles.legendLabel}>Férié</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, styles.gridCellToday]} />
              <Text style={styles.legendLabel}>Aujourd'hui</Text>
            </View>
          </View>
        </View>

        {/* CTA « Ajouter une demande » MASQUÉ temporairement (demande produit
            2026-05-26) : le bouton noir full-width sous le calendrier ouvrait
            l'écran unifié AddRequestScreen, mais le produit préfère canaliser
            l'utilisateur vers des écrans dédiés (DemandeAbsenceScreen,
            LeaveRequestScreen, etc.) accessibles depuis les tuiles HomeScreen.
            Pour les heures supp, une tuile dédiée "Heures supp" a été ajoutée
            sur HomeScreen (presetType=heuressup vers AddRequestScreen).
            On garde le bloc JSX en commentaire JSX pour réactivation triviale
            si la décision est revue. NE PAS supprimer sans concertation. */}
        {false && (
          <TouchableOpacity
            style={styles.addRequestBtn}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('AddRequest', { presetDate: formatYMD(selectedDate) })}
          >
            <MaterialCommunityIcons name="plus-circle-outline" size={20} color="#fff" />
            <Text style={styles.addRequestBtnText}>Ajouter une demande</Text>
          </TouchableOpacity>
        )}

        {/* Stats mensuelles */}
        <View style={styles.statsRow}>
          <View style={[styles.statBento, { backgroundColor: COLORS.primaryFixed }]}>
            <MaterialCommunityIcons name="clock-outline" size={22} color={COLORS.primary} />
            <View>
              <Text style={[styles.bentoLabel, { color: COLORS.onPrimaryFixedVariant }]}>TOTAL MOIS</Text>
              <Text style={[styles.bentoValue, { color: COLORS.onPrimaryFixed }]}>{formatHM(monthStats.workedMinutes)}</Text>
            </View>
          </View>
          <View style={[styles.statBento, { backgroundColor: COLORS.tertiaryFixed }]}>
            <MaterialCommunityIcons name="check-circle-outline" size={22} color={COLORS.tertiary} />
            <View>
              <Text style={[styles.bentoLabel, { color: COLORS.onTertiaryFixedVariant }]}>JOURS PRÉSENTS</Text>
              <Text style={[styles.bentoValue, { color: COLORS.onTertiaryFixed }]}>{monthStats.presentDays + monthStats.lateDays}</Text>
            </View>
          </View>
        </View>

        {/* Détail jour sélectionné */}
        {selectedInfo && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {selectedDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </Text>
              <View style={[styles.statusPill, { backgroundColor: statusMeta(selectedInfo.status).bg }]}>
                <MaterialCommunityIcons
                  name={statusMeta(selectedInfo.status).icon}
                  size={12}
                  color={statusMeta(selectedInfo.status).color}
                />
                <Text style={[styles.statusPillText, { color: statusMeta(selectedInfo.status).color }]}>
                  {statusMeta(selectedInfo.status).label}
                </Text>
              </View>
            </View>

            {selectedInfo.events.length > 0 ? (
              <View style={styles.ledgerList}>
                {selectedInfo.events.map((event, idx) => (
                  <View key={idx} style={[styles.ledgerItem, { borderLeftColor: event.color }]}>
                    <View style={styles.ledgerLeft}>
                      <View style={[styles.ledgerIconWrapper, { backgroundColor: `${event.color}15` }]}>
                        <MaterialCommunityIcons name={event.icon} size={20} color={event.color} />
                      </View>
                      <View>
                        <Text style={styles.ledgerTitle}>{event.label}</Text>
                        <Text style={styles.ledgerSub}>{event.type === 'IN' ? 'Pointage entrée' : 'Pointage sortie'}</Text>
                      </View>
                    </View>
                    <Text style={styles.ledgerTime}>{event.time}</Text>
                  </View>
                ))}
                <View style={styles.daySummaryCard}>
                  <Text style={styles.daySummaryLabel}>Total travaillé</Text>
                  <Text style={styles.daySummaryValue}>{formatHM(selectedInfo.totalMinutes)}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.emptyLedger}>
                <MaterialCommunityIcons name={statusMeta(selectedInfo.status).icon} size={36} color={statusMeta(selectedInfo.status).color} />
                <Text style={styles.emptyText}>Aucun pointage enregistré</Text>
              </View>
            )}
          </View>
        )}

        {/* Filtres */}
        <View style={styles.filterRow}>
          {[
            { k: 'all', label: 'Tout' },
            { k: 'present', label: 'Présent' },
            { k: 'late', label: 'Retard' },
            { k: 'absent', label: 'Absent' },
            { k: 'conge', label: 'Congé' },
            { k: 'repos', label: 'Repos' },
          ].map(f => (
            <TouchableOpacity
              key={f.k}
              style={[styles.filterChip, filter === f.k && styles.filterChipActive]}
              onPress={() => setFilter(f.k as any)}
            >
              <Text style={[styles.filterChipText, filter === f.k && styles.filterChipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Liste mensuelle */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tous les jours</Text>
          <View style={styles.archiveList}>
            {filteredDays.map((d, idx) => {
              const meta = statusMeta(d.status);
              return (
                <TouchableOpacity
                  key={idx}
                  style={styles.archiveItem}
                  onPress={() => { setSelectedDate(d.date); setDetailDay(d); }}
                  activeOpacity={0.7}
                >
                  <View style={styles.archiveLeft}>
                    <View style={[styles.archiveDateBadge, { backgroundColor: meta.bg }]}>
                      <Text style={[styles.archiveDateText, { color: meta.color }]}>{d.date.getDate()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.archiveDay}>
                        {d.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })}
                      </Text>
                      <View style={styles.archiveMetaRow}>
                        <View style={[styles.statusDot, { backgroundColor: meta.color }]} />
                        <Text style={styles.archiveMeta}>{meta.label}</Text>
                        {d.totalMinutes > 0 && (
                          <Text style={styles.archiveMeta}> · {formatHM(d.totalMinutes)}</Text>
                        )}
                      </View>
                    </View>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.outline} />
                </TouchableOpacity>
              );
            })}
            {filteredDays.length === 0 && (
              <View style={styles.emptyLedger}>
                <Text style={styles.emptyText}>Aucun jour ne correspond à ce filtre.</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <BottomTabBar active="history" navigation={navigation} />

      {/* Détail journée — ouvert quand l'utilisateur tape une ligne de l'archive
          mensuelle. Réutilise la même structure visuelle (events + total) que
          le panneau "Détail jour sélectionné" en haut, sans forcer le scroll. */}
      <Modal
        visible={!!detailDay}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailDay(null)}
        statusBarTranslucent
      >
        <View style={styles.detailOverlay}>
          <View style={[styles.detailSheet, { paddingBottom: tabBarPadding * 0.4 + 16 }]}>
            <View style={styles.detailHandle} />
            <View style={styles.detailHeader}>
              <View>
                <Text style={styles.detailDate}>
                  {detailDay?.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </Text>
                {detailDay && (
                  <View style={[styles.statusPill, { backgroundColor: statusMeta(detailDay.status).bg, marginTop: 6 }]}>
                    <MaterialCommunityIcons
                      name={statusMeta(detailDay.status).icon}
                      size={12}
                      color={statusMeta(detailDay.status).color}
                    />
                    <Text style={[styles.statusPillText, { color: statusMeta(detailDay.status).color }]}>
                      {statusMeta(detailDay.status).label}
                    </Text>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={() => setDetailDay(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialCommunityIcons name="close" size={24} color={COLORS.outline} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ marginTop: 12 }} showsVerticalScrollIndicator={false}>
              {detailDay && detailDay.events.length > 0 ? (
                <>
                  <View style={styles.ledgerList}>
                    {detailDay.events.map((event, idx) => (
                      <View key={idx} style={[styles.ledgerItem, { borderLeftColor: event.color }]}>
                        <View style={styles.ledgerLeft}>
                          <View style={[styles.ledgerIconWrapper, { backgroundColor: `${event.color}15` }]}>
                            <MaterialCommunityIcons name={event.icon} size={20} color={event.color} />
                          </View>
                          <View>
                            <Text style={styles.ledgerTitle}>{event.label}</Text>
                            <Text style={styles.ledgerSub}>{event.type === 'IN' ? 'Pointage entrée' : 'Pointage sortie'}</Text>
                          </View>
                        </View>
                        <Text style={styles.ledgerTime}>{event.time}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.daySummaryCard}>
                    <Text style={styles.daySummaryLabel}>Total travaillé</Text>
                    <Text style={styles.daySummaryValue}>{formatHM(detailDay.totalMinutes)}</Text>
                  </View>
                  {detailDay.hasLate && (
                    <View style={styles.detailNoteCard}>
                      <MaterialCommunityIcons name="clock-alert-outline" size={18} color={COLORS.warning} />
                      <Text style={styles.detailNoteText}>Retard détecté sur cette journée.</Text>
                    </View>
                  )}
                </>
              ) : detailDay ? (
                <View style={styles.emptyLedger}>
                  <MaterialCommunityIcons
                    name={statusMeta(detailDay.status).icon}
                    size={42}
                    color={statusMeta(detailDay.status).color}
                  />
                  <Text style={styles.emptyText}>
                    {detailDay.status === 'absent'
                      ? "Aucun pointage enregistré pour cette journée."
                      : detailDay.status === 'repos'
                      ? 'Jour de repos hebdomadaire — pas de pointage attendu.'
                      : detailDay.status === 'conge'
                      ? 'Journée en congé.'
                      : detailDay.status === 'ferier'
                      ? 'Jour férié.'
                      : 'Aucun détail disponible.'}
                  </Text>
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topAppBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12, backgroundColor: COLORS.background,
  },
  subHeader: { fontSize: 10, fontWeight: '700', color: COLORS.secondary, letterSpacing: 1.5, textTransform: 'uppercase' },
  mainTitle: { fontSize: 28, fontWeight: '800', color: COLORS.onSurface, letterSpacing: -0.5 },
  iconButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.primaryFixed },
  scrollContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 100 },
  calendarCard: { backgroundColor: '#fff', borderRadius: 24, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  calendarMonth: { fontSize: 17, fontWeight: '800', color: COLORS.onSurface, textTransform: 'capitalize' },
  calendarHint: { fontSize: 10, fontWeight: '700', color: COLORS.outline, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 2 },
  calendarNav: { flexDirection: 'row', gap: 6 },
  navBtn: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.surfaceContainerLow },

  // ── Grille mensuelle ─────────────────────────────────────────────────────
  gridHeaderRow: { flexDirection: 'row', marginBottom: 6 },
  gridHeaderCell: { flex: 1, textAlign: 'center', fontSize: 10, fontWeight: '700', color: COLORS.outline, letterSpacing: 0.5 },
  gridWeekRow: { flexDirection: 'row', marginBottom: 4 },
  gridCell: {
    flex: 1,
    aspectRatio: 1,
    margin: 2,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  gridCellText: { fontSize: 13, fontWeight: '700', color: COLORS.onSurface },
  gridCellTextOutside: { color: '#cbd5e1', fontWeight: '500' },
  gridCellTextFuture: { color: '#94a3b8' },
  // Férié — saumon clair (commercial demand : se distinguer nettement des congés
  // et autorisations qui partagent un ton brun/beige sur la maquette).
  gridCellFerier: { backgroundColor: '#fde2e2' },
  gridCellTextFerier: { color: '#b91c1c' },
  // Congé approuvé — beige/brun plein, comme les cases 13/14/20 de la maquette.
  gridCellCongeApproved: { backgroundColor: '#d6c4ad' },
  // Congé en attente — beige avec bordure pointillée (case 21 de la maquette).
  gridCellCongePending: {
    backgroundColor: '#e8dccb',
    borderWidth: 1.5,
    borderColor: '#9a8260',
    borderStyle: 'dashed',
  },
  gridCellTextConge: { color: '#5a4321' },
  // Autorisation de sortie — ambre clair, lisible et distinct du brun congé.
  gridCellAutorisation: { backgroundColor: '#fef3c7' },
  gridCellTextAutorisation: { color: '#92400e' },
  // Heures supp. — turquoise inspiré des cases 5/6 de la maquette.
  gridCellOvertime: { backgroundColor: '#5ad8b0' },
  gridCellTextOvertime: { color: '#0f4d3a' },
  // Aujourd'hui — fond vert clair façon highlight de la case 18 de la maquette.
  // Appliqué APRÈS la catégorie : si l'utilisateur est en congé aujourd'hui,
  // c'est l'état « aujourd'hui » qui prime visuellement.
  gridCellToday: { backgroundColor: '#a3d977' },
  gridCellTextToday: { color: '#1a4d10', fontWeight: '900' },
  gridCellSelected: { borderWidth: 2, borderColor: COLORS.primary },

  // Légende — chips horizontaux qui wrap si l'écran est étroit.
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 14, height: 14, borderRadius: 4 },
  legendLabel: { fontSize: 11, fontWeight: '600', color: COLORS.onSurfaceVariant },

  // CTA « Ajouter une demande » — bouton sombre, full width, sous le calendrier.
  // Style aligné sur la maquette transmise (Aggiungi richiesta) : noir profond,
  // texte blanc 800, icône plus à gauche, ombre douce.
  addRequestBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#0f172a',
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 18,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  addRequestBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '800', letterSpacing: 0.2 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statBento: { flex: 1, borderRadius: 18, padding: 16, gap: 10 },
  bentoLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  bentoValue: { fontSize: 22, fontWeight: '900' },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: COLORS.onSurface, textTransform: 'capitalize' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusPillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  ledgerList: { gap: 8 },
  ledgerItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    borderLeftWidth: 3,
  },
  ledgerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  ledgerIconWrapper: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  ledgerTitle: { fontSize: 14, fontWeight: '700', color: COLORS.onSurface },
  ledgerSub: { fontSize: 11, fontWeight: '500', color: COLORS.outline, marginTop: 2 },
  ledgerTime: { fontSize: 18, fontWeight: '900', color: COLORS.onSurface },
  daySummaryCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.primaryFixed, borderRadius: 14, padding: 14, marginTop: 4,
  },
  daySummaryLabel: { fontSize: 11, fontWeight: '700', color: COLORS.onPrimaryFixedVariant, letterSpacing: 0.3 },
  daySummaryValue: { fontSize: 18, fontWeight: '900', color: COLORS.onPrimaryFixed },
  emptyLedger: { padding: 24, alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 14 },
  emptyText: { fontSize: 13, color: COLORS.outline, fontWeight: '600', textAlign: 'center' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.surfaceContainerLow },
  filterChipActive: { backgroundColor: COLORS.primary },
  filterChipText: { fontSize: 12, fontWeight: '700', color: COLORS.onSurfaceVariant },
  filterChipTextActive: { color: '#fff' },
  archiveList: { gap: 10 },
  archiveItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 14, padding: 12 },
  archiveLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  archiveDateBadge: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  archiveDateText: { fontSize: 16, fontWeight: '900' },
  archiveDay: { fontSize: 13, fontWeight: '700', color: COLORS.onSurface, textTransform: 'capitalize' },
  archiveMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  archiveMeta: { fontSize: 11, color: COLORS.outline, fontWeight: '600' },

  // Modal détail journée — bottom sheet avec elevation 30 pour passer
  // au-dessus du BottomTabBar (elevation: 8) sur Android.
  detailOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'flex-end', elevation: 30 },
  detailSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12,
    maxHeight: '85%',
  },
  detailHandle: { alignSelf: 'center', width: 40, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, marginBottom: 12 },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  detailDate: { fontSize: 16, fontWeight: '800', color: COLORS.onSurface, textTransform: 'capitalize' },
  detailNoteCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff7e6', borderColor: '#fde2a7', borderWidth: 1,
    borderRadius: 12, padding: 12, marginTop: 12,
  },
  detailNoteText: { fontSize: 12, color: COLORS.warning, fontWeight: '600', flex: 1 },
});
