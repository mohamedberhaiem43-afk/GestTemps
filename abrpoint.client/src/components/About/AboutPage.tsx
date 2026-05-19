import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();

  // Les piliers fonctionnels affichés en grille. Chaque entrée référence un sous-arbre i18n
  // (about.pillars.<id>.{title,text}) — l'icône Material reste codée en dur car elle ne se traduit pas.
  const pillars: Array<{ id: 'punch' | 'leave' | 'schedule' | 'reporting' | 'secure' | 'multi'; icon: string }> = [
    { id: 'punch', icon: 'fingerprint' },
    { id: 'leave', icon: 'event_available' },
    { id: 'schedule', icon: 'schedule' },
    { id: 'reporting', icon: 'analytics' },
    { id: 'secure', icon: 'verified_user' },
    { id: 'multi', icon: 'apartment' },
  ];

  return (
    <div className="pricing-container min-h-screen bg-surface text-on-surface font-body">
      {/* TopNavBar — variante simplifiée et cohérente avec PricingPage. */}
      <nav className="w-full top-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md sticky z-50 border-b border-surface-container">
        <div className="flex justify-between items-center max-w-7xl mx-auto px-8 py-4">
          <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => navigate('/')}>
            <img src="/concorde-wrokly-logo.jpg" alt="Logo" style={{ height: 64, width: 'auto', objectFit: 'contain' }} />
          </div>
          <div className="hidden md:flex items-center gap-8">
            <button
              type="button"
              className="text-on-surface-variant font-medium hover:text-primary transition-colors text-xs tracking-wider uppercase"
              onClick={() => navigate('/')}
            >
              {t('about.nav.pricing')}
            </button>
            <span className="text-primary border-b-2 border-primary pb-1 text-xs tracking-wider uppercase font-bold">
              {t('about.nav.current')}
            </span>
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <button
                className="bg-primary text-white px-6 py-2.5 rounded-xl font-bold text-xs tracking-wider uppercase shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
                onClick={() => navigate('/dashboard')}
              >
                {t('about.nav.myDashboard')}
              </button>
            ) : (
              <>
                <button
                  className="text-on-surface-variant font-bold text-xs tracking-wider uppercase hover:text-primary transition-colors px-4 py-2"
                  onClick={() => navigate('/login')}
                >
                  {t('about.nav.login')}
                </button>
                <button
                  className="bg-primary text-white px-6 py-2.5 rounded-xl font-bold text-xs tracking-wider uppercase shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
                  onClick={() => navigate('/signup')}
                >
                  {t('about.nav.freeTrial')}
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="pt-20 pb-12 px-8 max-w-5xl mx-auto text-center">
        <span className="text-xs font-black uppercase tracking-[0.2em] text-primary mb-4 block">{t('about.hero.kicker')}</span>
        <h1 className="text-4xl md:text-6xl font-extrabold font-headline tracking-tight text-on-surface mb-6 leading-tight">
          {t('about.hero.title1')} <br className="hidden md:block" /> {t('about.hero.title2')}
        </h1>
        <p className="text-on-surface-variant text-lg max-w-3xl mx-auto mb-2 font-body leading-relaxed">
          {t('about.hero.lead')}
        </p>
        <p className="text-on-surface-variant text-lg max-w-3xl mx-auto font-body leading-relaxed">
          {t('about.hero.leadIntro', 'Elle ')}
          <strong className="text-on-surface">{t('about.hero.leadStrong')}</strong>
          {t('about.hero.leadEnd')}
        </p>
      </header>

      {/* Piliers fonctionnels */}
      <main className="max-w-7xl mx-auto px-8 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pillars.map((p) => (
            <div
              key={p.id}
              className="bg-white rounded-2xl p-8 border border-surface-container-high hover:shadow-xl hover:-translate-y-1 transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-primary-fixed flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {p.icon}
                </span>
              </div>
              <h3 className="text-xl font-extrabold font-headline mb-2 text-on-surface">{t(`about.pillars.${p.id}.title`)}</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed">{t(`about.pillars.${p.id}.text`)}</p>
            </div>
          ))}
        </div>

        {/* Vision */}
        <section className="mt-16 bg-surface-container-low rounded-2xl p-10 md:p-14 border border-surface-container">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
            <div>
              <span className="text-xs font-black uppercase tracking-[0.2em] text-primary mb-3 block">{t('about.vision.approachKicker')}</span>
              <h2 className="text-3xl md:text-4xl font-extrabold font-headline mb-6 leading-tight">
                {t('about.vision.approachTitle')}
              </h2>
              <p className="text-on-surface-variant leading-relaxed">
                {t('about.vision.approachText')}
              </p>
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-[0.2em] text-primary mb-3 block">{t('about.vision.tenantKicker')}</span>
              <h2 className="text-3xl md:text-4xl font-extrabold font-headline mb-6 leading-tight">
                {t('about.vision.tenantTitle')}
              </h2>
              <p className="text-on-surface-variant leading-relaxed">
                {t('about.vision.tenantText')}
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mt-16 text-center">
          <h2 className="text-2xl md:text-3xl font-extrabold font-headline mb-4">{t('about.cta.title')}</h2>
          <p className="text-on-surface-variant mb-8 max-w-xl mx-auto">
            {t('about.cta.subtitle')}
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button
              className="bg-primary text-white px-8 py-3 rounded-xl font-bold text-sm uppercase tracking-wider shadow-lg hover:brightness-110 transition-all"
              onClick={() => navigate(isAuthenticated ? '/dashboard' : '/signup')}
            >
              {isAuthenticated ? t('about.cta.goDashboard') : t('about.cta.startTrial')}
            </button>
            <button
              className="bg-surface-container-high text-on-surface px-8 py-3 rounded-xl font-bold text-sm uppercase tracking-wider hover:bg-surface-dim transition-all"
              onClick={() => navigate('/')}
            >
              {t('about.cta.viewPricing')}
            </button>
          </div>
        </section>
      </main>

      {/* Footer minimal — la page partage la même identité visuelle que /. */}
      <footer className="w-full border-t border-surface-container bg-white py-12">
        <div className="max-w-7xl mx-auto px-8 flex items-center justify-between text-on-surface-variant">
          <div className="flex items-center gap-3">
            <img src="/concorde-wrokly-logo.jpg" alt="Logo Concorde" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
            <span className="text-sm font-bold uppercase tracking-tight">{t('about.footer.brand')}</span>
          </div>
          <span className="text-xs font-medium">{t('about.footer.rights', { year: new Date().getFullYear() })}</span>
        </div>
      </footer>
    </div>
  );
}

export default AboutPage;
