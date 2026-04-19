import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import { COLORS } from '../config/env';

interface VaultDocument {
  id?: number;
  docName?: string;
  docType?: string;
  docPath?: string;
  docDate?: string;
  docSize?: number;
  isSigned?: boolean;
  signatureDate?: string;
  status?: string;
  soccod?: string;
  empcod?: string;
}

const DOC_ICONS: Record<string, string> = {
  contrat: '📄', attestation: '📋', medical: '🏥', identite: '🪪',
  formation: '🎓', bulletin: '💵', lettre: '✉️', other: '📎',
};

const DOC_TYPES = ['Contrat', 'Attestation', 'Visite Médicale', 'Identité', 'Formation', 'Bulletin de paie', 'Autre'];

export default function DigitalVaultScreen({ navigation, route }: any) {
  const { user, isAdmin, isManager } = useAuth();
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Admin can view employee documents via route params
  const targetEmpcod = route?.params?.empcod || user?.uticod;
  const targetSoccod = route?.params?.soccod || user?.soccod;
  const targetEmpName = route?.params?.empName || '';
  const isAdminView = (isAdmin || isManager) && route?.params?.empcod && route.params.empcod !== user?.uticod;

  useEffect(() => { loadDocuments(); }, [user, targetEmpcod]);

  const loadDocuments = async () => {
    if (!targetSoccod || !targetEmpcod) return;
    try {
      const data = await apiService.getVaultDocuments(targetSoccod, targetEmpcod);
      setDocuments(Array.isArray(data) ? data : data ? [data] : []);
    } catch (e) {
      // Fallback to contracts endpoint
      try {
        const data = await apiService.getMyContracts(user!.soccod!, user!.uticod!);
        setDocuments(Array.isArray(data) ? data : data ? [data] : []);
      } catch (e2) { console.log('Documents load error:', e2); }
    } finally { setLoading(false); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadDocuments(); setRefreshing(false); };

  const handleUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;

      const file = result.assets[0];
      Alert.alert('Type de document', 'Sélectionnez le type:', [
        { text: 'Contrat', onPress: () => doUpload(file.uri, 'Contrat') },
        { text: 'Attestation', onPress: () => doUpload(file.uri, 'Attestation') },
        { text: 'Visite Médicale', onPress: () => doUpload(file.uri, 'Visite Médicale') },
        { text: 'Autre', onPress: () => doUpload(file.uri, 'Autre') },
        { text: 'Annuler', style: 'cancel' },
      ]);
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de sélectionner le fichier');
    }
  };

  const doUpload = async (fileUri: string, docType: string) => {
    if (!targetSoccod || !targetEmpcod) return;
    setUploading(true);
    try {
      await apiService.uploadVaultDocument(fileUri, targetSoccod, targetEmpcod, docType);
      Alert.alert('✅ Succès', 'Document uploaded avec succès');
      loadDocuments();
    } catch (e) {
      Alert.alert('Erreur', 'Impossible d\'uploader le document');
    } finally { setUploading(false); }
  };

  const handleSign = (doc: VaultDocument) => {
    if (!doc.id) return;
    const signerName = user?.utilib || 'Admin';
    const confirmMsg = isAdminView
      ? `Signer le document de ${targetEmpName || targetEmpcod} en tant que ${signerName} ?`
      : 'Voulez-vous signer ce document électroniquement ?';
    Alert.alert('✍️ Signature électronique', confirmMsg, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: '✍️ Signer', onPress: async () => {
          try {
            await apiService.signVaultDocument(doc.id!, `admin_signature_${user?.uticod || 'unknown'}`, signerName);
            Alert.alert('✅ Succès', 'Document signé électroniquement');
            loadDocuments();
          } catch { Alert.alert('Erreur', 'Impossible de signer le document'); }
        }
      },
    ]);
  };

  const handleDelete = (doc: VaultDocument) => {
    if (!doc.id) return;
    Alert.alert('Supprimer', `Supprimer "${doc.docName}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive', onPress: async () => {
          try {
            await apiService.deleteVaultDocument(doc.id!);
            loadDocuments();
          } catch { Alert.alert('Erreur', 'Impossible de supprimer'); }
        }
      },
    ]);
  };

  const getDocIcon = (doc: VaultDocument) => {
    const type = (doc.docType || doc.docName || '').toLowerCase();
    if (type.includes('contrat')) return DOC_ICONS.contrat;
    if (type.includes('attestation')) return DOC_ICONS.attestation;
    if (type.includes('medical') || type.includes('visite')) return DOC_ICONS.medical;
    if (type.includes('ident') || type.includes('cin')) return DOC_ICONS.identite;
    if (type.includes('formation')) return DOC_ICONS.formation;
    if (type.includes('bulletin') || type.includes('paie')) return DOC_ICONS.bulletin;
    if (type.includes('lettre')) return DOC_ICONS.lettre;
    return DOC_ICONS.other;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / 1048576).toFixed(1)} Mo`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    );
  }

  const signedCount = documents.filter(d => d.isSigned).length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{isAdminView ? `Coffre - ${targetEmpName || targetEmpcod}` : 'Coffre Numérique'}</Text>
        <TouchableOpacity onPress={handleUpload} disabled={uploading || isAdminView}>
          <Text style={styles.addBtn}>{uploading ? '⏳' : isAdminView ? '👁️ Lecture' : '+ Upload'}</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statChip}>
          <Text style={styles.statChipText}>📁 {documents.length} documents</Text>
        </View>
        <View style={[styles.statChip, { backgroundColor: '#e8f5e9' }]}>
          <Text style={[styles.statChipText, { color: COLORS.success }]}>✅ {signedCount} signés</Text>
        </View>
      </View>

      {uploading && (
        <View style={styles.uploadBanner}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.uploadBannerText}>Upload en cours...</Text>
        </View>
      )}

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16 }}>
        {documents.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔒</Text>
            <Text style={styles.emptyText}>Aucun document dans votre coffre</Text>
            <Text style={styles.emptySubText}>Appuyez sur "+ Upload" pour ajouter un document</Text>
          </View>
        ) : (
          documents.map((doc: VaultDocument, i: number) => (
            <View key={i} style={styles.docCard}>
              <View style={styles.docLeft}>
                <View style={styles.docIconContainer}>
                  <Text style={styles.docIcon}>{getDocIcon(doc)}</Text>
                </View>
                <View style={styles.docInfo}>
                  <Text style={styles.docTitle}>{doc.docName || `Document ${i + 1}`}</Text>
                  <Text style={styles.docType}>{doc.docType || 'Document'}</Text>
                  <View style={styles.docMeta}>
                    {doc.docDate && (
                      <Text style={styles.docDate}>{doc.docDate?.split('T')[0]}</Text>
                    )}
                    {doc.docSize ? (
                      <Text style={styles.docSize}>{formatFileSize(doc.docSize)}</Text>
                    ) : null}
                  </View>
                </View>
              </View>
              <View style={styles.docActions}>
                {doc.isSigned ? (
                  <View style={styles.signedBadge}>
                    <Text style={styles.signedText}>✓ Signé</Text>
                  </View>
                ) : doc.id ? (
                  <TouchableOpacity style={styles.signBtn} onPress={() => handleSign(doc)}>
                    <Text style={styles.signBtnText}>✍️</Text>
                  </TouchableOpacity>
                ) : null}
                {doc.id ? (
                  <TouchableOpacity onPress={() => handleDelete(doc)} style={styles.deleteSmallBtn}>
                    <Text style={styles.deleteSmallText}>🗑️</Text>
                  </TouchableOpacity>
                ) : null}
                <Text style={styles.docArrow}>›</Text>
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, backgroundColor: '#fff', elevation: 2,
  },
  backBtn: { fontSize: 16, color: COLORS.primary, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, flex: 1, marginLeft: 12 },
  addBtn: { fontSize: 14, color: COLORS.primary, fontWeight: 'bold' },
  statsRow: { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: '#fff', paddingBottom: 8 },
  statChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#e3f2fd',
  },
  statChipText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  uploadBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.primary, padding: 8, gap: 8,
  },
  uploadBannerText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: COLORS.textSecondary },
  emptySubText: { fontSize: 13, color: COLORS.disabled, marginTop: 4, textAlign: 'center' },
  docCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2,
  },
  docLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  docIconContainer: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#f0f4ff',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  docIcon: { fontSize: 22 },
  docInfo: { flex: 1 },
  docTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  docType: { fontSize: 11, color: COLORS.primary, marginTop: 2 },
  docMeta: { flexDirection: 'row', gap: 8, marginTop: 3 },
  docDate: { fontSize: 10, color: COLORS.textSecondary },
  docSize: { fontSize: 10, color: COLORS.textSecondary },
  docActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  signedBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
    backgroundColor: '#e8f5e9',
  },
  signedText: { fontSize: 10, fontWeight: '600', color: COLORS.success },
  signBtn: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: '#fff3e0',
    justifyContent: 'center', alignItems: 'center',
  },
  signBtnText: { fontSize: 14 },
  deleteSmallBtn: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#ffebee',
    justifyContent: 'center', alignItems: 'center',
  },
  deleteSmallText: { fontSize: 12 },
  docArrow: { fontSize: 20, color: COLORS.disabled, marginLeft: 4 },
});