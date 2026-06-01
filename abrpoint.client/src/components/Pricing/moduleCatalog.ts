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
 * Prix en €/mois HT (grille commerciale 2026).
 */
export interface ModuleDef {
  label: string;
  description: string;
  priceMonthlyEur: number;
  feature: keyof PlanFeatures | null;
  addonKey: string | null;
  note?: string;
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
  { label: 'Assistant RH IA',                description: 'Aide à la rédaction, recherche multi-sources, automatisations RH.',           priceMonthlyEur: 79,  feature: 'ragAi',               addonKey: 'aiAssistantRh',        stripeLink: 'https://buy.stripe.com/5kQfZa4q9gA1bRJ1hf0000' },
  { label: 'Signature électronique',         description: 'Parapheur multi-signataires, archivage légal eIDAS.',                        priceMonthlyEur: 19,  feature: 'electronicSignature', addonKey: 'signatureElectronique', stripeLink: 'https://buy.stripe.com/cNi28k1dX3Nf6xpaRP0000a' },
  { label: 'Stockage supplémentaire 100 Go', description: '100 Go d\'espace sécurisé en plus.',                                          priceMonthlyEur: 29,  feature: null,                  addonKey: null,                    stripeLink: 'https://buy.stripe.com/6oU8wI5ud1F79JBaRP00009', note: 'Se gère depuis la carte « Stockage » plus bas.' },
  { label: 'Branding personnalisé',           description: 'Personnalisation de marque.',        priceMonthlyEur: 19,  feature: 'customBranding',      addonKey: null, note: 'Inclus dans le pack Premium.' },
];

// Map dérivée (clé addon backend → meta) pour les écrans qui raisonnent en clés
// d'addons souscrits (Tenant.Addons). Ne contient que les modules activables comme addons.
export const ADDON_LABELS: Record<string, { label: string; description: string; priceMonthlyEur: number }> =
  Object.fromEntries(
    MODULE_CATALOG.filter((m) => m.addonKey).map((m) => [
      m.addonKey as string,
      { label: m.label, description: m.description, priceMonthlyEur: m.priceMonthlyEur },
    ]),
  );
