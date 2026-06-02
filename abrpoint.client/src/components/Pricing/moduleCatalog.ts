import type { PlanFeatures } from '../helper/AuthProvider';

/**
 * Catalogue partagé des modules optionnels — source unique pour MonAbonnementPage
 * (dialog « Gérer mes modules » + reçu) et FacturesConcordePage (lignes « Modules »
 * du reçu de la facture à venir).
 *
 * - `addonKey` : clé reconnue par le backend (PlanCatalog.ValidAddonKeys). SEULS ces
 *   modules sont activables via PUT /billing/addons. Les modules sans addonKey
 *   (stockage, domaine) ne sont pas des addons facturables individuellement.
 * - `feature` : flag PlanFeatures qui, s'il est vrai, indique que le module est déjà
 *   inclus (par le pack ou un addon).
 *
 * Bilingue FR/EN : chaque libellé a sa variante `*En`. Les écrans lisent les helpers
 * `mLabel/mDesc/mNote` (ou `getAddonLabels(lang)`) avec la langue courante (i18n.language).
 *
 * Prix en €/mois HT (grille commerciale 2026).
 */
export type CatalogLang = 'fr' | 'en';

export interface ModuleDef {
  label: string;
  labelEn: string;
  description: string;
  descriptionEn: string;
  priceMonthlyEur: number;
  feature: keyof PlanFeatures | null;
  addonKey: string | null;
  note?: string;
  noteEn?: string;
  /** Module non auto-souscrivable : tarif « Sur devis » (nécessite un contact commercial). */
  quoteOnly?: boolean;
  /**
   * Payment Link Stripe (buy.stripe.com) du module quand il est souscrivable en self-service.
   * Le frontend l'ouvre en y injectant `?client_reference_id={slug}` pour que le webhook
   * checkout.session.completed rattache le paiement au bon tenant. Aligné avec le tableau
   * « modules optionnels » de la page d'accueil. Absent = pas d'achat direct (sur devis,
   * inclus dans un pack, ou géré ailleurs comme le stockage).
   */
  stripeLink?: string;
}

export const MODULE_CATALOG: ModuleDef[] = [
  { label: 'Assistant RH IA',                labelEn: 'HR AI Assistant',         description: 'Aide à la rédaction, recherche multi-sources, automatisations RH.', descriptionEn: 'Drafting assistance, multi-source search, HR automations.', priceMonthlyEur: 79,  feature: 'ragAi',               addonKey: 'aiAssistantRh',        stripeLink: 'https://buy.stripe.com/5kQfZa4q9gA1bRJ1hf0000' },
  { label: 'Signature électronique',         labelEn: 'Electronic signature',    description: 'Parapheur multi-signataires, archivage légal eIDAS.', descriptionEn: 'Multi-signer approval flow, eIDAS-compliant legal archiving.', priceMonthlyEur: 19,  feature: 'electronicSignature', addonKey: 'signatureElectronique', stripeLink: 'https://buy.stripe.com/cNi28k1dX3Nf6xpaRP0000a' },
  { label: 'Stockage supplémentaire 100 Go', labelEn: 'Extra storage 100 GB',    description: '100 Go d\'espace sécurisé en plus.', descriptionEn: '100 GB of additional secure space.', priceMonthlyEur: 29,  feature: null,                  addonKey: null,                    stripeLink: 'https://buy.stripe.com/6oU8wI5ud1F79JBaRP00009', note: 'Se gère depuis la carte « Stockage » plus bas.', noteEn: 'Managed from the "Storage" card below.' },
  { label: 'Branding personnalisé',          labelEn: 'Custom branding',         description: 'Personnalisation de marque (logo, couleurs).', descriptionEn: 'Brand customization (logo, colors).', priceMonthlyEur: 0, feature: 'customBranding', addonKey: null, quoteOnly: true, note: 'Sur devis — déploiement par nos équipes.', noteEn: 'On quote — deployed by our teams.' },
];

// Helpers de localisation : renvoient le libellé / la description / la note dans la langue
// courante (repli sur le FR si la variante EN manque pour `note`).
export const mLabel = (m: ModuleDef, lang: CatalogLang): string => (lang === 'en' ? m.labelEn : m.label);
export const mDesc = (m: ModuleDef, lang: CatalogLang): string => (lang === 'en' ? m.descriptionEn : m.description);
export const mNote = (m: ModuleDef, lang: CatalogLang): string | undefined =>
  (lang === 'en' ? (m.noteEn ?? m.note) : m.note);

// Map dérivée (clé addon backend → meta) pour les écrans qui raisonnent en clés
// d'addons souscrits (Tenant.Addons). Ne contient que les modules activables comme addons.
// Localisée : appeler `getAddonLabels(lang)` avec la langue courante.
export const getAddonLabels = (
  lang: CatalogLang,
): Record<string, { label: string; description: string; priceMonthlyEur: number }> =>
  Object.fromEntries(
    MODULE_CATALOG.filter((m) => m.addonKey).map((m) => [
      m.addonKey as string,
      { label: mLabel(m, lang), description: mDesc(m, lang), priceMonthlyEur: m.priceMonthlyEur },
    ]),
  );

// Compat ascendante : map FR par défaut (existence checks, prix). Les libellés affichés
// doivent passer par getAddonLabels(lang) pour être traduits.
export const ADDON_LABELS: Record<string, { label: string; description: string; priceMonthlyEur: number }> =
  getAddonLabels('fr');
