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
import TuneIcon from '@mui/icons-material/Tune';
import { QueryClient, QueryClientProvider } from 'react-query';
import { useTranslation, Trans } from 'react-i18next';
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
import apiInstance from '../API/apiInstance';
import PointageAdjustDialog from '../Pointeuse/Adjustment/PointageAdjustDialog';
import OnboardingNextStepHint from '../Dashboard/OnboardingNextStepHint';

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
  const { t } = useTranslation();
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
          <Typography className="chm-rest-text">{t('classeHoraire.modern.day.rest')}</Typography>
        </Box>
      ) : (
        <Box className="chm-day-slots">
          <Box className="chm-slot chm-slot-matin">
            <Typography className="chm-slot-lbl">{t('classeHoraire.modern.day.morning')}</Typography>
            <Typography className="chm-slot-time">{matinIn || '--:--'}</Typography>
          </Box>
          {(matinIn || matinOut) && (
            <Box className={`chm-slot ${isNight ? 'chm-slot-nuit' : 'chm-slot-aprem'}`}>
              <Typography className="chm-slot-lbl">{isNight ? t('classeHoraire.modern.day.night') : t('classeHoraire.modern.day.afternoonShort')}</Typography>
              <Typography className="chm-slot-time chm-slot-time-accent">
                {matinIn || '--:--'} - {matinOut || '--:--'}
              </Typography>
            </Box>
          )}
          {apremIn && (
            <Box className="chm-slot chm-slot-aprem2">
              <Typography className="chm-slot-lbl">{t('classeHoraire.modern.day.afternoon')}</Typography>
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
// Deux types de classes :
//   • Périodique (frequence === 'N') : 1 seul poste pour toute la période
//     (codposte rempli, catsem2..6 = null).
//   • Selon pointage (frequence === 'S') : plusieurs postes coexistent dans la
//     même période, le système choisit celui qui correspond au pointage de
//     l'employé. catsem2..catsem6 portent les postes additionnels.
function PeriodFormDialog({
  open, onClose, onSave, editData, postesMap, inheritCatcod, inheritCatlib, frequence, classeExists, onFrequenceChange,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<Lcategorie>) => void;
  editData: Partial<Lcategorie> | null;
  postesMap: Record<string, string>;
  inheritCatcod?: string;
  inheritCatlib?: string;
  frequence: string;
  classeExists?: boolean;
  // Permet à la dialog d'informer le parent quand l'utilisateur choisit le type
  // (Périodique vs Selon pointage) à la création d'une nouvelle classe.
  onFrequenceChange?: (freq: string) => void;
}) {
  const { t } = useTranslation();
  const [catcod, setCatcod] = useState('');
  const [catlib, setCatlib] = useState('');
  const [catdu, setCatdu] = useState('');
  const [catau, setCatau] = useState('');
  const [cathsup, setCathsup] = useState('0');
  // Périodique : un seul poste par période
  const [singlePoste, setSinglePoste] = useState('');
  // Selon pointage : plusieurs postes simultanément disponibles (jusqu'à 6)
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

  // ⚠ TZ : `new Date("YYYY-MM-DD")` est interprété en UTC minuit. À la sérialisation JSON
  // (toISOString()), ça reste UTC. Le backend désérialise en heure locale ; sur n'importe
  // quel fuseau ouest de UTC (ou simplement UTC), la date bascule au jour précédent.
  // On crée donc un Date local-midi (12h) du jour saisi : la portion DATE est la même
  // pour tout fuseau positif comme négatif (>±12h hors zones tropicales extrêmes).
  const toLocalNoon = (s: string): Date | null => {
    if (!s) return null;
    const [y, m, d] = s.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d, 12, 0, 0);
  };

  const handleSave = () => {
    const payload: Partial<Lcategorie> = {
      catcod,
      catlib,
      cathsup,
      catfixe: '0',
      catdu: toLocalNoon(catdu),
      catau: toLocalNoon(catau),
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

  // Quand on ajoute une période à une classe DÉJÀ existante, on hérite du code/lib sans les afficher.
  // Pour une nouvelle classe (code auto-généré pré-rempli mais pas encore en base), on affiche
  // les champs pour permettre la saisie du libellé.
  const isNewWithInherit = !editData && !!inheritCatcod && !!classeExists;

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
        {editData ? t('classeHoraire.modern.dialog.editTitle') : t('classeHoraire.modern.dialog.newTitle')}
        {isNewWithInherit && (
          <Typography sx={{ fontSize: '11px', color: '#0040a1', fontWeight: 600, mt: 0.5 }}>
            {t('classeHoraire.modern.dialog.classInfo', { code: inheritCatcod, label: inheritCatlib })}
          </Typography>
        )}
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>

        {/* Sélecteur de type — visible uniquement à la création d'une nouvelle
            classe (pas en édition, pas quand on ajoute une période à une classe
            existante : le type est figé pour la classe entière). */}
        {!editData && !classeExists && onFrequenceChange && (
          <Box>
            <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1 }}>
              {t('classeHoraire.modern.dialog.frequenceTitle')}
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
              {[
                { key: 'N', titleKey: 'classeHoraire.modern.dialog.frequencePeriodique', subKey: 'classeHoraire.modern.dialog.frequencePeriodiqueSub', icon: <ScheduleIcon sx={{ fontSize: 18 }} /> },
                { key: 'S', titleKey: 'classeHoraire.modern.dialog.frequenceSelonPointage', subKey: 'classeHoraire.modern.dialog.frequenceSelonPointageSub', icon: <GroupIcon sx={{ fontSize: 18 }} /> },
              ].map(opt => {
                const active = frequence === opt.key;
                return (
                  <Box
                    key={opt.key}
                    onClick={() => onFrequenceChange(opt.key)}
                    sx={{
                      cursor: 'pointer',
                      borderRadius: '10px',
                      padding: '10px 12px',
                      display: 'flex', gap: 1.2, alignItems: 'flex-start',
                      border: active ? '2px solid #0040a1' : '1px solid #e2e8f0',
                      background: active ? '#f0f5ff' : '#ffffff',
                      transition: 'all 0.15s ease',
                      '&:hover': { borderColor: '#0040a1', background: '#f8fafc' },
                    }}
                  >
                    <Box sx={{
                      width: 28, height: 28, borderRadius: '8px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: active ? '#0040a1' : '#e2e8f0', color: active ? 'white' : '#64748b',
                      flexShrink: 0,
                    }}>
                      {opt.icon}
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: '13px', fontWeight: 700, color: active ? '#0040a1' : '#0f172a' }}>
                        {t(opt.titleKey)}
                      </Typography>
                      <Typography sx={{ fontSize: '11px', color: '#64748b', mt: 0.3, lineHeight: 1.3 }}>
                        {t(opt.subKey)}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}

        {/* Code + Libellé — masqués quand on ajoute à une classe existante */}
        {!isNewWithInherit && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 2fr' }, gap: 2 }}>
            <Box>
              <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
                {t('classeHoraire.modern.dialog.codeClasse')}
              </Typography>
              {/* Code auto-généré côté serveur — non éditable, comme num ordre contrat / congé. */}
              <TextField size="small" fullWidth value={catcod} disabled sx={fieldSx} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
                {t('classeHoraire.modern.dialog.label')}
              </Typography>
              <TextField size="small" fullWidth value={catlib} onChange={e => setCatlib(e.target.value)} sx={fieldSx} />
            </Box>
          </Box>
        )}

        {/* Plage de dates */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
              {t('classeHoraire.modern.dialog.from')}
            </Typography>
            <TextField
              size="small" fullWidth type="date" value={catdu}
              onChange={e => setCatdu(e.target.value)} sx={fieldSx}
              InputLabelProps={{ shrink: true }}
            />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
              {t('classeHoraire.modern.dialog.to')}
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
          label={<Typography sx={{ fontSize: '13px', fontWeight: 500 }}>{t('classeHoraire.modern.dialog.overtime')}</Typography>}
        />

        <Divider />

        {/* Section poste */}
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {frequence === 'S' ? t('classeHoraire.modern.dialog.rotationTitle') : t('classeHoraire.modern.dialog.singlePosteTitle')}
            </Typography>
            {frequence === 'S' && (
              <Typography sx={{ fontSize: '10px', color: '#94a3b8' }}>
                {t('classeHoraire.modern.dialog.weekCount', { count: postes.filter(Boolean).length })}
              </Typography>
            )}
          </Box>

          {frequence === 'S' ? (
            /* Selon Pointeuse : un poste par semaine de rotation */
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {postes.map((p, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    label={t('classeHoraire.modern.dialog.chipPosteShort', { n: i + 1 })}
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
                      <MenuItem value=""><em style={{ color: '#94a3b8' }}>{t('classeHoraire.modern.dialog.selectPoste')}</em></MenuItem>
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
                  {t('classeHoraire.modern.dialog.addWeek')}
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
                <MenuItem value=""><em style={{ color: '#94a3b8' }}>{t('classeHoraire.modern.dialog.selectPoste')}</em></MenuItem>
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
          {t('classeHoraire.modern.dialog.cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700, background: 'linear-gradient(135deg, #0040a1 0%, #0056d2 100%)' }}
        >
          {editData ? t('classeHoraire.modern.dialog.save') : t('classeHoraire.modern.dialog.create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
function ClasseHoraireModernInner() {
  const { t } = useTranslation();
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
  // Module distinct pour la correction des pointages : permet à un manager d'ajuster les
  // entrées/sorties sans avoir nécessairement le droit d'éditer les classes horaires.
  const canModifyPointage = hasPermission('Pointage et Temps', 'modify');
  const canConsultPointage = hasPermission('Pointage et Temps', 'consult');
  const [pointageDialogOpen, setPointageDialogOpen] = useState(false);

  if (!hasPermission('Paramètres de Temps', 'consult')) {
    return <AccessDenied message={t('classeHoraire.modern.noConsultRight')} />;
  }

  // Auto-génération du catcod au mount (et tant qu'aucune classe n'est sélectionnée).
  // Évite que l'utilisateur ait à cliquer "Nouvelle classe" avant de pouvoir créer
  // sa 1re période — il voit immédiatement le code prêt à l'emploi dans la sidebar.
  useEffect(() => {
    if (classeCode) return;
    const soc = sessionStorage.getItem('soccod') || '';
    if (!soc) return;
    apiInstance.get(`/Lcategories/get-next-catcod/${soc}`)
      .then(r => { if (r.data?.catcod) setClasseCode(r.data.catcod); })
      .catch(() => { /* échec silencieux */ });
  }, [classeCode]);

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
    if (!data.catcod || !data.catlib) {
      showSnack(t('classeHoraire.modern.msg.missingCodeLabel'), 'warning');
      return;
    }
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
      showSnack(t('classeHoraire.modern.msg.savedSuccess'), 'success');
      setPeriodDialogOpen(false);
      setEditPeriod(null);
      // Synchronise le code/libellé de la classe active pour que le filtre du sidebar
      // affiche bien la nouvelle entrée.
      if (data.catcod) setClasseCode(data.catcod);
      if (data.catlib) setClasseLib(data.catlib);
      refetchClasses();
    } catch (e: any) {
      // Remonte le vrai message serveur s'il existe (réponse 500 du contrôleur :
      // { message, error }) plutôt qu'un libellé générique opaque.
      const serverMsg = e?.response?.data?.message || e?.response?.data?.error;
      showSnack(serverMsg || t('classeHoraire.modern.msg.saveError'), 'error');
    }
  };

  const handleDeletePeriod = async () => {
    setConfirmOpen(false);
    if (!activePeriod) return;
    try {
      await deleteLcategorie({ ...activePeriod, soccod: sessionStorage.getItem('soccod') || '' });
      showSnack(t('classeHoraire.modern.msg.deletedSuccess'), 'success');
      setActivePeriod(null);
      setSelectedClasseHoraire(null);
      refetchClasses();
    } catch (e: any) {
      const serverMsg = e?.response?.data?.message || e?.response?.data?.error;
      showSnack(serverMsg || t('classeHoraire.modern.msg.deleteError'), 'error');
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
      showSnack(t('classeHoraire.modern.msg.appliedSuccess'), 'success');
      setSelectedPoste(selectedPosteCode);
      setActivePeriod({ ...activePeriod, codposte: selectedPosteCode });
      refetchClasses();
    } catch (e: any) {
      const serverMsg = e?.response?.data?.message || e?.response?.data?.error;
      showSnack(serverMsg || t('classeHoraire.modern.msg.applyError'), 'error');
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
      {/* Étape 2/5 du parcours d'onboarding — propose le calendrier ensuite. */}
      <OnboardingNextStepHint
        currentStep="classe"
        dataCount={(classesList || []).length}
      />
      <Box className="chm-layout">

        {/* ── Sidebar gauche ── */}
        <Box className="chm-sidebar">
          <Box className="chm-sidebar-header">
            <Typography className="chm-sidebar-title">{t('classeHoraire.modern.sidebar.title')}</Typography>
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
                {t('classeHoraire.modern.sidebar.noPeriod')}
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
                          {isActive ? t('classeHoraire.modern.sidebar.badgeActive') : t('classeHoraire.modern.sidebar.badgeNext')}
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
                <Typography className="chm-add-period-text">{t('classeHoraire.modern.sidebar.addPeriod')}</Typography>
              </Box>
            )}
          </Box>

          {/* Résumé */}
          <Paper className="chm-summary">
            <Typography className="chm-summary-title">{t('classeHoraire.modern.summary.title')}</Typography>
            <Box className="chm-summary-rows">
              <Box className="chm-summary-row">
                <Typography className="chm-summary-lbl">{t('classeHoraire.modern.summary.coverage')}</Typography>
                <Typography className="chm-summary-val">{t('classeHoraire.modern.summary.coverageValue', { covered: totalCoverage })}</Typography>
              </Box>
              <Box className="chm-summary-row">
                <Typography className="chm-summary-lbl">{t('classeHoraire.modern.summary.distinctPosts')}</Typography>
                <Typography className="chm-summary-val">{t('classeHoraire.modern.summary.distinctPostsValue', { count: distinctPostes })}</Typography>
              </Box>
              <Box className="chm-summary-row">
                <Typography className="chm-summary-lbl">{t('classeHoraire.modern.summary.classId')}</Typography>
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
                <Typography className="chm-preview-title">{t('classeHoraire.modern.preview.title')}</Typography>
                <Typography className="chm-preview-sub">
                  {activePosteLabel ? (
                    <Trans
                      i18nKey="classeHoraire.modern.preview.subtitleWithPoste"
                      values={{ name: activePeriod?.catlib || '—', poste: activePosteLabel }}
                      components={{ 0: <strong style={{ color: '#0040a1' }} />, 1: <strong style={{ color: '#0040a1' }} /> }}
                    />
                  ) : (
                    <Trans
                      i18nKey="classeHoraire.modern.preview.subtitle"
                      values={{ name: activePeriod?.catlib || '—' }}
                      components={{ 0: <strong style={{ color: '#0040a1' }} /> }}
                    />
                  )}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Chip
                label={t('classeHoraire.modern.preview.automated')}
                size="small"
                sx={{ background: '#dcfce7', color: '#166534', fontWeight: 700, fontSize: '10px' }}
              />
              {(canConsultPointage || canModifyPointage) && (
                <Button
                  startIcon={<TuneIcon />}
                  onClick={() => setPointageDialogOpen(true)}
                  sx={{
                    borderRadius: '8px', textTransform: 'none', fontWeight: 600,
                    color: '#0040a1', border: '1px solid #cce0ff', background: '#f0f5ff', fontSize: '12px',
                    '&:hover': { background: '#e0ebff' },
                  }}
                >
                  {t('classeHoraire.modern.preview.adjustPointage')}
                </Button>
              )}
              <Button
                startIcon={<RefreshIcon />}
                onClick={async () => {
                  setActivePeriod(null);
                  setSelectedClasseHoraire(null);
                  setClasseLib('');
                  // Démarre toute nouvelle classe en mode Périodique par défaut ;
                  // le user peut basculer en « Selon pointage » dans le dialog
                  // de création de la 1re période.
                  setClasseFreq('N');
                  setFrequence('N');
                  // Pré-remplit le code via l'endpoint serveur d'auto-génération.
                  // L'utilisateur voit immédiatement le code qui sera attribué (et peut
                  // le modifier s'il préfère un code custom).
                  const soccod = sessionStorage.getItem('soccod') || '';
                  if (soccod) {
                    try {
                      const r = await apiInstance.get(`/Lcategories/get-next-catcod/${soccod}`);
                      setClasseCode(r.data?.catcod || '');
                    } catch {
                      setClasseCode('');
                    }
                  } else {
                    setClasseCode('');
                  }
                }}
                sx={{
                  borderRadius: '8px', textTransform: 'none', fontWeight: 600,
                  color: '#334155', border: '1px solid #e2e8f0', background: 'white', fontSize: '12px',
                }}
              >
                {t('classeHoraire.modern.preview.newClass')}
              </Button>
              {activePeriod && canDelete && (
                <Button
                  startIcon={<DeleteIcon />}
                  color="error"
                  disabled={deleting}
                  onClick={() => setConfirmOpen(true)}
                  sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '12px' }}
                >
                  {t('classeHoraire.modern.preview.delete')}
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
                <Typography className="chm-poste-selector-title">{t('classeHoraire.modern.posteSelector.title')}</Typography>
                <Typography className="chm-poste-selector-sub">{t('classeHoraire.modern.posteSelector.subtitle')}</Typography>
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
                {t('classeHoraire.modern.posteSelector.cancel')}
              </Button>
              <Button
                variant="contained"
                onClick={handleApplyPoste}
                disabled={!selectedPosteCode || !activePeriod || !canModify}
                sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700, background: '#0040a1' }}
              >
                {t('classeHoraire.modern.posteSelector.apply')}
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
        classeExists={!!classeCode && classesList.some((r: any) => r.catcod === classeCode)}
        // À la création d'une nouvelle classe, le user peut basculer entre
        // Périodique ('N') et Selon pointage ('S'). resolvedFreq lit ensuite
        // ce nouveau classeFreq pour piloter l'affichage du formulaire poste(s).
        onFrequenceChange={(freq) => { setClasseFreq(freq); setFrequence(freq); }}
      />

      <AlertModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDeletePeriod}
        message={t('classeHoraire.modern.confirmDeletePeriod', { name: activePeriod?.catlib ?? '' })}
      />

      <PointageAdjustDialog
        open={pointageDialogOpen}
        onClose={() => setPointageDialogOpen(false)}
        canModify={canModifyPointage}
        showSnack={showSnack}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        // zIndex 1500 > Dialog (1300) pour rester visible quand le formulaire
        // d'édition reste ouvert après une erreur de sauvegarde.
        sx={{ zIndex: 1500 }}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          onClose={() => setSnackbar(s => ({ ...s, open: false }))}
          sx={{ borderRadius: '10px', minWidth: 300 }}
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