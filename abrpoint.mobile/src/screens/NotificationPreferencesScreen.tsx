import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch, ActivityIndicator,
  TouchableOpacity, Alert, Linking, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Notifications from 'expo-notifications';
import apiService from '../services/api';
import { COLORS } from '../config/env';
import TimePickerModal from '../components/TimePickerModal';
import { useAuth } from '../contexts/AuthContext';
import { registerForPushAsync } from '../services/push';
import { useT } from '../i18n';

interface PrefItem {
  code: string;
  label: string;
  description: string;
  group: string;
  push: boolean;
  inapp: boolean;
}

const GROUP_LABEL_KEYS: Record<string, string> = {
  reminders: 'notifPrefs.grpReminders',
  leaves: 'notifPrefs.grpLeaves',
  authorizations: 'notifPrefs.grpAuthorizations',
  system: 'notifPrefs.grpSystem',
};

export default function NotificationPreferencesScreen({ navigation }: any) {
  const { user } = useAuth();
  const t = useT();
  const [items, setItems] = useState<PrefItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [original, setOriginal] = useState<Record<string, string>>({});
  // Diagnostic push : permet à l'utilisateur de vérifier qu'il a bien donné les
  // autorisations système et que le token Expo est enregistré côté serveur.
  const [permission, setPermission] = useState<'granted' | 'denied' | 'undetermined' | 'unknown'>('unknown');
  const [reRegistering, setReRegistering] = useState(false);
  const [testing, setTesting] = useState(false);

  const refreshPermission = async () => {
    try {
      const r = await Notifications.getPermissionsAsync();
      setPermission(r.status === 'granted' ? 'granted' : r.status === 'denied' ? 'denied' : 'undetermined');
    } catch {
      setPermission('unknown');
    }
  };

  useEffect(() => { refreshPermission(); }, []);

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
        if (!cancelled) Alert.alert(t('common.error'), t('notifPrefs.loadError'));
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
      Alert.alert(t('notifPrefs.saved'), t('notifPrefs.quietSaved'));
    } catch {
      Alert.alert(t('common.error'), t('notifPrefs.saveError'));
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
      Alert.alert(t('notifPrefs.saved'), t('notifPrefs.prefsSaved'));
    } catch {
      Alert.alert(t('common.error'), t('notifPrefs.saveError'));
    } finally {
      setSaving(false);
    }
  };

  // Force la re-demande de permission + ré-enregistre le token Expo côté backend.
  // Utile quand l'utilisateur a refusé puis a réactivé les notifications dans
  // les paramètres système, ou si l'enregistrement initial a échoué (pas de réseau).
  const handleReRegister = async () => {
    setReRegistering(true);
    try {
      const result = await registerForPushAsync(user?.soccod);
      await refreshPermission();
      if (result?.token) {
        Alert.alert(t('notifPrefs.pushReEnabled'), t('notifPrefs.pushReEnabledMsg'));
      } else {
        Alert.alert(
          t('notifPrefs.notifDisabledTitle'),
          t('notifPrefs.notifDisabledMsg'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('notifPrefs.openSettings'), onPress: () => Linking.openSettings() },
          ]
        );
      }
    } catch {
      Alert.alert(t('common.error'), t('notifPrefs.reEnableError'));
    } finally {
      setReRegistering(false);
    }
  };

  // Envoie une notification push de test à tous les devices de l'utilisateur.
  // Si rien ne s'affiche : permission OS bloquée, token expiré, ou heures
  // silencieuses actives — on suggère les actions correctives.
  const handleTestPush = async () => {
    if (!user?.uticod) return;
    setTesting(true);
    try {
      const r = await apiService.sendTestPush(user.uticod);
      if (r.sent > 0) {
        Alert.alert(
          t('notifPrefs.sentTitle'),
          t('notifPrefs.sentMsg', { n: r.sent })
        );
      } else {
        Alert.alert(
          t('notifPrefs.noDeviceTitle'),
          t('notifPrefs.noDeviceMsg')
        );
      }
    } catch {
      Alert.alert(t('common.error'), t('notifPrefs.testError'));
    } finally {
      setTesting(false);
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
          <Text style={styles.subHeader}>{t('notifPrefs.settings')}</Text>
          <Text style={styles.mainTitle}>{t('notifPrefs.title')}</Text>
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
          <Text style={styles.saveBtnText}>{saving ? '...' : t('notifPrefs.save')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>{t('notifPrefs.intro')}</Text>

        {/* ── Diagnostic push ── */}
        {/* Permet à l'utilisateur de vérifier que les permissions système sont
            accordées et de tester le pipeline push de bout en bout sans dépendre
            d'un événement métier. Indispensable quand "rien n'arrive" malgré les
            préférences activées. */}
        <View style={styles.groupBlock}>
          <View style={styles.groupHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MaterialCommunityIcons name="shield-check-outline" size={16} color={COLORS.secondary} />
              <Text style={styles.groupTitle}>{t('notifPrefs.diagnostic')}</Text>
            </View>
          </View>
          <View style={styles.card}>
            <View style={[styles.row, styles.rowDivider]}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.rowTitle}>{t('notifPrefs.sysPermTitle')}</Text>
                <Text style={styles.rowDesc}>
                  {permission === 'granted'
                    ? t('notifPrefs.sysPermGranted')
                    : permission === 'denied'
                    ? t('notifPrefs.sysPermDenied')
                    : permission === 'undetermined'
                    ? t('notifPrefs.sysPermUndetermined')
                    : t('notifPrefs.sysPermUnknown')}
                </Text>
              </View>
              {permission === 'denied' && (
                <TouchableOpacity onPress={() => Linking.openSettings()} style={styles.miniSaveBtn}>
                  <MaterialCommunityIcons name="cog-outline" size={14} color={COLORS.onPrimary} />
                  <Text style={styles.miniSaveBtnText}>{t('notifPrefs.settingsBtn')}</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={[styles.row, styles.rowDivider]}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.rowTitle}>{t('notifPrefs.reEnableTitle')}</Text>
                <Text style={styles.rowDesc}>{t('notifPrefs.reEnableDesc')}</Text>
              </View>
              <TouchableOpacity
                onPress={handleReRegister}
                disabled={reRegistering}
                style={[styles.miniSaveBtn, reRegistering && { opacity: 0.5 }]}
              >
                {reRegistering ? (
                  <ActivityIndicator size="small" color={COLORS.onPrimary} />
                ) : (
                  <MaterialCommunityIcons name="refresh" size={14} color={COLORS.onPrimary} />
                )}
                <Text style={styles.miniSaveBtnText}>{t('notifPrefs.reEnable')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.rowTitle}>{t('notifPrefs.testTitle')}</Text>
                <Text style={styles.rowDesc}>{t('notifPrefs.testDesc')}</Text>
              </View>
              <TouchableOpacity
                onPress={handleTestPush}
                disabled={testing}
                style={[styles.miniSaveBtn, testing && { opacity: 0.5 }]}
              >
                {testing ? (
                  <ActivityIndicator size="small" color={COLORS.onPrimary} />
                ) : (
                  <MaterialCommunityIcons name="bell-ring-outline" size={14} color={COLORS.onPrimary} />
                )}
                <Text style={styles.miniSaveBtnText}>{t('notifPrefs.testSend')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Heures silencieuses ── */}
        <View style={styles.groupBlock}>
          <View style={styles.groupHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MaterialCommunityIcons name="bed" size={16} color={COLORS.secondary} />
              <Text style={styles.groupTitle}>{t('notifPrefs.quietHours')}</Text>
            </View>
            {quietDirty && (
              <TouchableOpacity onPress={saveQuiet} style={styles.miniSaveBtn}>
                <MaterialCommunityIcons name="content-save-outline" size={14} color={COLORS.onPrimary} />
                <Text style={styles.miniSaveBtnText}>{t('notifPrefs.save')}</Text>
              </TouchableOpacity>
            )}
          </View>
          {/* Bandeau "actuellement silencieux" */}
          {quietStatus?.silent && (
            <View style={styles.silentBanner}>
              <MaterialCommunityIcons name="bell-sleep" size={16} color="#92400e" />
              <Text style={styles.silentBannerText}>
                {quietStatus.until ? t('notifPrefs.silentUntil', { time: quietStatus.until }) : (quietStatus.reason || t('notifPrefs.silent'))}
              </Text>
            </View>
          )}

          <View style={styles.card}>
            <View style={[styles.row, quiet.enabled && styles.rowDivider]}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.rowTitle}>{t('notifPrefs.enableQuiet')}</Text>
                <Text style={styles.rowDesc}>{t('notifPrefs.enableQuietDesc')}</Text>
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
                      <Text style={[styles.modeBtnText, quiet.mode === 'manual' && styles.modeBtnTextActive]}>{t('notifPrefs.modeManual')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modeBtn, quiet.mode === 'auto_poste' && styles.modeBtnActive]}
                      onPress={() => setQuiet(q => ({ ...q, mode: 'auto_poste' }))}
                    >
                      <MaterialCommunityIcons name="auto-fix" size={14} color={quiet.mode === 'auto_poste' ? COLORS.onPrimary : COLORS.outline} />
                      <Text style={[styles.modeBtnText, quiet.mode === 'auto_poste' && styles.modeBtnTextActive]}>{t('notifPrefs.modeAuto')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {quiet.mode === 'manual' ? (
                  <View style={[styles.row, { gap: 8 }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowDesc}>{t('notifPrefs.start')}</Text>
                      <TouchableOpacity style={styles.timeBtn} onPress={() => setPickerOpen('start')}>
                        <MaterialCommunityIcons name="weather-night" size={16} color={COLORS.primary} />
                        <Text style={styles.timeBtnText}>{quiet.start}</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowDesc}>{t('notifPrefs.end')}</Text>
                      <TouchableOpacity style={styles.timeBtn} onPress={() => setPickerOpen('end')}>
                        <MaterialCommunityIcons name="weather-sunny" size={16} color={COLORS.warning} />
                        <Text style={styles.timeBtnText}>{quiet.end}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={[styles.row, { gap: 8, alignItems: 'flex-start' }]}>
                    <MaterialCommunityIcons name="information-outline" size={18} color={COLORS.primary} style={{ marginTop: 2 }} />
                    <Text style={[styles.rowDesc, { flex: 1 }]}>{t('notifPrefs.autoInfo')}</Text>
                  </View>
                )}
              </>
            )}
          </View>
        </View>

        {grouped.map(([group, gItems]) => (
          <View key={group} style={styles.groupBlock}>
            <View style={styles.groupHeaderRow}>
              <Text style={styles.groupTitle}>{GROUP_LABEL_KEYS[group] ? t(GROUP_LABEL_KEYS[group]) : group}</Text>
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
                      <Text style={styles.channelLabel}>{t('notifPrefs.push')}</Text>
                      <Switch
                        value={it.push}
                        onValueChange={() => toggle(it.code, 'push')}
                        trackColor={{ false: COLORS.outlineVariant, true: COLORS.primaryFixedDim }}
                        thumbColor={it.push ? COLORS.primary : '#fff'}
                      />
                    </View>
                    <View style={styles.channelCell}>
                      <Text style={styles.channelLabel}>{t('notifPrefs.inApp')}</Text>
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
        title={pickerOpen === 'start' ? t('notifPrefs.quietStart') : t('notifPrefs.quietEnd')}
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
