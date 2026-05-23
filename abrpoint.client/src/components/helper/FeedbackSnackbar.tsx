import { ReactNode, useCallback, useState } from 'react';
import { Snackbar, Alert } from '@mui/material';

/**
 * Snackbar + Alert standardisé pour les messages de validation/erreur applicatifs.
 *
 * Pattern repris de [gestionEmploye/EmployeModern.tsx] — top-center, filled, rounded,
 * shadow, auto-hide 5 s, z-index > Dialog (1500). Toute interface qui doit afficher
 * un message de succès ou d'erreur après une action utilisateur doit utiliser ce hook
 * pour rester cohérente avec la fiche collaborateur.
 *
 * Extraction d'erreur :
 *   showError(err, fallback) lit dans l'ordre :
 *     err?.response?.data?.message  (ProblemDetails / API JSON)
 *     err?.response?.data?.title    (ASP.NET ModelState)
 *     err?.message                  (Error JS)
 *     fallback                      (i18n key déjà résolue)
 *   Cela garantit qu'un message back-end lisible (« CIN déjà utilisé »…) est rendu
 *   à l'utilisateur plutôt que le générique « Une erreur est survenue ».
 */
export type FeedbackSeverity = 'success' | 'error' | 'info' | 'warning';

type ApiError = {
  response?: { data?: { message?: string; title?: string; detail?: string } };
  message?: string;
};

// Messages backend techniques qui ne doivent JAMAIS être affichés tels quels
// à l'utilisateur — on retombe sur le fallback à la place. Ce sont des chaînes
// purement diagnostiques (jeton de session, état d'auth interne…) qui ont leur
// place dans les logs serveur, pas dans un snackbar.
const TECHNICAL_AUTH_MESSAGES = new Set([
  'Refresh token is required',
  'Invalid or expired refresh token',
  'Unauthorized',
]);

export const extractErrorMessage = (err: unknown, fallback: string): string => {
  const e = err as ApiError;
  const candidate =
    e?.response?.data?.message ||
    e?.response?.data?.title ||
    e?.response?.data?.detail ||
    e?.message;
  if (!candidate || TECHNICAL_AUTH_MESSAGES.has(candidate.trim())) return fallback;
  return candidate;
};

interface ShowOptions {
  /** Action JSX (ex: bouton CTA) rendu dans le coin droit du Alert. */
  action?: ReactNode;
  /** Durée d'auto-hide en ms — par défaut 5 000 ms (8 000 ms pour les erreurs / warnings). */
  duration?: number;
}

export function useFeedbackSnackbar() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<FeedbackSeverity>('success');
  const [action, setAction] = useState<ReactNode>(null);
  const [duration, setDuration] = useState<number>(5000);

  const close = useCallback(() => setOpen(false), []);

  const show = useCallback((msg: string, sev: FeedbackSeverity = 'success', opts?: ShowOptions) => {
    setMessage(msg);
    setSeverity(sev);
    setAction(opts?.action ?? null);
    // Durées par défaut : success court (4s) parce que la confirmation est rapide
    // à lire, error/warning plus long (8s) parce que l'utilisateur doit comprendre
    // et potentiellement copier un détail (code, champ, etc.).
    setDuration(opts?.duration ?? (sev === 'success' ? 4000 : sev === 'info' ? 5000 : 8000));
    setOpen(true);
  }, []);

  const showSuccess = useCallback((msg: string, opts?: ShowOptions) => show(msg, 'success', opts), [show]);
  const showInfo = useCallback((msg: string, opts?: ShowOptions) => show(msg, 'info', opts), [show]);
  const showWarning = useCallback((msg: string, opts?: ShowOptions) => show(msg, 'warning', opts), [show]);

  const showError = useCallback(
    (errOrMsg: unknown, fallback = 'Une erreur est survenue', opts?: ShowOptions) => {
      const msg = typeof errOrMsg === 'string' ? errOrMsg : extractErrorMessage(errOrMsg, fallback);
      show(msg, 'error', opts);
    },
    [show],
  );

  const element = (
    <Snackbar
      open={open}
      autoHideDuration={duration}
      onClose={close}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      sx={{ zIndex: 1500 }}
    >
      <Alert
        onClose={close}
        severity={severity}
        variant="filled"
        action={action ?? undefined}
        sx={{ borderRadius: '10px', minWidth: 300, maxWidth: 560, boxShadow: '0 4px 20px rgba(0,0,0,0.12)', '& .MuiAlert-message': { whiteSpace: 'pre-line' } }}
      >
        {message}
      </Alert>
    </Snackbar>
  );

  return { show, showSuccess, showError, showInfo, showWarning, close, element };
}

/**
 * Variante composant : pour les rares cas où l'on doit piloter explicitement l'état
 * du snackbar depuis l'extérieur (ex: Provider partagé). Préférer `useFeedbackSnackbar`
 * dans tout nouveau code.
 */
export function FeedbackSnackbar(props: {
  open: boolean;
  message: string;
  severity: FeedbackSeverity;
  onClose: () => void;
  autoHideDuration?: number;
}) {
  const { open, message, severity, onClose, autoHideDuration = 5000 } = props;
  return (
    <Snackbar
      open={open}
      autoHideDuration={autoHideDuration}
      onClose={onClose}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      sx={{ zIndex: 1500 }}
    >
      <Alert
        onClose={onClose}
        severity={severity}
        variant="filled"
        sx={{ borderRadius: '10px', minWidth: 300, boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}
      >
        {message}
      </Alert>
    </Snackbar>
  );
}
