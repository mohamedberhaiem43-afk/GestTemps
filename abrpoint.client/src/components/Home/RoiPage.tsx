import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import RoiCalculator from './RoiCalculator';
import PageSeo from '../helper/PageSeo';

/**
 * RoiPage — page publique dédiée au calculateur de ROI (route /roi, /en/roi).
 *
 * Le calculateur vit sur sa propre URL (partageable, indexable). Depuis la
 * refonte « diagnostic façon formulaire » (cf. RoiCalculator), le composant est
 * autonome : il porte son propre parcours en 5 questions, sa porte e-mail et son
 * écran de résultat avec CTA démo (les deux envoient un lead via /api/contact/sales).
 * RoiPage ne fournit donc plus que le bandeau « retour accueil » + le SEO.
 * Bilingue FR/EN via i18n.language.
 */

const LOGO_SRC = '/concorde-workly-light.jpg';
type Lang = 'fr' | 'en';

const TXT = {
  fr: { back: "← Retour à l'accueil" },
  en: { back: '← Back to home' },
} as const;

const RoiPage: React.FC = () => {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const lang: Lang = i18n.language === 'en' ? 'en' : 'fr';
  const tx = TXT[lang];
  const homeHref = lang === 'en' ? '/en' : '/';

  return (
    <div style={{ minHeight: '100vh', background: '#F4F7FC', display: 'flex', flexDirection: 'column' }}>
      <PageSeo
        title={lang === 'en'
          ? 'ROI Calculator – Concorde Workforce'
          : 'Calculateur ROI – Concorde Workforce'}
        description={lang === 'en'
          ? 'Estimate in seconds how much your manual HR management costs — and what you could save with Concorde Workforce.'
          : 'Estimez en quelques secondes ce que vous coûte votre gestion RH manuelle — et ce que vous pourriez économiser avec Concorde Workforce.'}
      />

      {/* Bandeau retour accueil */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 14, padding: '14px 24px', background: '#fff',
        borderBottom: '1px solid #d4dff5',
      }}>
        <button
          type="button"
          onClick={() => navigate(homeHref)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer',
            background: 'none', border: 'none', padding: 0,
          }}
        >
          <img
            src={LOGO_SRC}
            alt="Concorde Workly"
            style={{
              width: 40, height: 40, borderRadius: 10, objectFit: 'contain',
              background: '#fff', border: '1px solid #d4dff5',
              boxShadow: '0 4px 14px rgba(0,64,161,.18)', display: 'block',
            }}
          />
          <span style={{ fontWeight: 700, color: '#0040A1', fontSize: 16 }}>Concorde Workforce</span>
        </button>
        <button
          type="button"
          onClick={() => navigate(homeHref)}
          style={{
            cursor: 'pointer', background: 'none', border: 'none',
            color: '#5a6e99', fontSize: 14, fontWeight: 600,
          }}
        >
          {tx.back}
        </button>
      </header>

      <main style={{ flex: 1 }}>
        <RoiCalculator lang={lang} />
      </main>
    </div>
  );
};

export default RoiPage;
