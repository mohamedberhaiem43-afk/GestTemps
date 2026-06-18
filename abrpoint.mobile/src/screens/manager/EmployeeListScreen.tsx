import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, TextInput, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/api';
import { COLORS } from '../../config/env';
import { resolveAssetUrl } from '../../config/assetUrl';
import { useT } from '../../i18n';

export default function EmployeeListScreen({ navigation }: any) {
  const { user } = useAuth();
  const t = useT();
  const [employees, setEmployees] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadEmployees(); }, [user]);
  useEffect(() => {
    if (!search) { setFiltered(employees); return; }
    const q = search.toLowerCase();
    setFiltered(employees.filter((e: any) =>
      (e.emplib || e.empcod || '').toLowerCase().includes(q) ||
      (e.empmat || '').toLowerCase().includes(q)
    ));
  }, [search, employees]);

  const loadEmployees = async () => {
    if (!user?.soccod || !user?.uticod) return;
    try {
      const data = await apiService.getEmployees(user.soccod, user.uticod);
      setEmployees(Array.isArray(data) ? data : []);
      setFiltered(Array.isArray(data) ? data : []);
    } catch (e) { console.log('Employees load error:', e); }
    finally { setLoading(false); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadEmployees(); setRefreshing(false); };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.backBtn}>← {t('common.back')}</Text></TouchableOpacity>
        <Text style={styles.title}>{t('mgrEmployees.title')}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('AddEmployee')}>
          <Text style={styles.addBtn}>+ {t('common.add')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchBar}>
        <TextInput style={styles.searchInput} placeholder={t('mgrEmployees.searchPlaceholder')}
          value={search} onChangeText={setSearch} />
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyText}>{t('mgrEmployees.emptyState')}</Text>
          </View>
        ) : (
          filtered.map((emp: any, i: number) => {
            const photoUri = resolveAssetUrl(emp.utiimg || emp.empimg);
            return (
              <TouchableOpacity key={emp.empcod || i} style={styles.empCard}
                onPress={() => navigation.navigate('EmployeeDetail', {
                  empcod: emp.empcod,
                  soccod: emp.soccod || user?.soccod,
                  empName: emp.emplib || emp.empcod,
                })}>
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.empAvatar} />
                ) : (
                  <View style={styles.empAvatar}>
                    <Text style={styles.empAvatarText}>{(emp.emplib || 'E').charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View style={styles.empInfo}>
                  <Text style={styles.empName}>{emp.emplib || emp.empcod}</Text>
                  <Text style={styles.empDetail}>{emp.empmat || ''} • {emp.foncod || ''}</Text>
                  <Text style={styles.empSite}>{emp.sitcod || ''}</Text>
                </View>
                <Text style={styles.empArrow}>›</Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#fff', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 6 },
  backBtn: { fontSize: 16, color: COLORS.primary, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, flex: 1, marginLeft: 12 },
  addBtn: { fontSize: 14, color: COLORS.primary, fontWeight: 'bold' },
  searchBar: { padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  searchInput: { backgroundColor: COLORS.background, borderRadius: 8, padding: 10, fontSize: 14 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: COLORS.textSecondary },
  empCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', marginHorizontal: 12, marginTop: 8, borderRadius: 10, padding: 14, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
  empAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  empAvatarText: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  empInfo: { flex: 1 },
  empName: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  empDetail: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  empSite: { fontSize: 11, color: COLORS.primary, marginTop: 2 },
  empArrow: { fontSize: 24, color: COLORS.disabled },
});