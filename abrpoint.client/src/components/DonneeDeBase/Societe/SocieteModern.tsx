import { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Box, Typography, Button } from '@mui/material';
import { useFeedbackSnackbar } from '../../helper/FeedbackSnackbar';
import { useTranslation } from 'react-i18next';
import SaveIcon from '@mui/icons-material/Save';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
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
  sochsup: '', socmere: '', socsmig: null, soclibar: '', socadrar: '', socrespar: ''
};
const FIELD_LIMITS: Partial<Record<keyof SocieteModel, number>> = {
  soccod: 2,
  soclib: 30,
  socresp: 30,
  socadr: 40,
  socville: 60,
  soctel: 20,
  socfax: 20,
  socemail: 30,
  socccb: 1,
  soctva: 10,
  soctva1: 1,
  soctva2: 1,
  soctva3: 1,
  soctva000: 3,
  soctype: 1,
  socpresence: 1,
  sochsup: 1,
  socmere: 6,
  soclibar: 100,
  socadrar: 100,
  socrespar: 30,
};

const getTypeBadge = (type: string) => {
  const t = (type || '').toLowerCase();
  if (t.includes('siège') || t.includes('siege') || t === 's') return 'soc-type-badge--siege';
  if (t.includes('groupe') || t === 'g') return 'soc-type-badge--groupe';
  return 'soc-type-badge--filiale';
};

