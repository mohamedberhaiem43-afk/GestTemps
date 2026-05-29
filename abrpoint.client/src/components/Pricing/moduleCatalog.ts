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
}

export const MODULE_CATALOG: ModuleDef[] = [
  { label: 'Assistant RH IA',                description: 'Aide à la rédaction, recherche multi-sources, automatisations RH.',           priceMonthlyEur: 49,  feature: 'ragAi',               addonKey: 'aiAssistantRh' },
  { label: 'IA documentaire avancée',        description: 'Recherche RAG, embeddings vectoriels sur vos archives.',                      priceMonthlyEur: 149, feature: 'ragAi',               addonKey: 'iaDocumentaireAvancee' },
  { label: 'Signature électronique',         description: 'Parapheur multi-signataires, archivage légal eIDAS.',                        priceMonthlyEur: 19,  feature: 'electronicSignature', addonKey: 'signatureElectronique' },
  { label: 'API avancée',                    description: 'Accès programmatique étendu pour intégrer votre SIRH, paie ou ERP.',         priceMonthlyEur: 79,  feature: 'apiAccess',           addonKey: 'apiAvancee' },
  { label: 'Support prioritaire étendu',     description: 'Réponse <2h ouvrées, hotline dédiée, account manager.',                      priceMonthlyEur: 49,  feature: 'prioritySupport',     addonKey: 'supportPrioritaire' },
  { label: 'Stockage supplémentaire 100 Go', description: '100 Go d\'espace sécurisé en plus.',                                          priceMonthlyEur: 29,  feature: null,                  addonKey: null, note: 'Se gère depuis la carte « Stockage » plus bas.' },
  { label: 'Domaine personnalisé',           description: 'Votre espace sur votre propre domaine + personnalisation de marque.',        priceMonthlyEur: 19,  feature: 'customBranding',      addonKey: null, note: 'Inclus dans le pack Premium.' },
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
