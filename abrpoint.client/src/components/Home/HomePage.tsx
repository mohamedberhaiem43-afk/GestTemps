import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import InlineAuthCard from './InlineAuthCard';
import './HomePage.css';

// Landing publique dérivée de Maquette_Concorde_Workforce.html.
// Politique actuelle (2026) : on annonce l'essai gratuit 1 mois sans CB sur
// le hero, les packs et la promo CTA. Les CTAs scrollent désormais vers la
// section "Rejoindre Concorde Workforce" (composant InlineAuthCard) plutôt
// que de naviguer vers /signup ou /login.

type StepIndex = 0 | 1 | 2 | 3;
type BillingCycle = 'monthly' | 'annual';

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
    desc: 'Dashboard temps réel dès J+1. Notifications push aux managers. Préparation paie automatisée à la fin du mois. ROI mesuré et partagé à J+30.',
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState<StepIndex>(0);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [scrolled, setScrolled] = useState(false);
  // Menu mobile : sous 900px on masque .nav-links et on remplace par un
  // hamburger qui déplie cette liste verticalement. Avant : aucun moyen
  // d'accéder à #pricing depuis mobile sans scroller jusqu'au footer.
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Pack pré-sélectionné transmis à InlineAuthCard. `nonce` incrémenté à chaque
  // clic pour forcer le ré-déclenchement de l'effet de pré-sélection côté carte
  // (sinon, re-cliquer sur le même pack après changement local serait ignoré).
  const [presetPlan, setPresetPlan] = useState<'Starter' | 'Standard' | 'Premium' | undefined>(undefined);
  const [presetNonce, setPresetNonce] = useState(0);

  // Expansion par pack : on n'affiche que les 4 features clés par défaut, puis
  // un lien « Lire la suite » dévoile le reste. État indépendant par pack pour
  // que l'utilisateur puisse comparer librement sans repli forcé.
  type PackKey = 'starter' | 'standard' | 'premium';
  const [expandedPacks, setExpandedPacks] = useState<Record<PackKey, boolean>>({
    starter: false, standard: false, premium: false,
  });
  const togglePack = (k: PackKey) =>
    setExpandedPacks((s) => ({ ...s, [k]: !s[k] }));
  const KEY_FEATURE_LIMIT = 4;

  const authSectionRef = useRef<HTMLDivElement | null>(null);
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
  //   • Annuel  : équivalent mensuel quand l'engagement est annuel (69/119/249).
  // En cycle annuel on continue d'afficher « / mois HT » (et non « / an ») pour
  // que le visiteur compare facilement les deux cycles côte à côte — c'est la
  // convention adoptée par Stripe, Doctolib et la plupart des SaaS RH.
  const monthly = billingCycle === 'monthly';
  const formatPrice = (v: number) =>
    new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(v);
  const monthlyBase  = { starter: 99,  standard: 219, premium: 449 };
  const annualMonthly = { starter: 69,  standard: 119, premium: 249 };
  const prices = {
    starter:  monthly ? formatPrice(monthlyBase.starter)  : formatPrice(annualMonthly.starter),
    standard: monthly ? formatPrice(monthlyBase.standard) : formatPrice(annualMonthly.standard),
    premium:  monthly ? formatPrice(monthlyBase.premium)  : formatPrice(annualMonthly.premium),
  };
  const pricePeriod = monthly ? ' / mois HT' : ' / mois HT';
  // Sous-libellé indiquant l'engagement (« sans engagement » vs « facturé annuellement »)
  const priceCommitmentLabel = monthly ? 'Sans engagement · tarif mensuel' : 'Engagement annuel · -30 à -45 %';

  // Smooth-scroll vers la section "Rejoindre Concorde Workforce" : nav header
  // + CTAs hero/promo cliquent ici plutôt que de partir vers /signup ou /login.
  const scrollToAuth = () => {
    authSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const goToSignup = () => scrollToAuth();
  const goToLogin = () => scrollToAuth();
  // Avant 2026-05-19, le clic sur une carte de prix naviguait vers
  // /plan-configuration. Désormais : on reste sur la home, on pré-sélectionne le
  // pack dans InlineAuthCard (via la prop `presetPlan`) et on scrolle jusqu'au
  // formulaire d'inscription. Le `nonce` force la pré-sélection à se rejouer
  // même quand l'utilisateur re-clique sur le pack déjà sélectionné.
  const goToPlanConfig = (plan: 'Starter' | 'Standard' | 'Premium') => {
    setPresetPlan(plan);
    setPresetNonce((n) => n + 1);
    scrollToAuth();
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
          <li><a href="#features">Fonctionnalités</a></li>
          <li><a href="#how">Comment ça marche</a></li>
          <li><a href="#secteurs">Secteurs</a></li>
          <li><a href="#pricing">Tarifs</a></li>
          <li><a href="#download">Téléchargement</a></li>
          <li><a href="#temoignages">Témoignages</a></li>
        </ul>
        <div className="nav-right">
          <button type="button" className="btn-ghost" onClick={goToLogin}>Connexion</button>
          <button type="button" className="btn-primary" onClick={goToSignup}>
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
          <a href="#features" role="menuitem">Fonctionnalités</a>
          <a href="#how" role="menuitem">Comment ça marche</a>
          <a href="#secteurs" role="menuitem">Secteurs</a>
          <a href="#pricing" role="menuitem">Tarifs</a>
          <a href="#download" role="menuitem">Téléchargement</a>
          <a href="#temoignages" role="menuitem">Témoignages</a>
        </div>
      )}

      {/* PROMO UNIFIÉE — placée juste sous la nav pour que le visiteur la
          découvre dès l'ouverture de la page (avant même le hero). Le padding
          haut de la section compense la hauteur de .hp-nav (fixed, 76px).
          Remplace les 3 anciens bandeaux Early Launch / multi-pays / essai. */}
      <section className="promo-launch promo-launch--top reveal" aria-label="Offre de lancement">
        <div className="promo-launch-inner">
          <span className="promo-launch-pill">
            <span className="promo-launch-pill-icon">🚀</span>
            OFFRE EXCLUSIVE
          </span>

          <div className="promo-launch-grid">
            <div className="promo-launch-left">
              <h2 className="promo-launch-title">
                Conditions tarifaires <span className="promo-launch-accent">privilégiées</span><br />
                réservées aux <span className="promo-launch-num">10</span> premières entreprises partenaires.
              </h2>
              <p className="promo-launch-sub">
                <span className="promo-launch-sub-hl">1 mois offert</span> • activation immédiate • sans carte bancaire requise.
              </p>
            </div>

            <aside className="promo-launch-right" aria-label="Conditions pour les autres entreprises">
              <div className="promo-launch-right-head">POUR TOUTES LES AUTRES ENTREPRISES</div>
              <ul className="promo-launch-features">
                <li>
                  <div className="plf-icon">🎁</div>
                  <div className="plf-text">
                    <strong>1 mois d'essai <span className="plf-yellow">GRATUIT</span></strong>
                    <span>sans carte bancaire, sans engagement</span>
                  </div>
                </li>
                <li>
                  <div className="plf-icon">💳</div>
                  <div className="plf-text">
                    <strong>Sans carte bancaire</strong>
                    <span>Aucune donnée bancaire demandée</span>
                  </div>
                </li>
                <li>
                  <div className="plf-icon">📅</div>
                  <div className="plf-text">
                    <strong>Sans engagement</strong>
                    <span>Vous décidez après l'essai</span>
                  </div>
                </li>
              </ul>
            </aside>
          </div>

          <button type="button" className="promo-launch-cta" onClick={scrollToAuth}>
            <span className="promo-launch-cta-icon">🚀</span>
            J'en profite maintenant
            <span className="promo-launch-cta-arrow">→</span>
          </button>

          <div className="promo-launch-trust">
            <span><span className="plt-icon">🛡</span> Sécurisé &amp; conforme RGPD</span>
            <span><span className="plt-icon">🎧</span> Support réactif</span>
            <span><span className="plt-icon">⚡</span> Mise en place rapide</span>
          </div>
        </div>
      </section>

      {/* HERO — sobre depuis que les bandeaux promo sont consolidés dans la
          bannière au-dessus : titre + sous-titre + CTAs + indicateurs de
          confiance + preview dashboard. */}
      <section className="hero">
        <h1 className="hero-title">
          Le pointage et la gestion<br />du temps <span className="accent">simplifiés</span>
        </h1>
        <p className="hero-sub">
          Pointeuses biométriques, application mobile, gestion des congés, autorisations de sortie et préparation paie — tout centralisé dans une seule plateforme sécurisée.
        </p>
        <div className="hero-cta-row">
          <button type="button" className="btn-hero-primary" onClick={goToSignup}>
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

        {/* DASHBOARD PREVIEW */}
        <div className="hero-visual">
          <div className="float-badge fb-tl">
            <div className="green-dot" />
            <div className="fb-info">
              <div className="fb-title">178 collaborateurs présents</div>
              <div className="fb-sub">Mise à jour il y a 2 min</div>
            </div>
          </div>
          <div className="dashboard-frame">
            <div className="dashboard-bar">
              <div className="dot dot-red" />
              <div className="dot dot-yellow" />
              <div className="dot dot-green" />
              <div className="url-bar">acme.concorde-work-force.com/dashboard</div>
            </div>
            <div className="dashboard-content">
              <div className="dash-sidebar">
                <div style={{ fontSize: '10.5px', color: 'var(--hp-outline)', letterSpacing: '.06em', textTransform: 'uppercase', padding: '6px 12px 12px', fontWeight: 700 }}>Menu</div>
                <div className="dash-nav-item active"><span className="dash-nav-icon">⌂</span> Tableau de bord</div>
                <div className="dash-nav-item"><span className="dash-nav-icon">⏱</span> Pointage</div>
                <div className="dash-nav-item"><span className="dash-nav-icon">▤</span> Planning</div>
                <div className="dash-nav-item"><span className="dash-nav-icon">☷</span> Congés & Absences</div>
                <div className="dash-nav-item"><span className="dash-nav-icon">⊞</span> Collaborateurs</div>
                <div className="dash-nav-item"><span className="dash-nav-icon">▦</span> Contrats</div>
                <div className="dash-nav-item"><span className="dash-nav-icon">⊟</span> Rapports</div>
                <div style={{ height: 14 }} />
                <div className="dash-nav-item"><span className="dash-nav-icon">⚙</span> Paramètres</div>
              </div>
              <div className="dash-main">
                <div className="dash-row">
                  <div className="kpi-card">
                    <div className="kpi-label">Présents</div>
                    <div className="kpi-val primary">178</div>
                    <div className="kpi-change">↑ +12 vs hier</div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-label">Absences</div>
                    <div className="kpi-val green">4,2%</div>
                    <div className="kpi-change">↓ −2,1% ce mois</div>
                  </div>
                  <div className="kpi-card">
                    <div className="kpi-label">H. supp</div>
                    <div className="kpi-val blue">142h</div>
                    <div className="kpi-change">↑ +18h vs S−1</div>
                  </div>
                </div>
                <div className="dash-chart">
                  <div className="chart-title">Présence hebdomadaire · 4 dernières semaines</div>
                  <div className="chart-bars">
                    <div className="bar-wrap"><div className="bar" style={{ height: 52 }} /><div className="bar-label">S−4</div></div>
                    <div className="bar-wrap"><div className="bar" style={{ height: 62 }} /><div className="bar-label">S−3</div></div>
                    <div className="bar-wrap"><div className="bar filled" style={{ height: 48 }} /><div className="bar-label">S−2</div></div>
                    <div className="bar-wrap"><div className="bar filled" style={{ height: 68 }} /><div className="bar-label">S−1</div></div>
                    <div className="bar-wrap"><div className="bar filled" style={{ height: 74 }} /><div className="bar-label">Cette S.</div></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

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

      {/* FEATURES */}
      <section id="features">
        <div className="section-tag">Fonctionnalités</div>
        <h2 className="section-title">Tout ce dont vous avez besoin, <span className="accent">dans une seule plateforme</span></h2>
        <p className="section-sub">Conçu pour les équipes terrain, les multi-sites et les marchés africains et européens.</p>
        <div className="features-grid reveal">
          <div className="feature-card">
            <div className="feature-icon">⏱</div>
            <div className="feature-title">Pointage intelligent</div>
            <div className="feature-desc">Application mobile avec géolocalisation, pointeuses biométriques compatibles, et synchronisation automatique. Fonctionne même sans connexion stable.</div>
            <div className="feature-tags">
              <span className="ftag">Mobile iOS / Android</span>
              <span className="ftag">Géolocalisation</span>
              <span className="ftag">Multi-sites</span>
            </div>
          </div>
          <div className="feature-card">
            <div className="feature-icon green-icon">☷</div>
            <div className="feature-title">Congés & Autorisations</div>
            <div className="feature-desc">Demandes de congés et autorisations de sortie validées en un clic. Notifications push aux managers, calendrier équipe partagé et soldes mis à jour automatiquement.</div>
            <div className="feature-tags">
              <span className="ftag">Validation en 1 clic</span>
              <span className="ftag">Notifications push</span>
              <span className="ftag">Calendrier équipe</span>
            </div>
          </div>
          <div className="feature-card">
            <div className="feature-icon blue-icon">▦</div>
            <div className="feature-title">Contrats & Coffre numérique</div>
            <div className="feature-desc">Générez, faites signer électroniquement et archivez vos contrats. Coffre-fort numérique sécurisé par collaborateur. Conformité droit du travail.</div>
            <div className="feature-tags">
              <span className="ftag">Signature électronique</span>
              <span className="ftag">Coffre RGPD</span>
              <span className="ftag">Multi-pays</span>
            </div>
          </div>
          <div className="feature-card large">
            <div className="feature-large-grid">
              <div>
                <div className="feature-icon">📊</div>
                <div className="feature-title">Préparation paie & Reporting</div>
                <div className="feature-desc">Heures supplémentaires, retards, pauses, RTT : tout est consolidé pour la paie. Tableaux de bord temps réel par site, département ou équipe. Exports PDF/Excel en un clic.</div>
                <div className="feature-tags">
                  <span className="ftag">Préparation paie</span>
                  <span className="ftag">Heures supp / RTT</span>
                  <span className="ftag">Export PDF/Excel</span>
                  <span className="ftag">Temps réel</span>
                </div>
              </div>
              <div className="feature-results-box">
                <div className="feature-results-title">Résultats clients</div>
                <div className="feature-results">
                  <div>
                    <div className="feature-result-row"><span>Réduction absentéisme</span><span className="v-green">−34%</span></div>
                    <div className="feature-result-bar"><div className="feature-result-fill fill-green" style={{ width: '66%' }} /></div>
                  </div>
                  <div>
                    <div className="feature-result-row"><span>Temps admin économisé</span><span className="v-primary">−9h/sem</span></div>
                    <div className="feature-result-bar"><div className="feature-result-fill fill-primary" style={{ width: '78%' }} /></div>
                  </div>
                  <div>
                    <div className="feature-result-row"><span>Adoption mobile J+21</span><span className="v-blue">85%</span></div>
                    <div className="feature-result-bar"><div className="feature-result-fill fill-blue" style={{ width: '85%' }} /></div>
                  </div>
                  <div>
                    <div className="feature-result-row"><span>Satisfaction RH (NPS)</span><span className="v-green">+42 pts</span></div>
                    <div className="feature-result-bar"><div className="feature-result-fill fill-green" style={{ width: '72%' }} /></div>
                  </div>
                </div>
              </div>
            </div>
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
          <div className="step-visual">
            {activeStep === 0 && (
              <div className="step-illustration">
                <div className="step-illus-icon">🏢</div>
                <div className="step-illus-title">Inscription en 5 minutes</div>
                <div className="step-illus-desc">Saisissez votre SIRET, choisissez votre pays. Vérification automatique du registre officiel (Sirene, BCE, ICE, NINEA).</div>
                <div className="step-chips">
                  <span className="step-chip">🇫🇷 France</span>
                  <span className="step-chip">🇧🇪 Belgique</span>
                  <span className="step-chip">🇲🇦 Maroc</span>
                  <span className="step-chip">🇸🇳 Sénégal</span>
                </div>
              </div>
            )}
            {activeStep === 1 && (
              <div className="step-illustration">
                <div className="step-illus-icon">⊞</div>
                <div className="step-illus-title">Import en 1 clic</div>
                <div className="step-illus-desc">Glissez votre fichier CSV — vos 500 collaborateurs sont importés en 30 secondes.</div>
                <div className="mini-profile">
                  <div className="avatar">KB</div>
                  <div>
                    <div className="mini-name">Khaled Benali · Directeur Opérations</div>
                    <div className="mini-role">Site Casablanca · 220 collaborateurs</div>
                  </div>
                </div>
              </div>
            )}
            {activeStep === 2 && (
              <div className="step-illustration">
                <div className="step-illus-icon">📱</div>
                <div className="step-illus-title">Mobile-first</div>
                <div className="step-illus-desc">iOS · Android · Mode offline · Géolocalisation optionnelle · Pointeuses biométriques compatibles</div>
                <div className="step-stores">
                  <a className="step-store" href="/download" target="_blank" rel="noreferrer">↓ App Store</a>
                  <a className="step-store" href="/download" target="_blank" rel="noreferrer">↓ Google Play</a>
                </div>
                <div className="step-store-url">
                  ou téléchargez l'APK depuis <a href="/download"><strong>concordeworkly.com</strong></a>
                </div>
              </div>
            )}
            {activeStep === 3 && (
              <div className="step-illustration">
                <div className="step-illus-icon">📊</div>
                <div className="step-illus-title">ROI mesurable à J+30</div>
                <div className="step-illus-desc">Tableaux de bord temps réel, préparation paie automatisée, alertes sur les anomalies.</div>
                <div className="mini-profile">
                  <div className="avatar tertiary">€</div>
                  <div>
                    <div className="mini-name">Économies estimées : 41 000 €/an</div>
                    <div className="mini-role">Calculées sur vos données réelles</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* VERTICALS */}
      <section id="secteurs">
        <div className="section-tag">Secteurs</div>
        <h2 className="section-title">Conçu pour <span className="accent">votre secteur</span></h2>
        <p className="section-sub">Pas une solution généraliste. Une plateforme spécialisée pour chaque réalité terrain.</p>
        <div className="verticals-grid reveal">
          <div className="vertical-card">
            <div className="vertical-emoji">🏭</div>
            <div className="vertical-title">Industrie</div>
            <div className="vertical-sub">Usines, agroalimentaire, textile, pharmaceutique, automobile</div>
            <div className="vertical-results">
              <div className="vr-item"><span className="vr-check">✓</span> Pointage multi-shifts et multi-sites</div>
              <div className="vr-item"><span className="vr-check">✓</span> Gestion automatique des heures supplémentaires</div>
              <div className="vr-item"><span className="vr-check">✓</span> Traçabilité légale pour audits qualité</div>
              <div className="vr-item"><span className="vr-check">✓</span> Mode offline pour zones sans WiFi</div>
            </div>
            <div className="vertical-accent">Absentéisme −34%</div>
          </div>
          <div className="vertical-card">
            <div className="vertical-emoji">🏪</div>
            <div className="vertical-title">Retail</div>
            <div className="vertical-sub">Grande distribution, franchises, pharmacies, cosmétique</div>
            <div className="vertical-results">
              <div className="vr-item"><span className="vr-check">✓</span> Comparaison performance entre points de vente</div>
              <div className="vr-item"><span className="vr-check">✓</span> Planning centralisé validé par la DRH</div>
              <div className="vr-item"><span className="vr-check">✓</span> Uniformisation des process réseau</div>
              <div className="vr-item"><span className="vr-check">✓</span> Contrats multi-types (CDI/CDD/temps partiel)</div>
            </div>
            <div className="vertical-accent">Erreurs planning −32%</div>
          </div>
          <div className="vertical-card">
            <div className="vertical-emoji">🛡️</div>
            <div className="vertical-title">Services</div>
            <div className="vertical-sub">Centres d'appels, BPO, sécurité, nettoyage, IT services</div>
            <div className="vertical-results">
              <div className="vr-item"><span className="vr-check">✓</span> Scalabilité sans admin supplémentaire</div>
              <div className="vr-item"><span className="vr-check">✓</span> Gestion du turnover et onboarding rapide</div>
              <div className="vr-item"><span className="vr-check">✓</span> Productivité par collaborateur mesurable</div>
              <div className="vr-item"><span className="vr-check">✓</span> Contrats multiples centralisés</div>
            </div>
            <div className="vertical-accent green-tag">Capacité ×3 sans recruter</div>
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
              ✦ Conditions tarifaires privilégiées
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
          <button type="button" className={`toggle-btn${!monthly ? ' active' : ''}`} onClick={() => setBillingCycle('annual')}>Annuel</button>
        </div>
        <div className="pricing-grid reveal">
          {/* Starter */}
          <div className="price-card">
            <div className="price-tier">Starter</div>
            <div className="price-amount">
              <span className="currency">€</span>{prices.starter}<span className="period">{pricePeriod}</span>
            </div>
            <div className="price-included">10 collaborateurs inclus · 10 Go de stockage</div>
            <div className="price-per">+ 4,90 € / collaborateur supplémentaire · jusqu'à 25 max · {priceCommitmentLabel}</div>
            <div className="price-desc">Pour les TPE et startups qui démarrent la digitalisation RH d'une petite équipe.</div>
            <div className="price-features">
              {(() => {
                const features = [
                  { type: 'check', text: '1 mois gratuit sans carte bancaire' },
                  { type: 'check', text: 'Pointage web simple' },
                  { type: 'check', text: 'Gestion RH basique (fiches, contrats)' },
                  { type: 'check', text: 'Absences & dashboard basique' },
                  { type: 'check', text: '1 administrateur · support standard' },
                  { type: 'x', text: 'Application mobile' },
                  { type: 'x', text: 'Coffre numérique' },
                  { type: 'x', text: 'Export paie' },
                ];
                const expanded = expandedPacks.starter;
                const visible = expanded ? features : features.slice(0, KEY_FEATURE_LIMIT);
                return (
                  <>
                    {visible.map((f, i) => (
                      <div key={i} className="pf-item">
                        {f.type === 'check'
                          ? <><span className="pf-check">✓</span> {f.text}</>
                          : <><span className="pf-x">✕</span> <span className="pf-muted">{f.text}</span></>}
                      </div>
                    ))}
                    {features.length > KEY_FEATURE_LIMIT && (
                      <button type="button" onClick={() => togglePack('starter')} aria-expanded={expanded}
                        style={{ background: 'none', border: 'none', padding: 0, marginTop: 6,
                          color: '#0040a1', fontWeight: 700, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
                        {expanded ? 'Réduire ↑' : `Lire la suite (+${features.length - KEY_FEATURE_LIMIT}) ↓`}
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
            <button type="button" className="btn-plan btn-plan-ghost" onClick={() => goToPlanConfig('Starter')}>Choisir Starter</button>
          </div>
          {/* Standard */}
          <div className="price-card featured">
            <div className="popular-badge">⭐ Le plus populaire</div>
            <div className="price-tier">Standard</div>
            <div className="price-amount">
              <span className="currency">€</span>{prices.standard}<span className="period">{pricePeriod}</span>
            </div>
            <div className="price-included">25 collaborateurs inclus · 50 Go de stockage</div>
            <div className="price-per">+ 6,90 € / collaborateur supplémentaire · jusqu'à 100 max · {priceCommitmentLabel}</div>
            <div className="price-desc">Suite complète mobile + paie pour les PME en croissance et équipes structurées.</div>
            <div className="price-features">
              {(() => {
                const features = [
                  '1 mois gratuit sans carte bancaire',
                  'Application mobile + géolocalisation',
                  'Coffre numérique & signature électronique',
                  'Préparation paie · export paie',
                  'Tout le plan Starter',
                  'Congés, RTT, CET, sanctions',
                  'Notifications push / email · Reporting avancé',
                  'Multi-sites simple · Support prioritaire',
                ];
                const expanded = expandedPacks.standard;
                const visible = expanded ? features : features.slice(0, KEY_FEATURE_LIMIT);
                return (
                  <>
                    {visible.map((f, i) => (
                      <div key={i} className="pf-item"><span className="pf-check">✓</span> {f}</div>
                    ))}
                    {features.length > KEY_FEATURE_LIMIT && (
                      <button type="button" onClick={() => togglePack('standard')} aria-expanded={expanded}
                        style={{ background: 'none', border: 'none', padding: 0, marginTop: 6,
                          color: '#0040a1', fontWeight: 700, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
                        {expanded ? 'Réduire ↑' : `Lire la suite (+${features.length - KEY_FEATURE_LIMIT}) ↓`}
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
            <button type="button" className="btn-plan btn-plan-primary" onClick={() => goToPlanConfig('Standard')}>Choisir Standard</button>
          </div>
          {/* Premium — cadre + accents or (#d4af37) pour signaler le positionnement
              haut de gamme. Le titre et les chips de prix sont colorés en or foncé,
              et le bouton "Choisir Premium" est en gradient or pour conclure
              visuellement l'identité premium de cette colonne. */}
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
            }}>
              ★ Haut de gamme
            </div>
            <div className="price-tier" style={{ color: '#b8860b' }}>Business</div>
            <div className="price-amount" style={{ color: '#92670a' }}>
              <span className="currency">€</span>{prices.premium}<span className="period" style={{ color: '#b8860b' }}>{pricePeriod}</span>
            </div>
            <div className="price-included">50 collaborateurs inclus · 200 Go de stockage</div>
            <div className="price-per">+ 9,90 € / collaborateur supplémentaire · jusqu'à 250 max · {priceCommitmentLabel}</div>
            <div className="price-desc">Multi-filiales, IA contextuelle et sécurité renforcée pour les grandes structures.</div>
            <div className="price-features">
              {(() => {
                const features = [
                  'Multi-filiales illimité · dashboards avancés',
                  'Assistant IA contextuel (RAG)',
                  'Sécurité mobile renforcée · device trust',
                  'Audit logs avancés · branding personnalisé',
                  '1 mois gratuit sans carte bancaire',
                  'Tout le plan Standard',
                  'Screenshot blocking · cert pinning',
                  'Conformité RGPD avancée · SLA premium',
                  'Onboarding accompagné · futures intégrations SSO',
                ];
                const expanded = expandedPacks.premium;
                const visible = expanded ? features : features.slice(0, KEY_FEATURE_LIMIT);
                return (
                  <>
                    {visible.map((f, i) => (
                      <div key={i} className="pf-item"><span className="pf-check" style={{ color: '#b8860b' }}>✓</span> {f}</div>
                    ))}
                    {features.length > KEY_FEATURE_LIMIT && (
                      <button type="button" onClick={() => togglePack('premium')} aria-expanded={expanded}
                        style={{ background: 'none', border: 'none', padding: 0, marginTop: 6,
                          color: '#b8860b', fontWeight: 700, fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
                        {expanded ? 'Réduire ↑' : `Lire la suite (+${features.length - KEY_FEATURE_LIMIT}) ↓`}
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
            <button
              type="button"
              className="btn-plan"
              onClick={() => goToPlanConfig('Premium')}
              style={{
                background: 'linear-gradient(135deg, #d4af37 0%, #b8860b 100%)',
                color: '#fff',
                border: 'none',
                fontWeight: 800,
                boxShadow: '0 6px 18px rgba(184,134,11,0.32)',
              }}
            >
              Choisir Business
            </button>
          </div>
        </div>
        <div className="pricing-footnote">
          Sans engagement de durée · TVA en sus · Facturation Stripe sécurisée
        </div>

        {/* Modules optionnels — IA & stockage. Ces extras se cumulent avec n'importe
            quel pack (sauf mention contraire) et sont configurés depuis l'écran
            « Plan & Configuration » après inscription. */}
        <div className="addons-header">
          <h3 className="addons-title">Modules optionnels</h3>
          <p className="addons-sub">À ajouter à n'importe quel pack pour étendre les capacités IA et stockage.</p>
        </div>
        <div className="pricing-grid reveal addons-grid">
          {/* IA Assistant RH */}
          <div className="price-card addon-card">
            <div className="price-tier">IA Assistant RH</div>
            <div className="price-amount">
              <span className="period" style={{ fontSize: 18, fontWeight: 700, color: '#0040a1' }}>à partir de</span><br />
              <span className="currency">€</span>49<span className="period">{pricePeriod}</span>
            </div>
            <div className="price-included">Assistant intelligent au quotidien</div>
            <div className="price-desc">Aide à la rédaction, recherche rapide, automatisations simples pour vos équipes RH.</div>
            <div className="price-features">
              <div className="pf-item"><span className="pf-check">✓</span> Assistant RH intelligent</div>
              <div className="pf-item"><span className="pf-check">✓</span> Aide à la rédaction de documents</div>
              <div className="pf-item"><span className="pf-check">✓</span> Recherche rapide multi-sources</div>
              <div className="pf-item"><span className="pf-check">✓</span> Assistance opérationnelle</div>
              <div className="pf-item"><span className="pf-check">✓</span> Automatisations simples</div>
              <div className="pf-item pf-warn"><span className="pf-x">⚠</span> <span className="pf-muted">Quotas selon usage</span></div>
            </div>
          </div>

          {/* IA / RAG avancé */}
          <div className="price-card addon-card">
            <div className="price-tier">IA / RAG Avancé</div>
            <div className="price-amount">
              <span className="currency" style={{ fontSize: 28 }}>Sur devis</span>
            </div>
            <div className="price-included">Exploitation documentaire avancée</div>
            <div className="price-desc">Recherche documentaire intelligente, embeddings et analyses avancées sur vos archives.</div>
            <div className="price-features">
              <div className="pf-item"><span className="pf-check">✓</span> Recherche documentaire intelligente</div>
              <div className="pf-item"><span className="pf-check">✓</span> Analyse avancée des contenus</div>
              <div className="pf-item"><span className="pf-check">✓</span> Embeddings vectoriels</div>
              <div className="pf-item"><span className="pf-check">✓</span> Assistant intelligent avancé</div>
              <div className="pf-item"><span className="pf-check">✓</span> Exploitation documentaire interne</div>
              <div className="pf-item pf-warn"><span className="pf-x">⚠</span> <span className="pf-muted">Quotas et limitations selon usage</span></div>
            </div>
          </div>

          {/* Stockage supplémentaire */}
          <div className="price-card addon-card">
            <div className="price-tier">Stockage supplémentaire</div>
            <div className="price-amount">
              <span className="currency">+€</span>29<span className="period"> / 100 Go HT</span>
            </div>
            <div className="price-included">Extension de votre quota</div>
            <div className="price-desc">Coffre numérique, documents salariés, exports archivés — au-delà du quota inclus dans votre pack.</div>
            <div className="price-features">
              <div className="pf-item"><span className="pf-check">✓</span> Tranche de 100 Go supplémentaires</div>
              <div className="pf-item"><span className="pf-check">✓</span> Cumulable avec tout pack</div>
              <div className="pf-item"><span className="pf-check">✓</span> Activation immédiate</div>
              <div className="pf-item"><span className="pf-check">✓</span> Facturation mensuelle</div>
              <div className="pf-item"><span className="pf-check">✓</span> Données chiffrées au repos</div>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section id="temoignages">
        <div className="section-tag">Témoignages</div>
        <h2 className="section-title">Ce que disent nos <span className="accent">clients</span></h2>
        <div className="testimonials-grid reveal">
          <div className="testi-card">
            <div className="testi-stars">★★★★★</div>
            <div className="testi-text">« Je peux enfin piloter avec des chiffres fiables. Avant, je découvrais les problèmes après coup. Maintenant, je les vois arriver. Le déploiement sur 3 sites a pris 11 jours. »</div>
            <div className="testi-author">
              <div className="testi-avatar av1">LM</div>
              <div>
                <div className="testi-name">Laurent M.</div>
                <div className="testi-role">Directeur Opérations · Agroalimentaire 🇫🇷</div>
                <div className="testi-result">↓ Absentéisme −34% en 8 semaines</div>
              </div>
            </div>
          </div>
          <div className="testi-card">
            <div className="testi-stars">★★★★★</div>
            <div className="testi-text">« Plus aucune modification de planning non autorisée. Je compare mes 14 magasins en 1 clic. L'outil a transformé notre façon de gérer le réseau. »</div>
            <div className="testi-author">
              <div className="testi-avatar av2">SB</div>
              <div>
                <div className="testi-name">Sophie B.</div>
                <div className="testi-role">DRH Réseau · Grande distribution 🇫🇷</div>
                <div className="testi-result">↓ Erreurs planning −32% en 6 semaines</div>
              </div>
            </div>
          </div>
          <div className="testi-card">
            <div className="testi-stars">★★★★★</div>
            <div className="testi-text">« On a doublé nos effectifs sans recruter un seul admin RH supplémentaire. La plateforme absorbe la croissance automatiquement. ROI évident dès le premier mois. »</div>
            <div className="testi-author">
              <div className="testi-avatar av3">TD</div>
              <div>
                <div className="testi-name">Thomas D.</div>
                <div className="testi-role">CEO · Centre d'appels 🇫🇷</div>
                <div className="testi-result">↑ Capacité ×2 sans admin supplémentaire</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AUTH */}
      <section ref={authSectionRef} className="auth-section">
        <div className="auth-layout">
          <div className="auth-benefits">
            <div>
              <div className="section-tag">Rejoindre Concorde Workforce</div>
              <h2 className="section-title">Commencez en <span className="accent">5 minutes</span></h2>
              <p className="section-sub">Créez votre compte, importez vos équipes, et obtenez vos premiers résultats en 2 semaines.</p>
            </div>
            <div>
              <div className="benefit-item">
                <div className="benefit-icon">⚡</div>
                <div>
                  <div className="benefit-title">Déploiement express</div>
                  <div className="benefit-desc">Import CSV de vos collaborateurs, paramétrage guidé, et votre équipe est opérationnelle en 2 semaines. Sans technicien.</div>
                </div>
              </div>
              <div className="benefit-item">
                <div className="benefit-icon green">🔒</div>
                <div>
                  <div className="benefit-title">Conformité & sécurité</div>
                  <div className="benefit-desc">Hébergement France, chiffrement AES-256, audit logs RGPD complets. DPA disponible. Conformité droit du travail FR / BE / MA / SN.</div>
                </div>
              </div>
              <div className="benefit-item">
                <div className="benefit-icon">🌍</div>
                <div>
                  <div className="benefit-title">Conçu pour votre marché</div>
                  <div className="benefit-desc">Support francophone humain, conformité locale (RGPD, droit du travail FR/BE/MA/SN), mode offline — pensé pour l'Afrique et l'Europe francophone.</div>
                </div>
              </div>
            </div>
          </div>
          <InlineAuthCard presetPlan={presetPlan} presetNonce={presetNonce} />
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
          <button type="button" className="btn-cta-light" onClick={goToSignup}>
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
              La plateforme RH & pointage conçue pour les équipes terrain en Afrique francophone et en Europe. Contrôle, conformité, sérénité.
            </div>
            <div className="footer-flags">🇫🇷 🇧🇪 🇲🇦 🇸🇳</div>
          </div>
          <div className="footer-col">
            <h4>Produit</h4>
            <div className="footer-links">
              <a href="#features">Fonctionnalités</a>
              <a href="#pricing">Tarifs</a>
              <a href="#how">Démo</a>
              <a href="#download">Application mobile</a>
              <a href="/download">concordeworkly.com</a>
              <a href="#temoignages">Cas clients</a>
            </div>
          </div>
          <div className="footer-col">
            <h4>Secteurs</h4>
            <div className="footer-links">
              <a href="#secteurs">Industrie</a>
              <a href="#secteurs">Retail</a>
              <a href="#secteurs">Services</a>
              <a href="#secteurs">BPO</a>
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
            <a>Confidentialité</a>
            <a>CGU</a>
            <a>Mentions légales</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
