import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import { COLORS } from '../config/env';

export default function BalanceScreen({ navigation }: any) {
  const { user } = useAuth();
  const [balance, setBalance] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadBalance(); }, [user]);

  const loadBalance = async () => {
    if (!user?.soccod || !user?.uticod) return;
    try {
      const now = new Date();
      const moisdeb = '01'; const moisfin = String(now.getMonth() + 1).padStart(2, '0');
      const annee = String(now.getFullYear());
      const data = await apiService.getEmpLeaveBalance(user.soccod, user.uticod, moisdeb, moisfin, annee);
      setBalance(Array.isArray(data) ? data : data ? [data] : []);
    } catch (e) { console.log('Balance load error:', e); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadBalance(); setRefreshing(false); };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.backBtn}>← Retour</Text></TouchableOpacity>
        <Text style={styles.title}>Solde de Congés</Text>
      </View>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16 }}>
        {balance.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💰</Text>
            <Text style={styles.emptyText}>Aucun solde disponible</Text>
          </View>
        ) : (
          balance.map((item: any, i: number) => (
            <View key={i} style={styles.balanceCard}>
              <Text style={styles.balanceTitle}>{item.concod || item.rubcod || `Congé ${i + 1}`}</Text>
              <View style={styles.balanceRow}>
                <View style={styles.balanceItem}>
                  <Text style={styles.balanceLabel}>Acquis</Text>
                  <Text style={[styles.balanceValue, { color: COLORS.success }]}>{item.droitConge ?? item.soldeAcquis ?? '0'}</Text>
                </View>
                <View style={styles.balanceItem}>
                  <Text style={styles.balanceLabel}>Pris</Text>
                  <Text style={[styles.balanceValue, { color: COLORS.error }]}>{(item.droitConge - item.soldeAnterieur) || '0'}</Text>
                </View>
                <View style={styles.balanceItem}>
                  <Text style={styles.balanceLabel}>Restant</Text>
                  <Text style={[styles.balanceValue, { color: COLORS.primary }]}>{item.soldeAnterieur ?? item.soldeRestant ?? '0'}</Text>
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
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: COLORS.textSecondary },
  balanceCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2 },
  balanceTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.text, marginBottom: 12 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-around' },
  balanceItem: { alignItems: 'center' },
  balanceLabel: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 },
  balanceValue: { fontSize: 24, fontWeight: 'bold' },
});