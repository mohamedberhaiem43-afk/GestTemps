/**
 * i18n léger pour l'app mobile (FR / EN) — sans dépendance native.
 *
 * Pourquoi pas i18next : éviter d'ajouter des deps + un rebuild natif rien que pour la
 * mécanique. Ici : un Context React + un `t(key, vars?)` qui résout des clés imbriquées
 * dans les dictionnaires fr/en, avec interpolation `{var}` et fallback FR puis clé brute.
 *
 * Langue : par défaut FR. Choix de l'utilisateur persisté dans SecureStore (déjà utilisé
 * partout dans l'app). Le sélecteur est dans l'écran Profil (cf. LanguageSwitcher).
 */
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import * as SecureStore from 'expo-secure-store';

import { fr } from './fr';
import { en } from './en';

export type Lang = 'fr' | 'en';

type Dict = Record<string, unknown>;
const DICTS: Record<Lang, Dict> = { fr, en };
const STORAGE_KEY = 'app_language';

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  ready: boolean;
}

const I18nContext = createContext<I18nCtx | null>(null);

// Résout une clé "a.b.c" dans un dictionnaire imbriqué.
function lookup(dict: Dict, key: string): unknown {
  return key.split('.').reduce<unknown>(
    (o, k) => (o && typeof o === 'object' ? (o as Dict)[k] : undefined),
    dict,
  );
}

function interpolate(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('fr');
  const [ready, setReady] = useState(false);

  // Charge la langue persistée au démarrage (sinon FR par défaut).
  useEffect(() => {
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(STORAGE_KEY);
        if (saved === 'en' || saved === 'fr') setLangState(saved);
      } catch {
        /* SecureStore indisponible → on garde le défaut */
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    SecureStore.setItemAsync(STORAGE_KEY, l).catch(() => { /* noop */ });
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const val = lookup(DICTS[lang], key) ?? lookup(DICTS.fr, key) ?? key;
      return typeof val === 'string' ? interpolate(val, vars) : key;
    },
    [lang],
  );

  const value = useMemo<I18nCtx>(() => ({ lang, setLang, t, ready }), [lang, setLang, t, ready]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nCtx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n doit être utilisé dans un <I18nProvider>');
  return ctx;
}

/** Raccourci quand seul `t` est nécessaire. */
export function useT() {
  return useI18n().t;
}
