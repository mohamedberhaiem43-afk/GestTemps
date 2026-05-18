import { useMemo, useState, useEffect } from 'react';
import {
  Box, Typography, IconButton, LinearProgress, Stack, Button, Chip,
  Collapse, Tooltip,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../helper/AuthProvider';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import ScheduleIcon from '@mui/icons-material/Schedule';
import EventIcon from '@mui/icons-material/Event';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import DescriptionIcon from '@mui/icons-material/Description';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CloseIcon from '@mui/icons-material/Close';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

/**
 * Guide d'onboarding interactif pour les administrateurs : enchaîne les 5 étapes
 * de configuration minimale avant de pouvoir gérer un pointage cohérent.
 *
 * Ordre métier (chaque étape conditionne la suivante) :
 *   1. Poste de travail   (les horaires d'un poste : embauche, débauche, repas)
 *   2. Classe horaire     (regroupe plusieurs postes pour un type d'employé)
 *   3. Calendrier (jours fériés)
 *   4. Employé            (assigné à une classe horaire)
 *   5. Contrat            (lie l'employé à une période et un régime)
 *
 * Persistance : statut par étape stocké en localStorage par soccod, donc partagé
 * entre tous les utilisateurs admin du même tenant. L'admin peut "Tout masquer"
 * une fois sa configuration en place — le guide ne réapparaît pas tout seul.
 */

type StepKey = 'poste' | 'classe' | 'calendrier' | 'employe' | 'contrat';

interface Step {
  key: StepKey;
  title: string;
  description: string;
  cta: string;
  route: string;
  icon: React.ReactNode;
}

const STEPS: Step[] = [
  {
    key: 'poste',
    title: '1. Définir un poste de travail',
    description: 'Le poste fixe les horaires types : heure d\'embauche, débauche, durée de repas. C\'est la brique de base du calcul des heures.',
    cta: 'Créer un poste',
    route: '/dashboard/saisie-poste-de-travail',
    icon: <WorkOutlineIcon />,
  },
  {
    key: 'classe',
    title: '2. Créer une classe horaire',
    description: 'La classe regroupe plusieurs postes (jours ouvrés, week-ends, équipes) en un planning hebdomadaire qu\'on assignera aux employés.',
    cta: 'Créer une classe',
    route: '/dashboard/saisie-classe-horaire',
    icon: <ScheduleIcon />,
  },
  {
    key: 'calendrier',
    title: '3. Saisir le calendrier (jours fériés)',
    description: 'Les jours fériés impactent la paie (majoration, primes). Définissez-les pour l\'année en cours avant le premier pointage.',
    cta: 'Configurer les fériés',
    route: '/dashboard/Repos',
    icon: <EventIcon />,
  },
  {
    key: 'employe',
    title: '4. Ajouter un employé',
    description: 'Renseignez vos collaborateurs et associez-les à une classe horaire. Sans cette étape, aucun pointage ne sera traité.',
    cta: 'Ajouter un employé',
    route: '/dashboard/gestion-employe',
    icon: <GroupAddIcon />,
  },
  {
    key: 'contrat',
    title: '5. Créer le contrat',
    description: 'Le contrat lie l\'employé à une période, un régime (mensuel/horaire) et un salaire. Indispensable pour la préparation paie.',
    cta: 'Créer un contrat',
    route: '/dashboard/contrat',
    icon: <DescriptionIcon />,
  },
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
  } catch { /* quota exceeded — ignore */ }
}

interface OnboardingGuideProps {
  /**
   * Utilisé pour déduire automatiquement la complétion de l'étape "Employé"
   * sans solliciter une API supplémentaire (la donnée est déjà sur le dashboard).
   */
  totalEmployees?: number;
}

