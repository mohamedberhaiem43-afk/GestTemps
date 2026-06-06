import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StatusBar,
  ScrollView,
  Linking,
  Image,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { COLORS } from '../config/env';
import axios from 'axios';
import { API_BASE_URL } from '../config/env';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  enableBiometricLogin,
  getBiometricCapabilities,
  isBiometricLoginEnabled,
  biometricLoginFlow,
} from '../services/biometric';
import { useT } from '../i18n';

type TFunc = (key: string, vars?: Record<string, string | number>) => string;

// URL du portail web où l'admin peut upgrader son plan. On garde "concorde-work-force.com"
// (et non concordeworkly.com, qui redirige vers /download) parce que c'est le portail
// applicatif où la facturation se gère.
const UPGRADE_URL = 'https://www.concorde-work-force.com/dashboard/pricing';

// Image hero — même asset que la maquette web (Login.tsx) pour conserver la
// cohérence visuelle entre les deux clients. Diffusée par Google CDN, mise en
// cache par React Native ImageBackground.
const HERO_IMAGE_URL =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCWqJf3IUUEowPCqYCPt4vLryLnDfZvOC0tonFBF2KVL6-ma6MKEs_0Sh1ax79f_me6Wv8W7-TinaUluS3ZPD7rNZCtrYwOnTg-xYIoDQtgIseYaV8yPhn6o3BsDtiHpGzfwtBPk874gN3wRLU-Kh40AhyHADwh-b8HIelIhd6KPJqSpClx5heiL1LQHCz3B9Mb9nPzmbX9ou-NYhjnQqXtGiFp1f94eXFaW_vC8a2PIhU6Y-fSmnEP8oU0LsfCTnlPHQfFG074zJw';

/**
 * Affiche un dialog dédié quand le backend renvoie 402 plan_feature_locked sur
 * un login mobile : l'utilisateur est sur le pack Starter, qui n'inclut PAS
 * l'application mobile. On ne le laisse pas patauger dans un "Erreur" générique —
 * on lui dit ce qui se passe et on lui ouvre la page d'upgrade dans le navigateur.
 *
 * Retourne `true` si le cas a été géré (le caller doit s'arrêter là).
 */
