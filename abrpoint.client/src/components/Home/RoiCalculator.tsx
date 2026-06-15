import React, { useEffect, useRef, useState } from 'react';
import './RoiCalculator.css';

// ─────────────────────────────────────────────────────────────────────────────
// Calculateur ROI — Concorde Workforce.
// Portage React fidèle de components/Home/calculator ROI concorde .html :
//   • SANS le navbar (top-band + header) ;
//   • SANS les confettis plein écran (overlay intrusif sur une landing longue) ;
//   • SANS le formulaire de capture (la home a déjà une section #contact).
// Hypothèses de calcul (identiques à la maquette) :
//   coût horaire RH = salaire × 1,45 (charges employeur) / 151,67 h légales
//   heures perdues/an = heures RH/semaine × 52
//   économie = coût brut × 70 % (part automatisable par Concorde Workforce)
// ─────────────────────────────────────────────────────────────────────────────

const RING_CIRCUMFERENCE = 339.3; // 2·π·54
const AUTOMATABLE = 70;           // % du temps RH automatisable

type Lang = 'fr' | 'en';

interface Emotion {
  msg: string;
  pills: [string, string, string];
  wow: string;        // peut contenir <strong> (contenu maîtrisé, rendu via dangerouslySetInnerHTML)
  ringCaption: string;
}

const T = {
  fr: {
    eyebrow: 'Calculateur ROI — Concorde Workforce',
    h2a: 'Combien vous coûte vraiment', h2b: 'votre gestion RH ', h2em: "aujourd'hui ?",
    sub: 'Entrez vos chiffres. Découvrez ce que vous pourriez récupérer — en temps, en argent, en sérénité d’esprit.',
    fCollab: 'Nombre de collaborateurs', phCollab: 'Ex : 80',
    fSalaire: 'Salaire moyen mensuel', phSalaire: 'Ex : 2 400',
    fHeures: 'Heures RH / semaine', phHeures: 'Ex : 10',
    emptyA: 'Vos économies apparaîtront ici.', emptyB: 'Remplissez les champs ci-dessus pour découvrir votre résultat.',
    resultLabel: 'Économie estimée avec Concorde Workforce',
    perYear: '/ an', costNow: 'Coût actuel', automatable: '% automatisable',
    bkTaux: 'Coût horaire RH', bkHeures: 'Heures perdues / an', bkCout: 'Masse salariale RH',
    ringLabel: 'Répartition de votre temps RH', ringSub: 'automatisable',
    note: 'Calcul basé sur le coût total employeur (salaire × 1,45) · base légale 151,67 h/mois · 70 % de réduction du temps RH après déploiement de Concorde Workforce · 52 semaines/an.',
    unitH: 'h', unitEuroH: '€/h',
  },
  en: {
    eyebrow: 'ROI Calculator — Concorde Workforce',
    h2a: 'How much does your HR', h2b: 'management really cost ', h2em: 'today?',
    sub: 'Enter your figures. Discover what you could reclaim — in time, money and peace of mind.',
    fCollab: 'Number of employees', phCollab: 'e.g. 80',
    fSalaire: 'Average monthly salary', phSalaire: 'e.g. 2,400',
    fHeures: 'HR hours / week', phHeures: 'e.g. 10',
    emptyA: 'Your savings will appear here.', emptyB: 'Fill in the fields above to reveal your result.',
    resultLabel: 'Estimated savings with Concorde Workforce',
    perYear: '/ year', costNow: 'Current cost', automatable: '% automatable',
    bkTaux: 'HR hourly cost', bkHeures: 'Hours lost / year', bkCout: 'HR payroll cost',
    ringLabel: 'Breakdown of your HR time', ringSub: 'automatable',
    note: 'Based on total employer cost (salary × 1.45) · legal base 151.67 h/month · 70% reduction of HR time after deploying Concorde Workforce · 52 weeks/year.',
    unitH: 'h', unitEuroH: '€/h',
  },
} as const;

function fmt(n: number, lang: Lang): string {
  return Math.round(n).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US');
}

