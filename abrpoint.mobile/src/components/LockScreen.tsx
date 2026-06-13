import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../config/env';
import { useInactivity } from '../contexts/InactivityContext';
import { useAuth } from '../contexts/AuthContext';
import {
  authenticateBiometric,
  getBiometricCapabilities,
  isBiometricLoginEnabled,
} from '../services/biometric';
import apiService from '../services/api';

/**
 * Écran de verrouillage qui s'affiche en overlay quand `isLocked === true`.
 *
 * Stratégie de re-authentification (par ordre de préférence) :
 *   1. Biométrie déjà configurée → demande FaceID/TouchID, si succès → unlock
 *   2. Sinon → bouton "Se déconnecter" qui appelle apiService.logout()
 *      → l'utilisateur retombe sur le LoginScreen.
 *
 * On ne demande PAS le mot de passe ici (saisie clavier visible = mauvaise UX
 * pour un re-lock fréquent). Si pas de biométrie disponible, c'est full logout.
 */
export default function LockScreen() {
  const { isLocked, unlock } = useInactivity();
  const { user, logout, isAuthenticated } = useAuth();
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioLabel, setBioLabel] = useState('Biométrie');
  const [authenticating, setAuthenticating] = useState(false);

  // Auto-unlock si non authentifié (l'utilisateur est déjà sur LoginScreen,
  // pas la peine de lui afficher un overlay verrouillé par-dessus son login).
  useEffect(() => {
    if (!isAuthenticated && isLocked) unlock();
  }, [isAuthenticated, isLocked, unlock]);

  useEffect(() => {
    if (!isLocked) return;
    (async () => {
      const caps = await getBiometricCapabilities();
      const enabled = await isBiometricLoginEnabled();
      setBioAvailable(caps.hasHardware && caps.isEnrolled && enabled);
      setBioLabel(caps.label);
    })();
  }, [isLocked]);

  // Tentative biométrique automatique dès l'apparition du lock.
  useEffect(() => {
    if (!isLocked || !bioAvailable || authenticating) return;
    handleBiometricUnlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocked, bioAvailable]);

  const handleBiometricUnlock = async () => {
    setAuthenticating(true);
    try {
      // Le lock screen n'a pas besoin du bio-token : les JWT sont toujours
      // valides en SecureStore (le verrou est purement local). Une simple
      // vérification biométrique du device suffit pour rendre la main.
      const ok = await authenticateBiometric('Déverrouillez Concorde Workly');
      if (ok) {
        unlock();
      }
    } catch {
      // Cancel ou erreur → reste verrouillé, l'utilisateur peut retenter ou logout.
    } finally {
      setAuthenticating(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Se déconnecter ?',
      'Vous devrez ressaisir votre email et mot de passe.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Se déconnecter',
          style: 'destructive',
          onPress: async () => {
            await logout();
            unlock(); // évite de garder l'écran de verrou par-dessus le login.
          },
        },
      ],
    );
  };

  if (!isLocked || !isAuthenticated) return null;

  return (
    <View style={styles.container} pointerEvents="auto">
      <LinearGradient
        colors={[COLORS.primary, COLORS.primaryContainer ?? '#0056d2']}
        style={StyleSheet.absoluteFillObject}
      />
      <Image source={require('../../assets/concorde-workly-logo.png')} style={styles.logo} resizeMode="contain" />
      <Text style={styles.title}>Session verrouillée</Text>
      <Text style={styles.subtitle}>
        {user?.utilib ? `${user.utilib} — ` : ''}Inactivité détectée
      </Text>

      {bioAvailable ? (
        <TouchableOpacity style={styles.unlockBtn} onPress={handleBiometricUnlock} disabled={authenticating}>
          <MaterialCommunityIcons name="fingerprint" size={28} color="#fff" />
          <Text style={styles.unlockText}>{authenticating ? 'Vérification…' : `Déverrouiller via ${bioLabel}`}</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.note}>
          <MaterialCommunityIcons name="information-outline" size={18} color="rgba(255,255,255,0.8)" />
          <Text style={styles.noteText}>
            La biométrie n'est pas configurée. Veuillez vous reconnecter.
          </Text>
        </View>
      )}

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Se déconnecter</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    zIndex: 10000,
    elevation: 10000,
  },
  logo: { width: 100, height: 100, marginBottom: 24, opacity: 0.95 },
  title: { fontSize: 22, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 8, marginBottom: 36 },
  unlockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  unlockText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    maxWidth: 320,
  },
  noteText: { color: 'rgba(255,255,255,0.9)', fontSize: 13, flexShrink: 1 },
  logoutBtn: { marginTop: 24, padding: 12 },
  logoutText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
});
