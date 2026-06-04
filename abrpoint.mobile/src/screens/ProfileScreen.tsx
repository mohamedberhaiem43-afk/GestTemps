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
import LanguageSwitcher from '../components/LanguageSwitcher';
import { useSecureScreen } from '../hooks/useSecureScreen';
import { useI18n } from '../i18n';

const { width } = Dimensions.get('window');

export default function ProfileScreen({ navigation, route }: any) {
  // SEC-G4 : profil employé contient mot de passe / 2FA / IBAN / téléphone perso.
  useSecureScreen();
  const { user, logout, refreshUser, isAdmin, isManager } = useAuth();
  const { t, lang } = useI18n();
  const locale = lang === 'en' ? 'en-GB' : 'fr-FR';
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
  // Suppression de compte (flux 2 étapes : demande → code email → confirmation).
  const [delModal, setDelModal] = useState(false);
  const [delCode, setDelCode] = useState('');
  const [delEmail, setDelEmail] = useState('');
  const [delLoading, setDelLoading] = useState(false);
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
    Alert.alert(`🔐 ${t('logout.title')}`, t('profile.logoutConfirmSecure'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('logout.title'), style: 'destructive', onPress: logout },
    ]);
  };

  // Suppression de compte (RGPD / Google Play) — flux sécurisé en 2 étapes.
  // Étape 1 : confirmation, puis envoi d'un code par email à l'utilisateur.
  const handleRequestDeletion = () => {
    Alert.alert(
      t('profile.deleteTitle'),
      t('profile.deleteBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.sendCode'),
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await apiService.requestAccountDeletion();
              setDelEmail(res?.email ?? '');
              setDelCode('');
              setDelModal(true);
            } catch (e: any) {
              const msg = e?.response?.data?.message ?? t('profile.sendFail');
              Alert.alert(t('common.error'), msg);
            }
          },
        },
      ]
    );
  };

  // Étape 2 : l'utilisateur saisit le code reçu → confirmation effective.
  const handleConfirmDeletion = async () => {
    if (delCode.trim().length < 4) {
      Alert.alert(t('profile.codeRequired'), t('profile.enterCodeEmail'));
      return;
    }
    setDelLoading(true);
    try {
      const res = await apiService.confirmAccountDeletion(delCode.trim());
      setDelModal(false);
      setDelCode('');
      Alert.alert(t('profile.deletionConfirmed'), res?.message ?? t('profile.deletionConfirmedMsg'));
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? t('profile.codeInvalid');
      Alert.alert(t('common.error'), msg);
    } finally {
      setDelLoading(false);
    }
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
      Alert.alert(t('common.error'), t('profile.photoUploadError'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('profile.cameraAccess'), t('profile.cameraPermNeeded'));
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
      Alert.alert(t('profile.updated'), t('profile.contactSaved'));
    } catch (e: any) {
      const status = e?.response?.status;
      const serverMsg = e?.response?.data?.message;
      Alert.alert(
        t('common.error'),
        serverMsg ?? (status === 409
          ? t('profile.emailConflict')
          : t('profile.saveFailed'))
      );
    } finally {
      setSavingContact(false);
    }
  };

  const submitPasswordChange = async () => {
    if (!user?.uticod) return;
    if (!pwdForm.current.trim() || !pwdForm.next.trim()) {
      Alert.alert(t('common.error'), t('profile.pwdFillCurrentNew'));
      return;
    }
    if (pwdForm.next.length < 8) {
      Alert.alert(t('common.error'), t('profile.pwdTooShort'));
      return;
    }
    if (pwdForm.next !== pwdForm.confirm) {
      Alert.alert(t('common.error'), t('profile.pwdMismatch'));
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
        Alert.alert(t('profile.pwdChanged'), t('profile.pwdChangedMsg'));
        setPwdModal(false);
        setPwdForm({ current: '', next: '', confirm: '' });
      } else {
        // Le backend renvoie `false` quand le mot de passe actuel est incorrect.
        Alert.alert(t('common.error'), t('profile.pwdCurrentWrong'));
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || t('profile.pwdChangeFailed');
      Alert.alert(t('common.error'), msg);
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
          Alert.alert(t('common.error'), t('profile.init2FAError'));
        }
      })();
    } else {
      // Désactivation : confirmation explicite (dégrade la sécurité du compte).
      Alert.alert(
        t('profile.disable2FATitle'),
        t('profile.disable2FABody'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('profile.disable'),
            style: 'destructive',
            onPress: async () => {
              setTwoFAState('disabling');
              try {
                await apiService.disable2FA(user.uticod!);
                setIs2FAEnabled(false);
                Alert.alert(t('profile.twoFADisabled'), t('profile.twoFADisabledMsg'));
              } catch {
                Alert.alert(t('common.error'), t('profile.twoFADisableError'));
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
      Alert.alert(t('common.error'), t('profile.enter6Auth'));
      return;
    }
    setTwoFAState('verifying');
    try {
      await apiService.verify2FA(user.uticod, twoFACode);
      setIs2FAEnabled(true);
      setTwoFAState('idle');
      setTwoFAQr(null);
      setTwoFACode('');
      Alert.alert(t('profile.twoFAEnabled'), t('profile.twoFAEnabledMsg'));
    } catch (e: any) {
      const msg = e?.response?.data?.Message || e?.response?.data?.message || t('profile.codeInvalidRetry');
      Alert.alert(t('common.error'), msg);
      setTwoFAState('qr');
    }
  };

  const handleAvatarPress = () => {
    if (uploadingPhoto) return;
    // Garde-fou : un manager qui consulte le profil d'un collaborateur ne doit
    // pas pouvoir lui uploader une photo en tap involontaire.
    if (!isOwnProfile) return;
    Alert.alert(
      t('profile.photoTitle'),
      t('profile.photoChoose'),
      [
        { text: t('profile.takePhoto'), onPress: handleTakePhoto },
        { text: t('profile.pickGallery'), onPress: handlePickPhoto },
        { text: t('common.cancel'), style: 'cancel' },
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
  const fullName = emp?.emplib || d?.utilib || t('profile.employeeFallback');
  const names = fullName.split(' ');
  const firstName = names[0];
  const lastName = names.slice(1).join(' ');

  const fmtDate = (val: any) => {
    if (!val) return '—';
    try {
      const d = new Date(val);
      if (isNaN(d.getTime())) return String(val);
      return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return '—'; }
  };

  const sexeLabel = emp?.empsexe === 'F' ? t('profile.female') : emp?.empsexe === 'M' ? t('profile.male') : '—';
  const sitFam: Record<string, string> = { 'C': t('profile.single'), 'M': t('profile.married'), 'D': t('profile.divorced'), 'V': t('profile.widowed') };
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
            <Text style={styles.logoText}>{t('profile.brand')}</Text>
          </View>
        ) : (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.topAppLeft} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.primary} />
            <Text style={styles.logoText}>{t('profile.back')}</Text>
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
          <Text style={styles.heroSubLabel}>{t('profile.heroSubLabel')}</Text>
          <Text style={styles.heroName}>{firstName}{lastName ? `\n${lastName}` : ''}</Text>
          <View style={styles.heroBadges}>
            {!!emp?.empfonc && (
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>{emp.empfonc}</Text>
              </View>
            )}
            {hireYear && <>
              <View style={styles.statusDot} />
              <Text style={styles.activeSince}>{t('profile.activeSince', { year: hireYear })}</Text>
            </>}
          </View>
        </View>

        {/* Section 01: Informations Personnelles */}
        <View style={styles.infoLedger}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('profile.personalInfo')}</Text>
            <Text style={styles.sectionStep}>{t('profile.section', { n: '01' })}</Text>
          </View>

          <View style={styles.bentoGrid}>
            <View style={styles.bentoCard}>
              <Text style={styles.bentoLabel}>{t('profile.matricule')}</Text>
              <Text style={styles.bentoValue}>{emp?.empmat || emp?.empcod || '—'}</Text>
            </View>
            <View style={styles.bentoCard}>
              <Text style={styles.bentoLabel}>{t('profile.sex')}</Text>
              <Text style={styles.bentoValue}>{sexeLabel}</Text>
            </View>
            <View style={styles.bentoCard}>
              <Text style={styles.bentoLabel}>{t('profile.birthDate')}</Text>
              <Text style={styles.bentoValue}>{fmtDate(emp?.empdnais)}</Text>
            </View>
            <View style={styles.bentoCard}>
              <Text style={styles.bentoLabel}>{t('profile.birthPlace')}</Text>
              <Text style={styles.bentoValue}>{emp?.emplnais || '—'}</Text>
            </View>
            <View style={styles.bentoCard}>
              <Text style={styles.bentoLabel}>{t('profile.familyStatus')}</Text>
              <Text style={styles.bentoValue}>{sitFamLabel}</Text>
            </View>
            <View style={styles.bentoCard}>
              <Text style={styles.bentoLabel}>{t('profile.dependents')}</Text>
              <Text style={styles.bentoValue}>{emp?.empnbp ?? '—'}</Text>
            </View>
            {!!emp?.empcin && (
              <View style={[styles.bentoCard, styles.fullWidthCard]}>
                <View>
                  <Text style={styles.bentoLabel}>{t('profile.cin')}</Text>
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
            <Text style={styles.sectionTitle}>{t('profile.contactInfo')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {isOwnProfile && (
                <TouchableOpacity onPress={openContactEdit} style={styles.editChip} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <MaterialCommunityIcons name="pencil-outline" size={14} color={COLORS.primary} />
                  <Text style={styles.editChipText}>{t('profile.edit')}</Text>
                </TouchableOpacity>
              )}
              <Text style={styles.sectionStep}>{t('profile.section', { n: '02' })}</Text>
            </View>
          </View>

          <View style={styles.contactList}>
            <View style={styles.contactItem}>
              <View style={styles.contactIconWrapper}>
                <MaterialCommunityIcons name="email-outline" size={20} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactLabel}>{t('profile.proEmail')}</Text>
                <Text style={styles.contactValue}>{emp?.empemail || d?.utimail || '—'}</Text>
              </View>
            </View>
            <View style={styles.contactItem}>
              <View style={styles.contactIconWrapper}>
                <MaterialCommunityIcons name="phone-outline" size={20} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactLabel}>{t('profile.landline')}</Text>
                <Text style={styles.contactValue}>{emp?.emptel || '—'}</Text>
              </View>
            </View>
            <View style={styles.contactItem}>
              <View style={styles.contactIconWrapper}>
                <MaterialCommunityIcons name="cellphone" size={20} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactLabel}>{t('profile.mobile')}</Text>
                <Text style={styles.contactValue}>{emp?.empmob || '—'}</Text>
              </View>
            </View>
            <View style={[styles.contactItem, styles.noBorder]}>
              <View style={styles.contactIconWrapper}>
                <MaterialCommunityIcons name="map-marker-outline" size={20} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactLabel}>{t('profile.address')}</Text>
                <Text style={styles.contactValue}>{emp?.empadr || '—'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Section: Informations professionnelles */}
        <View style={styles.infoLedger}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('profile.proInfo')}</Text>
            <Text style={styles.sectionStep}>{t('profile.section', { n: '03' })}</Text>
          </View>

          <View style={styles.bentoGrid}>
            <View style={styles.bentoCard}>
              <Text style={styles.bentoLabel}>{t('profile.hireDate')}</Text>
              <Text style={styles.bentoValue}>{fmtDate(emp?.empemb)}</Text>
            </View>
            <View style={styles.bentoCard}>
              <Text style={styles.bentoLabel}>{t('profile.role')}</Text>
              <Text style={styles.bentoValue}>{emp?.empfonc || '—'}</Text>
            </View>
            <View style={styles.bentoCard}>
              <Text style={styles.bentoLabel}>{t('profile.company')}</Text>
              <Text style={styles.bentoValue}>{d?.soclib || emp?.soccod || '—'}</Text>
            </View>
            <View style={styles.bentoCard}>
              <Text style={styles.bentoLabel}>{t('profile.site')}</Text>
              <Text style={styles.bentoValue}>{emp?.sitcod || '—'}</Text>
            </View>
            {!!emp?.sercod && (
              <View style={styles.bentoCard}>
                <Text style={styles.bentoLabel}>{t('profile.department')}</Text>
                <Text style={styles.bentoValue}>{emp.sercod}</Text>
              </View>
            )}
            {!!emp?.utirole && (
              <View style={styles.bentoCard}>
                <Text style={styles.bentoLabel}>{t('profile.accessRole')}</Text>
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
              <Text style={styles.prefTitle}>{t('profile.employeeVault')}</Text>
              <Text style={styles.prefSub}>{t('profile.employeeVaultSub')}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={COLORS.outline} />
          </TouchableOpacity>
        )}

        {/* Section: Sécurité & Accès */}
        {isOwnProfile && (
        <>
        <View style={styles.infoLedger}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{t('profile.securityAccess')}</Text>
            <Text style={styles.sectionStep}>{t('profile.section', { n: '04' })}</Text>
          </View>

          <View style={styles.securityStack}>
            <TouchableOpacity style={styles.securityBtn} onPress={() => setPwdModal(true)} activeOpacity={0.7}>
              <View style={styles.securityLeft}>
                <MaterialCommunityIcons name="lock-reset" size={24} color={COLORS.primary} />
                <Text style={styles.securityText}>{t('profile.changePassword')}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={COLORS.outline} />
            </TouchableOpacity>

            <View style={styles.securityToggle}>
              <View style={styles.securityLeft}>
                <MaterialCommunityIcons name="shield-check" size={24} color={COLORS.tertiaryContainer} />
                <View>
                  <Text style={styles.securityText}>{t('profile.twoFA')}</Text>
                  <Text style={styles.securitySubText}>{is2FAEnabled ? t('profile.enabled') : t('profile.disabled')}</Text>
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
            <Text style={styles.prefTitle}>{t('profile.mySchedule')}</Text>
            <Text style={styles.prefSub}>{t('profile.myScheduleSub')}</Text>
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
            <Text style={styles.prefTitle}>{t('profile.notifPrefs')}</Text>
            <Text style={styles.prefSub}>{t('profile.notifPrefsSub')}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color={COLORS.outline} />
        </TouchableOpacity>

        {/* Sélecteur de langue (FR / EN) */}
        <View style={{ marginTop: 8, marginBottom: 4, paddingHorizontal: 4 }}>
          <LanguageSwitcher />
        </View>

        {/* Liens légaux — requis par Apple Guideline 5.1.1(i) et Google Play
            Data Safety (accessibles depuis l'app, pas seulement depuis la fiche store). */}
        <View style={styles.legalLinks}>
          <TouchableOpacity onPress={() => Linking.openURL('https://concorde-work-force.com/docs/politique-confidentialite.pdf')}>
            <Text style={styles.legalLink}>{t('profile.privacyPolicy')}</Text>
          </TouchableOpacity>
          <Text style={styles.legalSep}>·</Text>
          <TouchableOpacity onPress={() => Linking.openURL('https://concorde-work-force.com/docs/cgu.pdf')}>
            <Text style={styles.legalLink}>{t('profile.terms')}</Text>
          </TouchableOpacity>
          <Text style={styles.legalSep}>·</Text>
          <TouchableOpacity onPress={() => Linking.openURL('https://concorde-work-force.com/suppression-compte')}>
            <Text style={styles.legalLink}>{t('profile.accountDeletion')}</Text>
          </TouchableOpacity>
        </View>

        {/* Suppression de compte — exigence Google Play « Data deletion » + RGPD.
            Déclenche une demande (cf. AccountController), accès suspendu, données
            anonymisées/supprimées sous 30 j. */}
        <TouchableOpacity style={styles.deleteAccountButton} onPress={handleRequestDeletion} activeOpacity={0.7}>
          <MaterialCommunityIcons name="account-remove-outline" size={20} color="#dc2626" />
          <Text style={styles.deleteAccountText}>{t('profile.deleteTitle')}</Text>
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
            <Text style={styles.logoutText}>{t('profile.logoutSecure')}</Text>
          </LinearGradient>
        </TouchableOpacity>
        </>
        )}
      </ScrollView>

      {/* La BottomTabBar n'a de sens que sur le profil de l'utilisateur courant.
          Sur la vue collaborateur (admin/manager), seule la flèche "Retour" sert
          à sortir de l'écran. */}
      {isOwnProfile && <BottomTabBar active="profile" navigation={navigation} />}

      {/* ── Modal "Suppression de compte — saisie du code" ── */}
      <Modal visible={delModal} transparent animationType="slide" statusBarTranslucent onRequestClose={() => !delLoading && setDelModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.contactModalOverlay}>
          <View style={[styles.contactModalCard, { paddingBottom: modalCardPaddingBottom }]}>
            <View style={styles.contactModalHeader}>
              <Text style={[styles.contactModalTitle, { color: '#dc2626' }]}>{t('profile.confirmDeletion')}</Text>
              <TouchableOpacity onPress={() => !delLoading && setDelModal(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialCommunityIcons name="close" size={24} color={COLORS.outline} />
              </TouchableOpacity>
            </View>
            <Text style={{ color: '#475569', fontSize: 14, lineHeight: 20, marginBottom: 16 }}>
              {delEmail
                ? t('profile.enterCodeTo', { email: delEmail })
                : t('profile.enterCode6')}
            </Text>
            <TextInput
              value={delCode}
              onChangeText={setDelCode}
              placeholder="------"
              keyboardType="number-pad"
              maxLength={6}
              style={{ borderWidth: 1.5, borderColor: '#fca5a5', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, fontSize: 22, letterSpacing: 8, textAlign: 'center', color: '#0f172a', marginBottom: 18 }}
            />
            <TouchableOpacity
              style={{ height: 50, borderRadius: 14, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center', opacity: delLoading ? 0.7 : 1 }}
              onPress={handleConfirmDeletion}
              disabled={delLoading}
              activeOpacity={0.8}
            >
              {delLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{t('profile.confirmDeletion')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={handleRequestDeletion} disabled={delLoading} style={{ marginTop: 14, alignItems: 'center' }}>
              <Text style={{ color: COLORS.primary, fontSize: 13, fontWeight: '600' }}>{t('profile.resendCode')}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal "Changer le mot de passe" ── */}
      <Modal visible={pwdModal} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setPwdModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.contactModalOverlay}>
          <View style={[styles.contactModalCard, { paddingBottom: modalCardPaddingBottom }]}>
            <View style={styles.contactModalHeader}>
              <Text style={styles.contactModalTitle}>{t('profile.changePassword')}</Text>
              <TouchableOpacity onPress={() => setPwdModal(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialCommunityIcons name="close" size={24} color={COLORS.outline} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>{t('profile.pwdCurrent')}</Text>
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
              <Text style={styles.fieldLabel}>{t('profile.pwdNew')}</Text>
              <TextInput
                style={styles.contactInput}
                placeholder={t('profile.pwdNewPlaceholder')}
                placeholderTextColor={COLORS.outline}
                value={pwdForm.next}
                onChangeText={(v) => setPwdForm({ ...pwdForm, next: v })}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.fieldLabel}>{t('profile.pwdConfirm')}</Text>
              <TextInput
                style={styles.contactInput}
                placeholder={t('profile.pwdConfirmPlaceholder')}
                placeholderTextColor={COLORS.outline}
                value={pwdForm.confirm}
                onChangeText={(v) => setPwdForm({ ...pwdForm, confirm: v })}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.contactHint}>{t('profile.pwdHint')}</Text>
            </ScrollView>
            <View style={styles.contactModalFooter}>
              <TouchableOpacity style={styles.contactCancelBtn} onPress={() => setPwdModal(false)}>
                <Text style={styles.contactCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.contactSaveBtn, savingPwd && { opacity: 0.5 }]}
                onPress={submitPasswordChange}
                disabled={savingPwd}
              >
                {savingPwd ? <ActivityIndicator color="#fff" /> : <Text style={styles.contactSaveText}>{t('profile.update')}</Text>}
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
              <Text style={styles.contactModalTitle}>{t('profile.enable2FA')}</Text>
              <TouchableOpacity
                onPress={() => { setTwoFAState('idle'); setTwoFAQr(null); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons name="close" size={24} color={COLORS.outline} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.contactHint}>{t('profile.twoFASteps')}</Text>
              {twoFAQr?.qrCodeBase64 ? (
                <View style={styles.qrWrap}>
                  <Image source={{ uri: twoFAQr.qrCodeBase64 }} style={styles.qrImg} resizeMode="contain" />
                </View>
              ) : null}
              {twoFAQr?.manualEntryKey ? (
                <>
                  <Text style={styles.fieldLabel}>{t('profile.manualKey')}</Text>
                  <Text selectable style={styles.manualKey}>{twoFAQr.manualEntryKey}</Text>
                </>
              ) : null}
              <Text style={styles.fieldLabel}>{t('profile.code6')}</Text>
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
                <Text style={styles.contactCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.contactSaveBtn, twoFAState === 'verifying' && { opacity: 0.5 }]}
                onPress={verify2FACode}
                disabled={twoFAState === 'verifying'}
              >
                {twoFAState === 'verifying' ? <ActivityIndicator color="#fff" /> : <Text style={styles.contactSaveText}>{t('profile.verify')}</Text>}
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
              <Text style={styles.contactModalTitle}>{t('profile.myProfile')}</Text>
              <TouchableOpacity onPress={() => setContactEdit(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialCommunityIcons name="close" size={24} color={COLORS.outline} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* ─── COORDONNÉES ─── */}
              <Text style={styles.modalSectionHeader}>{t('profile.contactInfo')}</Text>

              <Text style={styles.fieldLabel}>{t('profile.email')}</Text>
              <TextInput
                style={styles.contactInput}
                placeholder={t('profile.emailPlaceholder')}
                placeholderTextColor={COLORS.outline}
                value={contactForm.empemail}
                onChangeText={(t) => setContactForm({ ...contactForm, empemail: t })}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.fieldLabel}>{t('profile.landline')}</Text>
              <TextInput
                style={styles.contactInput}
                placeholder={t('profile.phonePlaceholder')}
                placeholderTextColor={COLORS.outline}
                value={contactForm.emptel}
                onChangeText={(v) => setContactForm({ ...contactForm, emptel: v })}
                keyboardType="phone-pad"
              />

              <Text style={styles.fieldLabel}>{t('profile.mobile')}</Text>
              <TextInput
                style={styles.contactInput}
                placeholder={t('profile.phonePlaceholder')}
                placeholderTextColor={COLORS.outline}
                value={contactForm.empmob}
                onChangeText={(v) => setContactForm({ ...contactForm, empmob: v })}
                keyboardType="phone-pad"
              />

              <Text style={styles.fieldLabel}>{t('profile.address')}</Text>
              <TextInput
                style={[styles.contactInput, { minHeight: 80, textAlignVertical: 'top' }]}
                placeholder={t('profile.addressPlaceholder')}
                placeholderTextColor={COLORS.outline}
                value={contactForm.empadr}
                onChangeText={(v) => setContactForm({ ...contactForm, empadr: v })}
                multiline
              />

              <Text style={styles.fieldLabel}>{t('profile.cityCode')}</Text>
              <TextInput
                style={styles.contactInput}
                placeholder={t('profile.cityCodePlaceholder')}
                placeholderTextColor={COLORS.outline}
                value={contactForm.vilcod}
                onChangeText={(v) => setContactForm({ ...contactForm, vilcod: v })}
                keyboardType="numeric"
              />

              {/* ─── ÉTAT CIVIL ─── */}
              <Text style={styles.modalSectionHeader}>{t('profile.civilStatus')}</Text>

              <Text style={styles.fieldLabel}>{t('profile.sex')}</Text>
              <View style={styles.chipRow}>
                {[
                  { code: 'M', label: t('profile.man') },
                  { code: 'F', label: t('profile.woman') },
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

              <Text style={styles.fieldLabel}>{t('profile.familyStatus')}</Text>
              <View style={styles.chipRow}>
                {[
                  { code: 'C', label: t('profile.single') },
                  { code: 'M', label: t('profile.married') },
                  { code: 'D', label: t('profile.divorced') },
                  { code: 'V', label: t('profile.widowedShort') },
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

              <Text style={styles.fieldLabel}>{t('profile.childrenCount')}</Text>
              <TextInput
                style={styles.contactInput}
                placeholder="0"
                placeholderTextColor={COLORS.outline}
                value={contactForm.empnbp}
                onChangeText={(v) => setContactForm({ ...contactForm, empnbp: v.replace(/\D+/g, '').slice(0, 2) })}
                keyboardType="number-pad"
              />

              <Text style={styles.fieldLabel}>{t('profile.birthDate')}</Text>
              <TextInput
                style={styles.contactInput}
                placeholder={t('profile.birthDatePlaceholder')}
                placeholderTextColor={COLORS.outline}
                value={contactForm.empdnais}
                onChangeText={(v) => setContactForm({ ...contactForm, empdnais: v })}
              />

              <Text style={styles.fieldLabel}>{t('profile.birthPlace')}</Text>
              <TextInput
                style={styles.contactInput}
                placeholder={t('profile.birthPlacePlaceholder')}
                placeholderTextColor={COLORS.outline}
                value={contactForm.emplnais}
                onChangeText={(t) => setContactForm({ ...contactForm, emplnais: t })}
              />

              <Text style={styles.fieldLabel}>{t('profile.nationalityCode')}</Text>
              <TextInput
                style={styles.contactInput}
                placeholder={t('profile.nationalityPlaceholder')}
                placeholderTextColor={COLORS.outline}
                value={contactForm.natcod}
                onChangeText={(v) => setContactForm({ ...contactForm, natcod: v.toUpperCase().slice(0, 4) })}
                autoCapitalize="characters"
              />

              {/* ─── IDENTITÉ MULTILINGUE (optionnelle) ─── */}
              <Text style={styles.modalSectionHeader}>{t('profile.arabicIdentity')}</Text>

              <Text style={styles.fieldLabel}>{t('profile.arabicName')}</Text>
              <TextInput
                style={[styles.contactInput, { textAlign: 'right' }]}
                placeholderTextColor={COLORS.outline}
                value={contactForm.emplibar}
                onChangeText={(v) => setContactForm({ ...contactForm, emplibar: v })}
              />

              <Text style={styles.fieldLabel}>{t('profile.arabicAddress')}</Text>
              <TextInput
                style={[styles.contactInput, { minHeight: 60, textAlignVertical: 'top', textAlign: 'right' }]}
                placeholderTextColor={COLORS.outline}
                value={contactForm.empadrar}
                onChangeText={(v) => setContactForm({ ...contactForm, empadrar: v })}
                multiline
              />

              <Text style={styles.contactHint}>{t('profile.editHint')}</Text>
            </ScrollView>

            <View style={styles.contactModalFooter}>
              <TouchableOpacity style={styles.contactCancelBtn} onPress={() => setContactEdit(false)}>
                <Text style={styles.contactCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.contactSaveBtn, savingContact && { opacity: 0.5 }]}
                onPress={saveContact}
                disabled={savingContact}
              >
                {savingContact ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.contactSaveText}>{t('common.save')}</Text>
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
  deleteAccountButton: { marginTop: 16, height: 48, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: '#fecaca', backgroundColor: '#fef2f2' },
  deleteAccountText: { fontSize: 14, fontWeight: '700', color: '#dc2626' },
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