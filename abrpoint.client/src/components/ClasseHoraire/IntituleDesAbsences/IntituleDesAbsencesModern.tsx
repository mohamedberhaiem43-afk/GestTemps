import { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Paper, Button, TextField, MenuItem, Select,
  FormControl, IconButton, Snackbar, Alert, CircularProgress
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { QueryClient, QueryClientProvider } from 'react-query';
import { AbsenceProvider, useAbsenceContext } from '../../helper/AbsenceContext';
import useGetAllAbsences from '../../../hooks/absenceHooks/useGetAllAbsence';
import useAddAbsence from '../../../hooks/absenceHooks/useAddAbsence';
import useUpdateAbsence from '../../../hooks/absenceHooks/useUpdateAbsence';
import useDeleteAbsence from '../../../hooks/absenceHooks/useDeleteAbsence';
import { useAuth } from '../../helper/AuthProvider';
import AccessDenied from '../../helper/AccessDenied';
import './IntituleDesAbsencesModern.css';
import { Absence } from '../../../models/Absence';
import AlertModal from '../../AlertModal/AlertModal';

// ── Type imputation map ───────────────────────────────────────────────────────
const IMPUTATION_OPTIONS = [
  { value: '0', label: 'Congé Payé (CP)' },
  { value: '8', label: 'Accident de Travail (AT)' },
  { value: '1', label: 'Congé Spécial Familial (CSF)' },
  { value: '2', label: 'Absence Justifiée (AJ)' },
  { value: '6', label: 'Formation + Mission (FM)' },
  { value: 'A', label: 'Arrêt Technique (CT)' },
  { value: 'C', label: 'Complément Jour/Forfait (C)' },
  { value: 'M', label: 'Absence Maternité (M)' },
  { value: '3', label: 'Absence non Justifiée (ANJ)' },
  { value: '4', label: 'Absence de Sanction (MAP)' },
  { value: 'B', label: 'Autorisation de Sortie (AS)' },
  { value: '5', label: 'Congé sans Solde (CSS)' },
  { value: '7', label: 'Blame (B)' },
  { value: 'V', label: 'Avertissement (V)' },
];

const PERIODICITE_MAP: Record<string, string> = {
  A: 'Année civile', M: 'Mois', S: 'Semestre', T: 'Trimestre',
};

const SANCTION_OPTIONS = [
  { value: 'N', label: 'Justification' },
  { value: 'O', label: 'Sanction' },
  { value: 'C', label: 'Compensation' },
  { value: 'F', label: 'Fin Travail' },
];

// ── Toggle switch ─────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="ia-toggle-wrap">
      <Box className={`ia-toggle ${checked ? 'ia-toggle-on' : ''}`} onClick={() => onChange(!checked)}>
        <Box className="ia-toggle-thumb" />
      </Box>
      <span className="ia-toggle-label">{label}</span>
    </label>
  );
}

// ── Bool cell ─────────────────────────────────────────────────────────────────
function BoolCell({ val, trueVal }: { val: any; trueVal: any }) {
  const ok = val === trueVal || val === 1;
  return ok
    ? <CheckIcon sx={{ fontSize: 18, color: '#059669' }} />
    : <CloseIcon sx={{ fontSize: 18, color: '#e2e8f0' }} />;
}

// ── Code badge ────────────────────────────────────────────────────────────────
const CODE_COLORS: Record<string, { bg: string; color: string }> = {
  CP: { bg: '#dbeafe', color: '#1d4ed8' },
  MAL: { bg: '#f1f5f9', color: '#475569' },
  ABS: { bg: '#fee2e2', color: '#b91c1c' },
  CSS: { bg: '#fef3c7', color: '#92400e' },
};
function CodeBadge({ code }: { code: string }) {
  const style = CODE_COLORS[code] ?? { bg: '#f1f5f9', color: '#475569' };
  return (
    <span className="ia-code-badge" style={{ background: style.bg, color: style.color }}>
      {code}
    </span>
  );
}

