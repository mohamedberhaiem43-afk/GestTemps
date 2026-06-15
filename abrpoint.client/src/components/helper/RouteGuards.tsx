import React from 'react';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from './AuthProvider';

/**
 * SEC — Wrappers de route côté React.
 *
 * Avant : `DemoPageContent` rendait toutes les pages directement depuis un
 * `switch (pathname)` sans aucun check d'authentification ni de rôle. Une route
 * comme `/dashboard/gestion-utilisateur` était rendue même si `uticod === null`.
 * Seuls les checks backend (401/402) protégeaient les données — mais l'UI exposait
 * la matrice complète des modules privilégiés, et le moindre check serveur oublié
 * devenait immédiatement exploitable.
 *
 * Avec ces guards :
 *   • <RequireAuth> attend `authReady` puis redirige vers /login si non authentifié.
 *   • <RequireAdmin> exige en plus `isAdmin === true` (basé sur la réponse /me).
 *
 * IMPORTANT : ces guards ne remplacent PAS la sécurité backend. Ils éliminent
 * uniquement la fuite d'UI et la dépendance sur la matrice de permissions exposée.
 */

const Loader: React.FC = () => (
  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
    <CircularProgress />
  </Box>
);

export const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authReady, uticod, emailVerified } = useAuth();

  if (!authReady) return <Loader />;
  if (!uticod) {
    // Redirection hard : on évite le clignotement du contenu protégé pendant que
    // useNavigate s'initialise. window.location nettoie aussi le state React.
    window.location.replace('/login');
    return <Loader />;
  }
  if (!emailVerified && window.location.pathname !== '/verify-email') {
    window.location.replace('/verify-email');
    return <Loader />;
  }
  return <>{children}</>;
};

export const RequireAdmin: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authReady, uticod, isAdmin, emailVerified } = useAuth();

  if (!authReady) return <Loader />;
  if (!uticod) {
    window.location.replace('/login');
    return <Loader />;
  }
  if (!emailVerified && window.location.pathname !== '/verify-email') {
    window.location.replace('/verify-email');
    return <Loader />;
  }
  if (!isAdmin) {
    // Pas admin : on renvoie vers le dashboard (page que tout utilisateur
    // authentifié peut voir). Aucune information sur la nature du module
    // protégé n'est exposée dans l'URL ou le message.
    window.location.replace('/dashboard');
    return <Loader />;
  }
  return <>{children}</>;
};

/**
 * Paths publics (accessibles sans authentification). Tout le reste est considéré
 * comme nécessitant au minimum une session valide.
 */
export const PUBLIC_PATHS = new Set<string>([
  '/',
  '/login',
  '/signup',
  '/plan-configuration',
  '/contact-sales',
  '/upgrade',
  // 2026-05-18 — `/download` doit rester PUBLIC : c'est la landing scannée via
  // QR code (concordeworkly.com → /download) qu'un salarié ouvre AVANT d'avoir
  // un compte, pour récupérer l'APK / aller sur Play Store. Avant : oublié ici
  // → classifyRoute retournait 'auth' → RequireAuth redirigeait vers /login,
  // bloquant le téléchargement pour tout visiteur anonyme.
  // Idem `/payment` : redirection post-Checkout Stripe avant que la session
  // côté front ne soit ré-établie.
  '/download',
  // Calculateur ROI : page marketing publique (partageable / indexable), consultable
  // sans compte avant toute inscription.
  '/roi',
  '/payment',
  // Mentions légales : OBLIGATOIREMENT publiques. Apple/Google reviewers les
  // vérifient anonymement, et les visiteurs candidats à l'inscription doivent
  // pouvoir les consulter avant de soumettre leurs données. URLs déclarées aussi
  // dans App Store Connect (Privacy Policy URL) et Play Console (Privacy/ToS).
  '/confidentialite',
  '/mentions-legales',
  '/cgu',
  // Suppression de compte : OBLIGATOIREMENT publique — URL déclarée dans Google Play
  // Console (« URL de suppression de compte »), vérifiée anonymement par les reviewers.
  '/suppression-compte',
  '/verify-email',
  // Versions anglaises publiques (pages bilingues — variante de langue /en).
  '/en',
  '/en/suppression-compte',
  '/en/download',
  '/en/contact-sales',
  '/en/roi',
]);

/**
 * Paths réservés aux administrateurs du tenant (`utiadm === '1'` ou rôle admin).
 * À garder synchronisé avec les contrôleurs serveur portant `[Admin]`.
 */
export const ADMIN_PATHS = new Set<string>([
  '/dashboard/gestion-utilisateur',
  '/dashboard/droit-accees',
  '/dashboard/droit-acces-site',
  '/dashboard/gestion-societe',
  '/dashboard/admin-vault',
  '/dashboard/rag-audit',
  '/dashboard/audit-logs',
  '/dashboard/retention-rgpd',
  '/dashboard/suivi-positions',
  '/dashboard/affectation-solde',
  '/dashboard/parametres',
  '/dashboard/societe',
  '/dashboard/saisie-classe-horaire',
  '/dashboard/saisie-poste-de-travail',
  '/dashboard/structure-organisationnelle',
  '/dashboard/filiale',
]);

export type RouteGuardKind = 'public' | 'auth' | 'admin';

export function classifyRoute(pathname: string): RouteGuardKind {
  if (PUBLIC_PATHS.has(pathname)) return 'public';
  if (ADMIN_PATHS.has(pathname)) return 'admin';
  return 'auth';
}
