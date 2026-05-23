import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Modal, Alert, ActivityIndicator, RefreshControl, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { COLORS, API_BASE_URL } from '../config/env';
import apiService from '../services/api';
import DatePickerModal from '../components/DatePickerModal';
import BottomTabBar, { useTabBarPadding } from '../components/BottomTabBar';

/**
 * Écran « Mes demandes d'absence » côté mobile.
 *
 * Flow optimal : (1) l'utilisateur prend en photo son justificatif (ou choisit un
 * PDF dans ses documents) → (2) l'IA pré-remplit dates + motif → (3) l'utilisateur
 * vérifie et soumet. Le fichier est envoyé dans la même requête (multipart) que
 * la demande, pas d'upload séparé.
 */
type Status = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';

interface AbsenceRequest {
  id: number;
  empcod: string | null;
  employeeName: string | null;
  requestedAt: string;
  startDate: string;
  endDate: string;
  daysCount: number | null;
  abscod: string | null;
  absenceLabel: string | null;
  reason: string | null;
  justificationUrl: string | null;
  justificationFilename: string | null;
  status: Status;
  decidedBy: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  decisionComment: string | null;
}

interface PickedFile { uri: string; name: string; type: string; size?: number }

const STATUS_LABEL: Record<Status, string> = {
  Pending: 'En attente',
  Approved: 'Acceptée',
  Rejected: 'Refusée',
  Cancelled: 'Annulée',
};
const STATUS_COLOR: Record<Status, { bg: string; fg: string }> = {
  Pending:   { bg: '#fef9c3', fg: '#854d0e' },
  Approved:  { bg: '#dcfce7', fg: '#166534' },
  Rejected:  { bg: '#fee2e2', fg: '#991b1b' },
  Cancelled: { bg: '#e2e8f0', fg: '#475569' },
};

const fmt = (iso?: string | null) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso; }
};

const isoDate = (d: Date) => d.toISOString().split('T')[0];

