import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography, Button, IconButton, Stack, Chip } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../helper/AuthProvider';
import Confetti from '../helper/animations/Confetti';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import ScheduleIcon from '@mui/icons-material/Schedule';
import EventIcon from '@mui/icons-material/Event';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import DescriptionIcon from '@mui/icons-material/Description';

/**
 * Bannière contextuelle de progression d'onboarding affichée en tête de chaque
 * page d'une étape (poste / classe / calendrier / employé / contrat).
 *
 * Comportement :
 *   1. À l'ouverture de la page, la bannière annonce où on est dans le parcours
 *      ("Étape 1/5 — créer un poste de travail").
 *   2. Quand l'admin enrichit cette page avec son premier élément (détecté via
 *      la prop `dataCount > 0`), la bannière bascule en mode succès et propose
 *      la prochaine étape avec un CTA pour y aller directement.
 *   3. Une fois l'étape marquée comme faite, on stocke ça dans le même
 *      localStorage que l'OnboardingGuide du dashboard (clé `onboardingGuide_${soccod}`)
 *      pour que les deux composants restent synchrones.
 *   4. Si toutes les étapes sont déjà faites OU si le guide a été masqué
 *      globalement, la bannière ne s'affiche pas — on n'embête plus l'admin.
 *
 * Usage type :
 *   <OnboardingNextStepHint currentStep="poste" dataCount={postes.length} />
 */

type StepKey = 'poste' | 'classe' | 'calendrier' | 'employe' | 'contrat';

interface StepMeta {
  key: StepKey;
  index: number;
  label: string;
  cta: string;
  route: string;
  icon: React.ReactNode;
  /** Nom court utilisé dans la bannière de succès ("Poste créé !"). */
  successNoun: string;
}

const STEPS: StepMeta[] = [
  { key: 'poste',       index: 1, label: 'Poste de travail',         cta: 'Créer un poste',      route: '/dashboard/saisie-poste-de-travail', icon: <WorkOutlineIcon />, successNoun: 'Poste enregistré' },
  { key: 'classe',      index: 2, label: 'Classe horaire',           cta: 'Créer une classe',    route: '/dashboard/saisie-classe-horaire',   icon: <ScheduleIcon />,    successNoun: 'Classe enregistrée' },
  { key: 'calendrier',  index: 3, label: 'Calendrier (jours fériés)', cta: 'Configurer les fériés', route: '/dashboard/Repos',                   icon: <EventIcon />,       successNoun: 'Calendrier configuré' },
  { key: 'employe',     index: 4, label: 'Employé',                  cta: 'Ajouter un employé',  route: '/dashboard/gestion-employe',         icon: <GroupAddIcon />,    successNoun: 'Employé ajouté' },
  { key: 'contrat',     index: 5, label: 'Contrat',                  cta: 'Créer un contrat',    route: '/dashboard/contrat',                 icon: <DescriptionIcon />, successNoun: 'Contrat créé' },
];

interface OnboardingState {
  done: Record<StepKey, boolean>;
  dismissed: boolean;
}

const DEFAULT_STATE: OnboardingState = {
  done: { poste: false, classe: false, calendrier: false, employe: false, contrat: false },
  dismissed: false,
};

function loadState(soccod: string): OnboardingState {
  try {
    const raw = localStorage.getItem(`onboardingGuide_${soccod}`);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_STATE, ...parsed, done: { ...DEFAULT_STATE.done, ...(parsed.done || {}) } };
  } catch {
    return DEFAULT_STATE;
  }
}

function saveState(soccod: string, state: OnboardingState) {
  try {
    localStorage.setItem(`onboardingGuide_${soccod}`, JSON.stringify(state));
  } catch { /* quota — ignore */ }
}

interface OnboardingNextStepHintProps {
  /** Quelle étape la page courante représente. */
  currentStep: StepKey;
  /**
   * Nombre d'éléments présents sur la page (postes, classes, fériés, etc.).
   * Dès que ça passe à 1+, la bannière bascule en mode succès et propose
   * la prochaine étape. Optionnel — si non fourni, l'admin peut quand même
   * marquer manuellement comme fait via le bouton.
   */
  dataCount?: number;
  /**
   * Si true, masque la bannière même si l'étape n'est pas terminée. Utile
   * pour les écrans très denses où la bannière fait double-emploi avec un
   * vrai dialog d'onboarding.
   */
  hideWhenIdle?: boolean;
}

