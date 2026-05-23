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

  // Packs commerciaux V2 (2026-05) — mapping 1:1 avec ABRPOINT.Server.Tenancy.PlanCatalog.
  // Grille tarifs.txt :
  //   Starter   →  99 €/mois (mensuel) ou  69 €/mois (annuel) — 10 inclus, max 25
  //   Standard  → 219 €/mois (mensuel) ou 119 €/mois (annuel) — 25 inclus, max 100
  //   Business  → 449 €/mois (mensuel) ou 249 €/mois (annuel) — 50 inclus, max 250
  // Le ratio annuel/mensuel n'est PAS uniforme (~30 / ~46 / ~45 %) : impossible de
  // dériver l'annuel via un coefficient global, on stocke les deux prix explicites.
  const monthly = billingCycle === 'monthly';
  // 2026-05-22 — En affichage annuel, on affiche directement le TOTAL annuel
  // (tarif annuel par mois × 12) avec la période « / an ». Le client voit
  // immédiatement le montant qui sera prélevé en une seule fois à la souscription
  // annuelle, sans devoir convertir mentalement « 69 €/mois en abonnement annuel ».
  //
  // `flat(m, a)` retourne :
  //   - le tarif mensuel `m` si on est en cycle mensuel,
  //   - le TOTAL annuel `a × 12` si on est en cycle annuel.
  const flat = (m: number, a: number) => monthly ? m : a * 12;
  const flatPeriod = monthly ? '/ mois' : '/ an';

  const plans = [
    {
      name: 'Starter',
      target: 'TPE & startups',
      price: flat(99, 69),
      // Tarif mensuel standard affiché barré en mode annuel pour matérialiser
      // l'économie réalisée (les deux prix sont indépendants — pas de % de remise
      // dérivé : annuel = 69 €/mois × 12 = 828 €/an, mensuel = 99 €/mois × 12).
      crossedMonthly: monthly ? null : 99,
      period: flatPeriod,
      included: 10,
      extraRate: 4.9,
      maxPack: 25,
      description: "Pour démarrer la digitalisation RH d'une petite équipe sans engagement.",
      // Sections rendues séparément (Inclus / Tarification supplémentaire / Limites / Idéal pour)
      // — la carte Starter utilise un rendu enrichi piloté par ces champs structurés.
      includedFeatures: [
        'Jusqu’à 10 salariés inclus',
        '1 administrateur',
        'Pointage web & mobile',
        'Gestion RH essentielle',
        'Gestion congés & absences',
        'Fiches salariés',
        'Tableau de bord simplifié',
        'Exports PDF / Excel',
        'Notifications essentielles',
        '10 Go stockage sécurisé inclus',
        'Hébergement France OVH',
        'Support standard',
      ],
      extras: [
        { label: 'Utilisateur supplémentaire', value: '+4,90 € HT / salarié / mois' },
        { label: 'Stockage supplémentaire', value: '+29 € HT / 100 Go' },
      ],
      limits: [
        'Jusqu’à 25 salariés maximum',
        'Jusqu’à 50 Go stockage maximum',
      ],
      idealFor: ['TPE', 'petites structures', 'première digitalisation RH'],
      features: [], // non utilisé pour Starter (rendu enrichi)
      cta: 'Essayer 30 jours gratuit',
      accent: false,
    },
    {
      name: 'Standard',
      target: 'PME en croissance',
      price: flat(219, 119),
      // Idem Starter : tarifs annuel/mensuel indépendants. Annuel = 119 × 12 = 1428 €/an ;
      // mensuel = 219 × 12 = 2628 €/an si poursuivi. Aucun % de remise n'est affiché.
      crossedMonthly: monthly ? null : 219,
      period: flatPeriod,
      included: 25,
      extraRate: 6.9,
      maxPack: 100,
      description: 'Suite complète mobile + paie pour les équipes structurées.',
      includedFeatures: [
        'Jusqu’à 25 salariés inclus',
        '3 administrateurs',
        'Tout le pack Starter',
        'Application mobile + pointage géolocalisé',
        'Coffre numérique & signature électronique',
        'Préparation paie · export paie',
        'Multi-sites simple',
        'Congés, RTT, CET, sanctions',
        'Reporting avancé',
        'Notifications push / email',
        '50 Go stockage sécurisé inclus',
        'Hébergement France OVH',
        'Support prioritaire',
      ],
      extras: [
        { label: 'Utilisateur supplémentaire', value: '+6,90 € HT / salarié / mois' },
        { label: 'Stockage supplémentaire', value: '+29 € HT / 100 Go' },
      ],
      limits: [
        'Jusqu’à 100 salariés maximum',
        'Jusqu’à 300 Go stockage maximum',
      ],
      idealFor: ['PME en croissance', 'équipes mobiles', 'paie + RH structurés'],
      features: [], // non utilisé pour Standard (rendu enrichi)
      cta: 'Essayer 30 jours gratuit',
      accent: true,
      popular: true,
    },
    {
      // Code interne « Premium » conservé pour compat Stripe ; libellé commercial = Business.
      name: 'Premium',
      target: 'Entreprises structurées',
      price: flat(449, 249),
      // Idem Starter/Standard. Annuel = 249 × 12 = 2988 €/an ; mensuel = 449 × 12 = 5388 €/an.
      crossedMonthly: monthly ? null : 449,
      period: flatPeriod,
      included: 50,
      extraRate: 9.9,
      maxPack: 250,
      description: 'Multi-filiales, dashboards avancés et sécurité renforcée pour grandes structures.',
      includedFeatures: [
        'Jusqu’à 50 salariés inclus',
        'Administrateurs illimités',
        'Tout le pack Standard',
        'Multi-filiales illimité',
        'Tableaux de bord avancés',
        'Audit logs avancés',
        'Branding personnalisé',
        'Sécurité mobile renforcée (device trust, cert pinning, screenshot blocking)',
        'Assistant IA (RAG)',
        'Conformité RGPD avancée · futures intégrations SSO / API',
        '200 Go stockage sécurisé inclus',
        'Hébergement France OVH',
        'Onboarding accompagné · SLA premium',
      ],
      extras: [
        { label: 'Utilisateur supplémentaire', value: '+9,90 € HT / salarié / mois' },
        { label: 'Stockage supplémentaire', value: '+29 € HT / 100 Go' },
      ],
      limits: [
        'Jusqu’à 250 salariés maximum',
        'Jusqu’à 2 To stockage maximum',
      ],
      idealFor: ['Grandes structures', 'multi-filiales / multi-sites', 'conformité & sécurité avancées'],
      features: [], // non utilisé pour Business (rendu enrichi)
      cta: 'Essayer 30 jours gratuit',
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
              src="/concorde-wrokly-logo.jpg"
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
                Mon Tableau de bord
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
            </button>
          </div>
        </div>
      </header>

      {/* Pricing Grid */}
      <main className="max-w-7xl mx-auto px-8 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {plans.map((plan, idx) => {
            // Cadre + couleurs or pour la colonne Premium uniquement.
            // Garde le style ring-primary du pack populaire (Standard) ; Premium
            // surpasse le ring avec un bord or marqué.
            const isPremium = plan.name === 'Premium';
            return (
            <div
              key={idx}
              className={`relative bg-white rounded-2xl p-10 flex flex-col h-full transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 border ${plan.popular ? 'ring-2 ring-primary border-transparent' : isPremium ? 'border-transparent' : 'border-surface-container-high'
                } ambient-shadow`}
              style={isPremium ? {
                border: '2px solid #d4af37',
                background: 'linear-gradient(180deg, #fffdf5 0%, #ffffff 60%)',
                boxShadow: '0 10px 30px rgba(212,175,55,0.18)',
              } : undefined}
            >
              {plan.popular && (
                <div className="absolute top-0 right-0 bg-primary px-6 py-2 rounded-bl-2xl">
                  <span className="text-[10px] font-bold text-white uppercase tracking-widest">Populaire</span>
                </div>
              )}
              {isPremium && (
                <div
                  className="absolute top-0 right-0 px-6 py-2 rounded-bl-2xl"
                  style={{ background: 'linear-gradient(135deg, #d4af37 0%, #b8860b 100%)' }}
                >
                  <span className="text-[10px] font-bold text-white uppercase tracking-widest">★ Haut de gamme</span>
                </div>
              )}
              <div className="mb-8">
                <span
                  className={`text-xs font-black uppercase tracking-[0.2em] mb-3 block ${plan.popular ? 'text-primary' : 'text-outline'}`}
                  style={isPremium ? { color: '#b8860b' } : undefined}
                >
                  {plan.target}
                </span>
                <h3
                  className="text-3xl font-extrabold font-headline mb-4 text-on-surface"
                  style={isPremium ? { color: '#92670a' } : undefined}
                >
                  {/* Code interne « Premium » conservé pour la compat Stripe / API ;
                      libellé commercial 2026-05 = « Business » (cf. tarifs.txt). */}
                  {plan.name === 'Premium' ? 'Business' : plan.name}
                </h3>
                {/* Préfixe « À partir de » pour souligner que le tarif affiché est
                    le plus bas — l'utilisateur paiera plus à partir du 11e salarié. */}
                <div className="text-sm font-semibold text-on-surface-variant mb-1">
                  À partir de
                </div>
                <div className="flex items-baseline gap-1">
                  <span
                    className="text-5xl font-black font-headline tracking-tighter text-on-surface"
                    style={isPremium ? { color: '#92670a' } : undefined}
                  >
                    {formatPrice(plan.price)}
                  </span>
                  <span
                    className="text-2xl font-bold text-on-surface"
                    style={isPremium ? { color: '#92670a' } : undefined}
                  >€</span>
                  <span className="text-on-surface-variant font-medium text-sm">
                    HT {plan.period}
                  </span>
                </div>
                <div className="mt-1 text-sm font-semibold text-on-surface-variant italic">
                  ({monthly ? 'Abonnement mensuel' : 'Abonnement annuel'})
                </div>
                {/* Prix barré en mode annuel : tarif mensuel standard ANNUALISÉ (× 12)
                    pour rester homogène avec le « gros chiffre » qui est désormais
                    aussi en € / an. Aucun % de remise dérivé : les deux totaux annuels
                    (engagement annuel vs poursuite mensuelle 12 mois) sont indépendants. */}
                {!monthly && (plan as any).crossedMonthly != null && (
                  <div className="mt-3 flex flex-col">
                    <span className="text-xs text-on-surface-variant mb-1">
                      soit {formatPrice(plan.price / 12)} € HT / mois ({formatPrice(plan.price / 12)} € × 12)
                    </span>
                    <span className="text-xl font-bold text-on-surface-variant line-through">
                      {formatPrice((plan as any).crossedMonthly * 12)} € HT / an
                    </span>
                    <span className="text-xs text-on-surface-variant mt-0.5">
                      Tarif mensuel standard sur 12 mois
                    </span>
                  </div>
                )}
                {/* L'ancien résumé « X inclus · +Y / sup. · cap Z » est désormais
                    déplacé dans les sections détaillées plus bas pour les plans qui
                    fournissent un rendu enrichi (Starter). Conservé ici pour les autres. */}
                {!(plan as any).includedFeatures?.length && (
                  <div className="mt-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    {plan.included} salariés inclus · +{formatPrice(plan.extraRate)} € / sup. · cap pack {plan.maxPack}
                  </div>
                )}
                <div className="mt-1 text-[11px] text-tertiary font-bold uppercase tracking-wider">
                  {monthly
                    ? '1 mois gratuit · sans carte bancaire · sans engagement'
                    : '1 mois gratuit · sans carte bancaire · engagement annuel'}
                </div>
              </div>
              <p className="text-on-surface-variant mb-8 text-sm leading-relaxed min-h-[3rem]">
                {plan.description}
              </p>
              {/* Rendu enrichi (sections Inclus / Tarification supplémentaire / Limites / Idéal pour)
                  si le plan fournit `includedFeatures` (cf. Starter). Sinon fallback sur la liste plate. */}
              {(plan as any).includedFeatures?.length ? (
                <div className="mb-10 flex-grow">
                  {/* Inclus */}
                  <div className="mb-5">
                    <h4 className="text-sm font-extrabold text-on-surface mb-3 uppercase tracking-wider">
                      Inclus :
                    </h4>
                    <ul className="space-y-2 list-disc list-inside marker:text-primary">
                      {((plan as any).includedFeatures as string[]).map((feature, fIdx) => (
                        <li key={fIdx} className="text-sm text-on-surface font-semibold">
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {/* Tarification supplémentaire */}
                  {((plan as any).extras as { label: string; value: string }[] | undefined)?.map((ex, exIdx) => (
                    <div key={exIdx} className="mb-3">
                      <div className="text-sm font-extrabold text-on-surface uppercase tracking-wider">
                        {ex.label} :
                      </div>
                      <div className="text-base font-bold text-primary mt-1">{ex.value}</div>
                    </div>
                  ))}
                  {/* Marges de croissance — formulation commerciale : la phrase d'intro
                      joue le rôle de titre de section. On N'INTITULE PLUS la section
                      « Limites du pack » (décision commerce 2026-05-22 : le mot
                      « limites » renvoie une perception négative, on préfère présenter
                      les plafonds comme une marge de croissance). */}
                  {((plan as any).limits as string[] | undefined)?.length ? (
                    <div className="mt-5 mb-5">
                      <p className="text-sm font-extrabold text-primary mb-3">
                        {plan.name === 'Starter'
                          ? 'Une marge confortable pour accompagner vos premiers pas :'
                          : plan.name === 'Standard'
                            ? 'Dimensionné pour accompagner votre montée en charge :'
                            : 'Une capacité haut volume pour les grandes structures :'}
                      </p>
                      <ul className="space-y-2 list-disc list-inside marker:text-primary">
                        {((plan as any).limits as string[]).map((lim, lIdx) => (
                          <li key={lIdx} className="text-sm text-on-surface font-semibold">
                            {lim}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {/* Idéal pour */}
                  {((plan as any).idealFor as string[] | undefined)?.length ? (
                    <div className="mt-5">
                      <h4 className="text-sm font-extrabold text-on-surface mb-3 uppercase tracking-wider">
                        Idéal pour :
                      </h4>
                      <ul className="space-y-2">
                        {((plan as any).idealFor as string[]).map((id, iIdx) => (
                          <li key={iIdx} className="flex items-start gap-2">
                            <span
                              className="material-symbols-outlined text-tertiary text-base"
                              style={{ fontVariationSettings: "'FILL' 1" }}
                            >
                              check
                            </span>
                            <span className="text-sm text-on-surface font-semibold">{id}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-4 mb-10 flex-grow">
                  {plan.features.map((feature, fIdx) => (
                    <div key={fIdx} className="flex items-start gap-3">
                      <span
                        className="material-symbols-outlined text-primary text-xl"
                        style={{ fontVariationSettings: "'FILL' 1", ...(isPremium ? { color: '#b8860b' } : {}) }}
                      >
                        check_circle
                      </span>
                      <span className="text-sm text-on-surface font-semibold">{feature}</span>
                    </div>
                  ))}
                </div>
              )}
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
                className={`w-full py-4 font-bold rounded-xl text-xs uppercase tracking-widest transition-all ${isPremium ? '' : plan.accent || plan.popular
                  ? 'bg-gradient-to-br from-primary to-primary-container text-white shadow-lg hover:brightness-110'
                  : 'bg-surface-container-high text-on-surface hover:bg-surface-dim'
                  }`}
                style={isPremium ? {
                  background: 'linear-gradient(135deg, #d4af37 0%, #b8860b 100%)',
                  color: '#fff',
                  boxShadow: '0 6px 18px rgba(184,134,11,0.32)',
                } : undefined}
              >
                {plan.cta}
              </button>
            </div>
            );
          })}
        </div>

        {/* Informations commerciales — bloc légal/marketing en petite typographie
            sous les packs. Précise les paramètres qui peuvent faire évoluer le
            tarif final (volume, modules, IA, accompagnement). Réduit le risque
            de litige post-souscription et formalise la nature de l'écart entre
            tarif mensuel et tarif annuel. */}
        <div className="mt-12 max-w-3xl mx-auto bg-surface-container-low border border-surface-container-high rounded-2xl px-6 py-5 text-xs leading-relaxed text-on-surface-variant">
          <div className="text-[10px] font-black uppercase tracking-[0.12em] text-primary mb-3">
            Informations commerciales
          </div>
          <div className="font-semibold text-on-surface mb-2">
            Conditions tarifaires susceptibles d'évoluer selon :
          </div>
          <ul className="list-disc list-inside space-y-0.5 mb-3 marker:text-on-surface-variant">
            <li>les fonctionnalités activées ;</li>
            <li>le volume d'utilisation ;</li>
            <li>le nombre d'utilisateurs ;</li>
            <li>les modules complémentaires ;</li>
            <li>les besoins de stockage ;</li>
            <li>et les futures évolutions de la plateforme.</li>
          </ul>
          <p className="mb-1.5">
            Les abonnements <strong>annuels</strong> bénéficient de conditions tarifaires préférentielles.
            Les abonnements <strong>mensuels</strong> restent disponibles aux tarifs standards affichés.
          </p>
          <p className="mb-1.5">
            Les fonctionnalités <strong>IA avancées</strong> peuvent nécessiter l'activation de modules
            ou options complémentaires selon les usages et la volumétrie.
          </p>
          <p className="mb-0">
            <strong>Déploiement et accompagnement</strong> possibles selon les besoins du client.
          </p>
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
              <img src="/concorde-wrokly-logo.jpg" alt="Logo Concorde" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
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
