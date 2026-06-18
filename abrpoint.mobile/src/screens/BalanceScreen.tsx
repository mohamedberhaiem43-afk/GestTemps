import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import { COLORS } from '../config/env';
import { useSecureScreen } from '../hooks/useSecureScreen';
import { useT } from '../i18n';

interface RttKpi { methode: string; droitAnnuel: number; pris: number; solde: number; }

export default function BalanceScreen({ navigation }: any) {
  // SEC-G4 : soldes congés / RTT = données RH personnelles.
  useSecureScreen();
  const { user } = useAuth();
  const t = useT();
  const [balance, setBalance] = useState<any[]>([]);
  const [rtt, setRtt] = useState<RttKpi | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { load(); }, [user]);

  const load = async () => {
    if (!user?.soccod || !user?.uticod) return;
    try {
      const now = new Date();
      const moisdeb = '01';
      const moisfin = String(now.getMonth() + 1).padStart(2, '0');
      const annee = String(now.getFullYear());
      const data = await apiService.getEmpLeaveBalance(user.soccod, user.uticod, moisdeb, moisfin, annee);
      setBalance(Array.isArray(data) ? data : data ? [data] : []);
    } catch (e) { console.log('Balance load error:', e); }

    // Charge le solde RTT en parallèle (via les KPIs). Si l'employé n'est pas
    // éligible (méthode 'N'), le backend renvoie rtt:null et on masque la carte.
    try {
      const k = await apiService.getMyKPIs(user.soccod, user.uticod);
      if (k?.rtt) {
        setRtt({
          methode: k.rtt.methode,
          droitAnnuel: k.rtt.droitAnnuel || 0,
          pris: k.rtt.pris || 0,
          solde: k.rtt.solde || 0,
        });
      } else {
        setRtt(null);
      }
    } catch (e) { console.log('RTT load error:', e); }
  };

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>← {t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('balance.title')}</Text>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16 }}
      >
        {/* Carte RTT — toujours visible. Si l'employé n'est pas éligible
            (rtt null côté backend ou méthode 'N'), on affiche un placeholder
            explicite pour que l'utilisateur ne se demande pas où est sa donnée. */}
        {(() => {
          const isEligible = !!rtt && rtt.methode !== 'N' && rtt.droitAnnuel > 0;
          const methodeLabel = rtt
            ? (rtt.methode === 'M' ? t('balance.methodMonthly')
              : rtt.methode === 'H' ? t('balance.methodHourly')
              : rtt.methode === 'F' ? t('balance.methodFlat')
              : t('balance.methodNotEligible'))
            : t('balance.methodNotConfigured');
          return (
            <View style={styles.rttCard}>
              <View style={styles.rttHeader}>
                <View style={styles.rttIconWrap}>
                  <MaterialCommunityIcons name="briefcase-clock-outline" size={24} color="#10b981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rttCardTitle}>{t('balance.rttTitle')}</Text>
                  <Text style={styles.rttMeta}>{t('balance.method', { m: methodeLabel })}</Text>
                </View>
              </View>
              {isEligible && rtt ? (
                <>
                  <View style={styles.rttRow}>
                    <View style={styles.rttItem}>
                      <Text style={styles.rttItemLabel}>{t('balance.accrued')}</Text>
                      <Text style={[styles.rttItemValue, { color: COLORS.success }]}>{rtt.droitAnnuel.toFixed(1)}</Text>
                    </View>
                    <View style={styles.rttItem}>
                      <Text style={styles.rttItemLabel}>{t('balance.taken')}</Text>
                      <Text style={[styles.rttItemValue, { color: COLORS.error }]}>{rtt.pris.toFixed(1)}</Text>
                    </View>
                    <View style={styles.rttItem}>
                      <Text style={styles.rttItemLabel}>{t('balance.remaining')}</Text>
                      <Text style={[styles.rttItemValue, { color: '#10b981' }]}>{rtt.solde.toFixed(1)}</Text>
                    </View>
                  </View>
                  <View style={styles.rttProgressBar}>
                    <View
                      style={[
                        styles.rttProgressFill,
                        { width: `${rtt.droitAnnuel > 0 ? Math.min(100, (rtt.pris / rtt.droitAnnuel) * 100) : 0}%` },
                      ]}
                    />
                  </View>
                </>
              ) : (
                <Text style={styles.rttEmptyText}>
                  {rtt && rtt.methode === 'N'
                    ? t('balance.notEligible')
                    : t('balance.noRtt')}
                </Text>
              )}
            </View>
          );
        })()}

        {/* Section Congés payés */}
        <Text style={styles.sectionLabel}>{t('balance.paidLeave')}</Text>

        {balance.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💰</Text>
            <Text style={styles.emptyText}>{t('balance.noBalance')}</Text>
          </View>
        ) : (
          balance.map((item: any, i: number) => (
            <View key={i} style={styles.balanceCard}>
              <Text style={styles.balanceTitle}>{item.concod || item.rubcod || t('balance.leaveN', { n: i + 1 })}</Text>
              <View style={styles.balanceRow}>
                <View style={styles.balanceItem}>
                  <Text style={styles.balanceLabel}>{t('balance.accrued')}</Text>
                  <Text style={[styles.balanceValue, { color: COLORS.success }]}>
                    {item.droitConge ?? item.soldeAcquis ?? '0'}
                  </Text>
                </View>
                <View style={styles.balanceItem}>
                  <Text style={styles.balanceLabel}>{t('balance.taken')}</Text>
                  <Text style={[styles.balanceValue, { color: COLORS.error }]}>
                    {(item.droitConge - item.soldeAnterieur) || '0'}
                  </Text>
                </View>
                <View style={styles.balanceItem}>
                  <Text style={styles.balanceLabel}>{t('balance.remaining')}</Text>
                  <Text style={[styles.balanceValue, { color: COLORS.primary }]}>
                    {item.soldeAnterieur ?? item.soldeRestant ?? '0'}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#fff', elevation: 2 },
  backBtn: { fontSize: 16, color: COLORS.primary, fontWeight: '600', marginRight: 16 },
  title: { fontSize: 20, fontWeight: 'bold', color: COLORS.text },
  sectionLabel: {
    fontSize: 10, fontWeight: '800', color: COLORS.outline,
    letterSpacing: 1, marginBottom: 10, marginTop: 8,
  },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: COLORS.textSecondary },
  balanceCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2 },
  balanceTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.text, marginBottom: 12 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-around' },
  balanceItem: { alignItems: 'center' },
  balanceLabel: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 },
  balanceValue: { fontSize: 24, fontWeight: 'bold' },

  // RTT
  rttCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 20,
    borderLeftWidth: 4, borderLeftColor: '#10b981',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  rttHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  rttIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  rttCardTitle: { fontSize: 15, fontWeight: '800', color: '#065f46' },
  rttMeta: { fontSize: 11, color: COLORS.outline, fontWeight: '600', marginTop: 2 },
  rttRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  rttItem: { alignItems: 'center' },
  rttItemLabel: { fontSize: 11, color: COLORS.outline, fontWeight: '700', marginBottom: 4, letterSpacing: 0.5 },
  rttItemValue: { fontSize: 22, fontWeight: '900' },
  rttProgressBar: {
    height: 6, backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderRadius: 3, overflow: 'hidden',
  },
  rttProgressFill: { height: '100%', backgroundColor: '#10b981', borderRadius: 3 },
  rttEmptyText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18, fontStyle: 'italic' },
});
