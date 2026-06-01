import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl, Image, Switch, Dimensions, TextInput, Modal, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/api';
import { COLORS } from '../config/env';
import { resolveAssetUrl } from '../config/assetUrl';
import BottomTabBar, { useTabBarPadding } from '../components/BottomTabBar';
import { useSecureScreen } from '../hooks/useSecureScreen';

const { width } = Dimensions.get('window');

export default function ProfileScreen({ navigation, route }: any) {
  // SEC-G4 : profil employé contient mot de passe / 2FA / IBAN / téléphone perso.
  useSecureScreen();
  const { user, logout, refreshUser, isAdmin, isManager } = useAuth();
  const tabBarPadding = useTabBarPadding();
  // Padding bas dynamique pour les modales : sur Android avec barre de
  // navigation système (3 boutons ou pill gesture), un paddingBottom statique
  // laissait passer le bouton "Enregistrer" SOUS les boutons home/back du
  // téléphone. On garde un plancher de 24px pour la marge visuelle, et on
  // ajoute insets.bottom quand le système a un inset (Android edge-to-edge,
  // iPhone avec home indicator).
  const insets = useSafeAreaInsets();
  const modalCardPaddingBottom = Math.max(24, insets.bottom + 12);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // L'état réel vient du profil (UtiTwoFactorEnabled = "1"). Sans ça, on
  // affichait toujours "ACTIVÉ" même quand le compte n'avait jamais activé 2FA.
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  // localPhotoUri : optimistic update — affiche la nouvelle photo dès la
  // sélection, sans attendre le retour serveur. Au refresh suivant on retombe
  // sur user.utiimg (la valeur persistée), ce qui couvre aussi le cas où
  // l'upload échoue silencieusement et qu'on veut revoir l'ancienne photo.
  const [localPhotoUri, setLocalPhotoUri] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  // Édition self-service des coordonnées (téléphone / mobile / adresse / ville
  // / email). L'employé peut tenir ses infos à jour sans solliciter les RH.
  const [contactEdit, setContactEdit] = useState(false);
  // Self-service profile : l'employé peut éditer toutes ses infos personnelles
  // SAUF role/service/société/site/fonction/date d'embauche (verrouillés côté
  // backend par la whitelist de /Employes/update-my-contact).
  const [contactForm, setContactForm] = useState({
    // Coordonnées
    emptel: '', empmob: '', empadr: '', vilcod: '', empemail: '',
    // État civil
    empsexe: '', empsitfam: '', empnbp: '', empdnais: '', emplnais: '', natcod: '',
    // Identité arabe (optionnel, pour les tenants multilingues)
    emplibar: '', empadrar: '',
  });
  const [savingContact, setSavingContact] = useState(false);
  // Modale "Changer le mot de passe" — bouton initialement non câblé.
  const [pwdModal, setPwdModal] = useState(false);
  const [pwdForm, setPwdForm] = useState({ current: '', next: '', confirm: '' });
  const [savingPwd, setSavingPwd] = useState(false);
  // 2FA : 'idle' (rien), 'qr' (QR + champ code de vérif), 'verifying'.
  const [twoFAState, setTwoFAState] = useState<'idle' | 'qr' | 'verifying' | 'disabling'>('idle');
  const [twoFAQr, setTwoFAQr] = useState<{ qrCodeBase64: string; manualEntryKey: string } | null>(null);
  const [twoFACode, setTwoFACode] = useState('');

  const viewEmpcod = route?.params?.empcod || user?.uticod;
  const viewSoccod = route?.params?.soccod || user?.soccod;
  // L'écran ProfileScreen est aussi utilisé en mode admin (route param empcod
  // d'un autre user). On n'autorise l'édition self-service que sur SON propre profil.
  const isOwnProfile = !route?.params?.empcod || route.params.empcod === user?.uticod;

  useEffect(() => { loadAll(); }, [user, route?.params]);

  // get-profile renvoie déjà l'employé (UtiProfile.Employee côté serveur),
  // ce qui évite d'appeler /Employes/get-employe — endpoint réservé à la
  // gestion des employés et inaccessible à un utilisateur standard.
  const loadAll = async () => {
    if (!viewSoccod || !viewEmpcod) return;
    setLoading(true);
    try {
      const profileData = await apiService.getProfile(viewSoccod, viewEmpcod);
      setProfile(profileData);
      // Sync l'état du switch 2FA avec la valeur persistée côté serveur.
      // Le backend renvoie "1" / "0" (string) en JSON sous le nom uti2fa_enabled.
      const flag = (profileData as any)?.uti2fa_enabled ?? (profileData as any)?.utiTwoFactorEnabled;
      setIs2FAEnabled(flag === '1' || flag === 1 || flag === true);
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

  // Upload réel après sélection. Le fichier est compressé à 0.8 par expo-image-picker
  // ; côté serveur FileHelper.SaveFile renvoie /api/uploads/<guid>.<ext>.
  const uploadPhoto = async (uri: string) => {
    if (!user?.uticod) return;
    setUploadingPhoto(true);
    setLocalPhotoUri(uri); // optimistic
    try {
      await apiService.uploadProfileImage(uri, user.uticod);
      // Re-sync l'auth context pour que utiimg soit à jour partout (HomeScreen,
      // TopAppBar des autres écrans). On évite ainsi que la prochaine ouverture
      // du Profile écrase localPhotoUri par l'ancien utiimg.
      await refreshUser();
      setLocalPhotoUri(null); // on retombe sur user.utiimg via resolveAssetUrl
    } catch (e) {
      setLocalPhotoUri(null); // rollback affichage
      Alert.alert('Erreur', "Le téléchargement de la photo a échoué. Réessayez plus tard.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Accès caméra', "L'autorisation est requise pour prendre une photo.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) await uploadPhoto(result.assets[0].uri);
  };

  const handlePickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) await uploadPhoto(result.assets[0].uri);
  };

  const openContactEdit = () => {
    const e = profile?.employee || profile?.Employee || {};
    setContactForm({
      emptel: e?.emptel || '',
      empmob: e?.empmob || '',
      empadr: e?.empadr || '',
      vilcod: e?.vilcod || '',
      empemail: e?.empemail || '',
      empsexe: (e?.empsexe || '').toUpperCase(),
      empsitfam: (e?.empsitfam || '').toUpperCase(),
      empnbp: e?.empnbp != null ? String(e.empnbp) : '',
      empdnais: e?.empdnais || '',
      emplnais: e?.emplnais || '',
      natcod: e?.natcod || '',
      emplibar: e?.emplibar || '',
      empadrar: e?.empadrar || '',
    });
    setContactEdit(true);
  };

  const saveContact = async () => {
    if (!user?.soccod || !user?.uticod) return;
    setSavingContact(true);
    try {
      const empnbpNum = contactForm.empnbp.trim() === '' ? undefined : Number(contactForm.empnbp);
      await apiService.updateMyContact({
        soccod: user.soccod,
        empcod: user.uticod,
        emptel: contactForm.emptel.trim() || undefined,
        empmob: contactForm.empmob.trim() || undefined,
        empadr: contactForm.empadr.trim() || undefined,
        vilcod: contactForm.vilcod.trim() || undefined,
        empemail: contactForm.empemail.trim() || undefined,
        empsexe: contactForm.empsexe.trim() || undefined,
        empsitfam: contactForm.empsitfam.trim() || undefined,
        empnbp: Number.isFinite(empnbpNum as number) ? (empnbpNum as number) : undefined,
        empdnais: contactForm.empdnais.trim() || undefined,
        emplnais: contactForm.emplnais.trim() || undefined,
        natcod: contactForm.natcod.trim() || undefined,
        emplibar: contactForm.emplibar.trim() || undefined,
        empadrar: contactForm.empadrar.trim() || undefined,
      });
      setContactEdit(false);
      await loadAll();
      Alert.alert('✅ Mis à jour', 'Vos coordonnées ont été enregistrées.');
    } catch (e: any) {
      const status = e?.response?.status;
      const serverMsg = e?.response?.data?.message;
      Alert.alert(
        'Erreur',
        serverMsg ?? (status === 409
          ? 'Cet email est déjà utilisé par un autre compte.'
          : "Impossible d'enregistrer les modifications.")
      );
    } finally {
      setSavingContact(false);
    }
  };

  const submitPasswordChange = async () => {
    if (!user?.uticod) return;
    if (!pwdForm.current.trim() || !pwdForm.next.trim()) {
      Alert.alert('Erreur', 'Renseignez votre mot de passe actuel et le nouveau mot de passe.');
      return;
    }
    if (pwdForm.next.length < 8) {
      Alert.alert('Erreur', 'Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (pwdForm.next !== pwdForm.confirm) {
      Alert.alert('Erreur', 'La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }
    setSavingPwd(true);
    try {
      const ok = await apiService.changePassword({
        uticod: user.uticod,
        currentPassword: pwdForm.current,
        newPassword: pwdForm.next,
      });
      if (ok) {
        Alert.alert('✅ Mot de passe modifié', 'Votre nouveau mot de passe est actif.');
        setPwdModal(false);
        setPwdForm({ current: '', next: '', confirm: '' });
      } else {
        // Le backend renvoie `false` quand le mot de passe actuel est incorrect.
        Alert.alert('Erreur', 'Le mot de passe actuel est incorrect.');
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Impossible de changer le mot de passe.";
      Alert.alert('Erreur', msg);
    } finally {
      setSavingPwd(false);
    }
  };

  const handle2FAToggle = (next: boolean) => {
    if (!user?.uticod) return;
    if (next) {
      // Activation : on demande le QR code, l'utilisateur scanne dans son
      // authenticator (Google / Microsoft / 1Password), puis valide avec un code.
      (async () => {
        try {
          const res = await apiService.enable2FA(user.uticod!);
          setTwoFAQr({ qrCodeBase64: res.qrCodeBase64, manualEntryKey: res.manualEntryKey });
          setTwoFACode('');
          setTwoFAState('qr');
        } catch {
          Alert.alert('Erreur', "Impossible d'initialiser la 2FA.");
        }
      })();
    } else {
      // Désactivation : confirmation explicite (dégrade la sécurité du compte).
      Alert.alert(
        'Désactiver la 2FA ?',
        "Votre compte sera moins sécurisé. Confirmez-vous la désactivation ?",
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Désactiver',
            style: 'destructive',
            onPress: async () => {
              setTwoFAState('disabling');
              try {
                await apiService.disable2FA(user.uticod!);
                setIs2FAEnabled(false);
                Alert.alert('2FA désactivée', 'La double authentification a été retirée.');
              } catch {
                Alert.alert('Erreur', 'Impossible de désactiver la 2FA.');
              } finally {
                setTwoFAState('idle');
              }
            },
          },
        ]
      );
    }
  };

  const verify2FACode = async () => {
    if (!user?.uticod || twoFACode.length !== 6) {
      Alert.alert('Erreur', 'Saisissez le code à 6 chiffres affiché par votre application d\'authentification.');
      return;
    }
    setTwoFAState('verifying');
    try {
      await apiService.verify2FA(user.uticod, twoFACode);
      setIs2FAEnabled(true);
      setTwoFAState('idle');
      setTwoFAQr(null);
      setTwoFACode('');
      Alert.alert('✅ 2FA activée', 'La double authentification est maintenant active sur votre compte.');
    } catch (e: any) {
      const msg = e?.response?.data?.Message || e?.response?.data?.message || 'Code invalide. Réessayez.';
      Alert.alert('Erreur', msg);
      setTwoFAState('qr');
    }
  };

  const handleAvatarPress = () => {
    if (uploadingPhoto) return;
    // Garde-fou : un manager qui consulte le profil d'un collaborateur ne doit
    // pas pouvoir lui uploader une photo en tap involontaire.
    if (!isOwnProfile) return;
    Alert.alert(
      'Photo de profil',
      'Choisissez une option',
      [
        { text: 'Prendre une photo', onPress: handleTakePhoto },
        { text: 'Choisir depuis la galerie', onPress: handlePickPhoto },
        { text: 'Annuler', style: 'cancel' },
      ]
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    );
  }

  const d = profile || user;
  const emp = profile?.employee || profile?.Employee || {};
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

  // Source d'affichage de l'avatar :
  //   - profil propre : utiimg du user authentifié (avec optimistic localPhotoUri),
  //   - profil collaborateur (admin/manager view) : utiimg du profil chargé.
  // Le fallback sur user.utiimg est uniquement utile sur le profil propre, le
  // temps que /get-profile remonte la valeur fraîche.
  const targetUtiImg = isOwnProfile
    ? (profile?.utiimg || user?.utiimg)
    : (profile?.utiimg || emp?.utiimg || emp?.empimg);
  const avatarUri = (isOwnProfile && localPhotoUri) || resolveAssetUrl(targetUtiImg);
  const initials = (firstName?.[0] || '') + (lastName?.[0] || '');

  return (
    <SafeAreaView style={styles.container}>
      {/* TopAppBar */}
      <View style={styles.topAppBar}>
        {isOwnProfile ? (
          <View style={styles.topAppLeft}>
            <View style={styles.profileImageWrapper}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.profileImage} />
              ) : (
                <View style={[styles.profileImage, styles.smallInitialsCircle]}>
                  <Text style={styles.smallInitialsText}>{initials || '?'}</Text>
                </View>
              )}
            </View>
            <Text style={styles.logoText}>Concorde Workly</Text>
          </View>
        ) : (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.topAppLeft} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.primary} />
            <Text style={styles.logoText}>Retour</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Notifications')}>
          <MaterialCommunityIcons name="bell-outline" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Hero Section */}
        <View style={styles.heroSection}>
          {/* Avatar tappable : ouvre le picker (caméra / galerie). Pendant
              l'upload on superpose un overlay + spinner pour bloquer un
              second tap et donner un feedback visuel. */}
          <TouchableOpacity
            onPress={handleAvatarPress}
            activeOpacity={0.85}
            style={styles.heroAvatarWrapper}
            disabled={uploadingPhoto}
          >
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.heroAvatar} />
            ) : (
              <LinearGradient
                colors={[COLORS.primary, COLORS.primaryContainer]}
                style={[styles.heroAvatar, styles.heroAvatarFallback]}
              >
                <Text style={styles.heroAvatarInitials}>{initials || '?'}</Text>
              </LinearGradient>
            )}
            {isOwnProfile && (
              <View style={styles.heroAvatarBadge}>
                {uploadingPhoto
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <MaterialCommunityIcons name="camera" size={16} color="#fff" />}
              </View>
            )}
          </TouchableOpacity>
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {isOwnProfile && (
                <TouchableOpacity onPress={openContactEdit} style={styles.editChip} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <MaterialCommunityIcons name="pencil-outline" size={14} color={COLORS.primary} />
                  <Text style={styles.editChipText}>Modifier</Text>
                </TouchableOpacity>
              )}
              <Text style={styles.sectionStep}>SECTION 02</Text>
            </View>
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

        {/* Actions admin/manager — visibles uniquement quand on consulte le
            profil d'un collaborateur (pas son propre profil). Permet d'accéder
            au coffre-fort de l'employé pour y ajouter/consulter des documents. */}
        {!isOwnProfile && (isAdmin || isManager) && (
          <TouchableOpacity
            style={styles.prefRow}
            onPress={() => navigation.navigate('DigitalVault', {
              empcod: viewEmpcod,
              soccod: viewSoccod,
              empName: fullName,
            })}
            activeOpacity={0.7}
          >
            <View style={styles.prefIconBox}>
              <MaterialCommunityIcons name="folder-lock" size={22} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.prefTitle}>Coffre-fort du collaborateur</Text>
              <Text style={styles.prefSub}>Consulter et ajouter des documents</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={COLORS.outline} />
          </TouchableOpacity>
        )}

        {/* Section: Sécurité & Accès */}
        {isOwnProfile && (
        <>
        <View style={styles.infoLedger}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Sécurité & Accès</Text>
            <Text style={styles.sectionStep}>SECTION 04</Text>
          </View>

          <View style={styles.securityStack}>
            <TouchableOpacity style={styles.securityBtn} onPress={() => setPwdModal(true)} activeOpacity={0.7}>
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
                onValueChange={handle2FAToggle}
                disabled={twoFAState !== 'idle'}
                trackColor={{ false: COLORS.outlineVariant, true: COLORS.tertiaryContainer }}
                thumbColor="#fff"
              />
            </View>
          </View>
        </View>

        {/* Mon emploi du temps (selon poste) */}
        <TouchableOpacity
          style={styles.prefRow}
          onPress={() => navigation.navigate('Schedule')}
          activeOpacity={0.7}
        >
          <View style={styles.prefIconBox}>
            <MaterialCommunityIcons name="calendar-clock" size={22} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.prefTitle}>Mon emploi du temps</Text>
            <Text style={styles.prefSub}>Horaires de travail selon votre poste</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={COLORS.outline} />
        </TouchableOpacity>

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

        {/* Liens légaux — requis par Apple Guideline 5.1.1(i) et Google Play
            Data Safety (accessibles depuis l'app, pas seulement depuis la fiche store). */}
        <View style={styles.legalLinks}>
          <TouchableOpacity onPress={() => Linking.openURL('https://concorde-work-force.com/docs/politique-confidentialite.pdf')}>
            <Text style={styles.legalLink}>Politique de confidentialité</Text>
          </TouchableOpacity>
          <Text style={styles.legalSep}>·</Text>
          <TouchableOpacity onPress={() => Linking.openURL('https://concorde-work-force.com/docs/cgu.pdf')}>
            <Text style={styles.legalLink}>CGU</Text>
          </TouchableOpacity>
        </View>

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
        </>
        )}
      </ScrollView>

      {/* La BottomTabBar n'a de sens que sur le profil de l'utilisateur courant.
          Sur la vue collaborateur (admin/manager), seule la flèche "Retour" sert
          à sortir de l'écran. */}
      {isOwnProfile && <BottomTabBar active="profile" navigation={navigation} />}

      {/* ── Modal "Changer le mot de passe" ── */}
      <Modal visible={pwdModal} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setPwdModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.contactModalOverlay}>
          <View style={[styles.contactModalCard, { paddingBottom: modalCardPaddingBottom }]}>
            <View style={styles.contactModalHeader}>
              <Text style={styles.contactModalTitle}>Changer le mot de passe</Text>
              <TouchableOpacity onPress={() => setPwdModal(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialCommunityIcons name="close" size={24} color={COLORS.outline} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>MOT DE PASSE ACTUEL</Text>
              <TextInput
                style={styles.contactInput}
                placeholder="••••••••"
                placeholderTextColor={COLORS.outline}
                value={pwdForm.current}
                onChangeText={(t) => setPwdForm({ ...pwdForm, current: t })}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.fieldLabel}>NOUVEAU MOT DE PASSE</Text>
              <TextInput
                style={styles.contactInput}
                placeholder="Au moins 8 caractères"
                placeholderTextColor={COLORS.outline}
                value={pwdForm.next}
                onChangeText={(t) => setPwdForm({ ...pwdForm, next: t })}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.fieldLabel}>CONFIRMATION</Text>
              <TextInput
                style={styles.contactInput}
                placeholder="Répétez le nouveau mot de passe"
                placeholderTextColor={COLORS.outline}
                value={pwdForm.confirm}
                onChangeText={(t) => setPwdForm({ ...pwdForm, confirm: t })}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.contactHint}>
                Pour votre sécurité, choisissez un mot de passe long et unique.
                Évitez les informations personnelles (nom, date de naissance, etc.).
              </Text>
            </ScrollView>
            <View style={styles.contactModalFooter}>
              <TouchableOpacity style={styles.contactCancelBtn} onPress={() => setPwdModal(false)}>
                <Text style={styles.contactCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.contactSaveBtn, savingPwd && { opacity: 0.5 }]}
                onPress={submitPasswordChange}
                disabled={savingPwd}
              >
                {savingPwd ? <ActivityIndicator color="#fff" /> : <Text style={styles.contactSaveText}>Mettre à jour</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal 2FA — QR code + saisie code ── */}
      <Modal
        visible={twoFAState === 'qr' || twoFAState === 'verifying'}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => { setTwoFAState('idle'); setTwoFAQr(null); }}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.contactModalOverlay}>
          <View style={[styles.contactModalCard, { paddingBottom: modalCardPaddingBottom }]}>
            <View style={styles.contactModalHeader}>
              <Text style={styles.contactModalTitle}>Activer la double authentification</Text>
              <TouchableOpacity
                onPress={() => { setTwoFAState('idle'); setTwoFAQr(null); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons name="close" size={24} color={COLORS.outline} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.contactHint}>
                1. Ouvrez votre app d'authentification (Google Authenticator, Microsoft Authenticator, 1Password…).{"\n"}
                2. Scannez le QR code ci-dessous (ou saisissez la clé manuellement).{"\n"}
                3. Tapez le code à 6 chiffres affiché.
              </Text>
              {twoFAQr?.qrCodeBase64 ? (
                <View style={styles.qrWrap}>
                  <Image source={{ uri: twoFAQr.qrCodeBase64 }} style={styles.qrImg} resizeMode="contain" />
                </View>
              ) : null}
              {twoFAQr?.manualEntryKey ? (
                <>
                  <Text style={styles.fieldLabel}>CLÉ MANUELLE</Text>
                  <Text selectable style={styles.manualKey}>{twoFAQr.manualEntryKey}</Text>
                </>
              ) : null}
              <Text style={styles.fieldLabel}>CODE À 6 CHIFFRES</Text>
              <TextInput
                style={[styles.contactInput, { letterSpacing: 4, textAlign: 'center', fontSize: 18, fontWeight: '700' }]}
                placeholder="------"
                placeholderTextColor={COLORS.outline}
                value={twoFACode}
                onChangeText={(t) => setTwoFACode(t.replace(/\D+/g, '').slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
              />
            </ScrollView>
            <View style={styles.contactModalFooter}>
              <TouchableOpacity
                style={styles.contactCancelBtn}
                onPress={() => { setTwoFAState('idle'); setTwoFAQr(null); }}
              >
                <Text style={styles.contactCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.contactSaveBtn, twoFAState === 'verifying' && { opacity: 0.5 }]}
                onPress={verify2FACode}
                disabled={twoFAState === 'verifying'}
              >
                {twoFAState === 'verifying' ? <ActivityIndicator color="#fff" /> : <Text style={styles.contactSaveText}>Vérifier</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal d'édition du profil (coordonnées + état civil + identité arabe).
          Le backend bloque toute modification de fonction/service/site/société/
          date d'embauche/salaires/rôle (whitelist côté update-my-contact). */}
      <Modal visible={contactEdit} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setContactEdit(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.contactModalOverlay}
        >
          <View style={[styles.contactModalCard, { paddingBottom: modalCardPaddingBottom }]}>
            <View style={styles.contactModalHeader}>
              <Text style={styles.contactModalTitle}>Mon profil</Text>
              <TouchableOpacity onPress={() => setContactEdit(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialCommunityIcons name="close" size={24} color={COLORS.outline} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* ─── COORDONNÉES ─── */}
              <Text style={styles.modalSectionHeader}>Coordonnées</Text>

              <Text style={styles.fieldLabel}>EMAIL</Text>
              <TextInput
                style={styles.contactInput}
                placeholder="prenom.nom@entreprise.com"
                placeholderTextColor={COLORS.outline}
                value={contactForm.empemail}
                onChangeText={(t) => setContactForm({ ...contactForm, empemail: t })}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.fieldLabel}>TÉLÉPHONE FIXE</Text>
              <TextInput
                style={styles.contactInput}
                placeholder="+XX XXX XXX XXX"
                placeholderTextColor={COLORS.outline}
                value={contactForm.emptel}
                onChangeText={(t) => setContactForm({ ...contactForm, emptel: t })}
                keyboardType="phone-pad"
              />

              <Text style={styles.fieldLabel}>MOBILE</Text>
              <TextInput
                style={styles.contactInput}
                placeholder="+XX XXX XXX XXX"
                placeholderTextColor={COLORS.outline}
                value={contactForm.empmob}
                onChangeText={(t) => setContactForm({ ...contactForm, empmob: t })}
                keyboardType="phone-pad"
              />

              <Text style={styles.fieldLabel}>ADRESSE</Text>
              <TextInput
                style={[styles.contactInput, { minHeight: 80, textAlignVertical: 'top' }]}
                placeholder="N°, rue, complément…"
                placeholderTextColor={COLORS.outline}
                value={contactForm.empadr}
                onChangeText={(t) => setContactForm({ ...contactForm, empadr: t })}
                multiline
              />

              <Text style={styles.fieldLabel}>CODE VILLE</Text>
              <TextInput
                style={styles.contactInput}
                placeholder="Ex. 75001"
                placeholderTextColor={COLORS.outline}
                value={contactForm.vilcod}
                onChangeText={(t) => setContactForm({ ...contactForm, vilcod: t })}
                keyboardType="numeric"
              />

              {/* ─── ÉTAT CIVIL ─── */}
              <Text style={styles.modalSectionHeader}>État civil</Text>

              <Text style={styles.fieldLabel}>SEXE</Text>
              <View style={styles.chipRow}>
                {[
                  { code: 'M', label: 'Homme' },
                  { code: 'F', label: 'Femme' },
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.code}
                    style={[styles.chip, contactForm.empsexe === opt.code && styles.chipActive]}
                    onPress={() => setContactForm({ ...contactForm, empsexe: contactForm.empsexe === opt.code ? '' : opt.code })}
                  >
                    <Text style={[styles.chipText, contactForm.empsexe === opt.code && styles.chipTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>SITUATION FAMILIALE</Text>
              <View style={styles.chipRow}>
                {[
                  { code: 'C', label: 'Célibataire' },
                  { code: 'M', label: 'Marié(e)' },
                  { code: 'D', label: 'Divorcé(e)' },
                  { code: 'V', label: 'Veuf/ve' },
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.code}
                    style={[styles.chip, contactForm.empsitfam === opt.code && styles.chipActive]}
                    onPress={() => setContactForm({ ...contactForm, empsitfam: contactForm.empsitfam === opt.code ? '' : opt.code })}
                  >
                    <Text style={[styles.chipText, contactForm.empsitfam === opt.code && styles.chipTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>NOMBRE D'ENFANTS À CHARGE</Text>
              <TextInput
                style={styles.contactInput}
                placeholder="0"
                placeholderTextColor={COLORS.outline}
                value={contactForm.empnbp}
                onChangeText={(t) => setContactForm({ ...contactForm, empnbp: t.replace(/\D+/g, '').slice(0, 2) })}
                keyboardType="number-pad"
              />

              <Text style={styles.fieldLabel}>DATE DE NAISSANCE</Text>
              <TextInput
                style={styles.contactInput}
                placeholder="JJ/MM/AAAA"
                placeholderTextColor={COLORS.outline}
                value={contactForm.empdnais}
                onChangeText={(t) => setContactForm({ ...contactForm, empdnais: t })}
              />

              <Text style={styles.fieldLabel}>LIEU DE NAISSANCE</Text>
              <TextInput
                style={styles.contactInput}
                placeholder="Ville, pays"
                placeholderTextColor={COLORS.outline}
                value={contactForm.emplnais}
                onChangeText={(t) => setContactForm({ ...contactForm, emplnais: t })}
              />

              <Text style={styles.fieldLabel}>CODE NATIONALITÉ</Text>
              <TextInput
                style={styles.contactInput}
                placeholder="Ex. FR, MA, TN…"
                placeholderTextColor={COLORS.outline}
                value={contactForm.natcod}
                onChangeText={(t) => setContactForm({ ...contactForm, natcod: t.toUpperCase().slice(0, 4) })}
                autoCapitalize="characters"
              />

              {/* ─── IDENTITÉ MULTILINGUE (optionnelle) ─── */}
              <Text style={styles.modalSectionHeader}>Identité (arabe)</Text>

              <Text style={styles.fieldLabel}>NOM EN ARABE</Text>
              <TextInput
                style={[styles.contactInput, { textAlign: 'right' }]}
                placeholderTextColor={COLORS.outline}
                value={contactForm.emplibar}
                onChangeText={(t) => setContactForm({ ...contactForm, emplibar: t })}
              />

              <Text style={styles.fieldLabel}>ADRESSE EN ARABE</Text>
              <TextInput
                style={[styles.contactInput, { minHeight: 60, textAlignVertical: 'top', textAlign: 'right' }]}
                placeholderTextColor={COLORS.outline}
                value={contactForm.empadrar}
                onChangeText={(t) => setContactForm({ ...contactForm, empadrar: t })}
                multiline
              />

              <Text style={styles.contactHint}>
                Vous pouvez modifier vos informations personnelles. La fonction, le service,
                le site, la société et la date d'embauche restent sous le contrôle des RH.
              </Text>
            </ScrollView>

            <View style={styles.contactModalFooter}>
              <TouchableOpacity style={styles.contactCancelBtn} onPress={() => setContactEdit(false)}>
                <Text style={styles.contactCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.contactSaveBtn, savingContact && { opacity: 0.5 }]}
                onPress={saveContact}
                disabled={savingContact}
              >
                {savingContact ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.contactSaveText}>Enregistrer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  heroAvatarWrapper: {
    width: 96, height: 96, borderRadius: 48,
    marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 5,
  },
  heroAvatar: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: COLORS.surfaceContainerHigh,
    borderWidth: 3, borderColor: '#fff',
  },
  heroAvatarFallback: {
    justifyContent: 'center', alignItems: 'center',
  },
  heroAvatarInitials: {
    fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: -0.5,
    fontFamily: 'Manrope',
  },
  heroAvatarBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.background,
  },
  smallInitialsCircle: {
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  smallInitialsText: {
    color: '#fff', fontSize: 14, fontWeight: '800',
  },
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
  legalLinks: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 4 },
  legalLink: { fontSize: 12, color: COLORS.outline, textDecorationLine: 'underline' },
  legalSep: { fontSize: 12, color: COLORS.outline },
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

  // Bouton "Modifier" placé à droite du titre "Coordonnées" pour ouvrir le modal d'édition.
  editChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14,
    backgroundColor: COLORS.primaryFixed,
  },
  editChipText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },

  // Modal d'édition des coordonnées (self-service). elevation: 30 pour passer
  // au-dessus du BottomTabBar (elevation: 8) sur Android.
  contactModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
    elevation: 30,
  },
  contactModalCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24,
    maxHeight: '90%',
  },
  contactModalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16,
  },
  contactModalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.onSurface },
  fieldLabel: {
    fontSize: 10, fontWeight: '800', color: COLORS.outline,
    letterSpacing: 1, marginTop: 14, marginBottom: 6,
  },
  contactInput: {
    backgroundColor: COLORS.surfaceContainerLow, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, color: COLORS.onSurface,
    marginBottom: 4,
  },
  contactHint: { fontSize: 11, color: COLORS.outline, marginTop: 16, lineHeight: 16, fontStyle: 'italic' },
  modalSectionHeader: {
    fontSize: 12, fontWeight: '800', color: COLORS.primary,
    marginTop: 18, marginBottom: 4, letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: COLORS.outlineVariant,
    backgroundColor: COLORS.surfaceContainerLow,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 12, fontWeight: '700', color: COLORS.onSurfaceVariant },
  chipTextActive: { color: '#fff' },
  contactModalFooter: {
    flexDirection: 'row', gap: 10, marginTop: 16,
  },
  contactCancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    alignItems: 'center', backgroundColor: COLORS.surfaceContainerLow,
  },
  contactCancelText: { fontSize: 13, fontWeight: '700', color: COLORS.onSurfaceVariant },
  contactSaveBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 14,
    alignItems: 'center', backgroundColor: COLORS.primary,
  },
  contactSaveText: { fontSize: 13, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },

  // 2FA — affichage du QR code et de la clé manuelle (fallback authenticators sans caméra).
  qrWrap: {
    alignItems: 'center', marginTop: 16, padding: 12,
    backgroundColor: '#fff', borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.outlineVariant,
  },
  qrImg: { width: 220, height: 220 },
  manualKey: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13, fontWeight: '700',
    color: COLORS.onSurface, backgroundColor: COLORS.surfaceContainerLow,
    padding: 12, borderRadius: 8, letterSpacing: 1, textAlign: 'center',
    marginBottom: 8,
  },
});