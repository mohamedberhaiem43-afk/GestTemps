import { useState, useEffect, useRef } from 'react';
import { Alert, Snackbar } from '@mui/material';
import { QueryClient, QueryClientProvider } from 'react-query';
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
import { User, UtilisateurUpdate, PasswordUpdate } from '../../../models/Utilisateur';
import useGetProfile from '../../../hooks/profileHooks/useGetProfile';
import useUpdateProfile from '../../../hooks/profileHooks/useUpdateProfile';
import useChangePasswordHook from '../../../hooks/profileHooks/useChangePassword';
import BreadcrumbNavigation from '../../helper/BreadcrumbNavigation';
import apiInstance from '../../API/apiInstance';
import { useAuth } from '../../helper/AuthProvider';
import './Profile.css';

const BASE_URL = import.meta.env.VITE_REACT_APP_API_URL || '';
const queryClient = new QueryClient();

function getInitials(nom: string | null, prn: string | null) {
  const n = nom?.trim() || '';
  const p = prn?.trim() || '';
  if (n && p) return (p[0] + n[0]).toUpperCase();
  if (n) return n.substring(0, 2).toUpperCase();
  if (p) return p.substring(0, 2).toUpperCase();
  return '??';
}

function ProfilePage() {
  const { uticod } = useAuth();
  const [userData, setUserData] = useState<User | null>(null);
  const [profileImage, setProfileImage] = useState<string>('');
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info';
  }>({ open: false, message: '', severity: 'success' });

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
      setProfileImage(`${BASE_URL}${stored}`);
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
        setSnackbar({
          open: true,
          message: response ? 'Profil mis à jour avec succès !' : 'Aucune modification apportée.',
          severity: response ? 'success' : 'info',
        });
      },
      onError: () => {
        setSnackbar({ open: true, message: 'Erreur lors de la mise à jour.', severity: 'error' });
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
      const filePath = response.data;
      if (filePath) {
        localStorage.setItem('profileImage', filePath);
        setProfileImage(`${BASE_URL}${filePath}`);
        window.dispatchEvent(new Event('imageUpdated'));
        setSnackbar({ open: true, message: 'Photo de profil mise à jour !', severity: 'success' });
      }
    } catch (error) {
      console.error('Erreur image:', error);
      setSnackbar({ open: true, message: "Erreur lors de la sauvegarde de l'image.", severity: 'error' });
    }
  };

  const handleChangePassword = () => {
    if (!userData?.uticod || !currentPassword || !newPassword) {
      setSnackbar({ open: true, message: 'Veuillez remplir tous les champs.', severity: 'error' });
      return;
    }
    const payload: PasswordUpdate = {
      uticod: userData.uticod,
      currentPassword,
      newPassword,
    };
    updatePasswordMutation.mutate(payload, {
      onSuccess: () => {
        setSnackbar({ open: true, message: 'Mot de passe modifié avec succès !', severity: 'success' });
        setCurrentPassword('');
        setNewPassword('');
        setPwdDialogOpen(false);
      },
      onError: () => {
        setSnackbar({ open: true, message: 'Erreur lors du changement de mot de passe.', severity: 'error' });
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
      setSnackbar({ open: true, message: "Erreur lors de l'activation de la 2FA.", severity: 'error' });
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
      setSnackbar({ open: true, message: '2FA activée avec succès !', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: 'Code invalide. Veuillez réessayer.', severity: 'error' });
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
      setSnackbar({ open: true, message: '2FA désactivée.', severity: 'info' });
    } catch (err) {
      setSnackbar({ open: true, message: 'Erreur lors de la désactivation.', severity: 'error' });
    } finally {
      setTwoFALoading(false);
    }
  };

  const fullName = `${userData?.utiprn || ''} ${userData?.utinom || ''}`.trim();
  const initials = getInitials(userData?.utinom ?? null, userData?.utiprn ?? null);

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
            <h1 className="profile-header-name">{fullName || 'Utilisateur'}</h1>
            {userData?.utiactif === 'Oui' && (
              <span className="profile-status-badge">
                <span className="profile-status-dot" />
                Actif
              </span>
            )}
          </div>
          <p className="profile-header-subtitle">
            {userData?.utiadm === 'Oui' ? 'Administrateur' : 'Utilisateur'} • {userData?.utimail || ''}
          </p>
          <div className="profile-header-actions">
            <button className="profile-btn-primary" onClick={handleUpdate}>
              <Edit sx={{ fontSize: 16 }} />
              Modifier le Profil
            </button>
            <button className="profile-btn-secondary" onClick={() => setPwdDialogOpen(true)}>
              Changer le mot de passe
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
                Informations de base
              </h2>
            </div>
            <div className="profile-form-grid">
              <div className="profile-field">
                <label className="profile-field-label">Nom</label>
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
                <label className="profile-field-label">Prénom</label>
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
                <label className="profile-field-label">Email Professionnel</label>
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
                <label className="profile-field-label">Code Utilisateur</label>
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
                <label className="profile-field-label">Rôle</label>
                <div className="profile-field-input-wrap">
                  <input
                    className="profile-field-input"
                    type="text"
                    value={userData?.utiadm === 'Oui' ? 'Administrateur' : 'Utilisateur'}
                    readOnly
                    style={{ color: '#737785', cursor: 'default' }}
                  />
                </div>
              </div>
              <div className="profile-field">
                <label className="profile-field-label">Statut</label>
                <div className="profile-field-input-wrap">
                  <input
                    className="profile-field-input"
                    type="text"
                    value={userData?.utiactif === 'Oui' ? 'Actif' : 'Inactif'}
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
                Sécurité du compte
              </h2>
            </div>

            {/* Password */}
            <div className="profile-security-item">
              <div className="profile-security-info">
                <div className="profile-security-icon profile-security-icon-password">
                  <Password />
                </div>
                <div className="profile-security-text">
                  <h4>Mot de passe</h4>
                  <p>Dernière modification récemment</p>
                </div>
              </div>
              <button className="profile-security-btn profile-security-btn-outline" onClick={() => setPwdDialogOpen(true)}>
                Changer le mot de passe
              </button>
            </div>

            {/* 2FA */}
            <div className="profile-security-item">
              <div className="profile-security-info">
                <div className="profile-security-icon profile-security-icon-2fa">
                  <FactCheck />
                </div>
                <div className="profile-security-text">
                  <h4>Double authentification (2FA)</h4>
                  <p>{twoFAEnabled ? 'Activée ✓' : 'Recommandé pour sécuriser votre accès'}</p>
                </div>
              </div>
              {twoFAEnabled ? (
                <button
                  className="profile-security-btn"
                  style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13 }}
                  onClick={handleDisable2FA}
                  disabled={twoFALoading}
                >
                  Désactiver
                </button>
              ) : (
                <button
                  className="profile-security-btn profile-security-btn-green"
                  onClick={handleEnable2FA}
                  disabled={twoFALoading}
                >
                  Activer la 2FA
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
              Photo de profil
            </h2>
            <div className="profile-upload-zone" onClick={() => fileInputRef.current?.click()}>
              <div className="profile-upload-icon">
                <UploadFile sx={{ fontSize: 32 }} />
              </div>
              <p className="profile-upload-title">Uploader l'image</p>
              <p className="profile-upload-hint">Glissez-déposez ou cliquez pour parcourir. JPG, PNG (max. 5MB)</p>
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
                Supprimer la photo actuelle
              </button>
            )}
          </div>

          {/* Activity Summary Card */}
          <div className="profile-activity-card">
            <h3 className="profile-activity-label">Résumé de l'activité</h3>
            <div className="profile-activity-row">
              <span className="profile-activity-row-label">Code</span>
              <span className="profile-activity-row-value">{userData?.uticod || '—'}</span>
            </div>
            <div className="profile-activity-row">
              <span className="profile-activity-row-label">Rôle</span>
              <span className="profile-activity-row-value">
                {userData?.utiadm === 'Oui' ? 'Administrateur' : 'Utilisateur'}
              </span>
            </div>
            <div className="profile-activity-row">
              <span className="profile-activity-row-label">Statut</span>
              <span className="profile-activity-row-value">
                {userData?.utiactif === 'Oui' ? 'Actif' : 'Inactif'}
              </span>
            </div>
            <div className="profile-activity-row">
              <span className="profile-activity-row-label">2FA</span>
              <span className="profile-activity-row-value" style={{ color: twoFAEnabled ? '#10b981' : '#ef4444' }}>
                {twoFAEnabled ? 'Activée' : 'Désactivée'}
              </span>
            </div>
            <div className="profile-activity-divider">
              <p className="profile-activity-status-label">Statut de sécurité</p>
              <div className="profile-activity-bars">
                <div className="profile-activity-bar profile-activity-bar-filled" />
                <div className="profile-activity-bar profile-activity-bar-filled" />
                <div className="profile-activity-bar profile-activity-bar-filled" />
                <div className={`profile-activity-bar ${twoFAEnabled ? 'profile-activity-bar-filled' : 'profile-activity-bar-empty'}`} />
              </div>
              <p className="profile-activity-status-text">{twoFAEnabled ? 'Excellent' : 'Bon'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Password Dialog */}
      {pwdDialogOpen && (
        <div className="profile-pwd-overlay" onClick={() => setPwdDialogOpen(false)}>
          <div className="profile-pwd-dialog" onClick={(e) => e.stopPropagation()}>
            <h3 className="profile-pwd-title">
              <Lock sx={{ fontSize: 20, verticalAlign: 'middle', mr: 1 }} />
              Changer le mot de passe
            </h3>
            <div className="profile-pwd-field">
              <label>Mot de passe actuel</label>
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
              <label>Nouveau mot de passe</label>
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
                Annuler
              </button>
              <button className="profile-btn-primary" onClick={handleChangePassword}>
                Confirmer
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
              Activer la Double Authentification
            </h3>
            <p style={{ color: '#64748b', fontSize: 13, margin: '12px 0' }}>
              1. Scannez ce QR code avec votre application d'authentification (Google Authenticator, Authy, etc.)
            </p>
            {twoFAQRUrl && (
              <div style={{ margin: '16px auto', padding: 16, background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', display: 'inline-block' }}>
                <img src={twoFAQRUrl} alt="QR Code 2FA" style={{ width: 200, height: 200 }} />
              </div>
            )}
            <p style={{ color: '#64748b', fontSize: 13, margin: '12px 0' }}>
              2. Entrez le code à 6 chiffres affiché dans l'application
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
                Annuler
              </button>
              <button
                className="profile-btn-primary"
                onClick={handleVerify2FA}
                disabled={twoFACode.length !== 6 || twoFALoading}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <VerifiedUser sx={{ fontSize: 16 }} />
                {twoFALoading ? 'Vérification...' : 'Vérifier & Activer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  );
}

export default function Profile() {
  return (
    <QueryClientProvider client={queryClient}>
      <ProfilePage />
    </QueryClientProvider>
  );
}