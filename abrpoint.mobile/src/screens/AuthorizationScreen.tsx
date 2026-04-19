import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import { COLORS } from '../config/env';
import DatePickerModal from '../components/DatePickerModal';
import TimePickerModal from '../components/TimePickerModal';

export default function AuthorizationScreen({ navigation }: any) {
  const { user, isEmployee, isAdmin, isManager } = useAuth();
  const [auths, setAuths] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    condep: new Date(),
    condepTime: new Date(),
    conretTime: new Date(),
    conmotif: '',
    connbjour: '1',
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDepTimePicker, setShowDepTimePicker] = useState(false);
  const [showRetTimePicker, setShowRetTimePicker] = useState(false);

  useEffect(() => { loadAuths(); }, [user]);

  const loadAuths = async () => {
    if (!user?.soccod || !user?.uticod) return;
    try {
      if (isAdmin) {
        // Admin sees all authorizations
        const data = await apiService.getAuthorizations(user.soccod, user.uticod);
        setAuths(Array.isArray(data) ? data : []);
      } else if (isManager) {
        // Manager sees authorizations from their service
        const data = await apiService.getAuthorizations(user.soccod, user.uticod);
        const allAuths = Array.isArray(data) ? data : [];
        // Filter by manager's service code
        setAuths(user.sercod ? allAuths.filter((a: any) => !a.sercod || a.sercod === user.sercod) : allAuths);
      } else {
        // Employee sees only their own
        const data = await apiService.getMyAuthorizations(user.soccod, user.uticod);
        setAuths(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      // Fallback to self endpoint
      try {
        const data = await apiService.getMyAuthorizations(user.soccod, user.uticod);
        setAuths(Array.isArray(data) ? data : []);
      } catch (e2) { console.log('Auth load error:', e2); }
    }
  };

  const onRefresh = async () => { setRefreshing(true); await loadAuths(); setRefreshing(false); };

  const handleSubmit = async () => {
    if (!form.conmotif) {
      Alert.alert('Erreur', 'Veuillez remplir le motif');
      return;
    }
    if (!user?.soccod || !user?.uticod) return;
    try {
      const depDate = new Date(form.condep);
      const depTime = form.condepTime;
      const depDateTime = new Date(depDate.getFullYear(), depDate.getMonth(), depDate.getDate(),
        depTime.getHours(), depTime.getMinutes());
      const retTime = form.conretTime;
      const retDateTime = new Date(depDate.getFullYear(), depDate.getMonth(), depDate.getDate(),
        retTime.getHours(), retTime.getMinutes());

      await apiService.createMyAuthorization({
        soccod: user.soccod,
        empcod: user.uticod,
        concod: `AUT${Date.now()}`,
        condep: depDateTime.toISOString(),
        conret: retDateTime.toISOString(),
        condat: new Date().toISOString().split('T')[0],
        conmotif: form.conmotif,
        connbjour: parseFloat(form.connbjour) || 1,
        conamdep: depTime.getHours() < 12 ? '1' : '0',
        conamret: retTime.getHours() < 12 ? '1' : '0',
      });
      Alert.alert('✅ Succès', 'Autorisation de sortie envoyée');
      setShowForm(false);
      setForm({ condep: new Date(), condepTime: new Date(), conretTime: new Date(), conmotif: '', connbjour: '1' });
      loadAuths();
    } catch (e) { Alert.alert('Erreur', 'Impossible d\'envoyer la demande'); }
  };

  const handleDelete = (item: any) => {
    Alert.alert('Supprimer', 'Voulez-vous supprimer cette autorisation ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer', style: 'destructive', onPress: async () => {
          try {
            await apiService.deleteAuthorization(user!.soccod!, item.concod);
            loadAuths();
          } catch { Alert.alert('Erreur', 'Impossible de supprimer'); }
        }
      },
    ]);
  };

  const handleApprove = (item: any) => {
    Alert.alert('Approuver', `Approuver l'autorisation de ${item.emplib || item.empcod} ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Approuver', onPress: async () => {
          try {
            await apiService.updateAuthorization({
              ...item,
              soccod: user!.soccod!,
              conaffecte: user!.uticod!,
              consanc: 'A',
            });
            Alert.alert('✅ Succès', 'Autorisation approuvée');
            loadAuths();
          } catch { Alert.alert('Erreur', 'Impossible d\'approuver'); }
        }
      },
    ]);
  };

  const handleRefuse = (item: any) => {
    Alert.alert('Refuser', `Refuser l'autorisation de ${item.emplib || item.empcod} ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Refuser', style: 'destructive', onPress: async () => {
          try {
            await apiService.updateAuthorization({
              ...item,
              soccod: user!.soccod!,
              conaffecte: user!.uticod!,
              consanc: 'R',
            });
            Alert.alert('Succès', 'Autorisation refusée');
            loadAuths();
          } catch { Alert.alert('Erreur', 'Impossible de refuser'); }
        }
      },
    ]);
  };

  const fmtDisplay = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch { return dateStr; }
  };

  const fmtTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  const getApprovalStatus = (item: any) => {
    if (item.consanc === 'A') return { label: 'Approuvé', color: '#22c55e', bg: '#dcfce7' };
    if (item.consanc === 'R') return { label: 'Refusé', color: '#ef4444', bg: '#fee2e2' };
    return { label: 'En attente', color: '#f59e0b', bg: '#fef9c3' };
  };

  const fmtTimeFromDate = (d: Date) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Autorisation de Sortie</Text>
        <TouchableOpacity onPress={() => setShowForm(!showForm)}>
          <Text style={styles.addBtn}>{showForm ? '✕' : '+ Nouveau'}</Text>
        </TouchableOpacity>
      </View>

      {showForm && (
        <View style={styles.form}>
          <Text style={styles.formTitle}>🚪 Nouvelle Autorisation</Text>

          <Text style={styles.label}>Date de sortie *</Text>
          <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>
            <Text style={styles.dateBtnText}>📅 {fmtDisplay(form.condep.toISOString().split('T')[0])}</Text>
          </TouchableOpacity>

          <View style={styles.timeRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Heure départ *</Text>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setShowDepTimePicker(true)}>
                <Text style={styles.dateBtnText}>🕐 {fmtTimeFromDate(form.condepTime)}</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Heure retour *</Text>
              <TouchableOpacity style={styles.dateBtn} onPress={() => setShowRetTimePicker(true)}>
                <Text style={styles.dateBtnText}>🕐 {fmtTimeFromDate(form.conretTime)}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.label}>Motif *</Text>
          <TextInput style={[styles.input, { height: 70 }]} value={form.conmotif} multiline
            onChangeText={(t: string) => setForm({ ...form, conmotif: t })} placeholder="Raison de la sortie" />

          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
            <Text style={styles.submitBtnText}>📤 Envoyer la Demande</Text>
          </TouchableOpacity>
        </View>
      )}

      <DatePickerModal visible={showDatePicker} value={form.condep}
        onChange={(d) => { setForm({ ...form, condep: d }); setShowDatePicker(false); }}
        onClose={() => setShowDatePicker(false)} title="Date de sortie" />
      <TimePickerModal visible={showDepTimePicker} value={form.condepTime}
        onChange={(d) => { setForm({ ...form, condepTime: d }); }}
        onClose={() => setShowDepTimePicker(false)} title="Heure de départ" />
      <TimePickerModal visible={showRetTimePicker} value={form.conretTime}
        onChange={(d) => { setForm({ ...form, conretTime: d }); }}
        onClose={() => setShowRetTimePicker(false)} title="Heure de retour" />

      {/* Stats for admin/manager */}
      {(isAdmin || isManager) && (
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderLeftColor: '#22c55e' }]}>
            <Text style={[styles.statValue, { color: '#22c55e' }]}>
              {auths.filter(a => a.consanc === 'A').length}
            </Text>
            <Text style={styles.statLabel}>Approuvées</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#f59e0b' }]}>
            <Text style={[styles.statValue, { color: '#f59e0b' }]}>
              {auths.filter(a => !a.consanc || a.consanc === 'E').length}
            </Text>
            <Text style={styles.statLabel}>En attente</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#ef4444' }]}>
            <Text style={[styles.statValue, { color: '#ef4444' }]}>
              {auths.filter(a => a.consanc === 'R').length}
            </Text>
            <Text style={styles.statLabel}>Refusées</Text>
          </View>
        </View>
      )}

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 12 }}>
        {auths.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🚪</Text>
            <Text style={styles.emptyText}>Aucune autorisation de sortie</Text>
          </View>
        ) : (
          auths.map((item: any, i: number) => {
            const approval = getApprovalStatus(item);
            const isPending = !item.consanc || item.consanc === 'E';
            return (
              <View key={item.concod || i} style={styles.authCard}>
                <View style={styles.authHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.authDate}>📅 {fmtDisplay(item.condep)}</Text>
                    {fmtTime(item.condep) && (
                      <Text style={styles.authTime}>
                        🕐 {fmtTime(item.condep)} → {fmtTime(item.conret) || '--:--'}
                      </Text>
                    )}
                    {item.emplib ? <Text style={styles.authEmp}>👤 {item.emplib}</Text> : null}
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: approval.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: approval.color }]}>{approval.label}</Text>
                  </View>
                </View>
                <Text style={styles.authMotif}>{item.conmotif || '-'}</Text>
                <View style={styles.authFooter}>
                  <Text style={styles.authDuree}>⏱️ {item.connbjour || '-'}h</Text>
                  <View style={styles.authActions}>
                    {isEmployee && isPending && (
                      <TouchableOpacity onPress={() => handleDelete(item)}>
                        <Text style={styles.deleteBtn}>🗑️</Text>
                      </TouchableOpacity>
                    )}
                    {!isEmployee && isPending && (
                      <>
                        <TouchableOpacity style={styles.refuseBtn} onPress={() => handleRefuse(item)}>
                          <Text style={styles.refuseBtnText}>✗ Refuser</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.approveBtn} onPress={() => handleApprove(item)}>
                          <Text style={styles.approveBtnText}>✓ Approuver</Text>
                        </TouchableOpacity>
                      </>
                    )}
                    {!isEmployee && !isPending && (
                      <TouchableOpacity onPress={() => handleDelete(item)}>
                        <Text style={styles.deleteBtn}>🗑️</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', elevation: 2 },
  backBtn: { fontSize: 16, color: COLORS.primary, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, flex: 1, marginLeft: 12 },
  addBtn: { fontSize: 14, color: COLORS.primary, fontWeight: 'bold' },
  statsRow: { flexDirection: 'row', gap: 8, padding: 12 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 12, borderLeftWidth: 4, elevation: 1 },
  statValue: { fontSize: 22, fontWeight: 'bold' },
  statLabel: { fontSize: 10, color: COLORS.textSecondary, marginTop: 2 },
  form: { backgroundColor: '#fff', margin: 12, borderRadius: 12, padding: 16, elevation: 2 },
  formTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.primary, marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, marginBottom: 4, marginTop: 8 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 10, fontSize: 14, backgroundColor: '#fafafa', color: COLORS.text },
  dateBtn: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 10, backgroundColor: '#fafafa', alignItems: 'center', marginTop: 2 },
  dateBtnText: { fontSize: 13, color: COLORS.text, fontWeight: '500' },
  timeRow: { flexDirection: 'row', gap: 8 },
  submitBtn: { backgroundColor: COLORS.primary, borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 16 },
  submitBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  authCard: { backgroundColor: '#fff', marginHorizontal: 4, marginTop: 8, borderRadius: 12, padding: 14, elevation: 1 },
  authHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  authDate: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  authTime: { fontSize: 12, color: COLORS.primary, marginTop: 2 },
  authEmp: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusBadgeText: { fontSize: 10, fontWeight: '600' },
  authMotif: { fontSize: 13, color: COLORS.textSecondary, marginTop: 8, lineHeight: 18 },
  authFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f5f5f5' },
  authDuree: { fontSize: 12, color: COLORS.primary, fontWeight: '500' },
  authActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  deleteBtn: { fontSize: 16, color: COLORS.error },
  approveBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: '#dcfce7' },
  approveBtnText: { fontSize: 11, color: '#166534', fontWeight: '600' },
  refuseBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: '#fee2e2' },
  refuseBtnText: { fontSize: 11, color: '#991b1b', fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: COLORS.textSecondary },
});