export default function OnboardingNextStepHint({ currentStep, dataCount, hideWhenIdle }: OnboardingNextStepHintProps) {
  const { soccod } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<OnboardingState>(() => loadState(soccod ?? ''));
  const [hiddenLocally, setHiddenLocally] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  // Référence l'état de complétion observé au render précédent. Permet de
  // détecter le passage `allDone: false → true` pour ne tirer le confetti
  // qu'une fois (le re-render qui suit le toggle de l'étape finale).
  const prevAllDoneRef = useRef<boolean>(false);

  const current = useMemo(() => STEPS.find(s => s.key === currentStep)!, [currentStep]);
  const next = useMemo(() => STEPS[current.index] /* index is 1-based, array is 0-based, so STEPS[current.index] = next */, [current]);

  const isCurrentDone = state.done[currentStep];
  const allDone = STEPS.every(s => state.done[s.key]);

  // Auto-marque l'étape comme faite dès qu'au moins un élément existe sur la
  // page. L'admin n'a rien à cocher : on observe simplement le résultat de son action.
  useEffect(() => {
    if (typeof dataCount === 'number' && dataCount > 0 && !state.done[currentStep]) {
      setState(prev => {
        const next = { ...prev, done: { ...prev.done, [currentStep]: true } };
        saveState(soccod ?? '', next);
        return next;
      });
    }
  }, [dataCount, currentStep, soccod, state.done]);

  // Détection du jalon « 5/5 » : on tire le confetti une seule fois quand
  // toutes les étapes viennent d'être validées. Un flag dédié dans
  // localStorage (`onboardingCelebrated_${soccod}`) garantit qu'un reload
  // ne relance pas l'animation indéfiniment.
  useEffect(() => {
    const justCompleted = allDone && !prevAllDoneRef.current;
    prevAllDoneRef.current = allDone;
    if (!justCompleted) return;
    const flagKey = `onboardingCelebrated_${soccod ?? ''}`;
    try {
      if (localStorage.getItem(flagKey)) return;
      localStorage.setItem(flagKey, '1');
    } catch { /* quota — ignore */ }
    setShowConfetti(true);
  }, [allDone, soccod]);

  // Conditions de masquage : tout est fait, l'utilisateur a globalement masqué le guide,
  // ou la page demande explicitement de cacher quand rien n'est en cours.
  if (state.dismissed || hiddenLocally || allDone) {
    // Important : on continue à rendre <Confetti /> tant qu'il joue, même si
    // la bannière elle-même est masquée — sinon le canvas est démonté avant
    // la fin de l'animation au moment précis où on déclenche la célébration.
    return showConfetti ? <Confetti onDone={() => setShowConfetti(false)} /> : null;
  }
  if (hideWhenIdle && !isCurrentDone && (dataCount ?? 0) === 0) return null;

  const handleContinue = () => {
    // Marquer l'étape comme faite (au cas où elle ne l'est pas déjà via dataCount)
    // puis naviguer vers la suivante. Si on est déjà à la dernière, on ne va nulle part.
    if (!state.done[currentStep]) {
      setState(prev => {
        const upd = { ...prev, done: { ...prev.done, [currentStep]: true } };
        saveState(soccod ?? '', upd);
        return upd;
      });
    }
    if (next) navigate(next.route);
  };

  const handleSkip = () => {
    setHiddenLocally(true);
  };

  // ── Rendu : 2 modes ──
  // a) Mode "en cours" : page vide, on rappelle où on est et ce qui suit.
  // b) Mode "succès"   : l'étape vient d'être validée, on félicite + on pousse vers la suite.
  const isSuccessMode = isCurrentDone || (typeof dataCount === 'number' && dataCount > 0);

  return (
    <Box
      sx={{
        background: isSuccessMode
          ? 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)'
          : 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
        border: '1px solid',
        borderColor: isSuccessMode ? '#a7f3d0' : '#bfdbfe',
        borderRadius: 2.5,
        px: 2.5, py: 1.75,
        mx: { xs: 1.5, sm: 3 }, mt: 2, mb: 1,
        display: 'flex', alignItems: 'center', gap: 2,
        animation: 'onboardingHintIn 0.4s ease-out',
        '@keyframes onboardingHintIn': {
          from: { opacity: 0, transform: 'translateY(-8px)' },
          to:   { opacity: 1, transform: 'translateY(0)' },
        },
      }}
    >
      {/* Icône statut */}
      <Box
        sx={{
          width: 40, height: 40, borderRadius: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          bgcolor: isSuccessMode ? '#10b981' : '#0040a1',
          color: '#fff', flexShrink: 0,
        }}
      >
        {isSuccessMode ? <CheckCircleIcon /> : current.icon}
      </Box>

      {/* Texte */}
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
          <Typography sx={{ fontWeight: 800, fontSize: 14, color: isSuccessMode ? '#065f46' : '#0040a1' }}>
            {isSuccessMode ? `🎯 ${current.successNoun} !` : `Étape ${current.index}/5 — ${current.label}`}
          </Typography>
          <Chip
            size="small"
            label={`${current.index}/5`}
            sx={{
              fontWeight: 800, height: 20, fontSize: 11,
              bgcolor: isSuccessMode ? '#10b981' : '#0040a1',
              color: '#fff',
            }}
          />
        </Stack>
        <Typography sx={{ fontSize: 12.5, color: '#475569', mt: 0.25, lineHeight: 1.4 }}>
          {isSuccessMode
            ? next
              ? <>Prochaine étape : <strong>{next.label}</strong> — {next.cta.toLowerCase()} pour continuer la configuration.</>
              : 'Vous avez terminé toutes les étapes de configuration. Bravo !'
            : `Cette page sert à ${current.cta.toLowerCase()}. Une fois fait, on enchaînera avec la suite du parcours.`}
        </Typography>
      </Box>

      {/* CTA principal */}
      {next && isSuccessMode && (
        <Button
          variant="contained"
          endIcon={<ChevronRightIcon />}
          onClick={handleContinue}
          sx={{
            textTransform: 'none', fontWeight: 700, fontSize: 13,
            bgcolor: '#10b981', whiteSpace: 'nowrap', flexShrink: 0,
            '&:hover': { bgcolor: '#059669' },
          }}
        >
          {next.cta}
        </Button>
      )}
      {!next && isSuccessMode && (
        <Button
          variant="contained"
          onClick={() => navigate('/dashboard')}
          sx={{
            textTransform: 'none', fontWeight: 700, fontSize: 13,
            bgcolor: '#10b981', whiteSpace: 'nowrap', flexShrink: 0,
            '&:hover': { bgcolor: '#059669' },
          }}
        >
          Retour au tableau de bord
        </Button>
      )}

      {/* Croix : ferme localement (l'utilisateur peut le re-déclencher en rechargeant) */}
      <IconButton size="small" onClick={handleSkip} sx={{ ml: 0.5, flexShrink: 0 }}>
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
