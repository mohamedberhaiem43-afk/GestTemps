import { useState, useMemo } from 'react';
import { Box, Typography, Button, Snackbar, Alert } from '@mui/material';
import { QueryClient, QueryClientProvider } from 'react-query';
import SaveIcon from '@mui/icons-material/Save';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PublicIcon from '@mui/icons-material/Public';
import SearchIcon from '@mui/icons-material/Search';
import apiInstance from '../../API/apiInstance';
import { PaysModel } from '../../../models/Pays';
import { useAuth } from '../../helper/AuthProvider';
import AccessDenied from '../../helper/AccessDenied';
import '../shared/RefModern.css';
import useGetPays from '../../../hooks/paysHooks/useGetPays';

const emptyForm: PaysModel = { natcod: '', natlib: '' };

function PaysModernContent() {
  const { hasPermission } = useAuth();
  const [form, setForm] = useState<PaysModel>(emptyForm);
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' as any });
  const [search, setSearch] = useState('');

  const { data: nations = [], refetch, isLoading } = useGetPays();
  const isEditMode = form.natcod !== '' && nations.some(n => n.natcod === form.natcod);

  const canAdd = hasPermission('Données de Base', 'add');
  const canModify = hasPermission('Données de Base', 'modify');
  const canDelete = hasPermission('Données de Base', 'delete');

  const filtered = useMemo(() => {
    if (!search) return nations;
    const q = search.toLowerCase();
    return nations.filter(n => n.natcod.toLowerCase().includes(q) || n.natlib.toLowerCase().includes(q));
  }, [nations, search]);

  if (!hasPermission('Données de Base', 'consult')) {
    return <AccessDenied message="Vous n'avez pas le droit de consulter les pays." />;
  }

  const handleSubmit = async () => {
    if (!form.natlib) {
      setSnack({ open: true, msg: 'Le libellé est obligatoire.', sev: 'error' });
      return;
    }
    try {
      if (isEditMode) {
        await apiInstance.put('/Pays', { natcod: form.natcod, natlib: form.natlib });
      } else {
        // Backend génère le code séquentiel si natcod est vide.
        await apiInstance.post('/Pays', { natcod: '', natlib: form.natlib });
      }
      setSnack({ open: true, msg: isEditMode ? 'Pays mis à jour avec succès.' : 'Pays ajouté avec succès.', sev: 'success' });
      setForm(emptyForm);
      refetch();
    } catch {
      setSnack({ open: true, msg: 'Erreur lors de l\'enregistrement.', sev: 'error' });
    }
  };

  const handleEdit = (row: PaysModel) => {
    setForm(row);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (row: PaysModel) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce pays ?')) {
      try {
        await apiInstance.delete(`/Pays/${row.natcod}`);
        refetch();
      } catch { console.error('Erreur suppression'); }
    }
  };

  return (
    <Box className="ref-container">
      <Box className="ref-header">
        <Box>
          <Typography className="ref-header-title">Données de base</Typography>
          <Typography className="ref-header-heading">Gestion des Pays</Typography>
          <Typography className="ref-header-sub">Configurer les pays disponibles pour l'application</Typography>
        </Box>
        <Box className="ref-header-actions">
          {isEditMode && (
            <Button className="ref-cancel-btn" variant="outlined" onClick={() => setForm(emptyForm)}>Annuler</Button>
          )}
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
            <Box className="ref-card-icon"><PublicIcon fontSize="small" /></Box>
            <Typography className="ref-card-title">{isEditMode ? 'Modifier le pays' : 'Nouveau pays'}</Typography>
          </Box>
          <Box className="ref-form-grid ref-form-grid--2">
            <Box className="ref-field">
              <label>Code Pays {!isEditMode && <span style={{ color: '#8896a8', fontWeight: 400 }}>(auto-généré)</span>}</label>
              <input
                type="text"
                value={isEditMode ? form.natcod : ''}
                readOnly
                placeholder={isEditMode ? '' : 'Auto'}
                style={{ background: '#f5f7fa', color: '#8896a8' }}
              />
            </Box>
            <Box className="ref-field">
              <label>Libellé</label>
              <input type="text" value={form.natlib} onChange={e => setForm(p => ({ ...p, natlib: e.target.value }))} placeholder="Maroc" />
            </Box>
          </Box>
        </Box>

        <Box className="ref-table-section">
          <Box className="ref-table-header">
            <Typography className="ref-table-title">Liste des Pays ({filtered.length})</Typography>
            <Box className="ref-table-search">
              <SearchIcon sx={{ fontSize: 16, color: '#8896a8' }} />
              <input type="text" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
            </Box>
          </Box>
          <Box className="ref-table-container">
            <table className="ref-table">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>Actions</th>
                  <th>Code</th>
                  <th>Libellé</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={3} className="ref-empty">Aucun pays trouvé.</td></tr>
                ) : filtered.map(n => (
                  <tr key={n.natcod}>
                    <td>
                      <Box sx={{ display: 'flex', gap: '4px' }}>
                        {canModify && (
                          <button className="ref-action-btn ref-action-btn--edit" onClick={() => handleEdit(n)}><EditIcon sx={{ fontSize: 16 }} /></button>
                        )}
                        {canDelete && (
                          <button className="ref-action-btn ref-action-btn--delete" onClick={() => handleDelete(n)}><DeleteOutlineIcon sx={{ fontSize: 16 }} /></button>
                        )}
                        {!canModify && !canDelete && <Typography variant="caption">—</Typography>}
                      </Box>
                    </td>
                    <td style={{ fontWeight: 700, color: '#0f172a' }}>{n.natcod}</td>
                    <td>{n.natlib}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
          <Box className="ref-table-footer">
            <span>Affichage de {filtered.length} pays</span>
          </Box>
        </Box>
      </Box>

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack(s => ({ ...s, open: false }))}>
        <Alert severity={snack.sev} onClose={() => setSnack(s => ({ ...s, open: false }))} sx={{ borderRadius: '10px' }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}

export default function PaysModern() {
  const qc = new QueryClient();
  return <QueryClientProvider client={qc}><PaysModernContent /></QueryClientProvider>;
}