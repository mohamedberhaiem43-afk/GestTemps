import { useState, useMemo } from 'react';
import { Box, Typography, Button, Snackbar, Alert } from '@mui/material';
import { QueryClient, QueryClientProvider } from 'react-query';
import SaveIcon from '@mui/icons-material/Save';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import BusinessIcon from '@mui/icons-material/Business';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import ScheduleIcon from '@mui/icons-material/Schedule';
import SearchIcon from '@mui/icons-material/Search';
import useAddSite from '../../../hooks/siteHooks/useAddSite';
import useUpdateSite from '../../../hooks/siteHooks/useUpdateSite';
import useGetSites from '../../../hooks/siteHooks/useGetSites';
import useDeleteSite from '../../../hooks/siteHooks/useDeleteSite';
import { Filiale as FilialeModel } from '../../../models/Filiale';
import { useAuth } from '../../helper/AuthProvider';
import AccessDenied from '../../helper/AccessDenied';
import '../shared/RefModern.css';

const emptyForm: FilialeModel = {
  sitcod: '', soccod: '', sitlib: '', sitadr: '', sittel: '', sitfax: '',
  sitemail: '', sitmois: 0, sitconge: 0, sitcongem: 0, sitsoc: '',
  sitpaie: '', sitsanch: '0', sitsancm: '0',
};

