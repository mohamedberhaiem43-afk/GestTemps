import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';
import { COLORS, THEME } from '../config/env';
import { useSecureScreen } from '../hooks/useSecureScreen';

const { width } = Dimensions.get('window');

export default function SignatureScreen({ navigation, route }: any) {
  // SEC-G4 : signature électronique = pièce probante → bloque toute capture.
  useSecureScreen();
  const { user } = useAuth();
  const [hasSigned, setHasSigned] = useState(false);
  const documentName = route?.params?.docName || "Contrat de travail - Ledger HR";

  const handleValidate = () => {
    if (!hasSigned) {
      Alert.alert('Attention', 'Veuillez apposer votre signature avant de valider.');
      return;
    }
    Alert.alert('✅ Succès', 'Votre signature a été enregistrée avec succès.', [
      { text: 'OK', onPress: () => navigation.goBack() }
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* TopAppBar */}
      <View style={styles.topAppBar}>
        <View style={styles.topAppLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
            <MaterialCommunityIcons name="close" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.logoText}>Signature Électronique</Text>
        </View>
        <View style={styles.profileWrapper}>
          <Image
            source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAOjropeh1pVfdLFp-Ix1oKzHrEIbwAC3eD4292zuqvBQk-8CEWOHkwOG21ZmjTCqeG90T2sptVBK0eD89eAEAJLNAis1AU2Sxz673bvZEqQ2bNVxZUVhCgSNspQQ7uxNzrK0edOUyOR8xUFxKLug5HjdA1onKd3MaSmSbC3Jyru3RrgMl0YN3d3S92OHyK60WFcUNt1E6pZN68xaI_Sx2iEOAIPQpt05VwL9qG5sVwbWdNhARlmjjWX6iD4h84nPc5di_BaTjZzBI' }}
            style={styles.profileImage}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Visual Stepper */}
        <View style={styles.stepperContainer}>
          <View style={styles.stepLine} />
          <View style={styles.stepItem}>
            <View style={[styles.stepCircle, styles.stepCompleted]}>
              <MaterialCommunityIcons name="check" size={16} color="#fff" />
            </View>
            <Text style={styles.stepLabel}>Lecture</Text>
          </View>
          <View style={styles.stepItem}>
            <View style={[styles.stepCircle, styles.stepCompleted]}>
              <MaterialCommunityIcons name="check" size={16} color="#fff" />
            </View>
            <Text style={styles.stepLabel}>Consentement</Text>
          </View>
          <View style={styles.stepItem}>
            <View style={[styles.stepCircle, styles.stepActive]}>
              <MaterialCommunityIcons name="draw" size={16} color="#fff" />
            </View>
            <Text style={[styles.stepLabel, { color: COLORS.primary }]}>Signature</Text>
          </View>
        </View>

        {/* Security Notification */}
        <View style={styles.securityBox}>
          <MaterialCommunityIcons name="shield-check" size={24} color={COLORS.tertiary} />
          <View style={styles.securityTextContainer}>
            <Text style={styles.securityTitle}>Session sécurisée</Text>
            <Text style={styles.securityDesc}>
              Cette signature est juridiquement contraignante et protégée par un cryptage AES-256 conforme eIDAS.
            </Text>
          </View>
        </View>

        {/* Document Preview */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>APERÇU DU CONTRAT</Text>
          <View style={styles.pageBadge}>
            <Text style={styles.pageText}>PAGE 4 / 4</Text>
          </View>
        </View>

        <View style={styles.documentCard}>
          <ScrollView style={styles.documentContent} nestedScrollEnabled>
            <Text style={styles.articleTitle}>ARTICLE 12 - VALIDATION FINALE</Text>
            <Text style={styles.articleText}>
              Les parties reconnaissent que la signature électronique apposée ci-dessous manifeste leur consentement plein et entier aux termes du présent contrat de travail "Ledger HR Signature".
            </Text>
            <View style={styles.divider} />
            <Text style={styles.articleText}>
              En signant ce document, l'employé confirme avoir pris connaissance de l'ensemble des annexes de sécurité et de confidentialité.
            </Text>
            <View style={styles.placeholderSignature}>
              <MaterialCommunityIcons name="file-edit-outline" size={24} color={COLORS.outline} />
              <Text style={styles.placeholderText}>EMPLACEMENT DE LA SIGNATURE</Text>
            </View>
          </ScrollView>
        </View>

        {/* Signature Zone */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>ZONE DE SIGNATURE</Text>
        </View>

        <View style={styles.signatureContainer}>
          <TouchableOpacity 
            activeOpacity={1}
            style={styles.signatureCanvas}
            onPress={() => setHasSigned(true)}
          >
            <Text style={styles.canvasHint}>DESSINEZ ICI</Text>
            <TouchableOpacity style={styles.refreshBtn} onPress={() => setHasSigned(false)}>
              <MaterialCommunityIcons name="refresh" size={20} color={COLORS.secondary} />
            </TouchableOpacity>
            
            <View style={styles.signatureLine} />
            
            {!hasSigned ? (
              <View style={styles.instructionContainer}>
                <MaterialCommunityIcons name="gesture-double-tap" size={40} color={COLORS.outline} style={{ opacity: 0.4 }} />
                <Text style={styles.instructionText}>Touchez pour simuler votre signature</Text>
              </View>
            ) : (
              <View style={styles.instructionContainer}>
                <MaterialCommunityIcons name="draw" size={48} color={COLORS.primary} />
                <Text style={[styles.instructionText, { color: COLORS.primary }]}>Signature capturée</Text>
              </View>
            )}
          </TouchableOpacity>
          
          <View style={styles.canvasFooter}>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: hasSigned ? COLORS.tertiary : COLORS.outlineVariant }]} />
              <Text style={styles.statusLabel}>{hasSigned ? 'CAPTURÉ' : 'PRÊT À CAPTURER'}</Text>
            </View>
            <Text style={styles.idLabel}>ID: 882-X9-SGN</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsGrid}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="cancel" size={20} color={COLORS.onSurface} />
            <Text style={styles.btnText}>Annuler</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.validateBtn} onPress={handleValidate}>
            <LinearGradient
              colors={[COLORS.primary, COLORS.primaryContainer]}
              style={styles.btnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <MaterialCommunityIcons name="draw" size={20} color="#fff" />
              <Text style={[styles.btnText, { color: '#fff' }]}>Valider</Text>
            </LinearGradient>
          </TouchableOpacity>
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
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('DigitalVault')}>
          <MaterialCommunityIcons name="folder-shared-outline" size={24} color="#94a3b8" />
          <Text style={styles.navLabel}>COFFRE</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => {}}>
          <MaterialCommunityIcons name="draw" size={24} color={COLORS.primary} />
          <Text style={[styles.navLabel, { color: COLORS.primary }]}>SIGNER</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topAppBar: {
    height: 64, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, backgroundColor: 'rgba(247, 249, 251, 0.8)', borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  topAppLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  logoText: { fontFamily: 'Manrope', fontWeight: '800', fontSize: 18, color: COLORS.onSurface, letterSpacing: -0.5 },
  profileWrapper: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', backgroundColor: COLORS.surfaceContainerHigh, borderWidth: 1, borderColor: 'rgba(115, 119, 133, 0.2)' },
  profileImage: { width: '100%', height: '100%' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 100 },
  stepperContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, paddingHorizontal: 16 },
  stepLine: { position: 'absolute', top: 16, left: 32, right: 32, height: 2, backgroundColor: COLORS.surfaceContainerHighest, zIndex: 0 },
  stepItem: { alignItems: 'center', gap: 8, zIndex: 1 },
  stepCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: COLORS.background },
  stepCompleted: { backgroundColor: COLORS.tertiary },
  stepActive: { backgroundColor: COLORS.primary },
  stepLabel: { fontSize: 10, fontWeight: '700', color: COLORS.secondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  securityBox: { flexDirection: 'row', gap: 12, backgroundColor: 'rgba(0, 81, 54, 0.05)', borderLeftWidth: 4, borderLeftColor: COLORS.tertiary, borderRadius: 16, padding: 16, marginBottom: 24 },
  securityTextContainer: { flex: 1 },
  securityTitle: { fontSize: 14, fontWeight: '800', color: COLORS.tertiary, marginBottom: 2 },
  securityDesc: { fontSize: 12, color: COLORS.secondary, lineHeight: 18 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: COLORS.primary, letterSpacing: 1.5 },
  pageBadge: { backgroundColor: COLORS.surfaceContainerHigh, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  pageText: { fontSize: 10, fontWeight: '800', color: COLORS.secondary },
  documentCard: { backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 20, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.04, shadowRadius: 32, elevation: 4, borderWidth: 1, borderColor: 'rgba(115, 119, 133, 0.1)', marginBottom: 32 },
  documentContent: { height: 280 },
  articleTitle: { fontSize: 13, fontWeight: '800', color: COLORS.onSurface, marginBottom: 12 },
  articleText: { fontSize: 13, color: COLORS.onSurfaceVariant, lineHeight: 20, marginBottom: 16 },
  divider: { height: 1, backgroundColor: COLORS.surfaceContainerLow, width: '100%', marginBottom: 16 },
  placeholderSignature: { marginTop: 16, padding: 16, backgroundColor: COLORS.surfaceContainerLow, borderRadius: 12, borderStyle: 'dashed', borderWidth: 2, borderColor: 'rgba(115, 119, 133, 0.3)', alignItems: 'center', gap: 8 },
  placeholderText: { fontSize: 10, fontWeight: '700', color: COLORS.outline, letterSpacing: 0.5 },
  signatureContainer: { backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(115, 119, 133, 0.2)', shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.1, shadowRadius: 24, elevation: 8, overflow: 'hidden', marginBottom: 32 },
  signatureCanvas: { height: 200, backgroundColor: '#fcfcfc', justifyContent: 'center', alignItems: 'center' },
  canvasHint: { position: 'absolute', top: 16, left: 16, fontSize: 10, fontWeight: '800', color: COLORS.outline, letterSpacing: 1 },
  refreshBtn: { position: 'absolute', top: 16, right: 16, padding: 8 },
  signatureLine: { position: 'absolute', bottom: 48, left: 32, right: 32, height: 2, backgroundColor: COLORS.surfaceContainerHighest },
  instructionContainer: { alignItems: 'center', gap: 8 },
  instructionText: { fontSize: 12, fontWeight: '600', color: COLORS.outline },
  canvasFooter: { backgroundColor: COLORS.surfaceContainerLow, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 10, fontWeight: '700', color: COLORS.secondary, letterSpacing: 0.5 },
  idLabel: { fontSize: 10, fontWeight: '600', color: COLORS.outline },
  actionsGrid: { flexDirection: 'row', gap: 16 },
  cancelBtn: { flex: 1, height: 56, backgroundColor: COLORS.surfaceContainerHigh, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12 },
  validateBtn: { flex: 1, height: 56 },
  btnGradient: { flex: 1, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12 },
  btnText: { fontSize: 14, fontWeight: '800', color: COLORS.onSurface },
  bottomNav: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)', paddingBottom: 20,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  navItem: { alignItems: 'center', gap: 4 },
  navLabel: { fontSize: 9, fontWeight: '700', color: '#94a3b8' },
});