// ── Main inner ────────────────────────────────────────────────────────────────
function IntituleDesAbsencesModernInner() {
  const soccod = sessionStorage.getItem('soccod') || '';
  const { selectedAbsence, setSelectedAbsence } = useAbsenceContext();

  // Form state
  const [abscod, setAbscod] = useState('');
  const [abslib, setAbslib] = useState('');
  const [abspar, setAbspar] = useState('A');
  const [absunite, setAbsunite] = useState('J');
  const [abscng, setAbscng] = useState('0');
  const [abssanc, setAbssanc] = useState('N');
  const [abspayer, setAbspayer] = useState(false);
  const [absrepos, setAbsrepos] = useState(false);
  const [absferier, setAbsferier] = useState(false);
  const [absaut, setAbsaut] = useState(false);
  const [mode, setMode] = useState<'save' | 'edit'>('save');

  // Table state
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'archived'>('all');
  const [searchQ, setSearchQ] = useState('');
  const [page, setPage] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<Absence | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const { hasPermission } = useAuth();
  const canAdd = hasPermission('Paramètres de Temps', 'add');
  const canModify = hasPermission('Paramètres de Temps', 'modify');
  const canDelete = hasPermission('Paramètres de Temps', 'delete');

  if (!hasPermission('Paramètres de Temps', 'consult')) {
    return <AccessDenied message="Vous n'avez pas le droit de consulter les intitulés des absences." />;
  }

  const { data: absences = [], isLoading, refetch } = useGetAllAbsences();
  const { mutate: addAbsence, isLoading: adding } = useAddAbsence();
  const { mutate: editAbsence, isLoading: editing } = useUpdateAbsence();
  const { mutate: deleteAbsence } = useDeleteAbsence();

  const isSaving = adding || editing;

  // Load selected absence into form
  useEffect(() => {
    if (selectedAbsence) {
      setAbscod(selectedAbsence.abscod || '');
      setAbslib(selectedAbsence.abslib || '');
      setAbspar(selectedAbsence.abspar || 'A');
      setAbsunite(selectedAbsence.absunite || 'J');
      setAbscng(selectedAbsence.abscng || '0');
      setAbssanc(selectedAbsence.abssanc || 'N');
      setAbspayer(selectedAbsence.abspayer === 'O');
      setAbsrepos((selectedAbsence as any).absrepos === '1');
      setAbsferier(selectedAbsence.absferier === 'O');
      setAbsaut(selectedAbsence.absaut === 1);
      setMode('edit');
    }
  }, [selectedAbsence]);

  const showSnack = (message: string, severity: 'success' | 'error') =>
    setSnackbar({ open: true, message, severity });

  const resetForm = () => {
    setAbscod(''); setAbslib(''); setAbspar('A'); setAbsunite('J');
    setAbscng('0'); setAbssanc('N'); setAbspayer(false); setAbsrepos(false);
    setAbsferier(false); setAbsaut(false); setMode('save');
    setSelectedAbsence(null as any);
  };

  const handleSave = () => {
    const payload: any = {
      soccod, abscod, abslib, abspar, absunite, abscng, abssanc,
      abspayer: abspayer ? 'O' : 'N',
      absrepos: absrepos ? '1' : '0',
      absferier: absferier ? 'O' : 'N',
      absaut: absaut ? 1 : 0,
    };
    const cb = {
      onSuccess: () => { showSnack(mode === 'save' ? 'Nature ajoutée avec succès' : 'Nature modifiée avec succès', 'success'); refetch(); resetForm(); },
      onError: (err: any) => showSnack(err?.response?.data?.message || 'Erreur', 'error'),
    };
    mode === 'save' ? addAbsence(payload, cb) : editAbsence(payload, cb);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteAbsence({ soccod, code: deleteTarget.abscod }, {
      onSuccess: () => { showSnack('Nature supprimée', 'success'); refetch(); setDeleteTarget(null); },
      onError: () => showSnack('Erreur lors de la suppression', 'error'),
    });
  };

  const handleEdit = (a: any) => {
    setSelectedAbsence(a);
  };

  // Filter + paginate
  const PAGE_SIZE = 10;
  const filtered = useMemo(() => {
    const arr = Array.isArray(absences) ? absences : [];
    return arr.filter((a: Absence) => {
      const matchSearch = !searchQ || a.abslib?.toLowerCase().includes(searchQ.toLowerCase()) || a.abscod?.toLowerCase().includes(searchQ.toLowerCase());
      return matchSearch;
    });
  }, [absences, searchQ, filterTab]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // const imputationLabel = IMPUTATION_OPTIONS.find(o => o.value === abscng)?.label || '—';

  return (
    <Box className="ia-container">
      {/* Config section */}
      <Box className="ia-config-grid">
        {/* Form pillar */}
        <Box className="ia-form-col">
          {/* Main form card */}
          <Paper className="ia-card">
            <Box className="ia-card-header">
              <Typography className="ia-card-title">Configuration de la Nature</Typography>
              <span className="ia-mode-badge">{mode === 'edit' ? 'Mode Édition' : 'Nouveau'}</span>
            </Box>
            <Box className="ia-form-grid">
              <Box>
                <Typography className="ia-field-label">Code Nature</Typography>
                <TextField size="small" fullWidth value={abscod} onChange={e => setAbscod(e.target.value)}
                  InputProps={{ readOnly: mode === 'edit' }} className="ia-input" />
              </Box>
              <Box>
                <Typography className="ia-field-label">Libellé</Typography>
                <TextField size="small" fullWidth value={abslib} onChange={e => setAbslib(e.target.value)} className="ia-input" />
              </Box>
              <Box>
                <Typography className="ia-field-label">Unité de calcul</Typography>
                <Box className="ia-unit-toggle">
                  <button className={`ia-unit-btn ${absunite === 'J' ? 'ia-unit-active' : ''}`} onClick={() => setAbsunite('J')}>Jours</button>
                  <button className={`ia-unit-btn ${absunite === 'H' ? 'ia-unit-active' : ''}`} onClick={() => setAbsunite('H')}>Heures</button>
                </Box>
              </Box>
              {/* <Box>
                <Typography className="ia-field-label">Périodicité</Typography>
                <FormControl fullWidth size="small">
                  <Select value={abspar} onChange={e => setAbspar(e.target.value)} className="ia-select">
                    <MenuItem value="A">Année civile</MenuItem>
                    <MenuItem value="M">Mois</MenuItem>
                    <MenuItem value="S">Semestre</MenuItem>
                    <MenuItem value="T">Trimestre</MenuItem>
                  </Select>
                </FormControl>
              </Box> */}
              <Box>
                <Typography className="ia-field-label">Type Sanction</Typography>
                <FormControl fullWidth size="small">
                  <Select value={abssanc} onChange={e => setAbssanc(e.target.value)} className="ia-select">
                    {SANCTION_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                  </Select>
                </FormControl>
              </Box>
            </Box>
          </Paper>

          {/* Calculation rules */}
          <Paper className="ia-card">
            <Typography className="ia-card-title" sx={{ mb: 2 }}>Règles de Calcul</Typography>
            <Box className="ia-toggles-grid">
              <Toggle checked={absaut} onChange={setAbsaut} label="Autoriser l'absence" />
              <Toggle checked={abspayer} onChange={setAbspayer} label="Payer l'absence" />
              <Toggle checked={absrepos} onChange={setAbsrepos} label="Compter jour repos" />
              <Toggle checked={absferier} onChange={setAbsferier} label="Compter jour férié" />
            </Box>
          </Paper>
        </Box>

        {/* Type imputation sidebar */}
        <Paper className="ia-imputation-card">
          <Typography className="ia-card-title" sx={{ mb: 2 }}>Type d'imputation</Typography>
          <Box className="ia-imputation-list">
            {IMPUTATION_OPTIONS.map(opt => (
              <label key={opt.value} className={`ia-imputation-item ${abscng === opt.value ? 'ia-imputation-active' : ''}`}>
                <span className="ia-imputation-label">{opt.label}</span>
                <input type="radio" name="imputation" value={opt.value} checked={abscng === opt.value}
                  onChange={() => setAbscng(opt.value)} className="ia-radio" />
              </label>
            ))}
          </Box>
          <Box className="ia-imputation-footer">
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button startIcon={<RefreshIcon />} onClick={resetForm} className="ia-btn-secondary">Nouveau</Button>
              {((mode === 'save' && canAdd) || (mode === 'edit' && canModify)) && (
                <Button variant="contained" startIcon={isSaving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
                  onClick={handleSave} disabled={isSaving} className="ia-btn-primary">
                  {mode === 'save' ? 'Enregistrer la nature' : 'Mettre à jour la nature'}
                </Button>
              )}
            </Box>
          </Box>
        </Paper>
      </Box>

      {/* Registre table */}
      <Box className="ia-table-section">
        <Box className="ia-table-header">
          <Box>
            <Typography className="ia-table-title">Registre des Natures</Typography>
            <Typography className="ia-table-sub">{filtered.length} types d'absences configurés</Typography>
          </Box>
          <Box className="ia-table-actions">
            <Box className="ia-filter-tabs">
              {(['all', 'active', 'archived'] as const).map(tab => (
                <button key={tab} className={`ia-filter-tab ${filterTab === tab ? 'ia-filter-tab-active' : ''}`}
                  onClick={() => setFilterTab(tab)}>
                  {tab === 'all' ? 'Toutes' : tab === 'active' ? 'Actives' : 'Archivées'}
                </button>
              ))}
            </Box>
            <TextField size="small" placeholder="Rechercher une nature..." value={searchQ}
              onChange={e => { setSearchQ(e.target.value); setPage(0); }}
              sx={{ width: 220, '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: '12px', backgroundColor: '#f8fafc' } }} />
          </Box>
        </Box>

        <Paper className="ia-table-paper">
          <Box className="ia-table-wrap">
            <table className="ia-table">
              <thead>
                <tr>
                  {['Code', 'Intitulé Absence', 'Congé', 'Payé', 'Sanction', 'Autorisé', 'Périodicité', 'Actions'].map((h, i) => (
                    <th key={h} className={`ia-th ${i >= 2 && i <= 5 ? 'ia-th-center' : ''} ${i === 7 ? 'ia-th-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={8} className="ia-empty-cell"><CircularProgress size={28} /></td></tr>
                ) : paginated.length === 0 ? (
                  <tr><td colSpan={8} className="ia-empty-cell">Aucune nature d'absence trouvée</td></tr>
                ) : paginated.map((a: Absence) => (
                  <tr key={a.abscod} className="ia-tr">
                    <td className="ia-td"><CodeBadge code={a.abscod} /></td>
                    <td className="ia-td ia-td-name">{a.abslib}</td>
                    <td className="ia-td ia-td-center"><BoolCell val={a.abscng} trueVal="0" /></td>
                    <td className="ia-td ia-td-center"><BoolCell val={a.abspayer} trueVal="O" /></td>
                    <td className="ia-td ia-td-center"><BoolCell val={a.abssanc} trueVal="O" /></td>
                    <td className="ia-td ia-td-center"><BoolCell val={a.absaut} trueVal={1} /></td>
                    <td className="ia-td ia-td-sub">{PERIODICITE_MAP[a.abspar] || a.abspar || '—'}</td>
                    <td className="ia-td ia-td-actions">
                      <Box className="ia-row-actions">
                        {canModify && (
                          <IconButton size="small" className="ia-action-edit" onClick={() => handleEdit(a)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        )}
                        {canDelete && (
                          <IconButton size="small" className="ia-action-delete" onClick={() => setDeleteTarget(a)}>
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
          <Box className="ia-pagination">
            <Typography className="ia-pagination-info">
              Affichage {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} sur {filtered.length}
            </Typography>
            <Box className="ia-pagination-btns">
              <IconButton size="small" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="ia-page-btn">
                <ChevronLeftIcon fontSize="small" />
              </IconButton>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => (
                <button key={i} className={`ia-page-num ${page === i ? 'ia-page-active' : ''}`} onClick={() => setPage(i)}>
                  {i + 1}
                </button>
              ))}
              <IconButton size="small" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="ia-page-btn">
                <ChevronRightIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        </Paper>
      </Box>

      <AlertModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        message={`Supprimer la nature "${deleteTarget?.abslib}" (${deleteTarget?.abscod}) ?`} />

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))} sx={{ borderRadius: '10px' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

const IntituleDesAbsencesModern = () => (
  <QueryClientProvider client={new QueryClient()}>
    <AbsenceProvider>
      <IntituleDesAbsencesModernInner />
    </AbsenceProvider>
  </QueryClientProvider>
);

export default IntituleDesAbsencesModern;
