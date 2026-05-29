import { useState, useMemo } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useFeedbackSnackbar } from '../../helper/FeedbackSnackbar';
import SaveIcon from '@mui/icons-material/Save';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import WorkIcon from '@mui/icons-material/Work';
import SearchIcon from '@mui/icons-material/Search';
import { useTranslation } from 'react-i18next';
import apiInstance from '../../API/apiInstance';
import { FonctionModel } from '../../../models/Fonction';
import useGetFonctions from '../../../hooks/fonctionHooks/useGetFonctions';
import { useAuth } from '../../helper/AuthProvider';
import AccessDenied from '../../helper/AccessDenied';
import ExcelImportButton from '../shared/ExcelImportButton';
import '../shared/RefModern.css';

const emptyForm: FonctionModel = { foncod: '', soccod: '', fonlib: '', fontype: '', fonpqual: '', fonpchoix: '' };

function FonctionModernContent() {
  const { t } = useTranslation();
  const { soccod, hasPermission } = useAuth();
  const [form, setForm] = useState<FonctionModel>({ ...emptyForm, soccod: soccod || '' });
  const feedback = useFeedbackSnackbar();
  const [search, setSearch] = useState('');

  const { data: fonctions = [], refetch, isLoading } = useGetFonctions();
  const isEditMode = form.foncod !== '' && fonctions.some(f => f.foncod === form.foncod);

  const canAdd = hasPermission('Données de Base', 'add');
  const canModify = hasPermission('Données de Base', 'modify');
  const canDelete = hasPermission('Données de Base', 'delete');

  if (!hasPermission('Données de Base', 'consult')) {
    return <AccessDenied message={t('donneeBase.fonction.noConsultRight')} />;
  }

  const filtered = useMemo(() => {
    if (!search) return fonctions;
    const q = search.toLowerCase();
    return fonctions.filter(f => f.foncod.toLowerCase().includes(q) || f.fonlib.toLowerCase().includes(q));
  }, [fonctions, search]);

  const handleSubmit = async () => {
    if (!form.fonlib) {
      feedback.showError(t('donneeBase.common.labelRequired'));
      return;
    }
    try {
      const payload = isEditMode
        ? { ...form, soccod: soccod || '' }
        : { ...form, foncod: '', soccod: soccod || '' };
      if (isEditMode) {
        // Le contrôleur attend `/Fonctions/{soccod}/{foncod}` (verrouillage tenant +
        // identification de la ressource). PUT sur `/Fonctions` retournait 405.
        await apiInstance.put(`/Fonctions/${payload.soccod}/${payload.foncod}`, payload);
      } else {
        await apiInstance.post('/Fonctions', payload);
      }
      feedback.showSuccess(isEditMode ? t('donneeBase.fonction.msgUpdated') : t('donneeBase.fonction.msgAdded'));
      setForm({ ...emptyForm, soccod: soccod || '' });
      refetch();
    } catch (err) {
      feedback.showError(err, t('donneeBase.common.saveError'));
    }
  };

  const handleEdit = (row: FonctionModel) => { setForm(row); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleDelete = async (row: FonctionModel) => {
    if (window.confirm(t('donneeBase.fonction.deleteConfirm'))) {
      try { await apiInstance.delete(`/Fonctions/${row.soccod || soccod}/${row.foncod}`); refetch(); } catch { console.error('Erreur'); }
    }
  };

  return (
    <Box className="ref-container">
      <Box className="ref-header">
        <Box>
          <Typography className="ref-header-title">{t('donneeBase.breadcrumb')}</Typography>
          <Typography className="ref-header-heading">{t('donneeBase.fonction.heading')}</Typography>
          <Typography className="ref-header-sub">{t('donneeBase.fonction.subtitle')}</Typography>
        </Box>
        <Box className="ref-header-actions">
          {!isEditMode && canAdd && (
            <ExcelImportButton
              endpoint="/BulkImport/fonctions"
              extraBody={{ Soccod: soccod }}
              columnMap={{ Fonlib: ['fonlib', 'libelle', 'libellé', 'fonction', 'nom', 'libellé fonction'], Fontype: ['fontype', 'type'] }}
              labelMap={{ Fonlib: 'Libellé fonction', Fontype: 'Type' }}
              templateExample={{ Fonlib: 'Opérateur de production', Fontype: '' }}
              onImported={() => refetch()}
              label={t('donneeBase.fonction.importExcel')}
            />
          )}
          {isEditMode && <Button className="ref-cancel-btn" variant="outlined" onClick={() => setForm({ ...emptyForm, soccod: soccod || '' })}>{t('donneeBase.common.cancel')}</Button>}
          {((isEditMode && canModify) || (!isEditMode && canAdd)) && (
            <Button className="ref-save-btn" variant="contained" startIcon={<SaveIcon />} onClick={handleSubmit} disabled={isLoading}>
              {isEditMode ? t('donneeBase.common.update') : t('donneeBase.common.save')}
            </Button>
          )}
        </Box>
      </Box>
      <Box className="ref-body">
        <Box className="ref-card">
          <Box className="ref-card-header">
            <Box className="ref-card-icon"><WorkIcon fontSize="small" /></Box>
            <Typography className="ref-card-title">{isEditMode ? t('donneeBase.fonction.editTitle') : t('donneeBase.fonction.newTitle')}</Typography>
          </Box>
          <Box className="ref-form-grid ref-form-grid--2">
            <Box className="ref-field">
              <label>{t('donneeBase.common.code')} {!isEditMode && <span style={{ color: '#8896a8', fontWeight: 400 }}>{t('donneeBase.pays.autoGenerated')}</span>}</label>
              <input
                type="text"
                value={isEditMode ? form.foncod : ''}
                readOnly
                placeholder={isEditMode ? '' : t('donneeBase.pays.autoPlaceholder')}
                style={{ background: '#f5f7fa', color: '#8896a8' }}
              />
            </Box>
            <Box className="ref-field">
              <label>{t('donneeBase.common.label')}</label>
              <input type="text" value={form.fonlib} onChange={e => setForm(p => ({ ...p, fonlib: e.target.value }))} placeholder={t('donneeBase.fonction.labelPlaceholder')} />
            </Box>
            <Box className="ref-field">
              <label>{t('donneeBase.fonction.typeLabel')}</label>
              <select value={form.fontype || ''} onChange={e => setForm(p => ({ ...p, fontype: e.target.value }))}>
                <option value="">—</option>
                <option value="A">{t('donneeBase.fonction.type.admin')}</option>
                <option value="T">{t('donneeBase.fonction.type.technical')}</option>
                <option value="O">{t('donneeBase.fonction.type.operational')}</option>
              </select>
            </Box>
          </Box>
        </Box>
        <Box className="ref-table-section">
          <Box className="ref-table-header">
            <Typography className="ref-table-title">{t('donneeBase.fonction.tableTitle', { count: filtered.length })}</Typography>
            <Box className="ref-table-search">
              <SearchIcon sx={{ fontSize: 16, color: '#8896a8' }} />
              <input type="text" placeholder={t('donneeBase.common.search')} value={search} onChange={e => setSearch(e.target.value)} />
            </Box>
          </Box>
          <Box className="ref-table-container">
            <table className="ref-table">
              <thead><tr><th style={{ width: 80 }}>{t('donneeBase.common.actions')}</th><th>{t('donneeBase.common.code')}</th><th>{t('donneeBase.common.label')}</th><th>{t('donneeBase.fonction.typeLabel')}</th></tr></thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={4} className="ref-empty">{t('donneeBase.fonction.noResults')}</td></tr>
                ) : filtered.map(f => (
                  <tr key={f.foncod}>
                    <td><Box sx={{ display: 'flex', gap: '4px' }}>
                      {canModify && (
                        <button className="ref-action-btn ref-action-btn--edit" onClick={() => handleEdit(f)}><EditIcon sx={{ fontSize: 16 }} /></button>
                      )}
                      {canDelete && (
                        <button className="ref-action-btn ref-action-btn--delete" onClick={() => handleDelete(f)}><DeleteOutlineIcon sx={{ fontSize: 16 }} /></button>
                      )}
                      {!canModify && !canDelete && <Typography variant="caption">—</Typography>}
                    </Box></td>
                    <td style={{ fontWeight: 700, color: '#0f172a' }}>{f.foncod}</td>
                    <td>{f.fonlib}</td>
                    <td><span className="ref-badge ref-badge--blue">{f.fontype || '—'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
          <Box className="ref-table-footer"><span>{t('donneeBase.fonction.footerCount', { count: filtered.length })}</span></Box>
        </Box>
      </Box>
      {feedback.element}
    </Box>
  );
}

export default function FonctionModern() {
  return <FonctionModernContent />;
}