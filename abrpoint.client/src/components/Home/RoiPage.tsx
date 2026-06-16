import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import RoiCalculator from './RoiCalculator';
import PageSeo from '../helper/PageSeo';
import { sendSalesRequest } from '../../services/ContactService';

/**
 * RoiPage — page publique dédiée au calculateur de ROI (route /roi, /en/roi).
 *
 * Le calculateur a été sorti de la HomePage pour vivre sur sa propre URL
 * (partageable, indexable). On réutilise le composant <RoiCalculator> et on
 * l'habille d'un bandeau de retour + un formulaire de demande de démo (repris
 * de la maquette « calculator ROI concorde .html ») qui envoie un e-mail à
 * postmaster@concorde-work-force.com via /api/contact/sales. L'estimation calculée est
 * jointe au message pour qualifier le lead. Bilingue FR/EN via i18n.language.
 */

const LOGO_SRC = '/concorde-workly-light.jpg';
type Lang = 'fr' | 'en';

const TXT = {
  fr: {
    back: "← Retour à l'accueil",
    ctaTitle: 'Voyez-le en action',
    ctaSub: 'Un expert Concorde Workforce vous montre comment atteindre ces économies en 30 jours — sans engagement.',
    phName: 'Prénom & Nom', phEmail: 'Email professionnel', phCompany: 'Entreprise',
    submit: 'Demander ma démo gratuite', sending: 'Envoi…',
    ok: '✓ Demande envoyée — notre équipe vous contacte sous 24h.',
    errValid: 'Merci de renseigner votre nom, un email valide et votre entreprise.',
    errSend: "L'envoi a échoué. Réessayez dans un instant.",
    estimate: 'Économie estimée via le calculateur ROI',
    perYear: '/ an',
    needsIntro: 'Demande de démo envoyée depuis le calculateur ROI.',
  },
  en: {
    back: '← Back to home',
    ctaTitle: 'See it in action',
    ctaSub: 'A Concorde Workforce expert shows you how to reach these savings in 30 days — no commitment.',
    phName: 'First & last name', phEmail: 'Work email', phCompany: 'Company',
    submit: 'Request my free demo', sending: 'Sending…',
    ok: '✓ Request sent — our team will contact you within 24h.',
    errValid: 'Please provide your name, a valid email and your company.',
    errSend: 'Sending failed. Please try again in a moment.',
    estimate: 'Estimated savings via the ROI calculator',
    perYear: '/ year',
    needsIntro: 'Demo request sent from the ROI calculator.',
  },
} as const;

const RoiPage: React.FC = () => {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const lang: Lang = i18n.language === 'en' ? 'en' : 'fr';
  const tx = TXT[lang];
  const homeHref = lang === 'en' ? '/en' : '/';

  const [estimate, setEstimate] = useState<number | null>(null);
  const handleEstimate = useCallback((eco: number | null) => setEstimate(eco), []);

  const [fname, setFname] = useState('');
  const [femail, setFemail] = useState('');
  const [fcompany, setFcompany] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errMsg, setErrMsg] = useState('');

  const emailOk = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.trim());

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'sending') return;
    const name = fname.trim();
    const email = femail.trim();
    const company = fcompany.trim();
    if (!name || !company || !emailOk(email)) {
      setStatus('error');
      setErrMsg(tx.errValid);
      return;
    }
    setStatus('sending');
    setErrMsg('');
    const needs = estimate != null
      ? `${tx.needsIntro}\n${tx.estimate} : ${estimate.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} € ${tx.perYear}`
      : tx.needsIntro;
    try {
      await sendSalesRequest({ company, contactName: name, email, headcount: '', needs });
      setStatus('sent');
    } catch {
      setStatus('error');
      setErrMsg(tx.errSend);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F7F9FB', display: 'flex', flexDirection: 'column' }}>
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
        <RoiCalculator lang={lang} onEstimate={handleEstimate} />

        {/* Formulaire de demande de démo → e-mail à postmaster@concorde-work-force.com */}
        <div className="roi-lead">
          <form className="cta-card" onSubmit={onSubmit} noValidate>
            <h3>{tx.ctaTitle}</h3>
            <p className="cta-sub">{tx.ctaSub}</p>
            <div className="form-row">
              <input className="form-input" type="text" placeholder={tx.phName}
                value={fname} onChange={(e) => setFname(e.target.value)} autoComplete="name" />
              <input className="form-input" type="email" placeholder={tx.phEmail}
                value={femail} onChange={(e) => setFemail(e.target.value)} autoComplete="email" />
            </div>
            <input className="form-input full" type="text" placeholder={tx.phCompany}
              value={fcompany} onChange={(e) => setFcompany(e.target.value)} autoComplete="organization" />
            <button className="cta-btn" type="submit" disabled={status === 'sending' || status === 'sent'}>
              {status === 'sending' ? tx.sending : tx.submit} {status !== 'sending' && status !== 'sent' && <span>→</span>}
            </button>
            {status === 'sent' && <div className="lead-feedback ok">{tx.ok}</div>}
            {status === 'error' && <div className="lead-feedback err">{errMsg}</div>}
          </form>
        </div>
      </main>
    </div>
  );
};

export default RoiPage;
