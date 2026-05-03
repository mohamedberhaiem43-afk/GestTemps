import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { Box, Button, CircularProgress, IconButton, Menu, MenuItem,
  Autocomplete, TextField, TextField as MuiTextField, Snackbar, Alert } from '@mui/material';
import { useTranslation, Trans } from 'react-i18next';
import { useAuth } from '../helper/AuthProvider';
import apiInstance from '../API/apiInstance';
import { DocumentVault } from '../../models/DocumentVault';
import useGetEmployee from '../../hooks/employeHooks/useGetEmployee';
import './CoffreFortModern.css';

const CoffreFortModern = () => {
  const { t, i18n } = useTranslation();
  const { soccod, uticod, authReady, isAdmin, isManager } = useAuth();
  const navigate = useNavigate();

  const [documents, setDocuments] = useState<DocumentVault[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedType, setSelectedType] = useState<string>('');

  // Cible du dépôt (admin/manager only). Vide = soi-même.
  const canDepositForOthers = isAdmin || isManager;
  const [targetEmpcod, setTargetEmpcod] = useState<string>('');
  const [uploadMessage, setUploadMessage] = useState<string>('');
  const [snack, setSnack] = useState<{ open: boolean; sev: 'success' | 'error'; msg: string }>({ open: false, sev: 'success', msg: '' });

  // Liste employés filtrée automatiquement par sercod côté hook si manager.
  const { data: empMap } = useGetEmployee();
  const employeeOptions = useMemo(() => {
    if (!empMap || typeof empMap !== 'object') return [] as Array<{ code: string; lib: string }>;
    return Object.entries(empMap as Record<string, string>).map(([code, lib]) => ({ code, lib }));
  }, [empMap]);
  const allowedEmpcodes = useMemo(() => new Set(employeeOptions.map((o) => o.code)), [employeeOptions]);

  // Empcod du coffre actuellement consulté. Pour un employé : toujours soi-même.
  // Pour un admin/manager : peut être un employé sélectionné (consultation), ou soi-même
  // (par défaut). Le backend (VaultController.GetDocuments) vérifie déjà les droits :
  // admin → tous, manager → employés de son service, employé → uniquement le sien.
  const effectiveEmpcod = canDepositForOthers && targetEmpcod ? targetEmpcod : uticod;
  const isViewingOther = canDepositForOthers && !!targetEmpcod && targetEmpcod !== uticod;
  const targetLabel = useMemo(() => {
    if (!isViewingOther) return '';
    return employeeOptions.find(o => o.code === targetEmpcod)?.lib || targetEmpcod;
  }, [isViewingOther, targetEmpcod, employeeOptions]);

  useEffect(() => {
    if (authReady) {
      if (soccod && effectiveEmpcod) {
        fetchDocuments();
      } else {
        setIsLoading(false);
      }
    }
    // effectiveEmpcod recalcule à chaque changement de targetEmpcod → recharge auto.
  }, [soccod, effectiveEmpcod, authReady]);

  // Safety net: for managers, never allow selecting/viewing an employee outside their service.
  useEffect(() => {
    if (!isManager || !targetEmpcod) return;
    if (!allowedEmpcodes.has(targetEmpcod)) {
      setTargetEmpcod('');
      setUploadMessage('');
      setSnack({ open: true, sev: 'error', msg: t('coffreFort.snack.accessDeniedService') });
    }
  }, [isManager, targetEmpcod, allowedEmpcodes]);

  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      const res = await apiInstance.get(`/Vault/${soccod}/${effectiveEmpcod}`);
      setDocuments(res.data);
    } catch (err: any) {
      console.error("Erreur lors de la récupération des documents", err);
      // 403 : le backend a refusé (manager hors service, etc.) — on retombe sur une liste vide.
      if (err?.response?.status === 403) {
        setDocuments([]);
        setSnack({ open: true, sev: 'error', msg: t('coffreFort.snack.accessDeniedVault') });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (docId: number, fileName: string) => {
    try {
      const response = await apiInstance.get(`/Vault/download/${docId}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Erreur lors du téléchargement", err);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !soccod || !uticod) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('soccod', soccod);
    formData.append('docType', selectedType || 'Autre');

    // Si l'admin/manager a choisi un employé cible différent de lui-même → endpoint dédié
    // qui crée la notification interne pour le destinataire.
    const isDepositForOther = canDepositForOthers && targetEmpcod && targetEmpcod !== uticod;
    const endpoint = isDepositForOther ? '/Vault/upload-for-employee' : '/Vault/upload';
    if (isDepositForOther) {
      formData.append('targetEmpcod', targetEmpcod);
      if (uploadMessage) formData.append('message', uploadMessage);
    } else {
      formData.append('empcod', uticod);
    }

    try {
      await apiInstance.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSnack({
        open: true,
        sev: 'success',
        msg: isDepositForOther ? t('coffreFort.snack.uploadedAndNotified') : t('coffreFort.snack.uploaded'),
      });
      // On rafraîchit toujours : en mode consultation d'un autre employé (targetEmpcod défini),
      // c'est ce coffre qui est affiché, donc le nouveau document doit y apparaître.
      // En mode personnel (cible vide), on recharge sa propre liste.
      // Le message d'accompagnement est uniquement reset après un dépôt — la cible elle-même est
      // conservée pour rester en consultation du même coffre.
      fetchDocuments();
      if (isDepositForOther) { setUploadMessage(''); }
    } catch (err: any) {
      console.error("Erreur d'upload", err);
      setSnack({
        open: true,
        sev: 'error',
        msg: err?.response?.data?.message || err?.response?.data || t('coffreFort.snack.uploadError'),
      });
    } finally {
      setUploading(false);
      // Reset l'input pour permettre de re-sélectionner le même fichier après une erreur.
      event.target.value = '';
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getDocIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return 'picture_as_pdf';
    if (['doc', 'docx'].includes(ext || '')) return 'description';
    if (['xls', 'xlsx'].includes(ext || '')) return 'table_chart';
    return 'insert_drive_file';
  };

  const getDocIconClass = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return 'pdf';
    if (['doc', 'docx'].includes(ext || '')) return 'doc';
    return 'other';
  };

  // Group stats — case-insensitive partial match to handle varying docType values from different creation paths
  const match = (type: string, ...keys: string[]) =>
    keys.some(k => type?.toLowerCase().includes(k.toLowerCase()));

  const paySlips    = documents.filter(d => match(d.docType, 'paie', 'fiche', 'salary', 'bulletin'));
  const contracts   = documents.filter(d => match(d.docType, 'contrat', 'contract'));
  const certificates = documents.filter(d => match(d.docType, 'attestation', 'certificat', 'certificate', 'badge'));

  // Stable category keys for displaying docType chips with translations.
  type DocCategory = 'paySlip' | 'contract' | 'certificate' | 'other';
  const getDocCategory = (docType: string): DocCategory => {
    if (match(docType, 'paie', 'fiche', 'salary', 'bulletin')) return 'paySlip';
    if (match(docType, 'contrat', 'contract')) return 'contract';
    if (match(docType, 'attestation', 'certificat', 'certificate', 'badge')) return 'certificate';
    return 'other';
  };
  const docCategoryLabel = (docType: string): string => {
    const cat = getDocCategory(docType);
    if (cat === 'paySlip') return t('coffreFort.menu.paySlip');
    if (cat === 'contract') return t('coffreFort.menu.contract');
    if (cat === 'certificate') return t('coffreFort.menu.certificate');
    return docType || t('coffreFort.menu.other');
  };
  const docCategoryClass = (docType: string): string => {
    const cat = getDocCategory(docType);
    if (cat === 'paySlip') return 'pay-slip';
    if (cat === 'contract') return 'contract';
    if (cat === 'certificate') return 'certificate';
    return 'other';
  };


  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  const dateLocale = i18n.language?.startsWith('en') ? 'en-US' : 'fr-FR';

  return (
    <Box className="coffre-fort-container">
      {/* Page Header */}
      <section className="vault-header">
        <div className="vault-title-section">
          <label className="vault-badge">{isViewingOther ? t('coffreFort.badge.adminView') : t('coffreFort.badge.authenticated')}</label>
          <h1 className="vault-title">
            {isViewingOther ? t('coffreFort.title.ofEmployee', { name: targetLabel }) : t('coffreFort.title.default')}
          </h1>
          <p className="vault-description">
            {isViewingOther ? t('coffreFort.description.ofEmployee') : t('coffreFort.description.default')}
          </p>
        </div>

        <div className="vault-stats-card">
          <div className="stats-top">
            <span className="material-symbols-outlined" style={{ color: '#0040a1', fontSize: '2rem' }}>verified_user</span>
            <div style={{ textAlign: 'right' }}>
              <span className="stats-label" style={{ display: 'block', fontSize: '0.6rem' }}>{t('coffreFort.stats.vaultState')}</span>
              <div className="status-indicator">
                <span className="status-dot"></span> {t('coffreFort.stats.secured')}
              </div>
            </div>
          </div>
          <div className="stats-value-container">
            <div className="stats-number">{documents.length}</div>
            <span className="stats-label">{t('coffreFort.stats.totalDocs')}</span>
          </div>
        </div>
      </section>

      {/* Admin/Manager — consulter le coffre d'un employé et y déposer des documents */}
      {canDepositForOthers && (
        <section style={{ marginBottom: '2rem', padding: '1rem 1.25rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <span className="material-symbols-outlined" style={{ color: '#0040a1' }}>admin_panel_settings</span>
            <strong style={{ fontSize: '0.9rem' }}>{t('coffreFort.admin.consultDeposit')}</strong>
            <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
              {isAdmin ? t('coffreFort.admin.scopeAll') : t('coffreFort.admin.scopeService')}
            </span>
            {isViewingOther && (
              <Button
                size="small"
                onClick={() => { setTargetEmpcod(''); setUploadMessage(''); }}
                sx={{ ml: 'auto', textTransform: 'none', fontSize: '0.75rem' }}
              >
                {t('coffreFort.admin.backToMyVault')}
              </Button>
            )}
          </div>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' }, gap: 1.5 }}>
            <Autocomplete
              size="small"
              options={employeeOptions}
              getOptionLabel={(o) => `${o.lib} (${o.code})`}
              isOptionEqualToValue={(a, b) => a.code === b.code}
              value={employeeOptions.find(o => o.code === targetEmpcod) || null}
              onChange={(_, val) => setTargetEmpcod(val?.code || '')}
              renderInput={(params) => <TextField {...params} placeholder={t('coffreFort.admin.selectEmployeePlaceholder')} />}
            />
            <MuiTextField
              size="small"
              placeholder={t('coffreFort.admin.messagePlaceholder')}
              value={uploadMessage}
              onChange={(e) => setUploadMessage(e.target.value)}
              disabled={!targetEmpcod}
            />
          </Box>
          {isViewingOther && (
            <p style={{ marginTop: 8, fontSize: '0.75rem', color: '#0f5132' }}>
              <Trans
                i18nKey="coffreFort.admin.viewingNotice"
                values={{ name: targetLabel }}
                components={{ 0: <strong /> }}
              />
            </p>
          )}
        </section>
      )}

      {/* Asset Collections */}
      <section style={{ marginBottom: '3rem' }}>
        <div className="folder-section-header">
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>{t('coffreFort.collections.title')}</h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>{t('coffreFort.collections.subtitle')}</p>
          </div>
        </div>

        <div className="folder-grid">
          <div className="folder-card pay-slips">
            <div className="folder-icon-wrapper">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>receipt_long</span>
            </div>
            <h4 className="folder-name">{t('coffreFort.collections.paySlips')}</h4>
            <p className="folder-info">{t('coffreFort.collections.documentsCount', { count: paySlips.length })}</p>
            <div className="folder-progress-bar">
              <div className="progress-fill" style={{ width: `${Math.min(100, (paySlips.length / 24) * 100)}%` }}></div>
            </div>
          </div>

          <div className="folder-card contracts">
            <div className="folder-icon-wrapper">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>description</span>
            </div>
            <h4 className="folder-name">{t('coffreFort.collections.contracts')}</h4>
            <p className="folder-info">{t('coffreFort.collections.documentsCount', { count: contracts.length })}</p>
            <div className="folder-progress-bar">
              <div className="progress-fill" style={{ width: `${Math.min(100, (contracts.length / 5) * 100)}%` }}></div>
            </div>
          </div>

          <div className="folder-card certificates">
            <div className="folder-icon-wrapper">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>badge</span>
            </div>
            <h4 className="folder-name">{t('coffreFort.collections.certificates')}</h4>
            <p className="folder-info">{t('coffreFort.collections.documentsCount', { count: certificates.length })}</p>
            <div className="folder-progress-bar">
              <div className="progress-fill" style={{ width: `${Math.min(100, (certificates.length / 10) * 100)}%` }}></div>
            </div>
          </div>

          <div className="folder-card new-collection-card" onClick={(e) => setAnchorEl(e.currentTarget)}>
            <div className="add-icon-circle">
              <span className="material-symbols-outlined">add</span>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {uploading ? t('coffreFort.collections.loading') : t('coffreFort.collections.newAsset')}
            </span>
          </div>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
          >
            <MenuItem onClick={() => { setSelectedType('Fiche de paie'); document.getElementById('vault-upload-input')?.click(); setAnchorEl(null); }}>
              {t('coffreFort.menu.paySlip')}
            </MenuItem>
            <MenuItem onClick={() => { setSelectedType('Contrat'); document.getElementById('vault-upload-input')?.click(); setAnchorEl(null); }}>
              {t('coffreFort.menu.contract')}
            </MenuItem>
            <MenuItem onClick={() => { setSelectedType('Attestation'); document.getElementById('vault-upload-input')?.click(); setAnchorEl(null); }}>
              {t('coffreFort.menu.certificate')}
            </MenuItem>
            <MenuItem onClick={() => { setSelectedType('Autre'); document.getElementById('vault-upload-input')?.click(); setAnchorEl(null); }}>
              {t('coffreFort.menu.other')}
            </MenuItem>
          </Menu>

          <input
            type="file"
            id="vault-upload-input"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
        </div>
      </section>

      {/* Recent Activity Table */}
      <section>
        <div className="section-header-flex">
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>{t('coffreFort.recent.title')}</h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>{t('coffreFort.recent.subtitle')}</p>
          </div>
          <Button sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.8rem' }}>{t('coffreFort.recent.viewAll')}</Button>
        </div>

        <div className="vault-table-wrapper">
          <table className="vault-table">
            <thead>
              <tr>
                <th>{t('coffreFort.table.documentName')}</th>
                <th>{t('coffreFort.table.type')}</th>
                <th>{t('coffreFort.table.modificationDate')}</th>
                <th>{t('coffreFort.table.size')}</th>
                <th style={{ textAlign: 'center' }}>{t('coffreFort.table.action')}</th>
              </tr>
            </thead>
            <tbody>
              {documents.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                    {t('coffreFort.table.empty')}
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <div className="doc-name-cell">
                        <div className={`doc-icon-box ${getDocIconClass(doc.docName)}`}>
                          <span className="material-symbols-outlined">{getDocIcon(doc.docName)}</span>
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div className="doc-main-name">{doc.docName}</div>
                            <span className="type-chip" style={{ fontSize: '0.6rem', padding: '0.1rem 0.4rem', background: '#f2f4f6', opacity: 0.8 }}>{docCategoryLabel(doc.docType)}</span>
                          </div>
                          {doc.isSigned ? (
                            <div className="doc-status-tag">
                              <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>verified</span>
                              {t('coffreFort.status.validSignature')}
                            </div>
                          ) : (
                            <div className="doc-status-tag" style={{ color: '#9a3412' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>pending</span>
                              {t('coffreFort.status.pendingSignature')}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`type-chip type-${docCategoryClass(doc.docType)}`}>
                        {docCategoryLabel(doc.docType)}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: '#424654' }}>
                      {new Date(doc.docDate).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ fontSize: '0.85rem', color: '#424654' }}>
                      {formatSize(doc.docSize)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                        {!doc.isSigned && (
                          <Button
                            variant="contained"
                            size="small"
                            sx={{
                              fontSize: '0.65rem',
                              fontWeight: 800,
                              bgcolor: '#0040a1',
                              borderRadius: '0.5rem',
                              textTransform: 'uppercase',
                              padding: '0.4rem 0.8rem'
                            }}
                            onClick={() => navigate(`/dashboard/sign-document?id=${doc.id}`)}
                          >
                            {t('coffreFort.actions.sign')}
                          </Button>
                        )}
                        <IconButton
                          className="download-btn"
                          onClick={() => handleDownload(doc.id, doc.docName)}
                        >
                          <span className="material-symbols-outlined">download</span>
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack(s => ({ ...s, open: false }))}>
        <Alert severity={snack.sev} onClose={() => setSnack(s => ({ ...s, open: false }))}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
};

export default CoffreFortModern;
