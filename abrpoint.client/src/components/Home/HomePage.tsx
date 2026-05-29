import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../helper/AuthProvider';
import './HomePage.css';

// Landing publique dérivée de Maquette_Concorde_Workforce.html.
// Politique actuelle (2026) : on annonce l'essai gratuit 1 mois sans CB sur
// le hero, les packs et la promo CTA. 2026-05-23 — décision UX : tous les
// CTAs « Essayer 30 jours gratuit » naviguent désormais directement vers la
// page /signup dédiée (au lieu d'utiliser le formulaire inline InlineAuthCard
// qui restait dans la home). L'essai 30j ne demande PAS de carte bancaire ;
// après signup l'utilisateur arrive directement sur /dashboard.

type StepIndex = 0 | 1 | 2 | 3;
type BillingCycle = 'monthly' | 'annual';

// URL du site corporate Concorde Tech Innovation — utilisée par le CTA
// « Demander un devis » du pack Enterprise Plus. L'ancien CTA renvoyait vers
// /signup, ce qui n'avait pas de sens pour une offre sur mesure (il n'y a pas
// de checkout automatique). On ouvre la page corporate dans un nouvel onglet
// (target=_blank + noopener) pour que le visiteur garde la landing ouverte.
const CONCORDE_TECH_CONTACT_URL = 'https://www.concorde-tech.fr/#contact';

// ─── COMPARATIF DÉTAILLÉ ─────────────────────────────────────────────────────
// Cellule de la table de comparaison : `true` = inclus (✓), `false` = exclu (✗),
// `string` = valeur libre (ex: "Jusqu'à 5", "200 Go"). Restera figé en parallèle
// avec ABRPOINT.Server.Tenancy.PlanCatalog côté backend — toute évolution de
// PlanFeatures doit être répercutée ici et inversement, sinon la promesse
// commerciale (cette table) divergerait du gating runtime.
type CompCell = boolean | string;
type CompRow =
  | { type: 'section'; label: string }
  | {
      type: 'feature';
      label: string;
      hint?: string;
      starter: CompCell;
      standard: CompCell;
      premium: CompCell;
    };

const COMPARISON_ROWS: CompRow[] = [
  { type: 'section', label: 'Pointage & présence' },
  { type: 'feature', label: 'Pointage web',                                          starter: true,  standard: true,           premium: true },
  { type: 'feature', label: 'Application mobile (iOS / Android)',                    starter: true,  standard: true,           premium: true },
  { type: 'feature', label: 'Pointage géolocalisé',                                  starter: false, standard: true,           premium: true },
  { type: 'feature', label: 'État périodique & exports PDF/Excel',                   starter: true,  standard: true,           premium: true },

  { type: 'section', label: 'Gestion des employés' },
  { type: 'feature', label: 'Fiches collaborateurs',                                 starter: true,  standard: true,           premium: true },
  { type: 'feature', label: 'Gestion des contrats',                                  starter: false, standard: true,           premium: true },
  { type: 'feature', label: 'Coffre numérique',                                      starter: false, standard: true,           premium: true },
  { type: 'feature', label: 'Signature électronique',                                starter: false, standard: true,           premium: true },
  { type: 'feature', label: 'Scan OCR de pièces d\'identité',                        starter: false, standard: true,           premium: true },
  { type: 'feature', label: 'Import Excel en masse',                                 hint: 'Employés, services, fonctions, rubriques…', starter: false, standard: true, premium: true },

  { type: 'section', label: 'Congés, absences & autorisations' },
  { type: 'feature', label: 'Demandes de congés',                                    starter: true,  standard: true,           premium: true },
  { type: 'feature', label: 'Autorisations de sortie',                               starter: true,  standard: true,           premium: true },
  { type: 'feature', label: 'Titre de congé général',                                starter: false, standard: true,           premium: true },
  { type: 'feature', label: 'Autorisation de sortie générale',                       starter: false, standard: true,           premium: true },
  { type: 'feature', label: 'Missions',                                              starter: false, standard: true,           premium: true },
  { type: 'feature', label: 'Gestion de l\'allaitement',                             starter: false, standard: true,           premium: true },

  { type: 'section', label: 'Paie & frais' },
  { type: 'feature', label: 'Préparation paie · export paie',                       starter: false, standard: true,           premium: true },
  { type: 'feature', label: 'Notes de frais',                                        starter: false, standard: true,           premium: true },

  { type: 'section', label: 'Reporting & tableaux de bord' },
  { type: 'feature', label: 'Tableaux de bord avancés',                              starter: false, standard: true,           premium: true },
  { type: 'feature', label: 'Journaux d\'audit (RGPD)',                              starter: false, standard: false,          premium: true },

  { type: 'section', label: 'Multi-sites & multi-sociétés' },
  { type: 'feature', label: 'Multi-sites',                                           starter: false, standard: 'Jusqu\'à 5 sites', premium: 'Illimité' },
  { type: 'feature', label: 'Multi-filiales / multi-sociétés',                       starter: false, standard: false,          premium: true },

  { type: 'section', label: 'Sécurité & conformité' },
  { type: 'feature', label: 'Hébergement France OVH',                                starter: true,  standard: true,           premium: true },
  { type: 'feature', label: 'Chiffrement AES-256 + TLS 1.3',                         starter: true,  standard: true,           premium: true },
  { type: 'feature', label: 'Branding personnalisé',                                 starter: false, standard: false,          premium: true },
  { type: 'feature', label: 'Protection capture d\'écran',                           starter: false, standard: false,          premium: true },
  { type: 'feature', label: 'Certificate pinning',                                   starter: false, standard: false,          premium: true },

  { type: 'section', label: 'Limites & quotas' },
  { type: 'feature', label: 'Collaborateurs inclus',                                 starter: '10',     standard: '25',           premium: '50' },
  // 2026-05-23 : ligne « Collaborateurs maximum » supprimée — plus de plafond
  // commercial, tous les packs facturent simplement l'overage au-delà.
  { type: 'feature', label: 'Administrateurs inclus',                                starter: '1',      standard: '3',            premium: 'Illimité' },
  { type: 'feature', label: 'Stockage inclus',                                       starter: '10 Go',  standard: '50 Go',        premium: '200 Go' },
  // 2026-05-27 : ligne « Stockage maximum » supprimée — plus de plafond commercial,
  // l'admin peut acheter des blocs de stockage supplémentaires sans limite côté
  // backend (PlanDefinition.MaxStorageMb = null pour tous les packs).
  { type: 'feature', label: 'Support',                                               starter: 'Standard', standard: 'Prioritaire', premium: 'SLA prioritaire · onboarding accompagné' },
];

