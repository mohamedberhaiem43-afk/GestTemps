import { useState, useMemo } from 'react';
import { Box, Typography, Button, Snackbar, Alert } from '@mui/material';
import { QueryClient, QueryClientProvider } from 'react-query';
import SaveIcon from '@mui/icons-material/Save';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import WorkIcon from '@mui/icons-material/Work';
import SearchIcon from '@mui/icons-material/Search';
import apiInstance from '../../API/apiInstance';
import { FonctionModel } from '../../../models/Fonction';
import useGetFonctions from '../../../hooks/fonctionHooks/useGetFonctions';
import { useAuth } from '../../helper/AuthProvider';
import AccessDenied from '../../helper/AccessDenied';
import '../shared/RefModern.css';

const emptyForm: FonctionModel = { foncod: '', soccod: '', fonlib: '', fontype: '', fonpqual: '', fonpchoix: '' };

function FonctionModernContent() {
  const { soccod, hasPermission } = useAuth();
  const [form, setForm] = useState<FonctionModel>({ ...emptyForm, soccod: soccod || '' });
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' as any });
  const [search, setSearch] = useState('');

  const { data: fonctions = [], refetch, isLoading } = useGetFonctions();
  const isEditMode = form.foncod !== '' && fonctions.some(f => f.foncod === form.foncod);

  const canAdd = hasPermission('Données de Base', 'add');
  const canModify = hasPermission('Données de Base', 'modify');
  const canDelete = hasPermission('Données de Base', 'delete');

  if (!hasPermission('Données de Base', 'consult')) {
    return <AccessDenied message="Vous n'avez pas le droit de consulter les fonctions." />;
  }

  const filtered = useMemo(() => {
    if (!search) return fonctions;
    const q = search.toLowerCase();
    return fonctions.filter(f => f.foncod.toLowerCase().includes(q) || f.fonlib.toLowerCase().includes(q));
  }, [fonctions, search]);

  const handleSubmit = async () => {
    if (!form.foncod || !form.fonlib) {
      setSnack({ open: true, msg: 'Code et Libellé sont obligatoires.', sev: 'error' });
      return;
    }
    try {
      const payload = { ...form, soccod: soccod || '' };
      if (isEditMode) {
        await apiInstance.put('/Fonctions', payload);
      } else {
        await apiInstance.post('/Fonctions', payload);
      }
      setSnack({ open: true, msg: isEditMode ? 'Fonction mise à jour.' : 'Fonction ajoutée.', sev: 'success' });
      setForm({ ...emptyForm, soccod: soccod || '' });
      refetch();
    } catch {
      setSnack({ open: true, msg: 'Erreur lors de l\'enregistrement.', sev: 'error' });
    }
  };

  const handleEdit = (row: FonctionModel) => { setForm(row); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleDelete = async (row: FonctionModel) => {
    if (window.confirm('Supprimer cette fonction ?')) {
      try { await apiInstance.delete(`/Fonctions/${row.foncod}`); refetch(); } catch { console.error('Erreur'); }
    }
  };

  return (
    <Box className="ref-container">
      <Box className="ref-header">
        <Box>
          <Typography className="ref-header-title">Données de base</Typography>
          <Typography className="ref-header-heading">Gestion des Fonctions</Typography>
          <Typography className="ref-header-sub">Configurer les fonctions disponibles</Typography>
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
            <Box className="ref-card-icon"><WorkIcon fontSize="small" /></Box>
            <Typography className="ref-card-title">{isEditMode ? 'Modifier la fonction' : 'Nouvelle fonction'}</Typography>
          </Box>
          <Box className="ref-form-grid ref-form-grid--2">
            <Box className="ref-field">
              <label>Code</label>
              <input type="text" value={form.foncod} onChange={e => setForm(p => ({ ...p, foncod: e.target.value }))} readOnly={isEditMode} placeholder="DIR" />
            </Box>
            <Box className="ref-field">
              <label>Libellé</label>
              <input type="text" value={form.fonlib} onChange={e => setForm(p => ({ ...p, fonlib: e.target.value }))} placeholder="Directeur" />
            </Box>
            <Box className="ref-field">
              <label>Type</label>
              <select value={form.fontype || ''} onChange={e => setForm(p => ({ ...p, fontype: e.target.value }))}>
                <option value="">—</option>
                <option value="A">Administration</option>
                <option value="T">Technique</option>
                <option value="O">Opérationnel</option>
              </select>
            </Box>
          </Box>
        </Box>
        <Box className="ref-table-section">
          <Box className="ref-table-header">
            <Typography className="ref-table-title">Liste des Fonctions ({filtered.length})</Typography>
            <Box className="ref-table-search">
              <SearchIcon sx={{ fontSize: 16, color: '#8896a8' }} />
              <input type="text" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
            </Box>
          </Box>
          <table className="ref-table">
            <thead><tr><th style={{ width: 80 }}>Actions</th><th>Code</th><th>Libellé</th><th>Type</th></tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={4} className="ref-empty">Aucune fonction trouvée.</td></tr>
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
          <Box className="ref-table-footer"><span>Affichage de {filtered.length} fonctions</span></Box>
        </Box>
      </Box>
      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack(s => ({ ...s, open: false }))}>
        <Alert severity={snack.sev} onClose={() => setSnack(s => ({ ...s, open: false }))} sx={{ borderRadius: '10px' }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}

export default function FonctionModern() {
  const qc = new QueryClient();
  return <QueryClientProvider client={qc}><FonctionModernContent /></QueryClientProvider>;
}