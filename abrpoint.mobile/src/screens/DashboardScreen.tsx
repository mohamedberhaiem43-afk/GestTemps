import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity,
  ActivityIndicator, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import { COLORS } from '../config/env';
import { useT } from '../i18n';

const { width } = Dimensions.get('window');

interface KPIData {
  soldeConge: number;
  congeAcquis: number;
  heuresTravailleesSemaine: number;
  objectifHebdomadaire: number;
  pourcentageObjectif: number;
  demandesEnAttente: number;
  suiviPointageSemaine: Record<string, number>;
  suiviPointageMois: Record<string, number>;
  emplib: string;
  empcod: string;
}

export default function DashboardScreen({ navigation }: any) {
  const { user, isEmployee } = useAuth();
  const t = useT();
  const [kpis, setKpis] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'week' | 'month'>('week');

  const loadKPIs = useCallback(async () => {
    if (!user?.soccod || !user?.uticod) return;
    try {
      const data = await apiService.getMyKPIs(user.soccod, user.uticod);
      setKpis(data);
    } catch (error) {
      console.log('Failed to load KPIs:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.soccod, user?.uticod]);

  useEffect(() => { loadKPIs(); }, [loadKPIs]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadKPIs();
    setRefreshing(false);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('dashboard.greetingMorning');
    if (hour < 18) return t('dashboard.greetingAfternoon');
    return t('dashboard.greetingEvening');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('dashboard.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const weekData = kpis?.suiviPointageSemaine
    ? Object.entries(kpis.suiviPointageSemaine).map(([name, hours]) => ({ name, hours: Math.min(Number(hours), 12) }))
    : [];

  const monthData = kpis?.suiviPointageMois
    ? Object.entries(kpis.suiviPointageMois).map(([name, hours]) => ({ name, hours: Math.min(Number(hours), 48) }))
    : [];

  const chartData = activeTab === 'week' ? weekData : monthData;
  const maxHours = activeTab === 'week' ? 12 : 48;

  const soldePercent = kpis && kpis.congeAcquis > 0
    ? Math.min((kpis.soldeConge / kpis.congeAcquis) * 100, 100)
    : 0;

  const workPercent = kpis?.pourcentageObjectif || 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{getGreeting()},</Text>
            <Text style={styles.userName}>{kpis?.emplib || user?.utilib || t('dashboard.employee')}</Text>
          </View>
          <TouchableOpacity style={styles.profileBtn} onPress={() => navigation.navigate('Profile')}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(kpis?.emplib || user?.utilib || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* KPI Cards */}
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, { borderLeftColor: COLORS.primary }]}>
            <Text style={styles.kpiLabel}>{t('dashboard.leaveRemaining')}</Text>
            <Text style={styles.kpiValue}>{kpis?.soldeConge?.toFixed(1) || '0'}</Text>
            <Text style={styles.kpiSub}>{t('dashboard.daysAccrued', { n: kpis?.congeAcquis?.toFixed(1) || '0' })}</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${soldePercent}%`, backgroundColor: COLORS.primary }]} />
            </View>
          </View>

          <View style={[styles.kpiCard, { borderLeftColor: COLORS.success }]}>
            <Text style={styles.kpiLabel}>{t('dashboard.hoursWorked')}</Text>
            <Text style={styles.kpiValue}>{kpis?.heuresTravailleesSemaine?.toFixed(1) || '0'}</Text>
            <Text style={styles.kpiSub}>{t('dashboard.weekTarget', { n: kpis?.objectifHebdomadaire || 35 })}</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${Math.min(workPercent, 100)}%`, backgroundColor: COLORS.success }]} />
            </View>
          </View>
        </View>

        <View style={styles.kpiRow}>
          <View style={[styles.kpiCard, { borderLeftColor: COLORS.warning }]}>
            <Text style={styles.kpiLabel}>{t('dashboard.pending')}</Text>
            <Text style={styles.kpiValue}>{kpis?.demandesEnAttente || 0}</Text>
            <Text style={styles.kpiSub}>{t('dashboard.requests')}</Text>
          </View>

          <View style={[styles.kpiCard, { borderLeftColor: COLORS.accent }]}>
            <Text style={styles.kpiLabel}>{t('dashboard.target')}</Text>
            <Text style={styles.kpiValue}>{workPercent.toFixed(0)}%</Text>
            <Text style={styles.kpiSub}>{t('dashboard.targetReached')}</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${Math.min(workPercent, 100)}%`, backgroundColor: COLORS.accent }]} />
            </View>
          </View>
        </View>

        {/* Pointage Chart */}
        <View style={styles.chartSection}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>{t('dashboard.pointageTracking')}</Text>
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'week' && styles.tabBtnActive]}
                onPress={() => setActiveTab('week')}
              >
                <Text style={[styles.tabText, activeTab === 'week' && styles.tabTextActive]}>{t('dashboard.week')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'month' && styles.tabBtnActive]}
                onPress={() => setActiveTab('month')}
              >
                <Text style={[styles.tabText, activeTab === 'month' && styles.tabTextActive]}>{t('dashboard.month')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {chartData.length > 0 ? (
            <View style={styles.barChart}>
              {chartData.map((item, index) => (
                <View key={index} style={styles.barItem}>
                  <View style={styles.barContainer}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: `${maxHours > 0 ? (item.hours / maxHours) * 100 : 0}%`,
                          backgroundColor: index === chartData.length - 1 ? COLORS.primary : '#e2e8f0',
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.barLabel}>{item.name}</Text>
                  <Text style={styles.barValue}>{item.hours}h</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.noChartData}>
              <Text style={styles.noChartDataText}>{t('dashboard.noPointageData')}</Text>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>{t('dashboard.quickActions')}</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('LeaveRequest')}>
            <Text style={styles.actionIcon}>🏖️</Text>
            <Text style={styles.actionLabel}>{t('dashboard.aLeave')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('PresenceHistory')}>
            <Text style={styles.actionIcon}>📊</Text>
            <Text style={styles.actionLabel}>{t('dashboard.aHistory')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Expense')}>
            <Text style={styles.actionIcon}>💰</Text>
            <Text style={styles.actionLabel}>{t('dashboard.aExpense')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Balance')}>
            <Text style={styles.actionIcon}>📋</Text>
            <Text style={styles.actionLabel}>{t('dashboard.aBalance')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('DigitalVault')}>
            <Text style={styles.actionIcon}>📁</Text>
            <Text style={styles.actionLabel}>{t('dashboard.aVault')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Authorization')}>
            <Text style={styles.actionIcon}>🚪</Text>
            <Text style={styles.actionLabel}>{t('dashboard.aAuthorization')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: COLORS.textSecondary, fontSize: 14 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerLeft: { flex: 1 },
  greeting: { fontSize: 14, color: COLORS.textSecondary },
  userName: { fontSize: 24, fontWeight: 'bold', color: COLORS.text },
  profileBtn: { padding: 4 },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  kpiRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  kpiCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14,
    borderLeftWidth: 4, elevation: 2, shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3,
  },
  kpiLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '600', marginBottom: 6 },
  kpiValue: { fontSize: 28, fontWeight: 'bold', color: COLORS.text },
  kpiSub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  progressBar: { height: 4, backgroundColor: '#f0f0f0', borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  chartSection: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 20, elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4,
  },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  chartTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  tabRow: { flexDirection: 'row', backgroundColor: '#f5f5f5', borderRadius: 8, overflow: 'hidden' },
  tabBtn: { paddingHorizontal: 14, paddingVertical: 6 },
  tabBtnActive: { backgroundColor: COLORS.primary, borderRadius: 6 },
  tabText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  barChart: { flexDirection: 'row', alignItems: 'flex-end', height: 160, paddingHorizontal: 4 },
  barItem: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barContainer: { width: '70%', height: 130, backgroundColor: '#f8f9fa', borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 4, minHeight: 2 },
  barLabel: { fontSize: 9, color: COLORS.textSecondary, marginTop: 4, fontWeight: '700' },
  barValue: { fontSize: 9, color: COLORS.primary, fontWeight: '600' },
  noChartData: { height: 100, justifyContent: 'center', alignItems: 'center' },
  noChartDataText: { color: COLORS.textSecondary, fontSize: 14 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginBottom: 12 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionCard: {
    width: '31%', backgroundColor: '#fff', borderRadius: 12, padding: 16,
    alignItems: 'center', elevation: 2, shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3,
  },
  actionIcon: { fontSize: 28, marginBottom: 6 },
  actionLabel: { fontSize: 11, color: COLORS.text, textAlign: 'center', fontWeight: '500' },
});