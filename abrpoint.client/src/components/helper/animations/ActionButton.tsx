import * as React from 'react';
import { Button, ButtonProps, CircularProgress, keyframes } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';

/**
 * Bouton d'action avec micro-interaction de confirmation.
 *
 * Workflow :
 *   1. État `idle` : libellé + icône d'origine.
 *   2. L'utilisateur clique → handler asynchrone fourni via `onAction` :
 *      le bouton bascule en `loading` (spinner inline, libellé conservé).
 *   3. Selon l'issue : `success` (check vert + bounce) ou `error` (croix
 *      rouge + shake). L'animation dure ~800 ms avant `onSettled` — le
 *      parent peut alors retirer la ligne, refetch, fermer un dialog…
 *
 * Pourquoi : avant cette anim, les lignes disparaissaient sèchement au
 * moment où le serveur répondait. L'œil n'a pas le temps d'enregistrer
 * que l'action a réussi, donc l'utilisateur clique parfois une 2ᵉ fois.
 * Les ~800 ms de feedback visuel évitent ce doute.
 */

const popIn = keyframes`
  0%   { transform: scale(0.6); opacity: 0; }
  60%  { transform: scale(1.15); opacity: 1; }
  100% { transform: scale(1);    opacity: 1; }
`;

const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  20%      { transform: translateX(-4px); }
  40%      { transform: translateX(4px); }
  60%      { transform: translateX(-3px); }
  80%      { transform: translateX(2px); }
`;

type Phase = 'idle' | 'loading' | 'success' | 'error';

export interface ActionButtonProps extends Omit<ButtonProps, 'onClick'> {
  /** Handler asynchrone. Si la promesse résout → success, si elle rejette → error. */
  onAction: () => Promise<unknown> | void;
  /** Libellé en mode succès (ex: "Validé"). Si omis, on garde le libellé d'origine. */
  successLabel?: React.ReactNode;
  /** Libellé en mode erreur. Si omis, on garde le libellé d'origine. */
  errorLabel?: React.ReactNode;
  /** Délai (ms) avant de retomber en idle après success/error. Défaut 800 ms. */
  feedbackMs?: number;
  /** Appelé une fois la phase de feedback terminée (et seulement après un succès). */
  onSettled?: () => void;
  /** Couleur de la phase de succès (background). Défaut #16a34a (vert). */
  successColor?: string;
}

export function ActionButton({
  onAction,
  successLabel,
  errorLabel,
  feedbackMs = 800,
  onSettled,
  successColor = '#16a34a',
  startIcon,
  children,
  disabled,
  sx,
  ...rest
}: ActionButtonProps) {
  const [phase, setPhase] = React.useState<Phase>('idle');
  const mountedRef = React.useRef(true);

  React.useEffect(() => () => { mountedRef.current = false; }, []);

  const handleClick = async () => {
    if (phase !== 'idle') return;
    setPhase('loading');
    try {
      await Promise.resolve(onAction());
      if (!mountedRef.current) return;
      setPhase('success');
      window.setTimeout(() => {
        if (!mountedRef.current) return;
        onSettled?.();
        setPhase('idle');
      }, feedbackMs);
    } catch {
      if (!mountedRef.current) return;
      setPhase('error');
      window.setTimeout(() => {
        if (!mountedRef.current) return;
        setPhase('idle');
      }, feedbackMs);
    }
  };

  // Icône / libellé selon la phase. On garde la largeur stable en
  // ne laissant le libellé d'origine que si un override n'est pas fourni.
  const renderIcon = () => {
    if (phase === 'loading') return <CircularProgress size={14} thickness={5} sx={{ color: 'inherit' }} />;
    if (phase === 'success') return <CheckIcon sx={{ animation: `${popIn} 360ms cubic-bezier(0.34, 1.56, 0.64, 1)` }} />;
    if (phase === 'error')   return <CloseIcon sx={{ animation: `${popIn} 360ms cubic-bezier(0.34, 1.56, 0.64, 1)` }} />;
    return startIcon;
  };

  const renderLabel = () => {
    if (phase === 'success' && successLabel) return successLabel;
    if (phase === 'error' && errorLabel) return errorLabel;
    return children;
  };

  const phaseSx = (() => {
    if (phase === 'success') return {
      backgroundColor: `${successColor} !important`,
      color: '#fff !important',
      borderColor: `${successColor} !important`,
    };
    if (phase === 'error') return {
      backgroundColor: '#dc2626 !important',
      color: '#fff !important',
      borderColor: '#dc2626 !important',
      animation: `${shake} 360ms ease-in-out`,
    };
    return {};
  })();

  return (
    <Button
      {...rest}
      startIcon={renderIcon()}
      onClick={handleClick}
      disabled={disabled || phase === 'loading'}
      sx={{
        transition: 'background-color 220ms ease, color 220ms ease, border-color 220ms ease',
        ...phaseSx,
        ...sx,
      }}
    >
      {renderLabel()}
    </Button>
  );
}
