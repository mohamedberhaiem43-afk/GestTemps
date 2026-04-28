import { useState, useMemo } from 'react';
import { Box, Typography, Button, Snackbar, Alert, CircularProgress } from '@mui/material';
import { QueryClient, QueryClientProvider } from 'react-query';
import SaveIcon from '@mui/icons-material/Save';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LocationCityIcon from '@mui/icons-material/LocationCity';
import SearchIcon from '@mui/icons-material/Search';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import apiInstance from '../../API/apiInstance';
import { VilleModel } from '../../../models/Ville';
import { useAuth } from '../../helper/AuthProvider';
import useGetVilles from '../../../hooks/villeHooks/useGetVilles';
import AccessDenied from '../../helper/AccessDenied';
import '../shared/RefModern.css';

const emptyForm: VilleModel = { vilcod: '', villib: '' };

function VilleModernContent() {
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
    return <AccessDenied message="Vous n'avez pas le droit de consulter les villes." />;
  }

  const filtered = useMemo(() => {
    if (!search) return villes;
    const q = search.toLowerCase();
    return villes.filter(v => v.vilcod.toLowerCase().includes(q) || v.villib.toLowerCase().includes(q));
  }, [villes, search]);

  const handleSubmit = async () => {
    if (!form.villib) {
      setSnack({ open: true, msg: 'Le libellé est obligatoire.', sev: 'error' });
      return;
    }
    try {
      if (isEditMode) {
        await apiInstance.put(`/Villes/${form.vilcod}`, { vilcod: form.vilcod, villib: form.villib });
      } else {
        // En création, on laisse le backend générer le code séquentiel (vilcod vide).
        await apiInstance.post('/Villes', { vilcod: '', villib: form.villib });
      }
      setSnack({ open: true, msg: isEditMode ? 'Ville mise à jour avec succès.' : 'Ville ajoutée avec succès.', sev: 'success' });
      setForm(emptyForm);
      refetch();
    } catch {
      setSnack({ open: true, msg: 'Erreur lors de l\'enregistrement.', sev: 'error' });
    }
  };

  const handleImportFrance = async () => {
    if (!window.confirm('Importer les ~35 000 communes françaises ? Les villes déjà présentes seront sautées.')) return;
    setImporting(true);
    try {
      const { data } = await apiInstance.post('/Villes/import-france');
      setSnack({
        open: true,
        msg: `${data.inserted} villes importées (${data.skipped} déjà présentes)`,
        sev: 'success'
      });
      refetch();
    } catch (e: any) {
      setSnack({ open: true, msg: e?.response?.data?.message || 'Erreur lors de l\'import des villes', sev: 'error' });
    } finally {
      setImporting(false);
    }
  };

  const handleEdit = (row: VilleModel) => { setForm(row); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleDelete = async (row: VilleModel) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette ville ?')) {
      try { await apiInstance.delete(`/Villes/${row.vilcod}`); refetch(); } catch { console.error('Erreur suppression'); }
    }
  };

  return (
    <Box className="ref-container">
      <Box className="ref-header">
        <Box>
          <Typography className="ref-header-title">Données de base</Typography>
          <Typography className="ref-header-heading">Gestion des Villes</Typography>
          <Typography className="ref-header-sub">Configurer les villes disponibles</Typography>
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
              {importing ? 'Import en cours…' : 'Importer villes France'}
            </Button>
          )}
          {isEditMode && <Button className="ref-cancel-btn" variant="outlined" onClick={() => setForm(emptyForm)}>Annuler</Button>}
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
            <Box className="ref-card-icon"><LocationCityIcon fontSize="small" /></Box>
            <Typography className="ref-card-title">{isEditMode ? 'Modifier la ville' : 'Nouvelle ville'}</Typography>
          </Box>
          <Box className="ref-form-grid ref-form-grid--2">
            <Box className="ref-field">
              <label>Code Ville {!isEditMode && <span style={{ color: '#8896a8', fontWeight: 400 }}>(auto-généré)</span>}</label>
              <input
                type="text"
                value={isEditMode ? form.vilcod : ''}
                readOnly
                placeholder={isEditMode ? '' : 'Auto'}
                style={{ background: '#f5f7fa', color: '#8896a8' }}
              />
            </Box>
            <Box className="ref-field">
              <label>Libellé</label>
              <input type="text" value={form.villib} onChange={e => setForm(p => ({ ...p, villib: e.target.value }))} placeholder="Casablanca" />
            </Box>
          </Box>
        </Box>
        <Box className="ref-table-section">
          <Box className="ref-table-header">
            <Typography className="ref-table-title">Liste des Villes ({filtered.length})</Typography>
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
                  <tr><td colSpan={3} className="ref-empty">Aucune ville trouvée.</td></tr>
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
          <Box className="ref-table-footer"><span>Affichage de {filtered.length} villes</span></Box>
        </Box>
      </Box>
      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack(s => ({ ...s, open: false }))}>
        <Alert severity={snack.sev} onClose={() => setSnack(s => ({ ...s, open: false }))} sx={{ borderRadius: '10px' }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}

export default function VilleModern() {
  const qc = new QueryClient();
  return <QueryClientProvider client={qc}><VilleModernContent /></QueryClientProvider>;
}