export default function DemandeAbsenceScreen({ navigation }: any) {
  const tabBarPadding = useTabBarPadding();
  const [items, setItems] = useState<AbsenceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const today = new Date();
  const [startDate, setStartDate] = useState<Date>(today);
  const [endDate, setEndDate] = useState<Date>(today);
  const [reason, setReason] = useState('');
  const [file, setFile] = useState<PickedFile | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanInfo, setScanInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiService.listMyAbsenceRequests();
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      if (e?.response?.status !== 401 && e?.response?.status !== 402) {
        console.log('Failed to load absence requests:', e);
      }
      setItems([]);
    }
  }, []);

  useEffect(() => {
    (async () => { setLoading(true); await load(); setLoading(false); })();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const resetForm = () => {
    const t = new Date();
    setStartDate(t);
    setEndDate(t);
    setReason('');
    setFile(null);
    setScanInfo(null);
  };

  // ──────────────────────────────────────────────────────────────────────
  // Sélection du justificatif : 3 sources possibles (photo caméra, photo
  // galerie, document PDF). On affiche un ActionSheet via Alert pour laisser
  // le choix à l'utilisateur, c'est la convention iOS la plus simple.
  // ──────────────────────────────────────────────────────────────────────
  const pickJustification = () => {
    Alert.alert(
      'Joindre un justificatif',
      "Choisissez la source du document :",
      [
        { text: 'Photo / Appareil', onPress: takePhoto },
        { text: 'Galerie', onPress: pickFromGallery },
        { text: 'Document (PDF)', onPress: pickDocument },
        { text: 'Annuler', style: 'cancel' },
      ]
    );
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission requise', 'Autorisez l\'accès à l\'appareil photo dans les réglages.'); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (result.canceled) return;
    const asset = result.assets[0];
    handleFileSelected({
      uri: asset.uri,
      name: asset.fileName ?? `photo-${Date.now()}.jpg`,
      type: asset.mimeType ?? 'image/jpeg',
      size: asset.fileSize,
    });
  };

  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission requise', 'Autorisez l\'accès à la galerie dans les réglages.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (result.canceled) return;
    const asset = result.assets[0];
    handleFileSelected({
      uri: asset.uri,
      name: asset.fileName ?? `image-${Date.now()}.jpg`,
      type: asset.mimeType ?? 'image/jpeg',
      size: asset.fileSize,
    });
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    handleFileSelected({
      uri: asset.uri,
      name: asset.name,
      type: asset.mimeType ?? 'application/octet-stream',
      size: asset.size,
    });
  };

  /**
   * Une fois le fichier sélectionné, on déclenche immédiatement le scan IA
   * pour pré-remplir le formulaire. Pattern identique au web — cf.
   * DemandeAbsenceModern.handleFilePick.
   */
  const handleFileSelected = async (picked: PickedFile) => {
    setFile(picked);
    setScanInfo(null);
    setScanLoading(true);
    try {
      const data = await apiService.scanAbsenceJustification(picked);
      if (data?.success && data.extractedData) {
        const ext = data.extractedData;
        if (ext.startDate) {
          const d = new Date(ext.startDate);
          if (!isNaN(d.getTime())) setStartDate(d);
        }
        if (ext.endDate) {
          const d = new Date(ext.endDate);
          if (!isNaN(d.getTime())) setEndDate(d);
        }
        if (ext.reason) setReason(String(ext.reason).slice(0, 1000));
        setScanInfo(data.message ?? 'Justificatif analysé.');
      } else if (data?.message) {
        setScanInfo(data.message);
      }
    } catch (e: any) {
      if (e?.response?.status === 402) {
        setScanInfo("Le scan IA n'est pas inclus dans votre pack. Vous pouvez quand même soumettre la demande.");
      } else {
        setScanInfo("Analyse automatique indisponible — complétez le formulaire manuellement.");
      }
    } finally {
      setScanLoading(false);
    }
  };

  const submit = async () => {
    if (endDate < startDate) {
      Alert.alert('Dates invalides', 'La date de fin doit être ≥ à la date de début.');
      return;
    }
    setSubmitting(true);
    try {
      await apiService.createAbsenceRequest({
        startDate: isoDate(startDate),
        endDate: isoDate(endDate),
        reason: reason.trim() || null,
        file,
      });
      Alert.alert('✅ Demande envoyée', 'Votre manager sera notifié.');
      setShowForm(false);
      resetForm();
      await load();
    } catch (e: any) {
      const msg = e?.response?.data?.error ?? 'Impossible d\'envoyer la demande.';
      Alert.alert('Erreur', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmCancel = (item: AbsenceRequest) => {
    Alert.alert(
      "Annuler la demande",
      `Annuler la demande d'absence du ${fmt(item.startDate)} au ${fmt(item.endDate)} ?`,
      [
        { text: 'Garder', style: 'cancel' },
        {
          text: 'Annuler la demande',
          style: 'destructive',
          onPress: async () => {
            try { await apiService.cancelAbsenceRequest(item.id); await load(); }
            catch (e: any) { Alert.alert('Erreur', e?.response?.data?.error ?? 'Impossible d\'annuler.'); }
          },
        },
      ]
    );
  };

  const openJustification = (it: AbsenceRequest) => {
    if (!it.justificationUrl) return;
    // L'URL retournée par le backend est relative (/api/uploads/...). On la
    // préfixe par le baseURL pour la rendre absolue dans le navigateur système.
    const absolute = it.justificationUrl.startsWith('http')
      ? it.justificationUrl
      : API_BASE_URL.replace(/\/api$/, '') + it.justificationUrl;
    Linking.openURL(absolute).catch(() => Alert.alert('Erreur', 'Impossible d\'ouvrir le fichier.'));
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Mes demandes d'absence</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: tabBarPadding + 80 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {items.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons name="hospital-box-outline" size={48} color="#94a3b8" />
            <Text style={styles.emptyTitle}>Aucune demande d'absence</Text>
            <Text style={styles.emptySub}>Touchez « Nouvelle demande » pour en créer une avec justificatif.</Text>
          </View>
        ) : items.map((it) => {
          const c = STATUS_COLOR[it.status];
          return (
            <View key={it.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.badge, { backgroundColor: c.bg }]}>
                  <Text style={[styles.badgeText, { color: c.fg }]}>{STATUS_LABEL[it.status]}</Text>
                </View>
                {it.absenceLabel && <Text style={styles.typeText}>{it.absenceLabel}</Text>}
              </View>
              <Text style={styles.datesText}>
                Du <Text style={styles.bold}>{fmt(it.startDate)}</Text> au <Text style={styles.bold}>{fmt(it.endDate)}</Text>
              </Text>
              {!!it.reason && <Text style={styles.reasonText}>« {it.reason} »</Text>}
              {!!it.justificationUrl && (
                <TouchableOpacity style={styles.fileLink} onPress={() => openJustification(it)}>
                  <MaterialCommunityIcons name="paperclip" size={16} color={COLORS.primary} />
                  <Text style={styles.fileLinkText}>{it.justificationFilename ?? 'Justificatif'}</Text>
                </TouchableOpacity>
              )}
              {it.status === 'Rejected' && !!it.decisionComment && (
                <View style={[styles.alertBox, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
                  <Text style={[styles.alertText, { color: '#991b1b' }]}>Motif du refus : {it.decisionComment}</Text>
                </View>
              )}
              {it.status === 'Approved' && !!it.decisionComment && (
                <View style={[styles.alertBox, { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }]}>
                  <Text style={[styles.alertText, { color: '#166534' }]}>{it.decisionComment}</Text>
                </View>
              )}
              <Text style={styles.metaText}>Soumise le {fmt(it.requestedAt)}</Text>
              {it.status === 'Pending' && (
                <TouchableOpacity style={styles.cancelBtn} onPress={() => confirmCancel(it)}>
                  <MaterialCommunityIcons name="close-circle-outline" size={18} color="#991b1b" />
                  <Text style={styles.cancelBtnText}>Annuler ma demande</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>

      <TouchableOpacity style={[styles.fab, { bottom: tabBarPadding + 16 }]} onPress={() => { resetForm(); setShowForm(true); }}>
        <MaterialCommunityIcons name="plus" size={26} color="#fff" />
        <Text style={styles.fabText}>Nouvelle demande</Text>
      </TouchableOpacity>

      {/* Formulaire */}
      <Modal visible={showForm} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowForm(false)}>
        <SafeAreaView style={styles.container}>
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => setShowForm(false)} style={styles.iconBtn}>
              <MaterialCommunityIcons name="close" size={24} color={COLORS.primary} />
            </TouchableOpacity>
            <Text style={styles.topTitle}>Nouvelle demande d'absence</Text>
            <View style={{ width: 32 }} />
          </View>
          <ScrollView contentContainerStyle={styles.scroll}>
            {/* Bloc scan IA — placé en premier pour matérialiser le workflow
                recommandé : on scanne d'abord, le formulaire se remplit. */}
            <View style={styles.aiCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <MaterialCommunityIcons name="auto-fix" size={20} color="#0040a1" />
                <Text style={styles.aiCardTitle}>Scanner avec l'IA (recommandé)</Text>
              </View>
              <Text style={styles.aiCardSub}>
                Prenez en photo votre certificat médical ou choisissez un PDF. L'IA pré-remplit les champs.
              </Text>
              <TouchableOpacity style={[styles.scanBtn, scanLoading && { opacity: 0.6 }]} disabled={scanLoading} onPress={pickJustification}>
                {scanLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <>
                      <MaterialCommunityIcons name="camera" size={18} color="#fff" />
                      <Text style={styles.scanBtnText}>{file ? 'Changer le justificatif' : 'Scanner / choisir un fichier'}</Text>
                    </>}
              </TouchableOpacity>
              {!!file && (
                <Text style={styles.fileName}>📎 {file.name}</Text>
              )}
              {!!scanInfo && (
                <View style={[styles.alertBox, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe', marginTop: 8 }]}>
                  <Text style={[styles.alertText, { color: '#1e40af' }]}>{scanInfo}</Text>
                </View>
              )}
            </View>

            <View style={styles.formField}>
              <Text style={styles.label}>Date de début</Text>
              <TouchableOpacity style={styles.dateField} onPress={() => setShowStartPicker(true)}>
                <MaterialCommunityIcons name="calendar" size={20} color={COLORS.primary} />
                <Text style={styles.dateText}>{fmt(startDate.toISOString())}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.formField}>
              <Text style={styles.label}>Date de fin</Text>
              <TouchableOpacity style={styles.dateField} onPress={() => setShowEndPicker(true)}>
                <MaterialCommunityIcons name="calendar-check" size={20} color={COLORS.primary} />
                <Text style={styles.dateText}>{fmt(endDate.toISOString())}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.formField}>
              <Text style={styles.label}>Motif</Text>
              <TextInput
                style={styles.textarea}
                value={reason}
                onChangeText={(t) => setReason(t.slice(0, 1000))}
                placeholder="Ex : arrêt maladie 3 jours, consultation Dr. X…"
                placeholderTextColor="#94a3b8"
                multiline numberOfLines={4}
              />
              <Text style={styles.charCount}>{reason.length}/1000</Text>
            </View>

            <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.6 }]} disabled={submitting} onPress={submit}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>Soumettre la demande</Text>}
            </TouchableOpacity>
          </ScrollView>

          <DatePickerModal visible={showStartPicker} value={startDate} onClose={() => setShowStartPicker(false)} onChange={(d: Date) => { setStartDate(d); if (endDate < d) setEndDate(d); }} />
          <DatePickerModal visible={showEndPicker} value={endDate} onClose={() => setShowEndPicker(false)} onChange={(d: Date) => setEndDate(d)} />
        </SafeAreaView>
      </Modal>

      <BottomTabBar navigation={navigation} active="requests" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, textAlign: 'center', fontWeight: '700', fontSize: 16, color: '#0f172a' },
  scroll: { padding: 16, gap: 12 },
  emptyCard: { padding: 24, alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', borderStyle: 'dashed', marginTop: 24, gap: 6 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#475569', marginTop: 4 },
  emptySub: { fontSize: 13, color: '#94a3b8', textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  typeText: { fontSize: 12, color: '#0040a1', fontWeight: '700' },
  datesText: { fontSize: 14, color: '#0f172a' },
  bold: { fontWeight: '700' },
  reasonText: { fontSize: 13, color: '#64748b', fontStyle: 'italic', marginTop: 4 },
  fileLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  fileLinkText: { color: COLORS.primary, fontWeight: '600', fontSize: 13, textDecorationLine: 'underline' },
  alertBox: { borderWidth: 1, borderRadius: 8, padding: 8, marginTop: 8 },
  alertText: { fontSize: 12 },
  metaText: { fontSize: 11, color: '#94a3b8', marginTop: 8 },
  cancelBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, marginTop: 10, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' },
  cancelBtnText: { color: '#991b1b', fontWeight: '600', fontSize: 13 },
  fab: { position: 'absolute', right: 16, backgroundColor: COLORS.primary, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 6, elevation: 4, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  aiCard: { borderRadius: 12, padding: 14, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderStyle: 'dashed', marginBottom: 18 },
  aiCardTitle: { fontWeight: '700', color: '#0040a1', fontSize: 14 },
  aiCardSub: { fontSize: 12, color: '#1e40af', marginBottom: 10 },
  scanBtn: { backgroundColor: COLORS.primary, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  scanBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  fileName: { marginTop: 8, fontSize: 12, color: '#0f172a' },
  formField: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 6 },
  dateField: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  dateText: { fontSize: 15, color: '#0f172a' },
  textarea: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', padding: 12, minHeight: 96, textAlignVertical: 'top', color: '#0f172a' },
  charCount: { fontSize: 11, color: '#94a3b8', textAlign: 'right', marginTop: 4 },
  submitBtn: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 12 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
