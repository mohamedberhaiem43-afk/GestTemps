import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import { COLORS } from '../config/env';
import DatePickerModal from '../components/DatePickerModal';
import TimePickerModal from '../components/TimePickerModal';

/**
 * Écran unifié « Ajouter une demande ».
 *
 * Maquette transmise par le produit le 2026-05-22 : un seul écran avec un
 * sélecteur de type en tête (Tipologia) et un formulaire dont les champs
 * s'adaptent dynamiquement au type choisi. Les 5 types alignés sur la matrice
 * RH actuelle :
 *
 *  • Congé              → /DemConges               (POST)
 *  • Autorisation sortie → /DemandeAutorisations    (POST)
 *  • Mission            → /Missions                 (POST)
 *  • Note de frais      → /NoteDeFrais/add          (POST, redirection vers
 *                          ExpenseScreen pour la pièce jointe + catégories)
 *  • Heures sup.        → /Autorisers/my-auth       (POST, type "Heures supp"
 *                          marqué via Conmotif — pas d'endpoint dédié backend,
 *                          on réutilise les autorisations qui partagent la
 *                          structure (date + heure début + heure fin))
 *
 * Sur le type "Heures sup.", la maquette demande de préremplir l'heure de début
 * en lisant l'horaire du poste du salarié pour la date choisie (typiquement
 * la fin de sa journée). On récupère `getMyHoraires` au mount et on lit le
 * champ `lunhfam` / `marhfam` / etc. selon le weekday.
 */

type RequestType = 'conge' | 'autorisation' | 'mission' | 'frais' | 'heuressup';

const TYPE_OPTIONS: Array<{
  key: RequestType;
  label: string;
  icon: string;
  description: string;
}> = [
  { key: 'conge',        label: 'Congé',                icon: 'palm-tree',         description: 'Demande de jours de congé' },
  { key: 'autorisation', label: 'Autorisation de sortie', icon: 'exit-run',         description: 'Sortie pendant les heures de travail' },
  { key: 'mission',      label: 'Mission',              icon: 'briefcase-outline', description: 'Déplacement professionnel' },
  { key: 'frais',        label: 'Note de frais',        icon: 'receipt',           description: 'Remboursement d\'une dépense' },
  { key: 'heuressup',    label: 'Heures supplémentaires', icon: 'clock-plus-outline', description: 'Déclaration d\'heures sup.' },
];

// Sous-onglets pour les congés/autorisations façon maquette (Ore / Un giorno / Più giorni).
// Le mode "ore" applique uniquement aux autorisations (horaire dans la journée).
type Span = 'hours' | 'oneday' | 'multidays';

// Durées proposées pour les heures sup, alignées avec ce que la maquette
// montre dans le combo « Durata » (incréments de 30 min, plafond 5h).
const OVERTIME_DURATIONS: Array<{ minutes: number; label: string }> = [
  { minutes: 30,  label: '30 min' },
  { minutes: 60,  label: '1h' },
  { minutes: 90,  label: '1h30' },
  { minutes: 120, label: '2h' },
  { minutes: 150, label: '2h30' },
  { minutes: 180, label: '3h' },
  { minutes: 240, label: '4h' },
  { minutes: 300, label: '5h' },
];

// JS getDay : 0=dim … 6=sam. On convertit en préfixe DTO Horaire pour lire
// l'heure de fin d'après-midi (`lunhfam`, `marhfam`, ...). Voir mobile/
// ScheduleScreen.tsx extractDay() qui suit la même convention.
const DAY_PREFIX: Record<number, string> = {
  0: 'dim', 1: 'lun', 2: 'mar', 3: 'mer', 4: 'jeu', 5: 'ven', 6: 'sam',
};

