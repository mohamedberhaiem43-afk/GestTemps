import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert, ActivityIndicator, TextInput, Dimensions, Image, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import { COLORS, THEME, API_BASE_URL } from '../config/env';
import { useSecureScreen } from '../hooks/useSecureScreen';
import { useI18n } from '../i18n';

const { width } = Dimensions.get('window');

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

const CATEGORIES = [
  { id: 'all', labelKey: 'vault.categoryAll', icon: 'infinity' },
  { id: 'bulletin', labelKey: 'vault.categoryPayslips', icon: 'cash-multiple' },
  { id: 'contrat', labelKey: 'vault.categoryContracts', icon: 'file-document-outline' },
];

export default function DigitalVaultScreen({ navigation, route }: any) {
  // SEC-G4 : bulletins de paie + contrats = données très sensibles → screenshot/recording
  // bloqué (Android FLAG_SECURE) ou alerté (iOS).
  useSecureScreen();
  const { user, isAdmin, isManager } = useAuth();
  const { t, lang } = useI18n();
  const locale = lang === 'en' ? 'en-GB' : 'fr-FR';
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // La catégorie par défaut peut être pré-sélectionnée depuis le navigateur
  // (ex : raccourci "Bulletin de paie" du HomeScreen → category=bulletin pour
  // ouvrir directement la vue filtrée et éviter le scroll). Si le param change
  // après ouverture (cas rare avec react-navigation), on resync.
  const initialCategory =
    typeof route?.params?.category === 'string' && CATEGORIES.some(c => c.id === route.params.category)
      ? route.params.category
      : 'all';
  const [activeCategory, setActiveCategory] = useState(initialCategory);

  useEffect(() => {
    const c = route?.params?.category;
    if (typeof c === 'string' && CATEGORIES.some(cat => cat.id === c)) setActiveCategory(c);
  }, [route?.params?.category]);

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
      console.log('Documents load error:', e);
      setDocuments([]);
    } finally { setLoading(false); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadDocuments(); setRefreshing(false); };

  // Étape 1 : choix de la source — caméra (prise immédiate, idéal certificat
  // médical), galerie (photo déjà prise), ou fichier (PDF, scan).
  const handleUpload = () => {
    Alert.alert(
      t('vault.addDocument'),
      t('vault.howToImport'),
      [
        { text: t('vault.takePhoto'), onPress: pickFromCamera },
        { text: t('vault.chooseFromGallery'), onPress: pickFromGallery },
        { text: t('vault.chooseFile'), onPress: pickFromFiles },
        { text: t('common.cancel'), style: 'cancel' },
      ]
    );
  };

  const pickFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('vault.cameraAccess'), t('vault.cameraPermissionRequired'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      // qualité 0.7 : compromis lisibilité/poids pour limiter la bande passante
      // sur les uploads 4G où un certificat 4 Mo peut prendre 30 s.
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) askDocumentType(result.assets[0].uri);
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) askDocumentType(result.assets[0].uri);
  };

  const pickFromFiles = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;
      askDocumentType(result.assets[0].uri);
    } catch (e) {
      Alert.alert(t('common.error'), t('vault.cannotSelectFile'));
    }
  };

  // Étape 2 : catégorisation. Réutilise la liste de types déjà côté backend
  // (Contrat, Bulletin de paie, Attestation, Autre, plus deux types employé
  // typiques : Certificat médical et Pièce d'identité, utiles depuis mobile).
  const askDocumentType = (uri: string) => {
    Alert.alert(t('vault.documentType'), t('vault.selectType'), [
      { text: t('vault.medicalCertificate'), onPress: () => doUpload(uri, 'Certificat médical') },
      { text: t('vault.idDocument'), onPress: () => doUpload(uri, 'Pièce d\'identité') },
      { text: t('vault.attestation'), onPress: () => doUpload(uri, 'Attestation') },
      { text: t('vault.other'), onPress: () => doUpload(uri, 'Autre') },
      { text: t('common.cancel'), style: 'cancel' },
    ]);
  };

  const doUpload = async (fileUri: string, docType: string) => {
    if (!targetSoccod || !targetEmpcod) return;
    setUploading(true);
    try {
      await apiService.uploadVaultDocument(fileUri, targetSoccod, targetEmpcod, docType);
      Alert.alert(t('vault.successTitle'), t('vault.uploadSuccess'));
      loadDocuments();
    } catch (e) {
      Alert.alert(t('common.error'), t('vault.uploadError'));
    } finally { setUploading(false); }
  };

  // Politique : on n'autorise la suppression QUE pour les documents non signés.
  // Un employé peut supprimer ses propres documents (uploadés par erreur).
  // Un manager/admin en vue admin (sur l'employé d'un autre) peut aussi nettoyer.
  // Un document signé représente un engagement et doit suivre un processus
  // d'archivage côté admin web — on bloque la suppression mobile dans ce cas.
  const canDeleteDoc = (doc: VaultDocument): boolean => {
    if (doc.isSigned) return false;
    if (isAdmin) return true;
    if (isAdminView && (isAdmin || isManager)) return true;
    // Employé : il ne peut supprimer que ses propres documents (vue self).
    return !isAdminView && doc.empcod === user?.uticod;
  };

  const handleDelete = (doc: VaultDocument) => {
    if (!doc.id) return;
    if (doc.isSigned) {
      Alert.alert(t('vault.deletionImpossible'), t('vault.signedCannotDelete'));
      return;
    }
    Alert.alert(
      t('vault.deleteDocument'),
      t('vault.deleteConfirm', { name: doc.docName || t('vault.documentFallback') }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteVaultDocument(doc.id!);
              Alert.alert(t('vault.deletedTitle'), t('vault.deletedMessage'));
              loadDocuments();
            } catch {
              Alert.alert(t('common.error'), t('vault.deleteError'));
            }
          },
        },
      ]
    );
  };

  // Construit l'URL absolue d'un document à partir du docPath stocké côté backend.
  // Le backend persiste un chemin relatif "/api/uploads/<uuid>.<ext>". On dérive
  // l'origine HTTP depuis API_BASE_URL (qui inclut "/api"), pour pointer vers le
  // serveur qui sert les fichiers statiques (nginx en prod, Kestrel en dev).
  const buildDocUrl = (doc: VaultDocument): string | null => {
    const path = doc.docPath?.trim();
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path;
    // API_BASE_URL: "https://concorde-work-force.com/api" → origin = same minus "/api"
    const origin = API_BASE_URL.replace(/\/api\/?$/i, '');
    return path.startsWith('/') ? `${origin}${path}` : `${origin}/${path}`;
  };

  // Ouvre le document dans le navigateur système (Safari/Chrome) — gère natif
  // PDF/images. Plus simple et plus universel qu'un viewer in-app, et ça permet
  // à l'utilisateur de partager/imprimer/sauvegarder via le système.
  const handleViewDoc = async (doc: VaultDocument) => {
    const url = buildDocUrl(doc);
    if (!url) {
      Alert.alert(t('vault.documentUnavailable'), t('vault.filePathMissing'));
      return;
    }
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert(t('vault.cannotOpen'), t('vault.noAppForFile'));
        return;
      }
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert(t('common.error'), t('vault.openError'));
    }
  };

  const handleSign = (doc: VaultDocument) => {
    if (!doc.id) return;
    const signerName = user?.utilib || 'Admin';
    Alert.alert(t('vault.eSignatureTitle'), t('vault.eSignatureConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('vault.signAction'), onPress: async () => {
          try {
            await apiService.signVaultDocument(doc.id!, `sig_${user?.uticod}`, signerName);
            Alert.alert(t('vault.successTitle'), t('vault.signSuccess'));
            loadDocuments();
          } catch { Alert.alert(t('common.error'), t('vault.signError')); }
        }
      },
    ]);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} ${t('vault.unitByte')}`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} ${t('vault.unitKilobyte')}`;
    return `${(bytes / 1048576).toFixed(1)} ${t('vault.unitMegabyte')}`;
  };

  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      const nameMatch = (doc.docName || '').toLowerCase().includes(searchQuery.toLowerCase());
      const categoryMatch = activeCategory === 'all' || 
                           (activeCategory === 'bulletin' && (doc.docType?.toLowerCase().includes('bulletin') || doc.docType?.toLowerCase().includes('paie'))) ||
                           (activeCategory === 'contrat' && doc.docType?.toLowerCase().includes('contrat'));
      return nameMatch && categoryMatch;
    });
  }, [documents, searchQuery, activeCategory]);

  const groupedDocuments = useMemo(() => {
    const groups: Record<string, VaultDocument[]> = {};
    filteredDocuments.forEach(doc => {
      const date = doc.docDate ? new Date(doc.docDate) : new Date();
      const monthYear = date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
      const key = monthYear.charAt(0).toUpperCase() + monthYear.slice(1);
      if (!groups[key]) groups[key] = [];
      groups[key].push(doc);
    });
    return Object.entries(groups).sort((a, b) => {
      return b[0].localeCompare(a[0]);
    });
  }, [filteredDocuments, locale]);

  if (loading) {
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
        <View style={styles.profileWrapper}>
          <MaterialCommunityIcons name="account-circle-outline" size={32} color="#cbd5e1" />
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Editorial Header */}
        <View style={styles.editorialHeader}>
          <Text style={styles.mainTitle}>Vault</Text>
          <Text style={styles.subTitle}>{t('vault.tagline')}</Text>

          <View style={styles.searchContainer}>
            <MaterialCommunityIcons name="magnify" size={20} color="#94a3b8" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('vault.searchPlaceholder')}
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {/* Categories */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll} contentContainerStyle={styles.categoryContent}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryBtn, activeCategory === cat.id && styles.categoryBtnActive]}
              onPress={() => setActiveCategory(cat.id)}
            >
              <MaterialCommunityIcons name={cat.icon as any} size={16} color={activeCategory === cat.id ? '#fff' : '#424654'} />
              <Text style={[styles.categoryLabel, activeCategory === cat.id && styles.categoryLabelActive]}>
                {t(cat.labelKey).toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Document Groups */}
        <View style={styles.documentList}>
          {groupedDocuments.map(([month, docs]) => (
            <View key={month} style={styles.monthGroup}>
              <View style={styles.monthHeader}>
                <Text style={styles.monthTitle}>{month}</Text>
                <View style={styles.monthLine} />
              </View>
              
              <View style={styles.docStack}>
                {docs.map((doc, idx) => {
                  const isBulletin = doc.docType?.toLowerCase().includes('bulletin') || doc.docType?.toLowerCase().includes('paie');
                  const isPending = !doc.isSigned && doc.docType?.toLowerCase().includes('contrat');
                  
                  const deletable = canDeleteDoc(doc);
                  return (
                    <TouchableOpacity
                      key={doc.id || idx}
                      style={[styles.docCard, isPending && styles.docCardPending]}
                      onPress={() => { if (!isPending) handleViewDoc(doc); }}
                      onLongPress={() => deletable && handleDelete(doc)}
                      delayLongPress={400}
                    >
                      <View style={styles.docLeft}>
                        <View style={[
                          styles.docIconContainer,
                          isBulletin ? styles.iconBulletins : isPending ? styles.iconPending : styles.iconDefault
                        ]}>
                          <MaterialCommunityIcons
                            name={isBulletin ? 'file-pdf-box' : isPending ? 'clock-alert-outline' : 'file-document-outline'}
                            size={24}
                            color={isBulletin ? COLORS.error : isPending ? '#b45309' : COLORS.primary}
                          />
                        </View>
                        <View style={styles.docInfo}>
                          <Text style={styles.docTitle}>{doc.docName}</Text>
                          <View style={styles.docMeta}>
                            <Text style={styles.docSubMeta}>
                              {doc.docDate ? new Date(doc.docDate).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                              {doc.docSize ? ` • ${formatFileSize(doc.docSize)}` : ''}
                            </Text>
                            {doc.isSigned && (
                              <View style={styles.signedBadge}>
                                <Text style={styles.signedText}>{t('vault.signedBadge')}</Text>
                              </View>
                            )}
                            {isPending && (
                              <View style={styles.pendingBadge}>
                                <Text style={styles.pendingText}>{t('vault.pendingBadge')}</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>

                      {isPending ? (
                        <TouchableOpacity style={styles.signButton} onPress={() => handleSign(doc)}>
                          <Text style={styles.signButtonText}>{t('vault.signButton')}</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.actionGroup}>
                          {/* Bouton suppression visible pour les documents non
                              signés du propriétaire (ou en vue admin). Long press
                              également supporté pour rester découvrable. */}
                          {deletable && (
                            <TouchableOpacity
                              style={styles.deleteButton}
                              onPress={() => handleDelete(doc)}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <MaterialCommunityIcons name="trash-can-outline" size={18} color={COLORS.error} />
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => handleViewDoc(doc)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <MaterialCommunityIcons name={doc.isSigned ? 'eye-outline' : 'download'} size={20} color={COLORS.primary} />
                          </TouchableOpacity>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
          
          {filteredDocuments.length === 0 && (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="folder-open-outline" size={64} color="#e2e8f0" />
              <Text style={styles.emptyText}>{t('vault.emptyState')}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={handleUpload}>
        <LinearGradient
          colors={[COLORS.primary, COLORS.primaryContainer]}
          style={styles.fabGradient}
        >
          <MaterialCommunityIcons name="plus" size={32} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>

      {/* BottomNavBar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Home')}>
          <MaterialCommunityIcons name="view-dashboard-outline" size={24} color="#94a3b8" />
          <Text style={styles.navLabel}>{t('vault.navDashboard')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('LeaveRequest')}>
          <MaterialCommunityIcons name="calendar-month-outline" size={24} color="#94a3b8" />
          <Text style={styles.navLabel}>{t('vault.navLeaves')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => {}}>
          <MaterialCommunityIcons name="folder-account" size={24} color={COLORS.primaryContainer} />
          <Text style={[styles.navLabel, { color: COLORS.primaryContainer }]}>{t('vault.navVault')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Authorization')}>
          <MaterialCommunityIcons name="draw-pen" size={24} color="#94a3b8" />
          <Text style={styles.navLabel}>{t('vault.navSign')}</Text>
        </TouchableOpacity>
      </View>
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
  profileWrapper: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', borderWidth: 2, borderColor: COLORS.surfaceContainerHigh },
  scrollContent: { padding: 20, paddingBottom: 120 },
  editorialHeader: { marginBottom: 32 },
  mainTitle: { fontSize: 32, fontWeight: '800', color: COLORS.primary, letterSpacing: -0.5 },
  subTitle: { fontSize: 10, fontWeight: '700', color: COLORS.outline, letterSpacing: 1.2, marginTop: 4, marginBottom: 24 },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 16, paddingHorizontal: 16, height: 56,
  },
  searchIcon: { marginRight: 12 },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.onSurface, fontFamily: 'Inter' },
  categoryScroll: { marginHorizontal: -20, marginBottom: 24 },
  categoryContent: { paddingHorizontal: 20, gap: 12 },
  categoryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 12,
    borderRadius: 30, backgroundColor: COLORS.surfaceContainerLowest,
  },
  categoryBtnActive: { backgroundColor: COLORS.primaryContainer, elevation: 8, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  categoryLabel: { fontSize: 10, fontWeight: '800', color: COLORS.onSurfaceVariant, letterSpacing: 1 },
  categoryLabelActive: { color: '#fff' },
  documentList: { gap: 32 },
  monthGroup: { gap: 16 },
  monthHeader: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  monthTitle: { fontSize: 18, fontWeight: '800', color: COLORS.onSurface },
  monthLine: { flex: 1, height: 2, backgroundColor: COLORS.surfaceContainerHigh },
  docStack: { gap: 12 },
  docCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8,
  },
  docCardPending: { borderWidth: 2, borderColor: 'rgba(0, 86, 210, 0.1)', borderStyle: 'dashed' },
  docLeft: { flexDirection: 'row', alignItems: 'center', gap: 16, flex: 1 },
  docIconContainer: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  iconBulletins: { backgroundColor: 'rgba(186, 26, 26, 0.05)' },
  iconPending: { backgroundColor: 'rgba(180, 83, 9, 0.1)' },
  iconDefault: { backgroundColor: 'rgba(0, 64, 161, 0.05)' },
  docInfo: { flex: 1, gap: 4 },
  docTitle: { fontSize: 15, fontWeight: '700', color: COLORS.onSurface },
  docMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  docSubMeta: { fontSize: 11, color: COLORS.outline, fontWeight: '500' },
  signedBadge: { backgroundColor: COLORS.tertiaryContainer, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  signedText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  pendingBadge: { backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  pendingText: { fontSize: 9, fontWeight: '800', color: '#92400e' },
  actionButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.surfaceContainerLow, justifyContent: 'center', alignItems: 'center' },
  actionGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  deleteButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.errorContainer, justifyContent: 'center', alignItems: 'center' },
  signButton: { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  signButtonText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  emptyState: { alignItems: 'center', gap: 12, paddingVertical: 60 },
  emptyText: { fontSize: 14, color: COLORS.outline, fontWeight: '600' },
  fab: { position: 'absolute', bottom: 100, right: 24, zIndex: 100 },
  fabGradient: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12 },
  bottomNav: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)', paddingBottom: 20,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  navItem: { alignItems: 'center', gap: 4 },
  navLabel: { fontSize: 9, fontWeight: '700', color: '#94a3b8' },
});