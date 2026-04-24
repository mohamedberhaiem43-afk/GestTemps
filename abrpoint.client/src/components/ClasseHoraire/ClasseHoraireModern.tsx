import {
  Box, Typography, Paper, Button, TextField, MenuItem,
  FormControl, Select, FormControlLabel, IconButton,
  Snackbar, Alert, Chip, Dialog,
  DialogTitle, DialogContent, DialogActions, Divider, Switch,
} from '@mui/material';
import { useEffect, useState, useMemo } from 'react';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import WorkIcon from '@mui/icons-material/Work';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import NightlightIcon from '@mui/icons-material/Nightlight';
import ScheduleIcon from '@mui/icons-material/Schedule';
import GroupIcon from '@mui/icons-material/Group';
import { QueryClient, QueryClientProvider } from 'react-query';
import { useAuth } from '../helper/AuthProvider';
import AccessDenied from '../helper/AccessDenied';
import './ClasseHoraireModern.css';
import { Lcategorie } from '../../models/Lcategorie';
import usePostLcategorie from '../../hooks/lcategoriesHooks/usePostLcategorie';
import useUpdateLcategorie from '../../hooks/lcategoriesHooks/useUpdateLcategorie';
import { PosteHoraire } from '../../models/PosteHoraire';
import useDeleteLcategorie from '../../hooks/lcategoriesHooks/useDeleteLcategorie';
import useGetLcategories from '../../hooks/lcategoriesHooks/useGetLcategories';
import useGetPoste from '../../hooks/posteHooks/useGetPoste';
import useGetPostesData from '../../hooks/posteHooks/useGetPostesData';
import AlertModal from '../AlertModal/AlertModal';
import { useClasseHoraireContext, ClasseHoraireProvider } from '../helper/ClasseHoraireContext';

// ── helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (val: any) => {
  if (!val) return '';
  const d = new Date(val);
  return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
};

const fmtDateShort = (val: any) => {
  if (!val) return '—';
  try { return new Date(val).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }); }
  catch { return '—'; }
};

const DAYS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'];

const DAY_KEYS = [
  { matin: ['lunhdematin', 'lunhdmat', 'lunhfematin', 'lunhfmat'], aprem: ['lunhdeamidi', 'lunhdam', 'lunhfam', 'lunhfeamidi'], repos: 'lunrepos' },
  { matin: ['marhdematin', 'marhdmat', 'marhfematin', 'marhfmat'], aprem: ['marhdeamidi', 'marhdam', 'marhfam', 'marhfeamidi'], repos: 'marrepos' },
  { matin: ['merhdematin', 'merhdmat', 'merhfematin', 'merhfmat'], aprem: ['merhdeamidi', 'merhdam', 'merhfam', 'merhfeamidi'], repos: 'merrepos' },
  { matin: ['jeuhdematin', 'jeuhdmat', 'jeuhfematin', 'jeuhfmat'], aprem: ['jeuhdeamidi', 'jeuhdam', 'jeuhfam', 'jeuhfeamidi'], repos: 'jeurepos' },
  { matin: ['venhdematin', 'venhdmat', 'venhfematin', 'venhfmat'], aprem: ['venhdeamidi', 'venhdam', 'venhfam', 'venhfeamidi'], repos: 'venrepos' },
  { matin: ['samhdematin', 'samhdmat', 'samhfematin', 'samhfmat'], aprem: ['samhdeamidi', 'samhdam', 'samhfam', 'samhfeamidi'], repos: 'samrepos' },
  { matin: ['dimhdematin', 'dimhdmat', 'dimhfematin', 'dimhfmat'], aprem: ['dimhdeamidi', 'dimhdam', 'dimhfam', 'dimhfeamidi'], repos: 'dimrepos' },
];

