import { useState, useMemo } from 'react';
import {
  Box, Typography, Button, Snackbar, Alert, CircularProgress,
  Checkbox, List, ListItem, ListItemButton, ListItemText, ListItemIcon,
} from '@mui/material';
import { LocalizationProvider, DatePicker, TimePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
import duration from 'dayjs/plugin/duration';
import { QueryClient, QueryClientProvider } from 'react-query';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import ScheduleIcon from '@mui/icons-material/Schedule';
import CategoryIcon from '@mui/icons-material/Category';
import GavelIcon from '@mui/icons-material/Gavel';
import PeopleIcon from '@mui/icons-material/People';
import useGetAbsencesLibs from '../../../../../hooks/absenceHooks/useGetAbsenceLibs';
import useGetEmployee from '../../../../../hooks/employeHooks/useGetEmployee';
import useAddBulkSortie from '../../../../../hooks/sortieHooks/useAddBulkSortie';
import useGetSortie from '../../../../../hooks/sortieHooks/useGetSortie';
import { Autoriser } from '../../../../../models/Autoriser';
import { useAuth } from '../../../../helper/AuthProvider';
import BreadcrumbNavigation from "../../../../helper/BreadcrumbNavigation";
import '../AutSortie/AutSortieModern.css';

dayjs.extend(duration);

function formatDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} H`;
}

function AutSortieGeneraleContent() {
  const { soccod, uticod } = useAuth();

  // Form state
  const [conmotif, setConmotif] = useState<string>('');
  const [abscod, setAbscod] = useState<string>('');
  const [conref, setConref] = useState<string>('');
  const [condat, setCondat] = useState<[Dayjs | null, Dayjs | null]>([dayjs(), dayjs()]);
  const [checkedEmployees, setCheckedEmployees] = useState<Set<string>>(new Set());
  const [showExceptionList, setShowExceptionList] = useState(false);

  // UI state
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' as any });
  const [isSaving, setIsSaving] = useState(false);

  // Hooks
  const { data: absencesRaw } = useGetAbsencesLibs();
  const absences = useMemo(() => {
    if (Array.isArray(absencesRaw)) return absencesRaw;
    if (absencesRaw && typeof absencesRaw === 'object') {
      return Object.entries(absencesRaw).map(([code, lib]) => ({ abscod: code, abslib: lib }));
    }
    return [];
  }, [absencesRaw]);

  const { data: employesRaw } = useGetEmployee();
  const employes = useMemo(() => {
    if (Array.isArray(employesRaw)) return employesRaw;
    if (employesRaw && typeof employesRaw === 'object') {
       return Object.entries(employesRaw).map(([code, lib]) => ({ empcod: code, emplib: lib }));
    }
    return [];
  }, [employesRaw]);

  const { mutate: addBulkSortie } = useAddBulkSortie();
  const { refetch } = useGetSortie(uticod);

  const hoursDiff = useMemo(() => {
    if (condat[0] && condat[1]) {
      const sMin = condat[0].hour() * 60 + condat[0].minute();
      const eMin = condat[1].hour() * 60 + condat[1].minute();
      let diff = eMin - sMin;
      if (diff < 0) diff += 24 * 60;
      return dayjs.duration(diff, 'minutes').asHours();
    }
    return 0;
  }, [condat]);



  const toggleEmployee = (empcod: string) => {
    const next = new Set(checkedEmployees);
    if (next.has(empcod)) next.delete(empcod);
    else next.add(empcod);
    setCheckedEmployees(next);
  };

  const generateUniqueConcod = () => {
    return Math.random().toString(36).substring(2, 12).toUpperCase();
  };

  const handleSubmit = () => {
    if (!abscod) {
      setSnack({ open: true, msg: 'Imputation est obligatoire.', sev: 'error' });
      return;
    }
    setIsSaving(true);

    // Filter employees NOT in exception list
    const targets = employes.filter(e => !checkedEmployees.has(e.empcod));

    const payload: Autoriser[] = targets.map(e => ({
      empcod: e.empcod,
      concod: generateUniqueConcod(),
      condat: condat[0]?.format('YYYY-MM-DD'),
      condep: `${condat[0]?.format('YYYY-MM-DD')}T${condat[0]?.format('HH:mm:ss')}`,
      conret: `${condat[1]?.format('YYYY-MM-DD')}T${condat[1]?.format('HH:mm:ss')}`,
      connbjour: parseFloat(hoursDiff.toFixed(2)),
      abscod,
      soccod: soccod || '01',
      conmotif,
      conref
    }));

    addBulkSortie(payload, {
      onSuccess: () => {
        setSnack({ open: true, msg: `${targets.length} autorisations générées avec succès.`, sev: 'success' });
        resetForm();
        setIsSaving(false);
      },
      onError: () => {
        setSnack({ open: true, msg: "Erreur lors de l'enregistrement en masse.", sev: 'error' });
        setIsSaving(false);
      }
    });
  };

  const resetForm = () => {
    setConmotif('');
    setAbscod('');
    setConref('');
    setCondat([dayjs(), dayjs()]);
    setCheckedEmployees(new Set());
    setShowExceptionList(false);
    refetch();
  };

  return (
    <Box className="aut-container">
      <Box className="aut-header">
        <Box>
          <BreadcrumbNavigation />
          <Typography className="aut-header-heading" sx={{ mt: 1 }}>Autorisation de Sortie Générale</Typography>
          <Typography className="aut-header-sub">Émission groupée pour l'ensemble du personnel</Typography>
        </Box>
        <Box className="aut-header-actions">
          <Button className="aut-cancel-btn" variant="outlined" startIcon={<RefreshIcon />} onClick={resetForm}>
            Réinitialiser
          </Button>
          <Button
            className="aut-save-btn"
            variant="contained"
            startIcon={isSaving ? <CircularProgress size={18} sx={{ color: '#1e293b' }} /> : <GavelIcon />}
            onClick={handleSubmit}
            disabled={isSaving}
          >
            {isSaving ? 'Génération...' : 'Émettre en Masse'}
          </Button>
        </Box>
      </Box>

      <Box className="aut-body">
        <Box className="aut-grid">
           <Box className="aut-grid-left">
              {/* Exceptions Toggle */}
              <Box className="aut-card" sx={{ border: '2px dashed #cbd5e1', background: '#f8fafc', py: 2 }}>
                 <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                       <PeopleIcon sx={{ color: '#64748b' }} />
                       <Box>
                          <Typography sx={{ fontWeight: 800, fontSize: '15px', color: '#1e293b' }}>Exceptions ({checkedEmployees.size})</Typography>
                          <Typography sx={{ fontSize: '12px', color: '#64748b' }}>Sélectionnez les employés à exclure de cet envoi</Typography>
                       </Box>
                    </Box>
                    <Button
                      variant={showExceptionList ? "contained" : "outlined"}
                      size="small"
                      onClick={() => setShowExceptionList(!showExceptionList)}
                      sx={{ borderRadius: '8px', textTransform: 'none' }}
                    >
                      {showExceptionList ? 'Masquer la liste' : 'Gérer les exceptions'}
                    </Button>
                 </Box>

                 {showExceptionList && (
                    <Box sx={{ mt: 2, maxHeight: '200px', overflowY: 'auto', bgcolor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                       <List dense>
                          {employes.map(e => (
                             <ListItem key={e.empcod} disablePadding divider>
                                <ListItemButton onClick={() => toggleEmployee(e.empcod)} dense>
                                   <ListItemIcon sx={{ minWidth: 40 }}>
                                      <Checkbox edge="start" checked={checkedEmployees.has(e.empcod)} disableRipple />
                                   </ListItemIcon>
                                   <ListItemText
                                      primary={e.emplib}
                                      secondary={e.empcod}
                                      primaryTypographyProps={{ fontSize: '13px', fontWeight: 600 }}
                                      secondaryTypographyProps={{ fontSize: '11px' }}
                                   />
                                </ListItemButton>
                             </ListItem>
                          ))}
                       </List>
                    </Box>
                 )}
              </Box>

              {/* Planning */}
              <Box className="aut-card">
                 <Box className="aut-card-header">
                    <Box className="aut-card-icon"><ScheduleIcon fontSize="small" /></Box>
                    <Typography className="aut-card-title">Planification Commune</Typography>
                 </Box>
                 <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="fr">
                    <Box className="aut-form-grid aut-form-grid--4">
                       <Box className="aut-field">
                          <label>Date de Sortie</label>
                          <DatePicker
                             value={condat[0]}
                             onChange={(v) => setCondat([v, condat[1]])}
                             format="DD/MM/YYYY"
                             slotProps={{ textField: { size: 'small', fullWidth: true } }}
                          />
                       </Box>
                       <Box className="aut-field">
                          <label>Début</label>
                          <TimePicker
                             value={condat[0]}
                             onChange={(v) => setCondat([v, condat[1]])}
                             ampm={false}
                             slotProps={{ textField: { size: 'small', fullWidth: true } }}
                          />
                       </Box>
                       <Box className="aut-field">
                          <label>Fin Prévue</label>
                          <TimePicker
                             value={condat[1]}
                             onChange={(v) => setCondat([condat[0], v])}
                             ampm={false}
                             slotProps={{ textField: { size: 'small', fullWidth: true } }}
                          />
                       </Box>
                       <Box className="aut-field">
                          <label>Durée</label>
                          <Box className="aut-duration-badge">{formatDuration(hoursDiff)}</Box>
                       </Box>
                    </Box>
                 </LocalizationProvider>
              </Box>

              <Box className="aut-card">
                 <Box className="aut-card-header">
                    <Box className="aut-card-icon"><SearchIcon fontSize="small" /></Box>
                    <Typography className="aut-card-title">Références</Typography>
                 </Box>
                 <Box className="aut-field">
                    <label>Référence Administrative</label>
                    <input
                       type="text"
                       placeholder="Note de service N°..."
                       value={conref}
                       onChange={(e) => setConref(e.target.value)}
                    />
                 </Box>
              </Box>
           </Box>

           <Box className="aut-grid-right">
              <Box className="aut-card aut-card--full">
                 <Box className="aut-card-header">
                    <Box className="aut-card-icon"><CategoryIcon fontSize="small" /></Box>
                    <Typography className="aut-card-title">Type d'Imputation</Typography>
                 </Box>
                 <Box className="aut-type-section">
                    <Box className="aut-type-list">
                       {absences.map((abs: any) => (
                          <label
                             key={abs.abscod}
                             className={`aut-type-item ${abscod === abs.abscod ? 'aut-type-item--active' : ''}`}
                             onClick={() => setAbscod(abs.abscod)}
                          >
                             <input type="radio" checked={abscod === abs.abscod} readOnly />
                             <span>{abs.abslib}</span>
                             <span className="aut-type-dot" />
                          </label>
                       ))}
                    </Box>
                 </Box>
                 <Box className="aut-motif-section">
                    <label className="aut-section-label">Motif Collectif</label>
                    <textarea
                       className="aut-textarea"
                       placeholder="Justification pour l'ensemble des employés..."
                       rows={5}
                       value={conmotif}
                       onChange={(e) => setConmotif(e.target.value)}
                    />
                 </Box>
              </Box>
           </Box>
        </Box>
      </Box>

      <Snackbar open={snack.open} autoHideDuration={4000} onClose={() => setSnack(s => ({ ...s, open: false }))}>
        <Alert severity={snack.sev} onClose={() => setSnack(s => ({ ...s, open: false }))} sx={{ borderRadius: '10px' }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}

export default function AutSortieGenerale() {
  const qc = new QueryClient();
  return <QueryClientProvider client={qc}><AutSortieGeneraleContent /></QueryClientProvider>;
}