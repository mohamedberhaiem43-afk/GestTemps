import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import { COLORS } from '../config/env';

export default function ProfileScreen({ navigation, route }: any) {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [employee, setEmployee] = useState<any>(null);
  const [horaires, setHoraires] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Support viewing other employees via route params
  const viewEmpcod = route?.params?.empcod || user?.uticod;
  const viewSoccod = route?.params?.soccod || user?.soccod;
  const isOwnProfile = !route?.params?.empcod || route?.params?.empcod === user?.uticod;

  useEffect(() => { loadAll(); }, [user, route?.params]);

  const loadAll = async () => {
    if (!viewSoccod || !viewEmpcod) return;
    setLoading(true);
    try {
      const promises: Promise<any>[] = [];
      const keys: string[] = [];

      if (isOwnProfile) {
        keys.push('profile');
        promises.push(apiService.getProfile(viewSoccod, viewEmpcod));
      }
      keys.push('emp');
      promises.push(apiService.getEmployee(viewSoccod, viewEmpcod));
      keys.push('hor');
      promises.push(apiService.getEmpHoraires(viewSoccod, viewEmpcod));

      const results = await Promise.allSettled(promises);
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          const key = keys[i];
          if (key === 'profile') setProfile(r.value);
          else if (key === 'emp') setEmployee(r.value);
          else if (key === 'hor') setHoraires(Array.isArray(r.value) ? r.value : []);
        }
      });
    } catch (e) { console.log('Profile load error:', e); }
    finally { setLoading(false); }
  };

  const onRefresh = async () => { setRefreshing(true); await loadAll(); setRefreshing(false); };

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnexion', style: 'destructive', onPress: logout },
    ]);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
  }

  const d = profile || user;
  const emp = employee || {};

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.backBtn}>← Retour</Text></TouchableOpacity>
        <Text style={styles.title}>{isOwnProfile ? 'Mon Profil' : `Profil - ${emp?.emplib || viewEmpcod}`}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(d?.utilib || d?.utiprn || emp?.emplib || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.name}>{d?.utilib || emp?.emplib || 'Utilisateur'}</Text>
          <Text style={styles.email}>{d?.utimail || emp?.empemail || ''}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{d?.utirole || emp?.utirole || 'Employé'}</Text>
          </View>
        </View>

        {/* Personal Info Section */}
        <Text style={styles.sectionTitle}>📋 Informations Personnelles</Text>
        <View style={styles.infoSection}>
          <InfoRow label="Code" value={d?.uticod || emp?.empcod} />
          <InfoRow label="Matricule" value={emp?.empmat} />
          <InfoRow label="CIN" value={emp?.empcin} />
          <InfoRow label="Nom complet" value={emp?.emplib} />
          <InfoRow label="Prénom" value={emp?.empprn} />
          <InfoRow label="Sexe" value={emp?.empsex === 'M' ? 'Masculin' : emp?.empsex === 'F' ? 'Féminin' : emp?.empsex} />
          <InfoRow label="Date de naissance" value={emp?.empdatnais?.split('T')[0]} />
          <InfoRow label="Téléphone" value={emp?.emptel || d?.utitel} />
          <InfoRow label="Email" value={emp?.empemail || d?.utimail} />
          <InfoRow label="Adresse" value={emp?.empadr} />
        </View>

        {/* Professional Info Section */}
        <Text style={styles.sectionTitle}>🏢 Informations Professionnelles</Text>
        <View style={styles.infoSection}>
          <InfoRow label="Société" value={d?.soclib || d?.soccod} />
          <InfoRow label="Site" value={emp?.sitcod || d?.sitcod} />
          <InfoRow label="Direction" value={emp?.dircod} />
          <InfoRow label="Service" value={emp?.sercod} />
          <InfoRow label="Fonction" value={emp?.empfon} />
          <InfoRow label="Qualification" value={emp?.empqua} />
          <InfoRow label="Date d'entrée" value={emp?.empdatent?.split('T')[0]} />
          <InfoRow label="Date fin contrat" value={emp?.empdatfinctr?.split('T')[0]} />
          <InfoRow label="Statut" value={emp?.empsta === 'A' ? '✅ Actif' : emp?.empsta === 'S' ? '⏸️ Suspendu' : emp?.empsta} />
        </View>

        {/* Horaires Section */}
        {horaires.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>🕐 Horaires de Travail</Text>
            <View style={styles.infoSection}>
              {horaires.map((h: any, i: number) => (
                <View key={i} style={styles.horaireCard}>
                  <Text style={styles.horaireDay}>{h.jourlib || h.jour || `Jour ${i + 1}`}</Text>
                  <Text style={styles.horaireTime}>
                    {(h.horentmat || h.hdebut || '--:--')} - {(h.horsortmat || h.hfin || '--:--')}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Quick Links */}
        <Text style={styles.sectionTitle}>⚡ Accès rapides</Text>
        <View style={styles.quickLinks}>
          <TouchableOpacity style={styles.quickLinkBtn} onPress={() => navigation.navigate('Dashboard')}>
            <Text style={styles.quickLinkText}>📊 Tableau de Bord</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickLinkBtn} onPress={() => navigation.navigate('DigitalVault', {
            empcod: viewEmpcod,
            soccod: viewSoccod,
            empName: emp?.emplib || viewEmpcod,
          })}>
            <Text style={styles.quickLinkText}>📁 Coffre Numérique {!isOwnProfile ? `(de ${emp?.emplib || viewEmpcod})` : ''}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickLinkBtn} onPress={() => navigation.navigate('Balance')}>
            <Text style={styles.quickLinkText}>📋 Solde de Congés</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>🚪 Se Déconnecter</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, backgroundColor: '#fff', elevation: 2,
  },
  backBtn: { fontSize: 16, color: COLORS.primary, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: 'bold', color: COLORS.text },
  avatarSection: {
    alignItems: 'center', paddingVertical: 24, backgroundColor: '#fff',
    borderRadius: 16, marginBottom: 16, elevation: 2,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center', elevation: 4,
  },
  avatarText: { fontSize: 32, fontWeight: 'bold', color: '#fff' },
  name: { fontSize: 22, fontWeight: 'bold', color: COLORS.text, marginTop: 12 },
  email: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
  roleBadge: {
    marginTop: 8, paddingHorizontal: 14, paddingVertical: 4, borderRadius: 12,
    backgroundColor: '#e3f2fd',
  },
  roleText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.text, marginTop: 16, marginBottom: 8 },
  infoSection: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', elevation: 1 },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 14, borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  infoLabel: { fontSize: 13, color: COLORS.textSecondary, flex: 1 },
  infoValue: { fontSize: 13, fontWeight: '600', color: COLORS.text, flex: 1, textAlign: 'right' },
  horaireCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 14, borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  horaireDay: { fontSize: 13, color: COLORS.text, fontWeight: '500' },
  horaireTime: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  quickLinks: { gap: 8 },
  quickLinkBtn: {
    backgroundColor: '#fff', borderRadius: 10, padding: 14,
    flexDirection: 'row', alignItems: 'center', elevation: 1,
  },
  quickLinkText: { fontSize: 14, color: COLORS.primary, fontWeight: '500' },
  logoutBtn: {
    backgroundColor: '#fff', borderRadius: 10, padding: 16,
    alignItems: 'center', marginTop: 24, borderWidth: 1, borderColor: '#fee',
  },
  logoutText: { color: COLORS.error, fontSize: 16, fontWeight: 'bold' },
});