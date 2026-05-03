import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl, Image, Switch, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import { COLORS } from '../config/env';
import BottomTabBar from '../components/BottomTabBar';

const { width } = Dimensions.get('window');

export default function ProfileScreen({ navigation, route }: any) {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [employee, setEmployee] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [is2FAEnabled, setIs2FAEnabled] = useState(true);

  const viewEmpcod = route?.params?.empcod || user?.uticod;
  const viewSoccod = route?.params?.soccod || user?.soccod;
  // const isOwnProfile = !route?.params?.empcod || route?.params?.empcod === user?.uticod;
  const isOwnProfile = true;

  useEffect(() => { loadAll(); }, [user, route?.params]);

  const loadAll = async () => {
    if (!viewSoccod || !viewEmpcod) return;
    setLoading(true);
    try {
      const [profileData, empData] = await Promise.all([
        isOwnProfile ? apiService.getProfile(viewSoccod, viewEmpcod) : Promise.resolve(null),
        apiService.getEmployee(viewSoccod, viewEmpcod)
      ]);
      setProfile(profileData);
      setEmployee(empData);
    } catch (e) {
      console.log('Profile load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert('🔐 Déconnexion', 'Voulez-vous vous déconnecter en toute sécurité ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnexion', style: 'destructive', onPress: logout },
    ]);
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    );
  }

  const d = profile || user;
  const emp = employee || {};
  const fullName = emp?.emplib || d?.utilib || 'Collaborateur';
  const names = fullName.split(' ');
  const firstName = names[0];
  const lastName = names.slice(1).join(' ');

  const fmtDate = (val: any) => {
    if (!val) return '—';
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return String(val);
      return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return '—'; }
  };

  const sexeLabel = emp?.empsexe === 'F' ? 'Féminin' : emp?.empsexe === 'M' ? 'Masculin' : '—';
  const sitFam: Record<string, string> = { 'C': 'Célibataire', 'M': 'Marié(e)', 'D': 'Divorcé(e)', 'V': 'Veuf/Veuve' };
  const sitFamLabel = emp?.empsitfam ? (sitFam[emp.empsitfam] || emp.empsitfam) : '—';
  const hireYear = emp?.empemb ? new Date(emp.empemb).getFullYear() : null;

  return (
    <SafeAreaView style={styles.container}>
      {/* TopAppBar */}
      <View style={styles.topAppBar}>
        <View style={styles.topAppLeft}>
          <View style={styles.profileImageWrapper}>
            <Image
              source={{ uri: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA5PdNdboYXXitt83dzxBWd_iuVZSC4KLAHQRyxnXIP2hPENF8upUO_xbIAGNTTZhAp1xM-M_clLcu0wlTH-xEQGDIgp_WV7yz_ncZxTWkLrcnJ_RTDyw6QAMBBxj66ern-IRU8anfHjMESEPt-7RNJwrfHmjqk9k1L9L9rRo_xmGVrAugF5Kr73lQw9rJHakJ3O9twzIc1WCmY1sDdnkyDoSGIXly2hwxPX7VAHlrK7dF2CyJfNUDPOwFOnnPmezuCRYESZ04X1ek' }}
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
        {/* Profile Hero Section */}
        <View style={styles.heroSection}>
          <Text style={styles.heroSubLabel}>PROFIL COLLABORATEUR</Text>
          <Text style={styles.heroName}>{firstName}{lastName ? `\n${lastName}` : ''}</Text>
          <View style={styles.heroBadges}>
            {!!emp?.empfonc && (
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>{emp.empfonc}</Text>
              </View>
            )}
            {hireYear && <>
              <View style={styles.statusDot} />
              <Text style={styles.activeSince}>Actif depuis {hireYear}</Text>
            </>}
          </View>
        </View>

        {/* Section 01: Informations Personnelles */}
        <View style={styles.infoLedger}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Informations Personnelles</Text>
            <Text style={styles.sectionStep}>SECTION 01</Text>
          </View>

          <View style={styles.bentoGrid}>
            <View style={styles.bentoCard}>
              <Text style={styles.bentoLabel}>MATRICULE</Text>
              <Text style={styles.bentoValue}>{emp?.empmat || emp?.empcod || '—'}</Text>
            </View>
            <View style={styles.bentoCard}>
              <Text style={styles.bentoLabel}>SEXE</Text>
              <Text style={styles.bentoValue}>{sexeLabel}</Text>
            </View>
            <View style={styles.bentoCard}>
              <Text style={styles.bentoLabel}>DATE DE NAISSANCE</Text>
              <Text style={styles.bentoValue}>{fmtDate(emp?.empdnais)}</Text>
            </View>
            <View style={styles.bentoCard}>
              <Text style={styles.bentoLabel}>LIEU DE NAISSANCE</Text>
              <Text style={styles.bentoValue}>{emp?.emplnais || '—'}</Text>
            </View>
            <View style={styles.bentoCard}>
              <Text style={styles.bentoLabel}>SITUATION FAMILIALE</Text>
              <Text style={styles.bentoValue}>{sitFamLabel}</Text>
            </View>
            <View style={styles.bentoCard}>
              <Text style={styles.bentoLabel}>PERS. À CHARGE</Text>
              <Text style={styles.bentoValue}>{emp?.empnbp ?? '—'}</Text>
            </View>
            {!!emp?.empcin && (
              <View style={[styles.bentoCard, styles.fullWidthCard]}>
                <View>
                  <Text style={styles.bentoLabel}>CIN</Text>
                  <Text style={[styles.bentoValue, styles.trackingWider]}>{emp.empcin}</Text>
                </View>
                <MaterialCommunityIcons name="card-account-details-outline" size={20} color={COLORS.outline} />
              </View>
            )}
          </View>
        </View>

        {/* Section 02: Coordonnées */}
        <View style={styles.infoLedger}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Coordonnées</Text>
            <Text style={styles.sectionStep}>SECTION 02</Text>
          </View>

          <View style={styles.contactList}>
            <View style={styles.contactItem}>
              <View style={styles.contactIconWrapper}>
                <MaterialCommunityIcons name="email-outline" size={20} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactLabel}>EMAIL PROFESSIONNEL</Text>
                <Text style={styles.contactValue}>{emp?.empemail || d?.utimail || '—'}</Text>
              </View>
            </View>
            <View style={styles.contactItem}>
              <View style={styles.contactIconWrapper}>
                <MaterialCommunityIcons name="phone-outline" size={20} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactLabel}>TÉLÉPHONE FIXE</Text>
                <Text style={styles.contactValue}>{emp?.emptel || '—'}</Text>
              </View>
            </View>
            <View style={styles.contactItem}>
              <View style={styles.contactIconWrapper}>
                <MaterialCommunityIcons name="cellphone" size={20} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactLabel}>MOBILE</Text>
                <Text style={styles.contactValue}>{emp?.empmob || '—'}</Text>
              </View>
            </View>
            <View style={[styles.contactItem, styles.noBorder]}>
              <View style={styles.contactIconWrapper}>
                <MaterialCommunityIcons name="map-marker-outline" size={20} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactLabel}>ADRESSE</Text>
                <Text style={styles.contactValue}>{emp?.empadr || '—'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Section: Informations professionnelles */}
        <View style={styles.infoLedger}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Informations Professionnelles</Text>
            <Text style={styles.sectionStep}>SECTION 03</Text>
          </View>

          <View style={styles.bentoGrid}>
            <View style={styles.bentoCard}>
              <Text style={styles.bentoLabel}>DATE D'EMBAUCHE</Text>
              <Text style={styles.bentoValue}>{fmtDate(emp?.empemb)}</Text>
            </View>
            <View style={styles.bentoCard}>
              <Text style={styles.bentoLabel}>FONCTION</Text>
              <Text style={styles.bentoValue}>{emp?.empfonc || '—'}</Text>
            </View>
            <View style={styles.bentoCard}>
              <Text style={styles.bentoLabel}>SOCIÉTÉ</Text>
              <Text style={styles.bentoValue}>{d?.soclib || emp?.soccod || '—'}</Text>
            </View>
            <View style={styles.bentoCard}>
              <Text style={styles.bentoLabel}>SITE</Text>
              <Text style={styles.bentoValue}>{emp?.sitcod || '—'}</Text>
            </View>
            {!!emp?.sercod && (
              <View style={styles.bentoCard}>
                <Text style={styles.bentoLabel}>SERVICE</Text>
                <Text style={styles.bentoValue}>{emp.sercod}</Text>
              </View>
            )}
            {!!emp?.utirole && (
              <View style={styles.bentoCard}>
                <Text style={styles.bentoLabel}>RÔLE</Text>
                <Text style={styles.bentoValue}>{emp.utirole}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Section: Sécurité & Accès */}
        <View style={styles.infoLedger}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Sécurité & Accès</Text>
            <Text style={styles.sectionStep}>SECTION 04</Text>
          </View>

          <View style={styles.securityStack}>
            <TouchableOpacity style={styles.securityBtn}>
              <View style={styles.securityLeft}>
                <MaterialCommunityIcons name="lock-reset" size={24} color={COLORS.primary} />
                <Text style={styles.securityText}>Changer le mot de passe</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.outline} />
            </TouchableOpacity>

            <View style={styles.securityToggle}>
              <View style={styles.securityLeft}>
                <MaterialCommunityIcons name="shield-check" size={24} color={COLORS.tertiaryContainer} />
                <View>
                  <Text style={styles.securityText}>Double authentification (2FA)</Text>
                  <Text style={styles.securitySubText}>{is2FAEnabled ? 'ACTIVÉ' : 'DÉSACTIVÉ'}</Text>
                </View>
              </View>
              <Switch
                value={is2FAEnabled}
                onValueChange={setIs2FAEnabled}
                trackColor={{ false: COLORS.outlineVariant, true: COLORS.tertiaryContainer }}
                thumbColor="#fff"
              />
            </View>
          </View>
        </View>

        {/* Préférences notifications */}
        <TouchableOpacity
          style={styles.prefRow}
          onPress={() => navigation.navigate('NotificationPreferences')}
          activeOpacity={0.7}
        >
          <View style={styles.prefIconBox}>
            <MaterialCommunityIcons name="bell-cog-outline" size={22} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.prefTitle}>Préférences de notification</Text>
            <Text style={styles.prefSub}>Choisir les types de rappels et alertes</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={COLORS.outline} />
        </TouchableOpacity>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LinearGradient
            colors={[COLORS.primary, COLORS.primaryContainer]}
            style={styles.logoutGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <MaterialCommunityIcons name="logout" size={20} color="#fff" />
            <Text style={styles.logoutText}>DÉCONNEXION SÉCURISÉE</Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

      <BottomTabBar active="profile" navigation={navigation} />
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
  profileImageWrapper: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', backgroundColor: COLORS.surfaceContainerHigh },
  profileImage: { width: '100%', height: '100%' },
  logoText: { fontFamily: 'Manrope', fontWeight: '800', fontSize: 18, color: COLORS.primary, letterSpacing: -0.5 },
  iconButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 100 },
  heroSection: { marginBottom: 32 },
  heroSubLabel: { fontSize: 10, fontWeight: '800', color: COLORS.primary, letterSpacing: 1.5, marginBottom: 8 },
  heroName: { fontSize: 36, fontWeight: '800', color: COLORS.onSurface, letterSpacing: -1, lineHeight: 36 },
  heroBadges: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  roleBadge: { backgroundColor: 'rgba(0, 64, 161, 0.08)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  roleText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.tertiaryContainer },
  activeSince: { fontSize: 12, fontWeight: '600', color: COLORS.onSurfaceVariant },
  infoLedger: { marginBottom: 32 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 1, borderBottomColor: 'rgba(115, 119, 133, 0.15)', paddingBottom: 8, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.onSurface, fontFamily: 'Manrope' },
  sectionStep: { fontSize: 10, fontWeight: '800', color: COLORS.outline, letterSpacing: 1.5 },
  bentoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  bentoCard: {
    width: (width - 52) / 2, backgroundColor: COLORS.surfaceContainerLowest,
    borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(115, 119, 133, 0.1)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 8,
  },
  fullWidthCard: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bentoLabel: { fontSize: 10, fontWeight: '800', color: COLORS.outline, letterSpacing: 1, marginBottom: 4 },
  bentoValue: { fontSize: 14, fontWeight: '700', color: COLORS.onSecondaryFixed },
  trackingWider: { letterSpacing: 1.5 },
  contactList: { backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(115, 119, 133, 0.1)' },
  contactItem: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.surfaceContainerLow },
  noBorder: { borderBottomWidth: 0 },
  contactIconWrapper: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0, 64, 161, 0.05)', justifyContent: 'center', alignItems: 'center' },
  contactLabel: { fontSize: 10, fontWeight: '800', color: COLORS.outline, letterSpacing: 1 },
  contactValue: { fontSize: 14, fontWeight: '600', color: COLORS.onSurface },
  securityStack: { gap: 12 },
  securityBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.surfaceContainerLow, borderRadius: 16, padding: 16 },
  securityToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.surfaceContainerLowest, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(115, 119, 133, 0.1)' },
  securityLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  securityText: { fontSize: 14, fontWeight: '700', color: COLORS.onSurface },
  securitySubText: { fontSize: 9, fontWeight: '800', color: COLORS.outlineVariant, letterSpacing: 0.5 },
  logoutButton: { marginTop: 8 },
  logoutGradient: { height: 56, borderRadius: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 4 },
  prefRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    marginHorizontal: 20, marginBottom: 16,
  },
  prefIconBox: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: COLORS.primaryFixed,
    justifyContent: 'center', alignItems: 'center',
  },
  prefTitle: { fontSize: 14, fontWeight: '700', color: COLORS.onSurface },
  prefSub: { fontSize: 12, color: COLORS.outline, marginTop: 2 },
  logoutText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  bottomNav: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
    flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)', paddingBottom: 20,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  navItem: { alignItems: 'center', gap: 4 },
  navLabel: { fontSize: 9, fontWeight: '700', color: '#94a3b8' },
});