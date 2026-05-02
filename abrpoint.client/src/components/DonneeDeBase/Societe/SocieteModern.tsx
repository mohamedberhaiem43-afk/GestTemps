import { useState, useMemo } from 'react';
import { Box, Typography, Button, Snackbar, Alert } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import ScheduleIcon from '@mui/icons-material/Schedule';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import useAddSociete from '../../../hooks/societeHooks/useAddSociete';
import useUpdateSociete from '../../../hooks/societeHooks/useUpdateSociete';
import useGetSocietes from '../../../hooks/societeHooks/useGetSocietes';
import useDeleteSociete from '../../../hooks/societeHooks/useDeleteSociete';
import useGetUsers from '../../../hooks/userHooks/useGetUsers';
import { Societe as SocieteModel } from '../../../models/Societe';
import { useAuth } from '../../helper/AuthProvider';
import AccessDenied from '../../helper/AccessDenied';
import { resolveAssetUrl } from '../../../helpers/assetUrl';
import apiInstance from '../../API/apiInstance';
import './SocieteModern.css';

const emptyForm: SocieteModel = {
  soccod: '', soclib: '', socresp: '', socadr: '', socville: '', soctel: '', socfax: '',
  socemail: '', socccb: '', soctva: '', soctva1: '', soctva2: '', soctva3: '',
  soctva000: '000', socreg: 0, socmois: 0.0, soctype: '', socpresence: '',
  sochsup: '', socmere: '', socsmig: '', soclibar: '', socadrar: '', socrespar: ''
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const getTypeBadge = (type: string) => {
  const t = (type || '').toLowerCase();
  if (t.includes('siège') || t.includes('siege') || t === 's') return 'soc-type-badge--siege';
  if (t.includes('groupe') || t === 'g') return 'soc-type-badge--groupe';
  return 'soc-type-badge--filiale';
};

const getTypeLabel = (type: string) => {
  if (!type) return '—';
  const t = type.toLowerCase();
  if (t.includes('siège') || t.includes('siege') || t === 's') return 'Siège';
  if (t.includes('groupe') || t === 'g') return 'Groupe';
  if (t.includes('filiale') || t === 'f') return 'Filiale';
  return type;
};

// ── Inner Component ──────────────────────────────────────────────────────────
function SocieteModernContent() {
  const { hasPermission } = useAuth();
  const [form, setForm] = useState<SocieteModel>(emptyForm);
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' as any });
  const [filterType, setFilterType] = useState('');

  const { mutate: addSociete, isLoading: isAdding } = useAddSociete();
  const { mutate: updateSociete, isLoading: isUpdating } = useUpdateSociete();
  const { data: societes = [], refetch } = useGetSocietes();
  const { mutate: deleteSociete } = useDeleteSociete();
  const { data: users = [] } = useGetUsers();

  const isEditMode = form.soccod !== '' && form.soccod !== emptyForm.soccod && societes.some(s => s.soccod === form.soccod);
  const isLoading = isAdding || isUpdating;

  const canAdd = hasPermission('Données de Base', 'add');
  const canModify = hasPermission('Données de Base', 'modify');
  const canDelete = hasPermission('Données de Base', 'delete');

  if (!hasPermission('Données de Base', 'consult')) {
    return <AccessDenied message="Vous n'avez pas le droit de consulter les paramètres société." />;
  }

  // ── Filtered data ────────────────────────────────────────────────────────
  const filteredSocietes = useMemo(() => {
    const list = Array.isArray(societes) ? societes : [];
    if (!filterType) return list;
    return list.filter(s => {
      const t = (s.soctype || '').toLowerCase();
      if (filterType === 'filiales') return t.includes('filiale') || t === 'f';
      if (filterType === 'groupes') return t.includes('groupe') || t === 'g';
      return true;
    });
  }, [societes, filterType]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const set = (field: keyof SocieteModel) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const val = e.target.value;
    setForm(prev => ({ ...prev, [field]: field === 'socreg' || field === 'socmois' ? Number(val) || 0 : val }));
  };

  const handleSubmit = () => {
    if (!form.soccod || !form.soclib) {
      setSnack({ open: true, msg: 'Code et Libellé sont obligatoires.', sev: 'error' });
      return;
    }
    const onSuccess = () => {
      refetch();
      setSnack({ open: true, msg: isEditMode ? 'Société mise à jour avec succès.' : 'Société ajoutée avec succès.', sev: 'success' });
      setForm(emptyForm);
    };
    const onError = () => {
      setSnack({ open: true, msg: isEditMode ? 'Erreur lors de la mise à jour.' : 'Erreur lors de l\'ajout.', sev: 'error' });
    };
    if (isEditMode) {
      updateSociete(form, { onSuccess, onError });
    } else {
      addSociete(form, { onSuccess, onError });
    }
  };

  const handleEdit = (soc: SocieteModel) => {
    setForm(soc);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (soc: SocieteModel) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette société ?')) {
      deleteSociete({ soccod: soc.soccod }, { onSuccess: () => refetch() });
    }
  };

  const handleCancel = () => {
    setForm(emptyForm);
  };

  return (
    <Box className="soc-container">
      {/* ── Header ── */}
      <Box className="soc-header">
        <Box>
          <Typography className="soc-title">Paramètres Société</Typography>
          <Typography className="soc-subtitle">Gérez votre portefeuille d'entités et leurs configurations.</Typography>
        </Box>
        <Box className="soc-header-actions">
          <Button className="soc-export-btn" startIcon={<DownloadIcon />}>
            Exporter
          </Button>
          {canAdd && !isEditMode && (
            <Button className="soc-save-btn" startIcon={<EditIcon />} onClick={() => setForm(emptyForm)}>
              Nouvelle Société
            </Button>
          )}
        </Box>
      </Box>

      {/* ── PRIMARY SECTION: Table (top) ── */}
      <Box className="soc-table-section">
        <Box className="soc-table-header">
          <Typography className="soc-table-title">Portefeuille des Sociétés</Typography>
          <Box className="soc-table-filter">
            <span>Filtrer par type :</span>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="">Toutes</option>
              <option value="filiales">Filiales</option>
              <option value="groupes">Groupes</option>
            </select>
          </Box>
        </Box>
        <Box sx={{ overflowX: 'auto' }}>
          <table className="soc-table">
            <thead>
              <tr>
                <th>Actions</th>
                <th>Code</th>
                <th>Libellé</th>
                <th>Type</th>
                <th>Tél / E-mail</th>
                <th>Responsable</th>
                <th>Adresse</th>
              </tr>
            </thead>
            <tbody>
              {filteredSocietes.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: '#94a3b8', padding: 32 }}>
                    Aucune société trouvée.
                  </td>
                </tr>
              ) : (
                filteredSocietes.map((soc) => {
                  const isSelected = isEditMode && form.soccod === soc.soccod;
                  return (
                    <tr key={soc.soccod} className={isSelected ? 'soc-row--selected' : ''}>
                      <td>
                        <Box sx={{ display: 'flex', gap: '4px' }}>
                          {canModify && (
                            <button className="soc-action-btn soc-action-btn--edit" onClick={() => handleEdit(soc)}>
                              <EditIcon sx={{ fontSize: 16 }} />
                            </button>
                          )}
                          {canDelete && (
                            <button className="soc-action-btn soc-action-btn--delete" onClick={() => handleDelete(soc)}>
                              <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                            </button>
                          )}
                          {!canModify && !canDelete && <Typography variant="caption">—</Typography>}
                        </Box>
                      </td>
                      <td style={{ fontWeight: 700, color: '#0f172a' }}>{soc.soccod}</td>
                      <td>{soc.soclib}</td>
                      <td>
                        <span className={`soc-type-badge ${getTypeBadge(soc.soctype)}`}>
                          {getTypeLabel(soc.soctype)}
                        </span>
                      </td>
                      <td>
                        <Box className="soc-contact-cell">
                          <span className="soc-contact-name">{soc.soctel || '—'}</span>
                          <span className="soc-contact-sub">{soc.socemail || '—'}</span>
                        </Box>
                      </td>
                      <td style={{ fontWeight: 500, color: '#334155' }}>{soc.socresp || '—'}</td>
                      <td style={{ color: '#64748b', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {soc.socadr || '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </Box>
        <Box className="soc-table-footer">
          <span className="soc-table-footer-info">
            Affichage de {filteredSocietes.length > 0 ? 1 : 0} à {filteredSocietes.length} sur {filteredSocietes.length} sociétés
          </span>
          <Box className="soc-pagination">
            <button className="soc-page-btn" disabled><ChevronLeftIcon sx={{ fontSize: 16 }} /></button>
            <button className="soc-page-btn soc-page-btn--active">1</button>
            <button className="soc-page-btn" disabled><ChevronRightIcon sx={{ fontSize: 16 }} /></button>
          </Box>
        </Box>
      </Box>

      {/* ── SECONDARY SECTION: Contextual sub-header + Form ── */}
      <Box className="soc-details-header">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box className="soc-details-icon"><FingerprintIcon fontSize="small" /></Box>
          <Box>
            <Typography className="soc-details-title">
              {isEditMode ? <>Détails de l'entité : <span className="soc-details-code">{form.soccod}</span></> : 'Nouvelle société'}
            </Typography>
            <Typography className="soc-details-sub">
              {isEditMode ? "Modifiez les informations de l'entité sélectionnée." : 'Renseignez les informations de la nouvelle entité.'}
            </Typography>
          </Box>
        </Box>
        <Box className="soc-header-actions">
          {isEditMode && (
            <Button className="soc-export-btn" onClick={handleCancel} sx={{ color: '#ba1a1a !important' }}>
              Annuler
            </Button>
          )}
          {((isEditMode && canModify) || (!isEditMode && canAdd)) && (
            <Button className="soc-save-btn" startIcon={<SaveIcon />} onClick={handleSubmit} disabled={isLoading}>
              {isLoading ? 'Enregistrement...' : isEditMode ? 'Enregistrer les modifications' : 'Enregistrer'}
            </Button>
          )}
        </Box>
      </Box>

      {/* ── Bento Form Grid ── */}
      <Box className="soc-bento-grid">
        {/* Card: Identification */}
        <Box className="soc-card soc-card--id">
          <Box className="soc-card-header">
            <Box className="soc-card-icon"><FingerprintIcon fontSize="small" /></Box>
            <Typography className="soc-card-title">Identification</Typography>
          </Box>
          <Box className="soc-form-grid">
            <Box className="soc-field">
              <label>Code Société</label>
              <input type="text" value={form.soccod} onChange={set('soccod')} readOnly={isEditMode} />
            </Box>
            <Box className="soc-field">
              <label>Libellé</label>
              <input type="text" value={form.soclib} onChange={set('soclib')} />
            </Box>
            <Box className="soc-field">
              <label>Société Mère</label>
              <select value={form.socmere || ''} onChange={set('socmere')}>
                <option value="">Aucune</option>
                {(Array.isArray(societes) ? societes : []).filter(s => s.soccod !== form.soccod).map(s => (
                  <option key={s.soccod} value={s.soccod}>{s.soclib}</option>
                ))}
              </select>
            </Box>
            <Box className="soc-field">
              <label>Type de Société</label>
              <select value={form.soctype || ''} onChange={set('soctype')}>
                <option value="">Sélectionner...</option>
                <option value="S">Siège</option>
                <option value="G">Groupe</option>
                <option value="F">Filiale</option>
              </select>
            </Box>
            <Box className="soc-field soc-field--full" sx={{ mt: 1 }}>
              <label>Logo de la Société</label>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                 {localStorage.getItem('societeImage') && (
                    <img
                       src={resolveAssetUrl(localStorage.getItem('societeImage'))}
                       alt="Logo"
                       style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: '8px', border: '1px solid #eee' }}
                    />
                 )}
                 <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                       const file = e.target.files?.[0];
                       if (!file) return;
                       const target = form.soccod || form.soccod === '' ? form.soccod : '';
                       if (!target) {
                          setSnack({ open: true, msg: 'Sélectionnez ou enregistrez la société avant d\'uploader le logo.', sev: 'warning' as any });
                          return;
                       }
                       try {
                          const fd = new FormData();
                          fd.append('file', file);
                          const r = await apiInstance.post(`/Parametres/upload-logo/${target}`, fd, {
                             headers: { 'Content-Type': 'multipart/form-data' },
                          });
                          const filePath: string | undefined = r.data?.filePath;
                          if (filePath) {
                             localStorage.setItem('societeImage', filePath);
                             window.dispatchEvent(new Event('imageUpdated'));
                             setSnack({ open: true, msg: 'Logo mis à jour avec succès.', sev: 'success' });
                          }
                       } catch (err: any) {
                          setSnack({ open: true, msg: err?.response?.data?.message || 'Erreur lors de l\'upload du logo.', sev: 'error' });
                       }
                    }}
                    style={{ fontSize: '12px' }}
                 />
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Card: Coordonnées */}
        <Box className="soc-card soc-card--coord">
          <Box className="soc-card-header">
            <Box className="soc-card-icon"><LocationOnIcon fontSize="small" /></Box>
            <Typography className="soc-card-title">Coordonnées</Typography>
          </Box>
          <Box className="soc-form-grid soc-form-grid--2">
            <Box className="soc-field soc-field--full">
              <label>Num Rue</label>
              <input type="text" value={form.socadr} onChange={set('socadr')} />
            </Box>
            <Box className="soc-field">
              <label>Ville</label>
              <input type="text" value={form.socville} onChange={set('socville')} placeholder="Casablanca" />
            </Box>
            <Box className="soc-field">
              <label>E-mail</label>
              <input type="email" value={form.socemail} onChange={set('socemail')} />
            </Box>
            <Box className="soc-field">
              <label>Téléphone</label>
              <input type="tel" value={form.soctel} onChange={set('soctel')} />
            </Box>
            <Box className="soc-field">
              <label>Fax</label>
              <input type="tel" value={form.socfax} onChange={set('socfax')} />
            </Box>
            <Box className="soc-field soc-field--full">
              <label>Responsable RH</label>
              <select value={form.socresp || ''} onChange={set('socresp')}>
                <option value="">Sélectionner un responsable...</option>
                {users.map((u: any) => (
                  <option key={u.uticod} value={u.uticod}>
                    {u.utiprn} {u.utinom} ({u.uticod})
                  </option>
                ))}
              </select>
            </Box>
          </Box>
        </Box>

        {/* Card: Paramètres Fiscaux */}
        <Box className="soc-card soc-card--fiscal">
          <Box className="soc-card-header">
            <Box className="soc-card-icon"><AccountBalanceIcon fontSize="small" /></Box>
            <Typography className="soc-card-title">Paramètres Fiscaux</Typography>
          </Box>
          <Box className="soc-form-grid soc-form-grid--4">
            <Box className="soc-field">
              <label>Régime Fiscal</label>
              <select value={form.socreg} onChange={set('socreg')}>
                <option value={0}>Régime Normal</option>
                <option value={1}>Régime Simplifié</option>
              </select>
            </Box>
            <Box className="soc-field">
              <label>Valeur SMIG</label>
              <input type="text" value={form.socsmig} onChange={set('socsmig')} />
            </Box>
            <Box className="soc-field" style={{ gridColumn: 'span 2' }}>
              <label>N.CCB (Compte Bancaire)</label>
              <input type="text" value={form.socccb} onChange={set('socccb')} />
            </Box>
            <Box className="soc-divider" />
            <Box className="soc-field soc-field--tva">
              <label>TVA (Base)</label>
              <input type="text" value={form.soctva} onChange={set('soctva')} />
            </Box>
            <Box className="soc-field soc-field--tva">
              <label>TVA 1</label>
              <input type="text" value={form.soctva1} onChange={set('soctva1')} />
            </Box>
            <Box className="soc-field soc-field--tva">
              <label>TVA 2</label>
              <input type="text" value={form.soctva2} onChange={set('soctva2')} />
            </Box>
            <Box className="soc-field soc-field--tva">
              <label>TVA 3</label>
              <input type="text" value={form.soctva3} onChange={set('soctva3')} />
            </Box>
            <Box className="soc-field soc-field--tva">
              <label>TVA 000</label>
              <input type="text" value={form.soctva000} readOnly />
            </Box>
          </Box>
        </Box>

        {/* Card: Travail */}
        <Box className="soc-card soc-card--work">
          <Box className="soc-card-header">
            <Box className="soc-card-icon"><ScheduleIcon fontSize="small" /></Box>
            <Typography className="soc-card-title">Travail</Typography>
          </Box>
          <Box className="soc-form-grid">
            <Box className="soc-field soc-field--big">
              <label>Heures / Mois</label>
              <input type="number" value={form.socmois} onChange={set('socmois')} />
              <span className="soc-field-hint">Standard légal par défaut</span>
            </Box>
            <Box className="soc-info-box">
              <p>Ce paramètre impacte le calcul automatique des heures supplémentaires et de la paie nette.</p>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* ── Snackbar ── */}
      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack(s => ({ ...s, open: false }))}>
        <Alert severity={snack.sev} onClose={() => setSnack(s => ({ ...s, open: false }))} sx={{ borderRadius: '10px' }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default SocieteModernContent;