/**
 * Rend une cellule de la table comparative. `true` → ✓ vert, `false` → ✗ gris,
 * string → texte affiché tel quel (pour limites chiffrées ou variantes "Jusqu'à 5").
 */
function renderComparisonCell(value: CompCell): React.ReactNode {
  if (value === true) {
    return <span className="comp-check" aria-label="Inclus">✓</span>;
  }
  if (value === false) {
    return <span className="comp-cross" aria-label="Non inclus">✗</span>;
  }
  return <span className="comp-value">{value}</span>;
}

const STEPS: { num: string; title: string; desc: string }[] = [
  {
    num: '01',
    title: 'Inscrivez-vous & validez votre SIRET',
    desc: "Création du compte en 5 minutes. Vérification automatique du numéro d'entreprise (SIRET FR, BCE BE, ICE MA, NINEA SN) — unicité contrôlée pour empêcher les doublons.",
  },
  {
    num: '02',
    title: 'Importez vos équipes',
    desc: "Upload CSV ou saisie manuelle de vos collaborateurs, sites et départements. Paramétrage en moins d'une heure avec notre équipe.",
  },
  {
    num: '03',
    title: 'Déployez sur le terrain',
    desc: 'Application mobile iOS/Android pour les collaborateurs. Pointeuses biométriques compatibles. Web pour les managers. Mode offline disponible.',
  },
  {
    num: '04',
    title: 'Pilotez en temps réel',
    desc: 'Tableau de bord temps réel dès J+1. Notifications push aux managers. Préparation paie automatisée à la fin du mois. ROI mesuré et partagé à J+30.',
  },
];

// ─── OFFRE FONDATEUR ÉTÉ 2026 ────────────────────────────────────────────────
// Période : 1er juin → 31 août 2026. Compte à rebours live recalculé chaque
// seconde. Affiché dès l'ouverture de page, juste après le hero.

const FOUNDER_OFFER_END = new Date('2026-09-01T00:00:00+02:00'); // 31 août 23:59 CEST

