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

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, hydrateAfterBiometric } = useAuth();

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
        `Activer ${caps.label} ?`,
        `Connectez-vous plus rapidement la prochaine fois en utilisant ${caps.label}. Aucun mot de passe ne sera stocké sur l'appareil.`,
        [
          { text: 'Plus tard', style: 'cancel' },
          {
            text: 'Activer',
            // SEC-G2 : on ne stocke plus email+password — on demande au backend
            // un bio-token dédié (durée 90j, rotaté à chaque usage).
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
      // SEC-G2 : le flow biométrique demande un prompt FaceID, envoie le bio-token
      // au backend, met à jour les tokens d'auth localement et hydrate le user.
      const result = await biometricLoginFlow();
      if (!result) {
        Alert.alert('Information', 'Aucun identifiant biométrique stocké. Connectez-vous une première fois.');
        return;
      }
      // Hydrate AuthContext avec le user fraîchement fetché → RootNavigator bascule
      // sur AppStack automatiquement (isAuthenticated devient true).
      hydrateAfterBiometric(result.user);
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Connexion biométrique échouée.';
      Alert.alert('Erreur', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
      return;
    }
    setLoading(true);
    try {
      await login(normalizedEmail, password);
      // Après un login classique réussi, on propose d'activer la biométrie pour la prochaine fois.
      await offerBiometricEnrollment();
    } catch (error: any) {
      console.log('Login error catch:', error);
      if (error.response) {
        console.log('Error Response Data:', error.response.data);
        console.log('Error Response Status:', error.response.status);
      } else if (error.request) {
        console.log('Error Request:', error.request);
      } else {
        console.log('Error Message:', error.message);
      }
      
      const msg = error?.response?.data?.message || 'Erreur de connexion. Vérifiez vos identifiants.';
      Alert.alert('Erreur', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSendResetCode = async () => {
    if (!forgotEmail) { Alert.alert('Erreur', 'Veuillez entrer votre email.'); return; }
    setForgotLoading(true);
    try {
      // Endpoint public (api/auth/forgot-password) qui résout le tenant à partir
      // de l'email puis envoie le code à 6 chiffres par email. L'ancien
      // /Utilisateurs/forgot-password persistait le code mais n'envoyait plus
      // l'email — c'est pourquoi l'utilisateur ne recevait jamais rien.
      const res = await axios.post(`${API_BASE_URL}/auth/forgot-password`, { Email: forgotEmail });
      // Le nouveau endpoint renvoie { message } (lowercase) ; l'ancien renvoyait { Message }.
      // On accepte les deux pour la rétrocompatibilité avec d'anciens déploiements.
      const successMsg = res.data?.message || res.data?.Message || 'Code envoyé. Consultez votre boîte mail.';
      Alert.alert('Succès', successMsg);
      setForgotStep('code');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.Message || 'Erreur lors de l\'envoi du code.';
      Alert.alert('Erreur', msg);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) { Alert.alert('Erreur', 'Veuillez remplir tous les champs.'); return; }
    if (newPassword !== confirmPassword) { Alert.alert('Erreur', 'Les mots de passe ne correspondent pas.'); return; }
    if (newPassword.length < 6) { Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères.'); return; }
    setForgotLoading(true);
    try {
      // Nouveau endpoint public — payload: { Email, Code, NewPassword }.
      const res = await axios.post(`${API_BASE_URL}/auth/reset-password`, {
        Email: forgotEmail,
        Code: resetCode,
        NewPassword: newPassword,
      });
      const successMsg = res.data?.message || res.data?.Message || 'Mot de passe réinitialisé.';
      Alert.alert('Succès', successMsg);
      setShowForgot(false);
      setForgotStep('email');
      setForgotEmail('');
      setResetCode('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.Message || 'Erreur lors de la réinitialisation.';
      Alert.alert('Erreur', msg);
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>🕐</Text>
            <Text style={styles.appTitle}>GestTemps</Text>
            <Text style={styles.appSubtitle}>Pointage & Gestion du Temps</Text>
          </View>
        </View>

        <ScrollView style={styles.form} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
          {!showForgot ? (
            <>
              <Text style={styles.formTitle}>Connexion</Text>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Email *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="votre@email.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Mot de passe *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Mot de passe"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholderTextColor={COLORS.textSecondary}
                />
              </View>

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Se Connecter</Text>
                )}
              </TouchableOpacity>

              {bioAvailable && (
                <TouchableOpacity
                  style={styles.bioButton}
                  onPress={handleBiometricLogin}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name={bioLabel.toLowerCase().includes('faciale') ? 'face-recognition' : 'fingerprint'}
                    size={22}
                    color={COLORS.primary}
                  />
                  <Text style={styles.bioButtonText}>{`Continuer avec ${bioLabel}`}</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity onPress={() => { setShowForgot(true); setForgotEmail(email); setForgotStep('email'); }} style={styles.forgotLink}>
                <Text style={styles.forgotLinkText}>Mot de passe oublié ?</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.formTitle}>Réinitialiser</Text>

              {forgotStep === 'email' && (
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Email</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="votre@email.com"
                    value={forgotEmail}
                    onChangeText={setForgotEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
              )}

              {forgotStep === 'code' && (
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Code de réinitialisation</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="000000"
                    value={resetCode}
                    onChangeText={(t) => setResetCode(t.replace(/\D/g, '').slice(0, 6))}
                    keyboardType="number-pad"
                    maxLength={6}
                    placeholderTextColor={COLORS.textSecondary}
                  />
                </View>
              )}

              {forgotStep === 'reset' && (
                <>
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Nouveau mot de passe</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="••••••••"
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry
                      placeholderTextColor={COLORS.textSecondary}
                    />
                  </View>
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Confirmer le mot de passe</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry
                      placeholderTextColor={COLORS.textSecondary}
                    />
                  </View>
                </>
              )}

              <TouchableOpacity
                style={[styles.button, forgotLoading && styles.buttonDisabled]}
                onPress={() => {
                  if (forgotStep === 'email') handleSendResetCode();
                  else if (forgotStep === 'code') setForgotStep('reset');
                  else handleResetPassword();
                }}
                disabled={forgotLoading}
              >
                {forgotLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>
                    {forgotStep === 'email' ? 'Envoyer le code' : forgotStep === 'code' ? 'Vérifier le code' : 'Réinitialiser'}
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => { setShowForgot(false); setForgotStep('email'); }} style={styles.forgotLink}>
                <Text style={styles.forgotLinkText}>Retour à la connexion</Text>
              </TouchableOpacity>
            </>
          )}

          <Text style={styles.footer}>ABRPOINT - Gestion du Temps</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flex: 0.35,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 20,
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoText: {
    fontSize: 60,
    marginBottom: 8,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 2,
  },
  appSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  form: {
    flex: 0.65,
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    paddingTop: 32,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 24,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    backgroundColor: '#fafafa',
    color: COLORS.text,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
    elevation: 3,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  formContent: {
    paddingBottom: 40,
  },
  footer: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 24,
  },
  forgotLink: {
    marginTop: 12,
    alignItems: 'center',
  },
  forgotLinkText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  bioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryFixed,
  },
  bioButtonText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 15,
  },
});