function getEmotions(eco: number, heuresAn: number, lang: Lang): Emotion {
  const hSaved = Math.round(heuresAn * 0.7);
  const jSaved = Math.round(hSaved / 8);
  const months = eco / 12;
  if (lang === 'en') {
    if (eco < 8000) return {
      msg: 'Even for a small team, every hour freed up is a decision made faster.',
      pills: ['⏱ ' + hSaved + 'h/year reclaimed', '📋 Zero data-entry errors', '🧘 A calmer team'],
      wow: 'This amount represents <strong>precious time given back to your managers</strong>. Every hour freed up is a decision made, an employee heard, an opportunity seized.',
      ringCaption: '<strong>70% of your HR tasks</strong> are automatable today — without changing your core habits.',
    };
    if (eco < 25000) return {
      msg: "It's the equivalent of an extra part-time HR role — without hiring or onboarding.",
      pills: ['💶 ' + fmt(months, lang) + '€ reclaimed/month', '⏱ ' + jSaved + ' days freed/year', '📈 Positive ROI from day 30'],
      wow: 'Concretely, <strong>' + fmt(eco, lang) + '€ every year</strong> currently goes into manual tasks your team could stop doing for good. Concorde Workforce automates them — from week two.',
      ringCaption: '<strong>' + hSaved + ' hours a year</strong> spent on no-value tasks. That much time your teams could reinvest where they truly make the difference.',
    };
    if (eco < 70000) return {
      msg: "It's an entire HR role you fund every year in manual processing.",
      pills: ['🔥 ' + fmt(eco, lang) + '€ saved/year', '⏱ ' + jSaved + ' days freed', '🚀 Live in 2 weeks'],
      wow: "<strong>" + fmt(eco, lang) + "€ is the annual salary of an employee.</strong> You spend it today on manual processes — delays, errors, frustration. With Concorde Workforce, that money stays in your company.",
      ringCaption: '<strong>' + hSaved + ' hours freed per year.</strong> That’s ' + jSaved + ' full days your teams reclaim to focus on growth, not paperwork.',
    };
    return {
      msg: 'This amount exceeds several annual salaries — budget you could reinvest in growth.',
      pills: ['💎 ' + Math.round(eco / 1000) + 'k€ reclaimed/year', '⏱ ' + jSaved + ' days freed', '🏆 Immediate, measurable impact'],
      wow: '<strong>' + fmt(eco, lang) + '€ per year.</strong> That’s significant. It’s not an optimistic projection — it’s what our clients observe on average 30 days after deployment. Your organization deserves better than spreadsheets.',
      ringCaption: 'At this scale, HR automation is no longer a comfort — it’s <strong>a direct competitive advantage</strong>. Competitors who adopted it move faster.',
    };
  }
  // FR
  if (eco < 8000) return {
    msg: 'Même pour une petite équipe, chaque heure libérée est une décision prise plus vite.',
    pills: ['⏱ ' + hSaved + 'h/an récupérées', '📋 Zéro erreur de saisie', '🧘 Équipe sereine'],
    wow: 'Ce montant représente <strong>du temps précieux rendu à vos managers</strong>. Chaque heure libérée est une décision prise, un collaborateur écouté, une opportunité saisie.',
    ringCaption: "<strong>70% de vos tâches RH</strong> sont automatisables dès aujourd’hui — sans changer vos habitudes de fond.",
  };
  if (eco < 25000) return {
    msg: "C’est l’équivalent d’un mi-temps RH supplémentaire — sans recruter, sans onboarder.",
    pills: ['💶 ' + fmt(months, lang) + '€ récupérés/mois', '⏱ ' + jSaved + ' jours libérés/an', '📈 ROI positif dès J+30'],
    wow: 'Concrètement, <strong>' + fmt(eco, lang) + '€ chaque année</strong> partent aujourd’hui en tâches manuelles que votre équipe pourrait ne plus jamais faire. Concorde Workforce les automatise — dès la 2ème semaine.',
    ringCaption: '<strong>' + hSaved + ' heures par an</strong> passées sur des tâches sans valeur ajoutée. Autant de temps que vos collaborateurs pourraient réinvestir là où ils font vraiment la différence.',
  };
  if (eco < 70000) return {
    msg: "C’est un poste RH entier que vous financez chaque année en gestion manuelle.",
    pills: ['🔥 ' + fmt(eco, lang) + '€ économisés/an', '⏱ ' + jSaved + ' jours libérés', '🚀 Déploiement en 2 semaines'],
    wow: '<strong>' + fmt(eco, lang) + '€, c’est le salaire annuel d’un collaborateur.</strong> Vous le dépensez aujourd’hui en processus manuels — délais, erreurs, frustrations. Avec Concorde Workforce, cet argent reste dans votre entreprise.',
    ringCaption: '<strong>' + hSaved + ' heures libérées par an.</strong> C’est ' + jSaved + ' journées complètes que vos équipes récupèrent pour se concentrer sur la croissance, pas sur la paperasse.',
  };
  return {
    msg: 'Ce montant dépasse plusieurs salaires annuels — autant de budget réinvesti dans votre croissance.',
    pills: ['💎 ' + Math.round(eco / 1000) + 'k€ récupérés/an', '⏱ ' + jSaved + ' jours libérés', '🏆 Impact immédiat et mesurable'],
    wow: '<strong>' + fmt(eco, lang) + '€ par an.</strong> C’est considérable. Ce n’est pas une projection optimiste — c’est ce que nos clients constatent en moyenne 30 jours après le déploiement. Votre organisation mérite mieux que des tableurs Excel.',
    ringCaption: 'À cette échelle, l’automatisation RH n’est plus un confort — c’est <strong>un avantage compétitif direct</strong>. Vos concurrents qui l’ont adopté avancent plus vite.',
  };
}

