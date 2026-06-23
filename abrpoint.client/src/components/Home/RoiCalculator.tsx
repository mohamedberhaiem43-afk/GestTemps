import React, { useEffect, useRef, useState } from 'react';
import './RoiCalculator.css';
import { sendSalesRequest } from '../../services/ContactService';

// ─────────────────────────────────────────────────────────────────────────────
// Calculateur ROI — Concorde Workforce (diagnostic « façon formulaire »).
// Portage React fidèle de components/Home/Calculateur ROI façon formulaire .html :
// un parcours en 5 questions (sliders + choix multiples/uniques), une porte e-mail,
// puis un écran de résultat (montant animé + répartition + insights + CTA démo).
//
// Différences avec la maquette HTML (volontaires, pour l'app) :
//   • bilingue FR/EN piloté par la prop `lang` (la maquette est FR seule) ;
//   • la porte e-mail et le bouton « Réserver ma démo » envoient un vrai lead via
//     /api/contact/sales (sendSalesRequest) — la maquette se contentait d'un alert().
//     Le lead « diagnostic » part en best-effort (l'écran de résultat s'affiche
//     immédiatement) ; la demande de démo attend la réponse serveur.
//
// Hypothèses de calcul (identiques à la maquette) :
//   coût horaire RH   = salaire × 1,45 (charges) / 151,67 h légales
//   heures perdues/an = heures RH/semaine × 52
//   économie/an       = coût brut × 70 % (part automatisable) × multiplicateur outils
// ─────────────────────────────────────────────────────────────────────────────

type Lang = 'fr' | 'en';
type Step = 1 | 2 | 3 | 4 | 5 | 'gate';

interface TaskOpt { val: string; icon: string; text: string; sub: string }
interface ToolOpt { val: string; icon: string; text: string; sub: string; mult: number }

interface Dict {
  eyebrow: string; h1a: string; h1em: string; h1b: string; heroSub: string;
  stat1v: string; stat1l: string; stat2v: string; stat2l: string; stat3v: string; stat3l: string;
  progLabel: string; question: (n: number) => string;
  s1q: string; s1hint: string; s1unit: string; s1min: string; s1max: string;
  s2q: string; s2hint: string; tasks: TaskOpt[];
  s3q: string; s3hint: string; s3unit: string; s3min: string; s3max: string;
  s4q: string; s4hint: string; s4unit: string; s4min: string; s4max: string;
  s5q: string; s5hint: string; tools: ToolOpt[];
  next: string; back: string; seeResult: string;
  gateQ: string; gateNote: string; lblName: string; phName: string; lblEmail: string; phEmail: string;
  gateSubmit: string; gateSending: string; privacy: string; gateErr: string;
  resLabel: string; perYear: string;
  resSub: (perMois: string, hSaved: number) => string;
  bkTaux: string; bkHeures: string; bkCout: string; unitEuroH: string; unitH: string;
  badge1: (h: number) => string; badge2: string; badge3: string;
  ctaH3: string; ctaP: string; ctaPrimary: string; ctaSecondary: string;
  demoSending: string; demoOk: string; demoErr: string;
  shareText: (eco: string) => string; shareCopied: string;
  footer: string;
}

