import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDeviceTrust } from '../hooks/useDeviceTrust';
import { COLORS } from '../config/env';

const REASON_LABELS: Record<string, string> = {
  emulator_or_simulator: 'Appareil non physique détecté (émulateur ou simulateur)',
  emulator_signature: 'Signature d\'émulateur détectée (marque ou modèle suspect)',
  ios_outdated: 'iOS très ancien — vulnérabilités non patchées probables',
  android_outdated: 'Android très ancien — vulnérabilités non patchées probables',
  assessment_failed: 'Impossible d\'évaluer la sécurité de l\'appareil',
};

/**
 * Bandeau d'avertissement non-bloquant affiché sur les écrans sensibles
 * lorsque la confiance device est dégradée. Tap → modal explicatif.
 *
 * Usage : place-le sous l'app bar des écrans qui en ont besoin (Home,
 * DigitalVault, Profile). Auto-hide si trust = high.
 */
export default function DeviceTrustBanner() {
  const trust = useDeviceTrust();
  const [open, setOpen] = useState(false);

  if (!trust) return null;
  if (trust.level === 'high') return null;

  const isLow = trust.level === 'low';
  const bg = isLow ? '#7f1d1d' : '#92400e';
  const icon = isLow ? 'shield-alert' : 'shield-half-full';
  const label = isLow ? 'Appareil à risque' : 'Niveau de confiance dégradé';

  return (
    <>
      <TouchableOpacity style={[styles.banner, { backgroundColor: bg }]} onPress={() => setOpen(true)}>
        <MaterialCommunityIcons name={icon} size={18} color="#fff" />
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.more}>Détails →</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <MaterialCommunityIcons name={icon} size={28} color={bg} />
              <Text style={styles.modalTitle}>{label}</Text>
            </View>
            <ScrollView style={{ maxHeight: 320 }}>
              <Text style={styles.modalIntro}>
                Concorde Workly a détecté un ou plusieurs facteurs qui réduisent
                la confiance dans cet appareil. Les fonctions sensibles (signature
                électronique, activation biométrique) peuvent être limitées.
              </Text>
              <View style={styles.reasonsList}>
                {trust.reasons.map((r, i) => (
                  <View key={i} style={styles.reasonItem}>
                    <MaterialCommunityIcons name="alert-circle-outline" size={16} color={bg} />
                    <Text style={styles.reasonText}>{REASON_LABELS[r] ?? r}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.modalHint}>
                Si vous utilisez l'application en environnement de test, vous pouvez
                ignorer cet avertissement. En production, contactez votre administrateur
                si l'alerte persiste sur un téléphone normal.
              </Text>
            </ScrollView>
            <TouchableOpacity onPress={() => setOpen(false)} style={[styles.modalBtn, { backgroundColor: bg }]}>
              <Text style={styles.modalBtnText}>Compris</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 10,
  },
  label: { color: '#fff', fontSize: 12, fontWeight: '700', flex: 1 },
  more: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '700' },
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '100%', maxWidth: 420,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.onSurface },
  modalIntro: { fontSize: 13, color: COLORS.onSurfaceVariant, lineHeight: 19, marginBottom: 16 },
  reasonsList: { gap: 8, marginBottom: 16 },
  reasonItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  reasonText: { fontSize: 13, color: COLORS.onSurface, flex: 1 },
  modalHint: { fontSize: 12, color: COLORS.outline, fontStyle: 'italic', marginBottom: 16, lineHeight: 17 },
  modalBtn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  modalBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