// ── Day Card ──────────────────────────────────────────────────────────────────
function DayCard({ dayIndex, poste }: { dayIndex: number; poste: PosteHoraire }) {
  const dk = DAY_KEYS[dayIndex];
  const p = poste as any;
  const isRest = p[dk.repos] === '1';
  const matinIn = p[dk.matin[1]] || '';
  const matinOut = p[dk.matin[3]] || '';
  const apremIn = p[dk.aprem[1]] || '';
  const apremOut = p[dk.aprem[2]] || '';
  const isNight = matinIn && parseInt(matinIn.replace(':', '')) >= 2000;

  return (
    <Box className={`chm-day-card ${isRest ? 'chm-day-rest' : 'chm-day-work'}`}>
      <Box className="chm-day-top">
        <Typography className="chm-day-label">{DAYS[dayIndex]}</Typography>
        <Typography className="chm-day-num">{String(dayIndex + 1).padStart(2, '0')}</Typography>
      </Box>
      {isRest ? (
        <Box className="chm-day-rest-body">
          <Typography className="chm-rest-text">Repos</Typography>
        </Box>
      ) : (
        <Box className="chm-day-slots">
          <Box className="chm-slot chm-slot-matin">
            <Typography className="chm-slot-lbl">Matin</Typography>
            <Typography className="chm-slot-time">{matinIn || '--:--'}</Typography>
          </Box>
          {(matinIn || matinOut) && (
            <Box className={`chm-slot ${isNight ? 'chm-slot-nuit' : 'chm-slot-aprem'}`}>
              <Typography className="chm-slot-lbl">{isNight ? 'Nuit' : 'AM'}</Typography>
              <Typography className="chm-slot-time chm-slot-time-accent">
                {matinIn || '--:--'} - {matinOut || '--:--'}
              </Typography>
            </Box>
          )}
          {apremIn && (
            <Box className="chm-slot chm-slot-aprem2">
              <Typography className="chm-slot-lbl">Après-midi</Typography>
              <Typography className="chm-slot-time">{apremIn} - {apremOut}</Typography>
            </Box>
          )}
        </Box>
      )}
      <Box className="chm-day-footer">
        <WorkIcon sx={{ fontSize: 14, color: '#cbd5e1' }} />
      </Box>
    </Box>
  );
}

// ── Poste Selector Card ───────────────────────────────────────────────────────
function PosteCard({ code, label, selected, onClick }: { code: string; label: string; selected: boolean; onClick: () => void }) {
  const isNight = label.toLowerCase().includes('nuit');
  const isMatin = label.toLowerCase().includes('matin');
  const icon = isNight
    ? <NightlightIcon sx={{ fontSize: 18 }} />
    : isMatin ? <GroupIcon sx={{ fontSize: 18 }} /> : <ScheduleIcon sx={{ fontSize: 18 }} />;
  return (
    <Box className={`chm-poste-card ${selected ? 'chm-poste-card-active' : ''}`} onClick={onClick}>
      <Box className="chm-poste-card-icon">{icon}</Box>
      <Box>
        <Typography className="chm-poste-card-name">{label || code}</Typography>
        <Typography className="chm-poste-card-code">{code}</Typography>
      </Box>
    </Box>
  );
}