const FR: Dict = {
  eyebrow: '3 minutes · Résultat immédiat',
  h1a: 'Votre fonction RH est-elle', h1em: 'un levier ou un frein', h1b: '?',
  heroSub: "Répondez à 5 questions. Recevez votre diagnostic personnalisé et l'économie réelle que vous laissez sur la table chaque année.",
  stat1v: '70%', stat1l: 'des tâches RH automatisables',
  stat2v: 'J+30', stat2l: 'ROI positif moyen',
  stat3v: '2 sem.', stat3l: 'Déploiement',
  progLabel: 'Votre diagnostic', question: (n) => `Question ${n} / 5`,
  s1q: 'Combien de collaborateurs gère votre équipe RH ?', s1hint: 'Employés en CDI, CDD, intérimaires inclus.',
  s1unit: 'collaborateurs', s1min: '10', s1max: '500+',
  s2q: 'Quelles tâches RH vous coûtent le plus de temps ?', s2hint: "Choisissez tout ce qui s'applique.",
  tasks: [
    { val: 'planning', icon: '📅', text: 'Plannings & horaires', sub: 'Saisie, modifications, validation' },
    { val: 'conges', icon: '🏖', text: 'Congés & absences', sub: 'Demandes, suivi, régularisation' },
    { val: 'pointage', icon: '⏱', text: 'Pointage & temps de travail', sub: 'Relevés, corrections, exports' },
    { val: 'docs', icon: '📄', text: 'Documents & conformité', sub: 'Contrats, attestations, DPAE' },
  ],
  s3q: "Combien d'heures par semaine votre RH consacre à ces tâches ?",
  s3hint: 'Comptez toutes les personnes impliquées (RH, managers, assistants).',
  s3unit: 'h / semaine', s3min: '2h', s3max: '40h+',
  s4q: 'Quel est le salaire moyen brut mensuel des personnes impliquées ?',
  s4hint: 'RH, managers ou assistants qui gèrent ces tâches.',
  s4unit: '€ / mois', s4min: '1 600 €', s4max: '6 000 €',
  s5q: "Comment gérez-vous aujourd'hui ces processus RH ?", s5hint: 'Sélectionnez votre situation actuelle.',
  tools: [
    { val: 'excel', icon: '📊', text: 'Excel / Google Sheets', sub: "Tableaux manuels, risques d'erreurs", mult: 1.2 },
    { val: 'papier', icon: '📝', text: 'Papier / email', sub: 'Circuits de validation lents', mult: 1.4 },
    { val: 'logiciel_ancien', icon: '💾', text: 'Logiciel RH généraliste', sub: 'Non adapté aux équipes terrain', mult: 0.9 },
    { val: 'mix', icon: '🔀', text: 'Mix de plusieurs outils', sub: 'Doublons, synchronisation difficile', mult: 1.1 },
  ],
  next: 'Suivant', back: '← Retour', seeResult: 'Voir mon diagnostic',
  gateQ: 'Votre diagnostic est prêt.',
  gateNote: 'Renseignez vos coordonnées pour recevoir votre rapport personnalisé par email.',
  lblName: 'Prénom & Nom', phName: 'Ex : Sophie Martin',
  lblEmail: 'Email professionnel', phEmail: 'sophie.martin@entreprise.fr',
  gateSubmit: 'Recevoir mon diagnostic gratuit', gateSending: 'Envoi…',
  privacy: 'Données sécurisées · Aucun spam · Désabonnement en 1 clic',
  gateErr: 'Merci de renseigner votre prénom/nom et un email valide.',
  resLabel: 'Économie potentielle avec Concorde Workforce', perYear: '/ an',
  resSub: (perMois, hSaved) => `Soit ${perMois} € récupérés chaque mois · ${hSaved} h libérées chaque année`,
  bkTaux: 'Coût horaire RH', bkHeures: 'Heures perdues / an', bkCout: 'Masse salariale RH admin.',
  unitEuroH: '€/h', unitH: 'h',
  badge1: (h) => `⏱ ${h} h libérées / an`, badge2: '📈 ROI positif dès J+30', badge3: '🚀 Déploiement en 2 semaines',
  ctaH3: "Passez à l'étape suivante",
  ctaP: 'Un expert Concorde Workforce vous montre comment atteindre ces économies — démo personnalisée, sans engagement, sous 24h.',
  ctaPrimary: 'Réserver ma démo gratuite →', ctaSecondary: 'Partager ce résultat',
  demoSending: 'Envoi…', demoOk: '✓ Votre demande est envoyée — notre équipe vous contacte sous 24h.',
  demoErr: "L'envoi a échoué. Réessayez dans un instant.",
  shareText: (eco) => `Mon diagnostic RH Concorde Workforce : ${eco} € d'économies potentielles par an. Testez-le : concorde-work-force.com`,
  shareCopied: 'Résultat copié dans le presse-papier !',
  footer: '© 2026 Concorde Tech Innovation · Tous droits réservés · ',
};

