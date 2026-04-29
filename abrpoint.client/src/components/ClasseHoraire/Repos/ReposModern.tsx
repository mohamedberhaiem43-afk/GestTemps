import { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Paper, TextField, IconButton,
  Snackbar, Alert, CircularProgress
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
import MoneyOffIcon from '@mui/icons-material/MoneyOff';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import { QueryClient, QueryClientProvider } from 'react-query';
import { FerierProvider, useFerierContext } from '../../helper/ReposContext';
import useGetRepos from '../../../hooks/Repos/useGetRepos';
import useAddRepos from '../../../hooks/Repos/useAddRepos';
import useUpdateRepos from '../../../hooks/Repos/useUpdateRepos';
import useDeleteRepos from '../../../hooks/Repos/useDeleteRepos';
import { fetchJoursFeriesFr, toFerier } from '../../../hooks/Repos/useImportJoursFeriesFr';
import AlertModal from '../../AlertModal/AlertModal';
import { useAuth } from '../../helper/AuthProvider';
import AccessDenied from '../../helper/AccessDenied';
import { Ferier } from '../../../models/Ferier';
import './ReposModern.css';

// ── helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (d: any) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '—'; }
};

const fmtDateInput = (d: any) => {
  if (!d) return '';
  try { return new Date(d).toISOString().split('T')[0]; } catch { return ''; }
};

const today = () => new Date().toISOString().split('T')[0];

