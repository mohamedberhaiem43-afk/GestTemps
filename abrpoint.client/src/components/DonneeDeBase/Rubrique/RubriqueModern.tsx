import { useState, useMemo } from 'react';
import { Box, Typography, Button, Snackbar, Alert } from '@mui/material';
import { QueryClient, QueryClientProvider } from 'react-query';
import SaveIcon from '@mui/icons-material/Save';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import SearchIcon from '@mui/icons-material/Search';
import { useTranslation } from 'react-i18next';
import useGetRubriques from '../../../hooks/rubriqueHooks/useGetRubriques';
import useAddRubrique from '../../../hooks/rubriqueHooks/useAddRubrique';
import useUpdateRubrique from '../../../hooks/rubriqueHooks/useUpdateRubrique';
import useDeleteRubrique from '../../../hooks/rubriqueHooks/useDeleteRubrique';
import { Rubrique } from '../../../models/Rubrique';
import { useAuth } from '../../helper/AuthProvider';
import AccessDenied from '../../helper/AccessDenied';
import '../shared/RefModern.css';

const emptyForm: Rubrique = { rubcod: '', soccod: '', rubunite: '', rublib: '', rubtaux: 0, rubregime: '', vartype: '' };

function RubriqueModernContent() {
  const { t } = useTranslation();
  const { soccod, hasPermission } = useAuth();
  const [form, setForm] = useState<Rubrique>({ ...emptyForm, soccod: soccod || '' });
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' as any });
  const [search, setSearch] = useState('');

  const { data: rubriques = [], refetch, isLoading } = useGetRubriques();
  const { mutate: addRub } = useAddRubrique();
  const { mutate: updateRub } = useUpdateRubrique();
  const { mutate: deleteRub } = useDeleteRubrique();

  const isEditMode = form.rubcod !== '' && rubriques.some(r => r.rubcod === form.rubcod);

  const canAdd = hasPermission('Données de Base', 'add');
  const canModify = hasPermission('Données de Base', 'modify');
  const canDelete = hasPermission('Données de Base', 'delete');

  if (!hasPermission('Données de Base', 'consult')) {
    return <AccessDenied message={t('donneeBase.rubrique.noConsultRight')} />;
  }

  const filtered = useMemo(() => {
    if (!search) return rubriques;
    const q = search.toLowerCase();
    return rubriques.filter(r => r.rubcod.toLowerCase().includes(q) || r.rublib.toLowerCase().includes(q));
  }, [rubriques, search]);

  const handleSubmit = () => {
    if (!form.rubcod || !form.rublib) {
      setSnack({ open: true, msg: t('donneeBase.rubrique.codeRequired'), sev: 'error' });
      return;
    }
    const payload = { ...form, soccod: soccod || '' };
    const onSuccess = () => {
      setSnack({ open: true, msg: isEditMode ? t('donneeBase.rubrique.msgUpdated') : t('donneeBase.rubrique.msgAdded'), sev: 'success' });
      setForm({ ...emptyForm, soccod: soccod || '' });
      refetch();
    };
    const onError = () => setSnack({ open: true, msg: t('donneeBase.common.saveError'), sev: 'error' });
    if (isEditMode) { updateRub(payload, { onSuccess, onError }); } else { addRub(payload, { onSuccess, onError }); }
  };

  const handleEdit = (row: Rubrique) => { setForm(row); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleDelete = (row: Rubrique) => {
    if (window.confirm(t('donneeBase.rubrique.deleteConfirm'))) {
      deleteRub({ rubcod: row.rubcod }, { onSuccess: () => refetch() });
    }
  };

  return (
    <Box className="ref-container">
      <Box className="ref-header">
        <Box>
          <Typography className="ref-header-title">{t('donneeBase.breadcrumb')}</Typography>
          <Typography className="ref-header-heading">{t('donneeBase.rubrique.heading')}</Typography>
          <Typography className="ref-header-sub">{t('donneeBase.rubrique.subtitle')}</Typography>
        </Box>
        <Box className="ref-header-actions">
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
            <Box className="ref-card-icon"><ReceiptLongIcon fontSize="small" /></Box>
            <Typography className="ref-card-title">{isEditMode ? t('donneeBase.rubrique.editTitle') : t('donneeBase.rubrique.newTitle')}</Typography>
          </Box>
          <Box className="ref-form-grid ref-form-grid--3">
            <Box className="ref-field">
              <label>{t('donneeBase.common.code')}</label>
              <input type="text" value={form.rubcod} onChange={e => setForm(p => ({ ...p, rubcod: e.target.value }))} readOnly={isEditMode} placeholder={t('donneeBase.rubrique.codePlaceholder')} />
            </Box>
            <Box className="ref-field">
              <label>{t('donneeBase.common.label')}</label>
              <input type="text" value={form.rublib} onChange={e => setForm(p => ({ ...p, rublib: e.target.value }))} placeholder={t('donneeBase.rubrique.labelPlaceholder')} />
            </Box>
            <Box className="ref-field">
              <label>{t('donneeBase.rubrique.unitLabel')}</label>
              <select value={form.rubunite || ''} onChange={e => setForm(p => ({ ...p, rubunite: e.target.value }))}>
                <option value="">—</option>
                <option value="H">{t('donneeBase.rubrique.unit.hour')}</option>
                <option value="J">{t('donneeBase.rubrique.unit.day')}</option>
                <option value="M">{t('donneeBase.rubrique.unit.month')}</option>
                <option value="F">{t('donneeBase.rubrique.unit.fixed')}</option>
              </select>
            </Box>
            <Box className="ref-field">
              <label>{t('donneeBase.rubrique.typeLabel')}</label>
              <select value={form.vartype || ''} onChange={e => setForm(p => ({ ...p, vartype: e.target.value }))}>
                <option value="">—</option>
                <option value="G">{t('donneeBase.rubrique.type.gain')}</option>
                <option value="R">{t('donneeBase.rubrique.type.deduction')}</option>
                <option value="C">{t('donneeBase.rubrique.type.contribution')}</option>
              </select>
            </Box>
          </Box>
        </Box>
        <Box className="ref-table-section">
          <Box className="ref-table-header">
            <Typography className="ref-table-title">{t('donneeBase.rubrique.tableTitle', { count: filtered.length })}</Typography>
            <Box className="ref-table-search">
              <SearchIcon sx={{ fontSize: 16, color: '#8896a8' }} />
              <input type="text" placeholder={t('donneeBase.common.search')} value={search} onChange={e => setSearch(e.target.value)} />
            </Box>
          </Box>
          <table className="ref-table">
            <thead><tr><th style={{ width: 80 }}>{t('donneeBase.common.actions')}</th><th>{t('donneeBase.common.code')}</th><th>{t('donneeBase.common.label')}</th><th>{t('donneeBase.rubrique.unitLabel')}</th><th>{t('donneeBase.rubrique.typeLabel')}</th></tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="ref-empty">{t('donneeBase.rubrique.noResults')}</td></tr>
              ) : filtered.map(r => (
                <tr key={r.rubcod}>
                  <td><Box sx={{ display: 'flex', gap: '4px' }}>
                    {canModify && (
                      <button className="ref-action-btn ref-action-btn--edit" onClick={() => handleEdit(r)}><EditIcon sx={{ fontSize: 16 }} /></button>
                    )}
                    {canDelete && (
                      <button className="ref-action-btn ref-action-btn--delete" onClick={() => handleDelete(r)}><DeleteOutlineIcon sx={{ fontSize: 16 }} /></button>
                    )}
                    {!canModify && !canDelete && <Typography variant="caption">—</Typography>}
                  </Box></td>
                  <td style={{ fontWeight: 700, color: '#0f172a' }}>{r.rubcod}</td>
                  <td>{r.rublib}</td>
                  <td><span className="ref-badge ref-badge--gray">{r.rubunite || '—'}</span></td>
                  <td><span className={`ref-badge ${r.vartype === 'G' ? 'ref-badge--green' : r.vartype === 'R' ? 'ref-badge--orange' : 'ref-badge--blue'}`}>{r.vartype || '—'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <Box className="ref-table-footer"><span>{t('donneeBase.rubrique.footerCount', { count: filtered.length })}</span></Box>
        </Box>
      </Box>
      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack(s => ({ ...s, open: false }))}>
        <Alert severity={snack.sev} onClose={() => setSnack(s => ({ ...s, open: false }))} sx={{ borderRadius: '10px' }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}

export default function RubriqueModern() {
  const qc = new QueryClient();
  return <QueryClientProvider client={qc}><RubriqueModernContent /></QueryClientProvider>;
}