const EN: Dict = {
  eyebrow: '3 minutes · Instant result',
  h1a: 'Is your HR function', h1em: 'a lever or a brake', h1b: '?',
  heroSub: 'Answer 5 questions. Get your personalized diagnosis and the real savings you leave on the table every year.',
  stat1v: '70%', stat1l: 'of HR tasks automatable',
  stat2v: 'D+30', stat2l: 'average positive ROI',
  stat3v: '2 wks', stat3l: 'Deployment',
  progLabel: 'Your diagnosis', question: (n) => `Question ${n} / 5`,
  s1q: 'How many employees does your HR team manage?', s1hint: 'Permanent, fixed-term and temporary staff included.',
  s1unit: 'employees', s1min: '10', s1max: '500+',
  s2q: 'Which HR tasks cost you the most time?', s2hint: 'Select all that apply.',
  tasks: [
    { val: 'planning', icon: '📅', text: 'Schedules & shifts', sub: 'Entry, edits, validation' },
    { val: 'conges', icon: '🏖', text: 'Leave & absences', sub: 'Requests, tracking, adjustments' },
    { val: 'pointage', icon: '⏱', text: 'Time tracking', sub: 'Records, corrections, exports' },
    { val: 'docs', icon: '📄', text: 'Documents & compliance', sub: 'Contracts, certificates, filings' },
  ],
  s3q: 'How many hours a week does your HR spend on these tasks?',
  s3hint: 'Count everyone involved (HR, managers, assistants).',
  s3unit: 'h / week', s3min: '2h', s3max: '40h+',
  s4q: 'What is the average gross monthly salary of the people involved?',
  s4hint: 'HR, managers or assistants who handle these tasks.',
  s4unit: '€ / month', s4min: '€1,600', s4max: '€6,000',
  s5q: 'How do you currently handle these HR processes?', s5hint: 'Select your current situation.',
  tools: [
    { val: 'excel', icon: '📊', text: 'Excel / Google Sheets', sub: 'Manual sheets, error-prone', mult: 1.2 },
    { val: 'papier', icon: '📝', text: 'Paper / email', sub: 'Slow approval flows', mult: 1.4 },
    { val: 'logiciel_ancien', icon: '💾', text: 'Generic HR software', sub: 'Not suited to field teams', mult: 0.9 },
    { val: 'mix', icon: '🔀', text: 'A mix of several tools', sub: 'Duplicates, hard to sync', mult: 1.1 },
  ],
  next: 'Next', back: '← Back', seeResult: 'See my diagnosis',
  gateQ: 'Your diagnosis is ready.',
  gateNote: 'Enter your details to receive your personalized report by email.',
  lblName: 'First & last name', phName: 'e.g. Sophie Martin',
  lblEmail: 'Work email', phEmail: 'sophie.martin@company.com',
  gateSubmit: 'Get my free diagnosis', gateSending: 'Sending…',
  privacy: 'Secure data · No spam · Unsubscribe in 1 click',
  gateErr: 'Please enter your name and a valid email.',
  resLabel: 'Potential savings with Concorde Workforce', perYear: '/ year',
  resSub: (perMois, hSaved) => `That's ${perMois} € reclaimed every month · ${hSaved} h freed every year`,
  bkTaux: 'HR hourly cost', bkHeures: 'Hours lost / year', bkCout: 'HR admin payroll',
  unitEuroH: '€/h', unitH: 'h',
  badge1: (h) => `⏱ ${h} h freed / year`, badge2: '📈 Positive ROI from D+30', badge3: '🚀 Live in 2 weeks',
  ctaH3: 'Take the next step',
  ctaP: 'A Concorde Workforce expert shows you how to reach these savings — personalized demo, no commitment, within 24h.',
  ctaPrimary: 'Book my free demo →', ctaSecondary: 'Share this result',
  demoSending: 'Sending…', demoOk: '✓ Request sent — our team will contact you within 24h.',
  demoErr: 'Sending failed. Please try again in a moment.',
  shareText: (eco) => `My Concorde Workforce HR diagnosis: ${eco} € of potential savings per year. Try it: concorde-work-force.com`,
  shareCopied: 'Result copied to clipboard!',
  footer: '© 2026 Concorde Tech Innovation · All rights reserved · ',
};

const LANG: Record<Lang, Dict> = { fr: FR, en: EN };

const ARROW = (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
);

function fmt(n: number, lang: Lang): string {
  return Math.round(n).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US');
}

const emailOk = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.trim());

