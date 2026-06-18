import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import apiService from '../services/api';
import { COLORS } from '../config/env';
import { useI18n } from '../i18n';

type NotifItem = {
  id: number;
  title: string;
  body: string;
  category?: string | null;
  dataJson?: string | null;
  createdAt: string;
  readAt?: string | null;
};

type Filter = 'all' | 'unread';

// Nom de glyphe MaterialCommunityIcons (typage strict apporté par @expo/vector-icons).
type MCIName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
type NotifMeta = { color: string; bg: string; icon: MCIName; labelKey: string };

const CATEGORY_META: Record<string, NotifMeta> = {
  reminder_in:           { color: COLORS.primary,   bg: COLORS.primaryFixed,    icon: 'login',           labelKey: 'notif.catReminderIn' },
  reminder_out:          { color: COLORS.warning,   bg: '#fff1c2',              icon: 'logout',          labelKey: 'notif.catReminderOut' },
  leave_request_created: { color: COLORS.accent,    bg: COLORS.secondaryFixed,  icon: 'inbox-arrow-down',labelKey: 'notif.catLeaveCreated' },
  leave_request_accepted:{ color: COLORS.tertiary,  bg: COLORS.tertiaryFixed,   icon: 'check-circle',    labelKey: 'notif.catLeaveAccepted' },
  leave_request_refused: { color: COLORS.error,     bg: COLORS.errorContainer,  icon: 'close-circle',    labelKey: 'notif.catLeaveRefused' },
  auth_request_created:  { color: COLORS.accent,    bg: COLORS.secondaryFixed,  icon: 'inbox-arrow-down',labelKey: 'notif.catAuthCreated' },
  auth_request_accepted: { color: COLORS.tertiary,  bg: COLORS.tertiaryFixed,   icon: 'check-circle',    labelKey: 'notif.catAuthAccepted' },
  auth_request_refused:  { color: COLORS.error,     bg: COLORS.errorContainer,  icon: 'close-circle',    labelKey: 'notif.catAuthRefused' },
  test_push:             { color: COLORS.secondary, bg: COLORS.surfaceContainerLow, icon: 'flask',       labelKey: 'notif.catTest' },
};

const FALLBACK_META: NotifMeta = { color: COLORS.secondary, bg: COLORS.surfaceContainerLow, icon: 'bell-outline', labelKey: 'notif.catDefault' };

type TFunc = (key: string, vars?: Record<string, string | number>) => string;

function formatRelative(dateStr: string, t: TFunc, locale: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return t('notif.relNow');
  if (diffMin < 60) return t('notif.relMin', { n: diffMin });
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return t('notif.relHour', { n: diffH });
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return t('notif.relDay', { n: diffD });
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

export default function NotificationsScreen({ navigation }: any) {
  const { t, lang } = useI18n();
  const locale = lang === 'en' ? 'en-GB' : 'fr-FR';
  const [items, setItems] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  const load = useCallback(async () => {
    try {
      const data = await apiService.listNotifications(100, filter === 'unread');
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.log('Failed to load notifications', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const unreadCount = useMemo(() => items.filter(i => !i.readAt).length, [items]);

  const onItemPress = async (n: NotifItem) => {
    if (!n.readAt) {
      try {
        await apiService.markNotificationRead(n.id);
        setItems(prev => prev.map(x => x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x));
      } catch { /* noop */ }
    }
    // Deep-link basique selon la catégorie.
    const cat = n.category || '';
    if (cat.startsWith('leave_request')) navigation.navigate('LeaveRequest');
    else if (cat.startsWith('auth_request')) navigation.navigate('DemandeAutorisation');
    else if (cat.startsWith('reminder')) navigation.navigate('Home');
  };

  const onLongPress = (n: NotifItem) => {
    Alert.alert(t('notif.deleteTitle'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'), style: 'destructive',
        onPress: async () => {
          try {
            await apiService.deleteNotification(n.id);
            setItems(prev => prev.filter(x => x.id !== n.id));
          } catch { /* noop */ }
        },
      },
    ]);
  };

  const onMarkAllRead = async () => {
    if (unreadCount === 0) return;
    try {
      await apiService.markAllNotificationsRead();
      const now = new Date().toISOString();
      setItems(prev => prev.map(x => x.readAt ? x : { ...x, readAt: now }));
    } catch { /* noop */ }
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topAppBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={COLORS.onSurface} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.subHeader}>{t('notif.center')}</Text>
          <Text style={styles.mainTitle}>{t('notif.title')}</Text>
        </View>
        <TouchableOpacity onPress={onMarkAllRead} disabled={unreadCount === 0} style={[styles.iconButton, unreadCount === 0 && { opacity: 0.4 }]}>
          <MaterialCommunityIcons name="email-open-outline" size={22} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        {(['all', 'unread'] as Filter[]).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
              {f === 'all' ? t('notif.all') : `${t('notif.unread')}${unreadCount ? ` · ${unreadCount}` : ''}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={items}
        keyExtractor={(n) => String(n.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="bell-off-outline" size={42} color={COLORS.outline} />
            <Text style={styles.emptyText}>
              {filter === 'unread' ? t('notif.emptyUnread') : t('notif.emptyAll')}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const meta = (item.category && CATEGORY_META[item.category]) || FALLBACK_META;
          const unread = !item.readAt;
          return (
            <TouchableOpacity
              style={[styles.row, unread && styles.rowUnread]}
              onPress={() => onItemPress(item)}
              onLongPress={() => onLongPress(item)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconBox, { backgroundColor: meta.bg }]}>
                <MaterialCommunityIcons name={meta.icon} size={22} color={meta.color} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.titleRow}>
                  <Text style={[styles.title, unread && { color: COLORS.onSurface }]}>{item.title}</Text>
                  {unread && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>{formatRelative(item.createdAt, t, locale)}</Text>
                  {item.category && (
                    <Text style={[styles.metaText, { color: meta.color, marginLeft: 8 }]}>· {t(meta.labelKey)}</Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topAppBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  iconButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.primaryFixed },
  subHeader: { fontSize: 10, fontWeight: '700', color: COLORS.secondary, letterSpacing: 1.5, textTransform: 'uppercase' },
  mainTitle: { fontSize: 24, fontWeight: '800', color: COLORS.onSurface, letterSpacing: -0.5 },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: COLORS.surfaceContainerLow },
  filterChipActive: { backgroundColor: COLORS.primary },
  filterChipText: { fontSize: 12, fontWeight: '700', color: COLORS.onSurfaceVariant },
  filterChipTextActive: { color: '#fff' },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  empty: { alignItems: 'center', padding: 48, gap: 12 },
  emptyText: { fontSize: 13, color: COLORS.outline, fontWeight: '600' },
  row: {
    flexDirection: 'row', gap: 14,
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10,
  },
  rowUnread: { borderLeftWidth: 3, borderLeftColor: COLORS.primary },
  iconBox: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 14, fontWeight: '800', color: COLORS.onSurface, flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  body: { fontSize: 13, color: COLORS.onSurfaceVariant, marginTop: 4, lineHeight: 18 },
  metaRow: { flexDirection: 'row', marginTop: 6 },
  metaText: { fontSize: 11, color: COLORS.outline, fontWeight: '600' },
});
