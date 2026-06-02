import { useEffect, useState, useMemo } from 'react';
import {
  Box, Typography, Paper, Button, TextField, MenuItem,
  FormControl, Select, Snackbar, Alert, CircularProgress,
  Avatar, IconButton, Divider, Dialog, DialogTitle,
  DialogContent, DialogActions,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import PrintIcon from '@mui/icons-material/Print';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import { useTranslation, Trans } from 'react-i18next';
import { CongeProvider, useCongeContext } from '../../../helper/CongeContext';
import useGetDemConges from '../../../../hooks/congeHooks/useGetDemConges';
import useAcceptDemConge from '../../../../hooks/congeHooks/useAcceptDemConge';
import useAddDemConge from '../../../../hooks/congeHooks/useAddDemConge';
import useUpdateDemConge from '../../../../hooks/congeHooks/useUpdateConge';
import useDeleteDemConge from '../../../../hooks/congeHooks/useDeleteDemConge';
import useGetCongeAbsenceLibs from '../../../../hooks/absenceHooks/useGetCongeAbsenceLibs';
import useAddAbsence from '../../../../hooks/absenceHooks/useAddAbsence';
import useGetEmployee from '../../../../hooks/employeHooks/useGetEmployee';
import useGetDroitConge from '../../../../hooks/congeHooks/useGetDroitConge';
import useGetSoldeByEmp from '../../../../hooks/soldeCongeHooks/useGetSoldeByEmp';
import { useAuth } from '../../../helper/AuthProvider';
import SuccessAnimation from '../../../helper/SuccessAnimation';
import { Conge } from '../../../../models/Conge';
import { getDatePartFromDate } from '../../../helper/TimeConverter/ExtractDateOnly';
import apiInstance from '../../../API/apiInstance';
import { ListSkeleton } from '../../../helper/animations/Skeletons';
import { staggerSx } from '../../../helper/animations/Stagger';
import { ActionButton } from '../../../helper/animations/ActionButton';
import './DemCongeModern.css';

// ── helpers ──────────────────────────────────────────────────────────────────
const today = () => new Date().toISOString().split('T')[0];

const fmtDate = (d: Date | string | null | undefined) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }); }
  catch { return '—'; }
};

type CongeStatusKey = 'accepted' | 'refused' | 'pending';
const getStatus = (c: Conge): CongeStatusKey => {
  const n = c.etat?.trim().toLowerCase() ?? '';
  if (n.includes('refus') || c.conrefus === '1') return 'refused';
  if (n.includes('accept')) return 'accepted';
  return 'pending';
};

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  default: { bg: 'rgba(0,64,161,0.1)', text: '#0040a1' },
  maladie: { bg: 'rgba(186,26,26,0.12)', text: '#ba1a1a' },
  rtt:     { bg: 'rgba(0,81,54,0.12)',  text: '#005136' },
};

const getTypeColor = (abscod: string) => {
  const k = abscod?.toLowerCase() ?? '';
  if (k.includes('mal')) return TYPE_COLORS.maladie;
  if (k.includes('rtt')) return TYPE_COLORS.rtt;
  return TYPE_COLORS.default;
};

const STATUS_STYLE: Record<CongeStatusKey, { bg: string; text: string }> = {
  accepted:  { bg: '#dcfce7', text: '#166534' },
  refused:   { bg: '#fee2e2', text: '#991b1b' },
  pending:   { bg: '#fef9c3', text: '#854d0e' },
};

// ── Mini Calendar ─────────────────────────────────────────────────────────────
function MiniCalendar({ leaves }: { leaves: Conge[] }) {
  const [current, setCurrent] = useState(new Date());
  const year = current.getFullYear();
  const month = current.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const offset = firstDay === 0 ? 6 : firstDay - 1;

  const leaveDays = useMemo(() => {
    const set = new Set<string>();
    leaves.forEach((l) => {
      if (!l.condep || !l.conret) return;
      const start = new Date(l.condep);
      const end = new Date(l.conret);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (d.getMonth() === month && d.getFullYear() === year)
          set.add(d.getDate().toString());
      }
    });
    return set;
  }, [leaves, month, year]);

  const monthName = current.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const cells = Array.from({ length: offset + daysInMonth }, (_, i) =>
    i < offset ? null : i - offset + 1
  );

  return (
    <Paper className="dcm-calendar-card">
      <Box className="dcm-calendar-header">
        <Typography className="dcm-calendar-title">{monthName.charAt(0).toUpperCase() + monthName.slice(1)}</Typography>
        <Box className="dcm-calendar-nav">
          <IconButton size="small" onClick={() => setCurrent(new Date(year, month - 1, 1))}><ChevronLeftIcon fontSize="small" /></IconButton>
          <IconButton size="small" onClick={() => setCurrent(new Date(year, month + 1, 1))}><ChevronRightIcon fontSize="small" /></IconButton>
        </Box>
      </Box>
      <Box className="dcm-calendar-grid">
        {['LU','MA','ME','JE','VE','SA','DI'].map((d) => (
          <Box key={d} className="dcm-cal-dow">{d}</Box>
        ))}
        {cells.map((day, i) => (
          <Box key={i} className={`dcm-cal-day ${day && leaveDays.has(day.toString()) ? 'dcm-cal-day--leave' : ''} ${!day ? 'dcm-cal-day--empty' : ''}`}>
            {day ?? ''}
            {day && leaveDays.has(day.toString()) && <span className="dcm-cal-dot" />}
          </Box>
        ))}
      </Box>
    </Paper>
  );
}