function trimTime(t?: string | null): string | undefined {
  if (!t) return undefined;
  const m = String(t).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return undefined;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

function pad2(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function formatYMD(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function formatHHMM(d: Date) { return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
function formatDateLong(d: Date) {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}
function parseHHMM(s: string): { h: number; m: number } | null {
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return { h: Number(m[1]), m: Number(m[2]) };
}

export default function AddRequestScreen({ navigation, route }: any) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  // Préselection éventuelle (depuis la grille mensuelle : on passe la date du
  // clic en route param pour préremplir le champ Date).
  const presetDate = route?.params?.presetDate ? new Date(route.params.presetDate) : new Date();
  const presetType = route?.params?.presetType as RequestType | undefined;

  const [type, setType] = useState<RequestType>(presetType ?? 'conge');
  const [typePickerOpen, setTypePickerOpen] = useState(false);

  // Champs communs
  const [span, setSpan] = useState<Span>('oneday');
  const [day, setDay] = useState<Date>(presetDate);
  const [endDay, setEndDay] = useState<Date>(presetDate);
  const [startTime, setStartTime] = useState<Date>(() => {
    const d = new Date(); d.setHours(17, 0, 0, 0); return d;
  });
  const [endTime, setEndTime] = useState<Date>(() => {
    const d = new Date(); d.setHours(18, 0, 0, 0); return d;
  });
  const [notes, setNotes] = useState('');

  // Champs spécifiques
  // Congé / Autorisation : sélection du motif depuis la table Absences.
  const [absenceOptions, setAbsenceOptions] = useState<any[]>([]);
  const [abscod, setAbscod] = useState<string>('');
  // Mission
  const [missionDestination, setMissionDestination] = useState('');
  const [missionObjet, setMissionObjet] = useState('');
  // Frais — on redirige vers ExpenseScreen pour la pièce jointe (RGPD : un upload
  // multipart depuis un écran générique est trop limité). On capture uniquement
  // titre + montant + catégorie pour le quick-add.
  const [fraisTitre, setFraisTitre] = useState('');
  const [fraisMontant, setFraisMontant] = useState('');
  const [fraisCategorie, setFraisCategorie] = useState('Transport');
  // Heures sup — durée sélectionnée (en minutes)
  const [overtimeMinutes, setOvertimeMinutes] = useState<number>(60);
  const [overtimeDurationPickerOpen, setOvertimeDurationPickerOpen] = useState(false);

  // Modals de pickers (date / heure)
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  // Horaires du salarié — chargés en arrière-plan, utilisés pour préremplir
  // l'heure de début sur les heures sup. Si l'employé a plusieurs postes, on
  // prend le premier ; un sélecteur pourrait être ajouté plus tard.
  const [horaireRow, setHoraireRow] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ── Chargement initial ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.soccod || !user?.uticod) return;
      try {
        const [horaires, congeLibs] = await Promise.all([
          apiService.getMyHoraires(user.soccod, user.uticod).catch(() => []),
          apiService.getCongeAbsenceLibs(user.soccod).catch(() => []),
        ]);
        if (cancelled) return;
        const rows = Array.isArray(horaires) ? horaires : [];
        setHoraireRow(rows[0] ?? null);
        setAbsenceOptions(Array.isArray(congeLibs) ? congeLibs : []);
        const firstAbs = Array.isArray(congeLibs) && congeLibs[0];
        if (firstAbs?.abscod) setAbscod(firstAbs.abscod);
      } catch (e) {
        // best-effort : sans horaires le préremplissage HS est désactivé,
        // l'utilisateur peut toujours saisir l'heure manuellement.
      }
    })();
    return () => { cancelled = true; };
  }, [user?.soccod, user?.uticod]);

  // ── Préremplissage de l'heure de début pour les heures sup. ────────────
  // Calcule l'heure naturelle de début (= fin de l'après-midi du poste sur
  // ce jour). Recalculé à chaque changement de date OU de type.
  const overtimeStartFromSchedule = useMemo(() => {
    if (!horaireRow) return null;
    const dayKey = DAY_PREFIX[day.getDay()];
    if (!dayKey) return null;
    // On prend la dernière heure connue du jour, par ordre de priorité :
    // fin d'après-midi > fin de matin > rien.
    const candidates = [
      trimTime(horaireRow[`${dayKey}hfam`]),
      trimTime(horaireRow[`${dayKey}hfmat`]),
    ];
    return candidates.find(Boolean) ?? null;
  }, [horaireRow, day]);

  // Quand l'utilisateur sélectionne le type "Heures sup." OU change la date :
  // si l'heure de début actuelle n'a pas été modifiée manuellement par
  // l'utilisateur, on la cale sur l'heure naturelle de fin du poste.
  const [overtimeStartTouched, setOvertimeStartTouched] = useState(false);
  useEffect(() => {
    if (type !== 'heuressup' || !overtimeStartFromSchedule || overtimeStartTouched) return;
    const parts = parseHHMM(overtimeStartFromSchedule);
    if (!parts) return;
    const d = new Date(day);
    d.setHours(parts.h, parts.m, 0, 0);
    setStartTime(d);
  }, [type, overtimeStartFromSchedule, day, overtimeStartTouched]);

  // ── Soumission ────────────────────────────────────────────────────────
  const validate = (): string | null => {
    if (!user?.soccod || !user?.uticod) return 'Session expirée. Veuillez vous reconnecter.';
    if (type === 'conge' || type === 'autorisation') {
      if (!abscod) return 'Veuillez sélectionner un motif.';
    }
    if (type === 'autorisation' || (type === 'conge' && span === 'hours')) {
      if (endTime <= startTime) return 'L\'heure de fin doit être après l\'heure de début.';
    }
    if (span === 'multidays' && endDay < day) return 'La date de fin doit être après la date de début.';
    if (type === 'mission') {
      if (!missionObjet.trim()) return 'Veuillez préciser l\'objet de la mission.';
      if (endDay < day) return 'La date de fin doit être après la date de début.';
    }
    if (type === 'frais') {
      if (!fraisTitre.trim()) return 'Veuillez saisir un libellé pour la note de frais.';
      const m = Number(String(fraisMontant).replace(',', '.'));
      if (!isFinite(m) || m <= 0) return 'Veuillez saisir un montant valide.';
    }
    if (type === 'heuressup') {
      if (!overtimeMinutes || overtimeMinutes <= 0) return 'Veuillez sélectionner une durée.';
    }
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { Alert.alert('Champ manquant', err); return; }
    if (!user) return;
    setSubmitting(true);

    try {
      if (type === 'conge') {
        const condep = new Date(day);
        const conret = span === 'multidays' ? new Date(endDay) : new Date(day);
        // Pour le congé "Heures" : on borne la journée par les heures de début/fin
        // pour préserver la cohérence avec le moteur de calcul backend.
        if (span === 'hours') {
          condep.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
          conret.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);
        }
        // Concod (clé) délivré par le backend pour éviter la collision multi-employés.
        const next = await apiService.getNextLeaveRequestCode(user.soccod!);
        await apiService.createLeaveRequest({
          concod: next.concod,
          soccod: user.soccod,
          empcod: user.uticod,
          condat: new Date().toISOString(),
          condep: condep.toISOString(),
          conret: conret.toISOString(),
          conjour: span === 'multidays' ? 'P' : '1',
          abscod,
          conmotif: notes || null,
        });
      } else if (type === 'autorisation') {
        const condep = new Date(day);
        const conret = new Date(day);
        condep.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
        conret.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);
        await apiService.createDemandeAutorisation({
          soccod: user.soccod,
          empcod: user.uticod,
          condat: new Date().toISOString(),
          condep: condep.toISOString(),
          conret: conret.toISOString(),
          conjour: '1',
          abscod,
          conmotif: notes || null,
          statut: 'En attente',
        });
      } else if (type === 'mission') {
        await apiService.createMission({
          soccod: user.soccod!,
          empcod: user.uticod!,
          misobj: missionObjet,
          misdest: missionDestination || null,
          misdatedeb: formatYMD(day),
          misdatefin: formatYMD(endDay),
          misnote: notes || null,
          misetat: 'En attente',
          abscod: abscod || 'MISSION',
        });
      } else if (type === 'frais') {
        await apiService.createExpense({
          soccod: user.soccod,
          empcod: user.uticod,
          titre: fraisTitre,
          categorie: fraisCategorie,
          montant: Number(String(fraisMontant).replace(',', '.')),
          devise: 'EUR',
          dateDepense: formatYMD(day),
        });
      } else if (type === 'heuressup') {
        // Pas d'endpoint backend dédié — on utilise /Autorisers/my-auth qui
        // partage la structure (date + heure début + heure fin) et on marque
        // le motif pour que le manager voie « HEURES SUP » dans la liste de
        // validation. À remplacer si un endpoint /Presences/overtime-request
        // est ajouté plus tard.
        const condep = new Date(day);
        condep.setHours(startTime.getHours(), startTime.getMinutes(), 0, 0);
        const conret = new Date(condep.getTime() + overtimeMinutes * 60_000);
        const next = await apiService.getNextLeaveRequestCode(user.soccod!); // partage la séquence concod
        await apiService.createMyAuthorization({
          concod: next.concod,
          soccod: user.soccod,
          empcod: user.uticod,
          condat: new Date().toISOString(),
          condep: condep.toISOString(),
          conret: conret.toISOString(),
          conjour: '1',
          conmotif: `[HEURES SUP] ${notes || `${overtimeMinutes / 60}h`}`,
        });
      }

      Alert.alert('Demande envoyée', 'Votre demande a bien été transmise au manager.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      const msg = e?.response?.data?.message
        ?? e?.response?.data?.error
        ?? e?.message
        ?? 'Échec de l\'envoi de la demande.';
      Alert.alert('Erreur', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const goToFullExpenseForm = () => {
    // Le quick-add note de frais ne gère pas la pièce jointe ; on redirige
    // vers l'écran dédié qui propose la prise photo + galerie.
    navigation.replace('Expense', { presetDate: formatYMD(day) });
  };

  // ── Render ────────────────────────────────────────────────────────────
  const showSpanTabs = type === 'conge' || type === 'autorisation';
  const showAbscod = (type === 'conge' || type === 'autorisation') && absenceOptions.length > 0;
  const showHoursFields = (type === 'autorisation') || (type === 'conge' && span === 'hours');
  const showEndDate = (type === 'mission') || (type === 'conge' && span === 'multidays');
  const isOvertime = type === 'heuressup';
  const selectedType = TYPE_OPTIONS.find(t => t.key === type)!;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Header sticky façon bottom sheet desktop : titre + croix de fermeture */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Ajouter une demande</Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons name="close" size={24} color={COLORS.onSurface} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Sélecteur de type — chip qui ouvre une modale de choix */}
          <Text style={styles.fieldLabel}>Type de demande</Text>
          <TouchableOpacity
            style={styles.typeSelector}
            onPress={() => setTypePickerOpen(true)}
            activeOpacity={0.85}
          >
            <View style={styles.typeIconBox}>
              <MaterialCommunityIcons name={selectedType.icon} size={20} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.typeLabel}>{selectedType.label}</Text>
              <Text style={styles.typeDescription}>{selectedType.description}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-down" size={20} color={COLORS.outline} />
          </TouchableOpacity>

          {/* Sous-onglets Une heure / Un jour / Plusieurs jours (uniquement pour
              congé : autorisation = toujours en heures dans la même journée). */}
          {showSpanTabs && type === 'conge' && (
            <View style={styles.spanTabs}>
              {(['hours', 'oneday', 'multidays'] as Span[]).map(s => {
                const active = span === s;
                const lbl = s === 'hours' ? 'Heures' : s === 'oneday' ? 'Un jour' : 'Plusieurs jours';
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.spanTab, active && styles.spanTabActive]}
                    onPress={() => setSpan(s)}
                  >
                    <Text style={[styles.spanTabText, active && styles.spanTabTextActive]}>{lbl}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Motif (Absence) — congé / autorisation uniquement */}
          {showAbscod && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                {type === 'conge' ? 'Type de congé' : 'Motif'}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.absChipsRow}>
                {absenceOptions.map(o => {
                  const active = o.abscod === abscod;
                  return (
                    <TouchableOpacity
                      key={o.abscod}
                      style={[styles.absChip, active && styles.absChipActive]}
                      onPress={() => setAbscod(o.abscod)}
                    >
                      <Text style={[styles.absChipText, active && styles.absChipTextActive]}>
                        {o.abslib || o.abscod}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Date principale */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              {showEndDate ? 'Date de début' : (isOvertime ? 'Jour' : 'Date')}
            </Text>
            <TouchableOpacity style={styles.inputPlaceholder} onPress={() => setShowDatePicker(true)}>
              <MaterialCommunityIcons name="calendar-outline" size={18} color="#737785" />
              <Text style={styles.inputPlaceholderText}>
                {day ? formatDateLong(day) : 'Choisir le jour'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Date de fin (mission / congé plusieurs jours) */}
          {showEndDate && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Date de fin</Text>
              <TouchableOpacity style={styles.inputPlaceholder} onPress={() => setShowEndDatePicker(true)}>
                <MaterialCommunityIcons name="calendar-outline" size={18} color="#737785" />
                <Text style={styles.inputPlaceholderText}>
                  {endDay ? formatDateLong(endDay) : 'Choisir le jour'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Heure début / fin — autorisation, congé en heures */}
          {showHoursFields && (
            <View style={styles.row}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Heure de début</Text>
                <TouchableOpacity style={styles.inputPlaceholder} onPress={() => setShowStartTimePicker(true)}>
                  <MaterialCommunityIcons name="clock-outline" size={18} color="#737785" />
                  <Text style={styles.inputPlaceholderText}>{formatHHMM(startTime)}</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Heure de fin</Text>
                <TouchableOpacity style={styles.inputPlaceholder} onPress={() => setShowEndTimePicker(true)}>
                  <MaterialCommunityIcons name="clock-outline" size={18} color="#737785" />
                  <Text style={styles.inputPlaceholderText}>{formatHHMM(endTime)}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Heures sup — heure début (préremplie) + durée (combo)
              Conforme à la 2e capture d'écran transmise. */}
          {isOvertime && (
            <View style={styles.row}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Heure de début</Text>
                <TouchableOpacity
                  style={styles.inputPlaceholder}
                  onPress={() => { setOvertimeStartTouched(true); setShowStartTimePicker(true); }}
                >
                  <MaterialCommunityIcons name="clock-outline" size={18} color="#737785" />
                  <Text style={styles.inputPlaceholderText}>{formatHHMM(startTime)}</Text>
                </TouchableOpacity>
                {overtimeStartFromSchedule && !overtimeStartTouched && (
                  <Text style={styles.hintText}>
                    Heure de fin du poste (modifiable)
                  </Text>
                )}
              </View>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>Durée</Text>
                <TouchableOpacity style={styles.inputPlaceholder} onPress={() => setOvertimeDurationPickerOpen(true)}>
                  <MaterialCommunityIcons name="timer-outline" size={18} color="#737785" />
                  <Text style={styles.inputPlaceholderText}>
                    {OVERTIME_DURATIONS.find(d => d.minutes === overtimeMinutes)?.label ?? 'Sélectionner'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Mission — destination + objet */}
          {type === 'mission' && (
            <>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Destination</Text>
                <View style={styles.inputWrap}>
                  <MaterialCommunityIcons name="map-marker-outline" size={18} color="#737785" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Ville, client, site..."
                    value={missionDestination}
                    onChangeText={setMissionDestination}
                    placeholderTextColor="#9ca3af"
                  />
                </View>
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Objet *</Text>
                <View style={styles.inputWrap}>
                  <MaterialCommunityIcons name="text-box-outline" size={18} color="#737785" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Réunion client, formation, audit..."
                    value={missionObjet}
                    onChangeText={setMissionObjet}
                    placeholderTextColor="#9ca3af"
                  />
                </View>
              </View>
            </>
          )}

          {/* Frais — titre + montant + catégorie + lien vers form complet */}
          {type === 'frais' && (
            <>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Libellé *</Text>
                <View style={styles.inputWrap}>
                  <MaterialCommunityIcons name="tag-outline" size={18} color="#737785" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Taxi vers la gare, repas client..."
                    value={fraisTitre}
                    onChangeText={setFraisTitre}
                    placeholderTextColor="#9ca3af"
                  />
                </View>
              </View>
              <View style={styles.row}>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Montant *</Text>
                  <View style={styles.inputWrap}>
                    <MaterialCommunityIcons name="currency-eur" size={18} color="#737785" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="0,00"
                      value={fraisMontant}
                      onChangeText={setFraisMontant}
                      keyboardType="decimal-pad"
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                </View>
                <View style={[styles.fieldGroup, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>Catégorie</Text>
                  <View style={styles.inputWrap}>
                    <MaterialCommunityIcons name="shape-outline" size={18} color="#737785" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Transport"
                      value={fraisCategorie}
                      onChangeText={setFraisCategorie}
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                </View>
              </View>
              <TouchableOpacity onPress={goToFullExpenseForm} style={styles.linkAction}>
                <MaterialCommunityIcons name="paperclip" size={16} color={COLORS.primary} />
                <Text style={styles.linkActionText}>Joindre un justificatif (formulaire complet)</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Notes — toujours visible (équivalent du Note opzionale de la maquette) */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Notes (facultatif)</Text>
            <View style={styles.textareaWrap}>
              <TextInput
                style={styles.textarea}
                placeholder="Saisir un commentaire ou une note"
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>
        </ScrollView>

        {/* Footer — bouton Annuler / Ajouter (sticky comme la maquette) */}
        <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom + 8) }]}>
          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary]}
            onPress={() => navigation.goBack()}
            disabled={submitting}
          >
            <Text style={styles.btnSecondaryText}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnPrimaryText}>Ajouter la demande</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Modal — choix du type */}
      <Modal
        visible={typePickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setTypePickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Type de demande</Text>
            {TYPE_OPTIONS.map(opt => {
              const active = opt.key === type;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.typeOption, active && styles.typeOptionActive]}
                  onPress={() => {
                    setType(opt.key);
                    // Reset onglet aux valeurs par défaut quand on change de type.
                    if (opt.key === 'conge') setSpan('oneday');
                    setTypePickerOpen(false);
                  }}
                >
                  <View style={styles.typeIconBoxLg}>
                    <MaterialCommunityIcons name={opt.icon} size={22} color={active ? '#fff' : COLORS.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.typeOptionLabel, active && { color: '#fff' }]}>{opt.label}</Text>
                    <Text style={[styles.typeOptionDesc, active && { color: 'rgba(255,255,255,0.85)' }]}>
                      {opt.description}
                    </Text>
                  </View>
                  {active && <MaterialCommunityIcons name="check" size={20} color="#fff" />}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.modalClose} onPress={() => setTypePickerOpen(false)}>
              <Text style={styles.modalCloseText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal — durée heures sup */}
      <Modal
        visible={overtimeDurationPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setOvertimeDurationPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Durée</Text>
            <View style={styles.durationsGrid}>
              {OVERTIME_DURATIONS.map(d => {
                const active = d.minutes === overtimeMinutes;
                return (
                  <TouchableOpacity
                    key={d.minutes}
                    style={[styles.durationChip, active && styles.durationChipActive]}
                    onPress={() => { setOvertimeMinutes(d.minutes); setOvertimeDurationPickerOpen(false); }}
                  >
                    <Text style={[styles.durationChipText, active && styles.durationChipTextActive]}>
                      {d.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* Pickers date / heure (modaux maison déjà utilisés ailleurs dans l'app) */}
      <DatePickerModal
        visible={showDatePicker}
        value={day}
        onChange={setDay}
        onClose={() => setShowDatePicker(false)}
        title="Choisir la date"
      />
      <DatePickerModal
        visible={showEndDatePicker}
        value={endDay}
        onChange={setEndDay}
        onClose={() => setShowEndDatePicker(false)}
        title="Date de fin"
      />
      <TimePickerModal
        visible={showStartTimePicker}
        value={startTime}
        onChange={(t) => { setStartTime(t); if (isOvertime) setOvertimeStartTouched(true); }}
        onClose={() => setShowStartTimePicker(false)}
        title="Heure de début"
      />
      <TimePickerModal
        visible={showEndTimePicker}
        value={endTime}
        onChange={setEndTime}
        onClose={() => setShowEndTimePicker(false)}
        title="Heure de fin"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.onSurface, letterSpacing: -0.2 },

  scrollContent: { padding: 20, paddingBottom: 24, gap: 4 },

  fieldGroup: { marginTop: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 },
  hintText: { fontSize: 11, color: COLORS.outline, marginTop: 4, fontStyle: 'italic' },

  row: { flexDirection: 'row', gap: 12 },

  // ── Sélecteur de type principal (chip ouvrant la modale) ───────────────
  typeSelector: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 12,
    marginTop: 6,
  },
  typeIconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.primaryFixed,
    justifyContent: 'center', alignItems: 'center',
  },
  typeLabel: { fontSize: 14, fontWeight: '800', color: COLORS.onSurface },
  typeDescription: { fontSize: 11, color: COLORS.outline, marginTop: 2 },

  // ── Sous-onglets (Heures / Un jour / Plusieurs jours) ──────────────────
  spanTabs: {
    flexDirection: 'row',
    marginTop: 14,
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  spanTab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  spanTabActive: { borderBottomColor: COLORS.primary },
  spanTabText: { fontSize: 13, fontWeight: '600', color: COLORS.outline },
  spanTabTextActive: { color: COLORS.onSurface, fontWeight: '800' },

  // ── Champs date / heure (placeholder cliquable, ouvre les pickers) ─────
  inputPlaceholder: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, height: 44,
    backgroundColor: '#f8fafc',
    borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 10,
  },
  inputPlaceholderText: { fontSize: 14, color: '#0f172a', fontWeight: '600' },

  // ── Champs texte ───────────────────────────────────────────────────────
  inputWrap: {
    position: 'relative',
    backgroundColor: '#f8fafc',
    borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 10,
  },
  inputIcon: {
    position: 'absolute', left: 12, top: 0, bottom: 0,
    height: 44, lineHeight: 44, textAlignVertical: 'center',
  },
  input: { height: 44, paddingLeft: 38, paddingRight: 12, fontSize: 14, color: '#0f172a', fontWeight: '500' },

  textareaWrap: {
    backgroundColor: '#f8fafc',
    borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 10,
  },
  textarea: { fontSize: 14, color: '#0f172a', minHeight: 88 },

  // ── Chips de motif (abscod) ────────────────────────────────────────────
  absChipsRow: { gap: 8, paddingRight: 8 },
  absChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: '#f1f5f9', borderRadius: 20,
    borderWidth: 1, borderColor: 'transparent',
  },
  absChipActive: { backgroundColor: COLORS.primaryFixed, borderColor: COLORS.primary },
  absChipText: { fontSize: 12, fontWeight: '600', color: COLORS.onSurfaceVariant },
  absChipTextActive: { color: COLORS.primary, fontWeight: '800' },

  linkAction: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  linkActionText: { color: COLORS.primary, fontSize: 13, fontWeight: '700' },

  // ── Footer sticky ──────────────────────────────────────────────────────
  footer: {
    flexDirection: 'row', gap: 10,
    paddingHorizontal: 20, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  btn: { flex: 1, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  btnSecondary: { backgroundColor: '#f1f5f9' },
  btnSecondaryText: { color: COLORS.onSurface, fontWeight: '700', fontSize: 14 },
  btnPrimary: { backgroundColor: '#0f172a' },
  btnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  // ── Modal sélecteur de type ───────────────────────────────────────────
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24,
    maxHeight: '80%',
  },
  modalHandle: { alignSelf: 'center', width: 40, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, marginBottom: 12 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: COLORS.onSurface, marginBottom: 12 },
  typeOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 12, paddingVertical: 12,
    borderRadius: 12, marginBottom: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1, borderColor: '#e2e8f0',
  },
  typeOptionActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeIconBoxLg: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: COLORS.primaryFixed,
    justifyContent: 'center', alignItems: 'center',
  },
  typeOptionLabel: { fontSize: 14, fontWeight: '800', color: COLORS.onSurface },
  typeOptionDesc: { fontSize: 11, color: COLORS.outline, marginTop: 2 },
  modalClose: { alignSelf: 'center', marginTop: 6, padding: 10 },
  modalCloseText: { color: COLORS.outline, fontWeight: '700' },

  // ── Modal durée HS ────────────────────────────────────────────────────
  durationsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  durationChip: {
    paddingHorizontal: 18, paddingVertical: 12,
    backgroundColor: '#f1f5f9', borderRadius: 12,
    borderWidth: 1, borderColor: 'transparent',
    minWidth: 80, alignItems: 'center',
  },
  durationChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  durationChipText: { fontSize: 14, fontWeight: '700', color: COLORS.onSurface },
  durationChipTextActive: { color: '#ffffff' },
});
