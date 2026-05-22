import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Users, Rocket, CheckCircle2, FileText, Headset, Sparkles, HardDrive, Plus, Minus, Check } from 'lucide-react';
import { useAuth } from '../helper/AuthProvider';
import { startStripeCheckout } from './stripeCheckout';
import './PricingPage.css';

// Format prix : au plus 2 décimales, sans padding (8 → "8", pas "8,00") et sans
// artefact float (8.8*12 → "105,6"). Locale FR avec séparateur virgule.
const formatPrice = (value: number): string =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value);

/**
 * Catalogue tarifaire — miroir frontend de ABRPOINT.Server.Tenancy.PlanCatalog.
 * Toute évolution de tarif DOIT être propagée sur les deux côtés simultanément
 * (la source de vérité pour la facturation reste le backend ; ce miroir sert
 * uniquement à afficher le simulateur de prix avant Stripe Checkout).
 *
 * Référence commerciale : tasks.md (packs Starter / Standard / Premium).
 */
type PlanKey = 'Starter' | 'Standard' | 'Premium';
const PLAN_CATALOG: Record<PlanKey, {
  displayName: string;
  flatPriceMonthlyEur: number;         // tarif d'engagement MENSUEL (sans engagement annuel)
  flatPriceAnnualMonthlyEur: number;   // équivalent mensuel quand l'engagement est annuel
  includedEmployees: number;
  overageRatePerEmployeeEur: number;
  maxEmployees: number;
  moduleCount: number;
}> = {
  // Grille tarifs.txt 2026-05 — alignée avec ABRPOINT.Server.Tenancy.PlanCatalog :
  //   Starter   :  99 €/mois (mensuel) ou  69 €/mois (annuel) — 10 inclus, max 25
  //   Standard  : 219 €/mois (mensuel) ou 119 €/mois (annuel) — 25 inclus, max 100
  //   Business  : 449 €/mois (mensuel) ou 249 €/mois (annuel) — 50 inclus, max 250
  // Le ratio annuel/mensuel n'est PAS uniforme entre les packs : on stocke les deux
  // prix explicitement (impossible à dériver via un coefficient global). Le code
  // interne « Premium » est conservé pour la compat Stripe ; le libellé commercial
  // affiché est « Business ».
  Starter:  { displayName: 'Starter',  flatPriceMonthlyEur: 99,  flatPriceAnnualMonthlyEur: 69,  includedEmployees: 10, overageRatePerEmployeeEur: 4.90, maxEmployees: 25,  moduleCount: 7  },
  Standard: { displayName: 'Standard', flatPriceMonthlyEur: 219, flatPriceAnnualMonthlyEur: 119, includedEmployees: 25, overageRatePerEmployeeEur: 6.90, maxEmployees: 100, moduleCount: 14 },
  Premium:  { displayName: 'Business', flatPriceMonthlyEur: 449, flatPriceAnnualMonthlyEur: 249, includedEmployees: 50, overageRatePerEmployeeEur: 9.90, maxEmployees: 250, moduleCount: 19 },
};

/**
 * Modules optionnels — cumulables avec n'importe quel pack. Présentés ici
 * (et non plus sur la landing) parce qu'ils n'ont de sens qu'une fois le pack
 * choisi : le client coche ce qu'il veut, le panier se recalcule, puis Stripe
 * Checkout est déclenché. Aujourd'hui le simulateur est INDICATIF — ces tarifs
 * ne sont pas encore branchés sur des price_id Stripe distincts ; quand ce sera
 * le cas, on passera `addons` dans le `state` envoyé à `/signup`/`startStripeCheckout`
 * pour que le backend les ajoute à la session.
 *
 *   • IA Assistant RH (49 €/mois) — toggle on/off (1 abonnement par tenant).
 *   • Stockage supplémentaire (29 € / 100 Go / mois) — quantité (0..N tranches).
 *   • IA / RAG Avancé — « Sur devis », non sélectionnable, redirige vers contact.
 */
