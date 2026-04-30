import { useNavigate } from 'react-router-dom';
import { useAuth } from '../helper/AuthProvider';

/**
 * Page « À propos » publique (route `/about`).
 *
 * Décrit ce que fait l'application Concorde Workforce. Réutilise les classes
 * Tailwind / tokens design de la PricingPage pour rester visuellement cohérent
 * (mêmes couleurs `bg-surface`, `text-on-surface`, etc.).
 *
 * Pas de gestion de paie : on insiste sur pointage / temps / congés / RH.
 */
function AboutPage() {
  const navigate = useNavigate();
  const { uticod } = useAuth();
  const isAuthenticated = Boolean(uticod);

  const pillars = [
    {
      icon: 'fingerprint',
      title: 'Pointage multi-canal',
      text: "Pointeuses biométriques, badgeuses, pointage web et mobile — toutes les sources de présence remontent dans un même registre, géo-localisé et horodaté.",
    },
    {
      icon: 'event_available',
      title: 'Congés & autorisations',
      text: "Demandes en self-service, validations en cascade par le manager, soldes calculés en temps réel et historique consultable par employé.",
    },
    {
      icon: 'schedule',
      title: 'Plannings et horaires',
      text: "Modélisation fine des classes horaires, postes de travail, jours fériés et règles d'heures supplémentaires — y compris les shifts de nuit et les régimes mixtes.",
    },
    {
      icon: 'analytics',
      title: 'Reporting RH',
      text: "États de présence, absences, retards, échéances de contrats et tableaux de bord pour les directions — exportables PDF / Excel à tout moment.",
    },
    {
      icon: 'verified_user',
      title: 'Conforme & sécurisé',
      text: "Chiffrement TLS 1.3 en transit, AES-256 au repos, traçabilité complète des accès, conformité RGPD et hébergement souverain.",
    },
    {
      icon: 'apartment',
      title: 'Multi-société, multi-site',
      text: "Une seule installation pour piloter plusieurs entités juridiques, plusieurs sites et plusieurs filiales avec leurs propres calendriers et règles métier.",
    },
  ];

  return (
    <div className="pricing-container min-h-screen bg-surface text-on-surface font-body">
      {/* TopNavBar — variante simplifiée et cohérente avec PricingPage. */}
      <nav className="w-full top-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md sticky z-50 border-b border-surface-container">
        <div className="flex justify-between items-center max-w-7xl mx-auto px-8 py-4">
          <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => navigate('/')}>
            <img src="/Concorde.png" alt="Logo Concorde" style={{ height: 64, width: 'auto', objectFit: 'contain' }} />
            <span className="text-3xl font-bold tracking-tight text-primary font-headline">Concorde</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <button
              type="button"
              className="text-on-surface-variant font-medium hover:text-primary transition-colors text-xs tracking-wider uppercase"
              onClick={() => navigate('/')}
            >
              Tarifs
            </button>
            <span className="text-primary border-b-2 border-primary pb-1 text-xs tracking-wider uppercase font-bold">
              À propos
            </span>
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
                <button
                  className="text-on-surface-variant font-bold text-xs tracking-wider uppercase hover:text-primary transition-colors px-4 py-2"
                  onClick={() => navigate('/login')}
                >
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

      {/* Hero */}
      <header className="pt-20 pb-12 px-8 max-w-5xl mx-auto text-center">
        <span className="text-xs font-black uppercase tracking-[0.2em] text-primary mb-4 block">À propos de Concorde</span>
        <h1 className="text-4xl md:text-6xl font-extrabold font-headline tracking-tight text-on-surface mb-6 leading-tight">
          La plateforme de gestion <br className="hidden md:block" /> du temps pensée pour les RH
        </h1>
        <p className="text-on-surface-variant text-lg max-w-3xl mx-auto mb-2 font-body leading-relaxed">
          Concorde Workforce est une solution SaaS qui digitalise et centralise la gestion du temps de travail :
          pointage, présence, congés, autorisations de sortie, plannings, sanctions, contrats et reporting RH.
        </p>
        <p className="text-on-surface-variant text-lg max-w-3xl mx-auto font-body leading-relaxed">
          Elle <strong className="text-on-surface">ne gère pas la paie elle-même</strong> — elle prépare les
          états mensuels exportables vers votre logiciel de paie existant.
        </p>
      </header>

      {/* Piliers fonctionnels */}
      <main className="max-w-7xl mx-auto px-8 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pillars.map((p) => (
            <div
              key={p.title}
              className="bg-white rounded-2xl p-8 border border-surface-container-high hover:shadow-xl hover:-translate-y-1 transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-primary-fixed flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {p.icon}
                </span>
              </div>
              <h3 className="text-xl font-extrabold font-headline mb-2 text-on-surface">{p.title}</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">{p.text}</p>
            </div>
          ))}
        </div>

        {/* Vision */}
        <section className="mt-16 bg-surface-container-low rounded-2xl p-10 md:p-14 border border-surface-container">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
            <div>
              <span className="text-xs font-black uppercase tracking-[0.2em] text-primary mb-3 block">Notre approche</span>
              <h2 className="text-3xl md:text-4xl font-extrabold font-headline mb-6 leading-tight">
                Des règles métier modélisables, pas figées
              </h2>
              <p className="text-on-surface-variant leading-relaxed">
                Chaque entreprise a ses propres conventions : tolérances d'arrivée, calcul d'heures supplémentaires,
                jours fériés payés ou non, panier de nuit, ancienneté requise pour certains droits…
                Concorde modélise tout ça via des paramètres société et des plannings personnalisables —
                pas de code à écrire, pas d'export à retravailler.
              </p>
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-[0.2em] text-primary mb-3 block">Multi-tenant by design</span>
              <h2 className="text-3xl md:text-4xl font-extrabold font-headline mb-6 leading-tight">
                Une instance par entreprise, isolée
              </h2>
              <p className="text-on-surface-variant leading-relaxed">
                Chaque tenant dispose de sa propre base de données, de son propre slug et de son propre
                périmètre d'accès. Aucune donnée ne croise entre clients. La provisioning est automatique
                au signup avec une période d'essai de 14 jours.
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mt-16 text-center">
          <h2 className="text-2xl md:text-3xl font-extrabold font-headline mb-4">Envie d'essayer Concorde ?</h2>
          <p className="text-on-surface-variant mb-8 max-w-xl mx-auto">
            14 jours d'essai gratuits, sans carte bancaire. Vous gardez la main sur vos données à tout moment.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button
              className="bg-primary text-white px-8 py-3 rounded-xl font-bold text-sm uppercase tracking-wider shadow-lg hover:brightness-110 transition-all"
              onClick={() => navigate(isAuthenticated ? '/dashboard' : '/signup')}
            >
              {isAuthenticated ? 'Aller au dashboard' : 'Démarrer l\'essai gratuit'}
            </button>
            <button
              className="bg-surface-container-high text-on-surface px-8 py-3 rounded-xl font-bold text-sm uppercase tracking-wider hover:bg-surface-dim transition-all"
              onClick={() => navigate('/')}
            >
              Voir les tarifs
            </button>
          </div>
        </section>
      </main>

      {/* Footer minimal — la page partage la même identité visuelle que /. */}
      <footer className="w-full border-t border-surface-container bg-white py-12">
        <div className="max-w-7xl mx-auto px-8 flex items-center justify-between text-on-surface-variant">
          <div className="flex items-center gap-3">
            <img src="/Concorde.png" alt="Logo Concorde" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
            <span className="text-sm font-bold uppercase tracking-tight">Concorde Workforce</span>
          </div>
          <span className="text-xs font-medium">© {new Date().getFullYear()} Concorde Workforce. Tous droits réservés.</span>
        </div>
      </footer>
    </div>
  );
}

export default AboutPage;