function handlePlanLockedIfApplicable(error: any, t: TFunc): boolean {
  const status = error?.response?.status;
  const data = error?.response?.data;
  const isPlanLocked =
    status === 402 || data?.code === 'plan_feature_locked';
  if (!isPlanLocked) return false;

  const currentPlan = data?.currentPlan || 'Starter';
  Alert.alert(
    t('login.planLockedTitle', { plan: currentPlan }),
    t('login.planLockedBody', { plan: currentPlan }),
    [
      { text: t('common.close'), style: 'cancel' },
      {
        text: t('login.upgrade'),
        onPress: () => { Linking.openURL(UPGRADE_URL).catch(() => { /* noop */ }); },
      },
    ]
  );
  return true;
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, hydrateAfterBiometric } = useAuth();
  const t = useT();

  // Biométrie : on n'affiche le bouton "Se connecter avec FaceID/TouchID" que si l'utilisateur
  // l'a explicitement activé après un login classique précédent ET que l'appareil le supporte
  // (sinon les credentials ne sont pas stockés).
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioLabel, setBioLabel] = useState('Biométrie');

  useEffect(() => {
    (async () => {
      try {
        const enabled = await isBiometricLoginEnabled();
        if (!enabled) return;
        const caps = await getBiometricCapabilities();
        if (caps.hasHardware && caps.isEnrolled) {
          setBioAvailable(true);
          setBioLabel(caps.label);
        }
      } catch { /* best-effort */ }
    })();
  }, []);

  // Forgot password state
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotStep, setForgotStep] = useState<'email' | 'code' | 'reset'>('email');
  const [forgotLoading, setForgotLoading] = useState(false);

  const offerBiometricEnrollment = async (slug?: string) => {
    try {
      const caps = await getBiometricCapabilities();
      const already = await isBiometricLoginEnabled();
      if (already || !caps.hasHardware || !caps.isEnrolled) return;
      Alert.alert(
        t('login.enableBioTitle', { method: caps.label }),
        t('login.enableBioBody', { method: caps.label }),
        [
          { text: t('login.later'), style: 'cancel' },
          {
            text: t('login.enable'),
            onPress: async () => {
              try { await enableBiometricLogin(slug); } catch { /* noop */ }
            },
          },
        ]
      );
    } catch { /* best-effort */ }
  };

  const handleBiometricLogin = async () => {
    setLoading(true);
    try {
      const result = await biometricLoginFlow();
      if (!result) {
        Alert.alert(t('common.info'), t('login.noBioStored'));
        return;
      }
      hydrateAfterBiometric(result.user);
    } catch (error: any) {
      if (handlePlanLockedIfApplicable(error, t)) return;
      const msg = error?.response?.data?.message || t('login.bioFailed');
      Alert.alert(t('common.error'), msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      Alert.alert(t('common.error'), t('login.fillRequired'));
      return;
    }
    setLoading(true);
    try {
      await login(normalizedEmail, password);
      await offerBiometricEnrollment();
    } catch (error: any) {
      if (handlePlanLockedIfApplicable(error, t)) return;
      const msg = error?.response?.data?.message || t('login.loginError');
      Alert.alert(t('common.error'), msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSendResetCode = async () => {
    if (!forgotEmail) { Alert.alert(t('common.error'), t('login.enterEmail')); return; }
    setForgotLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/auth/forgot-password`, { Email: forgotEmail });
      const successMsg = res.data?.message || res.data?.Message || t('login.codeSent');
      Alert.alert(t('common.success'), successMsg);
      setForgotStep('code');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.Message || t('login.sendCodeError');
      Alert.alert(t('common.error'), msg);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) { Alert.alert(t('common.error'), t('login.fillAll')); return; }
    if (newPassword !== confirmPassword) { Alert.alert(t('common.error'), t('login.pwdMismatch')); return; }
    if (newPassword.length < 6) { Alert.alert(t('common.error'), t('login.pwdTooShort')); return; }
    setForgotLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/auth/reset-password`, {
        Email: forgotEmail,
        Code: resetCode,
        NewPassword: newPassword,
      });
      const successMsg = res.data?.message || res.data?.Message || t('login.pwdReset');
      Alert.alert(t('common.success'), successMsg);
      setShowForgot(false);
      setForgotStep('email');
      setForgotEmail('');
      setResetCode('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.Message || t('login.resetError');
      Alert.alert(t('common.error'), msg);
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#001a41" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Hero — alignée avec la moitié gauche de la maquette web Login.tsx :
              image architecturale + overlay sombre + gradient bas pour
              lisibilité du logo blanc. Sur mobile elle occupe la moitié haute
              de l'écran avant de céder la place au formulaire blanc. */}
          <ImageBackground
            source={{ uri: HERO_IMAGE_URL }}
            style={styles.hero}
            imageStyle={styles.heroImage}
          >
            <View style={styles.heroOverlay} />
            <View style={styles.heroGradient} />
            <SafeAreaView edges={['top']} style={styles.heroSafe}>
              <View style={styles.brandRow}>
                <View style={styles.logoBadge}>
                  <Image
                    source={require('../../assets/concorde-workly-logo.png')}
                    style={styles.logoImg}
                    resizeMode="contain"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.brandName}>Concorde Workly</Text>
                  <Text style={styles.brandTag}>{t('login.heroTagline')}</Text>
                </View>
              </View>
              <View style={styles.heroBottom}>
                <Text style={styles.heroTitle}>{t('login.welcome')}</Text>
                <Text style={styles.heroSubtitle}>
                  {t('login.heroSubtitle')}
                </Text>
              </View>
            </SafeAreaView>
          </ImageBackground>

          {/* Carte formulaire — fond blanc qui chevauche le hero pour
              reproduire l'effet « carte flottante » de la maquette web. */}
          <View style={styles.card}>
            {!showForgot ? (
              <>
                <View style={styles.formHead}>
                  <Text style={styles.formTitle}>{t('login.title')}</Text>
                  <Text style={styles.formSubtitle}>
                    {t('login.subtitle')}
                  </Text>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>{t('login.email')}</Text>
                  <View style={styles.inputWrap}>
                    <MaterialCommunityIcons name="email-outline" size={18} color="#737785" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="vous@entreprise.com"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      placeholderTextColor="#9ca3af"
                    />
                  </View>
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>{t('login.password')}</Text>
                  <View style={styles.inputWrap}>
                    <MaterialCommunityIcons name="lock-outline" size={18} color="#737785" style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { paddingRight: 38 }]}
                      placeholder="••••••••"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      placeholderTextColor="#9ca3af"
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword((s) => !s)}
                      style={styles.inputAction}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <MaterialCommunityIcons
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={18}
                        color="#737785"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => { setShowForgot(true); setForgotEmail(email); setForgotStep('email'); }}
                  style={styles.forgotLink}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.forgotLinkText}>{t('login.forgot')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
                  onPress={handleLogin}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.primaryBtnText}>{t('login.signIn')}</Text>
                      <MaterialCommunityIcons name="arrow-right" size={18} color="#fff" />
                    </>
                  )}
                </TouchableOpacity>

                {bioAvailable && (
                  <>
                    <View style={styles.divider}>
                      <View style={styles.dividerLine} />
                      <Text style={styles.dividerText}>{t('login.or')}</Text>
                      <View style={styles.dividerLine} />
                    </View>
                    <TouchableOpacity
                      style={styles.bioBtn}
                      onPress={handleBiometricLogin}
                      disabled={loading}
                      activeOpacity={0.85}
                    >
                      <MaterialCommunityIcons
                        name={bioLabel.toLowerCase().includes('faciale') ? 'face-recognition' : 'fingerprint'}
                        size={22}
                        color={COLORS.primary}
                      />
                      <Text style={styles.bioBtnText}>{t('login.continueWith', { method: bioLabel })}</Text>
                    </TouchableOpacity>
                  </>
                )}
                {/* Mentions légales — visibles dès le login (exigence Apple
                    Guideline 5.1.1(i) et Google Play Data Safety). */}
                <View style={styles.legalLinks}>
                  <TouchableOpacity onPress={() => Linking.openURL('https://concorde-work-force.com/docs/politique-confidentialite.pdf')}>
                    <Text style={styles.legalLink}>{t('login.privacy')}</Text>
                  </TouchableOpacity>
                  <Text style={styles.legalSep}>·</Text>
                  <TouchableOpacity onPress={() => Linking.openURL('https://concorde-work-force.com/docs/cgu.pdf')}>
                    <Text style={styles.legalLink}>{t('login.terms')}</Text>
                  </TouchableOpacity>
                  <Text style={styles.legalSep}>·</Text>
                  <TouchableOpacity onPress={() => Linking.openURL('https://concorde-work-force.com/docs/mentions-legales.pdf')}>
                    <Text style={styles.legalLink}>{t('login.legal')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View style={styles.formHead}>
                  <Text style={styles.formTitle}>{t('login.resetTitle')}</Text>
                  <Text style={styles.formSubtitle}>
                    {forgotStep === 'email'
                      ? t('login.resetStepEmail')
                      : forgotStep === 'code'
                        ? t('login.resetStepCode')
                        : t('login.resetStepReset')}
                  </Text>
                </View>

                {forgotStep === 'email' && (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>{t('login.email')}</Text>
                    <View style={styles.inputWrap}>
                      <MaterialCommunityIcons name="email-outline" size={18} color="#737785" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="vous@entreprise.com"
                        value={forgotEmail}
                        onChangeText={setForgotEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        placeholderTextColor="#9ca3af"
                      />
                    </View>
                  </View>
                )}

                {forgotStep === 'code' && (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>{t('login.verifCode')}</Text>
                    <View style={styles.inputWrap}>
                      <MaterialCommunityIcons name="numeric" size={18} color="#737785" style={styles.inputIcon} />
                      <TextInput
                        style={[styles.input, { letterSpacing: 6, textAlign: 'center', fontSize: 18 }]}
                        placeholder="000000"
                        value={resetCode}
                        onChangeText={(t) => setResetCode(t.replace(/\D/g, '').slice(0, 6))}
                        keyboardType="number-pad"
                        maxLength={6}
                        placeholderTextColor="#9ca3af"
                      />
                    </View>
                  </View>
                )}

                {forgotStep === 'reset' && (
                  <>
                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>{t('login.newPassword')}</Text>
                      <View style={styles.inputWrap}>
                        <MaterialCommunityIcons name="lock-outline" size={18} color="#737785" style={styles.inputIcon} />
                        <TextInput
                          style={styles.input}
                          placeholder="••••••••"
                          value={newPassword}
                          onChangeText={setNewPassword}
                          secureTextEntry
                          placeholderTextColor="#9ca3af"
                        />
                      </View>
                    </View>
                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>{t('login.confirmPassword')}</Text>
                      <View style={styles.inputWrap}>
                        <MaterialCommunityIcons name="lock-check-outline" size={18} color="#737785" style={styles.inputIcon} />
                        <TextInput
                          style={styles.input}
                          placeholder="••••••••"
                          value={confirmPassword}
                          onChangeText={setConfirmPassword}
                          secureTextEntry
                          placeholderTextColor="#9ca3af"
                        />
                      </View>
                    </View>
                  </>
                )}

                <TouchableOpacity
                  style={[styles.primaryBtn, forgotLoading && styles.primaryBtnDisabled]}
                  onPress={() => {
                    if (forgotStep === 'email') handleSendResetCode();
                    else if (forgotStep === 'code') setForgotStep('reset');
                    else handleResetPassword();
                  }}
                  disabled={forgotLoading}
                  activeOpacity={0.85}
                >
                  {forgotLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Text style={styles.primaryBtnText}>
                        {forgotStep === 'email' ? t('login.sendCode') : forgotStep === 'code' ? t('login.verifyCode') : t('login.reset')}
                      </Text>
                      <MaterialCommunityIcons name="arrow-right" size={18} color="#fff" />
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => { setShowForgot(false); setForgotStep('email'); }}
                  style={styles.backLink}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialCommunityIcons name="arrow-left" size={16} color="#64748b" />
                  <Text style={styles.backLinkText}>{t('login.backToLogin')}</Text>
                </TouchableOpacity>
              </>
            )}

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                {t('login.needHelp')}{' '}
                <Text
                  style={styles.footerLink}
                  onPress={() =>
                    Linking.openURL(
                      'mailto:contact@concorde-tech.fr?subject=Demande%20d%27assistance%20%E2%80%94%20Concorde%20Workforce'
                    ).catch(() => { /* noop */ })
                  }
                >
                  {t('login.contactSupport')}
                </Text>
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 24 },

  // ── Hero (moitié haute) ────────────────────────────────────────────────
  hero: { height: 320, justifyContent: 'flex-end', backgroundColor: '#001a41' },
  heroImage: { opacity: 0.85 },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 26, 65, 0.55)',
  },
  heroGradient: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: 140,
    backgroundColor: 'rgba(0, 26, 65, 0.7)',
  },
  heroSafe: { flex: 1, paddingHorizontal: 24, paddingTop: 12, justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoBadge: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: '#43466b',
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 4,
  },
  logoImg: { width: 48, height: 48 },
  brandName: { color: '#ffffff', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  brandTag: { color: 'rgba(255,255,255,0.78)', fontSize: 11, marginTop: 2, fontWeight: '600' },
  heroBottom: { paddingBottom: 36 },
  heroTitle: { color: '#ffffff', fontSize: 30, fontWeight: '900', letterSpacing: -0.5 },
  heroSubtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 6, lineHeight: 18, maxWidth: 280 },

  // ── Carte formulaire (chevauche le hero) ───────────────────────────────
  card: {
    backgroundColor: '#ffffff',
    marginTop: -28,
    marginHorizontal: 16,
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 22,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 6,
  },
  formHead: { marginBottom: 18 },
  formTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a', letterSpacing: -0.2 },
  formSubtitle: { fontSize: 12.5, color: '#64748b', marginTop: 6, lineHeight: 18 },

  fieldGroup: { marginBottom: 14 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: '#475569', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 },
  inputWrap: {
    position: 'relative',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
  },
  inputIcon: {
    position: 'absolute', left: 12, top: 0, bottom: 0,
    textAlignVertical: 'center',
    height: 44,
    lineHeight: 44,
  },
  input: {
    height: 44,
    paddingLeft: 38,
    paddingRight: 12,
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '500',
  },
  inputAction: {
    position: 'absolute', right: 10, top: 0, bottom: 0,
    height: 44, width: 28, alignItems: 'center', justifyContent: 'center',
  },

  forgotLink: { alignSelf: 'flex-end', marginTop: -4, marginBottom: 14 },
  forgotLinkText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e2e8f0' },
  dividerText: { fontSize: 10, fontWeight: '800', color: '#94a3b8', letterSpacing: 1 },

  bioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryFixed,
  },
  bioBtnText: { color: COLORS.primary, fontWeight: '800', fontSize: 14 },

  legalLinks: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16 },
  legalLink: { fontSize: 11, color: '#64748b', textDecorationLine: 'underline' },
  legalSep: { fontSize: 11, color: '#94a3b8' },

  backLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', marginTop: 14 },
  backLinkText: { color: '#64748b', fontSize: 13, fontWeight: '600' },

  footer: { marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  footerText: { fontSize: 11.5, color: '#94a3b8', textAlign: 'center' },
  footerLink: { color: COLORS.primary, fontWeight: '700' },
});
