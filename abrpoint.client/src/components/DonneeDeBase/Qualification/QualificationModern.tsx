import { useState, useMemo, useEffect } from 'react';
import { Box, Typography, Button, Snackbar, Alert } from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import BoltIcon from '@mui/icons-material/Bolt';
import SearchIcon from '@mui/icons-material/Search';
import { useTranslation } from 'react-i18next';
import useGetQualifications from '../../../hooks/QualificationHooks/useGetQualifications';
import useAddQualification from '../../../hooks/QualificationHooks/useAddQualification';
import useUpdateQualification from '../../../hooks/QualificationHooks/useUpdateQualification';
import useDeleteQualification from '../../../hooks/QualificationHooks/useDeleteQualification';
import { Qualification as QualificationModel } from '../../../models/Qualification';
import { useAuth } from '../../helper/AuthProvider';
import AccessDenied from '../../helper/AccessDenied';
import apiInstance from '../../API/apiInstance';
import '../shared/RefModern.css';

const emptyForm: QualificationModel = { quacod: '', qualib: '', soccod: '', catcod: null };

function QualificationModernContent() {
  const { t } = useTranslation();
  const { soccod, hasPermission } = useAuth();
  const [form, setForm] = useState<QualificationModel>({ ...emptyForm, soccod: soccod || '' });
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' as any });
  const [search, setSearch] = useState('');

  const { data: qualifications = [], refetch, isLoading } = useGetQualifications();
  const { mutate: addQual } = useAddQualification();
  const { mutate: updateQual } = useUpdateQualification();
  const { mutate: deleteQual } = useDeleteQualification();

  const isEditMode = form.quacod !== '' && qualifications.some(q => q.quacod === form.quacod);

  const canAdd = hasPermission('Données de Base', 'add');
  const canModify = hasPermission('Données de Base', 'modify');
  const canDelete = hasPermission('Données de Base', 'delete');

  // Pré-charge le prochain code auto-généré quand le formulaire est en création.
  useEffect(() => {
    if (isEditMode || !soccod || form.quacod) return;
    let cancelled = false;
    apiInstance
      .get(`/Qualifs/next-code/${soccod}`)
      .then(res => { if (!cancelled) setForm(p => (p.quacod ? p : { ...p, quacod: res.data?.code ?? '' })); })
      .catch(() => { /* silencieux : le backend auto-génère aussi à la POST */ });
    return () => { cancelled = true; };
  }, [soccod, isEditMode, form.quacod]);

  if (!hasPermission('Données de Base', 'consult')) {
    return <AccessDenied message={t('donneeBase.qualification.noConsultRight')} />;
  }

  const filtered = useMemo(() => {
    if (!search) return qualifications;
    const q = search.toLowerCase();
    return qualifications.filter(item => item.quacod.toLowerCase().includes(q) || item.qualib.toLowerCase().includes(q));
  }, [qualifications, search]);

  const handleSubmit = () => {
    if (!form.qualib) {
      setSnack({ open: true, msg: t('donneeBase.common.labelRequired'), sev: 'error' });
      return;
    }
    const payload = { ...form, soccod: soccod || '' };
    const onSuccess = () => {
      setSnack({ open: true, msg: isEditMode ? t('donneeBase.qualification.msgUpdated') : t('donneeBase.qualification.msgAdded'), sev: 'success' });
      setForm({ ...emptyForm, soccod: soccod || '' });
      refetch();
    };
    const onError = () => setSnack({ open: true, msg: t('donneeBase.common.saveError'), sev: 'error' });
    if (isEditMode) { updateQual(payload, { onSuccess, onError }); } else { addQual(payload, { onSuccess, onError }); }
  };

  const handleEdit = (row: QualificationModel) => { setForm(row); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleDelete = (row: QualificationModel) => {
    if (window.confirm(t('donneeBase.qualification.deleteConfirm'))) {
      deleteQual({ soccod: soccod || '', quacod: row.quacod }, { onSuccess: () => refetch() });
    }
  };

  return (
    <Box className="ref-container">
      <Box className="ref-header">
        <Box>
          <Typography className="ref-header-title">{t('donneeBase.breadcrumb')}</Typography>
          <Typography className="ref-header-heading">{t('donneeBase.qualification.heading')}</Typography>
          <Typography className="ref-header-sub">{t('donneeBase.qualification.subtitle')}</Typography>
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
            <Box className="ref-card-icon"><BoltIcon fontSize="small" /></Box>
            <Typography className="ref-card-title">{isEditMode ? t('donneeBase.qualification.editTitle') : t('donneeBase.qualification.newTitle')}</Typography>
          </Box>
          <Box className="ref-form-grid ref-form-grid--2">
            <Box className="ref-field">
              <label>{t('donneeBase.common.code')}</label>
              <input type="text" value={form.quacod} readOnly placeholder={t('donneeBase.qualification.autoPlaceholder')} />
            </Box>
            <Box className="ref-field">
              <label>{t('donneeBase.common.label')}</label>
              <input type="text" value={form.qualib} onChange={e => setForm(p => ({ ...p, qualib: e.target.value }))} placeholder={t('donneeBase.qualification.labelPlaceholder')} />
            </Box>
          </Box>
        </Box>
        <Box className="ref-table-section">
          <Box className="ref-table-header">
            <Typography className="ref-table-title">{t('donneeBase.qualification.tableTitle', { count: filtered.length })}</Typography>
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
                  <tr><td colSpan={3} className="ref-empty">{t('donneeBase.qualification.noResults')}</td></tr>
                ) : filtered.map(q => (
                  <tr key={q.quacod}>
                    <td><Box sx={{ display: 'flex', gap: '4px' }}>
                      {canModify && (
                        <button className="ref-action-btn ref-action-btn--edit" onClick={() => handleEdit(q)}><EditIcon sx={{ fontSize: 16 }} /></button>
                      )}
                      {canDelete && (
                        <button className="ref-action-btn ref-action-btn--delete" onClick={() => handleDelete(q)}><DeleteOutlineIcon sx={{ fontSize: 16 }} /></button>
                      )}
                      {!canModify && !canDelete && <Typography variant="caption">—</Typography>}
                    </Box></td>
                    <td style={{ fontWeight: 700, color: '#0f172a' }}>{q.quacod}</td>
                    <td>{q.qualib}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
          <Box className="ref-table-footer"><span>{t('donneeBase.qualification.footerCount', { count: filtered.length })}</span></Box>
        </Box>
      </Box>
      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack(s => ({ ...s, open: false }))}>
        <Alert severity={snack.sev} onClose={() => setSnack(s => ({ ...s, open: false }))} sx={{ borderRadius: '10px' }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}

export default function QualificationModern() {
  return <QualificationModernContent />;
}