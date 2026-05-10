import React, { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';

/**
 * Auto-lock après inactivité (SEC-G5).
 *
 * Verrouille l'app si :
 *   1. L'utilisateur n'a touché aucun élément depuis IDLE_TIMEOUT_MS (foreground)
 *   2. L'app est restée en background pendant plus de BACKGROUND_TIMEOUT_MS
 *
 * Une fois verrouillée, le composant <LockScreen /> s'affiche en surcouche et
 * bloque l'accès aux écrans applicatifs jusqu'à re-authentification (biométrie
 * ou retour login). Tant que l'utilisateur ne s'est pas re-authentifié, les
 * tokens JWT restent en SecureStore mais l'UI est inaccessible.
 *
 * Configuration via constantes :
 *   IDLE_TIMEOUT_MS         — inactivité tolérée en foreground (default 10 min)
 *   BACKGROUND_TIMEOUT_MS   — temps max en background avant relock (default 5 min)
 *
 * Le hook `useInactivity()` doit être consommé par <LockScreen /> et par
 * <ActivityTracker> qui wrap l'app pour appeler `bumpActivity()` à chaque touche.
 */

const IDLE_TIMEOUT_MS = 10 * 60 * 1000;
const BACKGROUND_TIMEOUT_MS = 5 * 60 * 1000;

interface InactivityContextType {
  isLocked: boolean;
  lock: () => void;
  unlock: () => void;
  bumpActivity: () => void;
}

const InactivityContext = createContext<InactivityContextType | undefined>(undefined);

export function InactivityProvider({ children }: { children: ReactNode }) {
  const [isLocked, setIsLocked] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());
  const backgroundedAtRef = useRef<number | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lock = useCallback(() => setIsLocked(true), []);
  const unlock = useCallback(() => {
    setIsLocked(false);
    lastActivityRef.current = Date.now();
  }, []);

  // Reset le timer d'inactivité à chaque interaction. Appelé par <ActivityTracker>
  // depuis le onTouchStart racine.
  const bumpActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      // Vérifie qu'on n'a pas eu d'interaction entre-temps (race possible si
      // bumpActivity() est appelé pendant qu'on était dans setTimeout callback).
      if (Date.now() - lastActivityRef.current >= IDLE_TIMEOUT_MS - 50) {
        setIsLocked(true);
      }
    }, IDLE_TIMEOUT_MS);
  }, []);

  // Lock automatique au retour de background si on a dépassé le seuil.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') {
        if (backgroundedAtRef.current === null) {
          backgroundedAtRef.current = Date.now();
        }
      } else if (state === 'active') {
        const bgAt = backgroundedAtRef.current;
        backgroundedAtRef.current = null;
        if (bgAt !== null && Date.now() - bgAt > BACKGROUND_TIMEOUT_MS) {
          setIsLocked(true);
        } else {
          // Retour rapide : on reset le timer idle, l'utilisateur reprend là où il était.
          bumpActivity();
        }
      }
    });
    // Premier bump pour démarrer le timer.
    bumpActivity();
    return () => {
      sub.remove();
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [bumpActivity]);

  return (
    <InactivityContext.Provider value={{ isLocked, lock, unlock, bumpActivity }}>
      {children}
    </InactivityContext.Provider>
  );
}

export function useInactivity() {
  const ctx = useContext(InactivityContext);
  if (!ctx) throw new Error('useInactivity must be used within InactivityProvider');
  return ctx;
}