export default function OnboardingGuide({ totalEmployees }: OnboardingGuideProps) {
  const { soccod } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<OnboardingState>(() => loadState(soccod ?? ''));
  const [expanded, setExpanded] = useState(true);

  // Auto-complétion de l'étape "Employé" dès que le dashboard remonte un compteur
  // > 0 — évite à l'admin de devoir cocher manuellement quelque chose qui est
  // déjà visible dans les KPI à côté.
  useEffect(() => {
    if ((totalEmployees ?? 0) > 0 && !state.done.employe) {
      setState(prev => {
        const next = { ...prev, done: { ...prev.done, employe: true } };
        saveState(soccod ?? '', next);
        return next;
      });
    }
  }, [totalEmployees, soccod, state.done.employe]);

  const completedCount = useMemo(
    () => Object.values(state.done).filter(Boolean).length,
    [state.done]
  );
  const progress = (completedCount / STEPS.length) * 100;
  const allDone = completedCount === STEPS.length;
  const nextStepKey = STEPS.find(s => !state.done[s.key])?.key;

  if (state.dismissed) return null;

  const toggleStep = (key: StepKey) => {
    setState(prev => {
      const next = { ...prev, done: { ...prev.done, [key]: !prev.done[key] } };
      saveState(soccod ?? '', next);
      return next;
    });
  };

  const handleNavigate = (route: string, _key: StepKey) => {
    // ⚠ Avant : on toggleait l'étape dès le clic CTA — résultat, l'utilisateur
    // pouvait "valider" tout le parcours en cliquant les 5 boutons sans rien
    // créer en base, et le confetti se déclenchait à tort.
    // Maintenant : on navigue simplement. L'étape sera marquée "faite"
    // uniquement quand `dataCount > 0` aura été détecté sur la page cible
    // (cf. OnboardingNextStepHint.useEffect), c.-à-d. quand un poste/classe/
    // employé/contrat réel aura été créé. L'admin garde la possibilité de
    // cocher manuellement la case via le checkbox du guide s'il a fait l'étape
    // en dehors du parcours (ex. import bulk).
    navigate(route);
  };

  const handleDismiss = () => {
    const next = { ...state, dismissed: true };
    setState(next);
    saveState(soccod ?? '', next);
  };

  return (
    <Box
      sx={{
        background: allDone
          ? 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)'
          : 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
        border: '1px solid',
        borderColor: allDone ? '#a7f3d0' : '#bfdbfe',
        borderRadius: 3,
        p: 2.5,
        mb: 3,
        position: 'relative',
        transition: 'all 0.3s',
      }}
    >
      {/* Header : titre + progression + actions */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
        <Box sx={{ flexGrow: 1 }}>
          <Stack direction="row" alignItems="center" gap={1} mb={0.5}>
            <Typography sx={{ fontWeight: 800, fontSize: 16, color: allDone ? '#065f46' : '#0040a1' }}>
              {allDone ? '🎉 Configuration terminée' : '👋 Bienvenue ! Configurez votre espace en 5 étapes'}
            </Typography>
            <Chip
              size="small"
              label={`${completedCount}/${STEPS.length}`}
              sx={{
                fontWeight: 800,
                bgcolor: allDone ? '#10b981' : '#0040a1',
                color: '#fff',
                height: 22,
              }}
            />
          </Stack>
          <Typography sx={{ fontSize: 13, color: '#475569', mb: 1.5 }}>
            {allDone
              ? 'Tout est prêt — vos employés peuvent commencer à pointer.'
              : 'Suivez ces étapes dans l\'ordre. Chaque étape conditionne la suivante.'}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: 'rgba(0,64,161,0.08)',
              '& .MuiLinearProgress-bar': {
                bgcolor: allDone ? '#10b981' : '#0040a1',
                borderRadius: 4,
              },
            }}
          />
        </Box>
        <Stack direction="row" spacing={0.5}>
          <Tooltip title={expanded ? 'Réduire' : 'Voir les étapes'}>
            <IconButton size="small" onClick={() => setExpanded(e => !e)}>
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Masquer ce guide">
            <IconButton size="small" onClick={handleDismiss}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      <Collapse in={expanded}>
        <Stack spacing={1.25} mt={2}>
          {STEPS.map(step => {
            const isDone = state.done[step.key];
            const isNext = step.key === nextStepKey;
            return (
              <Box
                key={step.key}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1.5,
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: isDone
                    ? 'rgba(16,185,129,0.08)'
                    : isNext
                      ? '#fff'
                      : 'rgba(255,255,255,0.5)',
                  border: '1px solid',
                  borderColor: isDone
                    ? 'rgba(16,185,129,0.25)'
                    : isNext
                      ? '#0040a1'
                      : 'transparent',
                  boxShadow: isNext ? '0 4px 12px rgba(0,64,161,0.12)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                {/* Checkbox cliquable pour marquer manuellement comme fait */}
                <IconButton
                  size="small"
                  onClick={() => toggleStep(step.key)}
                  sx={{ p: 0.25, mt: 0.25 }}
                >
                  {isDone
                    ? <CheckCircleIcon sx={{ color: '#10b981', fontSize: 22 }} />
                    : <RadioButtonUncheckedIcon sx={{ color: '#94a3b8', fontSize: 22 }} />}
                </IconButton>

                {/* Icône métier de l'étape */}
                <Box
                  sx={{
                    width: 36, height: 36, borderRadius: 1.5,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    bgcolor: isDone ? '#d1fae5' : isNext ? '#dbeafe' : '#f1f5f9',
                    color: isDone ? '#065f46' : isNext ? '#0040a1' : '#64748b',
                    flexShrink: 0,
                  }}
                >
                  {step.icon}
                </Box>

                {/* Texte */}
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontWeight: 700,
                      fontSize: 14,
                      color: isDone ? '#065f46' : '#0f172a',
                      textDecoration: isDone ? 'line-through' : 'none',
                      opacity: isDone ? 0.7 : 1,
                    }}
                  >
                    {step.title}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: '#475569', mt: 0.25, lineHeight: 1.4 }}>
                    {step.description}
                  </Typography>
                </Box>

                {/* CTA */}
                {!isDone && (
                  <Button
                    size="small"
                    variant={isNext ? 'contained' : 'outlined'}
                    endIcon={<ChevronRightIcon />}
                    onClick={() => handleNavigate(step.route, step.key)}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: 12,
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                      bgcolor: isNext ? '#0040a1' : 'transparent',
                      color: isNext ? '#fff' : '#0040a1',
                      borderColor: '#0040a1',
                      '&:hover': {
                        bgcolor: isNext ? '#003080' : 'rgba(0,64,161,0.06)',
                      },
                    }}
                  >
                    {step.cta}
                  </Button>
                )}
              </Box>
            );
          })}
        </Stack>

        {allDone && (
          <Box sx={{ mt: 2, textAlign: 'right' }}>
            <Button
              size="small"
              variant="contained"
              onClick={handleDismiss}
              sx={{
                textTransform: 'none', fontWeight: 700,
                bgcolor: '#10b981',
                '&:hover': { bgcolor: '#059669' },
              }}
            >
              Fermer le guide
            </Button>
          </Box>
        )}
      </Collapse>
    </Box>
  );
}
