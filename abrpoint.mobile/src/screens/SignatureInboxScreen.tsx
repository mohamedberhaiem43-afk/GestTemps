import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import apiService from '../services/api';
import { COLORS } from '../config/env';
import { useI18n } from '../i18n';

// Miroir de SignatureInboxItem (api/Signatures/inbox), sérialisé en camelCase.
interface InboxItem {
  requestId: number;
  stepId: number;
  stepOrder: number;
  sourceType: string;
  sourceId?: string | null;
  documentVaultId?: number | null;
  docName: string;
  createdAt: string;
}

/**
 * Boîte « À signer » du salarié : liste les étapes de signature en attente qui lui
 * sont assignées (api/Signatures/inbox). Donne un point d'entrée permanent vers le
 * circuit de signature, indépendant de la notification push (qui pouvait être ratée
 * ou supprimée). Un tap ouvre SignatureScreen en mode workflow (requestId + stepId).
 */
export default function SignatureInboxScreen({ navigation }: any) {
  const { t, lang } = useI18n();
  const locale = lang === 'en' ? 'en-GB' : 'fr-FR';
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiService.getSignatureInbox();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.log('Failed to load signature inbox', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { setLoading(true); load(); }, [load]);

  // Recharge à chaque retour sur l'écran (ex : après avoir signé une étape).
  useEffect(() => {
    const unsub = navigation?.addListener?.('focus', load);
    return unsub;
  }, [navigation, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openItem = (item: InboxItem) => {
    navigation.navigate('Signature', {
      workflow: true,
      requestId: item.requestId,
      stepId: item.stepId,
      documentId: item.documentVaultId ?? undefined,
      docName: item.docName,
    });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const renderItem = ({ item }: { item: InboxItem }) => (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => openItem(item)}>
      <View style={styles.iconBox}>
        <MaterialCommunityIcons name="file-sign" size={24} color={COLORS.primary} />
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.docName}</Text>
        <Text style={styles.cardSub}>{t('signatureInbox.receivedOn', { date: formatDate(item.createdAt) })}</Text>
        <View style={styles.pendingBadge}>
          <MaterialCommunityIcons name="clock-outline" size={11} color="#92400e" />
          <Text style={styles.pendingText}>{t('signatureInbox.pendingBadge')}</Text>
        </View>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={24} color="#cbd5e1" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* TopAppBar */}
      <View style={styles.topAppBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.onSurface} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{t('signatureInbox.title')}</Text>
        <View style={styles.iconButton} />
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => `${it.requestId}-${it.stepId}`}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={
            <Text style={styles.subtitle}>{t('signatureInbox.subtitle')}</Text>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="check-decagram-outline" size={64} color="#e2e8f0" />
              <Text style={styles.emptyText}>{t('signatureInbox.empty')}</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topAppBar: {
    height: 64, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, backgroundColor: COLORS.background,
  },
  iconButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  topTitle: { fontSize: 18, fontWeight: '800', color: COLORS.onSurface },
  listContent: { padding: 20, paddingBottom: 40, flexGrow: 1 },
  subtitle: { fontSize: 13, color: COLORS.outline, fontWeight: '500', marginBottom: 20 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1,
  },
  iconBox: {
    width: 48, height: 48, borderRadius: 12, backgroundColor: 'rgba(0, 64, 161, 0.06)',
    justifyContent: 'center', alignItems: 'center',
  },
  cardContent: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.onSurface },
  cardSub: { fontSize: 11, color: COLORS.outline, fontWeight: '500' },
  pendingBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    backgroundColor: '#fef3c7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginTop: 2,
  },
  pendingText: { fontSize: 9, fontWeight: '800', color: '#92400e', letterSpacing: 0.3 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 80 },
  emptyText: { fontSize: 14, color: COLORS.outline, fontWeight: '600', textAlign: 'center' },
});