function useFounderCountdown() {
  const calc = () => {
    const diff = FOUNDER_OFFER_END.getTime() - Date.now();
    if (diff <= 0) return { jours: 0, heures: 0, minutes: 0, secondes: 0, expired: true };
    const total = Math.floor(diff / 1000);
    return {
      jours: Math.floor(total / 86400),
      heures: Math.floor((total % 86400) / 3600),
      minutes: Math.floor((total % 3600) / 60),
      secondes: total % 60,
      expired: false,
    };
  };
  const [remaining, setRemaining] = useState(calc);
  useEffect(() => {
    const id = window.setInterval(() => setRemaining(calc()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return remaining;
}

function FounderPromoSection({ onSignup }: { onSignup: () => void }) {
  const { jours, heures, minutes, secondes, expired } = useFounderCountdown();
  const pad = (n: number) => String(n).padStart(2, '0');

  if (expired) return null; // section disparaît automatiquement le 1er septembre

  const AVANTAGES = [
    { icon: '🎁', label: '1 mois offert',         sub: 'Sans carte bancaire requise' },
    { icon: '🚀', label: 'Activation rapide',     sub: 'Opérationnel en 48h' },
    { icon: '🎓', label: 'Onboarding inclus',     sub: 'Accompagnement expert dédié' },
    { icon: '📧', label: 'Support prioritaire',   sub: 'Accès file prioritaire' },
    { icon: '⚡', label: 'Accès anticipé',        sub: 'Nouvelles fonctionnalités en avant-première' },
    { icon: '🔓', label: 'Sans engagement',       sub: 'Vous décidez après l\'essai' },
  ];

  return (
    <section className="promo-launch promo-launch--top reveal" aria-label="Offre Fondateur Été 2026">
      <div className="promo-launch-inner">

        {/* Pill */}
        <span className="promo-launch-pill">
          <span className="promo-launch-pill-icon">🚀</span>
          OFFRE FONDATEUR — ÉTÉ 2026
        </span>

        {/* Titre + compte à rebours */}
        <div className="founder-hero-row">
          <div className="founder-title-block">
            <h2 className="promo-launch-title">
              Conditions tarifaires<br />
              <span className="promo-launch-accent">préférentielles Fondateur</span>
              <span className="promo-launch-sparkle" aria-hidden="true">✨</span>
            </h2>
            <p className="promo-launch-sub">
              Du <span className="promo-launch-sub-hl">1er juin</span> au{' '}
              <span className="promo-launch-sub-hl">31 août 2026</span> — une fenêtre
              exclusive pour rejoindre Concorde Workforce à des conditions fondateur.
            </p>
          </div>

          {/* Compte à rebours */}
          <div className="founder-countdown" aria-label="Temps restant avant la fin de l'offre">
            <div className="founder-countdown-label">L'offre se termine dans</div>
            <div className="founder-countdown-grid">
              <div className="founder-countdown-unit">
                <span className="founder-countdown-num">{pad(jours)}</span>
                <span className="founder-countdown-sub">jours</span>
              </div>
              <span className="founder-countdown-sep">:</span>
              <div className="founder-countdown-unit">
                <span className="founder-countdown-num">{pad(heures)}</span>
                <span className="founder-countdown-sub">heures</span>
              </div>
              <span className="founder-countdown-sep">:</span>
              <div className="founder-countdown-unit">
                <span className="founder-countdown-num">{pad(minutes)}</span>
                <span className="founder-countdown-sub">min</span>
              </div>
              <span className="founder-countdown-sep">:</span>
              <div className="founder-countdown-unit">
                <span className="founder-countdown-num">{pad(secondes)}</span>
                <span className="founder-countdown-sub">sec</span>
              </div>
            </div>
          </div>
        </div>

        {/* Grille des 6 avantages */}
        <ul className="founder-avantages">
          {AVANTAGES.map((a) => (
            <li key={a.label} className="founder-avantage-item">
              <div className="plf-icon">{a.icon}</div>
              <div className="plf-text">
                <strong>{a.label}</strong>
                <span>{a.sub}</span>
              </div>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <button type="button" className="promo-launch-cta" onClick={onSignup}>
          <span className="promo-launch-cta-icon">🚀</span>
          Rejoindre l'offre Fondateur
          <span className="promo-launch-cta-arrow">→</span>
        </button>

        {/* Trust */}
        <div className="promo-launch-trust">
          <span><span className="plt-icon">🛡️</span> Sécurisé &amp; conforme RGPD</span>
          <span><span className="plt-icon">🇫🇷</span> Hébergement France OVH</span>
          <span><span className="plt-icon">⚡</span> Mise en place en 48h</span>
          <span><span className="plt-icon">💬</span> Support francophone humain</span>
        </div>

      </div>
    </section>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  // Session : si un utilisateur est déjà connecté à son tenant, le CTA « Essayer
  // 30 jours gratuit » et les liens d'inscription doivent court-circuiter le
  // flux signup (qui n'a aucun sens — il a déjà un compte) et le ramener à son
  // espace plateforme. Source : /Utilisateurs/me — uticod non null.
  const { uticod } = useAuth();
  const isAuthenticated = Boolean(uticod);
  const [activeStep, setActiveStep] = useState<StepIndex>(0);
  // Par défaut on présente le cycle ANNUEL : 2026-05 — décision commerce,
  // l'engagement annuel est plus avantageux et c'est l'offre à mettre en avant
  // dès l'arrivée sur la landing. Le visiteur peut basculer en mensuel via le
  // toggle s'il préfère sans engagement.
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('annual');
  const [scrolled, setScrolled] = useState(false);
  // Menu mobile : sous 900px on masque .nav-links et on remplace par un
  // hamburger qui déplie cette liste verticalement. Avant : aucun moyen
  // d'accéder à #pricing depuis mobile sans scroller jusqu'au footer.
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const howSectionRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Rotation automatique de l'étape illustrée (4 étapes × 3,5 s).
  useEffect(() => {
    const id = window.setInterval(() => {
      setActiveStep((prev) => (((prev + 1) % 4) as StepIndex));
    }, 3500);
    return () => window.clearInterval(id);
  }, []);

  // Effet "scrolled" sur la nav (assombrissement subtil).
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Reveal au scroll : ajoute la classe .visible quand l'élément entre dans le viewport.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('visible');
        });
      },
      { threshold: 0.1 }
    );
    root.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Scroll smooth vers une ancre interne.
  const scrollTo = (ref: React.RefObject<HTMLElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Grille tarifs.txt 2026-05 — alignée avec ABRPOINT.Server.Tenancy.PlanCatalog
  // et PlanConfigurationPage. On affiche le prix « à partir de » selon le cycle :
  //   • Mensuel : tarif d'engagement mensuel sans engagement annuel (99/219/449).
  //   • Annuel  : tarif annuel par mois (69/119/249), facturé annuellement.
  const monthly = billingCycle === 'monthly';
  const formatPrice = (v: number) =>
    new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(v);
  // Tarifs officiels — Offre Fondateur Été 2026 (email "Offre Fondateur" / Mme Aïda)
  const monthlyBase   = { starter: 99,  standard: 219, premium: 449 };
  const annualMonthly = { starter: 69,  standard: 119, premium: 249 };
  // Économies annuelles exactes issues de l'email officiel
  // Starter : (99−69)×12 = 360 € HT · Standard : (219−119)×12 = 1 200 € HT · Premium : (449−249)×12 = 2 400 € HT
  const annualSavings = { starter: 360, standard: 1200, premium: 2400 };
  // 2026-05-29 — Le prix affiché est TOUJOURS mensuel, y compris en engagement
  // annuel : on montre le tarif mensuel réduit (annualMonthly = 69/119/249) facturé
  // annuellement, au lieu du total annuel. Plus lisible pour comparer les deux cycles.
  const prices = {
    starter:  monthly ? formatPrice(monthlyBase.starter)  : formatPrice(annualMonthly.starter),
    standard: monthly ? formatPrice(monthlyBase.standard) : formatPrice(annualMonthly.standard),
    premium:  monthly ? formatPrice(monthlyBase.premium)  : formatPrice(annualMonthly.premium),
  };
  const pricePeriod = ' / mois HT';
  const priceCommitmentLabel = monthly ? 'Sans engagement · tarif mensuel' : 'Par mois · engagement annuel (facturé annuellement)';

  // 2026-05-23 — Tous les CTAs « Essayer 30 jours gratuit » / « Créer un
  // compte » naviguent désormais directement vers /signup (au lieu de
  // scroller vers une carte inline dans la home). Si le visiteur est déjà
  // connecté, on l'envoie sur son dashboard — le signup n'a aucun sens.
  // L'essai 30j est sans carte bancaire : on ne passe PAS par Stripe Checkout
  // tant que l'utilisateur n'upgrade pas manuellement.
  const goToSignup = (plan?: 'Starter' | 'Standard' | 'Premium') => {
    if (isAuthenticated) {
      navigate('/dashboard');
      return;
    }
    // `state.plan` est récupéré par SignupPage (location.state) pour pré-régler
    // le `planCode` envoyé à /api/signup ; pas de `userCount`, donc SignupPage
    // shortcut vers /dashboard après création (pas d'étape Stripe).
    navigate('/signup', { state: plan ? { plan } : undefined });
  };
  // « Connexion » → page /login dédiée (pattern dougs.fr/signin). Si le visiteur
  // est déjà authentifié, on shortcut directement vers son dashboard pour éviter
  // de lui montrer un formulaire de login inutile.
  const goToLogin = () => {
    if (isAuthenticated) {
      navigate('/dashboard');
      return;
    }
    navigate('/login');
  };
  // Clic sur une carte de prix → /signup avec le pack pré-sélectionné en state.
  const goToPlanConfig = (plan: 'Starter' | 'Standard' | 'Premium') => goToSignup(plan);

  // CTA « Demander un devis » du pack Enterprise Plus → site corporate
  // Concorde Tech Innovation (page contact). Pas de navigate() : on quitte
  // l'app SaaS pour le site marketing externe → window.open + _blank pour
  // conserver la landing ouverte côté visiteur. noopener/noreferrer pour la
  // sécurité (le site cible ne récupère pas window.opener).
  const goToConcordeTechContact = () => {
    window.open(CONCORDE_TECH_CONTACT_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="home-page" ref={containerRef}>
      <div className="bg-mesh" />

      {/* NAV — fixée en tête de page. */}
      <nav className={`hp-nav${scrolled ? ' scrolled' : ''}`}>
        <div className="nav-logo">
          <img className="logo-mark" src="/concorde-wrokly-logo.jpg" alt="Concorde Workforce" />
        </div>
        <ul className="nav-links">
          <li><a href="#how">Voir le démo</a></li>
          <li><a href="#pricing">Tarifs</a></li>
          <li><a href="#comparison">Comparatif</a></li>
          <li><a href="#download">Téléchargement</a></li>
        </ul>
        <div className="nav-right">
          <button type="button" className="btn-ghost" onClick={goToLogin}>Connexion</button>
          <button type="button" className="btn-primary" onClick={() => goToSignup()}>
            Créer un compte <span>→</span>
          </button>
          {/* Hamburger : visible uniquement sur mobile (cf. CSS @media).
              Sur desktop, .nav-links est affichée et le bouton est masqué. */}
          <button
            type="button"
            className={`nav-mobile-toggle${mobileMenuOpen ? ' is-open' : ''}`}
            aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen(o => !o)}
          >
            <span /><span /><span />
          </button>
        </div>
      </nav>

      {/* Menu mobile déplié — affiché uniquement quand mobileMenuOpen=true.
          Clic sur un lien : ferme le menu pour éviter qu'il reste ouvert
          après le smooth-scroll vers l'ancre. */}
      {mobileMenuOpen && (
        <div className="nav-mobile-menu" role="menu" onClick={() => setMobileMenuOpen(false)}>
          <a href="#how" role="menuitem">Voir le démo</a>
          <a href="#pricing" role="menuitem">Tarifs</a>
          <a href="#comparison" role="menuitem">Comparatif</a>
          <a href="#download" role="menuitem">Téléchargement</a>
        </div>
      )}

      {/* HERO — titre et sous-titre en premier, avant la bannière promo.
          Le dashboard a été supprimé (2026-05-27). */}
      <section className="hero">
        <h1 className="hero-title">
          Le pointage et la gestion<br />du temps <span className="accent">simplifiés</span>
        </h1>
        <p className="hero-sub">
          Pointeuses biométriques, application mobile, gestion des congés, autorisations de sortie et préparation paie — tout centralisé dans une seule plateforme sécurisée.
        </p>
        <div className="hero-cta-row">
          <button type="button" className="btn-hero-primary" onClick={() => goToSignup()}>
            Démarrer mon essai gratuit
            <span>→</span>
          </button>
          <button type="button" className="btn-hero-secondary" onClick={() => scrollTo(howSectionRef)}>
            <span>▶</span>
            Voir comment ça marche
          </button>
        </div>
        <div className="hero-trust">
          <div className="trust-item"><span className="trust-icon">✓</span> Conformité RGPD · TLS 1.3 · AES-256</div>
          <div className="trust-divider" />
          <div className="trust-item"><span className="trust-icon">✓</span> Hébergement France (OVH)</div>
          <div className="trust-divider" />
          <div className="trust-item"><span className="trust-icon">✓</span> Support francophone</div>
          <div className="trust-divider" />
          <div className="trust-item"><span className="trust-icon">✓</span> Multi-pays FR · BE · MA · SN</div>
        </div>
      </section>

      {/* OFFRE FONDATEUR ÉTÉ 2026 — placée après le hero (titre/sous-titre)
          conformément à la demande UX 2026-05-27. */}
      <FounderPromoSection onSignup={() => goToSignup()} />

      {/* STATS */}
      <div className="stats-strip reveal">
        <div className="stat-item">
          <div className="stat-num">500+</div>
          <div className="stat-label">Entreprises clientes</div>
        </div>
        <div className="stat-item">
          <div className="stat-num">4 pays</div>
          <div className="stat-label">FR · BE · MA · SN</div>
        </div>
        <div className="stat-item">
          <div className="stat-num">−34%</div>
          <div className="stat-label">Absentéisme moyen</div>
        </div>
        <div className="stat-item">
          <div className="stat-num">2 sem.</div>
          <div className="stat-label">Pour déployer</div>
        </div>
      </div>

      {/* MOBILE DOWNLOAD — bandeau dédié pour rendre le lien de téléchargement
          mobile (URL canonique : concordeworkly.com) immédiatement repérable
          en haut de page, sans avoir à scroller jusqu'à l'étape « Déployez sur
          le terrain ». */}
      <section id="download" className="download-band reveal">
        <div className="download-band-inner">
          <div className="download-band-left">
            <div className="download-band-tag">📱 Application mobile</div>
            <h3 className="download-band-title">Téléchargez l'app Concorde Workly</h3>
            <p className="download-band-sub">
              iOS · Android · Mode offline · Géolocalisation optionnelle. Rendez-vous sur{' '}
              <a className="download-band-url" href="/download">concordeworkly.com</a>
              {' '}pour récupérer la dernière version.
            </p>
          </div>
          <div className="download-band-buttons">
            <a className="store-btn" href="/download">
              <span className="store-btn-icon"></span>
              <span className="store-btn-text">
                <span className="store-btn-small">Télécharger sur</span>
                <span className="store-btn-large">App Store</span>
              </span>
            </a>
            <a className="store-btn" href="/download">
              <span className="store-btn-icon">▶</span>
              <span className="store-btn-text">
                <span className="store-btn-small">DISPONIBLE SUR</span>
                <span className="store-btn-large">Google Play</span>
              </span>
            </a>
            <a className="store-btn store-btn-apk" href="/download">
              <span className="store-btn-icon">⬇</span>
              <span className="store-btn-text">
                <span className="store-btn-small">APK direct</span>
                <span className="store-btn-large">concordeworkly.com</span>
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" ref={howSectionRef} style={{ background: 'var(--hp-surface-container-lowest)' }}>
        <div className="section-tag">Comment ça marche</div>
        <h2 className="section-title">Opérationnel en <span className="accent">2 semaines</span></h2>
        <p className="section-sub">Un déploiement guidé, sans technicien, sans résistance interne.</p>
        <div className="how-layout reveal">
          <div className="steps">
            {STEPS.map((s, i) => (
              <div
                key={s.num}
                className={`step${activeStep === i ? ' active' : ''}`}
                onClick={() => setActiveStep(i as StepIndex)}
              >
                <div className="step-num">{s.num}</div>
                <div className="step-content">
                  <div className="step-title">{s.title}</div>
                  <div className="step-desc">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
          {/* VIDÉO — remplace les illustrations des étapes (2026-05-27).
              Lecture automatique déclenchée par IntersectionObserver au scroll.
              Le fichier doit être placé dans public/ sous le nom vide_o_finale_.mp4 */}
          <div className="step-video-wrap">
            <video
              ref={(el) => {
                if (!el) return;
                const obs = new IntersectionObserver(
                  ([entry]) => {
                    if (entry.isIntersecting) {
                      el.play().catch(() => {});
                    } else {
                      el.pause();
                    }
                  },
                  { threshold: 0.4 }
                );
                obs.observe(el);
              }}
              src="/vide_o_finale_.mp4"
              muted
              loop
              playsInline
              preload="metadata"
              className="step-video"
              aria-label="Démonstration de la plateforme Concorde Workforce"
            />
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="pricing-section">
        <div style={{ textAlign: 'center', marginBottom: 0 }}>
          <div className="section-tag" style={{ justifyContent: 'center' }}>Tarifs</div>
          <h2 className="section-title" style={{ margin: '0 auto', textAlign: 'center' }}>
            Un tarif <span className="accent">transparent</span>,<br />zéro surprise
          </h2>
          {/* Annonce commerciale "Conditions privilégiées" — ton or pour rester
              cohérent avec le bandeau Early Launch et le pack Premium. Placée
              juste sous le titre de la section pour valoriser l'offre avant
              même que l'utilisateur ne lise la grille. */}
          <div
            style={{
              margin: '20px auto 12px',
              maxWidth: 720,
              padding: '14px 22px',
              background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
              border: '1px solid #d4af37',
              borderRadius: 14,
              textAlign: 'center',
              boxShadow: '0 4px 14px rgba(212,175,55,0.18)',
            }}
          >
            <div style={{ color: '#92400e', fontWeight: 800, fontSize: 15, marginBottom: 4, letterSpacing: 0.2 }}>
              💎 Conditions tarifaires privilégiées
            </div>
            <div style={{ color: '#7c5a0b', fontWeight: 500, fontSize: 13.5, lineHeight: 1.55 }}>
              Bénéficiez actuellement de conditions tarifaires privilégiées sur l'ensemble de nos offres SaaS professionnelles.
            </div>
          </div>
          <p className="section-sub" style={{ margin: '16px auto 48px', textAlign: 'center' }}>
            Forfait mensuel par société · Salariés inclus + tarif par employé supplémentaire.
          </p>
        </div>
        <div className="pricing-toggle">
          <button type="button" className={`toggle-btn${monthly ? ' active' : ''}`} onClick={() => setBillingCycle('monthly')}>Mensuel</button>
          <button type="button" className={`toggle-btn${!monthly ? ' active' : ''}`} onClick={() => setBillingCycle('annual')}>Engagement annuel</button>
        </div>
        <div className="pricing-grid reveal">

          {/* ── STARTER ── */}
          <div className="price-card">
            <div className="price-tier">Starter</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4 }}>À partir de</div>
            <div className="price-amount">
              <span className="currency">€</span>{prices.starter}<span className="period">{pricePeriod}</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, fontStyle: 'italic', marginTop: 4 }}>
              {monthly ? (
                <span style={{ color: '#16a34a' }}>✓ Sans engagement de durée</span>
              ) : (
                <span style={{ color: '#0040a1' }}>✓ Engagement annuel · conditions préférentielles</span>
              )}
            </div>
            {!monthly && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 17, fontWeight: 700, color: '#94a3b8', textDecoration: 'line-through' }}>
                  {formatPrice(monthlyBase.starter)} € HT / mois
                </span>
                <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 700 }}>
                  Économie : {formatPrice(annualSavings.starter)} € HT / an
                </span>
              </div>
            )}
            <div className="price-included" style={{ marginTop: 12 }}>10 collaborateurs inclus · 10 Go stockage sécurisé</div>
            <div className="price-per">{priceCommitmentLabel}</div>
            <ul className="price-desc-list">
              <li>Pointage web &amp; mobile (iOS / Android)</li>
              <li>Gestion RH essentielle (fiches, contrats)</li>
              <li>Gestion congés &amp; absences</li>
              <li>Tableau de bord simplifié · exports PDF / Excel</li>
              <li>Notifications essentielles</li>
              <li>10 Go stockage sécurisé · Hébergement France OVH</li>
              <li>Multi utilisateurs</li>
            </ul>
            <button type="button" className="btn-plan btn-plan-ghost" onClick={() => goToPlanConfig('Starter')}>Essayer 30 jours gratuit</button>
          </div>

          {/* ── STANDARD ── */}
          <div className="price-card featured">
            <div className="popular-badge">⭐ Le plus populaire</div>
            <div className="price-tier" style={{ marginTop: 10 }}>Standard</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 4 }}>À partir de</div>
            <div className="price-amount">
              <span className="currency">€</span>{prices.standard}<span className="period">{pricePeriod}</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, fontStyle: 'italic', marginTop: 4 }}>
              {monthly ? (
                <span style={{ color: '#16a34a' }}>✓ Sans engagement de durée</span>
              ) : (
                <span style={{ color: '#0040a1' }}>✓ Engagement annuel · conditions préférentielles</span>
              )}
            </div>
            {!monthly && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 17, fontWeight: 700, color: '#94a3b8', textDecoration: 'line-through' }}>
                  {formatPrice(monthlyBase.standard)} € HT / mois
                </span>
                <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 700 }}>
                  Économie : {formatPrice(annualSavings.standard)} € HT / an
                </span>
              </div>
            )}
            <div className="price-included" style={{ marginTop: 12 }}>25 collaborateurs inclus · 50 Go stockage sécurisé</div>
            <div className="price-per">{priceCommitmentLabel}</div>
            <ul className="price-desc-list">
              <li>Tout le pack Starter</li>
              <li>Application mobile + géolocalisation</li>
              <li>Coffre numérique &amp; signature électronique</li>
              <li>Import Excel en masse (employés, services, fonctions, rubriques…)</li>
              <li>Préparation paie · export paie</li>
              <li>Multi-sites simple</li>
              <li>Congés, RTT, CET, sanctions</li>
              <li>Notifications push / email · Reporting avancé</li>
              <li>50 Go stockage sécurisé · Hébergement France OVH</li>
              <li>Multi utilisateurs</li>
              <li>Idéal : PME en croissance · équipes terrain · structures multi-sites · gestion RH centralisée</li>
            </ul>
            <button type="button" className="btn-plan btn-plan-primary" onClick={() => goToPlanConfig('Standard')}>Essayer 30 jours gratuit</button>
          </div>

          {/* ── BUSINESS ── */}
          <div
            className="price-card price-card-premium"
            style={{
              border: '2px solid #d4af37',
              background: 'linear-gradient(180deg, #fffdf5 0%, #ffffff 60%)',
              boxShadow: '0 10px 30px rgba(212,175,55,0.18)',
              position: 'relative',
            }}
          >
            <div style={{
              position: 'absolute', top: -12, right: 20,
              background: 'linear-gradient(135deg, #d4af37 0%, #b8860b 100%)',
              color: '#fff', fontSize: 11, fontWeight: 800,
              padding: '4px 12px', borderRadius: 999,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              boxShadow: '0 4px 10px rgba(184,134,11,0.32)',
            }}>★ Haut de gamme</div>
            <div className="price-tier" style={{ color: '#b8860b' }}>Premium</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#b8860b', marginBottom: 4 }}>À partir de</div>
            <div className="price-amount" style={{ color: '#92670a' }}>
              <span className="currency">€</span>{prices.premium}<span className="period" style={{ color: '#b8860b' }}>{pricePeriod}</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, fontStyle: 'italic', marginTop: 4 }}>
              {monthly ? (
                <span style={{ color: '#16a34a' }}>✓ Sans engagement de durée</span>
              ) : (
                <span style={{ color: '#b8860b' }}>✓ Engagement annuel · conditions préférentielles</span>
              )}
            </div>
            {!monthly && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 17, fontWeight: 700, color: '#cbb778', textDecoration: 'line-through' }}>
                  {formatPrice(monthlyBase.premium)} € HT / mois
                </span>
                <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 700 }}>
                  Économie : {formatPrice(annualSavings.premium)} € HT / an
                </span>
              </div>
            )}
            <div className="price-included" style={{ marginTop: 12 }}>50 collaborateurs inclus · 200 Go stockage sécurisé</div>
            <div className="price-per">{priceCommitmentLabel}</div>
            <ul className="price-desc-list">
              <li>Tout le pack Standard</li>
              <li>Multi-filiales sur devis · tableaux de bord avancés</li>
              <li>Sécurité renforcée</li>
              <li>Audit logs avancés</li>
              <li>Supervision avancée</li>
              <li>200 Go stockage sécurisé · Hébergement France OVH</li>
              <li>Administrateurs illimités · Onboarding accompagné</li>
              <li>SLA prioritaire</li>
              <li>API &amp; futures intégrations</li>
              <li>Idéal : PME structurées · groupes multi-sites · conformité &amp; sécurité avancées · organisations en croissance</li>
            </ul>
            <button
              type="button"
              className="btn-plan"
              onClick={() => goToPlanConfig('Premium')}
              style={{
                background: 'linear-gradient(135deg, #d4af37 0%, #b8860b 100%)',
                color: '#fff', border: 'none', fontWeight: 800,
                boxShadow: '0 6px 18px rgba(184,134,11,0.32)',
              }}
            >
              Essayer 30 jours gratuit
            </button>
          </div>

          {/* ── ENTERPRISE PLUS ── */}
          <div
            className="price-card"
            style={{
              gridColumn: '1 / -1',
              background: 'linear-gradient(135deg, #0f172a 0%, #0040a1 100%)',
              border: '2px solid #0040a1',
              boxShadow: '0 12px 36px rgba(0,64,161,0.22)',
              color: '#fff',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 40,
              padding: '28px 36px',
            }}
          >
            {/* Gauche : titre + prix */}
            <div style={{ flexShrink: 0 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 99, padding: '3px 12px', fontSize: 10, fontWeight: 800,
                letterSpacing: '0.1em', textTransform: 'uppercase', color: '#fff', marginBottom: 12,
              }}>
                ★ Sur mesure
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Enterprise Plus</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#fde68a', letterSpacing: '-0.02em', lineHeight: 1 }}>
                Sur devis
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 6, lineHeight: 1.5 }}>
                Tarification personnalisée<br />selon votre structure &amp; volume
              </div>
              {/* CTA redirigé vers le site corporate Concorde Tech Innovation
                  (page contact) — c'est une offre sur mesure, le checkout
                  automatique n'a pas de sens. window.open + _blank pour
                  garder la landing ouverte derrière. */}
              <button
                type="button"
                className="btn-plan"
                style={{
                  marginTop: 18, background: '#fff', color: '#0040a1',
                  border: 'none', fontWeight: 800, padding: '11px 22px',
                  width: 'fit-content', whiteSpace: 'nowrap',
                }}
                onClick={goToConcordeTechContact}
              >
                Demander un devis →
              </button>
            </div>

            {/* Séparateur */}
            <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,255,255,0.15)', flexShrink: 0 }} />

            {/* Droite : features en 2 colonnes */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.65)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>
                Tout le pack Premium, plus :
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 32px' }}>
                {[
                  'IA RH avancée',
                  'Recherche documentaire intelligente',
                  'Workflows intelligents',
                  'API avancées &amp; SSO',
                  'Hébergement dédié possible',
                  'Architecture sur mesure',
                  'Déploiement multi-entités',
                ].map((f, i) => (
                  <div key={i} style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ color: '#fde68a', fontWeight: 800, fontSize: 11 }}>✓</span>
                    <span dangerouslySetInnerHTML={{ __html: f }} />
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

        <div className="pricing-footnote">
          Sans engagement de durée · TVA en sus · Facturation Stripe sécurisée
        </div>

        {/* Informations commerciales — bloc légal/marketing en petite typographie
            sous les packs. Précise les paramètres qui peuvent faire évoluer le
            tarif final (volume, modules, IA, accompagnement). Réduit le risque
            de litige post-souscription et formalise les conditions de remise
            annuelle (différence avec le tarif mensuel standard). */}
        <div style={{
          marginTop: 24,
          maxWidth: 900,
          marginLeft: 'auto',
          marginRight: 'auto',
          padding: '18px 22px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: 14,
          fontSize: 12,
          lineHeight: 1.6,
          color: '#475569',
        }}>
          <div style={{
            fontSize: 10, fontWeight: 800, color: '#0040a1',
            textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10,
          }}>
            Informations commerciales
          </div>
          <div style={{ marginBottom: 8, fontWeight: 600, color: '#334155' }}>
            Conditions tarifaires susceptibles d'évoluer selon :
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, marginBottom: 12 }}>
            <li>les fonctionnalités activées ;</li>
            <li>le volume d'utilisation ;</li>
            <li>le nombre d'utilisateurs ;</li>
            <li>les modules complémentaires ;</li>
            <li>les besoins de stockage ;</li>
            <li>et les futures évolutions de la plateforme.</li>
          </ul>
          <p style={{ margin: '0 0 6px 0' }}>
            Les abonnements <strong>annuels</strong> bénéficient de conditions tarifaires préférentielles.
            Les abonnements <strong>mensuels</strong> restent disponibles aux tarifs standards affichés.
          </p>
          <p style={{ margin: '0 0 6px 0' }}>
            Les fonctionnalités <strong>IA avancées</strong> peuvent nécessiter l'activation de modules
            ou options complémentaires selon les usages et la volumétrie.
          </p>
          <p style={{ margin: 0 }}>
            <strong>Déploiement et accompagnement</strong> possibles selon les besoins du client.
          </p>
        </div>
      </section>

      {/* ────────────────────────────────────────────────────────────────────────
          COMPARATIF DÉTAILLÉ — table de comparaison des 3 packs sur la matrice
          fonctionnelle complète. Source de vérité : ABRPOINT.Server.Tenancy.PlanCatalog
          (les ✓/✗ doivent rester synchronisés avec PlanFeatures côté backend).
          La structure (titre de section + table avec th sticky en colonne, lignes
          regroupées par catégorie) est inspirée de la grille tarifaire dougs.fr.
          ──────────────────────────────────────────────────────────────────── */}
      <section id="comparison" className="comparison-section">
        <div className="section-tag" style={{ margin: '0 auto', textAlign: 'center', display: 'block' }}>Comparatif détaillé</div>
        <h2 className="section-title" style={{ margin: '8px auto 0', textAlign: 'center' }}>
          Tout ce qui est inclus dans <span className="accent">chaque pack</span>
        </h2>
        <p className="section-sub" style={{ margin: '12px auto 36px', textAlign: 'center' }}>
          La matrice complète des modules et fonctionnalités, pack par pack. Choisissez en toute transparence.
        </p>

        <div className="comparison-wrapper">
          <table className="comparison-table">
            <thead>
              <tr>
                <th className="comp-corner">Fonctionnalités</th>
                <th className="comp-plan">
                  <div className="comp-plan-name">Starter</div>
                  <div className="comp-plan-price">
                    à partir de <strong>{prices.starter} €</strong> HT{pricePeriod}
                  </div>
                  <button type="button" className="comp-cta" onClick={() => goToPlanConfig('Starter')}>
                    Essai gratuit
                  </button>
                </th>
                <th className="comp-plan comp-plan-featured">
                  <div className="comp-plan-badge">⭐ Le plus populaire</div>
                  <div className="comp-plan-name">Standard</div>
                  <div className="comp-plan-price">
                    à partir de <strong>{prices.standard} €</strong> HT{pricePeriod}
                  </div>
                  <button type="button" className="comp-cta comp-cta-primary" onClick={() => goToPlanConfig('Standard')}>
                    Essai gratuit
                  </button>
                </th>
                <th className="comp-plan comp-plan-premium-th">
                  <div className="comp-plan-name" style={{ color: '#b8860b' }}>Premium</div>
                  <div className="comp-plan-price">
                    à partir de <strong>{prices.premium} €</strong> HT{pricePeriod}
                  </div>
                  <button type="button" className="comp-cta comp-cta-premium" onClick={() => goToPlanConfig('Premium')}>
                    Essai gratuit
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row, idx) => {
                if (row.type === 'section') {
                  return (
                    <tr key={`section-${idx}`} className="comp-section-row">
                      <td colSpan={4}>{row.label}</td>
                    </tr>
                  );
                }
                return (
                  <tr key={`feat-${idx}`} className="comp-feature-row">
                    <td className="comp-feature-label">
                      {row.label}
                      {row.hint && <span className="comp-feature-hint">{row.hint}</span>}
                    </td>
                    <td className="comp-cell">{renderComparisonCell(row.starter)}</td>
                    <td className="comp-cell comp-cell-featured">{renderComparisonCell(row.standard)}</td>
                    <td className="comp-cell">{renderComparisonCell(row.premium)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* PROMO CTA */}
      <div className="promo-cta-wrap">
        <div className="promo-cta reveal">
          <div className="promo-cta-badge">
            🎁 Essai gratuit 1 mois — sans carte bancaire
          </div>
          <h2>Rejoignez les entreprises<br />qui ont fait le choix de la sérénité.</h2>
          <p>Testez Concorde Workforce gratuitement pendant 1 mois — sans CB, sans engagement.<br />Déploiement en 2 semaines · Support francophone humain · ROI mesurable dès J+30.</p>
          <div className="promo-features">
            <div className="promo-feat-item"><span className="promo-feat-check">✓</span> 1 mois gratuit sans CB</div>
            <div className="promo-feat-item"><span className="promo-feat-check">✓</span> Onboarding expert inclus</div>
            <div className="promo-feat-item"><span className="promo-feat-check">✓</span> Sans engagement de durée</div>
            <div className="promo-feat-item"><span className="promo-feat-check">✓</span> Annulation en 1 clic</div>
          </div>
          <button type="button" className="btn-cta-light" onClick={() => goToSignup()}>
            Démarrer mon essai gratuit →
          </button>
        </div>
      </div>

      {/* FOOTER */}
      <footer>
        <div className="footer-grid">
          <div>
            <div className="footer-logo nav-logo">
              <img className="logo-mark" src="/concorde-wrokly-logo.jpg" alt="Concorde Workforce" />
              <span>Concorde Workforce</span>
            </div>
            <div className="footer-desc">
              La plateforme RH &amp; pointage conçue pour les équipes terrain en Afrique francophone et en Europe. Contrôle, conformité, sérénité.
            </div>
            <div className="footer-flags">🇫🇷 🇧🇪 🇲🇦 🇸🇳</div>
          </div>
          <div className="footer-col">
            <h4>Produit</h4>
            <div className="footer-links">
              <a href="#pricing">Tarifs</a>
              <a href="#how">Démo</a>
              <a href="#download">Application mobile</a>
              <a href="/download">concordeworkly.com</a>
              <a href="#temoignages">Cas clients</a>
            </div>
          </div>
          <div className="footer-col">
            <h4>Ressources</h4>
            <div className="footer-links">
              <a onClick={() => navigate('/contact-sales')}>Contact commercial</a>
              <a onClick={() => navigate('/about')}>À propos</a>
              <a onClick={() => navigate('/login')}>Se connecter</a>
              <a onClick={() => navigate('/signup')}>Créer un compte</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Concorde Workforce · Tous droits réservés</span>
          <span className="footer-bottom-links">
            <a href="/confidentialite">Confidentialité</a>
            <a href="/cgu">CGU</a>
            <a href="/mentions-legales">Mentions légales</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
