import { useState, useMemo } from 'react';
import { Box, Typography, Button, Snackbar, Alert } from '@mui/material';
import { QueryClient, QueryClientProvider } from 'react-query';
import SaveIcon from '@mui/icons-material/Save';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import BoltIcon from '@mui/icons-material/Bolt';
import SearchIcon from '@mui/icons-material/Search';
import useGetQualifications from '../../../hooks/QualificationHooks/useGetQualifications';
import useAddQualification from '../../../hooks/QualificationHooks/useAddQualification';
import useUpdateQualification from '../../../hooks/QualificationHooks/useUpdateQualification';
import useDeleteQualification from '../../../hooks/QualificationHooks/useDeleteQualification';
import { Qualification as QualificationModel } from '../../../models/Qualification';
import { useAuth } from '../../helper/AuthProvider';
import AccessDenied from '../../helper/AccessDenied';
import '../shared/RefModern.css';

const emptyForm: QualificationModel = { quacod: '', qualib: '', soccod: '', catcod: null };

function QualificationModernContent() {
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

  if (!hasPermission('Données de Base', 'consult')) {
    return <AccessDenied message="Vous n'avez pas le droit de consulter les qualifications." />;
  }

  const filtered = useMemo(() => {
    if (!search) return qualifications;
    const q = search.toLowerCase();
    return qualifications.filter(item => item.quacod.toLowerCase().includes(q) || item.qualib.toLowerCase().includes(q));
  }, [qualifications, search]);

  const handleSubmit = () => {
    if (!form.quacod || !form.qualib) {
      setSnack({ open: true, msg: 'Code et Libellé sont obligatoires.', sev: 'error' });
      return;
    }
    const payload = { ...form, soccod: soccod || '' };
    const onSuccess = () => {
      setSnack({ open: true, msg: isEditMode ? 'Qualification mise à jour.' : 'Qualification ajoutée.', sev: 'success' });
      setForm({ ...emptyForm, soccod: soccod || '' });
      refetch();
    };
    const onError = () => setSnack({ open: true, msg: 'Erreur lors de l\'enregistrement.', sev: 'error' });
    if (isEditMode) { updateQual(payload, { onSuccess, onError }); } else { addQual(payload, { onSuccess, onError }); }
  };

  const handleEdit = (row: QualificationModel) => { setForm(row); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleDelete = (row: QualificationModel) => {
    if (window.confirm('Supprimer cette qualification ?')) {
      deleteQual({ soccod: soccod || '', quacod: row.quacod }, { onSuccess: () => refetch() });
    }
  };

  return (
    <Box className="ref-container">
      <Box className="ref-header">
        <Box>
          <Typography className="ref-header-title">Données de base</Typography>
          <Typography className="ref-header-heading">Gestion des Qualifications</Typography>
          <Typography className="ref-header-sub">Configurer les qualifications disponibles</Typography>
        </Box>
        <Box className="ref-header-actions">
          {isEditMode && <Button className="ref-cancel-btn" variant="outlined" onClick={() => setForm({ ...emptyForm, soccod: soccod || '' })}>Annuler</Button>}
          {((isEditMode && canModify) || (!isEditMode && canAdd)) && (
            <Button className="ref-save-btn" variant="contained" startIcon={<SaveIcon />} onClick={handleSubmit} disabled={isLoading}>
              {isEditMode ? 'Mettre à jour' : 'Enregistrer'}
            </Button>
          )}
        </Box>
      </Box>
      <Box className="ref-body">
        <Box className="ref-card">
          <Box className="ref-card-header">
            <Box className="ref-card-icon"><BoltIcon fontSize="small" /></Box>
            <Typography className="ref-card-title">{isEditMode ? 'Modifier la qualification' : 'Nouvelle qualification'}</Typography>
          </Box>
          <Box className="ref-form-grid ref-form-grid--2">
            <Box className="ref-field">
              <label>Code</label>
              <input type="text" value={form.quacod} onChange={e => setForm(p => ({ ...p, quacod: e.target.value }))} readOnly={isEditMode} placeholder="Q1" />
            </Box>
            <Box className="ref-field">
              <label>Libellé</label>
              <input type="text" value={form.qualib} onChange={e => setForm(p => ({ ...p, qualib: e.target.value }))} placeholder="Ingénieur" />
            </Box>
          </Box>
        </Box>
        <Box className="ref-table-section">
          <Box className="ref-table-header">
            <Typography className="ref-table-title">Liste des Qualifications ({filtered.length})</Typography>
            <Box className="ref-table-search">
              <SearchIcon sx={{ fontSize: 16, color: '#8896a8' }} />
              <input type="text" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
            </Box>
          </Box>
          <Box className="ref-table-container">
            <table className="ref-table">
              <thead><tr><th style={{ width: 80 }}>Actions</th><th>Code</th><th>Libellé</th></tr></thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={3} className="ref-empty">Aucune qualification trouvée.</td></tr>
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
          <Box className="ref-table-footer"><span>Affichage de {filtered.length} qualifications</span></Box>
        </Box>
      </Box>
      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack(s => ({ ...s, open: false }))}>
        <Alert severity={snack.sev} onClose={() => setSnack(s => ({ ...s, open: false }))} sx={{ borderRadius: '10px' }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}

export default function QualificationModern() {
  const qc = new QueryClient();
  return <QueryClientProvider client={qc}><QualificationModernContent /></QueryClientProvider>;
}