function SocieteModernContent() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const [form, setForm] = useState<SocieteModel>(emptyForm);
  // Pour le quota plan_limit_societes (HTTP 402), on injecte un CTA "Mettre à
  // niveau" directement dans l'Alert via l'option `action` du hook.
  const feedback = useFeedbackSnackbar();
  const [filterType, setFilterType] = useState('');

  const getTypeLabel = (type: string) => {
    if (!type) return '—';
    const tp = type.toLowerCase();
    if (tp.includes('siège') || tp.includes('siege') || tp === 's') return t('societe.type.siege');
    if (tp.includes('groupe') || tp === 'g') return t('societe.type.groupe');
    if (tp.includes('filiale') || tp === 'f') return t('societe.type.filiale');
    return type;
  };

  const { mutate: addSociete, isPending: isAdding } = useAddSociete();
  const { mutate: updateSociete, isPending: isUpdating } = useUpdateSociete();
  const { data: societes = [], refetch } = useGetSocietes();
  const { mutate: deleteSociete } = useDeleteSociete();
  const { data: users = [] } = useGetUsers();

  const isEditMode = form.soccod !== '' && form.soccod !== emptyForm.soccod && societes.some(s => s.soccod === form.soccod);
  const isLoading = isAdding || isUpdating;

  const canAdd = hasPermission('Données de Base', 'add');
  const canModify = hasPermission('Données de Base', 'modify');
  const canDelete = hasPermission('Données de Base', 'delete');

  if (!hasPermission('Données de Base', 'consult')) {
    return <AccessDenied message={t('societe.noConsultRight')} />;
  }

  const filteredSocietes = useMemo(() => {
    const list = Array.isArray(societes) ? societes : [];
    if (!filterType) return list;
    return list.filter(s => {
      const tp = (s.soctype || '').toLowerCase();
      if (filterType === 'filiales') return tp.includes('filiale') || tp === 'f';
      if (filterType === 'groupes') return tp.includes('groupe') || tp === 'g';
      return true;
    });
  }, [societes, filterType]);

  const set = (field: keyof SocieteModel) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const val = e.target.value;
    let parsedValue: string | number | null = val;

    if (field === 'socreg' || field === 'socmois') {
      parsedValue = Number(val) || 0;
    }
    if (field === 'socsmig') {
      parsedValue = val === '' ? null : Number(val);
      if (parsedValue !== null && Number.isNaN(parsedValue)) parsedValue = null;
    }

    setForm(prev => ({ ...prev, [field]: parsedValue }));
  };

  const handleSubmit = () => {
    const normalized: SocieteModel = {
      ...form,
      soccod: (form.soccod || '').trim().toUpperCase(),
      soclib: (form.soclib || '').trim(),
      socresp: (form.socresp || '').trim(),
      socadr: (form.socadr || '').trim(),
      socville: (form.socville || '').trim(),
      soctel: (form.soctel || '').trim(),
      socfax: (form.socfax || '').trim(),
      socemail: (form.socemail || '').trim(),
      socccb: (form.socccb || '').trim(),
      soctva: (form.soctva || '').trim(),
      soctva1: (form.soctva1 || '').trim(),
      soctva2: (form.soctva2 || '').trim(),
      soctva3: (form.soctva3 || '').trim(),
      soctva000: (form.soctva000 || '').trim(),
      soctype: (form.soctype || '').trim().toUpperCase(),
      socpresence: (form.socpresence || '').trim(),
      sochsup: (form.sochsup || '').trim(),
      socmere: (form.socmere || '').trim().toUpperCase(),
      socsmig: form.socsmig === null ? null : form.socsmig,
      soclibar: (form.soclibar || '').trim(),
      socadrar: (form.socadrar || '').trim(),
      socrespar: (form.socrespar || '').trim(),
    };

    if (!normalized.soccod || !normalized.soclib) {
      feedback.showError(t('societe.msg.codeLibelleRequired'));
      return;
    }
    if (normalized.soccod.length !== 2) {
      feedback.showError(t('societe.msg.codeMustBeTwoChars'));
      return;
    }
    for (const [field, max] of Object.entries(FIELD_LIMITS) as Array<[keyof SocieteModel, number]>) {
      const value = String((normalized[field] ?? '') as string);
      if (max && value.length > max) {
        feedback.showError(t('societe.msg.fieldExceeds', { field: String(field), max }));
        return;
      }
    }

    const onSuccess = () => {
      refetch();
      feedback.showSuccess(isEditMode ? t('societe.msg.updated') : t('societe.msg.added'));
      setForm(emptyForm);
    };
    const onError = (err: any) => {
      const status = err?.response?.status;
      const data = err?.response?.data;
      const apiMsg =
        data?.message ||
        (typeof data === 'string' ? data : '') ||
        (data?.errors ? JSON.stringify(data.errors) : '');
      const code: string | undefined = data?.code;

      // 402 Payment Required = quota du plan atteint (cf. SocietesController.Post →
      // `plan_limit_societes` quand on tente d'ajouter une société sur un plan
      // mono-société). On affiche en `warning` avec un CTA "Mettre à niveau".
      if (status === 402 && code === 'plan_limit_societes') {
        feedback.showWarning(apiMsg || t('societe.msg.planLimitDefault'), {
          action: (
            <Button
              size="small"
              color="inherit"
              onClick={() => { window.location.href = '/dashboard/mon-abonnement'; }}
              sx={{ fontWeight: 800, textTransform: 'none' }}
            >
              {t('societe.msg.upgradeCta')}
            </Button>
          ),
        });
        return;
      }

      // Cas réseau / serveur muet : pas de réponse exploitable. On loggue pour
      // faciliter le diagnostic et on affiche un message générique.
      if (!err?.response) {
        // eslint-disable-next-line no-console
        console.error('[Societe] erreur sans réponse HTTP :', err);
      }
      feedback.showError(err, isEditMode ? t('societe.msg.updateError') : t('societe.msg.addError'));
    };

    if (isEditMode) {
      updateSociete(normalized, { onSuccess, onError });
    } else {
      addSociete(normalized, { onSuccess, onError });
    }
  };

  const handleEdit = (soc: SocieteModel) => {
    setForm(soc);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (soc: SocieteModel) => {
    if (window.confirm(t('societe.msg.deleteConfirm'))) {
      deleteSociete({ soccod: soc.soccod }, { onSuccess: () => refetch() });
    }
  };

  const handleCancel = () => {
    setForm(emptyForm);
  };

  // Export XLSX de la liste des sociétés (telle que filtrée à l'écran). Utilise la lib
  // `xlsx` déjà présente dans les deps. Pas d'aller-retour serveur — la donnée est
  // déjà en mémoire via useGetSocietes. Nom de fichier daté pour traçabilité côté
  // utilisateur final qui télécharge plusieurs exports.
  const handleExport = () => {
    try {
      const rows = (filteredSocietes || []).map((s) => ({
        Code: s.soccod,
        Libellé: s.soclib,
        Type: getTypeLabel(s.soctype || ''),
        Responsable: s.socresp,
        Adresse: s.socadr,
        Ville: s.socville,
        Téléphone: s.soctel,
        Fax: s.socfax,
        Email: s.socemail,
        TVA: s.soctva,
        'Compte CB': s.socccb,
        'Régime': s.socreg,
        'Mois clôture': s.socmois,
        'Heures suppl.': s.sochsup,
        'Société mère': s.socmere,
        SMIG: s.socsmig,
      }));
      if (rows.length === 0) {
        feedback.showWarning(t('societe.exportEmpty', { defaultValue: 'Aucune société à exporter.' }));
        return;
      }
      const ws = XLSX.utils.json_to_sheet(rows);
      // Largeurs de colonnes raisonnables — sinon Excel rend tout en 8 caractères.
      ws['!cols'] = [
        { wch: 8 },  { wch: 28 }, { wch: 12 }, { wch: 24 }, { wch: 32 }, { wch: 22 },
        { wch: 16 }, { wch: 16 }, { wch: 28 }, { wch: 14 }, { wch: 12 }, { wch: 8 },
        { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 10 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sociétés');
      const date = new Date().toISOString().split('T')[0];
      XLSX.writeFile(wb, `societes-${date}.xlsx`);
      feedback.showSuccess(t('societe.exportSuccess', { defaultValue: 'Export terminé.' }));
    } catch (e) {
      feedback.showError(e, t('societe.exportError', { defaultValue: "Échec de l'export." }));
    }
  };

  return (
    <Box className="soc-container">
      {/* Header */}
      <Box className="soc-header">
        <Box>
          <Typography className="soc-title">{t('societe.title')}</Typography>
          <Typography className="soc-subtitle">{t('societe.subtitle')}</Typography>
        </Box>
        <Box className="soc-header-actions">
          <Button className="soc-export-btn" startIcon={<DownloadIcon />} onClick={handleExport}>
            {t('societe.export')}
          </Button>
          {canAdd && !isEditMode && (
            <Button className="soc-save-btn" startIcon={<EditIcon />} onClick={() => setForm(emptyForm)}>
              {t('societe.newCompany')}
            </Button>
          )}
        </Box>
      </Box>

      {/* PRIMARY SECTION: Table (top) */}
      <Box className="soc-table-section">
        <Box className="soc-table-header">
          <Typography className="soc-table-title">{t('societe.tableTitle')}</Typography>
          <Box className="soc-table-filter">
            <span>{t('societe.filterByType')}</span>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="">{t('societe.all')}</option>
              <option value="filiales">{t('societe.branches')}</option>
              <option value="groupes">{t('societe.groups')}</option>
            </select>
          </Box>
        </Box>
        <Box sx={{ overflowX: 'auto' }}>
          <table className="soc-table">
            <thead>
              <tr>
                <th>{t('societe.headers.actions')}</th>
                <th>{t('societe.headers.code')}</th>
                <th>{t('societe.headers.label')}</th>
                <th>{t('societe.headers.type')}</th>
                <th>{t('societe.headers.phoneEmail')}</th>
                <th>{t('societe.headers.responsible')}</th>
                <th>{t('societe.headers.address')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredSocietes.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: '#94a3b8', padding: 32 }}>
                    {t('societe.noCompany')}
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
            {t('societe.pagination', {
              start: filteredSocietes.length > 0 ? 1 : 0,
              end: filteredSocietes.length,
              total: filteredSocietes.length,
            })}
          </span>
          <Box className="soc-pagination">
            <button className="soc-page-btn" disabled><ChevronLeftIcon sx={{ fontSize: 16 }} /></button>
            <button className="soc-page-btn soc-page-btn--active">1</button>
            <button className="soc-page-btn" disabled><ChevronRightIcon sx={{ fontSize: 16 }} /></button>
          </Box>
        </Box>
      </Box>

      {/* SECONDARY SECTION: Contextual sub-header + Form */}
      <Box className="soc-details-header">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box className="soc-details-icon"><FingerprintIcon fontSize="small" /></Box>
          <Box>
            <Typography className="soc-details-title">
              {isEditMode
                ? t('societe.detailsTitle', { code: form.soccod })
                : t('societe.newDetailsTitle')}
            </Typography>
            <Typography className="soc-details-sub">
              {isEditMode ? t('societe.editSubtitle') : t('societe.newSubtitle')}
            </Typography>
          </Box>
        </Box>
        <Box className="soc-header-actions">
          {isEditMode && (
            <Button className="soc-export-btn" onClick={handleCancel} sx={{ color: '#ba1a1a !important' }}>
              {t('societe.cancel')}
            </Button>
          )}
          {((isEditMode && canModify) || (!isEditMode && canAdd)) && (
            <Button className="soc-save-btn" startIcon={<SaveIcon />} onClick={handleSubmit} disabled={isLoading}>
              {isLoading
                ? t('societe.saving')
                : isEditMode
                  ? t('societe.saveChanges')
                  : t('societe.save')}
            </Button>
          )}
        </Box>
      </Box>

      {/* Bento Form Grid */}
      <Box className="soc-bento-grid">
        {/* Card: Identification */}
        <Box className="soc-card soc-card--id">
          <Box className="soc-card-header">
            <Box className="soc-card-icon"><FingerprintIcon fontSize="small" /></Box>
            <Typography className="soc-card-title">{t('societe.card.identification')}</Typography>
          </Box>
          <Box className="soc-form-grid">
            <Box className="soc-field">
              <label>{t('societe.form.companyCode')}</label>
              <input type="text" value={form.soccod} onChange={set('soccod')} readOnly={isEditMode} maxLength={2} />
            </Box>
            <Box className="soc-field">
              <label>{t('societe.form.label')}</label>
              <input type="text" value={form.soclib} onChange={set('soclib')} />
            </Box>
            <Box className="soc-field">
              <label>{t('societe.form.parentCompany')}</label>
              <select value={form.socmere || ''} onChange={set('socmere')}>
                <option value="">{t('societe.form.none')}</option>
                {(Array.isArray(societes) ? societes : []).filter(s => s.soccod !== form.soccod).map(s => (
                  <option key={s.soccod} value={s.soccod}>{s.soclib}</option>
                ))}
              </select>
            </Box>
            <Box className="soc-field">
              <label>{t('societe.form.companyType')}</label>
              <select value={form.soctype || ''} onChange={set('soctype')}>
                <option value="">{t('societe.form.selectPlaceholder')}</option>
                <option value="S">{t('societe.type.siege')}</option>
                <option value="G">{t('societe.type.groupe')}</option>
                <option value="F">{t('societe.type.filiale')}</option>
              </select>
            </Box>
            <Box className="soc-field soc-field--full" sx={{ mt: 1 }}>
              <label>{t('societe.form.companyLogo')}</label>
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
                      feedback.showWarning(t('societe.logo.selectFirst'));
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
                        feedback.showSuccess(t('societe.logo.uploadSuccess'));
                      }
                    } catch (err) {
                      feedback.showError(err, t('societe.logo.uploadError'));
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
            <Typography className="soc-card-title">{t('societe.card.coordinates')}</Typography>
          </Box>
          <Box className="soc-form-grid soc-form-grid--2">
            <Box className="soc-field soc-field--full">
              <label>{t('societe.form.streetNumber')}</label>
              <input type="text" value={form.socadr} onChange={set('socadr')} />
            </Box>
            <Box className="soc-field">
              <label>{t('societe.form.city')}</label>
              <input type="text" value={form.socville} onChange={set('socville')} placeholder="Casablanca" />
            </Box>
            <Box className="soc-field">
              <label>{t('societe.form.email')}</label>
              <input type="email" value={form.socemail} onChange={set('socemail')} />
            </Box>
            <Box className="soc-field">
              <label>{t('societe.form.phone')}</label>
              <input type="tel" value={form.soctel} onChange={set('soctel')} />
            </Box>
            <Box className="soc-field">
              <label>{t('societe.form.fax')}</label>
              <input type="tel" value={form.socfax} onChange={set('socfax')} />
            </Box>
            <Box className="soc-field soc-field--full">
              <label>{t('societe.form.hrManager')}</label>
              <select value={form.socresp || ''} onChange={set('socresp')}>
                <option value="">{t('societe.form.selectManager')}</option>
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
            <Typography className="soc-card-title">{t('societe.card.fiscal')}</Typography>
          </Box>
          <Box className="soc-form-grid soc-form-grid--4">
            <Box className="soc-field">
              <label>{t('societe.form.taxRegime')}</label>
              <select value={form.socreg} onChange={set('socreg')}>
                <option value={0}>{t('societe.form.regimeNormal')}</option>
                <option value={1}>{t('societe.form.regimeSimplified')}</option>
              </select>
            </Box>
            <Box className="soc-field">
              <label>{t('societe.form.smigValue')}</label>
              <input type="text" value={form.socsmig ?? ''} onChange={set('socsmig')} />
            </Box>
            <Box className="soc-field" style={{ gridColumn: 'span 2' }}>
              <label>{t('societe.form.bankAccount')}</label>
              <input type="text" value={form.socccb} onChange={set('socccb')} />
            </Box>
            <Box className="soc-divider" />
            <Box className="soc-field soc-field--tva">
              <label>{t('societe.form.tvaBase')}</label>
              <input type="text" value={form.soctva} onChange={set('soctva')} />
            </Box>
            <Box className="soc-field soc-field--tva">
              <label>{t('societe.form.tva1')}</label>
              <input type="text" value={form.soctva1} onChange={set('soctva1')} />
            </Box>
            <Box className="soc-field soc-field--tva">
              <label>{t('societe.form.tva2')}</label>
              <input type="text" value={form.soctva2} onChange={set('soctva2')} />
            </Box>
            <Box className="soc-field soc-field--tva">
              <label>{t('societe.form.tva3')}</label>
              <input type="text" value={form.soctva3} onChange={set('soctva3')} />
            </Box>
            <Box className="soc-field soc-field--tva">
              <label>{t('societe.form.tva000')}</label>
              <input type="text" value={form.soctva000} readOnly />
            </Box>
          </Box>
        </Box>
      </Box>

      {feedback.element}
    </Box>
  );
}

export default SocieteModernContent;
