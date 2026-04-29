import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { Box, Button, CircularProgress, IconButton, Menu, MenuItem,
  Autocomplete, TextField, TextField as MuiTextField, Snackbar, Alert } from '@mui/material';
import { useAuth } from '../helper/AuthProvider';
import apiInstance from '../API/apiInstance';
import { DocumentVault } from '../../models/DocumentVault';
import useGetEmployee from '../../hooks/employeHooks/useGetEmployee';
import './CoffreFortModern.css';

const CoffreFortModern = () => {
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

  useEffect(() => {
    if (authReady) {
      if (soccod && uticod) {
        fetchDocuments();
      } else {
        setIsLoading(false);
      }
    }
  }, [soccod, uticod, authReady]);

  const fetchDocuments = async () => {
    try {
      setIsLoading(true);
      const res = await apiInstance.get(`/Vault/${soccod}/${uticod}`);
      setDocuments(res.data);
    } catch (err) {
      console.error("Erreur lors de la récupération des documents", err);
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
      setSnack({ open: true, sev: 'success', msg: isDepositForOther ? 'Document déposé et employé notifié.' : 'Document ajouté.' });
      // Rafraîchir la liste : si on dépose chez quelqu'un d'autre, le coffre courant n'a pas
      // changé — pas besoin de refetch ici. Sinon on rafraîchit la liste personnelle.
      if (!isDepositForOther) fetchDocuments();
      // Reset cible/message pour éviter dépôt accidentel suivant.
      if (isDepositForOther) { setTargetEmpcod(''); setUploadMessage(''); }
    } catch (err: any) {
      console.error("Erreur d'upload", err);
      setSnack({ open: true, sev: 'error', msg: err?.response?.data?.message || err?.response?.data || "Erreur lors du dépôt du document." });
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


  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box className="coffre-fort-container">
      {/* Page Header */}
      <section className="vault-header">
        <div className="vault-title-section">
          <label className="vault-badge">Session Authentifiée Active</label>
          <h1 className="vault-title">Coffre-fort Numérique</h1>
          <p className="vault-description">
            Votre archive sécurisée et cryptée pour vos actifs administratifs personnels. 
            Tous les documents sont stockés avec un cryptage de bout en bout et une validation d'horodatage.
          </p>
        </div>

        <div className="vault-stats-card">
          <div className="stats-top">
            <span className="material-symbols-outlined" style={{ color: '#0040a1', fontSize: '2rem' }}>verified_user</span>
            <div style={{ textAlign: 'right' }}>
              <span className="stats-label" style={{ display: 'block', fontSize: '0.6rem' }}>État du Coffre</span>
              <div className="status-indicator">
                <span className="status-dot"></span> Sécurisé
              </div>
            </div>
          </div>
          <div className="stats-value-container">
            <div className="stats-number">{documents.length}</div>
            <span className="stats-label">Documents Totaux Cryptés</span>
          </div>
        </div>
      </section>

      {/* Admin/Manager — déposer un document pour un employé spécifique */}
      {canDepositForOthers && (
        <section style={{ marginBottom: '2rem', padding: '1rem 1.25rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <span className="material-symbols-outlined" style={{ color: '#0040a1' }}>admin_panel_settings</span>
            <strong style={{ fontSize: '0.9rem' }}>Déposer un document pour un employé</strong>
            <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
              {isAdmin ? '(tous les employés)' : '(employés de votre service uniquement)'}
            </span>
          </div>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' }, gap: 1.5 }}>
            <Autocomplete
              size="small"
              options={employeeOptions}
              getOptionLabel={(o) => `${o.lib} (${o.code})`}
              isOptionEqualToValue={(a, b) => a.code === b.code}
              value={employeeOptions.find(o => o.code === targetEmpcod) || null}
              onChange={(_, val) => setTargetEmpcod(val?.code || '')}
              renderInput={(params) => <TextField {...params} placeholder="Sélectionner un employé…" />}
            />
            <MuiTextField
              size="small"
              placeholder="Message (optionnel) — sera affiché dans la notification"
              value={uploadMessage}
              onChange={(e) => setUploadMessage(e.target.value)}
              disabled={!targetEmpcod}
            />
          </Box>
          {targetEmpcod && (
            <p style={{ marginTop: 8, fontSize: '0.75rem', color: '#0f5132' }}>
              Le prochain document que vous ajouterez sera déposé dans le coffre de cet employé et celui-ci sera notifié.
            </p>
          )}
        </section>
      )}

      {/* Asset Collections */}
      <section style={{ marginBottom: '3rem' }}>
        <div className="folder-section-header">
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Collections</h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>Parcourir les répertoires organisés</p>
          </div>
        </div>

        <div className="folder-grid">
          <div className="folder-card pay-slips">
            <div className="folder-icon-wrapper">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>receipt_long</span>
            </div>
            <h4 className="folder-name">Fiches de Paie</h4>
            <p className="folder-info">{paySlips.length} Documents</p>
            <div className="folder-progress-bar">
              <div className="progress-fill" style={{ width: `${Math.min(100, (paySlips.length / 24) * 100)}%` }}></div>
            </div>
          </div>

          <div className="folder-card contracts">
            <div className="folder-icon-wrapper">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>description</span>
            </div>
            <h4 className="folder-name">Contrats</h4>
            <p className="folder-info">{contracts.length} Documents</p>
            <div className="folder-progress-bar">
              <div className="progress-fill" style={{ width: `${Math.min(100, (contracts.length / 5) * 100)}%` }}></div>
            </div>
          </div>

          <div className="folder-card certificates">
            <div className="folder-icon-wrapper">
              <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>badge</span>
            </div>
            <h4 className="folder-name">Attestations</h4>
            <p className="folder-info">{certificates.length} Documents</p>
            <div className="folder-progress-bar">
              <div className="progress-fill" style={{ width: `${Math.min(100, (certificates.length / 10) * 100)}%` }}></div>
            </div>
          </div>

          <div className="folder-card new-collection-card" onClick={(e) => setAnchorEl(e.currentTarget)}>
            <div className="add-icon-circle">
              <span className="material-symbols-outlined">add</span>
            </div>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {uploading ? "Chargement..." : "Nouvel Actif"}
            </span>
          </div>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
          >
            <MenuItem onClick={() => { setSelectedType('Fiche de paie'); document.getElementById('vault-upload-input')?.click(); setAnchorEl(null); }}>
              Fiche de Paie
            </MenuItem>
            <MenuItem onClick={() => { setSelectedType('Contrat'); document.getElementById('vault-upload-input')?.click(); setAnchorEl(null); }}>
              Contrat
            </MenuItem>
            <MenuItem onClick={() => { setSelectedType('Attestation'); document.getElementById('vault-upload-input')?.click(); setAnchorEl(null); }}>
              Attestation
            </MenuItem>
            <MenuItem onClick={() => { setSelectedType('Autre'); document.getElementById('vault-upload-input')?.click(); setAnchorEl(null); }}>
              Autre
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
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Documents Récents</h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>Actifs validés téléchargés récemment</p>
          </div>
          <Button sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.8rem' }}>Voir tout l'archive</Button>
        </div>

        <div className="vault-table-wrapper">
          <table className="vault-table">
            <thead>
              <tr>
                <th>Nom du Document</th>
                <th>Type</th>
                <th>Date de Modification</th>
                <th>Taille</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {documents.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                    Aucun document dans votre coffre-fort.
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
                            <span className="type-chip" style={{ fontSize: '0.6rem', padding: '0.1rem 0.4rem', background: '#f2f4f6', opacity: 0.8 }}>{doc.docType}</span>
                          </div>
                          {doc.isSigned ? (
                            <div className="doc-status-tag">
                              <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>verified</span>
                              Signature Numérique Valide
                            </div>
                          ) : (
                            <div className="doc-status-tag" style={{ color: '#9a3412' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>pending</span>
                              En attente de signature
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`type-chip type-${doc.docType === 'Fiche de paie' ? 'pay-slip' : doc.docType === 'Contrat' ? 'contract' : 'certificate'}`}>
                        {doc.docType}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: '#424654' }}>
                      {new Date(doc.docDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
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
                            Signer
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

      {/* Floating Privacy Guard */}
      <div className="privacy-guard-bar">
        <div className="guard-info">
          <div className="guard-icon-circle">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>lock</span>
          </div>
          <div className="guard-text">
            <p>Protection de la Vie Privée Active</p>
            <p>Votre écran est automatiquement masqué en cas d'inactivité.</p>
          </div>
        </div>
        <div className="guard-actions">
          <button className="guard-btn-secondary">Journal d'activité</button>
          <button className="guard-btn-primary">Synchro Master Key</button>
        </div>
      </div>
    </Box>
  );
};

export default CoffreFortModern;
