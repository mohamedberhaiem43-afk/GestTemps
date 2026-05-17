import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Users, Rocket, CheckCircle2, FileText, Headset } from 'lucide-react';
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
  flatPriceMonthlyEur: number;
  includedEmployees: number;
  overageRatePerEmployeeEur: number;
  maxEmployees: number;
  moduleCount: number;
}> = {
  // Grille Early Launch 2026-05-17 (alignée avec ABRPOINT.Server.Tenancy.PlanCatalog) :
  // Standard repositionné 54€/15 inclus (avant 59.50€/25), Premium 149€/30 inclus (avant 119€/50).
  // maxEmployees = plafond ABSOLU du pack — au-delà, upgrade obligatoire.
  Starter:  { displayName: 'Starter',  flatPriceMonthlyEur: 29.50, includedEmployees: 10, overageRatePerEmployeeEur: 4.90, maxEmployees: 30,  moduleCount: 7  },
  Standard: { displayName: 'Standard', flatPriceMonthlyEur: 54.00, includedEmployees: 15, overageRatePerEmployeeEur: 6.90, maxEmployees: 100, moduleCount: 14 },
  Premium:  { displayName: 'Premium',  flatPriceMonthlyEur: 149.00, includedEmployees: 30, overageRatePerEmployeeEur: 9.90, maxEmployees: 200, moduleCount: 19 },
};

const PlanConfigurationPage: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { uticod } = useAuth();
  const isAuthenticated = Boolean(uticod);
  // Plan + cycle viennent en général de PricingPage via location.state ; valeurs par défaut
  // si l'utilisateur arrive directement sur l'URL.
  const initialState = (location.state ?? {}) as {
    plan?: string;
    cycle?: 'monthly' | 'annual';
    userCount?: number;
  };
  const planCode: PlanKey = ((initialState.plan as PlanKey) in PLAN_CATALOG
    ? (initialState.plan as PlanKey)
    : 'Standard');
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
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>(initialState.cycle ?? 'annual');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Tarification : forfait mensuel fixe au quota inclus. Pas d'overage à ce stade —
  // l'admin l'active à la création d'un collab via la fiche (cf. AjoutEmploye). Le
  // simulateur reste indicatif ; Stripe applique le prix réel des price_id
  // `Stripe:Prices:{Plan}:base:{cycle}` côté backend.
  const { baseMonthly, monthlyTotal, annualDiscountPerMonth } = useMemo(() => {
    const baseM = plan.flatPriceMonthlyEur;
    const monthly = billingCycle === 'annual' ? baseM * 0.80 : baseM;
    const discountPerMonth = billingCycle === 'annual' ? baseM * 0.20 : 0;
    return { baseMonthly: baseM, monthlyTotal: monthly, annualDiscountPerMonth: discountPerMonth };
  }, [plan, billingCycle]);

  const handleConfirmCheckout = async () => {
    // Utilisateur connecté → on lance directement la session Stripe Checkout.
    // Visiteur → on bascule sur /signup ; SignupPage déclenchera Stripe après création du tenant.
    const state = {
      plan: planCode,
      price: monthlyTotal,
      cycle: billingCycle,
      userCount,
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
                    Annuel <span className="text-[10px] text-tertiary ml-1">(-20%)</span>
                  </button>
                </div>

                {/* Breakdown — formule miroir backend :
                    flat + max(0, userCount − inclus) × overage. */}
                <div className="space-y-5 mb-10">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-outline font-bold">Forfait {plan.displayName}</span>
                    <span className="font-black text-on-surface">{formatPrice(plan.flatPriceMonthlyEur)} € / mois</span>
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
                  {billingCycle === 'annual' && (
                    <div className="flex justify-between items-center text-sm text-tertiary p-3 bg-tertiary/5 rounded-xl border border-tertiary/10">
                      <span className="font-bold">Remise annuelle</span>
                      <span className="font-black">- {formatPrice(annualDiscountPerMonth)} € / mois</span>
                    </div>
                  )}
                  <div className="pt-6 border-t border-surface-container-high flex justify-between items-baseline">
                    <span className="font-black text-on-surface uppercase text-xs tracking-widest">Total / mois</span>
                    <div className="text-right">
                      <div className="text-4xl font-black text-primary font-headline tracking-tighter">{formatPrice(monthlyTotal)} €</div>
                      <div className="text-[9px] text-outline uppercase font-black tracking-widest mt-1">HT / mois facturé {billingCycle === 'annual' ? 'annuellement' : 'mensuellement'}</div>
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
