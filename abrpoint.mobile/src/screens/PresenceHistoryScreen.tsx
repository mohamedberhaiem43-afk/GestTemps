import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import { COLORS } from '../config/env';

export default function PresenceHistoryScreen({ navigation }: any) {
  const { user } = useAuth();
  const [presences, setPresences] = useState<any[]>([]);
  const [employee, setEmployee] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'week' | 'month' | 'all'>('month');

  useEffect(() => {
    loadEmployee();
  }, [user]);

  useEffect(() => {
    if (employee) loadPresences();
  }, [employee, filter]);

  const loadEmployee = async () => {
    if (!user?.soccod || !user?.uticod) return;
    try {
      const data = await apiService.getEmployee(user.soccod, user.uticod);
      setEmployee(data);
    } catch (e) {
      console.log('Failed to load employee:', e);
    }
  };

  const loadPresences = async () => {
    if (!user?.soccod || !user?.uticod) return;
    try {
      const now = new Date();
      let dateDebut: string;
      let dateFin = now.toISOString().split('T')[0];

      if (filter === 'week') {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        dateDebut = weekAgo.toISOString().split('T')[0];
      } else if (filter === 'month') {
        dateDebut = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      } else {
        dateDebut = `${now.getFullYear()}-01-01`;
      }

      // If employee has hire date, don't go before it
      if (employee?.empdatent) {
        const hireDate = new Date(employee.empdatent).toISOString().split('T')[0];
        if (hireDate > dateDebut) dateDebut = hireDate;
      }
      // If employee has exit date, don't go after it
      if (employee?.empdatfinctr) {
        const exitDate = new Date(employee.empdatfinctr).toISOString().split('T')[0];
        if (exitDate < dateFin) dateFin = exitDate;
      }

      const data = await apiService.getMyPresenceHistory(user.soccod, user.uticod, dateDebut, dateFin);
      setPresences(data || []);
    } catch (error) {
      console.log('Failed to load presences:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPresences();
    setRefreshing(false);
  };

  const isReposDay = (p: any) => {
    return p.prerepos === true || p.prerepos === 'True' || p.prerepos === 'true' || p.prerepos === '1';
  };

  const getStatusColor = (p: any) => {
    if (isReposDay(p)) return '#8b5cf6'; // purple for repos
    if (p.presortmatup) return COLORS.success;
    if (p.preentmatup) return COLORS.warning;
    return COLORS.disabled;
  };

  const getStatusText = (p: any) => {
    if (isReposDay(p)) return 'Repos • Présent';
    if (p.presortmatup) return 'Complet';
    if (p.preentmatup) return 'En cours';
    return 'Absent';
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
    } catch { return dateStr; }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Historique de Présence</Text>
      </View>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { borderLeftColor: COLORS.success }]}>
          <Text style={[styles.summaryValue, { color: COLORS.success }]}>
            {presences.filter(p => !isReposDay(p) && p.presortmatup).length}
          </Text>
          <Text style={styles.summaryLabel}>Complets</Text>
        </View>
        <View style={[styles.summaryCard, { borderLeftColor: '#8b5cf6' }]}>
          <Text style={[styles.summaryValue, { color: '#8b5cf6' }]}>
            {presences.filter(p => isReposDay(p)).length}
          </Text>
          <Text style={styles.summaryLabel}>Repos</Text>
        </View>
        <View style={[styles.summaryCard, { borderLeftColor: COLORS.disabled }]}>
          <Text style={[styles.summaryValue, { color: COLORS.disabled }]}>
            {presences.filter(p => !isReposDay(p) && !p.preentmatup).length}
          </Text>
          <Text style={styles.summaryLabel}>Absents</Text>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        {(['week', 'month', 'all'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'week' ? 'Semaine' : f === 'month' ? 'Mois' : 'Tout'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {presences.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>Aucune donnée de présence</Text>
          </View>
        ) : (
          presences.map((p, index) => {
            const repos = isReposDay(p);
            return (
              <View key={index} style={[styles.presenceCard, repos && styles.reposCard]}>
                <View style={styles.presenceDate}>
                  <Text style={styles.dateText}>{formatDate(p.predat)}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(p) }]}>
                    <Text style={styles.statusText}>{getStatusText(p)}</Text>
                  </View>
                </View>
                {repos ? (
                  <View style={styles.reposInfo}>
                    <Text style={styles.reposIcon}>🔨</Text>
                    <Text style={styles.reposText}>Repos Travaillé</Text>
                  </View>
                ) : (
                  <View style={styles.timeRow}>
                    <View style={styles.timeItem}>
                      <Text style={styles.timeLabel}>Entrée Matin</Text>
                      <Text style={styles.timeValue}>{p.preentmatup || '--:--'}</Text>
                    </View>
                    <View style={styles.timeItem}>
                      <Text style={styles.timeLabel}>Sortie Matin</Text>
                      <Text style={styles.timeValue}>{p.presortmatup || '--:--'}</Text>
                    </View>
                    <View style={styles.timeItem}>
                      <Text style={styles.timeLabel}>Entrée A.M.</Text>
                      <Text style={styles.timeValue}>{p.preentamidiup || '--:--'}</Text>
                    </View>
                    <View style={styles.timeItem}>
                      <Text style={styles.timeLabel}>Sortie A.M.</Text>
                      <Text style={styles.timeValue}>{p.presortamidiup || '--:--'}</Text>
                    </View>
                  </View>
                )}
              </View>
            );
          })
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

  // Summary
  summaryRow: { flexDirection: 'row', gap: 8, padding: 12, paddingBottom: 0 },
  summaryCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 12,
    borderLeftWidth: 4, elevation: 1,
  },
  summaryValue: { fontSize: 20, fontWeight: 'bold' },
  summaryLabel: { fontSize: 10, color: COLORS.textSecondary, marginTop: 2 },

  filterRow: { flexDirection: 'row', padding: 12, gap: 8, backgroundColor: '#fff', marginBottom: 8 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.background },
  filterBtnActive: { backgroundColor: COLORS.primary },
  filterText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '500' },
  filterTextActive: { color: '#fff' },

  presenceCard: { backgroundColor: '#fff', margin: 12, marginTop: 0, borderRadius: 12, padding: 16, elevation: 1 },
  reposCard: { borderLeftWidth: 4, borderLeftColor: '#8b5cf6' },
  presenceDate: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  dateText: { fontSize: 15, fontWeight: 'bold', color: COLORS.text },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '600' },

  timeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  timeItem: { alignItems: 'center', flex: 1 },
  timeLabel: { fontSize: 10, color: COLORS.textSecondary, marginBottom: 4 },
  timeValue: { fontSize: 14, fontWeight: '600', color: COLORS.text },

  reposInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  reposIcon: { fontSize: 20 },
  reposText: { fontSize: 13, color: '#8b5cf6', fontWeight: '500' },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: COLORS.textSecondary },
});