const RoiCalculator: React.FC<{ lang?: Lang }> = ({ lang = 'fr' }) => {
  const t = LANG[lang];
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US';

  const [step, setStep] = useState<Step>(1);
  const [showResult, setShowResult] = useState(false);

  // Réponses (mêmes valeurs par défaut que la maquette)
  const [collab, setCollab] = useState(80);
  const [tasks, setTasks] = useState<string[]>([]);
  const [heures, setHeures] = useState(10);
  const [salaire, setSalaire] = useState(2400);
  const [tool, setTool] = useState<string>('mix');

  // Porte e-mail
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [gateErr, setGateErr] = useState(false);

  // Demande de démo (écran de résultat)
  const [demoStatus, setDemoStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [shareMsg, setShareMsg] = useState('');

  const toolMult = t.tools.find((o) => o.val === tool)?.mult ?? 1.0;

  // ── Calcul ROI ─────────────────────────────────────────────────────────────
  const taux = (salaire * 1.45) / 151.67;
  const heuresAn = heures * 52;
  const coutBrut = taux * heuresAn;
  const eco = Math.round(coutBrut * 0.7 * toolMult);
  const hSaved = Math.round(heuresAn * 0.7);
  const perMois = Math.round(eco / 12);

  const goNext = () => setStep((s) => (s === 'gate' ? s : ((s as number) + 1) as Step));
  const goPrev = () => setStep((s) => (typeof s === 'number' && s > 1 ? ((s - 1) as Step) : s));

  useEffect(() => {
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step, showResult]);

  const toggleTask = (val: string) =>
    setTasks((prev) => (prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]));

  // Résumé textuel du diagnostic, joint au lead commercial.
  const buildNeeds = (intro: string): string => {
    const toolLabel = t.tools.find((o) => o.val === tool)?.text ?? tool;
    const taskLabels = tasks.length
      ? tasks.map((v) => t.tasks.find((o) => o.val === v)?.text ?? v).join(', ')
      : '—';
    if (lang === 'en') {
      return [
        intro,
        `Employees: ${collab}`,
        `Most time-consuming tasks: ${taskLabels}`,
        `HR hours / week: ${heures}`,
        `Average gross salary: ${fmt(salaire, lang)} €`,
        `Current tools: ${toolLabel}`,
        `Estimated savings: ${fmt(eco, lang)} € / year`,
      ].join('\n');
    }
    return [
      intro,
      `Collaborateurs : ${collab}`,
      `Tâches chronophages : ${taskLabels}`,
      `Heures RH / semaine : ${heures}`,
      `Salaire moyen brut : ${fmt(salaire, lang)} €`,
      `Outils actuels : ${toolLabel}`,
      `Économie estimée : ${fmt(eco, lang)} € / an`,
    ].join('\n');
  };

  // ── Porte e-mail → affiche le résultat + lead « diagnostic » (best-effort) ──
  const submitGate = () => {
    const name = prenom.trim();
    if (!name || !emailOk(email)) { setGateErr(true); return; }
    setGateErr(false);
    setShowResult(true);
    // Lead best-effort : l'écran de résultat ne dépend pas de l'e-mail.
    void sendSalesRequest({
      company: '',
      contactName: name,
      email: email.trim(),
      headcount: String(collab),
      needs: buildNeeds(lang === 'en' ? 'ROI calculator diagnosis request.' : 'Demande de diagnostic depuis le calculateur ROI.'),
    }).catch(() => { /* silencieux : le diagnostic reste affiché à l'écran */ });
  };

  // ── Demande de démo (écran de résultat) → lead commercial confirmé ──────────
  const bookDemo = async () => {
    if (demoStatus === 'sending' || demoStatus === 'sent') return;
    setDemoStatus('sending');
    try {
      await sendSalesRequest({
        company: '',
        contactName: prenom.trim(),
        email: email.trim(),
        headcount: String(collab),
        needs: buildNeeds(lang === 'en' ? 'Demo request from the ROI calculator.' : 'Demande de démo depuis le calculateur ROI.'),
      });
      setDemoStatus('sent');
    } catch {
      setDemoStatus('error');
    }
  };

  const shareResult = async () => {
    const text = t.shareText(fmt(eco, lang));
    const title = lang === 'en' ? 'My Concorde Workforce HR diagnosis' : 'Mon diagnostic RH Concorde Workforce';
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title, text }); } catch { /* annulé par l'utilisateur */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareMsg(t.shareCopied);
      window.setTimeout(() => setShareMsg(''), 3000);
    } catch { /* presse-papier indisponible */ }
  };

  // ── Count-up animé du montant à l'affichage du résultat ─────────────────────
  const [displayNum, setDisplayNum] = useState(0);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (!showResult) { setDisplayNum(0); return; }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const target = eco;
    const dur = 1400;
    let t0: number | null = null;
    const ease = (p: number) => 1 - Math.pow(1 - p, 3);
    const stepFn = (ts: number) => {
      if (t0 === null) t0 = ts;
      const p = Math.min((ts - t0) / dur, 1);
      setDisplayNum(Math.round(target * ease(p)));
      if (p < 1) rafRef.current = requestAnimationFrame(stepFn);
    };
    rafRef.current = requestAnimationFrame(stepFn);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [showResult, eco]);

  // ── Insights (mêmes règles que la maquette) ────────────────────────────────
  const insights: { icon: string; highlight: boolean; html: string }[] = (() => {
    const out: { icon: string; highlight: boolean; html: string }[] = [];
    const tasksText = tasks.length
      ? tasks.map((v) => t.tasks.find((o) => o.val === v)?.text.toLowerCase() ?? v).join(', ')
      : (lang === 'en' ? 'your HR processes' : 'vos processus RH');
    const ecoS = fmt(eco, lang);
    const moisS = fmt(perMois, lang);
    if (lang === 'en') {
      if (tasks.length) out.push({ icon: '🎯', highlight: false, html: `Across <strong>${collab} employees</strong>, the most time-consuming tasks are <strong>${tasksText}</strong>. These are exactly the modules Concorde Workforce automates from week one.` });
      if (eco < 10000) out.push({ icon: '💡', highlight: true, html: `Even for a modest team, <strong>${ecoS} € per year</strong> is decision-making time given back to your managers. Every freed hour is a strategic action made possible.` });
      else if (eco < 30000) out.push({ icon: '💡', highlight: true, html: `That's the equivalent of <strong>an extra part-time HR role — without hiring</strong>. ${moisS} € reclaimed every month to reinvest in growth.` });
      else out.push({ icon: '🔥', highlight: true, html: `<strong>${ecoS} €, that's the annual cost of a full HR role</strong> you currently spend on manual processing. Competitors who automated move faster.` });
      out.push({ icon: '📬', highlight: false, html: `Your full report — savings breakdown, deployment plan and client testimonials — has just been sent to <strong>${email.trim()}</strong>.` });
      return out;
    }
    if (tasks.length) out.push({ icon: '🎯', highlight: false, html: `Sur <strong>${collab} collaborateurs</strong>, les tâches les plus chronophages sont <strong>${tasksText}</strong>. Ce sont précisément les modules qu'automatise Concorde Workforce dès la 1re semaine.` });
    if (eco < 10000) out.push({ icon: '💡', highlight: true, html: `Même pour une équipe de taille modeste, <strong>${ecoS} € par an</strong> représente du temps décisionnel rendu à vos managers. Chaque heure libérée est une action stratégique possible.` });
    else if (eco < 30000) out.push({ icon: '💡', highlight: true, html: `C'est l'équivalent d'<strong>un mi-temps RH supplémentaire — sans recruter</strong>. ${moisS} € récupérés chaque mois pour être réinvestis dans la croissance.` });
    else out.push({ icon: '🔥', highlight: true, html: `<strong>${ecoS} €, c'est le coût annuel d'un poste RH entier</strong> que vous consommez aujourd'hui en gestion manuelle. Vos concurrents qui ont automatisé avancent plus vite.` });
    out.push({ icon: '📬', highlight: false, html: `Votre rapport complet — détail des économies, plan de déploiement et témoignages clients — vient d'être envoyé à <strong>${email.trim()}</strong>.` });
    return out;
  })();

  const sliderFill = (val: number, min: number, max: number): React.CSSProperties =>
    ({ '--fill': `${((val - min) / (max - min)) * 100}%` } as React.CSSProperties);

  const progressPct = typeof step === 'number' ? (step / 5) * 100 : 100;

  return (
    <section className="roiq" id="roi" aria-label={t.eyebrow}>
      {/* HERO */}
      <div className="hero">
        <div className="hero-eyebrow"><i />{t.eyebrow}</div>
        <h1>{t.h1a}<br /><em>{t.h1em}</em> {t.h1b}</h1>
        <p>{t.heroSub}</p>
        <div className="hero-stats">
          <div><div className="hstat-val">{t.stat1v}</div><div className="hstat-lbl">{t.stat1l}</div></div>
          <div><div className="hstat-val">{t.stat2v}</div><div className="hstat-lbl">{t.stat2l}</div></div>
          <div><div className="hstat-val">{t.stat3v}</div><div className="hstat-lbl">{t.stat3l}</div></div>
        </div>
      </div>

      <div className="q-main">
        {!showResult && (
          <>
            {/* PROGRESS (masquée sur la porte e-mail) */}
            {step !== 'gate' && (
              <div className="progress-wrap">
                <div className="progress-top">
                  <span className="progress-label">{t.progLabel}</span>
                  <span className="progress-step">{t.question(step as number)}</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
            )}

            <div className="card">
              {step === 1 && (
                <div className="step">
                  <div className="step-body">
                    <div className="step-num">1</div>
                    <div className="step-q">{t.s1q}</div>
                    <div className="step-hint">{t.s1hint}</div>
                    <div className="slider-wrap">
                      <div className="slider-display">{collab.toLocaleString(locale)} <span>{t.s1unit}</span></div>
                      <input type="range" min={10} max={500} value={collab}
                        style={sliderFill(collab, 10, 500)}
                        onChange={(e) => setCollab(parseInt(e.target.value, 10))} />
                      <div className="slider-labels"><span>{t.s1min}</span><span>{t.s1max}</span></div>
                    </div>
                  </div>
                  <div className="step-nav">
                    <div />
                    <button type="button" className="btn-next" onClick={goNext}>{t.next} {ARROW}</button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="step">
                  <div className="step-body">
                    <div className="step-num">2</div>
                    <div className="step-q">{t.s2q}</div>
                    <div className="step-hint">{t.s2hint}</div>
                    <div className="options">
                      {t.tasks.map((o) => (
                        <button type="button" key={o.val}
                          className={'option' + (tasks.includes(o.val) ? ' selected' : '')}
                          onClick={() => toggleTask(o.val)}>
                          <div className="option-icon">{o.icon}</div>
                          <div><div className="option-text">{o.text}</div><div className="option-sub">{o.sub}</div></div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="step-nav">
                    <button type="button" className="btn-back" onClick={goPrev}>{t.back}</button>
                    <button type="button" className="btn-next" onClick={goNext}>{t.next} {ARROW}</button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="step">
                  <div className="step-body">
                    <div className="step-num">3</div>
                    <div className="step-q">{t.s3q}</div>
                    <div className="step-hint">{t.s3hint}</div>
                    <div className="slider-wrap">
                      <div className="slider-display">{heures.toLocaleString(locale)} <span>{t.s3unit}</span></div>
                      <input type="range" min={2} max={40} value={heures}
                        style={sliderFill(heures, 2, 40)}
                        onChange={(e) => setHeures(parseInt(e.target.value, 10))} />
                      <div className="slider-labels"><span>{t.s3min}</span><span>{t.s3max}</span></div>
                    </div>
                  </div>
                  <div className="step-nav">
                    <button type="button" className="btn-back" onClick={goPrev}>{t.back}</button>
                    <button type="button" className="btn-next" onClick={goNext}>{t.next} {ARROW}</button>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="step">
                  <div className="step-body">
                    <div className="step-num">4</div>
                    <div className="step-q">{t.s4q}</div>
                    <div className="step-hint">{t.s4hint}</div>
                    <div className="slider-wrap">
                      <div className="slider-display">{salaire.toLocaleString(locale)} <span>{t.s4unit}</span></div>
                      <input type="range" min={1600} max={6000} step={100} value={salaire}
                        style={sliderFill(salaire, 1600, 6000)}
                        onChange={(e) => setSalaire(parseInt(e.target.value, 10))} />
                      <div className="slider-labels"><span>{t.s4min}</span><span>{t.s4max}</span></div>
                    </div>
                  </div>
                  <div className="step-nav">
                    <button type="button" className="btn-back" onClick={goPrev}>{t.back}</button>
                    <button type="button" className="btn-next" onClick={goNext}>{t.next} {ARROW}</button>
                  </div>
                </div>
              )}

              {step === 5 && (
                <div className="step">
                  <div className="step-body">
                    <div className="step-num">5</div>
                    <div className="step-q">{t.s5q}</div>
                    <div className="step-hint">{t.s5hint}</div>
                    <div className="options">
                      {t.tools.map((o) => (
                        <button type="button" key={o.val}
                          className={'option' + (tool === o.val ? ' selected' : '')}
                          onClick={() => setTool(o.val)}>
                          <div className="option-icon">{o.icon}</div>
                          <div><div className="option-text">{o.text}</div><div className="option-sub">{o.sub}</div></div>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="step-nav">
                    <button type="button" className="btn-back" onClick={goPrev}>{t.back}</button>
                    <button type="button" className="btn-next" onClick={() => setStep('gate')}>{t.seeResult} {ARROW}</button>
                  </div>
                </div>
              )}

              {step === 'gate' && (
                <div className="step gate">
                  <div className="step-body">
                    <div className="gate-emoji">🎯</div>
                    <div className="step-q">{t.gateQ}</div>
                    <p className="gate-note">{t.gateNote}</p>
                    <div className="form-field">
                      <label className="form-label" htmlFor="roiq-name">{t.lblName}</label>
                      <input className="form-input" id="roiq-name" type="text" placeholder={t.phName}
                        autoComplete="name" value={prenom} onChange={(e) => setPrenom(e.target.value)} />
                    </div>
                    <div className="form-field">
                      <label className="form-label" htmlFor="roiq-email">{t.lblEmail}</label>
                      <input className="form-input" id="roiq-email" type="email" placeholder={t.phEmail}
                        autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <button type="button" className="btn-submit" onClick={submitGate}>
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,12 2,6" /></svg>
                      {t.gateSubmit}
                    </button>
                    {gateErr && <p className="gate-error">{t.gateErr}</p>}
                    <p className="privacy-note">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                      {t.privacy}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* RÉSULTAT */}
        {showResult && (
          <div className="screen-result">
            <div className="card">
              <div className="result-hero">
                <div className="result-score-label">{t.resLabel}</div>
                <div className="result-amount">
                  <span className="result-euro">€</span>
                  <span className="result-num">{displayNum.toLocaleString(locale)}</span>
                  <span className="result-period">{t.perYear}</span>
                </div>
                <div className="result-sub">{t.resSub(fmt(perMois, lang), hSaved)}</div>
                <div className="result-badges">
                  <span className="rbadge teal">{t.badge1(hSaved)}</span>
                  <span className="rbadge">{t.badge2}</span>
                  <span className="rbadge">{t.badge3}</span>
                </div>
              </div>

              <div className="breakdown">
                <div className="bk"><div className="bk-lbl">{t.bkTaux}</div><div className="bk-val">{fmt(taux, lang)} {t.unitEuroH}</div></div>
                <div className="bk"><div className="bk-lbl">{t.bkHeures}</div><div className="bk-val">{fmt(heuresAn, lang)} {t.unitH}</div></div>
                <div className="bk"><div className="bk-lbl">{t.bkCout}</div><div className="bk-val">{fmt(coutBrut, lang)} €</div></div>
              </div>

              <div className="insights">
                {insights.map((ins, i) => (
                  <div key={i} className={'insight' + (ins.highlight ? ' highlight' : '')}>
                    <div className="insight-icon">{ins.icon}</div>
                    <div className="insight-text" dangerouslySetInnerHTML={{ __html: ins.html }} />
                  </div>
                ))}
              </div>

              <div className="result-cta">
                <h3>{t.ctaH3}</h3>
                <p>{t.ctaP}</p>
                <div className="cta-actions">
                  <button type="button" className="btn-primary" onClick={bookDemo}
                    disabled={demoStatus === 'sending' || demoStatus === 'sent'}>
                    {demoStatus === 'sending' ? t.demoSending : t.ctaPrimary}
                  </button>
                  <button type="button" className="btn-secondary" onClick={shareResult}>{t.ctaSecondary}</button>
                </div>
                {demoStatus === 'sent' && <div className="success-msg">{t.demoOk}</div>}
                {demoStatus === 'error' && <div className="gate-error">{t.demoErr}</div>}
                {shareMsg && <div className="success-msg">{shareMsg}</div>}
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className="q-footer">
        {t.footer}
        <a href="mailto:contact@concorde-work-force.com">contact@concorde-work-force.com</a>
      </footer>
    </section>
  );
};

export default RoiCalculator;
