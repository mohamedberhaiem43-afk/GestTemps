import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Dimensions, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import { COLORS, THEME } from '../config/env';

const { width } = Dimensions.get('window');

export default function PresenceHistoryScreen({ navigation }: any) {
  const { user } = useAuth();
  const [presences, setPresences] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    loadPresences();
  }, [user]);

  const loadPresences = async () => {
    if (!user?.soccod || !user?.uticod) return;
    try {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = now.toISOString().split('T')[0];
      
      const data = await apiService.getMyPresenceHistory(user.soccod, user.uticod, firstDay, lastDay);
      setPresences(data || []);
    } catch (error) {
      console.log('Failed to load presences:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPresences();
    setRefreshing(false);
  };

  // Weekly Stats
  const weeklyStats = useMemo(() => {
    const now = new Date();
    const weekStart = new Date(now.setDate(now.getDate() - now.getDay() + 1));
    const weeklyData = presences.filter(p => new Date(p.predat) >= weekStart);
    
    let totalMinutes = 0;
    weeklyData.forEach(p => {
      // Very simplified calculation for the demo
      if (p.preentmatup && p.presortmatup) {
        const [h1, m1] = p.preentmatup.split(':').map(Number);
        const [h2, m2] = p.presortmatup.split(':').map(Number);
        totalMinutes += (h2 * 60 + m2) - (h1 * 60 + m1);
      }
      if (p.preentamidiup && p.presortamidiup) {
        const [h1, m1] = p.preentamidiup.split(':').map(Number);
        const [h2, m2] = p.presortamidiup.split(':').map(Number);
        totalMinutes += (h2 * 60 + m2) - (h1 * 60 + m1);
      }
    });

    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return {
      hoursLabel: `${hours}h ${mins}m`,
      productivity: '94%', // Mock as per template
    };
  }, [presences]);

  // Daily Ledger for selected date
  const dailyLedger = useMemo(() => {
    const dateStr = selectedDate.toISOString().split('T')[0];
    const p = presences.find(p => p.predat?.split('T')[0] === dateStr);
    if (!p) return [];

    const events = [];
    if (p.preentmatup) events.push({ type: 'IN', title: 'Entrée Bureau', time: p.preentmatup, status: 'À l\'heure', color: COLORS.tertiary, icon: 'login', bg: 'rgba(0, 81, 54, 0.05)', location: 'Siège Social - Zone A' });
    if (p.presortmatup) events.push({ type: 'OUT', title: 'Sortie Déjeuner', time: p.presortmatup, status: 'Vérifié', color: COLORS.error, icon: 'logout', bg: 'rgba(186, 26, 26, 0.05)', location: 'Périmètre autorisé' });
    if (p.preentamidiup) events.push({ type: 'IN', title: 'Reprise Après-midi', time: p.preentamidiup, status: 'Vérifié', color: COLORS.secondary, icon: 'login', bg: 'rgba(81, 95, 116, 0.05)', location: 'Pointage Mobile GPS' });
    if (p.presortamidiup) events.push({ type: 'OUT', title: 'Sortie Bureau', time: p.presortamidiup, status: 'À l\'heure', color: COLORS.primary, icon: 'logout', bg: 'rgba(0, 64, 161, 0.05)', location: 'Siège Social - Zone A' });
    
    return events;
  }, [presences, selectedDate]);

  const weekDays = useMemo(() => {
    const today = new Date();
    const days = [];
    const labels = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    for (let i = -2; i <= 2; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      days.push({
        date: d,
        dayNum: d.getDate(),
        dayName: labels[d.getDay()],
        isToday: i === 0,
        isSelected: d.toDateString() === selectedDate.toDateString(),
      });
    }
    return days;
  }, [selectedDate]);

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* TopAppBar */}
      <View style={styles.topAppBar}>
        <View style={styles.topAppLeft}>
          <View style={styles.profileWrapper}>
            <Image
              source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAKJ3KEQ7Gy-5a7Pil6EtrW7ISw6sO9rMhVSEd8lx9bZURj0yikeITk7WSMqbZnOv_QeSc_X6lBvDd7UJmjes0CTbWSASWCsu0yc7v0uUXxQBD5NsjryCxzmjUWrpleWEwIFBaYdv2gc-N-Cx_2hUA_kdKB1aAsDhSLnhn4PJD5ZZmR4bQ_khza9Ugpolvc96wG3q6PFujTEnzT8p4VWf_qLcGb42wB85bJliB8ew3pesJpvQ9wwCtzSMAwTscC_5e5Y5WkJ7tkwe8' }}
              style={styles.profileImage}
            />
          </View>
          <Text style={styles.logoText}>L'Architecte RH</Text>
        </View>
        <TouchableOpacity style={styles.iconButton}>
          <MaterialCommunityIcons name="bell-outline" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerTitleContainer}>
          <Text style={styles.subHeader}>Suivi Temporel</Text>
          <Text style={styles.mainTitle}>Historique de Pointage</Text>
        </View>

        {/* Compact Calendar Filter */}
        <View style={styles.calendarCard}>
          <View style={styles.calendarHeader}>
            <Text style={styles.calendarMonth}>Octobre 2023</Text>
            <View style={styles.calendarNav}>
              <TouchableOpacity><MaterialCommunityIcons name="chevron-left" size={20} color={COLORS.onSurface} /></TouchableOpacity>
              <TouchableOpacity><MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.onSurface} /></TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.calendarDays}>
            {weekDays.map((d, i) => (
              <View key={i} style={styles.dayCol}>
                <Text style={styles.dayName}>{d.dayName}</Text>
                <TouchableOpacity
                  style={[styles.dayBtn, d.isSelected && styles.dayBtnSelected]}
                  onPress={() => setSelectedDate(d.date)}
                >
                  <Text style={[styles.dayNum, d.isSelected && styles.dayNumSelected]}>{d.dayNum}</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>

        {/* Weekly Summary Bento */}
        <View style={styles.bentoRow}>
          <View style={styles.bentoCard}>
            <MaterialCommunityIcons name="clock-outline" size={24} color={COLORS.primary} />
            <View>
              <Text style={styles.bentoLabel}>TOTAL SEMAINE</Text>
              <Text style={styles.bentoValue}>{weeklyStats.hoursLabel}</Text>
            </View>
          </View>
          <View style={[styles.bentoCard, { backgroundColor: COLORS.tertiaryFixed }]}>
            <MaterialCommunityIcons name="trending-up" size={24} color={COLORS.onTertiaryFixedVariant} />
            <View>
              <Text style={[styles.bentoLabel, { color: COLORS.onTertiaryFixedVariant }]}>PRODUCTIVITÉ</Text>
              <Text style={[styles.bentoValue, { color: COLORS.onTertiaryFixed }]}>{weeklyStats.productivity}</Text>
            </View>
          </View>
        </View>

        {/* Chronological Ledger */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {selectedDate.toDateString() === new Date().toDateString() ? "Aujourd'hui" : selectedDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })}
            </Text>
            <Text style={styles.sectionMeta}>{dailyLedger.length} sessions</Text>
          </View>
          
          <View style={styles.ledgerList}>
            {dailyLedger.map((event, idx) => (
              <View key={idx} style={[styles.ledgerItem, { borderLeftColor: event.color }]}>
                <View style={styles.ledgerLeft}>
                  <View style={styles.ledgerIconWrapper}>
                    <MaterialCommunityIcons name={event.icon as any} size={24} color={event.color} />
                  </View>
                  <View style={styles.ledgerInfo}>
                    <Text style={styles.ledgerTitle}>{event.title}</Text>
                    <View style={styles.ledgerLocation}>
                      <MaterialCommunityIcons name="map-marker-outline" size={14} color={COLORS.onSurfaceVariant} />
                      <Text style={styles.locationText}>{event.location}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.ledgerRight}>
                  <Text style={styles.ledgerTime}>{event.time}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: `${event.color}15` }]}>
                    <Text style={[styles.statusText, { color: event.color }]}>{event.status.toUpperCase()}</Text>
                  </View>
                </View>
                <MaterialCommunityIcons name="crosshairs-gps" size={48} color={event.color} style={styles.bgIcon} />
              </View>
            ))}
            {dailyLedger.length === 0 && (
              <View style={styles.emptyLedger}>
                <Text style={styles.emptyText}>Aucun pointage pour ce jour</Text>
              </View>
            )}
          </View>
        </View>

        {/* archives récentes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Archives récentes</Text>
          <View style={styles.archiveList}>
            {presences.slice(1, 4).map((p, idx) => (
              <TouchableOpacity key={idx} style={styles.archiveItem}>
                <View style={styles.archiveLeft}>
                  <View style={styles.archiveDateBadge}>
                    <Text style={styles.archiveDateText}>{new Date(p.predat).getDate()}</Text>
                  </View>
                  <View>
                    <Text style={styles.archiveDay}>{new Date(p.predat).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
                    <Text style={styles.archiveMeta}>Total: 07h 55m</Text>
                  </View>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.outline} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* BottomNavBar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Home')}>
          <MaterialCommunityIcons name="view-dashboard-outline" size={24} color="#94a3b8" />
          <Text style={styles.navLabel}>TABLEAU</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('LeaveRequest')}>
          <MaterialCommunityIcons name="calendar-month-outline" size={24} color="#94a3b8" />
          <Text style={styles.navLabel}>CONGÉS</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Authorization')}>
          <MaterialCommunityIcons name="exit-to-app" size={24} color="#94a3b8" />
          <Text style={styles.navLabel}>SORTIES</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => {}}>
          <MaterialCommunityIcons name="history" size={24} color={COLORS.primary} />
          <Text style={[styles.navLabel, { color: COLORS.primary }]}>POINTAGE</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Expense')}>
          <MaterialCommunityIcons name="receipt-long" size={24} color="#94a3b8" />
          <Text style={styles.navLabel}>FRAIS</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topAppBar: {
    height: 64, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, backgroundColor: COLORS.background,
  },
  topAppLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  profileWrapper: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', backgroundColor: COLORS.primaryFixed },
  profileImage: { width: '100%', height: '100%' },
  logoText: { fontFamily: 'Manrope', fontWeight: '800', fontSize: 18, color: COLORS.primary, letterSpacing: -0.5 },
  iconButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 },
  headerTitleContainer: { marginBottom: 32 },
  subHeader: { fontSize: 10, fontWeight: '700', color: COLORS.secondary, letterSpacing: 1.5, textTransform: 'uppercase' },
  mainTitle: { fontSize: 32, fontWeight: '800', color: COLORS.onSurface, letterSpacing: -1 },
  calendarCard: { backgroundColor: COLORS.surfaceContainerLow, borderRadius: 24, padding: 20, marginBottom: 24 },
  calendarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  calendarMonth: { fontSize: 16, fontWeight: '800', color: COLORS.onSurface, fontFamily: 'Manrope' },
  calendarNav: { flexDirection: 'row', gap: 12 },
  calendarDays: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCol: { alignItems: 'center', gap: 8 },
  dayName: { fontSize: 10, fontWeight: '800', color: COLORS.outline, textTransform: 'uppercase' },
  dayBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.surfaceContainerLowest, justifyContent: 'center', alignItems: 'center' },
  dayBtnSelected: { backgroundColor: COLORS.primary, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  dayNum: { fontSize: 14, fontWeight: '700', color: COLORS.onSurfaceVariant },
  dayNumSelected: { color: '#fff' },
  bentoRow: { flexDirection: 'row', gap: 16, marginBottom: 32 },
  bentoCard: { flex: 1, backgroundColor: COLORS.primaryContainer, borderRadius: 20, padding: 20, justifyContent: 'space-between', height: 110 },
  bentoLabel: { fontSize: 10, fontWeight: '800', color: 'rgba(0, 64, 161, 0.6)', letterSpacing: 0.5 },
  bentoValue: { fontSize: 22, fontWeight: '900', color: COLORS.onPrimaryFixed, fontFamily: 'Manrope' },
  section: { marginBottom: 32 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.onSurface, fontFamily: 'Manrope' },
  sectionMeta: { fontSize: 11, fontWeight: '600', color: COLORS.outline },
  ledgerList: { gap: 12 },
  ledgerItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 16, padding: 20,
    borderLeftWidth: 4, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 8,
    overflow: 'hidden',
  },
  ledgerLeft: { flexDirection: 'row', alignItems: 'center', gap: 16, flex: 1 },
  ledgerIconWrapper: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  ledgerInfo: { gap: 4 },
  ledgerTitle: { fontSize: 16, fontWeight: '800', color: COLORS.onSurface, fontFamily: 'Manrope' },
  ledgerLocation: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { fontSize: 11, fontWeight: '600', color: COLORS.onSurfaceVariant },
  ledgerRight: { alignItems: 'flex-end', gap: 4 },
  ledgerTime: { fontSize: 20, fontWeight: '900', color: COLORS.onSurface, fontFamily: 'Manrope' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 2, borderRadius: 10 },
  statusText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  bgIcon: { position: 'absolute', right: -10, bottom: -10, opacity: 0.05 },
  emptyLedger: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, color: COLORS.outline, fontWeight: '600' },
  archiveList: { gap: 12 },
  archiveItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.surfaceContainerLow, borderRadius: 16, padding: 16 },
  archiveLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  archiveDateBadge: { width: 40, height: 40, borderRadius: 10, backgroundColor: COLORS.surfaceContainerHighest, justifyContent: 'center', alignItems: 'center' },
  archiveDateText: { fontSize: 14, fontWeight: '800', color: COLORS.onSurfaceVariant },
  archiveDay: { fontSize: 14, fontWeight: '700', color: COLORS.onSurface },
  archiveMeta: { fontSize: 11, color: COLORS.outline, fontWeight: '600' },
  bottomNav: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)', paddingBottom: 20,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  navItem: { alignItems: 'center', gap: 4 },
  navLabel: { fontSize: 9, fontWeight: '700', color: '#94a3b8' },
});