// ── Form Dialog ───────────────────────────────────────────────────────────────
function CongeFormDialog({ open, onClose, editConge, onSuccess }: { open: boolean; onClose: () => void; editConge: Conge | null; onSuccess?: () => void }) {
  const { t } = useTranslation();
  const { soccod, isEmp, uticod, hasPermission } = useAuth();
  const { refetch } = useGetDemConges();
  const { data: absences = [], refetch: refetchAbsences } = useGetCongeAbsenceLibs();
  const { data: employeOptions = [] } = useGetEmployee();
  const { mutate: addConge, isPending: adding } = useAddDemConge();
  const { mutate: updateConge, isPending: updating } = useUpdateDemConge();
  const { mutate: addAbsence, isPending: addingAbsence } = useAddAbsence();
  const canAddAbsence = hasPermission('Paramètres de Temps', 'add');

  // Inline "ajouter une nature d'absence" — affiché dans le même dialog quand
  // aucun type n'est configuré ou que l'utilisateur veut en ajouter un.
  const [showAddType, setShowAddType] = useState(false);
  const [newAbscod, setNewAbscod] = useState('');
  const [newAbslib, setNewAbslib] = useState('');
  const [newAbscng, setNewAbscng] = useState<'0' | '1' | '5' | 'R' | 'E'>('0');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSnack, setFormSnack] = useState<{ open: boolean; sev: 'success' | 'error'; msg: string }>({ open: false, sev: 'success', msg: '' });

  const [empcod, setEmpcod] = useState(() => isEmp && uticod ? uticod : '');
  const [concod, setConcod] = useState('');
  // État de chargement du numéro de demande (concod). Avant : si l'appel
  // `get-next-concod` plantait (rate-limit, réseau, base indispo), on masquait
  // silencieusement l'erreur (.catch(() => {})) → concod restait '' → le POST
  // partait avec un Concod vide → la DB rejetait sur la PK → 500 incompréhensible.
  // Maintenant : on suit l'état (loading / ok / error), on bloque le submit tant
  // que concod n'est pas chargé, et on affiche un bouton « Réessayer » à l'admin.
  const [concodStatus, setConcodStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [concodError, setConcodError] = useState<string | null>(null);
  const [condat, setCondat] = useState(today());
  const [condep, setCondep] = useState(today());
  const [conret, setConret] = useState(today());
  const [conamdep, setConamdep] = useState(false);
  const [conamret, setConamret] = useState(false);
  const [abscod, setAbscod] = useState('');
  const [conadr, setConadr] = useState('');
  const [contel, setContel] = useState('');
  const [conref, setConref] = useState('');
  const [connbjour, setConnbjour] = useState(0);
  const [employeeHireDate, setEmployeeHireDate] = useState<Date | null>(null);

  // Droit conge - leave balance
  // ⚠ Important : on borne `yearEnd` à AUJOURD'HUI (pas au 31/12) pour que les
  // droits acquis (`Droitconge` côté backend = sitconge/12 × moisActifs) reflètent
  // ce qui est RÉELLEMENT acquis à date, comme l'affiche le dashboard via
  // GetMyKPIs. Avant ce fix, le formulaire montrait le droit annuel complet
  // (ex: 20 j sur l'année alors que seuls ~8 j étaient effectivement acquis en
  // mai), ce qui induisait l'utilisateur en erreur sur son solde réel.
  const currentEmpcod = isEmp && uticod ? uticod : empcod;
  const todayDate = new Date();
  const currentYear = todayDate.getFullYear();
  const defaultYearStart = `${currentYear}-01-01`;
  const yearEnd = todayDate.toISOString().split('T')[0];
  const yearStart = employeeHireDate && employeeHireDate.getFullYear() === currentYear && employeeHireDate > new Date(currentYear, 0, 1)
    ? employeeHireDate.toISOString().split('T')[0]
    : defaultYearStart;
  // Le solde affiché doit refléter la NATURE du congé choisi — chaque type a son propre
  // compteur : CP (droit annuel acquis), RTT (crédit annuel dédié, Solde.RttJours), CET (jours
  // épargnés, Solde.Cetjours). CSF/CSS ne sont pas décomptés d'un solde. On dérive l'imputation
  // (Abscng) du type sélectionné pour choisir la source et l'affichage.
  const selectedAbscng = ((Array.isArray(absences) ? absences : []).find((a) => a.abscod === abscod)?.abscng || '').toUpperCase();
  const balanceKind: 'cp' | 'rtt' | 'cet' | 'none' =
    selectedAbscng === 'R' ? 'rtt'
      : selectedAbscng === 'E' ? 'cet'
        : (selectedAbscng === '0' || selectedAbscng === '') ? 'cp'
          : 'none';

  // typeConge : le backend GetDroitCongeAsync ne distingue que "paye" (CP) et "rtt". Le CET
  // et les types non décomptés retombent sur "paye" mais leur affichage est géré séparément.
  const { data: droitCongeData } = useGetDroitConge(currentEmpcod, yearStart, yearEnd, balanceKind === 'rtt' ? 'rtt' : 'paye');
  const { data: soldeData } = useGetSoldeByEmp(currentEmpcod);
  const droitConge = Array.isArray(droitCongeData) ? droitCongeData[0] : droitCongeData;
  const soldeAnterieur = (droitConge as any)?.soldeinit ?? (droitConge as any)?.Soldeinit ?? 0;
  const droitCongeTotal = (droitConge as any)?.droitconge ?? (droitConge as any)?.Droitconge ?? 0;
  const droitMensuel = Number((droitCongeTotal / 12).toFixed(2));
  const droitRestant = (droitConge as any)?.droitrestant ?? (droitConge as any)?.Droitrestant ?? 0;
  // Solde CET disponible (jours épargnés), lu sur la ligne Solde de l'employé.
  const cetDisponible = (soldeData as any)?.cetjours ?? (soldeData as any)?.Cetjours ?? 0;
  // Solde « actuel » effectif selon la nature : CET → jours épargnés ; sinon → droit restant CP/RTT.
  const soldeActuel = balanceKind === 'cet' ? cetDisponible : droitRestant;
  const nouveauSolde = Math.max(0, soldeActuel - connbjour);

  // Auto-fill phone and hire date when employee changes.
  // In add mode, phone is always synced to selected employee (including empty value).
  useEffect(() => {
    const targetEmpcod = isEmp && uticod ? uticod : empcod;
    if (!targetEmpcod) return;

    apiInstance.get(`/Employes/${targetEmpcod}`)
      .then((res) => {
        const tel = res.data?.emptel || res.data?.empmob || '';
        if (!editConge) setContel(tel);

        const emb = res.data?.empemb;
        if (emb) {
          const date = new Date(emb);
          if (!Number.isNaN(date.getTime())) {
            setEmployeeHireDate(date);
          }
        }
      })
      .catch(() => {});
  }, [empcod, isEmp, uticod, editConge]);

  // Méthode RTT de l'employé ciblé (le demandeur ou la personne sélectionnée par
  // un manager/admin). Sert à FILTRER les types RTT (abscng='R') de la liste de
  // sélection : un employé non éligible ne doit pas pouvoir choisir « RTT » du
  // tout. Le backend renforce ce check au POST (renvoie 400 rtt_not_eligible si
  // jamais le frontend était contourné).
  const [empRttMethode, setEmpRttMethode] = useState<string | null>(null);
  useEffect(() => {
    const targetEmpcod = empcod || (isEmp && uticod ? uticod : '');
    if (!soccod || !targetEmpcod) {
      setEmpRttMethode(null);
      return;
    }
    // Quand l'employé consulte SA PROPRE fiche (cas du salarié qui dépose sa demande), on
    // passe par l'endpoint self `get-my-rtt-methode` : `get-employe` exige le droit de gestion
    // et renverrait 403 → empRttMethode null → RTT masqué à tort. Un manager/admin qui
    // sélectionne un AUTRE employé garde l'endpoint complet (il a la permission).
    const isSelf = !!uticod && targetEmpcod === uticod;
    const url = isSelf
      ? `/Employes/get-my-rtt-methode/${soccod}/${targetEmpcod}`
      : `/Employes/get-employe/${soccod}/${targetEmpcod}`;
    apiInstance.get(url)
      .then((res) => setEmpRttMethode(res.data?.empRttMethode ?? null))
      .catch(() => setEmpRttMethode(null));
  }, [empcod, isEmp, uticod, soccod]);

  const isRttEligible = useMemo(() => {
    const m = (empRttMethode || '').trim().toUpperCase();
    return m !== '' && m !== 'N';
  }, [empRttMethode]);

  // Liste filtrée : on retire les types RTT pour les employés non éligibles.
  // Le composant utilise toujours un Record<abscod, abslib> en interne pour
  // minimiser la diff — on construit cette structure côté client à partir du
  // tableau enrichi renvoyé par useGetCongeAbsenceLibs.
  const visibleAbsencesArr = useMemo(() => {
    const arr = Array.isArray(absences) ? absences : [];
    return arr.filter((a) => isRttEligible || (a.abscng || '').toUpperCase() !== 'R');
  }, [absences, isRttEligible]);

  const visibleAbsencesDict = useMemo(() => {
    const out: Record<string, string> = {};
    for (const a of visibleAbsencesArr) {
      if (a && a.abscod) out[a.abscod] = a.abslib ?? a.abscod;
    }
    return out;
  }, [visibleAbsencesArr]);

  // Indicateurs visibles d'éligibilité RTT (cf. hint sous le select). On distingue
  // 3 cas pour aider l'admin à comprendre POURQUOI RTT apparaît ou non dans la
  // liste — la logique de filtre était silencieuse, ce qui poussait à croire que
  // « RTT n'existe pas » alors que c'était juste l'employé qui n'était pas
  // configuré, ou le catalogue absences qui n'avait pas de type RTT du tout.
  const rttTypesInCatalog = useMemo(() => {
    const arr = Array.isArray(absences) ? absences : [];
    return arr.filter((a) => (a.abscng || '').toUpperCase() === 'R');
  }, [absences]);
  const hasAnyRttType = rttTypesInCatalog.length > 0;

  // Set default type de congé when absences load
  useEffect(() => {
    if (!editConge && open && visibleAbsencesArr.length > 0 && !abscod) {
      setAbscod(visibleAbsencesArr[0].abscod);
    }
  }, [open, editConge, visibleAbsencesArr, abscod]);

  // Si l'employé change ET que le type sélectionné devient invalide pour ce
  // nouvel employé (ex: RTT sélectionné, on bascule vers un non-éligible),
  // on reset abscod vers le 1er type visible.
  useEffect(() => {
    if (!abscod) return;
    const stillVisible = visibleAbsencesArr.some((a) => a.abscod === abscod);
    if (!stillVisible) {
      setAbscod(visibleAbsencesArr[0]?.abscod ?? '');
    }
  }, [visibleAbsencesArr, abscod]);

  // Fetch next concod from database when form opens in add mode.
  // Extracté en handler nommé pour permettre un "Réessayer" en cas d'échec
  // (rate-limit transitoire, base momentanément indispo).
  const fetchNextConcod = () => {
    if (!soccod) return;
    setConcodStatus('loading');
    setConcodError(null);
    apiInstance.get(`/DemConges/get-next-concod/${soccod}`)
      .then(res => {
        const nextConcod = (res.data?.concod || res.data || '').toString().trim();
        if (!nextConcod) {
          setConcodStatus('error');
          setConcodError('Le serveur n\'a pas pu générer le numéro de demande. Réessayez.');
          return;
        }
        setConcod(nextConcod);
        setConcodStatus('ok');
      })
      .catch((err) => {
        setConcodStatus('error');
        setConcodError(
          err?.response?.data?.message
          || err?.response?.status === 429
            ? 'Trop de tentatives — patientez un instant et réessayez.'
            : 'Impossible de générer le numéro de demande. Vérifiez votre connexion.'
        );
      });
  };

  useEffect(() => {
    if (!editConge && open && soccod) {
      fetchNextConcod();
    }
    // Reset le statut quand on bascule sur un edit (le concod vient de editConge).
    if (editConge) {
      setConcodStatus('ok');
      setConcodError(null);
    }
  }, [open, editConge, soccod]);

  useEffect(() => {
    if (editConge) {
      setEmpcod(editConge.empcod);
      setConcod(editConge.concod);
      setCondat(getDatePartFromDate(editConge.condat));
      setCondep(getDatePartFromDate(editConge.condep));
      setConret(getDatePartFromDate(editConge.conret));
      setConamdep(editConge.conamdep === '1');
      setConamret(editConge.conamret === '1');
      setAbscod(editConge.abscod);
      setConadr(editConge.conadr);
      setContel(editConge.contel);
      setConref(editConge.conref);
      setConnbjour(editConge.connbjour);
    } else {
      setEmpcod(isEmp && uticod ? uticod : '');
      setCondat(today());
      setCondep(today());
      setConret(today());
      setConamdep(false);
      setConamret(false);
      setAbscod('');
      setConadr('');
      setContel('');
      setConref('');
      setConnbjour(0);
      // concod will be set by the useEffect above
    }
  }, [editConge, open]);

  useEffect(() => {
    if (!condep || !conret) { setConnbjour(0); return; }
    const diff = (new Date(conret).getTime() - new Date(condep).getTime()) / 86400000;
    setConnbjour(Math.max(0, diff + (conamret ? 0.5 : 0) - (conamdep ? 0.5 : 0)));
  }, [condep, conret, conamdep, conamret]);

  const handleSubmit = () => {
    // Validation client : sans type sélectionné, le backend rejette ou
    // l'enregistrement reste muet. On bloque ici avec un message explicite.
    if (!abscod) {
      setFormError(t('conge.demConge.form.typeRequired'));
      return;
    }
    if (!empcod) {
      setFormError(t('conge.demConge.form.employeeRequired'));
      return;
    }
    // Garde anti-Concod-vide : sans numéro, l'INSERT côté serveur viole la PK
    // ou la contrainte NOT NULL → 500 incompréhensible. On refuse l'envoi.
    if (!editConge && (!concod || concod.trim() === '')) {
      setFormError('Le numéro de demande n\'a pas pu être généré. Cliquez sur « Réessayer » avant de soumettre.');
      return;
    }
    setFormError(null);
    const payload: Conge = {
      soccod: soccod || '', empcod, concod,
      condat: condat ? new Date(condat) : null,
      condep: condep ? new Date(condep) : null,
      conret: conret ? new Date(conret) : null,
      conamdep: conamdep ? '1' : '0',
      conamret: conamret ? '1' : '0',
      abscod, conadr, contel, conref, connbjour,
      conjour: 'J', emplib: null, condg: '', conrefus: '', consolde: 0,
    };
    const cb = {
      onSuccess: () => {
        refetch();
        if (onSuccess) onSuccess();
        onClose();
      },
      onError: (err: any) => {
        // Avant : on avalait silencieusement les erreurs ({}). L'utilisateur
        // ne voyait que la console F12 (« 500 »). Maintenant on affiche le
        // message backend (ex: « Le numéro est déjà utilisé », « Type de congé
        // introuvable »…) — sinon un fallback générique.
        const status = err?.response?.status;
        const backendMsg = err?.response?.data?.message
          || (typeof err?.response?.data === 'string' ? err.response.data : null);
        let msg = backendMsg;
        if (!msg) {
          if (status === 402) msg = 'Plan insuffisant pour cette fonctionnalité.';
          else if (status === 403) msg = 'Permission refusée — contactez votre administrateur.';
          else if (status === 429) msg = 'Trop de tentatives. Patientez quelques instants et réessayez.';
          else if (status >= 500) msg = 'Erreur serveur lors de l\'enregistrement. Réessayez ou contactez le support.';
          else msg = 'Échec de l\'enregistrement de la demande.';
        }
        setFormError(msg);
      }
    };
    editConge ? updateConge(payload, cb) : addConge(payload, cb);
  };

  const resetAddTypeForm = () => {
    setShowAddType(false);
    setNewAbscod('');
    setNewAbslib('');
    setNewAbscng('0');
  };

  const handleAddType = () => {
    if (!newAbscod.trim() || !newAbslib.trim()) {
      setFormSnack({ open: true, sev: 'error', msg: t('conge.demConge.form.addTypeMissing') });
      return;
    }
    // Valeurs par défaut alignées sur IntituleDesAbsencesModern (formulaire de
    // référence) pour qu'un congé créé ici se comporte comme un congé saisi
    // depuis l'écran "Intitulé des Absences".
    const payload: any = {
      soccod: soccod || '',
      abscod: newAbscod.trim(),
      abslib: newAbslib.trim(),
      abspar: 'A',
      absunite: 'J',
      abscng: newAbscng,
      abssanc: 'N',
      abspayer: 'O',
      absrepos: '0',
      absferier: 'N',
      absaut: 0,
    };
    addAbsence(payload, {
      onSuccess: () => {
        setFormSnack({ open: true, sev: 'success', msg: t('conge.demConge.form.addTypeSuccess') });
        const created = newAbscod.trim();
        refetchAbsences().finally(() => setAbscod(created));
        resetAddTypeForm();
      },
      onError: (err: any) => {
        setFormSnack({ open: true, sev: 'error', msg: err?.response?.data?.message || t('conge.demConge.form.addTypeError') });
      },
    });
  };

  const isBusy = adding || updating;
  // Le submit est désactivé tant que concod n'est pas généré (mode add seulement) :
  // évite l'envoi d'un POST avec Concod='' qui produit un 500 incompréhensible.
  const submitDisabled = isBusy || (!editConge && concodStatus !== 'ok');
  const fieldSx = { '& .MuiOutlinedInput-root': { borderRadius: '8px', backgroundColor: '#f8fafc', '& fieldset': { borderColor: '#e2e8f0' } } };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}
         sx={{
        '& .MuiDialog-container': {
          alignItems: 'center',
        },
        '& .MuiDialog-paper': {
          margin: { xs: '16px', sm: '32px' },
          width: { xs: 'calc(100% - 32px)', sm: '100%' },
          maxWidth: { xs: '100%', sm: '800px' },
        },
      }}>
      <DialogTitle sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '18px', pb: 1 }}>
        {editConge ? t('conge.demConge.form.editTitle') : t('conge.demConge.form.newTitle')}
      </DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>{t('conge.demConge.form.orderNo')}</Typography>
            <TextField
              size="small" fullWidth
              value={concodStatus === 'loading' ? 'Génération…' : concodStatus === 'error' ? '⚠️ Échec' : concod}
              onChange={(e) => setConcod(e.target.value)}
              InputProps={{
                readOnly: true,
                endAdornment: !editConge && concodStatus === 'error' ? (
                  <Button size="small" onClick={fetchNextConcod} sx={{ minWidth: 'auto', fontSize: 11, textTransform: 'none', px: 1.2 }}>
                    Réessayer
                  </Button>
                ) : undefined,
              }}
              error={!editConge && concodStatus === 'error'}
              helperText={!editConge && concodStatus === 'error' ? concodError : undefined}
              sx={fieldSx}
            />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>{t('conge.demConge.form.requestDate')}</Typography>
            <TextField size="small" fullWidth type="date" value={condat} InputProps={{ readOnly: true }} sx={fieldSx} />
          </Box>
        </Box>

        {!isEmp && (
          <Box>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>{t('conge.demConge.form.employee')}</Typography>
            <FormControl fullWidth size="small">
              <Select value={empcod} onChange={(e) => setEmpcod(e.target.value)} sx={{ borderRadius: '8px', backgroundColor: '#f8fafc', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e2e8f0' } }}>
                {Object.entries(employeOptions).map(([k, v]) => <MenuItem key={k} value={k}>{String(v)}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
        )}

        <Box>
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('conge.demConge.form.type')}</Typography>
            {canAddAbsence && !showAddType && (
              <Button
                size="small"
                startIcon={<AddIcon sx={{ fontSize: 14 }} />}
                onClick={() => setShowAddType(true)}
                sx={{ textTransform: 'none', fontSize: '11px', fontWeight: 700, color: '#0040a1', minWidth: 0, p: '2px 6px' }}
              >
                {t('conge.demConge.form.addTypeBtn')}
              </Button>
            )}
          </Box>
          {/* Indicateur d'éligibilité RTT : rendu visible PRÈS du select pour que
              l'admin comprenne immédiatement pourquoi RTT apparaît ou non dans la
              liste, sans avoir à inspecter la fiche du collaborateur. Trois cas :
                - éligible + type RTT dans le catalogue → chip vert
                - éligible MAIS aucun type RTT défini → astuce orange "à créer"
                - NON éligible alors qu'un type RTT existe → astuce bleue "à activer" */}
          {/* Ces astuces RTT sont des aides à la GESTION (elles parlent de « cet employé »,
              « ouvrez sa fiche », « votre catalogue ») : on ne les montre jamais au salarié
              qui dépose sa propre demande — elles n'auraient pour lui aucun sens / action. */}
          {!isEmp && isRttEligible && hasAnyRttType && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75, px: 1, py: 0.5, borderRadius: '6px', background: '#dcfce7', border: '1px solid #86efac', width: 'fit-content' }}>
              <Box component="span" sx={{ fontSize: 12, fontWeight: 800, color: '#15803d' }}>✓ Éligible RTT</Box>
              <Box component="span" sx={{ fontSize: 11, color: '#166534' }}>
                — méthode {String(empRttMethode || '').toUpperCase()}
              </Box>
            </Box>
          )}
          {!isEmp && isRttEligible && !hasAnyRttType && (
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, mb: 0.75, p: 1, borderRadius: '6px', background: '#fef3c7', border: '1px solid #fde68a' }}>
              <Box component="span" sx={{ fontSize: 11, color: '#92400e', lineHeight: 1.4 }}>
                Cet employé est éligible aux RTT, mais aucun type d'absence RTT n'est défini dans votre catalogue.
                Créez-en un via <strong>Données de Base → Absences</strong> (imputation = R).
              </Box>
            </Box>
          )}
          {!isEmp && !isRttEligible && hasAnyRttType && (
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, mb: 0.75, p: 1, borderRadius: '6px', background: '#dbeafe', border: '1px solid #93c5fd' }}>
              <Box component="span" sx={{ fontSize: 11, color: '#1e40af', lineHeight: 1.4 }}>
                Les types RTT sont masqués : cet employé n'a pas de méthode RTT activée.
                Pour l'autoriser, ouvrez sa fiche et choisissez une méthode RTT (manuel, horaire, ou forfait jours).
              </Box>
            </Box>
          )}

          <FormControl fullWidth size="small" error={!!formError && !abscod}>
            <Select
              value={abscod}
              displayEmpty
              onChange={(e) => { setAbscod(e.target.value); if (formError) setFormError(null); }}
              sx={{ borderRadius: '8px', backgroundColor: '#f8fafc', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e2e8f0' } }}
            >
              <MenuItem value="" disabled>
                <em style={{ color: '#94a3b8' }}>
                  {Object.keys(visibleAbsencesDict).length === 0
                    ? t('conge.demConge.form.typeEmpty')
                    : t('conge.demConge.form.typePlaceholder')}
                </em>
              </MenuItem>
              {visibleAbsencesArr.map((a) => {
                // Petit badge "RTT" sur l'option pour la repérer en un coup d'œil
                // quand l'admin scrolle dans une liste qui contient aussi CP/CM/CSS.
                const isRtt = (a.abscng || '').toUpperCase() === 'R';
                return (
                  <MenuItem key={a.abscod} value={a.abscod}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                      <Box component="span" sx={{ flex: 1 }}>{String(a.abslib ?? a.abscod)}</Box>
                      {isRtt && (
                        <Box component="span" sx={{ px: 0.75, py: 0.1, borderRadius: '4px', background: '#dcfce7', color: '#15803d', fontSize: 10, fontWeight: 800, letterSpacing: '0.05em' }}>
                          RTT
                        </Box>
                      )}
                    </Box>
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
          {Object.keys(visibleAbsencesDict).length === 0 && canAddAbsence && !showAddType && (
            <Typography sx={{ fontSize: '11px', color: '#b45309', mt: 0.5 }}>
              {t('conge.demConge.form.typeEmptyHint')}
            </Typography>
          )}
          {showAddType && (
            <Box sx={{ mt: 1.25, p: 1.5, borderRadius: '10px', border: '1px dashed #bfdbfe', background: '#f8fbff' }}>
              <Typography sx={{ fontSize: '11px', fontWeight: 800, color: '#0040a1', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
                {t('conge.demConge.form.addTypeTitle')}
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '120px 1fr' }, gap: 1.25 }}>
                <Box>
                  <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#64748b', mb: 0.25 }}>{t('conge.demConge.form.addTypeCode')}</Typography>
                  <TextField size="small" fullWidth value={newAbscod} onChange={e => setNewAbscod(e.target.value.toUpperCase())} placeholder="CP" sx={fieldSx} />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#64748b', mb: 0.25 }}>{t('conge.demConge.form.addTypeLabel')}</Typography>
                  <TextField size="small" fullWidth value={newAbslib} onChange={e => setNewAbslib(e.target.value)} placeholder={t('conge.demConge.form.addTypeLabelPh')} sx={fieldSx} />
                </Box>
              </Box>
              <Box sx={{ mt: 1.25 }}>
                <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#64748b', mb: 0.5 }}>{t('conge.demConge.form.addTypeImputation')}</Typography>
                <FormControl fullWidth size="small">
                  <Select value={newAbscng} onChange={(e) => setNewAbscng(e.target.value as '0' | '1' | '5' | 'R' | 'E')} sx={{ borderRadius: '8px', backgroundColor: '#fff' }}>
                    <MenuItem value="0">{t('intituleAbsences.imputationOptions.0')}</MenuItem>
                    <MenuItem value="1">{t('intituleAbsences.imputationOptions.1')}</MenuItem>
                    <MenuItem value="5">{t('intituleAbsences.imputationOptions.5')}</MenuItem>
                    <MenuItem value="R">{t('intituleAbsences.imputationOptions.R')}</MenuItem>
                    <MenuItem value="E">{t('intituleAbsences.imputationOptions.E')}</MenuItem>
                  </Select>
                </FormControl>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1.5 }}>
                <Button size="small" onClick={resetAddTypeForm} sx={{ textTransform: 'none', color: '#64748b' }}>
                  {t('conge.demConge.form.cancel')}
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  onClick={handleAddType}
                  disabled={addingAbsence}
                  startIcon={addingAbsence ? <CircularProgress size={14} color="inherit" /> : <SaveIcon sx={{ fontSize: 14 }} />}
                  sx={{ textTransform: 'none', borderRadius: '8px', background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary-dark) 100%)' }}
                >
                  {t('conge.demConge.form.addTypeSave')}
                </Button>
              </Box>
            </Box>
          )}
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr auto 1fr auto auto' }, gap: 1.5, alignItems: 'end' }}>
          <Box>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>{t('conge.demConge.form.departureDate')}</Typography>
            <TextField size="small" fullWidth type="date" value={condep} onChange={(e) => setCondep(e.target.value)} sx={fieldSx} />
          </Box>
          <Box sx={{ pb: 0.5 }}>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>{t('conge.demConge.form.amHalf')}</Typography>
            <input type="checkbox" checked={conamdep} onChange={(e) => setConamdep(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#0040a1', cursor: 'pointer' }} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>{t('conge.demConge.form.returnDate')}</Typography>
            <TextField size="small" fullWidth type="date" value={conret} onChange={(e) => setConret(e.target.value)} sx={fieldSx} />
          </Box>
          <Box sx={{ pb: 0.5 }}>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>{t('conge.demConge.form.amHalf')}</Typography>
            <input type="checkbox" checked={conamret} onChange={(e) => setConamret(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#0040a1', cursor: 'pointer' }} />
          </Box>
          <Box sx={{ gridColumn: { xs: 'span 2', sm: 'auto' } }}>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#0040a1', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>{t('conge.demConge.form.days')}</Typography>
            <TextField size="small" fullWidth value={connbjour} InputProps={{ readOnly: true }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', backgroundColor: '#eff6ff', '& fieldset': { borderColor: '#bfdbfe' }, '& input': { color: '#0040a1', fontWeight: 700, textAlign: 'center' } } }} />
          </Box>
        </Box>

        {/* Leave Balance Info — affichage ADAPTÉ à la nature du congé choisi. */}
        {currentEmpcod && abscod && (
          <Box sx={{ background: 'linear-gradient(135deg, #f0f5ff 0%, #e8f0fe 100%)', borderRadius: '12px', p: 2, border: '1px solid #bfdbfe' }}>
            <Typography sx={{ fontSize: '12px', fontWeight: 800, color: '#0040a1', mb: 1.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              📊 {balanceKind === 'rtt'
                ? t('conge.demConge.form.balanceTitleRtt')
                : balanceKind === 'cet'
                  ? t('conge.demConge.form.balanceTitleCet')
                  : t('conge.demConge.form.balanceTitle')}
            </Typography>

            {balanceKind === 'none' ? (
              // CSF / CSS… : pas de compteur dédié — on évite d'afficher un solde CP trompeur.
              <Typography sx={{ fontSize: '12px', color: '#475569', fontWeight: 600 }}>
                {t('conge.demConge.form.noBalanceNote')}
              </Typography>
            ) : balanceKind === 'cet' ? (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                <Box sx={{ background: '#fff', borderRadius: '8px', p: 1.5, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', mb: 0.5 }}>{t('conge.demConge.form.cetAvailable')}</Typography>
                  <Typography sx={{ fontSize: '20px', fontWeight: 800, color: '#7c3aed' }}>{cetDisponible}</Typography>
                  <Typography sx={{ fontSize: '9px', color: '#94a3b8' }}>{t('conge.demConge.form.cetSavedUnit')}</Typography>
                </Box>
                <Box sx={{ background: '#fff', borderRadius: '8px', p: 1.5, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: connbjour > 0 ? '2px solid #f59e0b' : 'none' }}>
                  <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', mb: 0.5 }}>{t('conge.demConge.form.newBalance')}</Typography>
                  <Typography sx={{ fontSize: '20px', fontWeight: 800, color: nouveauSolde < 0 ? '#ba1a1a' : '#059669' }}>{nouveauSolde}</Typography>
                  <Typography sx={{ fontSize: '9px', color: '#94a3b8' }}>{t('conge.demConge.form.afterLeave')}</Typography>
                </Box>
              </Box>
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                <Box sx={{ background: '#fff', borderRadius: '8px', p: 1.5, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', mb: 0.5 }}>{t('conge.demConge.form.previousBalance')}</Typography>
                  <Typography sx={{ fontSize: '20px', fontWeight: 800, color: '#0040a1' }}>{soldeAnterieur}</Typography>
                  <Typography sx={{ fontSize: '9px', color: '#94a3b8' }}>{t('conge.demConge.form.daysUnit')}</Typography>
                </Box>
                <Box sx={{ background: '#fff', borderRadius: '8px', p: 1.5, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', mb: 0.5 }}>{t('conge.demConge.form.monthlyEntitlement')}</Typography>
                  <Typography sx={{ fontSize: '20px', fontWeight: 800, color: '#005136' }}>{droitMensuel}</Typography>
                  <Typography sx={{ fontSize: '9px', color: '#94a3b8' }}>{t('conge.demConge.form.daysPerMonth')}</Typography>
                </Box>
                <Box sx={{ background: '#fff', borderRadius: '8px', p: 1.5, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', mb: 0.5 }}>{t('conge.demConge.form.currentBalance')}</Typography>
                  <Typography sx={{ fontSize: '20px', fontWeight: 800, color: '#7c3aed' }}>{droitRestant}</Typography>
                  <Typography sx={{ fontSize: '9px', color: '#94a3b8' }}>{t('conge.demConge.form.daysRemaining')}</Typography>
                </Box>
                <Box sx={{ background: '#fff', borderRadius: '8px', p: 1.5, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: connbjour > 0 ? '2px solid #f59e0b' : 'none' }}>
                  <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', mb: 0.5 }}>{t('conge.demConge.form.newBalance')}</Typography>
                  <Typography sx={{ fontSize: '20px', fontWeight: 800, color: nouveauSolde < 0 ? '#ba1a1a' : '#059669' }}>{nouveauSolde}</Typography>
                  <Typography sx={{ fontSize: '9px', color: '#94a3b8' }}>{t('conge.demConge.form.afterLeave')}</Typography>
                </Box>
              </Box>
            )}
          </Box>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>{t('conge.demConge.form.addressDuringLeave')}</Typography>
            <TextField size="small" fullWidth value={conadr} onChange={(e) => setConadr(e.target.value)} sx={fieldSx} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>{t('conge.demConge.form.phone')}</Typography>
            <TextField size="small" fullWidth value={contel} onChange={(e) => setContel(e.target.value)} sx={fieldSx} />
          </Box>
        </Box>
        {formError && (
          <Alert severity="error" onClose={() => setFormError(null)} sx={{ borderRadius: '8px' }}>
            {formError}
          </Alert>
        )}
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ borderRadius: '8px', textTransform: 'none', color: '#64748b' }}>{t('conge.demConge.form.cancel')}</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={submitDisabled}
          startIcon={isBusy ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700, background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary-dark) 100%)' }}>
          {editConge ? t('conge.demConge.form.modify') : t('conge.demConge.form.submit')}
        </Button>
      </DialogActions>
      <Snackbar
        open={formSnack.open}
        autoHideDuration={4000}
        onClose={() => setFormSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={formSnack.sev} onClose={() => setFormSnack(s => ({ ...s, open: false }))} sx={{ borderRadius: '10px' }}>
          {formSnack.msg}
        </Alert>
      </Snackbar>
    </Dialog>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
function DemCongeModernInner() {
  const { t } = useTranslation();
  const { soccod, isEmp, isManager, sercod, uticod, hasPermission } = useAuth();
  const { setSelectedConge } = useCongeContext();
  const { data = [], isLoading, refetch } = useGetDemConges();
  const { mutate: acceptConge } = useAcceptDemConge();
  const { data: absenceLibsArr = [] } = useGetCongeAbsenceLibs();
  // Le hook renvoie [{abscod, abslib, abscng}] (format enrichi pour le filtre RTT
  // côté formulaire). Cette page-ci n'a besoin que d'un lookup abscod→abslib.
  const absenceLibs = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const a of absenceLibsArr) {
      if (a?.abscod) out[a.abscod] = a.abslib ?? a.abscod;
    }
    return out;
  }, [absenceLibsArr]);
  const [managerEmployeeCodes, setManagerEmployeeCodes] = useState<Set<string> | null>(null);
  const [isManagerScopeLoading, setIsManagerScopeLoading] = useState(false);

  const canAdd = hasPermission('Gestion des Congés', 'add');
  const canModify = hasPermission('Gestion des Congés', 'modify');
  const canDelete = hasPermission('Gestion des Congés', 'delete');
  const canConsult = hasPermission('Gestion des Congés', 'consult');

  useEffect(() => {
    if (!isManager || !soccod || !uticod || !sercod) {
      setManagerEmployeeCodes(null);
      setIsManagerScopeLoading(false);
      return;
    }

    let active = true;
    setIsManagerScopeLoading(true);

    apiInstance.get(`/Employes/${soccod}/${uticod}`)
      .then((res) => {
        if (!active) return;
        const scopedCodes = new Set<string>(
          (res.data ?? [])
            .filter((e: any) => e.sercod === sercod)
            .map((e: any) => e.empcod)
        );
        if (uticod) scopedCodes.add(uticod);
        setManagerEmployeeCodes(scopedCodes);
      })
      .catch(() => {
        if (!active) return;
        setManagerEmployeeCodes(new Set<string>(uticod ? [uticod] : []));
      })
      .finally(() => {
        if (!active) return;
        setIsManagerScopeLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isManager, soccod, uticod, sercod]);

  const displayData: Conge[] = useMemo(() => {
    if (isEmp && uticod) {
      return data.filter((c: Conge) => c.empcod === uticod);
    }

    if (isManager && sercod) {
      if (!managerEmployeeCodes) return [];
      return data.filter((c: Conge) => managerEmployeeCodes.has(c.empcod));
    }

    return data;
  }, [data, isEmp, uticod, isManager, sercod, managerEmployeeCodes]);

  const isDataLoading = isLoading || (isManager && !!sercod && isManagerScopeLoading);

  const pending = displayData.filter((c: Conge) => getStatus(c) === 'pending');
  const accepted = displayData.filter((c: Conge) => getStatus(c) === 'accepted');
  const refused = displayData.filter((c: Conge) => getStatus(c) === 'refused');

  // Filtres user-driven appliqués par-dessus le filtrage de scope (rôle/service)
  // → recherche libre + statut + type d'absence + bornes de dates. Les compteurs
  // de la sidebar (`pending`/`accepted`/`refused`) restent calculés sur `displayData`
  // pour ne pas changer quand on ajuste un filtre.
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | CongeStatusKey>('all');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const filteredData: Conge[] = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom).getTime() : null;
    const to = dateTo ? new Date(dateTo).getTime() : null;
    return displayData.filter((c: Conge) => {
      if (statusFilter !== 'all' && getStatus(c) !== statusFilter) return false;
      if (typeFilter && c.abscod !== typeFilter) return false;
      if (q) {
        const hay = `${c.emplib ?? ''} ${c.empcod ?? ''} ${c.concod ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      // Recouvrement entre la période [condep, conret] et la fenêtre [from, to].
      if (from !== null || to !== null) {
        const dep = c.condep ? new Date(c.condep).getTime() : null;
        const ret = c.conret ? new Date(c.conret).getTime() : dep;
        if (dep === null) return false;
        if (from !== null && ret !== null && ret < from) return false;
        if (to !== null && dep > to) return false;
      }
      return true;
    });
  }, [displayData, searchQuery, statusFilter, typeFilter, dateFrom, dateTo]);

  const hasActiveFilter = searchQuery !== '' || statusFilter !== 'all' || typeFilter !== '' || dateFrom !== '' || dateTo !== '';
  const resetFilters = () => {
    setSearchQuery(''); setStatusFilter('all'); setTypeFilter(''); setDateFrom(''); setDateTo('');
  };
  const [formOpen, setFormOpen] = useState(false);
  const [editConge, setEditConge] = useState<Conge | null>(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [successAnim, setSuccessAnim] = useState<{ open: boolean; message: string }>({ open: false, message: '' });
  const [refuseConfirmOpen, setRefuseConfirmOpen] = useState(false);
  const [congeToRefuse, setCongeToRefuse] = useState<Conge | null>(null);
  const [acceptConfirmOpen, setAcceptConfirmOpen] = useState(false);
  const [congeToAccept, setCongeToAccept] = useState<Conge | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [congeToDelete, setCongeToDelete] = useState<Conge | null>(null);
  const deleteMutation = useDeleteDemConge();

  const showSnack = (message: string, severity: 'success' | 'error') =>
    setSnackbar({ open: true, message, severity });

  const handleAcceptClick = (c: Conge) => {
    setCongeToAccept(c);
    setAcceptConfirmOpen(true);
  };

  const confirmAccept = () => {
    // Promesse pour ActionButton : on transmet le succès/erreur au composant
    // afin qu'il joue son anim (check vert / croix rouge) avant de fermer le
    // dialog. La fermeture est faite dans `onSettled` du bouton.
    if (!congeToAccept) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      acceptConge({ concod: congeToAccept.concod, empcod: congeToAccept.empcod }, {
        onSuccess: (res: any) => {
          showSnack(res.message || t('conge.demConge.msg.acceptedSuccess'), 'success');
          refetch();
          resolve();
        },
        onError: (err: any) => {
          showSnack(err?.response?.data?.message || t('conge.demConge.msg.errorGeneric'), 'error');
          // La demande a pu être traitée entre-temps (liste périmée) : on rafraîchit
          // pour que la ligne reflète son vrai statut et ne propose plus l'action.
          refetch();
          reject(err);
        },
      });
    });
  };

  const handleRefuseClick = (c: Conge) => {
    setCongeToRefuse(c);
    setRefuseConfirmOpen(true);
  };

  const confirmRefuse = () => {
    if (!congeToRefuse) return Promise.resolve();
    const { soccod, concod, empcod } = congeToRefuse;
    // ActionButton lit le succès/échec via la promesse pour piloter son anim.
    // La fermeture du dialog est faite dans `onSettled` côté UI.
    return apiInstance.post(`/DemConges/refuse-demconge/${soccod}/${concod}/${empcod}`)
      .then((res) => {
        showSnack(res.data?.message || t('conge.demConge.msg.refusedSuccess'), 'success');
        refetch();
      })
      .catch((err) => {
        showSnack(err?.response?.data?.message || t('conge.demConge.msg.refuseError'), 'error');
        // Liste potentiellement périmée → on resynchronise le statut réel.
        refetch();
        throw err;
      });
  };

  const handleEdit = (c: Conge) => {
      setSelectedConge(c);
    setEditConge(c);
    setFormOpen(true);
  };

  const handleNewRequest = () => {
    setEditConge(null);
    setSelectedConge(null as any);
    setFormOpen(true);
  };

  const handlePrint = async (c: Conge) => {
    try {
      showSnack(t('conge.demConge.msg.generatingReport'), 'success');
      const response = await apiInstance.get(`/Conges/get-report/${c.concod}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `Conge_${c.concod}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showSnack(t('conge.demConge.msg.printError'), 'error');
    }
  };

  return (
    <Box className="dcm-container">
      {/* Header */}
      <Box className="dcm-header">
        <Box>
          <Typography className="dcm-title">{t('conge.demConge.title')}</Typography>
          <Typography className="dcm-subtitle">
            <Trans
              i18nKey="conge.demConge.subtitlePending"
              count={pending.length}
              values={{ count: pending.length }}
              components={{ 0: <strong style={{ color: '#0040a1' }} /> }}
            />
          </Typography>
        </Box>
        {canAdd && (
          <Button className="dcm-new-btn" startIcon={<AddIcon />} onClick={handleNewRequest}>
            {t('conge.demConge.newRequest')}
          </Button>
        )}
      </Box>

      <Box className="dcm-body">
        {/* Left: table */}
        <Box className="dcm-left">
          {/* Filter toolbar */}
          <Box sx={{
            display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center',
            p: '10px 12px', mb: 1.5,
            background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px',
          }}>
            {/* Search */}
            <Box sx={{
              display: 'flex', alignItems: 'center', gap: 0.5,
              background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px',
              px: 1.25, height: 34, flex: '1 1 220px', minWidth: 180,
            }}>
              <SearchIcon sx={{ fontSize: 16, color: '#94a3b8' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t('conge.demConge.filters.searchPlaceholder')}
                style={{
                  border: 'none', outline: 'none', background: 'transparent',
                  fontSize: '13px', flex: 1, color: '#0f172a',
                }}
              />
            </Box>

            {/* Status tabs with counts (compted on the role-scoped data, not on filtered) */}
            <Box sx={{ display: 'flex', gap: 0.5, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', p: '3px' }}>
              {([
                { key: 'all', label: t('conge.demConge.filters.statusAll'), count: displayData.length },
                { key: 'pending', label: t('conge.demConge.status.pending'), count: pending.length },
                { key: 'accepted', label: t('conge.demConge.status.accepted'), count: accepted.length },
                { key: 'refused', label: t('conge.demConge.status.refused'), count: refused.length },
              ] as const).map(tab => {
                const active = statusFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setStatusFilter(tab.key as any)}
                    style={{
                      border: 'none', cursor: 'pointer', borderRadius: '6px',
                      padding: '4px 10px', fontSize: '12px', fontWeight: 700,
                      background: active ? '#0040a1' : 'transparent',
                      color: active ? '#fff' : '#64748b',
                      transition: 'background 0.15s, color 0.15s',
                    }}
                  >
                    {tab.label} <span style={{ opacity: 0.75, marginLeft: 4 }}>({tab.count})</span>
                  </button>
                );
              })}
            </Box>

            {/* Type filter */}
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <Select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                displayEmpty
                sx={{ height: 34, fontSize: '13px', background: '#fff', borderRadius: '8px' }}
              >
                <MenuItem value=""><em>{t('conge.demConge.filters.typeAll')}</em></MenuItem>
                {Object.entries(absenceLibs || {}).map(([code, lib]) => (
                  <MenuItem key={code} value={code}>{lib}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Date range */}
            <TextField
              type="date" size="small" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              label={t('conge.demConge.filters.from')}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 150, '& .MuiInputBase-root': { height: 34, background: '#fff', borderRadius: '8px', fontSize: '12px' } }}
            />
            <TextField
              type="date" size="small" value={dateTo} onChange={e => setDateTo(e.target.value)}
              label={t('conge.demConge.filters.to')}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 150, '& .MuiInputBase-root': { height: 34, background: '#fff', borderRadius: '8px', fontSize: '12px' } }}
            />

            {hasActiveFilter && (
              <IconButton size="small" onClick={resetFilters} title={t('conge.demConge.filters.reset')} sx={{ color: '#64748b' }}>
                <FilterAltOffIcon fontSize="small" />
              </IconButton>
            )}
          </Box>

          {/* Table header */}
          <Box className="dcm-table-head">
            <Box className="dcm-th dcm-col-emp">{t('conge.demConge.headers.employee')}</Box>
            <Box className="dcm-th dcm-col-type">{t('conge.demConge.headers.type')}</Box>
            <Box className="dcm-th dcm-col-period">{t('conge.demConge.headers.period')}</Box>
            <Box className="dcm-th dcm-col-status">{t('conge.demConge.headers.status')}</Box>
            <Box className="dcm-th dcm-col-actions" style={{ textAlign: 'right' }}>{t('conge.demConge.headers.actions')}</Box>
          </Box>

          {/* Rows */}
          {isDataLoading ? (
            <ListSkeleton rows={5} />
          ) : !canConsult ? (
            <Box sx={{ textAlign: 'center', py: 6, color: '#ba1a1a' }}>
              <CloseIcon sx={{ fontSize: 48, mb: 1, opacity: 0.4 }} />
              <Typography>{t('conge.demConge.noConsult')}</Typography>
            </Box>
          ) : displayData.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6, px: 3, maxWidth: 460, mx: 'auto' }}>
              {/* Empty state CTA : on transforme l'absence de demandes en
                  message rassurant + raccourci pour en créer une nouvelle. */}
              <Box
                sx={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #dcfce7 0%, #86efac 100%)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  mb: 1.5, boxShadow: '0 6px 16px rgba(22,101,52,0.15)',
                }}
              >
                <CalendarTodayIcon sx={{ fontSize: 30, color: '#166534' }} />
              </Box>
              <Typography sx={{ fontSize: 16, fontWeight: 800, color: '#065f46', mb: 0.5 }}>
                {t('conge.demConge.emptyTitle')}
              </Typography>
              <Typography sx={{ fontSize: 13, color: '#64748b', lineHeight: 1.5, mb: 2 }}>
                {t('conge.demConge.emptyHint')}
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => { setEditConge(null); setFormOpen(true); }}
                sx={{ textTransform: 'none', fontWeight: 700, background: '#0040a1', '&:hover': { background: '#003280' } }}
              >
                {t('conge.demConge.emptyCta')}
              </Button>
            </Box>
          ) : filteredData.length === 0 ? (
            // Données existantes mais aucune ne matche les filtres courants —
            // on propose un reset plutôt que le CTA "Nouvelle demande" pour ne
            // pas pousser à créer un doublon par confusion.
            <Box sx={{ textAlign: 'center', py: 6, px: 3 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#475569', mb: 0.5 }}>
                {t('conge.demConge.filters.noMatchTitle')}
              </Typography>
              <Typography sx={{ fontSize: 12, color: '#64748b', mb: 2 }}>
                {t('conge.demConge.filters.noMatchHint')}
              </Typography>
              <Button
                variant="outlined" size="small" startIcon={<FilterAltOffIcon />} onClick={resetFilters}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                {t('conge.demConge.filters.reset')}
              </Button>
            </Box>
          ) : (
            <Box className="dcm-rows">
              {filteredData.map((c: Conge, idx: number) => {
                const status = getStatus(c);
                const typeColor = getTypeColor(c.abscod);
                const statusStyle = STATUS_STYLE[status];
                return (
                  <Box key={c.concod} className="dcm-row" sx={staggerSx(idx)}>
                    {/* Employee */}
                    <Box className="dcm-col-emp dcm-emp-cell">
                      <Avatar className="dcm-avatar">{(c.emplib || c.empcod)?.charAt(0)?.toUpperCase()}</Avatar>
                      <Box>
                        <Typography className="dcm-emp-name">{c.emplib || c.empcod}</Typography>
                        <Typography className="dcm-emp-sub">#{c.concod}</Typography>
                      </Box>
                    </Box>

                    {/* Type */}
                    <Box className="dcm-col-type">
                      <Box className="dcm-type-badge" style={{ backgroundColor: typeColor.bg, color: typeColor.text }}>
                        {absenceLibs?.[c.abscod] || c.abscod || '—'}
                      </Box>
                    </Box>

                    {/* Period */}
                    <Box className="dcm-col-period">
                      <Typography className="dcm-period-dates">
                        {fmtDate(c.condep)} — {fmtDate(c.conret)}
                      </Typography>
                      <Typography className="dcm-period-days">{t('conge.demConge.daysWorked', { count: c.connbjour })}</Typography>
                    </Box>

                    {/* Status */}
                    <Box className="dcm-col-status">
                      <Box className="dcm-status-badge" style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}>
                        {t(`conge.demConge.status.${status}`)}
                      </Box>
                    </Box>

                    {/* Actions */}
                    <Box className="dcm-col-actions dcm-actions">
                      <IconButton size="small"
                        sx={{ color: '#0040a1', backgroundColor: '#e0e7ff', '&:hover': { backgroundColor: '#c7d2fe' } }}
                        onClick={() => handlePrint(c)}
                        title={t('conge.demConge.actions.print')}
                      >
                        <PrintIcon fontSize="small" />
                      </IconButton>
                      {(canModify || (isEmp && c.empcod === uticod && status === 'pending')) && (
                        <IconButton size="small" className="dcm-action-edit" onClick={() => handleEdit(c)} title={t('conge.demConge.actions.edit')}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      )}
                      {isEmp && c.empcod === uticod && status === 'pending' && (
                        <IconButton size="small"
                          sx={{ color: '#ba1a1a', backgroundColor: '#fee2e2', '&:hover': { backgroundColor: '#fecaca' } }}
                          onClick={() => { setCongeToDelete(c); setDeleteConfirmOpen(true); }}
                          title={t('conge.demConge.actions.deleteMine')}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                      {status === 'pending' && c.empcod !== uticod && (
                        <>
                          {canDelete && (
                            <Button size="small" className="dcm-action-refuse" onClick={() => handleRefuseClick(c)} startIcon={<CloseIcon />}>
                              {t('conge.demConge.actions.refuse')}
                            </Button>
                          )}
                          {canModify && (
                            <Button size="small" className="dcm-action-accept" onClick={() => handleAcceptClick(c)} startIcon={<CheckIcon />}>
                              {t('conge.demConge.actions.accept')}
                            </Button>
                          )}
                        </>
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>

        {/* Right sidebar */}
        <Box className="dcm-sidebar">
          {/* Mini Calendar */}
          <MiniCalendar leaves={displayData} />

          {/* Availability */}
          <Paper className="dcm-avail-card">
            <Typography className="dcm-avail-title">{t('conge.demConge.sidebar.availability')}</Typography>
            <Box className="dcm-avail-row">
              <Typography className="dcm-avail-label">{t('conge.demConge.sidebar.presents')}</Typography>
              <Typography className="dcm-avail-count">
                {displayData.length - pending.length} / {displayData.length}
              </Typography>
            </Box>
            <Box className="dcm-avail-bar">
              <Box className="dcm-avail-fill" style={{ width: displayData.length ? `${((displayData.length - pending.length) / displayData.length) * 100}%` : '0%' }} />
            </Box>
          </Paper>

          {/* Quick stats */}
          <Box className="dcm-stats-grid">
            <Paper className="dcm-stat-card">
              <Typography className="dcm-stat-value dcm-stat-primary">{accepted.length}</Typography>
              <Typography className="dcm-stat-label">{t('conge.demConge.sidebar.validatedMonth')}</Typography>
            </Paper>
            <Paper className="dcm-stat-card">
              <Typography className="dcm-stat-value dcm-stat-error">{refused.length}</Typography>
              <Typography className="dcm-stat-label">{t('conge.demConge.sidebar.refusedMonth')}</Typography>
            </Paper>
            <Paper className="dcm-stat-card">
              <Typography className="dcm-stat-value dcm-stat-warning">{pending.length}</Typography>
              <Typography className="dcm-stat-label">{t('conge.demConge.sidebar.pending')}</Typography>
            </Paper>
            <Paper className="dcm-stat-card">
              <Typography className="dcm-stat-value dcm-stat-primary">{displayData.length}</Typography>
              <Typography className="dcm-stat-label">{t('conge.demConge.sidebar.totalRequests')}</Typography>
            </Paper>
          </Box>
        </Box>
      </Box>

      {/* Form Dialog */}
      <CongeFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); refetch(); }}
        editConge={editConge}
        onSuccess={() => {
          const msg = editConge ? t('conge.demConge.msg.updatedSuccess') : t('conge.demConge.msg.createdSuccess');
          showSnack(msg, 'success');
          // Animation succès en plus du snackbar : feedback humain pour confirmer
          // que la demande a bien été enregistrée.
          setSuccessAnim({ open: true, message: editConge ? 'Demande mise à jour' : 'Demande envoyée !' });
        }}
      />

      {/* Accept Confirmation Dialog */}
      <Dialog
        open={acceptConfirmOpen}
        onClose={() => setAcceptConfirmOpen(false)}
        PaperProps={{ sx: { borderRadius: '12px', minWidth: '350px' } }}
      >
        <DialogTitle sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '18px', color: '#005136' }}>
          {t('conge.demConge.dialog.acceptTitle')}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#475569', fontSize: '14px', mt: 1 }}>
            {t('conge.demConge.dialog.acceptPrompt', {
              employee: congeToAccept ? ` de ${congeToAccept.emplib || congeToAccept.empcod}` : '',
              type: (congeToAccept && absenceLibs?.[congeToAccept.abscod])
                ? ` (${absenceLibs[congeToAccept.abscod]})`
                : '',
            })}
          </Typography>
          {congeToAccept && (
            <Box sx={{ mt: 2, p: 1.5, background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
              <Typography sx={{ fontSize: '12px', color: '#166534', fontWeight: 600 }}>
                {fmtDate(congeToAccept.condep)} — {fmtDate(congeToAccept.conret)} · {t('conge.demConge.daysWorked', { count: congeToAccept.connbjour })}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAcceptConfirmOpen(false)} sx={{ color: '#64748b', textTransform: 'none' }}>
            {t('conge.demConge.dialog.cancel')}
          </Button>
          <ActionButton
            onAction={confirmAccept}
            onSettled={() => { setAcceptConfirmOpen(false); setCongeToAccept(null); }}
            variant="contained"
            color="success"
            startIcon={<CheckIcon />}
            successLabel={t('conge.demConge.msg.acceptedSuccess')}
            sx={{ textTransform: 'none', borderRadius: '8px' }}
          >
            {t('conge.demConge.dialog.acceptYes')}
          </ActionButton>
        </DialogActions>
      </Dialog>

      {/* Refuse Confirmation Dialog */}
      <Dialog
        open={refuseConfirmOpen}
        onClose={() => setRefuseConfirmOpen(false)}
        PaperProps={{ sx: { borderRadius: '12px', minWidth: '350px' } }}
      >
        <DialogTitle sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '18px', color: '#ba1a1a' }}>
          {t('conge.demConge.dialog.refuseTitle')}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#475569', fontSize: '14px', mt: 1 }}>
            {t('conge.demConge.dialog.refusePrompt', {
              employee: congeToRefuse ? ` de ${congeToRefuse.emplib || congeToRefuse.empcod}` : '',
            })}
          </Typography>
          <Typography sx={{ color: '#64748b', fontSize: '12px', mt: 2 }}>
            {t('conge.demConge.dialog.irreversible')}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRefuseConfirmOpen(false)} sx={{ color: '#64748b', textTransform: 'none' }}>
            {t('conge.demConge.dialog.cancel')}
          </Button>
          <ActionButton
            onAction={confirmRefuse}
            onSettled={() => { setRefuseConfirmOpen(false); setCongeToRefuse(null); }}
            variant="contained"
            color="error"
            startIcon={<CloseIcon />}
            successLabel={t('conge.demConge.msg.refusedSuccess')}
            successColor="#dc2626"
            sx={{ textTransform: 'none', borderRadius: '8px' }}
          >
            {t('conge.demConge.dialog.refuseYes')}
          </ActionButton>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        PaperProps={{ sx: { borderRadius: '12px', minWidth: '350px' } }}
      >
        <DialogTitle sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '18px', color: '#ba1a1a' }}>
          {t('conge.demConge.dialog.deleteTitle')}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#475569', fontSize: '14px', mt: 1 }}>
            {t('conge.demConge.dialog.deletePrompt', { ref: congeToDelete ? ` (${congeToDelete.concod})` : '' })}
          </Typography>
          <Typography sx={{ color: '#64748b', fontSize: '12px', mt: 2 }}>
            {t('conge.demConge.dialog.irreversible')}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteConfirmOpen(false)} sx={{ color: '#64748b', textTransform: 'none' }}>
            {t('conge.demConge.dialog.cancel')}
          </Button>
          <Button
            onClick={() => {
              if (!congeToDelete) return;
              deleteMutation.mutate(
                { soccod: congeToDelete.soccod, concod: congeToDelete.concod },
                {
                  onSuccess: () => { showSnack(t('conge.demConge.msg.deletedSuccess'), 'success'); refetch(); },
                  onError: () => showSnack(t('conge.demConge.msg.deleteError'), 'error'),
                }
              );
              setDeleteConfirmOpen(false);
              setCongeToDelete(null);
            }}
            variant="contained" color="error"
            disabled={deleteMutation.isPending}
            startIcon={deleteMutation.isPending ? <CircularProgress size={14} color="inherit" /> : <DeleteIcon />}
            sx={{ textTransform: 'none', borderRadius: '8px' }}
          >
            {t('conge.demConge.dialog.deleteYes')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })} sx={{ borderRadius: '10px' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      <SuccessAnimation
        open={successAnim.open}
        onClose={() => setSuccessAnim({ open: false, message: '' })}
        message={successAnim.message}
      />
    </Box>
  );
}

const DemCongeModern = () => (
  <CongeProvider>
    <DemCongeModernInner />
  </CongeProvider>
);

export default DemCongeModern;