// ── Main inner ────────────────────────────────────────────────────────────────
function ReposModernInner() {
  const { soccod: authSoccod } = useAuth();
  const soccod = authSoccod || sessionStorage.getItem('soccod') || '';
  const { selectedFerier, setSelectedFerier } = useFerierContext();

  // Form state
  const [annee, setAnnee] = useState(String(new Date().getFullYear()));
  const [fermotif, setFermotif] = useState('');
  const [ferdate, setFerdate] = useState(today());
  const [fertrv, setFertrv] = useState(today());
  const [ferheure, setFerheure] = useState<number>(8);
  const [ferfixe, setFerfixe] = useState(false);
  const [fernpaye, setFernpaye] = useState(false);
  const [fertype, setFertype] = useState<'F' | 'R'>('F');
  const [mode, setMode] = useState<'save' | 'edit'>('save');

  // Table state
  const [filterTab, setFilterTab] = useState<'all' | 'paye' | 'fixe'>('all');
  const [deleteTarget, setDeleteTarget] = useState<Ferier | null>(null);
  const [page, setPage] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [importing, setImporting] = useState(false);

  const { hasPermission } = useAuth();
  const canAdd = hasPermission('Paramètres de Temps', 'add');
  const canModify = hasPermission('Paramètres de Temps', 'modify');
  const canDelete = hasPermission('Paramètres de Temps', 'delete');

  if (!hasPermission('Paramètres de Temps', 'consult')) {
    return <AccessDenied message="Vous n'avez pas le droit de consulter les jours fériés et repos." />;
  }

  const { data = [], isLoading, refetch } = useGetRepos();
  const { mutate: addRepos, isLoading: adding } = useAddRepos();
  const { mutate: editRepos, isLoading: editing } = useUpdateRepos();
  const { mutate: deleteRepos } = useDeleteRepos();

  const isSaving = adding || editing;

  // Load selected ferier into form
  useEffect(() => {
    if (selectedFerier) {
      setAnnee(selectedFerier.annee || String(new Date().getFullYear()));
      setFermotif(selectedFerier.fermotif || '');
      setFerdate(fmtDateInput(selectedFerier.ferdate));
      setFertrv(fmtDateInput(selectedFerier.fertrv));
      setFerheure(selectedFerier.ferheure ?? 8);
      setFerfixe(selectedFerier.ferfixe === '1');
      setFernpaye(selectedFerier.fernpaye === '1');
      setFertype((selectedFerier.fertype as 'F' | 'R') || 'F');
      setMode('edit');
    }
  }, [selectedFerier]);

  const showSnack = (message: string, severity: 'success' | 'error') =>
    setSnackbar({ open: true, message, severity });

  const resetForm = () => {
    setAnnee(String(new Date().getFullYear()));
    setFermotif(''); setFerdate(today()); setFertrv(today());
    setFerheure(8); setFerfixe(false); setFernpaye(false);
    setFertype('F'); setMode('save');
    setSelectedFerier(null as any);
  };

  const handleSave = () => {
    if (!soccod) { showSnack('Session expirée, veuillez vous reconnecter', 'error'); return; }
    if (!fermotif.trim()) { showSnack('Le motif est obligatoire', 'error'); return; }
    if (!ferdate) { showSnack('La date est obligatoire', 'error'); return; }

    const ferdateObj = new Date(ferdate);
    const fertrvObj = fertrv ? new Date(fertrv) : ferdateObj;

    if (isNaN(ferdateObj.getTime())) { showSnack('Date invalide', 'error'); return; }

    const payload: Ferier = {
      soccod,
      annee: annee || String(ferdateObj.getFullYear()),
      fermotif: fermotif.trim(),
      fertype,
      ferheure: parseFloat(String(ferheure)) || 0,
      ferfixe: ferfixe ? '1' : '0',
      fernpaye: fernpaye ? '1' : '0',
      ferdate: ferdateObj,
      fertrv: fertrvObj,
    };

    const cb = {
      onSuccess: () => { showSnack(mode === 'save' ? 'Jour férié ajouté' : 'Jour férié modifié', 'success'); refetch(); resetForm(); },
      onError: (err: any) => {
        const msg = err?.response?.data?.message || err?.response?.data || err?.message || 'Erreur lors de la sauvegarde';
        showSnack(String(msg), 'error');
      },
    };
    mode === 'save' ? addRepos(payload, cb) : editRepos(payload, cb);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteRepos(deleteTarget, {
      onSuccess: () => { showSnack('Supprimé avec succès', 'success'); refetch(); setDeleteTarget(null); },
      onError: () => showSnack('Erreur lors de la suppression', 'error'),
    });
  };

  /**
   * Pré-remplit les jours fériés par défaut depuis l'API gouv.fr (métropole) pour l'année
   * sélectionnée. Les fériés déjà présents (même date) sont ignorés pour éviter les doublons.
   * Pour chaque ligne créée :
   *   - ferheure = 8h (journée pleine)
   *   - fertype  = 'F' (férié)
   *   - fernpaye = '0' (payé)
   *   - ferfixe  = '1' pour les dates fixes (1er janvier, 1er mai, …), '0' sinon (Pâques etc.)
   */
  const handleImportFromGouvFr = async () => {
    if (!soccod) { showSnack('Session expirée, veuillez vous reconnecter', 'error'); return; }
    if (!canAdd) { showSnack("Vous n'avez pas le droit d'ajouter des jours fériés.", 'error'); return; }

    const yearNum = parseInt(annee, 10);
    if (!yearNum || yearNum < 1900 || yearNum > 2100) {
      showSnack("Saisissez une année valide avant l'import.", 'error');
      return;
    }
    if (!window.confirm(
      `Importer les jours fériés métropole France pour ${yearNum} ?\n\n` +
      `Les jours déjà saisis seront conservés (pas de doublon).`
    )) return;

    setImporting(true);
    try {
      const items = await fetchJoursFeriesFr(yearNum);
      // Index par yyyy-mm-dd des fériés déjà présents pour cette année.
      const existing = new Set<string>(
        ferierList
          .filter((f) => String(f.annee) === String(yearNum) || (f.ferdate && new Date(f.ferdate).getFullYear() === yearNum))
          .map((f) => f.ferdate ? new Date(f.ferdate).toISOString().slice(0, 10) : '')
          .filter(Boolean)
      );

      let inserted = 0;
      let skipped = 0;
      // On insère séquentiellement pour respecter la cohérence côté API et permettre un
      // message clair en cas d'échec partiel.
      for (const it of items) {
        if (existing.has(it.date)) { skipped++; continue; }
        const payload = toFerier(it, soccod);
        await new Promise<void>((resolve) => {
          addRepos(payload, {
            onSuccess: () => { inserted++; resolve(); },
            onError: () => { resolve(); },
          });
        });
      }
      await refetch();
      showSnack(
        `Import terminé : ${inserted} ajouté(s), ${skipped} ignoré(s) (déjà présents).`,
        inserted > 0 ? 'success' : 'error'
      );
    } catch (err: any) {
      showSnack(err?.message || "Échec de l'import des jours fériés.", 'error');
    } finally {
      setImporting(false);
    }
  };

  // Filter + paginate
  const PAGE_SIZE = 10;
  const ferierList: Ferier[] = Array.isArray(data) ? data : [];

  const filtered = useMemo(() => {
    return ferierList.filter(f => {
      if (filterTab === 'paye') return f.fernpaye !== '1';
      if (filterTab === 'fixe') return f.ferfixe === '1';
      return true;
    });
  }, [ferierList, filterTab]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalCount = ferierList.length;

  return (
    <Box className="rp-container">
      {/* Page header */}
      <Box className="rp-page-header">
        <Box>
          <Typography className="rp-page-title">Configuration du Calendrier</Typography>
          <Typography className="rp-page-sub">Définissez et gérez les périodes de repos exceptionnelles pour l'ensemble des collaborateurs.</Typography>
        </Box>
        <Box className="rp-page-actions">
          {canAdd && (
            <button
              className="rp-btn-secondary"
              onClick={handleImportFromGouvFr}
              disabled={importing}
              title="Importer la liste officielle des jours fériés métropole France pour l'année saisie"
            >
              {importing ? <CircularProgress size={16} color="inherit" /> : <CloudDownloadIcon sx={{ fontSize: 18 }} />}
              Importer (gouv.fr)
            </button>
          )}
          {canAdd && (
            <button className="rp-btn-secondary" onClick={resetForm}>
              <AddCircleIcon sx={{ fontSize: 18 }} />Nouveau
            </button>
          )}
          {((mode === 'save' && canAdd) || (mode === 'edit' && canModify)) && (
            <button className="rp-btn-primary" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon sx={{ fontSize: 18 }} />}
              {mode === 'save' ? 'Enregistrer' : 'Mettre à jour'}
            </button>
          )}
        </Box>
      </Box>

      {/* Config section */}
      <Box className="rp-config-grid">
        {/* Form card (8 cols) */}
        <Paper className="rp-form-card">
          <Box className="rp-form-card-header">
            <Typography className="rp-form-card-title">Paramètres du jour férié</Typography>
            <span className="rp-mode-badge">{mode === 'edit' ? 'Mode Édition' : 'Nouveau'}</span>
          </Box>
          <Box className="rp-form-body">
            {/* Left column */}
            <Box className="rp-form-left">
              <Box>
                <Typography className="rp-field-label">Année de référence</Typography>
                <TextField size="small" fullWidth type="number" value={annee} onChange={e => setAnnee(e.target.value)} className="rp-input" />
              </Box>
              <Box>
                <Typography className="rp-field-label">Motif / Désignation</Typography>
                <TextField size="small" fullWidth value={fermotif} onChange={e => setFermotif(e.target.value)}
                  placeholder="ex: Fête de l'Indépendance" className="rp-input" />
              </Box>
              <Box className="rp-date-row">
                <Box>
                  <Typography className="rp-field-label">Date Début</Typography>
                  <TextField size="small" fullWidth type="date" value={ferdate} onChange={e => setFerdate(e.target.value)}
                    className="rp-input" InputLabelProps={{ shrink: true }} />
                </Box>
                <Box>
                  <Typography className="rp-field-label">Date Retour</Typography>
                  <TextField size="small" fullWidth type="date" value={fertrv} onChange={e => setFertrv(e.target.value)}
                    className="rp-input" InputLabelProps={{ shrink: true }} />
                </Box>
              </Box>
            </Box>

            {/* Right column */}
            <Box className="rp-form-right">
              <Box>
                <Typography className="rp-field-label">Type de journée</Typography>
                <Box className="rp-type-toggle">
                  <button className={`rp-type-btn ${fertype === 'F' ? 'rp-type-active' : ''}`} onClick={() => setFertype('F')}>Férié</button>
                  <button className={`rp-type-btn ${fertype === 'R' ? 'rp-type-active' : ''}`} onClick={() => setFertype('R')}>Jour de repos</button>
                </Box>
              </Box>
              <Box>
                <Typography className="rp-field-label">Nb. Heures</Typography>
                <TextField size="small" type="number" value={ferheure} onChange={e => setFerheure(parseFloat(e.target.value))}
                  className="rp-input" sx={{ width: 100 }} />
              </Box>
              <Box className="rp-options-card">
                <Box className="rp-option-row" onClick={() => setFerfixe(f => !f)}>
                  <Box className="rp-option-icon"><EventRepeatIcon sx={{ fontSize: 20, color: '#0040a1' }} /></Box>
                  <Box className="rp-option-text">
                    <Typography className="rp-option-title">Fixe (Annuel)</Typography>
                    <Typography className="rp-option-sub">Se répète chaque année à la même date</Typography>
                  </Box>
                  <input type="checkbox" checked={ferfixe} onChange={e => setFerfixe(e.target.checked)} className="rp-checkbox" />
                </Box>
                <Box className="rp-option-divider" />
                <Box className="rp-option-row" onClick={() => setFernpaye(f => !f)}>
                  <Box className="rp-option-icon rp-option-icon-error"><MoneyOffIcon sx={{ fontSize: 20, color: '#ba1a1a' }} /></Box>
                  <Box className="rp-option-text">
                    <Typography className="rp-option-title">Non Payé</Typography>
                    <Typography className="rp-option-sub">Déduire du salaire mensuel</Typography>
                  </Box>
                  <input type="checkbox" checked={fernpaye} onChange={e => setFernpaye(e.target.checked)} className="rp-checkbox" />
                </Box>
              </Box>
            </Box>
          </Box>
        </Paper>

        {/* Info sidebar (4 cols) */}
        <Box className="rp-sidebar">
          {/* Policy card */}
          <Box className="rp-policy-card">
            <Box sx={{ position: 'relative', zIndex: 1 }}>
              <Typography className="rp-policy-title">Politique des Jours Fériés</Typography>
              <Typography className="rp-policy-text">
                Tous les jours fériés configurés sont automatiquement appliqués aux plannings des collaborateurs affectés à l'établissement principal.
              </Typography>
            </Box>
            <EventRepeatIcon sx={{ position: 'absolute', right: -20, bottom: -20, fontSize: 160, opacity: 0.08, color: 'white' }} />
          </Box>

          {/* Quick stats */}
          <Paper className="rp-stats-card">
            <Typography className="rp-stats-label">Aperçu rapide ({annee})</Typography>
            <Box className="rp-stats-row">
              <Typography className="rp-stats-sub">Total jours fériés</Typography>
              <Typography className="rp-stats-value">{totalCount}</Typography>
            </Box>
            <Box className="rp-stats-bar">
              <Box className="rp-stats-bar-fill" style={{ width: `${Math.min(100, (totalCount / 20) * 100)}%` }} />
            </Box>
          </Paper>
        </Box>
      </Box>

      {/* Table section */}
      <Box className="rp-table-section">
        <Box className="rp-table-header">
          <Typography className="rp-table-title">Répertoire des Jours Fériés</Typography>
          <Box className="rp-filter-tabs">
            {(['all', 'paye', 'fixe'] as const).map(tab => (
              <button key={tab} className={`rp-filter-tab ${filterTab === tab ? 'rp-filter-tab-active' : ''}`}
                onClick={() => { setFilterTab(tab); setPage(0); }}>
                {tab === 'all' ? 'Tous' : tab === 'paye' ? 'Payés' : 'Fixes'}
              </button>
            ))}
          </Box>
        </Box>

        <Paper className="rp-table-paper">
          <Box className="rp-table-wrap">
            <table className="rp-table">
              <thead>
                <tr>
                  {['Date', 'Motif', 'Fixe ?', 'Type', 'Nb. Heures', 'Payé ?', 'Date Retour', 'Actions'].map((h, i) => (
                    <th key={h} className={`rp-th ${[2, 3, 4, 5].includes(i) ? 'rp-th-center' : ''} ${i === 7 ? 'rp-th-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={8} className="rp-empty-cell"><CircularProgress size={28} /></td></tr>
                ) : paginated.length === 0 ? (
                  <tr><td colSpan={8} className="rp-empty-cell">Aucun jour férié configuré</td></tr>
                ) : paginated.map((f, i) => (
                  <tr key={i} className="rp-tr">
                    <td className="rp-td rp-td-date">{fmtDate(f.ferdate)}</td>
                    <td className="rp-td rp-td-name">{f.fermotif || '—'}</td>
                    <td className="rp-td rp-td-center">
                      {f.ferfixe === '1'
                        ? <CheckCircleIcon sx={{ fontSize: 20, color: '#059669' }} />
                        : <CancelIcon sx={{ fontSize: 20, color: '#e2e8f0' }} />}
                    </td>
                    <td className="rp-td rp-td-center">
                      <span className={`rp-type-badge ${f.fertype === 'F' ? 'rp-type-ferier' : 'rp-type-repos'}`}>
                        {f.fertype === 'F' ? 'Férié' : 'Repos'}
                      </span>
                    </td>
                    <td className="rp-td rp-td-center rp-td-sub">{f.ferheure ?? '—'}</td>
                    <td className="rp-td rp-td-center">
                      {f.fernpaye !== '1'
                        ? <span className="rp-paye-badge rp-paye-oui">OUI</span>
                        : <span className="rp-paye-badge rp-paye-non">NON</span>}
                    </td>
                    <td className="rp-td rp-td-sub">{fmtDate(f.fertrv)}</td>
                    <td className="rp-td rp-td-actions">
                      <Box className="rp-row-actions">
                        {canModify && (
                          <IconButton size="small" className="rp-action-edit"
                            onClick={() => setSelectedFerier(f)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        )}
                        {canDelete && (
                          <IconButton size="small" className="rp-action-delete"
                            onClick={() => setDeleteTarget(f)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                        {!canModify && !canDelete && <Typography variant="caption">—</Typography>}
                      </Box>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>

          {/* Pagination */}
          <Box className="rp-pagination">
            <Typography className="rp-pagination-info">
              Affichage de {page * PAGE_SIZE + 1} à {Math.min((page + 1) * PAGE_SIZE, filtered.length)} sur {filtered.length} entrées
            </Typography>
            <Box className="rp-pagination-btns">
              <IconButton size="small" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="rp-page-btn">
                <ChevronLeftIcon fontSize="small" />
              </IconButton>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => (
                <button key={i} className={`rp-page-num ${page === i ? 'rp-page-active' : ''}`} onClick={() => setPage(i)}>
                  {i + 1}
                </button>
              ))}
              <IconButton size="small" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="rp-page-btn">
                <ChevronRightIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        </Paper>
      </Box>

      <AlertModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        message={`Supprimer "${deleteTarget?.fermotif}" du ${fmtDate(deleteTarget?.ferdate)} ?`} />

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))} sx={{ borderRadius: '10px' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

const ReposModern = () => (
  <QueryClientProvider client={new QueryClient()}>
    <FerierProvider>
      <ReposModernInner />
    </FerierProvider>
  </QueryClientProvider>
);

export default ReposModern;
