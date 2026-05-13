import { useState, useMemo } from 'react';
import { Box, Typography, Button, Snackbar, Alert, CircularProgress } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import SearchIcon from '@mui/icons-material/Search';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import { useTranslation } from 'react-i18next';
import apiInstance from '../../API/apiInstance';
import { VilleModel } from '../../../models/Ville';
import { useAuth } from '../../helper/AuthProvider';
import useGetVilles from '../../../hooks/villeHooks/useGetVilles';
import AccessDenied from '../../helper/AccessDenied';
import '../shared/RefModern.css';

const emptyForm: VilleModel = { vilcod: '', villib: '' };

function VilleModernContent() {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const [form, setForm] = useState<VilleModel>(emptyForm);
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' as any });
  const [search, setSearch] = useState('');
  const [importing, setImporting] = useState(false);

  const { data: villes = [], refetch, isLoading } = useGetVilles();
  const isEditMode = form.vilcod !== '' && villes.some(v => v.vilcod === form.vilcod);

  const canAdd = hasPermission('Données de Base', 'add');
  const canModify = hasPermission('Données de Base', 'modify');
  const canDelete = hasPermission('Données de Base', 'delete');

  if (!hasPermission('Données de Base', 'consult')) {
    return <AccessDenied message={t('donneeBase.ville.noConsultRight')} />;
  }

  const filtered = useMemo(() => {
    if (!search) return villes;
    const q = search.toLowerCase();
    return villes.filter(v => v.vilcod.toLowerCase().includes(q) || v.villib.toLowerCase().includes(q));
  }, [villes, search]);

  const handleSubmit = async () => {
    if (!form.villib) {
      setSnack({ open: true, msg: t('donneeBase.common.labelRequired'), sev: 'error' });
      return;
    }
    try {
      if (isEditMode) {
        await apiInstance.put(`/Villes/${form.vilcod}`, { vilcod: form.vilcod, villib: form.villib });
      } else {
        await apiInstance.post('/Villes', { vilcod: '', villib: form.villib });
      }
      setSnack({ open: true, msg: isEditMode ? t('donneeBase.ville.msgUpdated') : t('donneeBase.ville.msgAdded'), sev: 'success' });
      setForm(emptyForm);
      refetch();
    } catch {
      setSnack({ open: true, msg: t('donneeBase.common.saveError'), sev: 'error' });
    }
  };

  const handleImportFrance = async () => {
    if (!window.confirm(t('donneeBase.ville.importFranceConfirm'))) return;
    setImporting(true);
    try {
      const { data } = await apiInstance.post('/Villes/import-france');
      setSnack({
        open: true,
        msg: t('donneeBase.ville.importSuccess', { inserted: data.inserted, skipped: data.skipped }),
        sev: 'success'
      });
      refetch();
    } catch (e: any) {
      setSnack({ open: true, msg: e?.response?.data?.message || t('donneeBase.ville.importError'), sev: 'error' });
    } finally {
      setImporting(false);
    }
  };

  const handleEdit = (row: VilleModel) => { setForm(row); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleDelete = async (row: VilleModel) => {
    if (window.confirm(t('donneeBase.ville.deleteConfirm'))) {
      try { await apiInstance.delete(`/Villes/${row.vilcod}`); refetch(); } catch { console.error('Erreur suppression'); }
    }
  };

  return (
    <Box className="ref-container">
      <Box className="ref-header">
        <Box>
          <Typography className="ref-header-title">{t('donneeBase.breadcrumb')}</Typography>
          <Typography className="ref-header-heading">{t('donneeBase.ville.heading')}</Typography>
          <Typography className="ref-header-sub">{t('donneeBase.ville.subtitle')}</Typography>
        </Box>
        <Box className="ref-header-actions">
          {!isEditMode && canAdd && (
            <Button
              variant="outlined"
              startIcon={importing ? <CircularProgress size={16} /> : <CloudDownloadIcon />}
              onClick={handleImportFrance}
              disabled={importing}
              sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600 }}
            >
              {importing ? t('donneeBase.ville.importing') : t('donneeBase.ville.importFranceTitle')}
            </Button>
          )}
          {isEditMode && <Button className="ref-cancel-btn" variant="outlined" onClick={() => setForm(emptyForm)}>{t('donneeBase.common.cancel')}</Button>}
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
            <Box className="ref-card-icon"><LocationCityIcon fontSize="small" /></Box>
            <Typography className="ref-card-title">{isEditMode ? t('donneeBase.ville.editTitle') : t('donneeBase.ville.newTitle')}</Typography>
          </Box>
          <Box className="ref-form-grid ref-form-grid--2">
            <Box className="ref-field">
              <label>{t('donneeBase.ville.codeLabel')} {!isEditMode && <span style={{ color: '#8896a8', fontWeight: 400 }}>{t('donneeBase.ville.autoGenerated')}</span>}</label>
              <input
                type="text"
                value={isEditMode ? form.vilcod : ''}
                readOnly
                placeholder={isEditMode ? '' : t('donneeBase.pays.autoPlaceholder')}
                style={{ background: '#f5f7fa', color: '#8896a8' }}
              />
            </Box>
            <Box className="ref-field">
              <label>{t('donneeBase.common.label')}</label>
              <input type="text" value={form.villib} onChange={e => setForm(p => ({ ...p, villib: e.target.value }))} placeholder={t('donneeBase.ville.labelPlaceholder')} />
            </Box>
          </Box>
        </Box>
        <Box className="ref-table-section">
          <Box className="ref-table-header">
            <Typography className="ref-table-title">{t('donneeBase.ville.tableTitle', { count: filtered.length })}</Typography>
            <Box className="ref-table-search">
              <SearchIcon sx={{ fontSize: 16, color: '#8896a8' }} />
              <input type="text" placeholder={t('donneeBase.common.search')} value={search} onChange={e => setSearch(e.target.value)} />
            </Box>
          </Box>
          <Box className="ref-table-container">
            <table className="ref-table">
              <thead><tr><th style={{ width: 80 }}>{t('donneeBase.common.actions')}</th><th>{t('donneeBase.common.code')}</th><th>{t('donneeBase.common.label')}</th></tr></thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={3} className="ref-empty">{t('donneeBase.ville.noResults')}</td></tr>
                ) : filtered.map(v => (
                  <tr key={v.vilcod}>
                    <td><Box sx={{ display: 'flex', gap: '4px' }}>
                      {canModify && (
                        <button className="ref-action-btn ref-action-btn--edit" onClick={() => handleEdit(v)}><EditIcon sx={{ fontSize: 16 }} /></button>
                      )}
                      {canDelete && (
                        <button className="ref-action-btn ref-action-btn--delete" onClick={() => handleDelete(v)}><DeleteOutlineIcon sx={{ fontSize: 16 }} /></button>
                      )}
                      {!canModify && !canDelete && <Typography variant="caption">—</Typography>}
                    </Box></td>
                    <td style={{ fontWeight: 700, color: '#0f172a' }}>{v.vilcod}</td>
                    <td>{v.villib}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
          <Box className="ref-table-footer"><span>{t('donneeBase.ville.footerCount', { count: filtered.length })}</span></Box>
        </Box>
      </Box>
      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack(s => ({ ...s, open: false }))}>
        <Alert severity={snack.sev} onClose={() => setSnack(s => ({ ...s, open: false }))} sx={{ borderRadius: '10px' }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}

export default function VilleModern() {
  return <VilleModernContent />;
}