// ── Period Form Dialog ────────────────────────────────────────────────────────
// Pour Non Périodique (frequence !== 'S') : 1 seul poste par période (codposte), catsem2..6 = null
// Pour Selon Pointeuse (frequence === 'S') : rotation hebdomadaire, jusqu'à 6 postes
function PeriodFormDialog({
  open, onClose, onSave, editData, postesMap, inheritCatcod, inheritCatlib, frequence,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<Lcategorie>) => void;
  editData: Partial<Lcategorie> | null;
  postesMap: Record<string, string>;
  inheritCatcod?: string;
  inheritCatlib?: string;
  frequence: string;
}) {
  const [catcod, setCatcod] = useState('');
  const [catlib, setCatlib] = useState('');
  const [catdu, setCatdu] = useState('');
  const [catau, setCatau] = useState('');
  const [cathsup, setCathsup] = useState('0');
  // Non Périodique : un seul poste par période
  const [singlePoste, setSinglePoste] = useState('');
  // Selon Pointeuse : rotation hebdomadaire (jusqu'à 6 semaines)
  const [postes, setPostes] = useState<string[]>(['']);

  useEffect(() => {
    if (!open) return;
    if (editData) {
      setCatcod(editData.catcod || '');
      setCatlib(editData.catlib || '');
      setCatdu(fmtDate(editData.catdu));
      setCatau(fmtDate(editData.catau));
      setCathsup(editData.cathsup || '0');
      if (frequence === 'S') {
        const arr: string[] = [];
        if (editData.codposte) arr.push(editData.codposte);
        if (editData.catsem2) arr.push(editData.catsem2);
        if (editData.catsem3) arr.push(editData.catsem3);
        if (editData.catsem4) arr.push(editData.catsem4);
        if (editData.catsem5) arr.push(editData.catsem5);
        if (editData.catsem6) arr.push(editData.catsem6);
        setPostes(arr.length > 0 ? arr : ['']);
        setSinglePoste('');
      } else {
        // Non Périodique : on lit uniquement codposte, on ignore catsem*
        setSinglePoste(editData.codposte || '');
        setPostes(['']);
      }
    } else {
      setCatcod(inheritCatcod || '');
      setCatlib(inheritCatlib || '');
      setCatdu('');
      setCatau('');
      setCathsup('0');
      setSinglePoste('');
      setPostes(['']);
    }
  }, [editData, open, inheritCatcod, inheritCatlib, frequence]);

  const handleSave = () => {
    const payload: Partial<Lcategorie> = {
      catcod,
      catlib,
      cathsup,
      catfixe: '0',
      catdu: catdu ? new Date(catdu) : null,
      catau: catau ? new Date(catau) : null,
      ordre: (editData as any)?.ordre,
    };

    if (frequence === 'S') {
      // Selon Pointeuse : rotation hebdomadaire — on peuple catsem*
      payload.codposte = postes[0] || '';
      payload.catsem2 = postes[1] || null;
      payload.catsem3 = postes[2] || null;
      payload.catsem4 = postes[3] || null;
      payload.catsem5 = postes[4] || null;
      payload.catsem6 = postes[5] || null;
    } else {
      // Non Périodique : un poste unique par période, catsem* toujours null
      payload.codposte = singlePoste;
      payload.catsem2 = null;
      payload.catsem3 = null;
      payload.catsem4 = null;
      payload.catsem5 = null;
      payload.catsem6 = null;
    }

    onSave(payload);
  };

  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: '8px', backgroundColor: '#f8fafc',
      '& fieldset': { borderColor: '#e2e8f0' },
    },
  };

  // Quand on ajoute une période à une classe existante, on hérite du code/lib sans les afficher
  const isNewWithInherit = !editData && !!inheritCatcod;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      sx={{
        '& .MuiDialog-container': { alignItems: 'center' },
        '& .MuiDialog-paper': {
          margin: { xs: '16px', sm: '32px' },
          width: { xs: 'calc(100% - 32px)', sm: 'auto' },
          maxWidth: { xs: '100%', sm: '500px' },
        },
      }}
      PaperProps={{ sx: { borderRadius: '16px' } }}
    >
      <DialogTitle sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '17px', pb: 1 }}>
        {editData ? 'Modifier la période' : 'Nouvelle période'}
        {isNewWithInherit && (
          <Typography sx={{ fontSize: '11px', color: '#0040a1', fontWeight: 600, mt: 0.5 }}>
            Classe : {inheritCatcod} — {inheritCatlib}
          </Typography>
        )}
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>

        {/* Code + Libellé — masqués quand on ajoute à une classe existante */}
        {!isNewWithInherit && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 2fr' }, gap: 2 }}>
            <Box>
              <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
                Code Classe
              </Typography>
              <TextField size="small" fullWidth value={catcod} onChange={e => setCatcod(e.target.value)} sx={fieldSx} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
                Libellé
              </Typography>
              <TextField size="small" fullWidth value={catlib} onChange={e => setCatlib(e.target.value)} sx={fieldSx} />
            </Box>
          </Box>
        )}

        {/* Plage de dates */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
              Du
            </Typography>
            <TextField
              size="small" fullWidth type="date" value={catdu}
              onChange={e => setCatdu(e.target.value)} sx={fieldSx}
              InputLabelProps={{ shrink: true }}
            />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
              Au
            </Typography>
            <TextField
              size="small" fullWidth type="date" value={catau}
              onChange={e => setCatau(e.target.value)} sx={fieldSx}
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        </Box>

        <FormControlLabel
          control={<Switch checked={cathsup === '1'} onChange={e => setCathsup(e.target.checked ? '1' : '0')} size="small" />}
          label={<Typography sx={{ fontSize: '13px', fontWeight: 500 }}>Heures supplémentaires</Typography>}
        />

        <Divider />

        {/* Section poste */}
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {frequence === 'S' ? 'Postes par Semaine (Rotation)' : 'Poste de Travail'}
            </Typography>
            {frequence === 'S' && (
              <Typography sx={{ fontSize: '10px', color: '#94a3b8' }}>
                {postes.filter(Boolean).length} semaine{postes.filter(Boolean).length !== 1 ? 's' : ''}
              </Typography>
            )}
          </Box>

          {frequence === 'S' ? (
            /* Selon Pointeuse : un poste par semaine de rotation */
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {postes.map((p, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    label={`S${i + 1}`}
                    size="small"
                    sx={{ background: '#dbeafe', color: '#1d4ed8', fontWeight: 700, fontSize: '10px', minWidth: 32 }}
                  />
                  <FormControl size="small" sx={{ flex: 1 }}>
                    <Select
                      value={p}
                      displayEmpty
                      onChange={e => { const u = [...postes]; u[i] = e.target.value; setPostes(u); }}
                      sx={{ borderRadius: '8px', backgroundColor: '#f8fafc', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e2e8f0' } }}
                    >
                      <MenuItem value=""><em style={{ color: '#94a3b8' }}>Sélectionner un poste</em></MenuItem>
                      {Object.entries(postesMap).map(([k, v]) => (
                        <MenuItem key={k} value={k}>
                          {String(v)} <span style={{ color: '#94a3b8', fontSize: '11px', marginLeft: 6 }}>({k})</span>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {postes.length > 1 && (
                    <IconButton
                      size="small"
                      onClick={() => setPostes(postes.filter((_, j) => j !== i))}
                      sx={{ color: '#ef4444', '&:hover': { background: '#fee2e2' } }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              ))}
              {postes.length < 6 && (
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setPostes([...postes, ''])}
                  sx={{ mt: 1, textTransform: 'none', fontWeight: 600, color: '#0040a1', fontSize: '12px', alignSelf: 'flex-start' }}
                >
                  Ajouter une semaine
                </Button>
              )}
            </Box>
          ) : (
            /* Non Périodique : un seul poste par période — pas de rotation */
            <FormControl fullWidth size="small">
              <Select
                value={singlePoste}
                displayEmpty
                onChange={e => setSinglePoste(e.target.value)}
                sx={{ borderRadius: '8px', backgroundColor: '#f8fafc', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e2e8f0' } }}
              >
                <MenuItem value=""><em style={{ color: '#94a3b8' }}>Sélectionner un poste</em></MenuItem>
                {Object.entries(postesMap).map(([k, v]) => (
                  <MenuItem key={k} value={k}>
                    {String(v)} <span style={{ color: '#94a3b8', fontSize: '11px', marginLeft: 6 }}>({k})</span>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ borderRadius: '8px', textTransform: 'none', color: '#64748b' }}>
          Annuler
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700, background: 'linear-gradient(135deg, #0040a1 0%, #0056d2 100%)' }}
        >
          {editData ? 'Modifier' : 'Ajouter la période'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
function ClasseHoraireModernInner() {
  const { selectedClasseHoraire, setSelectedClasseHoraire, setFrequence, setSelectedPoste } = useClasseHoraireContext();

  const [classeCode, setClasseCode] = useState('');
  const [classeLib, setClasseLib] = useState('');
  // classeFreq est initialisé une seule fois depuis les données,
  // il ne doit PAS être réécrit à chaque clic sur une période existante.
  const [classeFreq, setClasseFreq] = useState('N');
  const [activePeriod, setActivePeriod] = useState<any>(null);
  const [selectedPosteCode, setSelectedPosteCode] = useState('');
  const [periodDialogOpen, setPeriodDialogOpen] = useState(false);
  const [editPeriod, setEditPeriod] = useState<any>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' | 'warning' });

  const { hasPermission } = useAuth();
  const canAdd = hasPermission('Paramètres de Temps', 'add');
  const canModify = hasPermission('Paramètres de Temps', 'modify');
  const canDelete = hasPermission('Paramètres de Temps', 'delete');

  if (!hasPermission('Paramètres de Temps', 'consult')) {
    return <AccessDenied message="Vous n'avez pas le droit de consulter les classes horaires." />;
  }

  const { data: postesList = [] } = useGetPoste();
  const { data: classesList = [], refetch: refetchClasses } = useGetLcategories(classeFreq || 'N');
  const { data: posteData = {} as PosteHoraire } = useGetPostesData(
    activePeriod?.codposte ?? selectedClasseHoraire?.codposte ?? '',
    activePeriod?.catcod ?? selectedClasseHoraire?.catcod ?? ''
  );
  const { mutateAsync: saveLcategorie } = usePostLcategorie();
  const { mutateAsync: updateLcategorie } = useUpdateLcategorie();
  const { mutateAsync: deleteLcategorie, isLoading: deleting } = useDeleteLcategorie();

  // Map code → libellé des postes
  const postesMap: Record<string, string> = useMemo(() => {
    if (!postesList || !Array.isArray(postesList)) {
      return (postesList as unknown as Record<string, string>) ?? {};
    }
    return {};
  }, [postesList]);

  // Fréquence réelle dérivée des données (priorité sur le state local)
  // Cela évite que classeFreq soit mal initialisé si on change de classe
  const resolvedFreq = useMemo(() => {
    if (classesList.length > 0) {
      const matchRow = classesList.find((r: any) => r.catcod === classeCode);
      if (matchRow) return (matchRow as any).catperiode || classeFreq;
    }
    return classeFreq;
  }, [classesList, classeCode, classeFreq]);

  // Clic sur une période de la sidebar
  const handlePeriodClick = (row: any) => {
    setActivePeriod(row);
    setSelectedClasseHoraire({ ...row });
    setFrequence(row.catperiode || 'N');
    setSelectedPoste(row.codposte || '');
    setSelectedPosteCode(row.codposte || '');

    // On ne met à jour le code/lib/fréquence de classe que si on change de classe
    if (row.catcod !== classeCode) {
      setClasseCode(row.catcod || '');
      setClasseLib(row.catlib || '');
      setClasseFreq(row.catperiode || 'N');
    }
  };

  const showSnack = (msg: string, sev: 'success' | 'error' | 'warning') =>
    setSnackbar({ open: true, message: msg, severity: sev });

  const handleSavePeriod = async (data: Partial<Lcategorie>) => {
    // On force la fréquence résolue et on garantit la cohérence des catsem*
    // pour le mode Non Périodique
    const isNonPeriodique = resolvedFreq !== 'S';
    const payload: Lcategorie = {
      soccod: sessionStorage.getItem('soccod') || '',
      catperiode: resolvedFreq,
      ...data,
      // Sécurité : pour Non Périodique, catsem* toujours null même si data les contient
      ...(isNonPeriodique && {
        catsem2: null,
        catsem3: null,
        catsem4: null,
        catsem5: null,
        catsem6: null,
      }),
    };
    try {
      await saveLcategorie(payload);
      showSnack('Période enregistrée avec succès', 'success');
      setPeriodDialogOpen(false);
      setEditPeriod(null);
      refetchClasses();
    } catch {
      showSnack("Erreur lors de l'enregistrement", 'error');
    }
  };

  const handleDeletePeriod = async () => {
    setConfirmOpen(false);
    if (!activePeriod) return;
    try {
      await deleteLcategorie({ ...activePeriod, soccod: sessionStorage.getItem('soccod') || '' });
      showSnack('Période supprimée', 'success');
      setActivePeriod(null);
      setSelectedClasseHoraire(null);
      refetchClasses();
    } catch {
      showSnack('Erreur lors de la suppression', 'error');
    }
  };

  const handleApplyPoste = async () => {
    if (!selectedPosteCode || !activePeriod) return;
    try {
      // PUT — update only codposte, keep all other fields intact
      const payload: Lcategorie = {
        ...activePeriod,
        soccod: sessionStorage.getItem('soccod') || activePeriod.soccod || '',
        codposte: selectedPosteCode,
      };
      await updateLcategorie(payload);
      showSnack('Poste appliqué avec succès', 'success');
      setSelectedPoste(selectedPosteCode);
      setActivePeriod({ ...activePeriod, codposte: selectedPosteCode });
      refetchClasses();
    } catch {
      showSnack("Erreur lors de l'application du poste", 'error');
    }
  };

  // Périodes filtrées sur la classe active
  const filteredPeriods = useMemo(() => {
    if (!classeCode) return classesList;
    return classesList.filter((r: any) => r.catcod === classeCode);
  }, [classesList, classeCode]);

  // Postes distincts de toutes les périodes de la classe active
  const distinctPostes = useMemo(() => {
    const set = new Set<string>();
    filteredPeriods.forEach((r: any) => {
      ['codposte', 'catsem2', 'catsem3', 'catsem4', 'catsem5', 'catsem6'].forEach(k => {
        if (r[k]) set.add(r[k]);
      });
    });
    return set.size;
  }, [filteredPeriods]);

  // Couverture totale en jours de toutes les périodes de la classe active
  const totalCoverage = useMemo(() => {
    return filteredPeriods.reduce((sum: number, r: any) => {
      if (!r.catdu || !r.catau) return sum;
      return sum + Math.max(0, Math.round(
        (new Date(r.catau).getTime() - new Date(r.catdu).getTime()) / 86400000
      ) + 1);
    }, 0);
  }, [filteredPeriods]);

  const activePosteLabel = postesMap[activePeriod?.codposte || ''] || activePeriod?.codposte || '';

  // Tous les postes affectés à une période (codposte + catsem*)
  const getPeriodPostes = (row: any): string[] =>
    ['codposte', 'catsem2', 'catsem3', 'catsem4', 'catsem5', 'catsem6']
      .map(k => row[k])
      .filter(Boolean);

  return (
    <Box className="chm-container">
      <Box className="chm-layout">

        {/* ── Sidebar gauche ── */}
        <Box className="chm-sidebar">
          <Box className="chm-sidebar-header">
            <Typography className="chm-sidebar-title">Périodes de Saisonnalité</Typography>
            {canAdd && (
              <IconButton
                size="small"
                onClick={() => { setEditPeriod(null); setPeriodDialogOpen(true); }}
                sx={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', width: 28, height: 28 }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            )}
          </Box>

          {/* Timeline scrollable — filtrée sur la classe active */}
          <Box className="chm-timeline-scroll">
            {filteredPeriods.length === 0 ? (
              <Typography sx={{ color: '#94a3b8', fontSize: '12px', textAlign: 'center', py: 4 }}>
                Aucune période trouvée
              </Typography>
            ) : (
              filteredPeriods.map((row: any, i: number) => {
                const isActive =
                  activePeriod?.catcod === row.catcod &&
                  activePeriod?.catdu === row.catdu;
                const periodPostes = getPeriodPostes(row);
                return (
                  <Box
                    key={i}
                    className={`chm-period-item ${isActive ? 'chm-period-active' : ''}`}
                    onClick={() => handlePeriodClick(row)}
                  >
                    <Box className="chm-period-dot-col">
                      <Box className={`chm-period-dot ${isActive ? 'chm-dot-active' : ''}`} />
                      {i < filteredPeriods.length - 1 && <Box className="chm-period-line" />}
                    </Box>
                    <Box className="chm-period-body">
                      <Box className="chm-period-badge-row">
                        <Typography className={`chm-period-badge ${isActive ? 'chm-badge-active' : 'chm-badge-next'}`}>
                          {isActive ? 'Période Active' : 'Période Suivante'}
                        </Typography>
                        {canModify && (
                          <IconButton
                            size="small"
                            onClick={e => { e.stopPropagation(); setEditPeriod(row); setPeriodDialogOpen(true); }}
                            sx={{ padding: '2px' }}
                          >
                            <EditIcon sx={{ fontSize: 13, color: '#94a3b8' }} />
                          </IconButton>
                        )}
                      </Box>
                      <Typography className="chm-period-name">{row.catlib || row.catcod}</Typography>
                      <Typography className="chm-period-dates">
                        {fmtDateShort(row.catdu)} — {fmtDateShort(row.catau)}
                      </Typography>
                      {/* Postes affectés à cette période */}
                      {periodPostes.length > 0 && (
                        <Box className="chm-period-postes-list">
                          {periodPostes.map((pc, pi) => (
                            <Box key={pi} className="chm-period-poste-badge">
                              <WorkIcon sx={{ fontSize: 10 }} />
                              <Typography className="chm-period-poste-text">
                                {postesMap[pc] || pc}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      )}
                    </Box>
                  </Box>
                );
              })
            )}
            {canAdd && (
              <Box
                className="chm-add-period-btn"
                onClick={() => { setEditPeriod(null); setPeriodDialogOpen(true); }}
              >
                <AddIcon sx={{ fontSize: 14 }} />
                <Typography className="chm-add-period-text">Ajouter une période</Typography>
              </Box>
            )}
          </Box>

          {/* Résumé */}
          <Paper className="chm-summary">
            <Typography className="chm-summary-title">Résumé du Cycle</Typography>
            <Box className="chm-summary-rows">
              <Box className="chm-summary-row">
                <Typography className="chm-summary-lbl">Couverture Annuelle</Typography>
                <Typography className="chm-summary-val">{totalCoverage} / 365 Jours</Typography>
              </Box>
              <Box className="chm-summary-row">
                <Typography className="chm-summary-lbl">Postes Distincts</Typography>
                <Typography className="chm-summary-val">{distinctPostes} Poste{distinctPostes !== 1 ? 's' : ''}</Typography>
              </Box>
              <Box className="chm-summary-row">
                <Typography className="chm-summary-lbl">Classe ID</Typography>
                <Typography className="chm-summary-val">#{classeCode || '—'}</Typography>
              </Box>
            </Box>
          </Paper>
        </Box>

        {/* ── Contenu droit ── */}
        <Box className="chm-content">
          {/* Barre de prévisualisation */}
          <Box className="chm-preview-bar">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <CalendarMonthIcon sx={{ color: '#0040a1', fontSize: 22 }} />
              <Box>
                <Typography className="chm-preview-title">Configuration de la Semaine Type</Typography>
                <Typography className="chm-preview-sub">
                  Aperçu pour{' '}
                  <strong style={{ color: '#0040a1' }}>{activePeriod?.catlib || '—'}</strong>
                  {activePosteLabel && (
                    <> (Poste : <strong style={{ color: '#0040a1' }}>{activePosteLabel}</strong>)</>
                  )}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Chip
                label="Automatisé"
                size="small"
                sx={{ background: '#dcfce7', color: '#166534', fontWeight: 700, fontSize: '10px' }}
              />
              <Button
                startIcon={<RefreshIcon />}
                onClick={() => {
                  setActivePeriod(null);
                  setSelectedClasseHoraire(null);
                  setClasseCode('');
                  setClasseLib('');
                }}
                sx={{
                  borderRadius: '8px', textTransform: 'none', fontWeight: 600,
                  color: '#334155', border: '1px solid #e2e8f0', background: 'white', fontSize: '12px',
                }}
              >
                Nouveau
              </Button>
              {activePeriod && canDelete && (
                <Button
                  startIcon={<DeleteIcon />}
                  color="error"
                  disabled={deleting}
                  onClick={() => setConfirmOpen(true)}
                  sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '12px' }}
                >
                  Supprimer
                </Button>
              )}
            </Box>
          </Box>

          {/* Grille des 7 jours */}
          <Box className="chm-week-grid">
            {DAYS.map((_, i) => (
              <DayCard key={i} dayIndex={i} poste={posteData} />
            ))}
          </Box>

          {/* Sélecteur de poste */}
          <Paper className="chm-poste-selector">
            <Box className="chm-poste-selector-header">
              <Box>
                <Typography className="chm-poste-selector-title">Associer un Poste de Travail</Typography>
                <Typography className="chm-poste-selector-sub">Sélecteur de matrice opérationnelle</Typography>
              </Box>
            </Box>
            <Box className="chm-poste-cards-grid">
              {Object.entries(postesMap).slice(0, 6).map(([code, label]) => (
                <PosteCard
                  key={code}
                  code={code}
                  label={String(label)}
                  selected={selectedPosteCode === code}
                  onClick={() => { setSelectedPosteCode(code); setSelectedPoste(code); }}
                />
              ))}
            </Box>
            <Box className="chm-poste-selector-actions">
              <Button
                onClick={() => setSelectedPosteCode('')}
                sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, color: '#64748b', border: '1px solid #e2e8f0' }}
              >
                Annuler
              </Button>
              <Button
                variant="contained"
                onClick={handleApplyPoste}
                disabled={!selectedPosteCode || !activePeriod || !canModify}
                sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700, background: '#0040a1' }}
              >
                Appliquer au Segment
              </Button>
            </Box>
          </Paper>
        </Box>
      </Box>

      {/* Dialog ajout / modification de période */}
      <PeriodFormDialog
        open={periodDialogOpen}
        onClose={() => { setPeriodDialogOpen(false); setEditPeriod(null); }}
        onSave={handleSavePeriod}
        editData={editPeriod}
        postesMap={postesMap}
        // resolvedFreq garantit que le dialog reflète toujours la fréquence réelle de la classe
        frequence={resolvedFreq}
        inheritCatcod={!editPeriod ? classeCode : undefined}
        inheritCatlib={!editPeriod ? classeLib : undefined}
      />

      <AlertModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDeletePeriod}
        message={`Voulez-vous vraiment supprimer la période "${activePeriod?.catlib}" ?`}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar(s => ({ ...s, open: false }))}
          sx={{ borderRadius: '10px' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

const ClasseHoraireModern = () => (
  <QueryClientProvider client={new QueryClient()}>
    <ClasseHoraireProvider>
      <ClasseHoraireModernInner />
    </ClasseHoraireProvider>
  </QueryClientProvider>
);

export default ClasseHoraireModern;