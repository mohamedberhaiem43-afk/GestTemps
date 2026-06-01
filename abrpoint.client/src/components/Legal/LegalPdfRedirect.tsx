import React from 'react';

/**
 * Redirection des anciennes routes légales HTML (/cgu, /mentions-legales,
 * /confidentialite) vers le PDF officiel correspondant servi depuis /public/docs.
 *
 * 2026-06 — les pages web légales ont été supprimées : un clic sur un lien légal
 * affiche désormais directement le PDF. Les routes sont conservées (et redirigent)
 * UNIQUEMENT pour ne pas casser les URLs déclarées en externe :
 *   • App Store Connect (Privacy Policy URL → /confidentialite)
 *   • Google Play Console (Privacy + ToS)
 *   • deep links de l'app mobile (Linking.openURL vers .../cgu, etc.)
 * Les liens in-app, eux, pointent directement vers /docs/*.pdf.
 */
export default function LegalPdfRedirect({ to }: { to: string }) {
  React.useEffect(() => {
    window.location.replace(to);
  }, [to]);
  return null;
}
