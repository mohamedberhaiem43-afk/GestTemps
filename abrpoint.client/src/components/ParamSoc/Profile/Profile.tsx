import { useState, useEffect, useRef } from 'react';
import { useFeedbackSnackbar } from '../../helper/FeedbackSnackbar';
import { useTranslation } from 'react-i18next';
import {
  Badge,
  Security,
  PhotoCamera,
  UploadFile,
  Password,
  FactCheck,
  Edit,
  Lock,
  Visibility,
  VisibilityOff,
  QrCode2,
  VerifiedUser,
} from '@mui/icons-material';
import { User, UtilisateurUpdate, PasswordUpdate, ROLE_LABELS } from '../../../models/Utilisateur';
import useGetProfile from '../../../hooks/profileHooks/useGetProfile';
import useUpdateProfile from '../../../hooks/profileHooks/useUpdateProfile';
import useChangePasswordHook from '../../../hooks/profileHooks/useChangePassword';
import BreadcrumbNavigation from '../../helper/BreadcrumbNavigation';
import apiInstance from '../../API/apiInstance';
import { useAuth } from '../../helper/AuthProvider';
import { resolveAssetUrl } from '../../../helpers/assetUrl';
import './Profile.css';
import NotificationPreferences from '../../Profil/NotificationPreferences';
function getInitials(nom: string | null, prn: string | null) {
  const n = nom?.trim() || '';
  const p = prn?.trim() || '';
  if (n && p) return (p[0] + n[0]).toUpperCase();
  if (n) return n.substring(0, 2).toUpperCase();
  if (p) return p.substring(0, 2).toUpperCase();
  return '??';
}

