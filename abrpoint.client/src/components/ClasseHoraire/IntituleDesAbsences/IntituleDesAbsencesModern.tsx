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
import { useTranslation } from 'react-i18next';
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
import apiInstance from '../../API/apiInstance';

// ── Type imputation values (labels resolved via i18n at render time) ──────────
// 'R' = RTT (Réduction du Temps de Travail) — utilisé comme classifieur
// pour reconnaître une absence comme un congé RTT (loi française).
const IMPUTATION_VALUES = ['0', '8', '1', '2', '6', 'A', 'C', 'M', '3', '4', 'B', '5', '7', 'V', 'R', 'E'];
const SANCTION_VALUES = ['N', 'O', 'C', 'F'];

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
  const { t } = useTranslation();
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
  const [searchQ, setSearchQ] = useState('');
  const [page, setPage] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<Absence | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const { hasPermission } = useAuth();
  const canAdd = hasPermission('Paramètres de Temps', 'add');
  const canModify = hasPermission('Paramètres de Temps', 'modify');
  const canDelete = hasPermission('Paramètres de Temps', 'delete');

  if (!hasPermission('Paramètres de Temps', 'consult')) {
    return <AccessDenied message={t('intituleAbsences.noConsultRight')} />;
  }

  const { data: absences = [], isLoading, refetch } = useGetAllAbsences();
  const { mutate: addAbsence, isPending: adding } = useAddAbsence();
  const { mutate: editAbsence, isPending: editing } = useUpdateAbsence();
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

  // Pré-charge le prochain code absence quand on ouvre le formulaire en mode "Nouveau".
  // L'utilisateur voit immédiatement le code attribué (et peut le modifier s'il veut un
  // code lisible type "CP" plutôt que "0001").
  const fetchNextAbscod = async () => {
    if (!soccod) return;
    try {
      const r = await apiInstance.get(`/Absences/get-next-abscod/${soccod}`);
      if (r.data?.abscod) setAbscod(r.data.abscod);
    } catch { /* fallback : champ vide, le serveur auto-générera au save */ }
  };

  const resetForm = () => {
    setAbscod(''); setAbslib(''); setAbspar('A'); setAbsunite('J');
    setAbscng('0'); setAbssanc('N'); setAbspayer(false); setAbsrepos(false);
    setAbsferier(false); setAbsaut(false); setMode('save');
    setSelectedAbsence(null as any);
    fetchNextAbscod();
  };

  // Au montage initial : si on est en mode "save" et qu'aucune absence n'est sélectionnée,
  // on pré-remplit le code.
  useEffect(() => {
    if (mode === 'save' && !selectedAbsence && !abscod) fetchNextAbscod();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = () => {
    const payload: any = {
      soccod, abscod, abslib, abspar, absunite, abscng, abssanc,
      abspayer: abspayer ? 'O' : 'N',
      absrepos: absrepos ? '1' : '0',
      absferier: absferier ? 'O' : 'N',
      absaut: absaut ? 1 : 0,
    };
    const cb = {
      onSuccess: () => { showSnack(mode === 'save' ? t('intituleAbsences.msg.addedSuccess') : t('intituleAbsences.msg.updatedSuccess'), 'success'); refetch(); resetForm(); },
      onError: (err: any) => showSnack(err?.response?.data?.message || t('intituleAbsences.msg.genericError'), 'error'),
    };
    mode === 'save' ? addAbsence(payload, cb) : editAbsence(payload, cb);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteAbsence({ soccod, code: deleteTarget.abscod }, {
      onSuccess: () => { showSnack(t('intituleAbsences.msg.deletedSuccess'), 'success'); refetch(); setDeleteTarget(null); },
      onError: () => showSnack(t('intituleAbsences.msg.deleteError'), 'error'),
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
  }, [absences, searchQ]);

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
              <Typography className="ia-card-title">{t('intituleAbsences.config.title')}</Typography>
              <span className="ia-mode-badge">{mode === 'edit' ? t('intituleAbsences.config.modeEdit') : t('intituleAbsences.config.modeNew')}</span>
            </Box>
            <Box className="ia-form-grid">
              <Box>
                <Typography className="ia-field-label">{t('intituleAbsences.config.codeNature')}</Typography>
                <TextField size="small" fullWidth value={abscod} onChange={e => setAbscod(e.target.value)}
                  InputProps={{ readOnly: mode === 'edit' }} className="ia-input" />
              </Box>
              <Box>
                <Typography className="ia-field-label">{t('intituleAbsences.config.label')}</Typography>
                <TextField size="small" fullWidth value={abslib} onChange={e => setAbslib(e.target.value)} className="ia-input" />
              </Box>
              <Box>
                <Typography className="ia-field-label">{t('intituleAbsences.config.calculationUnit')}</Typography>
                <Box className="ia-unit-toggle">
                  <button className={`ia-unit-btn ${absunite === 'J' ? 'ia-unit-active' : ''}`} onClick={() => setAbsunite('J')}>{t('intituleAbsences.config.days')}</button>
                  <button className={`ia-unit-btn ${absunite === 'H' ? 'ia-unit-active' : ''}`} onClick={() => setAbsunite('H')}>{t('intituleAbsences.config.hours')}</button>
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
                <Typography className="ia-field-label">{t('intituleAbsences.config.sanctionType')}</Typography>
                <FormControl fullWidth size="small">
                  <Select value={abssanc} onChange={e => setAbssanc(e.target.value)} className="ia-select">
                    {SANCTION_VALUES.map(v => <MenuItem key={v} value={v}>{t(`intituleAbsences.sanction.${v}`)}</MenuItem>)}
                  </Select>
                </FormControl>
              </Box>
            </Box>
          </Paper>

          {/* Calculation rules */}
          <Paper className="ia-card">
            <Typography className="ia-card-title" sx={{ mb: 2 }}>{t('intituleAbsences.rules.title')}</Typography>
            <Box className="ia-toggles-grid">
              <Toggle checked={absaut} onChange={setAbsaut} label={t('intituleAbsences.rules.allowAbsence')} />
              <Toggle checked={abspayer} onChange={setAbspayer} label={t('intituleAbsences.rules.payAbsence')} />
              <Toggle checked={absrepos} onChange={setAbsrepos} label={t('intituleAbsences.rules.countRest')} />
              <Toggle checked={absferier} onChange={setAbsferier} label={t('intituleAbsences.rules.countHoliday')} />
            </Box>
          </Paper>
        </Box>

        {/* Type imputation sidebar */}
        <Paper className="ia-imputation-card">
          <Typography className="ia-card-title" sx={{ mb: 2 }}>{t('intituleAbsences.imputation.title')}</Typography>
          <Box className="ia-imputation-list">
            {IMPUTATION_VALUES.map(v => (
              <label key={v} className={`ia-imputation-item ${abscng === v ? 'ia-imputation-active' : ''}`}>
                <span className="ia-imputation-label">{t(`intituleAbsences.imputationOptions.${v}`)}</span>
                <input type="radio" name="imputation" value={v} checked={abscng === v}
                  onChange={() => setAbscng(v)} className="ia-radio" />
              </label>
            ))}
          </Box>
          <Box className="ia-imputation-footer">
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button startIcon={<RefreshIcon />} onClick={resetForm} className="ia-btn-secondary">{t('intituleAbsences.imputation.newButton')}</Button>
              {((mode === 'save' && canAdd) || (mode === 'edit' && canModify)) && (
                <Button variant="contained" startIcon={isSaving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
                  onClick={handleSave} disabled={isSaving} className="ia-btn-primary">
                  {mode === 'save' ? t('intituleAbsences.imputation.save') : t('intituleAbsences.imputation.update')}
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
            <Typography className="ia-table-title">{t('intituleAbsences.table.title')}</Typography>
            <Typography className="ia-table-sub">{t('intituleAbsences.table.subtitle', { count: filtered.length })}</Typography>
          </Box>
          <Box className="ia-table-actions">
            <TextField size="small" placeholder={t('intituleAbsences.table.search')} value={searchQ}
              onChange={e => { setSearchQ(e.target.value); setPage(0); }}
              sx={{ width: 220, '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: '12px', backgroundColor: '#f8fafc' } }} />
          </Box>
        </Box>

        <Paper className="ia-table-paper">
          <Box className="ia-table-wrap">
            <table className="ia-table">
              <thead>
                <tr>
                  {(['code','label','leave','paid','sanction','authorized','periodicity','actions'] as const).map((h, i) => (
                    <th key={h} className={`ia-th ${i >= 2 && i <= 5 ? 'ia-th-center' : ''} ${i === 7 ? 'ia-th-right' : ''}`}>{t(`intituleAbsences.table.headers.${h}`)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={8} className="ia-empty-cell"><CircularProgress size={28} /></td></tr>
                ) : paginated.length === 0 ? (
                  <tr><td colSpan={8} className="ia-empty-cell">{t('intituleAbsences.table.empty')}</td></tr>
                ) : paginated.map((a: Absence) => (
                  <tr key={a.abscod} className="ia-tr">
                    <td className="ia-td"><CodeBadge code={a.abscod} /></td>
                    <td className="ia-td ia-td-name">{a.abslib}</td>
                    <td className="ia-td ia-td-center"><BoolCell val={a.abscng} trueVal="0" /></td>
                    <td className="ia-td ia-td-center"><BoolCell val={a.abspayer} trueVal="O" /></td>
                    <td className="ia-td ia-td-center"><BoolCell val={a.abssanc} trueVal="O" /></td>
                    <td className="ia-td ia-td-center"><BoolCell val={a.absaut} trueVal={1} /></td>
                    <td className="ia-td ia-td-sub">{a.abspar ? t(`intituleAbsences.periodicite.${a.abspar}`, { defaultValue: a.abspar }) : '—'}</td>
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
              {t('intituleAbsences.table.showing', { from: page * PAGE_SIZE + 1, to: Math.min((page + 1) * PAGE_SIZE, filtered.length), total: filtered.length })}
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
        message={t('intituleAbsences.confirmDelete', { label: deleteTarget?.abslib ?? '', code: deleteTarget?.abscod ?? '' })} />

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))} sx={{ borderRadius: '10px' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

const IntituleDesAbsencesModern = () => (
  <AbsenceProvider>
      <IntituleDesAbsencesModernInner />
    </AbsenceProvider>
);

export default IntituleDesAbsencesModern;