function FilialeModernContent() {
  const { soccod, hasPermission } = useAuth();
  const [form, setForm] = useState<FilialeModel>({ ...emptyForm, soccod: soccod || '' });
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' as any });
  const [search, setSearch] = useState('');

  const { mutate: addSite, isLoading: isAdding } = useAddSite();
  const { mutate: updateSite, isLoading: isUpdating } = useUpdateSite();
  const { data: rawData, refetch } = useGetSites();
  const { mutate: deleteSite } = useDeleteSite();

  const sites: FilialeModel[] = Array.isArray(rawData) ? rawData : rawData ? [rawData] : [];
  const isEditMode = form.sitcod !== '' && sites.some((s: FilialeModel) => s.sitcod === form.sitcod);
  const isSaving = isAdding || isUpdating;

  const canAdd = hasPermission('Données de Base', 'add');
  const canModify = hasPermission('Données de Base', 'modify');
  const canDelete = hasPermission('Données de Base', 'delete');

  const filtered = useMemo(() => {
    if (!search) return sites;
    const q = search.toLowerCase();
    return sites.filter((s: FilialeModel) => s.sitcod.toLowerCase().includes(q) || s.sitlib.toLowerCase().includes(q));
  }, [sites, search]);

  if (!hasPermission('Données de Base', 'consult')) {
    return <AccessDenied message="Vous n'avez pas le droit de consulter les filiales." />;
  }

  const set = (field: keyof FilialeModel) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const val = e.target.value;
    setForm(prev => ({ ...prev, [field]: field === 'sitmois' || field === 'sitconge' || field === 'sitcongem' ? Number(val) || 0 : val }));
  };

  const handleSubmit = () => {
    if (!form.sitcod || !form.sitlib) {
      setSnack({ open: true, msg: 'Code et Libellé sont obligatoires.', sev: 'error' });
      return;
    }
    const payload = { ...form, soccod: soccod || '' };
    const onSuccess = () => {
      setSnack({ open: true, msg: isEditMode ? 'Filiale mise à jour.' : 'Filiale ajoutée.', sev: 'success' });
      setForm({ ...emptyForm, soccod: soccod || '' });
      refetch();
    };
    const onError = () => setSnack({ open: true, msg: 'Erreur lors de l\'enregistrement.', sev: 'error' });
    if (isEditMode) { updateSite(payload, { onSuccess, onError }); } else { addSite(payload, { onSuccess, onError }); }
  };

  const handleEdit = (row: FilialeModel) => { setForm(row); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleDelete = (row: FilialeModel) => {
    if (window.confirm('Supprimer cette filiale ?')) {
      deleteSite({ sitcod: row.sitcod }, { onSuccess: () => refetch() });
    }
  };

  return (
    <Box className="ref-container">
      <Box className="ref-header">
        <Box>
          <Typography className="ref-header-title">Données de base</Typography>
          <Typography className="ref-header-heading">Gestion des Filiales</Typography>
          <Typography className="ref-header-sub">Configurer les sites et filiales de votre société</Typography>
        </Box>
        <Box className="ref-header-actions">
          {isEditMode && <Button className="ref-cancel-btn" variant="outlined" onClick={() => setForm({ ...emptyForm, soccod: soccod || '' })}>Annuler</Button>}
          {((isEditMode && canModify) || (!isEditMode && canAdd)) && (
            <Button className="ref-save-btn" variant="contained" startIcon={<SaveIcon />} onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? 'Enregistrement...' : isEditMode ? 'Mettre à jour' : 'Enregistrer'}
            </Button>
          )}
        </Box>
      </Box>

      <Box className="ref-body">
        {/* Card: Identification */}
        <Box className="ref-card">
          <Box className="ref-card-header">
            <Box className="ref-card-icon"><BusinessIcon fontSize="small" /></Box>
            <Typography className="ref-card-title">{isEditMode ? 'Modifier la filiale' : 'Nouvelle filiale'}</Typography>
          </Box>
          <Box className="ref-form-grid ref-form-grid--2">
            <Box className="ref-field">
              <label>Code Filiale</label>
              <input type="text" value={form.sitcod} onChange={set('sitcod')} readOnly={isEditMode} placeholder="S01" />
            </Box>
            <Box className="ref-field">
              <label>Nom Filiale</label>
              <input type="text" value={form.sitlib} onChange={set('sitlib')} placeholder="Siège Casablanca" />
            </Box>
          </Box>
        </Box>

        {/* Card: Coordonnées */}
        <Box className="ref-card">
          <Box className="ref-card-header">
            <Box className="ref-card-icon"><LocationOnIcon fontSize="small" /></Box>
            <Typography className="ref-card-title">Coordonnées</Typography>
          </Box>
          <Box className="ref-form-grid ref-form-grid--2">
            <Box className="ref-field" style={{ gridColumn: 'span 2' }}>
              <label>Adresse</label>
              <input type="text" value={form.sitadr} onChange={set('sitadr')} placeholder="123 Avenue Mohammed V" />
            </Box>
            <Box className="ref-field">
              <label>Téléphone</label>
              <input type="tel" value={form.sittel} onChange={set('sittel')} placeholder="+212 5XX XXX XXX" />
            </Box>
            <Box className="ref-field">
              <label>Fax</label>
              <input type="tel" value={form.sitfax} onChange={set('sitfax')} />
            </Box>
            <Box className="ref-field" style={{ gridColumn: 'span 2' }}>
              <label>Email</label>
              <input type="email" value={form.sitemail} onChange={set('sitemail')} placeholder="contact@filiale.ma" />
            </Box>
          </Box>
        </Box>

        {/* Card: Paramètres Travail */}
        <Box className="ref-card">
          <Box className="ref-card-header">
            <Box className="ref-card-icon"><ScheduleIcon fontSize="small" /></Box>
            <Typography className="ref-card-title">Paramètres Travail</Typography>
          </Box>
          <Box className="ref-form-grid ref-form-grid--3">
            <Box className="ref-field">
              <label>Heures / Mois</label>
              <input type="number" value={form.sitmois} onChange={set('sitmois')} placeholder="191" />
            </Box>
            <Box className="ref-field">
              <label>Congés / An</label>
              <input type="number" value={form.sitconge} onChange={set('sitconge')} placeholder="18" />
            </Box>
            <Box className="ref-field">
              <label>Congés / Mois</label>
              <input type="number" value={form.sitcongem} onChange={set('sitcongem')} placeholder="1.5" />
            </Box>
          </Box>
        </Box>

        {/* Table */}
        <Box className="ref-table-section">
          <Box className="ref-table-header">
            <Typography className="ref-table-title">Liste des Filiales ({filtered.length})</Typography>
            <Box className="ref-table-search">
              <SearchIcon sx={{ fontSize: 16, color: '#8896a8' }} />
              <input type="text" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} />
            </Box>
          </Box>
          <table className="ref-table">
            <thead>
              <tr>
                <th style={{ width: 80 }}>Actions</th>
                <th>Code</th>
                <th>Nom</th>
                <th>Tél</th>
                <th>Email</th>
                <th>Hrs/Mois</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="ref-empty">Aucune filiale trouvée.</td></tr>
              ) : filtered.map(s => (
                <tr key={s.sitcod}>
                  <td>
                    <Box sx={{ display: 'flex', gap: '4px' }}>
                      {canModify && (
                        <button className="ref-action-btn ref-action-btn--edit" onClick={() => handleEdit(s)}><EditIcon sx={{ fontSize: 16 }} /></button>
                      )}
                      {canDelete && (
                        <button className="ref-action-btn ref-action-btn--delete" onClick={() => handleDelete(s)}><DeleteOutlineIcon sx={{ fontSize: 16 }} /></button>
                      )}
                      {!canModify && !canDelete && <Typography variant="caption">—</Typography>}
                    </Box>
                  </td>
                  <td style={{ fontWeight: 700, color: '#0f172a' }}>{s.sitcod}</td>
                  <td>{s.sitlib}</td>
                  <td>{s.sittel || '—'}</td>
                  <td style={{ color: '#64748b' }}>{s.sitemail || '—'}</td>
                  <td><span className="ref-badge ref-badge--blue">{s.sitmois || '—'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <Box className="ref-table-footer"><span>Affichage de {filtered.length} filiales</span></Box>
        </Box>
      </Box>

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack(s => ({ ...s, open: false }))}>
        <Alert severity={snack.sev} onClose={() => setSnack(s => ({ ...s, open: false }))} sx={{ borderRadius: '10px' }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}

export default function FilialeModern() {
  const qc = new QueryClient();
  return <QueryClientProvider client={qc}><FilialeModernContent /></QueryClientProvider>;
}