function ProfilePage() {
  const { t, i18n } = useTranslation();
  const isFr = i18n.language !== 'en';
  const { uticod } = useAuth();
  const [userData, setUserData] = useState<User | null>(null);
  const [profileImage, setProfileImage] = useState<string>('');
  const feedback = useFeedbackSnackbar();

  // Password dialog
  const [pwdDialogOpen, setPwdDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);

  // 2FA state
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [twoFADialogOpen, setTwoFADialogOpen] = useState(false);
  const [twoFAQRUrl, setTwoFAQRUrl] = useState('');
  const [twoFACode, setTwoFACode] = useState('');
  const [twoFALoading, setTwoFALoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateUserMutation = useUpdateProfile();
  const updatePasswordMutation = useChangePasswordHook();
  const { data: profile } = useGetProfile();

  useEffect(() => {
    if (profile) {
      const user = profile as User;
      setUserData(user);
      setTwoFAEnabled((user as any).uti2fa_enabled === '1' || (user as any).uti2fa_enabled === true);
    }
  }, [profile]);

  useEffect(() => {
    const stored = localStorage.getItem('profileImage');
    if (stored) {
      setProfileImage(resolveAssetUrl(stored));
    }
  }, []);

  const handleFieldChange = (field: keyof User, value: string) => {
    if (userData) {
      setUserData({ ...userData, [field]: value });
    }
  };

  const handleUpdate = () => {
    if (!userData) return;
    const utilisateurUpdate: UtilisateurUpdate = {
      Utilisateur: userData,
      Moduser: [],
    };
    updateUserMutation.mutate(utilisateurUpdate, {
      onSuccess: (response: any) => {
        if (response) feedback.showSuccess(t('paramSoc.profile.msg.profileUpdated'));
        else feedback.showInfo(t('paramSoc.profile.msg.noChanges'));
      },
      onError: (err: any) => {
        feedback.showError(err, t('paramSoc.profile.msg.updateError'));
      },
    });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    const renamedFile = new File([file], 'ProfileImage.png', { type: file.type });
    const formData = new FormData();
    formData.append('file', renamedFile);

    try {
      const response = await apiInstance.post(`/Utilisateurs/upload-profile?uticod=${uticod}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // Le backend retourne `{ filePath }` (objet) — ne pas passer `response.data` directement à
      // `localStorage.setItem`, qui sérialiserait `[object Object]` et casserait l'affichage.
      const filePath = response.data?.filePath;
      if (filePath) {
        localStorage.setItem('profileImage', filePath);
        setProfileImage(resolveAssetUrl(filePath));
        window.dispatchEvent(new Event('imageUpdated'));
        feedback.showSuccess(t('paramSoc.profile.msg.photoUpdated'));
      }
    } catch (error) {
      console.error('Erreur image:', error);
      feedback.showError(error, t('paramSoc.profile.msg.photoSaveError'));
    }
  };

  const handleChangePassword = () => {
    if (!userData?.uticod || !currentPassword || !newPassword) {
      feedback.showError(t('paramSoc.profile.msg.fillAllFields'));
      return;
    }
    const payload: PasswordUpdate = {
      uticod: userData.uticod,
      currentPassword,
      newPassword,
    };
    updatePasswordMutation.mutate(payload, {
      onSuccess: () => {
        feedback.showSuccess(t('paramSoc.profile.msg.passwordChanged'));
        setCurrentPassword('');
        setNewPassword('');
        setPwdDialogOpen(false);
      },
      onError: (err: any) => {
        feedback.showError(err, t('paramSoc.profile.msg.passwordChangeError'));
      },
    });
  };

  // ── 2FA handlers ────────────────────────────────────────
  const handleEnable2FA = async () => {
    if (!userData?.uticod) return;
    setTwoFALoading(true);
    try {
      const res = await apiInstance.post(`/Utilisateurs/enable-2fa/${userData.uticod}`);
      const qrUrl = res.data?.qrCodeBase64 || res.data;
      if (qrUrl) {
        setTwoFAQRUrl(qrUrl);
        setTwoFADialogOpen(true);
      }
    } catch (err) {
      feedback.showError(err, t('paramSoc.profile.msg.twoFAEnableError'));
    } finally {
      setTwoFALoading(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!userData?.uticod || !twoFACode) return;
    setTwoFALoading(true);
    try {
      await apiInstance.post(`/Utilisateurs/verify-2fa/${userData.uticod}`, { code: twoFACode });
      setTwoFAEnabled(true);
      setTwoFADialogOpen(false);
      setTwoFACode('');
      setTwoFAQRUrl('');
      feedback.showSuccess(t('paramSoc.profile.msg.twoFAEnabled'));
    } catch (err) {
      feedback.showError(err, t('paramSoc.profile.msg.twoFAInvalidCode'));
    } finally {
      setTwoFALoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!userData?.uticod) return;
    setTwoFALoading(true);
    try {
      await apiInstance.post(`/Utilisateurs/disable-2fa/${userData.uticod}`);
      setTwoFAEnabled(false);
      feedback.showInfo(t('paramSoc.profile.msg.twoFADisabled'));
    } catch (err) {
      feedback.showError(err, t('paramSoc.profile.msg.twoFADisableError'));
    } finally {
      setTwoFALoading(false);
    }
  };

  // ── Suppression de compte (RGPD / Google Play) — flux 2 étapes ────────────
  const [delDialogOpen, setDelDialogOpen] = useState(false);
  const [delLoading, setDelLoading] = useState(false);
  const [delStep, setDelStep] = useState<'confirm' | 'code'>('confirm');
  const [delCode, setDelCode] = useState('');
  const [delEmail, setDelEmail] = useState('');

  const openDeletionDialog = () => {
    setDelStep('confirm');
    setDelCode('');
    setDelEmail('');
    setDelDialogOpen(true);
  };

  // Étape 1 : envoi du code de confirmation par email à l'utilisateur.
  const handleSendDeletionCode = async () => {
    setDelLoading(true);
    try {
      const res = await apiInstance.post('/account/request-deletion', {});
      setDelEmail(res?.data?.email ?? '');
      setDelStep('code');
    } catch (err) {
      feedback.showError(
        err,
        isFr
          ? "Échec de l'envoi du code. Écrivez à postmaster@concorde-work-force.com (objet : « Suppression de compte »)."
          : 'Failed to send code. Email postmaster@concorde-work-force.com (subject: “Account deletion”).'
      );
    } finally {
      setDelLoading(false);
    }
  };

  // Étape 2 : confirmation avec le code reçu.
  const handleConfirmDeletion = async () => {
    if (delCode.trim().length < 4) {
      feedback.showError(null, isFr ? 'Saisissez le code reçu par email.' : 'Enter the code received by email.');
      return;
    }
    setDelLoading(true);
    try {
      const res = await apiInstance.post('/account/confirm-deletion', { code: delCode.trim() });
      setDelDialogOpen(false);
      setDelStep('confirm');
      setDelCode('');
      feedback.showSuccess(
        res?.data?.message ??
          (isFr ? 'Votre demande de suppression a été confirmée.' : 'Your deletion request has been confirmed.')
      );
    } catch (err) {
      feedback.showError(err, isFr ? 'Code invalide ou expiré.' : 'Invalid or expired code.');
    } finally {
      setDelLoading(false);
    }
  };

  const fullName = `${userData?.utiprn || ''} ${userData?.utinom || ''}`.trim();
  const initials = getInitials(userData?.utinom ?? null, userData?.utiprn ?? null);

  // Le backend stocke utiactif/utiadm en '1'/'0' (les anciennes fiches pouvaient
  // avoir 'Oui'/'Non'). On accepte les deux conventions pour ne pas afficher à tort
  // "Inactif"/"Utilisateur" sur un compte actif/administrateur.
  const isActive = userData?.utiactif === '1' || userData?.utiactif === 'Oui';
  const roleLabel = userData?.utirole
    ? (ROLE_LABELS[userData.utirole] ?? userData.utirole)
    : (userData?.utiadm === '1' || userData?.utiadm === 'Oui'
        ? t('paramSoc.profile.admin')
        : t('paramSoc.profile.user'));

  return (
    <div className="profile-page">
      <BreadcrumbNavigation />

      {/* Profile Header */}
      <section className="profile-header">
        <div className="profile-avatar-wrap">
          <div className="profile-avatar-large">
            {profileImage ? (
              <img src={profileImage} alt="Profile" />
            ) : (
              <div className="profile-avatar-placeholder">{initials}</div>
            )}
          </div>
          <button className="profile-avatar-edit-btn" onClick={() => fileInputRef.current?.click()}>
            <PhotoCamera />
          </button>
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleImageChange}
          />
        </div>
        <div className="profile-header-info">
          <div className="profile-header-row">
            <h1 className="profile-header-name">{fullName || t('paramSoc.profile.user')}</h1>
            {isActive && (
              <span className="profile-status-badge">
                <span className="profile-status-dot" />
                {t('paramSoc.profile.active')}
              </span>
            )}
          </div>
          <p className="profile-header-subtitle">
            {roleLabel} • {userData?.utimail || ''}
          </p>
          <div className="profile-header-actions">
            <button className="profile-btn-primary" onClick={handleUpdate}>
              <Edit sx={{ fontSize: 16 }} />
              {t('paramSoc.profile.modifyProfile')}
            </button>
            <button className="profile-btn-secondary" onClick={() => setPwdDialogOpen(true)}>
              {t('paramSoc.profile.changePassword')}
            </button>
          </div>
        </div>
      </section>

      {/* Main Grid */}
      <div className="profile-grid">
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Basic Information Card */}
          <div className="profile-card">
            <div className="profile-card-header">
              <h2 className="profile-card-title">
                <Badge sx={{ fontSize: 24, color: '#0056d2' }} />
                {t('paramSoc.profile.basicInfo')}
              </h2>
            </div>
            <div className="profile-form-grid">
              <div className="profile-field">
                <label className="profile-field-label">{t('paramSoc.profile.lastName')}</label>
                <div className="profile-field-input-wrap">
                  <input
                    className="profile-field-input"
                    type="text"
                    value={userData?.utinom || ''}
                    onChange={(e) => handleFieldChange('utinom', e.target.value)}
                  />
                </div>
              </div>
              <div className="profile-field">
                <label className="profile-field-label">{t('paramSoc.profile.firstName')}</label>
                <div className="profile-field-input-wrap">
                  <input
                    className="profile-field-input"
                    type="text"
                    value={userData?.utiprn || ''}
                    onChange={(e) => handleFieldChange('utiprn', e.target.value)}
                  />
                </div>
              </div>
              <div className="profile-field">
                <label className="profile-field-label">{t('paramSoc.profile.professionalEmail')}</label>
                <div className="profile-field-input-wrap">
                  <input
                    className="profile-field-input"
                    type="email"
                    value={userData?.utimail || ''}
                    onChange={(e) => handleFieldChange('utimail', e.target.value)}
                    placeholder="email@exemple.com"
                  />
                </div>
              </div>
              <div className="profile-field">
                <label className="profile-field-label">{t('paramSoc.profile.userCode')}</label>
                <div className="profile-field-input-wrap">
                  <input
                    className="profile-field-input"
                    type="text"
                    value={userData?.uticod || ''}
                    readOnly
                    style={{ color: '#737785', cursor: 'default' }}
                  />
                </div>
              </div>
              <div className="profile-field">
                <label className="profile-field-label">{t('paramSoc.profile.role')}</label>
                <div className="profile-field-input-wrap">
                  <input
                    className="profile-field-input"
                    type="text"
                    value={roleLabel}
                    readOnly
                    style={{ color: '#737785', cursor: 'default' }}
                  />
                </div>
              </div>
              <div className="profile-field">
                <label className="profile-field-label">{t('paramSoc.profile.status')}</label>
                <div className="profile-field-input-wrap">
                  <input
                    className="profile-field-input"
                    type="text"
                    value={isActive ? t('paramSoc.profile.active') : t('paramSoc.profile.inactive')}
                    readOnly
                    style={{ color: '#737785', cursor: 'default' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Security Card */}
          <div className="profile-card">
            <div className="profile-card-header">
              <h2 className="profile-card-title">
                <Security sx={{ fontSize: 24, color: '#0056d2' }} />
                {t('paramSoc.profile.accountSecurity')}
              </h2>
            </div>

            {/* Password */}
            <div className="profile-security-item">
              <div className="profile-security-info">
                <div className="profile-security-icon profile-security-icon-password">
                  <Password />
                </div>
                <div className="profile-security-text">
                  <h4>{t('paramSoc.profile.password')}</h4>
                  <p>{t('paramSoc.profile.passwordSubtitle')}</p>
                </div>
              </div>
              <button className="profile-security-btn profile-security-btn-outline" onClick={() => setPwdDialogOpen(true)}>
                {t('paramSoc.profile.changePassword')}
              </button>
            </div>

            {/* 2FA */}
            <div className="profile-security-item">
              <div className="profile-security-info">
                <div className="profile-security-icon profile-security-icon-2fa">
                  <FactCheck />
                </div>
                <div className="profile-security-text">
                  <h4>{t('paramSoc.profile.twoFA')}</h4>
                  <p>{twoFAEnabled ? t('paramSoc.profile.twoFAEnabled') : t('paramSoc.profile.twoFARecommended')}</p>
                </div>
              </div>
              {twoFAEnabled ? (
                <button
                  className="profile-security-btn"
                  style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13 }}
                  onClick={handleDisable2FA}
                  disabled={twoFALoading}
                >
                  {t('paramSoc.profile.disable')}
                </button>
              ) : (
                <button
                  className="profile-security-btn profile-security-btn-green"
                  onClick={handleEnable2FA}
                  disabled={twoFALoading}
                >
                  {t('paramSoc.profile.enable2FA')}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Photo Upload Card */}
          <div className="profile-card profile-card-accent">
            <h2 className="profile-card-title" style={{ marginBottom: '24px' }}>
              {t('paramSoc.profile.profilePhoto')}
            </h2>
            <div className="profile-upload-zone" onClick={() => fileInputRef.current?.click()}>
              <div className="profile-upload-icon">
                <UploadFile sx={{ fontSize: 32 }} />
              </div>
              <p className="profile-upload-title">{t('paramSoc.profile.uploadImage')}</p>
              <p className="profile-upload-hint">{t('paramSoc.profile.uploadHint')}</p>
            </div>
            {profileImage && (
              <button
                className="profile-delete-photo-btn"
                onClick={() => {
                  localStorage.removeItem('profileImage');
                  setProfileImage('');
                  window.dispatchEvent(new Event('imageUpdated'));
                }}
              >
                {t('paramSoc.profile.deletePhoto')}
              </button>
            )}
          </div>

          {/* Activity Summary Card */}
          <div className="profile-activity-card">
            <h3 className="profile-activity-label">{t('paramSoc.profile.activitySummary')}</h3>
            <div className="profile-activity-row">
              <span className="profile-activity-row-label">{t('paramSoc.profile.code')}</span>
              <span className="profile-activity-row-value">{userData?.uticod || '—'}</span>
            </div>
            <div className="profile-activity-row">
              <span className="profile-activity-row-label">{t('paramSoc.profile.role')}</span>
              <span className="profile-activity-row-value">
                {roleLabel}
              </span>
            </div>
            <div className="profile-activity-row">
              <span className="profile-activity-row-label">{t('paramSoc.profile.status')}</span>
              <span className="profile-activity-row-value">
                {isActive ? t('paramSoc.profile.active') : t('paramSoc.profile.inactive')}
              </span>
            </div>
            <div className="profile-activity-row">
              <span className="profile-activity-row-label">{t('paramSoc.profile.twoFAStatus')}</span>
              <span className="profile-activity-row-value" style={{ color: twoFAEnabled ? '#10b981' : '#ef4444' }}>
                {twoFAEnabled ? t('paramSoc.profile.enabled') : t('paramSoc.profile.disabled')}
              </span>
            </div>
            <div className="profile-activity-divider">
              <p className="profile-activity-status-label">{t('paramSoc.profile.securityStatus')}</p>
              <div className="profile-activity-bars">
                <div className="profile-activity-bar profile-activity-bar-filled" />
                <div className="profile-activity-bar profile-activity-bar-filled" />
                <div className="profile-activity-bar profile-activity-bar-filled" />
                <div className={`profile-activity-bar ${twoFAEnabled ? 'profile-activity-bar-filled' : 'profile-activity-bar-empty'}`} />
              </div>
              <p className="profile-activity-status-text">{twoFAEnabled ? t('paramSoc.profile.excellent') : t('paramSoc.profile.good')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Préférences de notification — pleine largeur sous la grille profil */}
      <div style={{ marginTop: 32 }}>
        <NotificationPreferences />
      </div>

      {/* Zone de danger — suppression de compte (RGPD / Google Play « Data deletion »).
          Déclenche une demande (cf. AccountController) ; détails sur /suppression-compte. */}
      <div style={{ marginTop: 32, border: '1px solid #fecaca', background: '#fef2f2', borderRadius: 14, padding: '20px 24px' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: '#b91c1c' }}>
          {isFr ? 'Supprimer mon compte' : 'Delete my account'}
        </h3>
        <p style={{ margin: '0 0 14px', color: '#7f1d1d', fontSize: 14, lineHeight: 1.6 }}>
          {isFr
            ? "Votre demande est transmise à notre support et à l'administrateur de votre entreprise. L'accès est suspendu et vos données personnelles supprimées / anonymisées sous 30 jours. Certaines données légales (paie, pointage, contrats) restent conservées si la loi l'exige."
            : 'Your request is sent to our support and your company administrator. Access is suspended and your personal data deleted / anonymized within 30 days. Some legal data (payroll, attendance, contracts) is retained where required by law.'}{' '}
          <a href="/suppression-compte" target="_blank" rel="noopener noreferrer" style={{ color: '#b91c1c', fontWeight: 600 }}>
            {isFr ? 'En savoir plus' : 'Learn more'}
          </a>
        </p>
        <button
          type="button"
          onClick={openDeletionDialog}
          style={{ background: '#fff', color: '#dc2626', border: '1.5px solid #fca5a5', borderRadius: 10, padding: '10px 18px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
        >
          {isFr ? 'Supprimer mon compte' : 'Delete my account'}
        </button>
      </div>

      {/* Dialog suppression — 2 étapes (confirmation → code email) */}
      {delDialogOpen && (
        <div className="profile-pwd-overlay" onClick={() => !delLoading && setDelDialogOpen(false)}>
          <div className="profile-pwd-dialog" onClick={(e) => e.stopPropagation()}>
            {delStep === 'confirm' ? (
              <>
                <h3 className="profile-pwd-title" style={{ color: '#b91c1c' }}>
                  {isFr ? 'Confirmer la suppression' : 'Confirm deletion'}
                </h3>
                <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.6, margin: '0 0 20px' }}>
                  {isFr
                    ? 'Un code de confirmation va être envoyé à votre adresse email. Après saisie du code, votre demande de suppression sera transmise. Continuer ?'
                    : 'A confirmation code will be sent to your email address. After entering the code, your deletion request will be sent. Continue?'}
                </p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setDelDialogOpen(false)}
                    disabled={delLoading}
                    style={{ background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: 10, padding: '10px 18px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
                  >
                    {isFr ? 'Annuler' : 'Cancel'}
                  </button>
                  <button
                    type="button"
                    onClick={handleSendDeletionCode}
                    disabled={delLoading}
                    style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontWeight: 700, fontSize: 14, cursor: delLoading ? 'wait' : 'pointer', opacity: delLoading ? 0.7 : 1 }}
                  >
                    {delLoading ? (isFr ? 'Envoi…' : 'Sending…') : (isFr ? 'Envoyer le code' : 'Send code')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="profile-pwd-title" style={{ color: '#b91c1c' }}>
                  {isFr ? 'Saisir le code' : 'Enter the code'}
                </h3>
                <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.6, margin: '0 0 16px' }}>
                  {isFr
                    ? `Saisissez le code à 6 chiffres envoyé à ${delEmail || 'votre adresse email'}.`
                    : `Enter the 6-digit code sent to ${delEmail || 'your email address'}.`}
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={delCode}
                  onChange={(e) => setDelCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="------"
                  style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #fca5a5', borderRadius: 10, padding: '12px 14px', fontSize: 22, letterSpacing: 8, textAlign: 'center', marginBottom: 18 }}
                />
                <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={handleSendDeletionCode}
                    disabled={delLoading}
                    style={{ background: 'transparent', color: '#0040a1', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                  >
                    {isFr ? 'Renvoyer un code' : 'Resend code'}
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDeletion}
                    disabled={delLoading}
                    style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontWeight: 700, fontSize: 14, cursor: delLoading ? 'wait' : 'pointer', opacity: delLoading ? 0.7 : 1 }}
                  >
                    {delLoading ? (isFr ? 'Confirmation…' : 'Confirming…') : (isFr ? 'Confirmer la suppression' : 'Confirm deletion')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Password Dialog */}
      {pwdDialogOpen && (
        <div className="profile-pwd-overlay" onClick={() => setPwdDialogOpen(false)}>
          <div className="profile-pwd-dialog" onClick={(e) => e.stopPropagation()}>
            <h3 className="profile-pwd-title">
              <Lock sx={{ fontSize: 20, verticalAlign: 'middle', mr: 1 }} />
              {t('paramSoc.profile.changePassword')}
            </h3>
            <div className="profile-pwd-field">
              <label>{t('paramSoc.profile.currentPassword')}</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showCurrentPwd ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ paddingRight: 40 }}
                />
                <button
                  onClick={() => setShowCurrentPwd(!showCurrentPwd)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#737785',
                    display: 'flex',
                  }}
                >
                  {showCurrentPwd ? <VisibilityOff sx={{ fontSize: 18 }} /> : <Visibility sx={{ fontSize: 18 }} />}
                </button>
              </div>
            </div>
            <div className="profile-pwd-field">
              <label>{t('paramSoc.profile.newPassword')}</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNewPwd ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ paddingRight: 40 }}
                />
                <button
                  onClick={() => setShowNewPwd(!showNewPwd)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#737785',
                    display: 'flex',
                  }}
                >
                  {showNewPwd ? <VisibilityOff sx={{ fontSize: 18 }} /> : <Visibility sx={{ fontSize: 18 }} />}
                </button>
              </div>
            </div>
            <div className="profile-pwd-actions">
              <button
                className="profile-btn-secondary"
                onClick={() => setPwdDialogOpen(false)}
              >
                {t('paramSoc.profile.cancel')}
              </button>
              <button className="profile-btn-primary" onClick={handleChangePassword}>
                {t('paramSoc.profile.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2FA QR Code Dialog */}
      {twoFADialogOpen && (
        <div className="profile-pwd-overlay" onClick={() => { setTwoFADialogOpen(false); setTwoFACode(''); }}>
          <div className="profile-pwd-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, textAlign: 'center' }}>
            <h3 className="profile-pwd-title" style={{ justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 8 }}>
              <QrCode2 sx={{ fontSize: 24 }} />
              {t('paramSoc.profile.twoFADialogTitle')}
            </h3>
            <p style={{ color: '#64748b', fontSize: 13, margin: '12px 0' }}>
              {t('paramSoc.profile.twoFAStep1')}
            </p>
            {twoFAQRUrl && (
              <div style={{ margin: '16px auto', padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', display: 'inline-block' }}>
                <img src={twoFAQRUrl} alt="QR Code 2FA" style={{ width: 200, height: 200 }} />
              </div>
            )}
            <p style={{ color: '#64748b', fontSize: 13, margin: '12px 0' }}>
              {t('paramSoc.profile.twoFAStep2')}
            </p>
            <input
              type="text"
              value={twoFACode}
              onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              style={{
                width: '100%',
                maxWidth: 200,
                padding: '12px 16px',
                fontSize: 24,
                textAlign: 'center',
                letterSpacing: 8,
                border: '2px solid #e2e8f0',
                borderRadius: 12,
                outline: 'none',
                margin: '8px 0',
              }}
            />
            <div className="profile-pwd-actions" style={{ marginTop: 16 }}>
              <button className="profile-btn-secondary" onClick={() => { setTwoFADialogOpen(false); setTwoFACode(''); }}>
                {t('paramSoc.profile.cancel')}
              </button>
              <button
                className="profile-btn-primary"
                onClick={handleVerify2FA}
                disabled={twoFACode.length !== 6 || twoFALoading}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <VerifiedUser sx={{ fontSize: 16 }} />
                {twoFALoading ? t('paramSoc.profile.verifying') : t('paramSoc.profile.verifyAndEnable')}
              </button>
            </div>
          </div>
        </div>
      )}

      {feedback.element}
    </div>
  );
}

export default function Profile() {
  return (
    <ProfilePage />
  );
}