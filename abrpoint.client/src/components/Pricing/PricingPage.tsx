import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../helper/AuthProvider';
import './PricingPage.css';

// Format prix : au plus 2 décimales, sans padding inutile (8 reste "8", pas "8,00").
// Utilise la locale FR (séparateur virgule) — cohérent avec le reste de l'UI.
// Élimine aussi les artefacts float du genre 8.8 * 12 = 105.60000000000001 → "105,6".
const formatPrice = (value: number): string =>
  new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value);

const PricingPage: React.FC = () => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const navigate = useNavigate();
  const { uticod } = useAuth();
  const isAuthenticated = Boolean(uticod);

  // Packs commerciaux V2 (2026-05) — mapping 1:1 avec PlanCatalog côté backend.
  // Modèle : forfait mensuel + N salariés inclus + tarif par salarié supplémentaire.
  // Annuel = -20% sur le forfait (overage facturé identiquement par employé).
  const ANNUAL_DISCOUNT = 0.8;
  const monthly = billingCycle === 'monthly';
  const flat = (m: number) => monthly ? m : m * 12 * ANNUAL_DISCOUNT;
  const flatPeriod = monthly ? '/ mois' : '/ an';

  const plans = [
    {
      name: 'Starter',
      target: 'TPE & startups',
      price: flat(29.5),
      period: flatPeriod,
      included: 10,
      extraRate: 4.9,
      description: "Pour démarrer la digitalisation RH d'une petite équipe sans engagement.",
      features: [
        'Jusqu’à 10 salariés inclus',
        '+ 4,90 € / salarié supplémentaire',
        'Pointage web simple',
        'Gestion RH basique (fiches, contrats)',
        'Absences & dashboard basique',
        'Exports simples',
        '1 administrateur · support standard',
      ],
      cta: '30 jours gratuits',
      accent: false,
    },
    {
      name: 'Standard',
      target: 'PME en croissance',
      price: flat(59.5),
      period: flatPeriod,
      included: 25,
      extraRate: 6.9,
      description: 'Suite complète mobile + paie pour les équipes structurées.',
      features: [
        'Jusqu’à 25 salariés inclus',
        '+ 6,90 € / salarié supplémentaire',
        'Application mobile + pointage géolocalisé',
        'Congés, RTT, CET, sanctions',
        'Coffre numérique & signature électronique',
        'Notifications push / email · reporting avancé',
        'Préparation paie complète',
        'Support prioritaire',
      ],
      cta: '30 jours gratuits',
      accent: true,
      popular: true,
    },
    {
      name: 'Premium',
      target: 'Entreprises multi-sites',
      price: flat(119),
      period: flatPeriod,
      included: 50,
      extraRate: 9.9,
      description: 'Multi-filiales, IA contextuelle et sécurité bancaire pour grandes structures.',
      features: [
        'Jusqu’à 50 salariés inclus',
        '+ 9,90 € / salarié supplémentaire',
        'Multi-filiales illimité · dashboards avancés',
        'Assistant IA (RAG) sur vos documents',
        'Audit logs avancés · branding personnalisé',
        'Sécurité mobile renforcée (device trust, cert pinning, screenshot blocking)',
        'Onboarding accompagné · SLA premium · support prioritaire',
        'Intégrations futures : API / SSO / connecteurs paie',
      ],
      cta: 'Démarrer Premium',
      // Premium = pack enterprise, paiement direct (pas d'essai). On le distingue
      // visuellement des packs avec essai via noTrial pour adapter le label CTA.
      noTrial: true,
      accent: false,
    },
  ];

  const faqs = [
    {
      q: 'Puis-je changer de plan à tout moment ?',
      a: 'Oui, vous pouvez passer à un plan supérieur ou inférieur à tout instant depuis le tableau de bord administrateur. Les ajustements sont calculés au prorata jusqu\'à la fin de la période en cours.',
    },
    {
      q: 'Comment fonctionne la facturation par utilisateur ?',
      a: "Nous comptabilisons uniquement les collaborateurs actifs marqués 'A' dans Concorde. Lorsqu'un employé quitte l'entreprise, son siège est immédiatement disponible pour un nouveau recrutement sans surcoût.",
    },
    {
      q: 'Mes données de pointage et RH sont-elles sécurisées ?',
      a: "La sécurité est au cœur de Concorde Workforce. Toutes les données (pointages, contrats, fiches employés) sont chiffrées en transit (TLS 1.3) et au repos (AES-256), avec une conformité RGPD totale et des sauvegardes automatisées.",
    },
    {
      q: 'Puis-je connecter mes pointeuses existantes ?',
      a: "Oui. Concorde supporte les principales pointeuses biométriques et badgeuses du marché. Notre équipe vous accompagne lors de la mise en service pour synchroniser vos terminaux avec la plateforme.",
    },
  ];

  return (
    <div className="pricing-container min-h-screen bg-surface text-on-surface font-body selection:bg-primary-fixed selection:text-on-primary-fixed">
      {/* TopNavBar */}
      <nav className="w-full top-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md sticky z-50 border-b border-surface-container">
        <div className="flex justify-between items-center max-w-7xl mx-auto px-8 py-4">
          <div
            className="flex items-center gap-3 cursor-pointer select-none"
            onClick={() => navigate('/')}
          >
            <img
              src="/Concorde.png"
              alt="Logo Concorde"
              style={{ height: 64, width: 'auto', objectFit: 'contain' }}
            />
          </div>
          <div className="hidden md:flex items-center gap-8">
            {/* Liens Produit / Solutions retirés : pas encore de page dédiée. */}
            <a className="text-primary border-b-2 border-primary pb-1 text-xs tracking-wider uppercase font-bold" href="#">Tarifs</a>
            <button
              type="button"
              className="text-on-surface-variant font-medium hover:text-primary transition-colors text-xs tracking-wider uppercase"
              onClick={() => navigate('/about')}
            >
              À propos
            </button>
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <button
                className="bg-primary text-white px-6 py-2.5 rounded-xl font-bold text-xs tracking-wider uppercase shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
                onClick={() => navigate('/dashboard')}
              >
                Mon Dashboard
              </button>
            ) : (
              <>
                <button className="text-on-surface-variant font-bold text-xs tracking-wider uppercase hover:text-primary transition-colors px-4 py-2" onClick={() => navigate('/login')}>
                  Connexion
                </button>
                <button
                  className="bg-primary text-white px-6 py-2.5 rounded-xl font-bold text-xs tracking-wider uppercase shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
                  onClick={() => navigate('/signup')}
                >
                  Essai gratuit
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="pt-20 pb-12 px-8 max-w-7xl mx-auto text-center">
        <h1 className="text-4xl md:text-6xl font-extrabold font-headline tracking-tight text-on-surface mb-6 leading-tight">
          Le pointage et la gestion du temps <br className="hidden md:block" /> simplifiés pour vos équipes
        </h1>
        <p className="text-on-surface-variant text-lg max-w-2xl mx-auto mb-10 font-body leading-relaxed">
          Concorde Workforce centralise pointage, congés, autorisations de sortie et reporting RH dans une seule plateforme conforme et sécurisée.
        </p>

        {/* Toggle Switch */}
        <div className="flex justify-center items-center mb-12">
          <div className="bg-surface-container-low p-1.5 rounded-full flex gap-1 border border-outline-variant/30">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-8 py-2.5 rounded-full text-sm font-bold tracking-wide transition-all ${billingCycle === 'monthly'
                ? 'bg-white text-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
                }`}
            >
              Mensuel
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-8 py-2.5 rounded-full text-sm font-bold tracking-wide transition-all flex items-center gap-2 ${billingCycle === 'annual'
                ? 'bg-white text-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
                }`}
            >
              Annuel
              <span className="text-[10px] text-tertiary font-black bg-tertiary-fixed px-2 py-0.5 rounded-full">-20%</span>
            </button>
          </div>
        </div>
      </header>

      {/* Pricing Grid */}
      <main className="max-w-7xl mx-auto px-8 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {plans.map((plan, idx) => (
            <div
              key={idx}
              className={`relative bg-white rounded-2xl p-10 flex flex-col h-full transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 border ${plan.popular ? 'ring-2 ring-primary border-transparent' : 'border-surface-container-high'
                } ambient-shadow`}
            >
              {plan.popular && (
                <div className="absolute top-0 right-0 bg-primary px-6 py-2 rounded-bl-2xl">
                  <span className="text-[10px] font-bold text-white uppercase tracking-widest">Populaire</span>
                </div>
              )}
              <div className="mb-8">
                <span className={`text-xs font-black uppercase tracking-[0.2em] mb-3 block ${plan.popular ? 'text-primary' : 'text-outline'}`}>
                  {plan.target}
                </span>
                <h3 className="text-3xl font-extrabold font-headline mb-4 text-on-surface">{plan.name}</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-black font-headline tracking-tighter text-on-surface">
                    {formatPrice(plan.price)}
                  </span>
                  <span className="text-2xl font-bold text-on-surface">€</span>
                  <span className="text-on-surface-variant font-medium text-sm">
                    {plan.period}
                  </span>
                </div>
                <div className="mt-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  {plan.included} salariés inclus · +{formatPrice(plan.extraRate)} € / salarié sup.
                </div>
                <div className="mt-1 text-[11px] text-tertiary font-bold uppercase tracking-wider">
                  {plan.noTrial
                    ? 'Activation immédiate · paiement direct'
                    : '30 jours gratuits · sans carte bancaire'}
                </div>
              </div>
              <p className="text-on-surface-variant mb-8 text-sm leading-relaxed min-h-[3rem]">
                {plan.description}
              </p>
              <div className="space-y-4 mb-10 flex-grow">
                {plan.features.map((feature, fIdx) => (
                  <div key={fIdx} className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                      check_circle
                    </span>
                    <span className="text-sm text-on-surface font-semibold">{feature}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => {
                  // Tous les packs (Starter/Standard/Premium) passent par /plan-configuration.
                  // La différence se joue côté backend : Starter/Standard = trial 30j sans CB ;
                  // Premium = pas de trial, Stripe Checkout immédiat (Status PendingPayment dès
                  // le signup). Le label CTA reflète ce comportement (cf. plan.noTrial).
                  const target = isAuthenticated ? '/dashboard/plan-configuration' : '/plan-configuration';
                  navigate(target, {
                    state: {
                      plan: plan.name, price: plan.price, cycle: billingCycle,
                      included: plan.included, extraRate: plan.extraRate,
                    },
                  });
                }}
                className={`w-full py-4 font-bold rounded-xl text-xs uppercase tracking-widest transition-all ${plan.accent || plan.popular
                  ? 'bg-gradient-to-br from-primary to-primary-container text-white shadow-lg hover:brightness-110'
                  : 'bg-surface-container-high text-on-surface hover:bg-surface-dim'
                  }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </main>

      {/* Trust Section */}
      <section className="bg-surface-container-low py-20 border-y border-surface-container">
        <div className="max-w-7xl mx-auto px-8 text-center">
          <span className="text-xs font-black uppercase tracking-widest text-primary mb-6 block">Ils nous font confiance</span>
          <h2 className="text-2xl font-bold font-headline mb-12 opacity-80">Des centaines d'entreprises pilotent leur temps de travail avec Concorde</h2>
          <div className="flex flex-wrap justify-center items-center gap-16 grayscale opacity-40 hover:opacity-100 transition-opacity">
            {/* Logos from user snippet */}
            <img alt="Company Logo" className="h-7 w-auto" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAXzlDRq8TLTxFcxiJkKfGlsE8wLgAmIW7bSzMx1CiTEmFaDtIA4IEeJSF0QPfOL1J4joc2j0pEXf9WDcPepXgSf9jKOlnpjDjaJbKyS-c8TWGg_zpuCsK-U9gU-eWB3-l7uctnVoNWZyQA3Wv8rFz56IkzZj4MzVTTV4lhdPV5fKtytwsLlAQNO5Xsif2KO_xLtmkoF6osynz5A6AT3nal26tmpS2cLMLLnNqG-AsFpmNUbuY6OW5jBUHtqppY0EfUSJ00rlAuSAc" />
            <img alt="Company Logo" className="h-7 w-auto" src="https://lh3.googleusercontent.com/aida-public/AB6AXuD3CLDvLBu1FGBM6joM1VpK-6GaZYxsqRMgRRaYbRsbBIuTyuG8F7-FWK7n-O2TsctO1bPLcr_RSooMiiIq8satrmQ7KnC2HI2kJdA6HSym-iODEG7C1H9p9o7tW6PguDLDqwGuXgVJc69wqKkRuAaVLSV4AcYERQG3Qzs6AQMH5T0ENDcgddvUPrimyFKpgekAkmVzvepNIKtSAQz-GGJskaUvACqkhASua4ky_rHXNsBvXgcWIo4KbHO_so3nB1GK0aw3R0DXx3g" />
            <img alt="Company Logo" className="h-7 w-auto" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAvplmPey6EBWSJQOqexuSrVIxr5r2UI6cMwCzl-9OrpjkpeDGV7iEkzTuxsT4WqBpZoJsI7sBQh4RmcR74FRsoXnLC3gsEMTr_5vUlE4NM60xcgA4DwaWbTMYF5k9dTKBFL86AXq8e7CgQbYhWIldSc4p9rnr6483EZrOywUp30qer6uSmstiNW4A42LzlJTLnQO9kLcWsy7JdbiAErW5tOYixcEDLiQol8KB8Ph13WQ6ymt23acsY6dXdmrZ1OcPw8Pqqiyl0IpM" />
            <img alt="Company Logo" className="h-7 w-auto" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCBzs62AVCEHJGoHx_gK13asm-P32IBmya7TBv3hy1CcpOHadeZSAPJ8ozmhSdj6ADMJzIm-QcQhkp8BTzdbSygGPD3x2fNN6gD0xolZzo5lSNg3JiAm4P8CsIarIzdGd92JlmhiwmLgJLv6qyshJ6tufXvqKMeRTfBnjpMVrJQiujCUkwv3YUE9WFi9kGrpw_mUrAZsQxfIcnmAxb5PFXLYmd8hoUWGdyIcsele2IDAFV6V7Oza2L1z4NUZQdgMcPkDQEgNoMlTms" />
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="max-w-7xl mx-auto px-8 py-32 flex flex-col md:flex-row gap-16">
        <div className="md:w-1/3">
          <h2 className="text-4xl font-extrabold font-headline leading-tight mb-6">Questions <br />fréquentes</h2>
          <p className="text-on-surface-variant font-body">Vous avez des besoins spécifiques ? Notre équipe est prête à concevoir une solution sur mesure pour votre architecture RH.</p>
          <div className="mt-8">
            <div className="w-16 h-1.5 bg-primary rounded-full"></div>
          </div>
        </div>
        <div className="md:w-2/3 space-y-12">
          {faqs.map((faq, idx) => (
            <div key={idx} className="group cursor-pointer">
              <h4 className="text-xl font-bold font-headline mb-3 text-on-surface group-hover:text-primary transition-colors flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs">?</span>
                {faq.q}
              </h4>
              <p className="text-on-surface-variant leading-relaxed pl-9">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-surface-container bg-white py-16">
        <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row justify-between items-start gap-12">
          <div className="max-w-xs">
            <div className="flex items-center gap-3 mb-4">
              <img src="/Concorde.png" alt="Logo Concorde" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
              <div className="text-2xl font-black text-on-surface font-headline uppercase tracking-tighter">Concorde Workforce</div>
            </div>
            <p className="text-on-surface-variant text-sm font-body leading-relaxed">
              La plateforme de gestion du temps de travail nouvelle génération : pointage, congés, autorisations et reporting RH réunis dans un même espace.
            </p>
            <p className="text-outline text-xs mt-8 font-medium">© {new Date().getFullYear()} Concorde Workforce. Tous droits réservés.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-12">
            <div className="flex flex-col gap-4">
              <span className="text-xs font-bold uppercase tracking-widest text-on-surface">Legal</span>
              <a className="text-on-surface-variant text-sm hover:text-primary transition-colors" href="#">Privacy Policy</a>
              <a className="text-on-surface-variant text-sm hover:text-primary transition-colors" href="#">Terms of Service</a>
              <a className="text-on-surface-variant text-sm hover:text-primary transition-colors" href="#">Security</a>
            </div>
            <div className="flex flex-col gap-4">
              <span className="text-xs font-bold uppercase tracking-widest text-on-surface">Resources</span>
              <a className="text-on-surface-variant text-sm hover:text-primary transition-colors" href="#">Blog</a>
              <a className="text-on-surface-variant text-sm hover:text-primary transition-colors" href="#">Docs</a>
              <a className="text-on-surface-variant text-sm hover:text-primary transition-colors" href="#">Help Center</a>
            </div>
            <div className="flex flex-col gap-4">
              <span className="text-xs font-bold uppercase tracking-widest text-on-surface">Connect</span>
              <a className="text-on-surface-variant text-sm hover:text-primary transition-colors" href="#">Twitter</a>
              <a className="text-on-surface-variant text-sm hover:text-primary transition-colors" href="#">LinkedIn</a>
              <a className="text-on-surface-variant text-sm hover:text-primary transition-colors" href="#">Instagram</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PricingPage;