const RoiCalculator: React.FC<{ lang?: Lang; onEstimate?: (eco: number | null) => void }> = ({ lang = 'fr', onEstimate }) => {
  const t = T[lang];

  const [collab, setCollab] = useState('');
  const [salaire, setSalaire] = useState('');
  const [heures, setHeures] = useState('');

  const nCollab = parseFloat(collab) || 0;
  const nSalaire = parseFloat(salaire) || 0;
  const nHeures = parseFloat(heures) || 0;
  const valid = nCollab > 0 && nSalaire > 0 && nHeures > 0;

  const taux = (nSalaire * 1.45) / 151.67;
  const heuresAn = nHeures * 52;
  const coutBrut = taux * heuresAn;
  const eco = Math.round(coutBrut * 0.7);
  const em = valid ? getEmotions(eco, heuresAn, lang) : null;

  // Remonte l'estimation courante au parent (ex. RoiPage l'inclut dans le mail de contact).
  useEffect(() => { onEstimate?.(valid ? eco : null); }, [eco, valid, onEstimate]);

  // ── Count-up animé sur le montant ─────────────────────────────────────────
  const [displayNum, setDisplayNum] = useState(0);
  const prevEcoRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (!valid) { prevEcoRef.current = 0; setDisplayNum(0); return; }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const start = prevEcoRef.current;
    const target = eco;
    const dur = Math.min(1400, 600 + Math.abs(target - start) / 80);
    let t0: number | null = null;
    const ease = (p: number) => 1 - Math.pow(1 - p, 3);
    const step = (ts: number) => {
      if (t0 === null) t0 = ts;
      const p = Math.min((ts - t0) / dur, 1);
      setDisplayNum(Math.round(start + (target - start) * ease(p)));
      if (p < 1) rafRef.current = requestAnimationFrame(step);
      else prevEcoRef.current = target;
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [eco, valid]);

  // ── Révélation différée (.show) pour rejouer le stagger à chaque saisie ────
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!valid) { setShown(false); return; }
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, [valid]);

  // ── Anneau : texte 0 → 70 % ────────────────────────────────────────────────
  const [ringPct, setRingPct] = useState(0);
  useEffect(() => {
    if (!shown) { setRingPct(0); return; }
    let t0: number | null = null;
    let raf = 0;
    const step = (ts: number) => {
      if (t0 === null) t0 = ts;
      const p = Math.min((ts - t0) / 1300, 1);
      setRingPct(Math.round(p * p * (3 - 2 * p) * AUTOMATABLE));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [shown]);

  const ringOffset = shown ? RING_CIRCUMFERENCE * (1 - AUTOMATABLE / 100) : RING_CIRCUMFERENCE;

  return (
    <section className="roi-calc" id="roi" aria-label={t.eyebrow}>
      <div className="roi-hero">
        <div className="hero-ring" />
        <div className="hero-ring" />
        <div className="hero-content">
          <div className="hero-eyebrow">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
              <polyline points="17 6 23 6 23 12" />
            </svg>
            {t.eyebrow}
          </div>
          <h2>{t.h2a}<br />{t.h2b}<em>{t.h2em}</em></h2>
          <p className="hero-sub">{t.sub}</p>
        </div>
      </div>

      <div className="roi-main">
        <div className="card">
          <div className="card-body">

            <div className="fields">
              <div className="field">
                <label htmlFor="roi-collab">{t.fCollab}</label>
                <div className="input-wrap">
                  <input id="roi-collab" type="number" min={1} placeholder={t.phCollab}
                    value={collab} onChange={(e) => setCollab(e.target.value)} />
                </div>
              </div>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="roi-salaire">{t.fSalaire}</label>
                  <div className="input-wrap">
                    <input id="roi-salaire" type="number" min={0} placeholder={t.phSalaire}
                      style={{ paddingRight: 36 }}
                      value={salaire} onChange={(e) => setSalaire(e.target.value)} />
                    <span className="input-unit">€</span>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="roi-heures">{t.fHeures}</label>
                  <div className="input-wrap">
                    <input id="roi-heures" type="number" min={0} max={60} placeholder={t.phHeures}
                      style={{ paddingRight: 30 }}
                      value={heures} onChange={(e) => setHeures(e.target.value)} />
                    <span className="input-unit">h</span>
                  </div>
                </div>
              </div>
            </div>

            {!valid && (
              <div className="state-empty">
                <span className="empty-icon">⏳</span>
                <p className="empty-text">{t.emptyA}<br />{t.emptyB}</p>
              </div>
            )}

            {valid && em && (
              <>
                <div className="state-result">
                  <div className="result-top">
                    <div className="result-label">{t.resultLabel}</div>
                    <div className="result-amount">
                      <span className="result-euro">€</span>
                      <span className="result-num">{displayNum.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')}</span>
                      <span className="result-peryear">{t.perYear}</span>
                    </div>
                    <div className="savings-bar-wrap">
                      <div className="savings-bar-labels">
                        <span>{t.costNow}</span>
                        <span>{AUTOMATABLE}{t.automatable}</span>
                      </div>
                      <div className="savings-bar-bg">
                        <div className="savings-bar-fill" style={{ width: shown ? `${AUTOMATABLE}%` : '0%' }} />
                      </div>
                    </div>
                    <div className="result-message">{em.msg}</div>
                    <div className="emotion-pills">
                      {em.pills.map((p, i) => (
                        <span key={i}
                          className={'epill' + (i === 0 ? ' teal' : i === 1 ? ' amber' : '') + (shown ? ' show' : '')}
                          style={{ transitionDelay: shown ? `${i * 0.13}s` : '0s' }}>
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="result-breakdown">
                    <div className={'bk-item' + (shown ? ' show' : '')} style={{ transitionDelay: shown ? '0.1s' : '0s' }}>
                      <div className="bk-lbl">{t.bkTaux}</div>
                      <div className="bk-val">{fmt(taux, lang)} {t.unitEuroH}</div>
                    </div>
                    <div className={'bk-item' + (shown ? ' show' : '')} style={{ transitionDelay: shown ? '0.25s' : '0s' }}>
                      <div className="bk-lbl">{t.bkHeures}</div>
                      <div className="bk-val">{fmt(heuresAn, lang)} {t.unitH}</div>
                    </div>
                    <div className={'bk-item' + (shown ? ' show' : '')} style={{ transitionDelay: shown ? '0.4s' : '0s' }}>
                      <div className="bk-lbl">{t.bkCout}</div>
                      <div className="bk-val">{fmt(coutBrut, lang)} €</div>
                    </div>
                  </div>
                </div>

                <div className={'wow-panel' + (shown ? ' show' : '')}>
                  <span className="wow-icon">💡</span>
                  <p className="wow-text" dangerouslySetInnerHTML={{ __html: em.wow }} />
                </div>

                <div className={'progress-ring-wrap' + (shown ? ' show' : '')}>
                  <div className="ring-label">{t.ringLabel}</div>
                  <svg className="ring-svg" width="140" height="140" viewBox="0 0 140 140">
                    <circle cx="70" cy="70" r="54" fill="none" stroke="#e8effc" strokeWidth="12" />
                    <circle cx="70" cy="70" r="54" fill="none" stroke="url(#roiRingGrad)" strokeWidth="12"
                      strokeLinecap="round" strokeDasharray={RING_CIRCUMFERENCE} strokeDashoffset={ringOffset}
                      transform="rotate(-90 70 70)"
                      style={{ transition: 'stroke-dashoffset 1.3s cubic-bezier(0.22,1,0.36,1)' }} />
                    <defs>
                      <linearGradient id="roiRingGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#2DD4BF" />
                        <stop offset="100%" stopColor="#0040A1" />
                      </linearGradient>
                    </defs>
                    <text className="ring-center-text" x="70" y="68" textAnchor="middle" dominantBaseline="middle">{ringPct}%</text>
                    <text className="ring-center-sub" x="70" y="86" textAnchor="middle">{t.ringSub}</text>
                  </svg>
                  <p className="ring-caption" dangerouslySetInnerHTML={{ __html: em.ringCaption }} />
                </div>
              </>
            )}

            <p className="roi-note">{t.note}</p>

          </div>
        </div>
      </div>
    </section>
  );
};

export default RoiCalculator;
