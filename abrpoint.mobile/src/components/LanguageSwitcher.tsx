import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../config/env';
import { useI18n, type Lang } from '../i18n';

/**
 * Sélecteur de langue FR / EN (segmenté). Persiste le choix via le provider i18n
 * (SecureStore). À placer dans l'écran Profil.
 */
export default function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n();

  const Option = ({ value, label }: { value: Lang; label: string }) => {
    const active = lang === value;
    return (
      <TouchableOpacity
        style={[styles.option, active && styles.optionActive]}
        onPress={() => setLang(value)}
        activeOpacity={0.7}
      >
        <Text style={[styles.optionText, active && styles.optionTextActive]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{t('language.label')}</Text>
      <View style={styles.segment}>
        <Option value="fr" label={t('language.french')} />
        <Option value="en" label={t('language.english')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.onSurface },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 3,
  },
  option: { paddingVertical: 7, paddingHorizontal: 16, borderRadius: 8 },
  optionActive: { backgroundColor: COLORS.primary },
  optionText: { fontSize: 13, fontWeight: '700', color: COLORS.outline },
  optionTextActive: { color: '#fff' },
});