type AddonKey = 'aiAssistant' | 'extraStorage100Go';
const ADDON_CATALOG: Record<AddonKey, {
  displayName: string;
  description: string;
  unitPriceMonthlyEur: number;
  unit: string;          // suffixe affiché à côté du prix (« / mois », « / 100 Go / mois »)
  hasQuantity: boolean;  // false = toggle (0 ou 1) ; true = stepper (0..N)
}> = {
  aiAssistant: {
    displayName: 'IA Assistant RH',
    description: 'Aide à la rédaction, recherche rapide multi-sources, automatisations simples.',
    unitPriceMonthlyEur: 49,
    unit: '/ mois',
    hasQuantity: false,
  },
  extraStorage100Go: {
    displayName: 'Stockage supplémentaire',
    description: 'Tranche de 100 Go pour coffre numérique, documents salariés, archives — au-delà du quota inclus.',
    unitPriceMonthlyEur: 29,
    unit: '/ 100 Go / mois',
    hasQuantity: true,
  },
};

const PlanConfigurationPage: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { uticod } = useAuth();
  const isAuthenticated = Boolean(uticod);
  // Plan + cycle peuvent arriver de DEUX façons :
  //   1. location.state.plan — utilisé par PricingPage (passé via navigate(..., { state }))
  //   2. query string ?plan=Starter&cycle=annual — utilisé par HomePage et tout deep-link
  //      externe (mail, doc commerciale). Avant le fix 2026-05-18, seul (1) était lu,
  //      donc tout clic depuis la home retombait silencieusement sur 'Standard' quel que
  //      soit le pack cliqué.
  // Normalisation de la casse pour matcher PLAN_CATALOG ('Starter', 'Standard', 'Premium').
  const initialState = (location.state ?? {}) as {
    plan?: string;
    cycle?: 'monthly' | 'annual';
    userCount?: number;
  };
  const queryParams = new URLSearchParams(location.search);
  const rawPlanFromUrl = (initialState.plan ?? queryParams.get('plan') ?? '').trim();
  const normalizedPlan = rawPlanFromUrl
    ? rawPlanFromUrl.charAt(0).toUpperCase() + rawPlanFromUrl.slice(1).toLowerCase()
    : '';
  const planCode: PlanKey = (normalizedPlan in PLAN_CATALOG
    ? (normalizedPlan as PlanKey)
    : 'Standard');
  const rawCycleFromUrl = (queryParams.get('cycle') ?? '').toLowerCase();
  const cycleFromUrl: 'monthly' | 'annual' | undefined =
    rawCycleFromUrl === 'monthly' || rawCycleFromUrl === 'annual' ? rawCycleFromUrl : undefined;
  const plan = PLAN_CATALOG[planCode];
  // Par défaut + cap dur : le nombre de salariés est borné par l'inclus du pack
  // (10 / 25 / 50). Les collaborateurs supplémentaires (au-delà du quota inclus) sont
  // ajoutés UNIQUEMENT depuis la fiche collaborateur — l'admin confirme alors un
  // supplément facturé via le produit Stripe unique 'user_supp'. Voir
  // ABRPOINT.Server.Controllers.EmployesController.Post (param confirmOverage).
  const [userCount, setUserCount] = useState(() => {
    const requested = initialState.userCount ?? plan.includedEmployees;
    return Math.min(requested, plan.includedEmployees);
  });
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>(initialState.cycle ?? cycleFromUrl ?? 'annual');
  // Quantité par module : 0 = non sélectionné. Pour aiAssistant on borne à {0,1}
  // (toggle) ; pour extraStorage100Go la quantité est un entier ≥ 0 (chaque unité
  // ajoute une tranche de 100 Go). Le panier est plein si tout est à 0.
  const [addonQuantities, setAddonQuantities] = useState<Record<AddonKey, number>>({
    aiAssistant: 0,
    extraStorage100Go: 0,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Tarification : forfait mensuel fixe au quota inclus + modules optionnels du panier.
  // Le simulateur reste indicatif (cf. PLAN_CATALOG / ADDON_CATALOG) ; le backend
  // applique les price_id Stripe réels. Les overages collaborateur sont déclenchés
  // après signup depuis la fiche (cf. EmployesController.Post param confirmOverage).
  //
  // Grille tarifs.txt 2026-05 : les prix mensuel et annuel sont stockés explicitement
  // dans PLAN_CATALOG. Le ratio n'est plus uniforme (~30 % Starter, ~46 % Standard,
  // ~45 % Business), donc on ne dérive plus l'annuel via un coefficient global.
  // En cycle annuel, on affiche aussi le total annuel (mensuel × 12) et la remise
  // annuelle totale (vs tarif mensuel sans engagement × 12).
  const { baseMonthly, baseMonthlyTotal, addonsMonthlyTotal, monthlyTotal, annualTotal, annualDiscountTotal } = useMemo(() => {
    const baseM = plan.flatPriceMonthlyEur;
    const baseMonthlyForCycle = billingCycle === 'annual' ? plan.flatPriceAnnualMonthlyEur : baseM;
    const discountPerMonth = billingCycle === 'annual' ? Math.max(0, baseM - plan.flatPriceAnnualMonthlyEur) : 0;
    // Modules optionnels : facturés au tarif unitaire mensuel × quantité, sans
    // remise annuelle (les add-ons ne bénéficient pas du tarif réduit du pack).
    const addons = (Object.keys(ADDON_CATALOG) as AddonKey[])
      .reduce((sum, k) => sum + ADDON_CATALOG[k].unitPriceMonthlyEur * (addonQuantities[k] ?? 0), 0);
    const monthly = baseMonthlyForCycle + addons;
    return {
      baseMonthly: baseM,
      baseMonthlyTotal: baseMonthlyForCycle,
      addonsMonthlyTotal: addons,
      monthlyTotal: monthly,
      annualTotal: monthly * 12,
      annualDiscountTotal: discountPerMonth * 12,
    };
  }, [plan, billingCycle, addonQuantities]);

  const toggleAddon = (key: AddonKey) => {
    setAddonQuantities(prev => ({ ...prev, [key]: prev[key] > 0 ? 0 : 1 }));
  };
  const incrementAddon = (key: AddonKey, delta: 1 | -1) => {
    setAddonQuantities(prev => ({ ...prev, [key]: Math.max(0, (prev[key] ?? 0) + delta) }));
  };
  const selectedAddonEntries = (Object.keys(ADDON_CATALOG) as AddonKey[])
    .map(k => ({ key: k, qty: addonQuantities[k] ?? 0, def: ADDON_CATALOG[k] }))
    .filter(a => a.qty > 0);

  const handleConfirmCheckout = async () => {
    // Utilisateur connecté → on lance directement la session Stripe Checkout.
    // Visiteur → on bascule sur /signup ; SignupPage déclenchera Stripe après création du tenant.
    // `addons` est transmis tel quel : c'est aujourd'hui une donnée indicative côté
    // UI (cf. note ADDON_CATALOG). Quand les price_id Stripe des add-ons seront
    // câblés côté backend, on ajoutera la lecture de ce champ dans /signup et
    // startStripeCheckout sans changer le contrat front.
    const state = {
      plan: planCode,
      price: monthlyTotal,
      cycle: billingCycle,
      userCount,
      addons: addonQuantities,
    };
    if (!isAuthenticated) {
      navigate('/signup', { state });
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await startStripeCheckout({ plan: planCode, cycle: billingCycle, userCount });
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Échec de la redirection vers Stripe.');
      setSubmitting(false);
    }
  };

  return (
    <div className="pricing-container min-h-screen bg-surface font-body selection:bg-primary-fixed">
      {/* Plein écran : pas de navbar, pas de sidebar — la configuration de plan
          précède l'inscription, l'utilisateur ne doit pas être distrait. */}
      <main className="w-full px-6 lg:px-12 py-10 lg:py-16">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-12 text-center">
            <span className="inline-block text-[10px] font-black uppercase tracking-[0.3em] text-primary bg-primary/10 px-4 py-1.5 rounded-full mb-6">
              Plan {planCode}
            </span>
            <h1 className="text-4xl lg:text-5xl font-black text-on-surface tracking-tight mb-4 font-headline">Configuration du plan</h1>
            <p className="text-on-surface-variant max-w-2xl mx-auto text-lg leading-relaxed">
              Personnalisez votre abonnement Concorde Workforce pour correspondre exactement aux besoins de votre organisation.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            {/* Left Column */}
            <div className="lg:col-span-8 space-y-16">
              {/* Section: Compte */}
              <section>
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Users size={20} />
                  </div>
                  <h2 className="text-xl font-black tracking-tight font-headline uppercase">Configuration du compte</h2>
                </div>
                <div className="bg-white p-8 rounded-3xl border border-surface-container-high shadow-sm">
                  <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-outline mb-6">
                    Nombre d'utilisateurs (max {plan.includedEmployees} pour le pack {plan.displayName})
                  </label>
                  <div className="flex items-center gap-6 max-w-md">
                    <div className="relative flex-1">
                      <input
                        className="w-full bg-surface-container-low border-none focus:ring-2 focus:ring-primary/20 text-3xl font-black p-6 rounded-2xl transition-all outline-none"
                        type="number"
                        min={1}
                        max={plan.includedEmployees}
                        value={userCount}
                        onChange={(e) => {
                          // Cap dur côté UI : on borne au quota inclus du pack. Les
                          // collaborateurs supplémentaires se créent ensuite à l'unité
                          // depuis la fiche collaborateur, avec confirmation explicite
                          // du supplément (produit Stripe user_supp).
                          const raw = parseInt(e.target.value) || 0;
                          setUserCount(Math.min(Math.max(0, raw), plan.includedEmployees));
                        }}
                      />
                      <span className="absolute right-6 top-1/2 -translate-y-1/2 text-outline material-symbols-outlined text-3xl">groups</span>
                    </div>
                    <div className="text-on-surface font-black text-lg">Collaborateurs</div>
                  </div>
                  <p className="mt-6 text-sm text-outline italic flex items-start gap-2">
                    <CheckCircle2 size={16} className="text-tertiary mt-0.5 flex-shrink-0" />
                    <span>
                      Le pack <strong className="not-italic font-black">{plan.displayName}</strong> inclut
                      {' '}<strong className="not-italic font-black">{plan.includedEmployees} collaborateurs</strong>
                      {' '}au forfait ({formatPrice(plan.flatPriceMonthlyEur)} € / mois).
                      Pour en ajouter au-delà, créez chaque collaborateur supplémentaire depuis sa fiche :
                      vous confirmerez alors un supplément de {formatPrice(plan.overageRatePerEmployeeEur)} € / mois facturé via Stripe
                      (plafond pack : <strong className="not-italic font-black">{plan.maxEmployees} collaborateurs maximum</strong>,
                      au-delà passez au pack supérieur).
                    </span>
                  </p>
                </div>
              </section>

              {/* Section: Accompagnement
                  Les 3 cartes ci-dessous sont uniquement *informatives* — elles
                  présentent les services d'onboarding (formation, pack mise en
                  place, coaching) mais ne sont pas sélectionnables : ces services
                  sont vendus à part par les équipes commerciales, pas inclus dans
                  l'abonnement Stripe. Avant, on simulait un choix interactif
                  (`packageType`) qui prêtait à confusion ; on retire onClick,
                  cursor-pointer, ring-selected et hover-shadow pour clarifier. */}
              <section>
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Rocket size={20} />
                  </div>
                  <h2 className="text-xl font-black tracking-tight font-headline uppercase">Accompagnement</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Card 1 — Formation logiciel (informatif) */}
                  <div className="relative bg-white p-8 rounded-3xl border border-surface-container-high">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 bg-surface-container-low text-outline">
                      <span className="material-symbols-outlined text-2xl">school</span>
                    </div>
                    <h3 className="font-black text-lg mb-2 font-headline">Formation logiciel</h3>
                    <p className="text-sm text-on-surface-variant leading-relaxed">Vous utilisez Concorde-work-force et souhaitez exploiter tout son potentiel pour optimiser la gestion de votre entreprise ?</p>
                  </div>

                  {/* Card 2 — Pack de mise en place (informatif, badge "Conseillé" purement éditorial) */}
                  <div className="relative bg-white p-8 rounded-3xl border border-surface-container-high">
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] px-4 py-1.5 rounded-full font-black uppercase tracking-widest shadow-lg">Conseillé</div>
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 bg-surface-container-low text-outline">
                      <span className="material-symbols-outlined text-2xl fill-icon">rocket_launch</span>
                    </div>
                    <h3 className="font-black text-lg mb-2 font-headline">Pack de mise en place</h3>
                    <p className="text-sm text-on-surface-variant leading-relaxed">Gagnez un temps précieux et assurez un démarrage optimal sur Concorde-work-force.</p>
                  </div>

                  {/* Card 3 — Coaching sur mesure (informatif) */}
                  <div className="relative bg-white p-8 rounded-3xl border border-surface-container-high">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 bg-surface-container-low text-outline">
                      <span className="material-symbols-outlined text-2xl">psychology</span>
                    </div>
                    <h3 className="font-black text-lg mb-2 font-headline">Coaching sur mesure</h3>
                    <p className="text-sm text-on-surface-variant leading-relaxed font-bold mb-2">Développez votre maîtrise de Concorde-work-force</p>
                    <p className="text-sm text-on-surface-variant leading-relaxed">Vous utilisez Concorde-work-force et souhaitez exploiter tout son potentiel pour optimiser la gestion de votre entreprise ?</p>
                  </div>
                </div>
              </section>

              {/* Section: Modules optionnels.
                  Présentés ICI (et plus sur la landing) parce que le client vient
                  de choisir un pack : c'est le moment opportun pour proposer les
                  add-ons. Toute case cochée recalcule instantanément le total HT
                  affiché dans le résumé sticky à droite. */}
              <section>
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Sparkles size={20} />
                  </div>
                  <h2 className="text-xl font-black tracking-tight font-headline uppercase">Modules optionnels</h2>
                  <span className="text-[11px] font-bold uppercase tracking-widest text-outline ml-2">— Ajoutez à votre panier</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* IA Assistant RH — toggle on/off */}
                  {(() => {
                    const key: AddonKey = 'aiAssistant';
                    const a = ADDON_CATALOG[key];
                    const qty = addonQuantities[key] ?? 0;
                    const selected = qty > 0;
                    return (
                      <div
                        className={`relative bg-white p-6 rounded-3xl border-2 transition-all cursor-pointer ${
                          selected ? 'border-primary shadow-lg shadow-primary/10' : 'border-surface-container-high hover:border-primary/40'
                        }`}
                        onClick={() => toggleAddon(key)}
                      >
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-primary/10 text-primary">
                            <Sparkles size={22} />
                          </div>
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all ${
                              selected ? 'bg-primary border-primary text-white' : 'bg-white border-outline/30'
                            }`}
                            aria-label={selected ? 'Sélectionné' : 'Non sélectionné'}
                          >
                            {selected && <Check size={16} />}
                          </div>
                        </div>
                        <h3 className="font-black text-lg mb-1 font-headline">{a.displayName}</h3>
                        <p className="text-sm text-on-surface-variant leading-relaxed mb-4">{a.description}</p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-black text-primary font-headline">+{formatPrice(a.unitPriceMonthlyEur)} €</span>
                          <span className="text-xs text-outline font-bold">HT {a.unit}</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Stockage supplémentaire — stepper 0..N (tranches de 100 Go) */}
                  {(() => {
                    const key: AddonKey = 'extraStorage100Go';
                    const a = ADDON_CATALOG[key];
                    const qty = addonQuantities[key] ?? 0;
                    const selected = qty > 0;
                    return (
                      <div
                        className={`relative bg-white p-6 rounded-3xl border-2 transition-all ${
                          selected ? 'border-primary shadow-lg shadow-primary/10' : 'border-surface-container-high'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4 mb-4">
                          <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-tertiary/10 text-tertiary">
                            <HardDrive size={22} />
                          </div>
                          {selected && (
                            <div className="w-7 h-7 rounded-full flex items-center justify-center bg-primary text-white">
                              <Check size={16} />
                            </div>
                          )}
                        </div>
                        <h3 className="font-black text-lg mb-1 font-headline">{a.displayName}</h3>
                        <p className="text-sm text-on-surface-variant leading-relaxed mb-4">{a.description}</p>
                        <div className="flex items-baseline gap-1 mb-4">
                          <span className="text-2xl font-black text-primary font-headline">+{formatPrice(a.unitPriceMonthlyEur)} €</span>
                          <span className="text-xs text-outline font-bold">HT {a.unit}</span>
                        </div>
                        {/* Stepper de quantité. Min 0 = retire la ligne du panier ;
                            pas de cap dur (le client peut acheter autant de tranches qu'il
                            veut, dans la limite des plafonds Stripe configurés serveur). */}
                        <div className="flex items-center gap-3 bg-surface-container-low rounded-2xl p-1.5 w-fit">
                          <button
                            type="button"
                            onClick={() => incrementAddon(key, -1)}
                            disabled={qty <= 0}
                            className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-primary disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary hover:text-white transition-colors"
                            aria-label="Retirer une tranche"
                          >
                            <Minus size={16} />
                          </button>
                          <div className="w-12 text-center font-black text-lg tabular-nums">{qty}</div>
                          <button
                            type="button"
                            onClick={() => incrementAddon(key, +1)}
                            className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-colors"
                            aria-label="Ajouter une tranche"
                          >
                            <Plus size={16} />
                          </button>
                          <span className="text-xs text-outline font-bold pl-2 pr-3">tranches × 100 Go</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Carte « Sur devis » pour le RAG avancé — non sélectionnable ici
                    parce que la tarification varie selon le volume documentaire.
                    Sépare visuellement les modules self-service (au-dessus) du
                    module qui passe par un contact commercial. */}
                <div className="mt-6 bg-gradient-to-br from-primary/5 to-tertiary/5 border-2 border-dashed border-primary/20 rounded-3xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-primary/10 text-primary">
                      <Sparkles size={22} />
                    </div>
                    <div>
                      <h3 className="font-black text-lg mb-1 font-headline">IA / RAG Avancé</h3>
                      <p className="text-sm text-on-surface-variant leading-relaxed max-w-xl">
                        Recherche documentaire intelligente, embeddings vectoriels et analyses avancées sur vos archives. Tarifé selon volume documentaire.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/contact-sales')}
                    className="whitespace-nowrap px-6 py-3 bg-white border-2 border-primary text-primary rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-primary hover:text-white transition-colors"
                  >
                    Demander un devis
                  </button>
                </div>
              </section>

              {/* Feature Preview Bento */}
              <section>
                <div className="bg-primary text-white rounded-3xl p-8 flex flex-col justify-between aspect-[2.4/1] relative overflow-hidden group">
                  <div className="z-10">
                    <h4 className="font-black text-xl font-headline mb-2">Support</h4>
                    <p className="text-sm text-blue-100/80 font-medium">Notre équipe support répond sous 24h ouvrées (2h garanties sur Premium).</p>
                  </div>
                  <Headset className="text-primary-container absolute -right-6 -bottom-6 w-32 h-32 opacity-20 group-hover:scale-110 transition-transform" />
                  <div className="z-10 pt-4">
                    <button className="text-[10px] font-black uppercase tracking-widest bg-white/20 hover:bg-white/30 px-4 py-1.5 rounded-full transition-colors">Consulter les SLA</button>
                  </div>
                </div>
              </section>
            </div>

            {/* Right Column (Sticky Summary) */}
            <div className="lg:col-span-4 lg:sticky lg:top-28">
              <div className="glass-card bg-white/80 p-8 rounded-[2.5rem] shadow-2xl border border-white/20 ambient-shadow">
                <h2 className="text-2xl font-black tracking-tight mb-8 font-headline uppercase">{t('pricingExtras.summary')}</h2>

                {/* Toggle Monthly/Yearly */}
                <div className="bg-surface-container-low p-1.5 rounded-2xl flex mb-10 border border-surface-container-high">
                  <button
                    onClick={() => setBillingCycle('monthly')}
                    className={`flex-1 py-3 px-4 rounded-xl text-sm font-black transition-all ${
                      billingCycle === 'monthly' ? 'bg-white shadow-md text-primary' : 'text-outline hover:text-on-surface'
                    }`}
                  >
                    Mensuel
                  </button>
                  <button
                    onClick={() => setBillingCycle('annual')}
                    className={`flex-1 py-3 px-4 rounded-xl text-sm font-black transition-all ${
                      billingCycle === 'annual' ? 'bg-white shadow-md text-primary' : 'text-outline hover:text-on-surface'
                    }`}
                  >
                    Annuel
                  </button>
                </div>

                {/* Breakdown — formule miroir backend :
                    flat + max(0, userCount − inclus) × overage + modules optionnels. */}
                <div className="space-y-5 mb-10">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-outline font-bold">Forfait {plan.displayName}</span>
                    <span className="font-black text-on-surface">{formatPrice(baseMonthlyTotal)} € / mois</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-outline font-bold">Salariés inclus</span>
                    <span className="font-black text-on-surface">{plan.includedEmployees}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-outline font-bold">Collaborateurs sup.</span>
                    <span className="font-black text-on-surface text-right text-xs">
                      {formatPrice(plan.overageRatePerEmployeeEur)} € / mois<br />
                      <span className="text-outline font-medium">à l'unité depuis la fiche</span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-outline font-bold">Plafond pack</span>
                    <span className="font-black text-on-surface">{plan.maxEmployees} salariés</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-outline font-bold">Modules inclus</span>
                    <span className="font-black text-on-surface">{plan.moduleCount}</span>
                  </div>
                  {/* Modules optionnels du panier : une ligne par add-on sélectionné,
                      avec quantité × tarif unitaire. Si rien n'est coché, rien ne
                      s'affiche — la section reste discrète tant qu'elle est vide. */}
                  {selectedAddonEntries.length > 0 && (
                    <div className="pt-3 border-t border-surface-container-high space-y-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Modules optionnels</div>
                      {selectedAddonEntries.map(({ key, qty, def }) => (
                        <div key={key} className="flex justify-between items-center text-sm">
                          <span className="text-on-surface font-bold">
                            {def.displayName}
                            {def.hasQuantity && <span className="text-outline font-medium"> · {qty} × 100 Go</span>}
                          </span>
                          <span className="font-black text-on-surface">
                            + {formatPrice(def.unitPriceMonthlyEur * qty)} € / mois
                          </span>
                        </div>
                      ))}
                      <div className="flex justify-between items-center text-sm pt-1">
                        <span className="text-outline font-bold">Sous-total modules</span>
                        <span className="font-black text-primary">+ {formatPrice(addonsMonthlyTotal)} € / mois</span>
                      </div>
                    </div>
                  )}
                  {billingCycle === 'annual' && (
                    <div className="flex justify-between items-center text-sm text-tertiary p-3 bg-tertiary/5 rounded-xl border border-tertiary/10">
                      <span className="font-bold">Remise annuelle</span>
                      <span className="font-black">- {formatPrice(annualDiscountTotal)} € / an</span>
                    </div>
                  )}
                  <div className="pt-6 border-t border-surface-container-high flex justify-between items-baseline">
                    <span className="font-black text-on-surface uppercase text-xs tracking-widest">
                      {billingCycle === 'annual' ? 'Total / an' : 'Total / mois'}
                    </span>
                    <div className="text-right">
                      <div className="text-4xl font-black text-primary font-headline tracking-tighter">
                        {formatPrice(billingCycle === 'annual' ? annualTotal : monthlyTotal)} €
                      </div>
                      <div className="text-[9px] text-outline uppercase font-black tracking-widest mt-1">
                        HT / {billingCycle === 'annual' ? 'an facturé annuellement' : 'mois facturé mensuellement'}
                      </div>
                      {billingCycle === 'annual' && (
                        <div className="text-[10px] text-outline mt-1">soit {formatPrice(monthlyTotal)} € / mois HT</div>
                      )}
                      {billingCycle === 'monthly' && (
                        <div className="text-[10px] text-outline mt-1">Base : {formatPrice(baseMonthly)} € / mois HT</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-4">
                  {error && (
                    <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl p-3 font-bold">
                      {error}
                    </div>
                  )}
                  <button
                    onClick={handleConfirmCheckout}
                    disabled={submitting}
                    className="w-full py-5 bg-primary text-white rounded-2xl font-black text-lg hover:-translate-y-1 transition-all shadow-xl shadow-primary/20 uppercase tracking-widest disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                  >
                    {submitting ? 'Redirection vers Stripe…' : "Confirmer l'achat"}
                  </button>
                  {/* Bouton "Plus tard" : pertinent uniquement pour un user connecté qui veut
                      revenir à son dashboard. Pour un visiteur, il n'existe pas de dashboard et
                      ce CTA secondaire est trompeur — on le masque entièrement. */}
                  {isAuthenticated && (
                    <button
                      onClick={() => navigate('/dashboard')}
                      className="w-full bg-surface-container-high text-on-surface py-5 rounded-2xl font-black hover:bg-surface-container-highest transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
                    >
                      <FileText size={18} />
                      Plus tard, retour au tableau de bord
                    </button>
                  )}
                </div>

                <p className="mt-8 text-[10px] text-center text-outline leading-relaxed font-bold">
                  En cliquant sur Confirmer, vous acceptez nos <a className="underline text-primary" href="#">Conditions Générales de Vente</a> et notre politique de confidentialité.
                </p>
              </div>

              {/* Trust Badges */}
              <div className="mt-8 px-6 flex justify-between opacity-30 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-700">
                <img alt="Trusted Brand" className="h-5 object-contain" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAzHI7rJE9lM192_u1-djE-N7oBY9kMDK8ZNKL171MBqA-OrPKuV1dtKlGld8_Ub63JocDa8Gn08xHBnVmE0Hd6WJq8q0CICts4X3p7NJJ6ViLAzlCmXY7nWGwLvmC4LhqHBRgcBEm-re2sniowr4ylJCvdwcdwk_YmzYJgtGzI5dOA4q-J-is7dsSNXB1-cN6uehplxOhtZp6bH2-Aiv9_8bXXlIlvFkHdmCApOhbb_movUPhDcZP2vjpkBzWKG21q7JQoFi4K5Aw"/>
                <img alt="Trusted Brand" className="h-5 object-contain" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC056riMX4pWFeg9_09wcynGo94apT8y7ffAWXgnd9T4fjsaj9188x1GMVY1PKp6Qua_vs3hnVIl9AUJWS-ngmIx-Lv-zUN89-3UCjdoCSVFHKR4ceUYSYofb-6NppfNcm9FvU3UdC-6Y82W6ovnc6-ggC2sRhrEFFbjeH1nT831rgLJkhDtVr4cVKofF6dr0wY_avCXCkVG87QCMjYpC6Z5Nh0-PCFKNAT7NzeFTGd3Jxf-XStoB5oXhovnGPYT5vZCjZ5_RbGqLI"/>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Background Decorative Elements */}
      <div className="fixed top-0 right-0 -z-10 w-1/3 h-1/2 opacity-20 pointer-events-none">
        <div className="w-full h-full bg-primary-fixed-dim blur-[120px] rounded-full"></div>
      </div>
      <div className="fixed bottom-0 left-0 -z-10 w-1/4 h-1/3 opacity-10 pointer-events-none">
        <div className="w-full h-full bg-tertiary-fixed blur-[100px] rounded-full"></div>
      </div>
    </div>
  );
};

export default PlanConfigurationPage;
