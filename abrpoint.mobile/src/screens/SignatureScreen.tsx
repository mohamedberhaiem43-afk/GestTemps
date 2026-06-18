import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Dimensions, Alert, TextInput, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { COLORS, THEME } from '../config/env';
import { useSecureScreen } from '../hooks/useSecureScreen';
import SignaturePad, { SignaturePadHandle } from '../components/SignaturePad';
import apiService from '../services/api';
import { useT } from '../i18n';

const { width } = Dimensions.get('window');

export default function SignatureScreen({ navigation, route }: any) {
  // SEC-G4 : signature électronique = pièce probante → bloque toute capture.
  useSecureScreen();
  const { user } = useAuth();
  const t = useT();
  const padRef = useRef<SignaturePadHandle>(null);
  const [hasSigned, setHasSigned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // documentId arrive via route.params quand on est appelé depuis le coffre (DigitalVault).
  // Sans documentId, on reste en mode "preview" — la validation ferme l'écran sans POST.
  const documentId = route?.params?.documentId;
  const documentName = route?.params?.docName || t('signature.defaultDocName');

  // Mode workflow (Phase 4) : on arrive via un deep-link push (signature_pending)
  // avec requestId + stepId. La validation passe alors par api/Signatures (circuit
  // multi-étapes + OTP + scellement) au lieu de l'ancien /Vault/sign.
  const isWorkflow = !!route?.params?.workflow && route?.params?.requestId != null && route?.params?.stepId != null;
  const requestId = route?.params?.requestId as number | undefined;
  const stepId = route?.params?.stepId as number | undefined;

  // OTP optionnel (renforce le niveau de garantie). E-mail uniquement côté mobile
  // (le TOTP reste disponible côté web ; pas de saisie d'authenticator ici).
  const [otpEnabled, setOtpEnabled] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpSentTo, setOtpSentTo] = useState<string | null>(null);
  const [otpSending, setOtpSending] = useState(false);

  const handleSendOtp = async () => {
    if (!isWorkflow) return;
    try {
      setOtpSending(true);
      const res = await apiService.sendSignatureOtp(Number(requestId), Number(stepId));
      setOtpSentTo(res?.email ?? null);
      Alert.alert(t('signature.otpSentTitle'), t('signature.otpSentMessage', { email: res?.email ?? t('signature.yourEmailAddress') }));
    } catch (e: any) {
      const msg = e?.response?.data?.code === 'no_email'
        ? t('signature.otpNoEmail')
        : t('signature.otpSendFailed');
      Alert.alert(t('common.error'), msg);
    } finally {
      setOtpSending(false);
    }
  };

  const submitReject = async (motif: string) => {
    if (motif.trim().length < 3) {
      Alert.alert(t('signature.reasonRequiredTitle'), t('signature.reasonRequiredMessage'));
      return;
    }
    try {
      setSubmitting(true);
      await apiService.rejectSignatureStep(Number(requestId), Number(stepId), motif.trim());
      Alert.alert(t('signature.rejectedTitle'), t('signature.rejectedMessage'), [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.response?.data?.error || t('signature.rejectFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectMotif, setRejectMotif] = useState('');

  const handleReject = () => {
    if (!isWorkflow) return;
    // Alert.prompt est iOS-only : sur Android on bascule sur un champ de saisie inline.
    if (typeof Alert.prompt === 'function') {
      Alert.prompt(t('signature.rejectPromptTitle'), t('signature.rejectPromptMessage'), (motif?: string) => submitReject(motif ?? ''));
    } else {
      setRejectOpen(true);
    }
  };

  const handleClear = () => {
    padRef.current?.clear();
    setHasSigned(false);
  };

  const handleValidate = async () => {
    if (!hasSigned || padRef.current?.isEmpty()) {
      Alert.alert(t('signature.warningTitle'), t('signature.signBeforeValidate'));
      return;
    }
    const dataUri = padRef.current?.toDataUri();
    if (!dataUri) {
      Alert.alert(t('common.error'), t('signature.captureFailed'));
      return;
    }

    // Mode workflow : signe l'étape courante du circuit (OTP optionnel).
    if (isWorkflow) {
      if (otpEnabled && otpCode.trim().length < 4) {
        Alert.alert(t('signature.codeRequiredTitle'), t('signature.codeRequiredMessage'));
        return;
      }
      setSubmitting(true);
      try {
        const res = await apiService.signSignatureStep(Number(requestId), Number(stepId), {
          signatureData: `drawn:${dataUri}`,
          signerName: user?.utilib || '',
          mention: t('signature.readAndApproved'),
          otpCode: otpEnabled ? otpCode.trim() : undefined,
          otpMethod: otpEnabled ? 'email' : undefined,
        });
        const completed = res?.completed === true;
        Alert.alert(
          t('signature.successTitle'),
          completed
            ? t('signature.signedSealedMessage')
            : t('signature.signedNextApproverMessage'),
          [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
      } catch (e: any) {
        const code = e?.response?.data?.code;
        const status = e?.response?.status;
        const msg = (code === 'otp_invalid' || status === 401)
          ? t('signature.otpInvalid')
          : status === 409
            ? (e?.response?.data?.error || t('signature.stepNoLongerCurrent'))
            : (e?.response?.data?.error || e?.message || t('signature.signError'));
        Alert.alert(t('common.error'), msg);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Sans documentId associé, on est en mode démo (ouvert depuis le bottom nav par exemple)
    // → confirmation locale sans appel backend, identique au comportement précédent.
    if (!documentId) {
      Alert.alert(t('signature.successTitle'), t('signature.signatureCapturedMessage'), [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
      return;
    }

    setSubmitting(true);
    try {
      await apiService.signVaultDocument(Number(documentId), dataUri, user?.utilib || '');
      Alert.alert(t('signature.successTitle'), t('signature.documentSignedMessage'), [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || t('signature.signError');
      Alert.alert(t('common.error'), msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* TopAppBar */}
      <View style={styles.topAppBar}>
        <View style={styles.topAppLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
            <MaterialCommunityIcons name="close" size={24} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.logoText}>{t('signature.title')}</Text>
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
            <Text style={styles.stepLabel}>{t('signature.stepReading')}</Text>
          </View>
          <View style={styles.stepItem}>
            <View style={[styles.stepCircle, styles.stepCompleted]}>
              <MaterialCommunityIcons name="check" size={16} color="#fff" />
            </View>
            <Text style={styles.stepLabel}>{t('signature.stepConsent')}</Text>
          </View>
          <View style={styles.stepItem}>
            <View style={[styles.stepCircle, styles.stepActive]}>
              <MaterialCommunityIcons name="draw" size={16} color="#fff" />
            </View>
            <Text style={[styles.stepLabel, { color: COLORS.primary }]}>{t('signature.stepSignature')}</Text>
          </View>
        </View>

        {/* Security Notification */}
        <View style={styles.securityBox}>
          <MaterialCommunityIcons name="shield-check" size={24} color={COLORS.tertiary} />
          <View style={styles.securityTextContainer}>
            <Text style={styles.securityTitle}>{t('signature.secureSessionTitle')}</Text>
            <Text style={styles.securityDesc}>
              {t('signature.secureSessionDesc')}
            </Text>
          </View>
        </View>

        {/* Document Preview */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('signature.contractPreview')}</Text>
          <View style={styles.pageBadge}>
            <Text style={styles.pageText}>{t('signature.pageIndicator')}</Text>
          </View>
        </View>

        <View style={styles.documentCard}>
          <ScrollView style={styles.documentContent} nestedScrollEnabled>
            <Text style={styles.articleTitle}>{t('signature.articleTitle')}</Text>
            <Text style={styles.articleText}>
              {t('signature.articleText1')}
            </Text>
            <View style={styles.divider} />
            <Text style={styles.articleText}>
              {t('signature.articleText2')}
            </Text>
            <View style={styles.placeholderSignature}>
              <MaterialCommunityIcons name="file-edit-outline" size={24} color={COLORS.outline} />
              <Text style={styles.placeholderText}>{t('signature.signaturePlaceholder')}</Text>
            </View>
          </ScrollView>
        </View>

        {/* Signature Zone */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('signature.signatureZone')}</Text>
        </View>

        <View style={styles.signatureContainer}>
          {/* Vraie zone de dessin au doigt — chaque mouvement tactile est capturé par
              SignaturePad (PanResponder) et reconstitué en SVG au moment de la validation. */}
          <View style={styles.signatureCanvas} collapsable={false}>
            <Text style={styles.canvasHint} pointerEvents="none">{t('signature.drawWithFinger')}</Text>
            <TouchableOpacity style={styles.refreshBtn} onPress={handleClear}>
              <MaterialCommunityIcons name="refresh" size={20} color={COLORS.secondary} />
            </TouchableOpacity>

            <SignaturePad
              ref={padRef}
              height={200}
              strokeColor="#0f172a"
              strokeWidth={2.5}
              onChange={(has) => setHasSigned(has)}
            />

            {!hasSigned && (
              <View style={[styles.instructionContainer, StyleSheet.absoluteFillObject, { justifyContent: 'center' }]} pointerEvents="none">
                <MaterialCommunityIcons name="gesture-tap" size={40} color={COLORS.outline} style={{ opacity: 0.35 }} />
                <Text style={[styles.instructionText, { opacity: 0.6 }]}>{t('signature.drawInZone')}</Text>
              </View>
            )}
          </View>

          <View style={styles.canvasFooter}>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: hasSigned ? COLORS.tertiary : COLORS.outlineVariant }]} />
              <Text style={styles.statusLabel}>{hasSigned ? t('signature.statusCaptured') : t('signature.statusReadyToCapture')}</Text>
            </View>
            <Text style={styles.idLabel}>{documentId ? t('signature.docId', { id: documentId }) : t('signature.demo')}</Text>
          </View>
        </View>

        {/* OTP optionnel (mode workflow) : renforce le niveau de garantie. */}
        {isWorkflow && (
          <View style={styles.otpBox}>
            <View style={styles.otpHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.otpTitle}>{t('signature.otpReinforceTitle')}</Text>
                <Text style={styles.otpSub}>{t('signature.otpReinforceSub')}</Text>
              </View>
              <Switch value={otpEnabled} onValueChange={setOtpEnabled} trackColor={{ true: COLORS.primary }} />
            </View>

            {otpEnabled && (
              <>
                <View style={styles.otpRow}>
                  <TextInput
                    style={styles.otpInput}
                    keyboardType="number-pad"
                    maxLength={8}
                    value={otpCode}
                    onChangeText={(v) => setOtpCode(v.replace(/\D/g, ''))}
                    placeholder="••••••"
                    placeholderTextColor={COLORS.outline}
                  />
                  <TouchableOpacity style={styles.otpSendBtn} onPress={handleSendOtp} disabled={otpSending}>
                    <MaterialCommunityIcons name="email-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.otpSendText}>{otpSending ? t('signature.sending') : otpSentTo ? t('signature.resend') : t('signature.receiveCode')}</Text>
                  </TouchableOpacity>
                </View>
                {otpSentTo && <Text style={styles.otpSent}>{t('signature.otpSentInline', { email: otpSentTo })}</Text>}
              </>
            )}
          </View>
        )}

        {/* Refus inline (Android — Alert.prompt indisponible) */}
        {isWorkflow && rejectOpen && (
          <View style={[styles.otpBox, { borderColor: '#ef9a9a' }]}>
            <Text style={styles.otpTitle}>{t('signature.rejectReasonTitle')}</Text>
            <TextInput
              style={styles.rejectInput}
              multiline
              numberOfLines={3}
              value={rejectMotif}
              onChangeText={setRejectMotif}
              placeholder={t('signature.rejectReasonPlaceholder')}
              placeholderTextColor={COLORS.outline}
            />
            <View style={styles.rejectActions}>
              <TouchableOpacity style={styles.rejectCancel} onPress={() => { setRejectOpen(false); setRejectMotif(''); }}>
                <Text style={styles.btnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.rejectConfirm} onPress={() => submitReject(rejectMotif)} disabled={submitting}>
                <Text style={[styles.btnText, { color: '#fff' }]}>{t('signature.confirmReject')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsGrid}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="cancel" size={20} color={COLORS.onSurface} />
            <Text style={styles.btnText}>{t('common.cancel')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.validateBtn} onPress={handleValidate} disabled={submitting}>
            <LinearGradient
              colors={[COLORS.primary, COLORS.primaryContainer]}
              style={styles.btnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <MaterialCommunityIcons name="draw" size={20} color="#fff" />
              <Text style={[styles.btnText, { color: '#fff' }]}>{submitting ? t('signature.sending') : t('signature.validate')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Refuser (mode workflow) */}
        {isWorkflow && !rejectOpen && (
          <TouchableOpacity style={styles.rejectLink} onPress={handleReject} disabled={submitting}>
            <MaterialCommunityIcons name="close-circle-outline" size={18} color="#ba1a1a" />
            <Text style={styles.rejectLinkText}>{t('signature.rejectDocument')}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* BottomNavBar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Home')}>
          <MaterialCommunityIcons name="view-dashboard-outline" size={24} color="#94a3b8" />
          <Text style={styles.navLabel}>{t('signature.navDashboard')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('LeaveRequest')}>
          <MaterialCommunityIcons name="calendar-month-outline" size={24} color="#94a3b8" />
          <Text style={styles.navLabel}>{t('signature.navLeave')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('DigitalVault')}>
          <MaterialCommunityIcons name="folder-lock-outline" size={24} color="#94a3b8" />
          <Text style={styles.navLabel}>{t('signature.navVault')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => {}}>
          <MaterialCommunityIcons name="draw" size={24} color={COLORS.primary} />
          <Text style={[styles.navLabel, { color: COLORS.primary }]}>{t('signature.navSign')}</Text>
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

  // ── Phase 4 — OTP & refus (mode workflow) ──
  otpBox: {
    backgroundColor: COLORS.surfaceContainerLowest, borderWidth: 1, borderColor: 'rgba(115, 119, 133, 0.25)',
    borderRadius: 16, padding: 16, marginBottom: 16,
  },
  otpHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  otpTitle: { fontSize: 14, fontWeight: '800', color: COLORS.onSurface },
  otpSub: { fontSize: 12, color: COLORS.secondary, marginTop: 2 },
  otpRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  otpInput: {
    flex: 1, height: 48, borderWidth: 1, borderColor: 'rgba(115, 119, 133, 0.3)', borderRadius: 10,
    textAlign: 'center', fontSize: 20, fontWeight: '800', letterSpacing: 6, color: COLORS.onSurface,
    backgroundColor: COLORS.background,
  },
  otpSendBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 48,
    borderRadius: 10, borderWidth: 1, borderColor: COLORS.primary, justifyContent: 'center',
  },
  otpSendText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  otpSent: { fontSize: 11, color: COLORS.tertiary, marginTop: 8, fontWeight: '600' },
  rejectInput: {
    minHeight: 72, borderWidth: 1, borderColor: 'rgba(115, 119, 133, 0.3)', borderRadius: 10,
    padding: 12, marginTop: 10, textAlignVertical: 'top', color: COLORS.onSurface, backgroundColor: COLORS.background,
  },
  rejectActions: { flexDirection: 'row', gap: 12, marginTop: 12 },
  rejectCancel: { flex: 1, height: 48, borderRadius: 12, backgroundColor: COLORS.surfaceContainerHigh, justifyContent: 'center', alignItems: 'center' },
  rejectConfirm: { flex: 1, height: 48, borderRadius: 12, backgroundColor: '#ba1a1a', justifyContent: 'center', alignItems: 'center' },
  rejectLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16, paddingVertical: 8 },
  rejectLinkText: { fontSize: 13, fontWeight: '700', color: '#ba1a1a' },
});
