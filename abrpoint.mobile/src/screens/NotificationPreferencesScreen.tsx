import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch, ActivityIndicator,
  TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import apiService from '../services/api';
import { COLORS } from '../config/env';
import TimePickerModal from '../components/TimePickerModal';

interface PrefItem {
  code: string;
  label: string;
  description: string;
  group: string;
  push: boolean;
  inapp: boolean;
}

const GROUP_LABELS: Record<string, string> = {
  reminders: 'Rappels',
  leaves: 'Congés',
  authorizations: 'Autorisations',
  system: 'Système',
};

export default function NotificationPreferencesScreen({ navigation }: any) {
  const [items, setItems] = useState<PrefItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [original, setOriginal] = useState<Record<string, string>>({});

  // Heures silencieuses (manuel ou auto depuis le poste)
  const defaultQuiet = { enabled: false, mode: 'manual' as 'manual' | 'auto_poste', start: '22:00', end: '07:00' };
  const [quiet, setQuiet] = useState(defaultQuiet);
  const [originalQuiet, setOriginalQuiet] = useState(defaultQuiet);
  const [pickerOpen, setPickerOpen] = useState<null | 'start' | 'end'>(null);
  const [quietStatus, setQuietStatus] = useState<{ silent: boolean; until?: string | null; reason?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [data, qh, qs] = await Promise.all([
          apiService.getNotificationPreferences(),
          apiService.getQuietHours(),
          apiService.getQuietStatus(),
        ]);
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setItems(list);
        setOriginal(Object.fromEntries(list.map(i => [i.code, `${i.push}:${i.inapp}`])));
        const next = {
          enabled: !!qh.enabled,
          mode: (qh.mode === 'auto_poste' ? 'auto_poste' : 'manual') as 'manual' | 'auto_poste',
          start: qh.start || '22:00',
          end: qh.end || '07:00',
        };
        setQuiet(next);
        setOriginalQuiet(next);
        setQuietStatus(qs || null);
      } catch {
        if (!cancelled) Alert.alert('Erreur', 'Impossible de charger les préférences.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const quietDirty = useMemo(
    () => quiet.enabled !== originalQuiet.enabled
      || quiet.mode !== originalQuiet.mode
      || quiet.start !== originalQuiet.start
      || quiet.end !== originalQuiet.end,
    [quiet, originalQuiet]
  );

  const saveQuiet = async () => {
    try {
      await apiService.updateQuietHours({
        Enabled: quiet.enabled, Mode: quiet.mode, Start: quiet.start, End: quiet.end,
      });
      setOriginalQuiet(quiet);
      try { setQuietStatus(await apiService.getQuietStatus()); } catch { /* noop */ }
      Alert.alert('✅ Enregistré', 'Heures silencieuses mises à jour.');
    } catch {
      Alert.alert('Erreur', 'Enregistrement impossible.');
    }
  };

  const stringToDate = (hhmm: string): Date => {
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date();
    d.setHours(h || 0, m || 0, 0, 0);
    return d;
  };
  const dateToHHmm = (d: Date): string => {
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const grouped = useMemo(() => {
    const m = new Map<string, PrefItem[]>();
    for (const it of items) {
      const k = it.group || 'system';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(it);
    }
    return Array.from(m.entries());
  }, [items]);

  const dirty = useMemo(
    () => items.some(it => original[it.code] !== `${it.push}:${it.inapp}`),
    [items, original]
  );

  const toggle = (code: string, channel: 'push' | 'inapp') => {
    setItems(prev => prev.map(it => it.code === code ? { ...it, [channel]: !it[channel] } : it));
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = items.map(it => ({ code: it.code, push: it.push, inapp: it.inapp }));
      await apiService.updateNotificationPreferences(payload);
      setOriginal(Object.fromEntries(items.map(i => [i.code, `${i.push}:${i.inapp}`])));
      Alert.alert('✅ Enregistré', 'Vos préférences de notification ont été mises à jour.');
    } catch {
      Alert.alert('Erreur', 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
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
      <View style={styles.topAppBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={COLORS.onSurface} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.subHeader}>Réglages</Text>
          <Text style={styles.mainTitle}>Notifications</Text>
        </View>
        <TouchableOpacity
          onPress={save}
          disabled={!dirty || saving}
          style={[styles.saveBtn, (!dirty || saving) && { opacity: 0.4 }]}
        >
          {saving ? (
            <ActivityIndicator size="small" color={COLORS.onPrimary} />
          ) : (
            <MaterialCommunityIcons name="content-save-outline" size={18} color={COLORS.onPrimary} />
          )}
          <Text style={styles.saveBtnText}>{saving ? '...' : 'Enregistrer'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>
          Choisissez les types de notifications que vous souhaitez recevoir. Désactivé = aucun push, aucune entrée
          dans le centre de notifications.
        </Text>

        {/* ── Heures silencieuses ── */}
        <View style={styles.groupBlock}>
          <View style={styles.groupHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MaterialCommunityIcons name="bed" size={16} color={COLORS.secondary} />
              <Text style={styles.groupTitle}>Heures silencieuses</Text>
            </View>
            {quietDirty && (
              <TouchableOpacity onPress={saveQuiet} style={styles.miniSaveBtn}>
                <MaterialCommunityIcons name="content-save-outline" size={14} color={COLORS.onPrimary} />
                <Text style={styles.miniSaveBtnText}>Enregistrer</Text>
              </TouchableOpacity>
            )}
          </View>
          {/* Bandeau "actuellement silencieux" */}
          {quietStatus?.silent && (
            <View style={styles.silentBanner}>
              <MaterialCommunityIcons name="bell-sleep" size={16} color="#92400e" />
              <Text style={styles.silentBannerText}>
                {quietStatus.until ? `Silencieux jusqu'à ${quietStatus.until}.` : (quietStatus.reason || 'Silencieux.')}
              </Text>
            </View>
          )}

          <View style={styles.card}>
            <View style={[styles.row, quiet.enabled && styles.rowDivider]}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.rowTitle}>Activer les heures silencieuses</Text>
                <Text style={styles.rowDesc}>
                  Pendant ce créneau, les push sont supprimés. L'historique reste visible dans le centre.
                </Text>
              </View>
              <Switch
                value={quiet.enabled}
                onValueChange={() => setQuiet(q => ({ ...q, enabled: !q.enabled }))}
                trackColor={{ false: COLORS.outlineVariant, true: COLORS.primaryFixedDim }}
                thumbColor={quiet.enabled ? COLORS.primary : '#fff'}
              />
            </View>

            {quiet.enabled && (
              <>
                {/* Sélecteur de mode */}
                <View style={[styles.row, styles.rowDivider, { paddingTop: 6 }]}>
                  <View style={styles.modeSwitcher}>
                    <TouchableOpacity
                      style={[styles.modeBtn, quiet.mode === 'manual' && styles.modeBtnActive]}
                      onPress={() => setQuiet(q => ({ ...q, mode: 'manual' }))}
                    >
                      <MaterialCommunityIcons name="clock-outline" size={14} color={quiet.mode === 'manual' ? COLORS.onPrimary : COLORS.outline} />
                      <Text style={[styles.modeBtnText, quiet.mode === 'manual' && styles.modeBtnTextActive]}>Manuel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modeBtn, quiet.mode === 'auto_poste' && styles.modeBtnActive]}
                      onPress={() => setQuiet(q => ({ ...q, mode: 'auto_poste' }))}
                    >
                      <MaterialCommunityIcons name="auto-fix" size={14} color={quiet.mode === 'auto_poste' ? COLORS.onPrimary : COLORS.outline} />
                      <Text style={[styles.modeBtnText, quiet.mode === 'auto_poste' && styles.modeBtnTextActive]}>Selon mon poste</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {quiet.mode === 'manual' ? (
                  <View style={[styles.row, { gap: 8 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowDesc}>Début</Text>
                      <TouchableOpacity style={styles.timeBtn} onPress={() => setPickerOpen('start')}>
                        <MaterialCommunityIcons name="weather-night" size={16} color={COLORS.primary} />
                        <Text style={styles.timeBtnText}>{quiet.start}</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowDesc}>Fin</Text>
                      <TouchableOpacity style={styles.timeBtn} onPress={() => setPickerOpen('end')}>
                        <MaterialCommunityIcons name="weather-sunny" size={16} color={COLORS.warning} />
                        <Text style={styles.timeBtnText}>{quiet.end}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={[styles.row, { gap: 8, alignItems: 'flex-start' }]}>
                    <MaterialCommunityIcons name="information-outline" size={18} color={COLORS.primary} style={{ marginTop: 2 }} />
                    <Text style={[styles.rowDesc, { flex: 1 }]}>
                      Vous serez silencieux en dehors des heures de votre poste. Le créneau s'ajuste
                      automatiquement chaque jour selon votre planning de travail.
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
        </View>

        {grouped.map(([group, gItems]) => (
          <View key={group} style={styles.groupBlock}>
            <View style={styles.groupHeaderRow}>
              <Text style={styles.groupTitle}>{GROUP_LABELS[group] || group}</Text>
            </View>
            <View style={styles.card}>
              {gItems.map((it, idx) => (
                <View
                  key={it.code}
                  style={[styles.row, idx < gItems.length - 1 && styles.rowDivider]}
                >
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.rowTitle}>{it.label}</Text>
                    <Text style={styles.rowDesc}>{it.description}</Text>
                  </View>
                  <View style={styles.channelGroup}>
                    <View style={styles.channelCell}>
                      <Text style={styles.channelLabel}>Push</Text>
                      <Switch
                        value={it.push}
                        onValueChange={() => toggle(it.code, 'push')}
                        trackColor={{ false: COLORS.outlineVariant, true: COLORS.primaryFixedDim }}
                        thumbColor={it.push ? COLORS.primary : '#fff'}
                      />
                    </View>
                    <View style={styles.channelCell}>
                      <Text style={styles.channelLabel}>Centre</Text>
                      <Switch
                        value={it.inapp}
                        onValueChange={() => toggle(it.code, 'inapp')}
                        trackColor={{ false: COLORS.outlineVariant, true: COLORS.primaryFixedDim }}
                        thumbColor={it.inapp ? COLORS.primary : '#fff'}
                      />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <TimePickerModal
        visible={pickerOpen !== null}
        value={pickerOpen ? stringToDate(pickerOpen === 'start' ? quiet.start : quiet.end) : new Date()}
        onChange={(d) => {
          if (pickerOpen === 'start') setQuiet(q => ({ ...q, start: dateToHHmm(d) }));
          else if (pickerOpen === 'end') setQuiet(q => ({ ...q, end: dateToHHmm(d) }));
        }}
        onClose={() => setPickerOpen(null)}
        title={pickerOpen === 'start' ? 'Début du silence' : 'Fin du silence'}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topAppBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  iconBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.primaryFixed },
  subHeader: { fontSize: 10, fontWeight: '700', color: COLORS.secondary, letterSpacing: 1.5, textTransform: 'uppercase' },
  mainTitle: { fontSize: 22, fontWeight: '800', color: COLORS.onSurface, letterSpacing: -0.5 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: COLORS.primary, borderRadius: 16,
  },
  saveBtnText: { color: COLORS.onPrimary, fontWeight: '700', fontSize: 13 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 32 },
  intro: { fontSize: 13, color: COLORS.onSurfaceVariant, lineHeight: 18, marginBottom: 20 },
  groupBlock: { marginBottom: 24 },
  groupTitle: {
    fontSize: 11, fontWeight: '800', color: COLORS.secondary,
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8, paddingHorizontal: 4,
  },
  card: { backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: COLORS.outlineVariant },
  rowTitle: { fontSize: 14, fontWeight: '700', color: COLORS.onSurface },
  rowDesc: { fontSize: 12, color: COLORS.onSurfaceVariant, marginTop: 2, lineHeight: 16 },
  channelGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  channelCell: { alignItems: 'center', gap: 2 },
  channelLabel: { fontSize: 10, fontWeight: '700', color: COLORS.outline, letterSpacing: 0.3 },
  groupHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 4, marginBottom: 8,
  },
  miniSaveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  miniSaveBtnText: { color: COLORS.onPrimary, fontSize: 11, fontWeight: '700' },
  timeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.surfaceContainerLow,
    borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12,
    marginTop: 6,
  },
  timeBtnText: { fontSize: 16, fontWeight: '800', color: COLORS.onSurface },
  silentBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fef3c7', borderColor: '#fde68a', borderWidth: 1,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10,
  },
  silentBannerText: { color: '#92400e', fontWeight: '700', fontSize: 12, flex: 1 },
  modeSwitcher: { flexDirection: 'row', backgroundColor: COLORS.surfaceContainerLow, borderRadius: 10, padding: 3, gap: 3, flex: 1 },
  modeBtn: {
    flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 6, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8,
  },
  modeBtnActive: { backgroundColor: COLORS.primary },
  modeBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.outline },
  modeBtnTextActive: { color: COLORS.onPrimary },
});
