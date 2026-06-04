import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../helper/AuthProvider';
import { openCookieConsent } from '../helper/CookieConsent';
import LanguageSwitcher from '../LanguageSwitcher/LanguageSwitcher';
import InlineAuthCard from './InlineAuthCard';
import PageSeo from '../helper/PageSeo';
import { trackEvent } from '../../analytics/ga';
import './HomePage.css';   // styles de la carte d'auth réutilisés par la popup d'inscription
import './HomePage2.css';  // nouveau design landing « Aperçu v2 » (scopé sous .hp2)

// ─────────────────────────────────────────────────────────────────────────────
// Landing publique « Concorde Workforce — Aperçu v2 ».
// Portée fidèle de components/Home/Homepage finale.html (hero split + vidéo,
// promo Fondateur navy, stats, download, « Comment ça marche » interactif avec
// curseur, grille tarifaire 4 packs, comparatif, infos commerciales, services
// complémentaires, CTA promo, section contact, footer navy + réseaux sociaux).
//
// Différence avec la maquette HTML : on conserve les intégrations React de l'app
// (navigation, session via useAuth, popup d'inscription InlineAuthCard, sélecteur
// de langue MUI). Le contenu bilingue FR/EN est piloté par i18n.language (le même
// que le LanguageSwitcher), via le dictionnaire LANG ci-dessous — au lieu du
// data-i18n vanilla de la maquette.
// ─────────────────────────────────────────────────────────────────────────────

type Lang = 'fr' | 'en';
type BillingCycle = 'monthly' | 'annual';
type StepIndex = 0 | 1 | 2 | 3;
type CompCell = boolean | string;
type CompRow =
  | { type: 'section'; label: string }
  | { type: 'feature'; label: string; s: CompCell; st: CompCell; b: CompCell };

interface Avantage { icon: string; t: string; d: string }
interface HowStep { title: string; desc: string; long: string }
interface ServiceRow { service: string; price: string }
interface PricedItem { name: string; desc: string; price: string }
interface QuoteItem { name: string; desc: string }

interface Dict {
  // NAV
  navPricing: string; navComp: string; navDownload: string; navContact: string;
  login: string; signup: string; openMenu: string; closeMenu: string;
  // HERO
  heroTitle: string; heroTitle2: string; heroAccent: string; heroSub: string;
  btnHero1: string; btnHero2: string; t1: string; t2: string; t3: string; t4: string;
  // PROMO FONDATEUR
  promoPill: string; promoTitleA: string; promoAccent: string;
  promoSubPre: string; promoDate1: string; promoMid: string; promoDate2: string; promoSuf: string;
  cdLabel: string; cdDays: string; cdHours: string; cdMin: string; cdSec: string;
  avantages: Avantage[]; promoCta: string; pt1: string; pt2: string; pt3: string; pt4: string;
  // STATS
  sl1: string; sl2: string; sl3: string; sl4: string;
  // DOWNLOAD
  dlTag: string; dlTitle: string; dlSubA: string; dlSubB: string;
  // HOW
  howTag: string; howTitle: string; howAccent: string; howSub: string;
  steps: HowStep[]; stepLabel: string; slideStart: string; slideEnd: string;
  // PRICING
  pTag: string; pTitleA: string; pTitleAccent: string;
  pBannerTitle: string; pBannerSub: string; pDemoCta: string;
  btnMonthly: string; btnAnnual: string; from: string; perMonth: string;
  commitAnnual: string; noCard: string; crossSuffix: string; savePrefix: string; saveSuffix: string;
  annualBill: string; popularBadge: string; premiumBadge: string; entBadge: string;
  pi1: string; pi2: string; pi3: string; extraCollab: string;
  starterFeatures: string[]; standardFeatures: string[]; businessFeatures: string[]; entFeatures: string[];
  entPriceLabel: string; entAmount: string; entAmountSuffix: string; entCommit: string; entSub: string; entCta: string;
  trialBtn: string; demoCard: string; pricingFoot: string;
  // COMPARISON
  compTag: string; compTitleA: string; compAccent: string; compSub: string;
  compCorner: string; fromShort: string; compTrial: string;
  csPointage: string; cfWeb: string; cfMobile: string; cfGeo: string;
  csEmp: string; cfFiches: string; cfCoffre: string; cfSign: string;
  csConges: string; cfConges: string; csPaie: string; cfPaie: string;
  csSecu: string; cfOvh: string; cfCrypto: string; cfBrand: string;
  csLimites: string; cfCollab: string; cfStockage: string; cfSupport: string;
  cvSup1: string; cvSup2: string; cvSup3: string;
  // INFOS COMMERCIALES
  infoTitle: string; infoLead: string; infoItems: string[]; infoP1: string; infoP2: string; infoP3: string;
  // SERVICES
  servicesTitle: string; serviceCol: string; priceCol: string; serviceRows: ServiceRow[];
  // MODULES OPTIONNELS / SERVICES (Payment Links Stripe) / SUR DEVIS
  optTitle: string; optSub: string; modCol: string; descCol: string; tarifCol: string; addBtn: string;
  optModules: PricedItem[];
  svcTitle: string; svcSub: string; svcCol: string;
  serviceItems: PricedItem[];
  quoteTitle: string; quoteSub: string; quoteBtn: string;
  quoteModules: QuoteItem[];
  // PROMO CTA
  pctaBadge: string; pctaH2: string; pctaP: string;
  pf1: string; pf2: string; pf3: string; pf4: string; pctaBtn: string;
  // CONTACT
  ctTitle: string; ctSub: string; ctEl: string; ctAl: string; ctAv: string;
  ctHl: string; ctHv: string; ctDl: string; ctDv: string;
  trialTitle: string; trialSub: string; trialNowBtn: string; formTitle: string;
  flPrenom: string; flNom: string; flEmail: string; flEnt: string; flEmp: string; flEmpSel: string;
  flObj: string; flObjSel: string; flObjDemo: string; flObjEnt: string; flObjRec: string; flObjAut: string;
  flMsg: string; flMsgPh: string; formSubmit: string;
  // FOOTER
  fDesc: string; fFlags: string; fcol1: string; fcol2: string;
  flPricing: string; flMobile: string; flContact: string; flAbout: string; flLogin: string; flSignup: string;
  copyright: string; privacy: string; cgu: string; legal: string; cookies: string;
}

const FR: Dict = {
  navPricing: 'Tarifs', navComp: 'Comparatif', navDownload: 'Téléchargement', navContact: 'Contact',
  login: 'Connexion', signup: 'Créer un compte', openMenu: 'Ouvrir le menu', closeMenu: 'Fermer le menu',

  heroTitle: 'Le pointage et la gestion', heroTitle2: 'du temps', heroAccent: 'simplifiés',
  heroSub: "Pointeuses biométriques, application mobile, gestion des congés, autorisations de sortie et préparation paie — tout centralisé dans une seule plateforme sécurisée.",
  btnHero1: 'Essai gratuit 30j →', btnHero2: 'Demander une démo gratuitement',
  t1: 'Conformité RGPD · TLS 1.3 · AES-256', t2: 'Hébergement France (OVH)', t3: 'Support francophone', t4: 'Multi-pays',

  promoPill: '🌟 OFFRE FONDATEUR — ÉTÉ 2026',
  promoTitleA: 'Conditions tarifaires', promoAccent: 'préférentielles Fondateur',
  promoSubPre: 'Du', promoDate1: '1er juin', promoMid: 'au', promoDate2: '31 août 2026', promoSuf: '— une fenêtre exclusive.',
  cdLabel: "L'offre se termine dans", cdDays: 'jours', cdHours: 'heures', cdMin: 'min', cdSec: 'sec',
  avantages: [
    { icon: '🎁', t: '1 mois offert', d: 'Sans carte bancaire' },
    { icon: '🚀', t: 'Activation rapide', d: 'Opérationnel en 48h' },
    { icon: '🎓', t: 'Onboarding inclus', d: 'Accompagnement expert' },
    { icon: '🎧', t: 'Support prioritaire', d: 'Accès file prioritaire' },
    { icon: '⚡', t: 'Accès anticipé', d: 'Nouvelles fonctionnalités' },
    { icon: '📅', t: 'Sans engagement', d: "Vous décidez après l'essai" },
  ],
  promoCta: "🌟 Rejoindre l'offre Fondateur →",
  pt1: '🛡 Sécurisé & conforme RGPD', pt2: '🏦 Hébergement France OVH', pt3: '⚡ Mise en place en 48h', pt4: '🎧 Support francophone humain',

  sl1: 'Entreprises clientes', sl2: 'Multi-pays', sl3: 'Absentéisme moyen', sl4: 'Pour déployer',

  dlTag: '📱 Application mobile', dlTitle: "Téléchargez l'app Concorde Workly",
  dlSubA: 'iOS · Android · Mode offline · Géolocalisation optionnelle. Rendez-vous sur',
  dlSubB: 'pour récupérer la dernière version.',

  howTag: 'Découvrir la plateforme', howTitle: 'Opérationnel en', howAccent: '2 semaines',
  howSub: 'Un déploiement guidé, sans technicien, sans résistance interne.',
  steps: [
    { title: 'Inscrivez-vous & validez votre SIRET', desc: "Création du compte en 5 minutes. Vérification automatique du numéro d'entreprise (SIRET FR, BCE BE, ICE MA, NINEA SN).", long: "Création du compte en 5 minutes. Vérification automatique du numéro d'entreprise (SIRET FR, BCE BE, ICE MA, NINEA SN). Aucune installation, aucun technicien requis : vous démarrez immédiatement depuis votre navigateur." },
    { title: 'Importez vos équipes', desc: "Upload CSV ou saisie manuelle de vos collaborateurs, sites et départements. Paramétrage en moins d'une heure.", long: "Upload CSV ou saisie manuelle de vos collaborateurs, sites et départements. Paramétrage en moins d'une heure. Vos données sont chiffrées et hébergées en France dès l'import." },
    { title: 'Déployez sur le terrain', desc: 'Application mobile iOS/Android pour les collaborateurs. Pointeuses biométriques compatibles. Mode offline disponible.', long: 'Application mobile iOS/Android pour les collaborateurs. Pointeuses biométriques compatibles. Mode offline disponible pour les sites sans connexion. Déploiement progressif site par site.' },
    { title: 'Pilotez en temps réel', desc: 'Tableau de bord temps réel dès J+1. Notifications push aux managers. Préparation paie automatisée.', long: "Tableau de bord temps réel dès J+1. Notifications push aux managers. Préparation paie automatisée et exports prêts pour votre logiciel de paie. Vous pilotez l'absentéisme et la productivité au quotidien." },
  ],
  stepLabel: 'Étape {n} sur 4', slideStart: 'Inscription', slideEnd: 'Pilotage',

  pTag: 'Tarifs', pTitleA: 'Un tarif', pTitleAccent: 'transparent',
  pBannerTitle: '🎁 1 mois offert — sans carte bancaire',
  pBannerSub: 'Testez gratuitement pendant 30 jours. Aucune carte requise. Annulez à tout moment.',
  pDemoCta: '🎬 Demander une démo gratuitement',
  btnMonthly: 'Mensuel', btnAnnual: 'Engagement annuel', from: 'À partir de', perMonth: ' / mois HT',
  commitAnnual: '★ Engagement annuel · conditions préférentielles', noCard: 'Sans carte bancaire',
  crossSuffix: ' € HT / mois', savePrefix: 'Économie : ', saveSuffix: ' € HT / an',
  annualBill: 'tarif annuel · facturation unique', popularBadge: '⭐ Le plus populaire',
  premiumBadge: '★ Haut de gamme', entBadge: '★ Sur mesure',
  pi1: '10 collaborateurs inclus · 10 Go stockage sécurisé',
  pi2: '25 collaborateurs inclus · 50 Go stockage sécurisé',
  pi3: '50 collaborateurs inclus · 200 Go stockage sécurisé',
  extraCollab: 'puis +{price} € HT / mois par collaborateur supplémentaire',
  starterFeatures: ['Pointage web & mobile (iOS / Android)', 'Gestion RH essentielle (fiches, contrats)', 'Gestion congés & absences', 'Tableau de bord simplifié · exports PDF / Excel', 'Notifications essentielles', '10 Go stockage sécurisé · Hébergement France OVH', 'Multi utilisateurs'],
  standardFeatures: ['Tout le pack Starter', 'Application mobile + géolocalisation', 'Coffre numérique & signature électronique', 'Import Excel en masse (employés, services, fonctions, rubriques…)', 'Préparation paie · export paie · Multi-sites simple', 'Congés, RTT, CET, sanctions · Notifications push / email', 'Reporting avancé · 50 Go stockage sécurisé', 'Hébergement France OVH · Multi utilisateurs', 'Idéal : PME en croissance · équipes terrain · structures multi-sites · gestion RH centralisée'],
  businessFeatures: ['Tout le pack Standard', 'Multi-filiales sur devis · tableaux de bord avancés', 'Sécurité renforcée · Audit logs avancés', 'Supervision avancée · 200 Go stockage sécurisé', 'Hébergement France OVH · Administrateurs illimités', 'Onboarding accompagné · SLA prioritaire', 'Idéal : PME structurées · groupes multi-sites · conformité & sécurité avancées · organisations en croissance'],
  entFeatures: ['IA RH avancée', 'Recherche documentaire', 'Workflows intelligents', 'API avancées & SSO', 'Hébergement dédié', 'Architecture sur mesure'],
  entPriceLabel: 'Sur devis', entAmount: 'Tarification', entAmountSuffix: ' personnalisée',
  entCommit: 'selon votre structure & volume', entSub: 'Administrateurs illimités · Onboarding accompagné', entCta: 'Demander un devis →',
  trialBtn: 'Essai gratuit 30j', demoCard: '🎬 Demander une démo gratuitement',
  pricingFoot: 'Sans engagement de durée · TVA en sus · Facturation Stripe sécurisée',

  compTag: 'Comparatif détaillé', compTitleA: 'Tout ce qui est inclus dans', compAccent: 'chaque pack',
  compSub: 'La matrice complète des modules et fonctionnalités, pack par pack. Choisissez en toute transparence.',
  compCorner: 'Fonctionnalités', fromShort: 'à partir de', compTrial: 'Essai gratuit 30j',
  csPointage: 'Pointage & présence', cfWeb: 'Pointage web', cfMobile: 'Application mobile (iOS / Android)', cfGeo: 'Pointage géolocalisé',
  csEmp: 'Gestion des employés', cfFiches: 'Fiches collaborateurs', cfCoffre: 'Coffre numérique', cfSign: 'Signature électronique',
  csConges: 'Congés & absences', cfConges: 'Demandes de congés', csPaie: 'Paie & frais', cfPaie: 'Préparation paie · export paie',
  csSecu: 'Sécurité & conformité', cfOvh: 'Hébergement France OVH', cfCrypto: 'Chiffrement AES-256 + TLS 1.3', cfBrand: 'Branding personnalisé',
  csLimites: 'Limites & quotas', cfCollab: 'Collaborateurs inclus', cfStockage: 'Stockage inclus', cfSupport: 'Support',
  cvSup1: 'Standard', cvSup2: 'Prioritaire', cvSup3: 'SLA prioritaire',

  infoTitle: 'Informations commerciales', infoLead: "Conditions tarifaires susceptibles d'évoluer selon :",
  infoItems: ['les fonctionnalités activées ;', "le volume d'utilisation ;", "le nombre d'utilisateurs ;", 'les modules complémentaires ;', 'les besoins de stockage ;', 'et les futures évolutions de la plateforme.'],
  infoP1: 'Les abonnements annuels bénéficient de conditions tarifaires préférentielles. Les abonnements mensuels restent disponibles aux tarifs standards affichés.',
  infoP2: "Les fonctionnalités IA avancées peuvent nécessiter l'activation de modules ou options complémentaires selon les usages et la volumétrie.",
  infoP3: 'Déploiement et accompagnement possibles selon les besoins du client.',

  servicesTitle: 'Services complémentaires & add-ons', serviceCol: 'Service', priceCol: 'Prix conseillé',
  serviceRows: [
    { service: 'Formation administrateurs (visio)', price: '290 €' },
    { service: 'Formation sur site', price: 'À partir de 790 €/jour' },
    { service: 'API publique', price: '+199 €/mois' },
    { service: 'Hébergement dédié', price: 'À partir de 390 €/mois' },
    { service: 'Pen-test annuel', price: 'À partir de 1 500 €' },
    { service: 'Connecteurs ERP / Paie standard', price: 'À partir de 490 €' },
    { service: 'Connecteurs ERP personnalisés', price: 'Sur devis' },
    { service: 'Import de données assisté', price: 'À partir de 250 €' },
    { service: 'Onboarding Premium', price: 'À partir de 390 €' },
    { service: 'Coaching personnalisé (visio)', price: 'À partir de 190 €' },
    { service: 'Coaching personnalisé demi-journée', price: 'À partir de 390 €' },
    { service: 'Coaching personnalisé journée complète', price: 'À partir de 690 €' },
    { service: 'Support prioritaire 24/7', price: '+149 €/mois' },
    { service: 'Stockage supplémentaire', price: '+29 €/100 Go' },
    { service: 'Domaine personnalisé', price: '+19 €/mois' },
  ],

  optTitle: 'Modules optionnels', optSub: 'Activez à la demande des modules complémentaires — facturation Stripe sécurisée, essai inclus, sans engagement.',
  modCol: 'Module', descCol: 'Description', tarifCol: 'Tarif', addBtn: 'Ajouter',
  optModules: [
    { name: 'Assistant RH IA', desc: "Module d'assistance intelligente destiné à accompagner les équipes RH dans certaines tâches administratives.", price: '79 € / mois' },
    { name: 'Signature électronique', desc: 'Signature électronique sécurisée de documents RH, validations internes et workflows administratifs.', price: '19 € / mois' },
    { name: 'Stockage supplémentaire 100 Go', desc: 'Extension de capacité de stockage sécurisée pour documents, exports, pièces jointes et données complémentaires.', price: '29 € / mois' },
  ],
  svcTitle: 'Nos services', svcSub: 'Formation et accompagnement par nos experts pour tirer le meilleur de la plateforme.',
  svcCol: 'Service',
  serviceItems: [
    { name: 'Formation administrateurs (visio)', desc: 'Session de formation à distance destinée aux administrateurs pour prendre en main Concorde Workforce : gestion des salariés, pointage, congés, validations, tableau de bord et paramétrage principal. Durée indicative : 2h30.', price: '290 €' },
    { name: 'Accompagnement Expert (visio)', desc: "Session d'accompagnement personnalisée à distance pour assistance, optimisation, conseils ou accompagnement opérationnel autour de Concorde Workforce. Durée indicative : 1h30.", price: '190 €' },
    { name: 'Accompagnement demi-journée', desc: "Accompagnement personnalisé dédié au déploiement, à l'organisation RH ou à l'optimisation de l'utilisation de la plateforme.", price: '490 €' },
    { name: "Journée complète d'accompagnement", desc: "Journée complète d'accompagnement opérationnel et stratégique : déploiement, structuration RH, formation avancée ou optimisation des processus internes.", price: '890 €' },
  ],
  quoteTitle: 'Modules et services sur devis', quoteSub: 'Solutions avancées étudiées selon vos besoins — contactez-nous pour un devis personnalisé.',
  quoteBtn: 'Demander un devis',
  quoteModules: [
    { name: 'Import de données assisté', desc: "Assistance technique et accompagnement pour l'import sécurisé des salariés, équipes, structures et données RH existantes vers Concorde Workforce." },
    { name: 'Connecteurs ERP / Paie', desc: "Mise en place de connecteurs standards permettant l'échange de données entre Concorde Workforce et certains logiciels ERP ou solutions de paie compatibles." },
    { name: 'Connecteurs ERP sur mesure', desc: "Développement et intégration de connecteurs personnalisés selon les besoins spécifiques du client et les logiciels tiers utilisés au sein de l'organisation." },
    { name: 'Audit sécurité avancée', desc: "Audit de sécurité et analyse technique visant à renforcer la protection de la plateforme et identifier d'éventuelles vulnérabilités ou axes d'amélioration." },
    { name: 'Branding personnalisé', desc: "Personnalisation avancée de l'environnement Concorde Workforce pour intégrer l'identité graphique de l'entreprise : logo, couleurs, éléments de marque et expérience utilisateur personnalisée." },
  ],

  pctaBadge: '🎁 Essai gratuit 30j', pctaH2: 'Rejoignez les entreprises qui ont fait le choix de la sérénité.',
  pctaP: "Testez Concorde Workforce gratuitement pendant 1 mois — sans CB, sans engagement. Déploiement en 2 semaines · Support francophone humain · ROI mesurable dès J+30.",
  pf1: '1 mois gratuit sans CB', pf2: 'Onboarding expert inclus', pf3: 'Sans engagement de durée', pf4: 'Annulation en 1 clic',
  pctaBtn: 'Démarrer mon essai gratuit 30j →',

  ctTitle: 'Parlons de votre projet RH', ctSub: 'Notre équipe vous répond sous 24h ouvrées.',
  ctEl: 'Email', ctAl: 'Adresse', ctAv: 'Paris 8e, France',
  ctHl: 'Disponibilité', ctHv: 'Lundi – Vendredi, 9h – 18h',
  ctDl: 'Démo rapide', ctDv: 'Accédez directement à la plateforme via concorde-work-force.com',
  trialTitle: 'ESSAI GRATUIT 30 JOURS', trialSub: 'Sans engagement · Sans carte bancaire · Hébergement France',
  trialNowBtn: 'Démarrer maintenant →', formTitle: 'Envoyez-nous un message',
  flPrenom: 'Prénom *', flNom: 'Nom *', flEmail: 'Email professionnel *', flEnt: 'Entreprise',
  flEmp: "Nombre d'employés", flEmpSel: 'Sélectionner…',
  flObj: 'Objet du message *', flObjSel: 'Sélectionner…', flObjDemo: 'Demander une démo',
  flObjEnt: 'Pack Enterprise Plus', flObjRec: 'Réclamation', flObjAut: 'Autre',
  flMsg: 'Message *', flMsgPh: 'Décrivez votre projet ou votre question…', formSubmit: 'Envoyer le message →',

  fDesc: 'La plateforme RH & pointage conçue pour les équipes terrain en Afrique francophone et en Europe.',
  fFlags: 'Multi-pays', fcol1: 'Produit', fcol2: 'Ressources',
  flPricing: 'Tarifs', flMobile: 'Application mobile', flContact: 'Contact',
  flAbout: 'À propos', flLogin: 'Se connecter', flSignup: 'Créer un compte',
  copyright: '© 2026 Concorde Workforce · Tous droits réservés',
  privacy: 'Confidentialité', cgu: 'CGUS', legal: 'Mentions légales', cookies: 'Cookies',
};

const EN: Dict = {
  navPricing: 'Pricing', navComp: 'Comparison', navDownload: 'Download', navContact: 'Contact',
  login: 'Log in', signup: 'Create account', openMenu: 'Open menu', closeMenu: 'Close menu',

  heroTitle: 'Time tracking and workforce', heroTitle2: 'management', heroAccent: 'simplified',
  heroSub: 'Biometric terminals, mobile app, leave management, exit authorizations and payroll preparation — all centralized in one secure platform.',
  btnHero1: '30-day free trial →', btnHero2: 'Request a free demo',
  t1: 'GDPR compliant · TLS 1.3 · AES-256', t2: 'Hosted in France (OVH)', t3: 'French-speaking support', t4: 'Multi-country',

  promoPill: '🌟 FOUNDER OFFER — SUMMER 2026',
  promoTitleA: 'Preferential Founder', promoAccent: 'pricing terms',
  promoSubPre: 'From', promoDate1: 'June 1st', promoMid: 'to', promoDate2: 'August 31, 2026', promoSuf: '— an exclusive window.',
  cdLabel: 'The offer ends in', cdDays: 'days', cdHours: 'hours', cdMin: 'min', cdSec: 'sec',
  avantages: [
    { icon: '🎁', t: '1 month free', d: 'No credit card' },
    { icon: '🚀', t: 'Fast activation', d: 'Up and running in 48h' },
    { icon: '🎓', t: 'Onboarding included', d: 'Expert guidance' },
    { icon: '🎧', t: 'Priority support', d: 'Priority queue access' },
    { icon: '⚡', t: 'Early access', d: 'New features' },
    { icon: '📅', t: 'No commitment', d: 'You decide after the trial' },
  ],
  promoCta: '🌟 Join the Founder offer →',
  pt1: '🛡 Secure & GDPR compliant', pt2: '🏦 Hosted in France OVH', pt3: '⚡ Set up in 48h', pt4: '🎧 Human French-speaking support',

  sl1: 'Client companies', sl2: 'Multi-country', sl3: 'Avg absenteeism', sl4: 'To deploy',

  dlTag: '📱 Mobile app', dlTitle: 'Download the Concorde Workly app',
  dlSubA: 'iOS · Android · Offline mode · Optional geolocation. Visit',
  dlSubB: 'to get the latest version.',

  howTag: 'Discover the platform', howTitle: 'Operational in', howAccent: '2 weeks',
  howSub: 'A guided deployment, without a technician, without internal resistance.',
  steps: [
    { title: 'Sign up & validate your company number', desc: 'Account creation in 5 minutes. Automatic verification of your company number (SIRET FR, BCE BE, ICE MA, NINEA SN).', long: 'Account creation in 5 minutes. Automatic verification of your company number (SIRET FR, BCE BE, ICE MA, NINEA SN). No installation, no technician required: you start right away from your browser.' },
    { title: 'Import your teams', desc: 'CSV upload or manual entry of your employees, sites and departments. Setup in under an hour.', long: 'CSV upload or manual entry of your employees, sites and departments. Setup in under an hour. Your data is encrypted and hosted in France from the very first import.' },
    { title: 'Deploy in the field', desc: 'iOS/Android mobile app for employees. Compatible biometric terminals. Offline mode available.', long: 'iOS/Android mobile app for employees. Compatible biometric terminals. Offline mode available for sites without connectivity. Gradual roll-out, site by site.' },
    { title: 'Manage in real time', desc: 'Real-time dashboard from day 1. Push notifications to managers. Automated payroll.', long: 'Real-time dashboard from day 1. Push notifications to managers. Automated payroll preparation and exports ready for your payroll software. Track absenteeism and productivity every day.' },
  ],
  stepLabel: 'Step {n} of 4', slideStart: 'Sign-up', slideEnd: 'Management',

  pTag: 'Pricing', pTitleA: 'Transparent pricing,', pTitleAccent: 'no surprises',
  pBannerTitle: '🎁 1 month free — no credit card',
  pBannerSub: 'Try free for 30 days. No card required. Cancel anytime.',
  pDemoCta: '🎬 Request a free demo',
  btnMonthly: 'Monthly', btnAnnual: 'Annual commitment', from: 'From', perMonth: ' / mo excl. tax',
  commitAnnual: '★ Annual commitment · preferential terms', noCard: 'No credit card',
  crossSuffix: ' € excl. tax / mo', savePrefix: 'Save: ', saveSuffix: ' € excl. tax / year',
  annualBill: 'annual rate · single invoice', popularBadge: '⭐ Most popular',
  premiumBadge: '★ Premium', entBadge: '★ Custom',
  pi1: '10 users included · 10 GB secure storage',
  pi2: '25 users included · 50 GB secure storage',
  pi3: '50 users included · 200 GB secure storage',
  extraCollab: 'then +€{price} excl. tax / mo per additional employee',
  starterFeatures: ['Web & mobile time tracking (iOS / Android)', 'Essential HR management (records, contracts)', 'Leave & absence management', 'Simplified dashboard · PDF / Excel exports', 'Essential notifications', '10 GB secure storage · Hosted in France OVH', 'Multi-user'],
  standardFeatures: ['Everything in Starter', 'Mobile app + geolocation', 'Digital vault & e-signature', 'Bulk Excel import (employees, services, roles, items…)', 'Payroll preparation · payroll export · simple multi-site', 'Leave, RTT, time-off, sanctions · push / email notifications', 'Advanced reporting · 50 GB secure storage', 'Hosted in France OVH · Multi-user', 'Ideal for: growing SMEs · field teams · multi-site structures · centralized HR management'],
  businessFeatures: ['Everything in Standard', 'Multi-subsidiary on quote · advanced dashboards', 'Enhanced security · advanced audit logs', 'Advanced supervision · 200 GB secure storage', 'Hosted in France OVH · Unlimited administrators', 'Guided onboarding · priority SLA', 'Ideal for: structured SMEs · multi-site groups · advanced compliance & security · growing organizations'],
  entFeatures: ['Advanced HR AI', 'Document search', 'Smart workflows', 'Advanced APIs & SSO', 'Dedicated hosting', 'Tailor-made architecture'],
  entPriceLabel: 'Custom quote', entAmount: 'Custom', entAmountSuffix: ' pricing',
  entCommit: 'based on your structure & volume', entSub: 'Unlimited administrators · Guided onboarding', entCta: 'Request a quote →',
  trialBtn: '30-day free trial', demoCard: '🎬 Request a free demo',
  pricingFoot: 'No time commitment · VAT extra · Secure Stripe billing',

  compTag: 'Detailed comparison', compTitleA: 'Everything included in', compAccent: 'each plan',
  compSub: 'The complete feature matrix, plan by plan. Choose with full transparency.',
  compCorner: 'Features', fromShort: 'from', compTrial: '30-day free trial',
  csPointage: 'Time tracking & attendance', cfWeb: 'Web time tracking', cfMobile: 'Mobile app (iOS / Android)', cfGeo: 'Geolocated time tracking',
  csEmp: 'Employee management', cfFiches: 'Employee records', cfCoffre: 'Digital vault', cfSign: 'Electronic signature',
  csConges: 'Leave & absences', cfConges: 'Leave requests', csPaie: 'Payroll & expenses', cfPaie: 'Payroll preparation · payroll export',
  csSecu: 'Security & compliance', cfOvh: 'Hosted in France OVH', cfCrypto: 'AES-256 + TLS 1.3 encryption', cfBrand: 'Custom branding',
  csLimites: 'Limits & quotas', cfCollab: 'Employees included', cfStockage: 'Storage included', cfSupport: 'Support',
  cvSup1: 'Standard', cvSup2: 'Priority', cvSup3: 'Priority SLA',

  infoTitle: 'Commercial information', infoLead: 'Pricing terms may change depending on:',
  infoItems: ['enabled features;', 'usage volume;', 'number of users;', 'add-on modules;', 'storage needs;', 'and future platform developments.'],
  infoP1: 'Annual subscriptions benefit from preferential pricing terms. Monthly subscriptions remain available at the standard rates shown.',
  infoP2: 'Advanced AI features may require the activation of additional modules or options depending on usage and volume.',
  infoP3: 'Deployment and guidance available depending on client needs.',

  servicesTitle: 'Complementary services & add-ons', serviceCol: 'Service', priceCol: 'Recommended price',
  serviceRows: [
    { service: 'Administrator training (video)', price: '€290' },
    { service: 'On-site training', price: 'From €790/day' },
    { service: 'Public API', price: '+€199/mo' },
    { service: 'Dedicated hosting', price: 'From €390/mo' },
    { service: 'Annual pen-test', price: 'From €1,500' },
    { service: 'Standard ERP / payroll connectors', price: 'From €490' },
    { service: 'Custom ERP connectors', price: 'Custom quote' },
    { service: 'Assisted data import', price: 'From €250' },
    { service: 'Premium onboarding', price: 'From €390' },
    { service: 'Personalized coaching (video)', price: 'From €190' },
    { service: 'Personalized coaching half-day', price: 'From €390' },
    { service: 'Personalized coaching full day', price: 'From €690' },
    { service: '24/7 priority support', price: '+€149/mo' },
    { service: 'Additional storage', price: '+€29/100 GB' },
    { service: 'Custom domain', price: '+€19/mo' },
  ],

  optTitle: 'Optional modules', optSub: 'Enable add-on modules on demand — secure Stripe billing, trial included, no commitment.',
  modCol: 'Module', descCol: 'Description', tarifCol: 'Price', addBtn: 'Add',
  optModules: [
    { name: 'HR AI Assistant', desc: 'Intelligent assistance module designed to support HR teams with certain administrative tasks.', price: '€79 / mo' },
    { name: 'Electronic signature', desc: 'Secure electronic signature of HR documents, internal approvals and administrative workflows.', price: '€19 / mo' },
    { name: 'Extra storage 100 GB', desc: 'Secure storage capacity extension for documents, exports, attachments and additional platform data.', price: '€29 / mo' },
  ],
  svcTitle: 'Our services', svcSub: 'Training and guidance from our experts to get the most out of the platform.',
  svcCol: 'Service',
  serviceItems: [
    { name: 'Administrator training (video)', desc: 'Remote training session for administrators to get started with Concorde Workforce: employee management, time tracking, leave, approvals, dashboard and main configuration. Indicative duration: 2h30.', price: '€290' },
    { name: 'Expert guidance (video)', desc: 'Personalized remote guidance session for assistance, optimization, advice or operational support around Concorde Workforce. Indicative duration: 1h30.', price: '€190' },
    { name: 'Half-day guidance', desc: 'Personalized guidance dedicated to deployment, HR organization or optimizing platform usage.', price: '€490' },
    { name: 'Full-day guidance', desc: 'Full day of operational and strategic guidance: deployment, HR structuring, advanced training or internal process optimization.', price: '€890' },
  ],
  quoteTitle: 'Modules on quote', quoteSub: 'Advanced solutions tailored to your needs — contact us for a custom quote.',
  quoteBtn: 'Request a quote',
  quoteModules: [
    { name: 'Assisted data import', desc: 'Technical assistance and support for the secure import of your existing employees, teams, structures and HR data into Concorde Workforce.' },
    { name: 'ERP / Payroll connectors', desc: 'Setup of standard connectors enabling data exchange between Concorde Workforce and certain compatible ERP or payroll software.' },
    { name: 'Custom ERP connectors', desc: 'Development and integration of custom connectors based on the client\'s specific needs and the third-party software used within the organization.' },
    { name: 'Advanced security audit', desc: 'Security audit and technical analysis to strengthen platform protection and identify potential vulnerabilities or areas for improvement.' },
    { name: 'Custom branding', desc: 'Advanced customization of the Concorde Workforce environment to integrate the company\'s visual identity: logo, colors, brand elements and tailored user experience.' },
  ],

  pctaBadge: '🎁 30-day free trial', pctaH2: 'Join companies that chose peace of mind.',
  pctaP: 'Test Concorde Workforce free for 1 month — no CC, no commitment. Deployment in 2 weeks · Human French-speaking support · measurable ROI from day 30.',
  pf1: '1 month free, no CC', pf2: 'Expert onboarding included', pf3: 'No long-term commitment', pf4: 'Cancel in 1 click',
  pctaBtn: 'Start my 30-day free trial →',

  ctTitle: "Let's talk about your HR project", ctSub: 'Our team responds within 24 business hours.',
  ctEl: 'Email', ctAl: 'Address', ctAv: 'Paris 8th, France',
  ctHl: 'Availability', ctHv: 'Monday – Friday, 9am – 6pm',
  ctDl: 'Quick demo', ctDv: 'Access the platform directly via concorde-work-force.com',
  trialTitle: '30-DAY FREE TRIAL', trialSub: 'No commitment · No credit card · Hosted in France',
  trialNowBtn: 'Get started now →', formTitle: 'Send us a message',
  flPrenom: 'First name *', flNom: 'Last name *', flEmail: 'Professional email *', flEnt: 'Company',
  flEmp: 'Number of employees', flEmpSel: 'Select…',
  flObj: 'Subject *', flObjSel: 'Select…', flObjDemo: 'Request a demo',
  flObjEnt: 'Enterprise Plus pack', flObjRec: 'Complaint', flObjAut: 'Other',
  flMsg: 'Message *', flMsgPh: 'Describe your project or question…', formSubmit: 'Send message →',

  fDesc: 'The HR & time tracking platform designed for field teams in French-speaking Africa and Europe.',
  fFlags: 'Multi-country', fcol1: 'Product', fcol2: 'Resources',
  flPricing: 'Pricing', flMobile: 'Mobile app', flContact: 'Contact',
  flAbout: 'About us', flLogin: 'Log in', flSignup: 'Create account',
  copyright: '© 2026 Concorde Workforce · All rights reserved',
  privacy: 'Privacy', cgu: 'Terms', legal: 'Legal notice', cookies: 'Cookies',
};

const LANG: Record<Lang, Dict> = { fr: FR, en: EN };

// ─── OFFRE FONDATEUR ÉTÉ 2026 — compte à rebours live (1er juin → 31 août 2026) ──
const FOUNDER_OFFER_END = new Date('2026-09-01T00:00:00+02:00');

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

// Rend une cellule du comparatif : true → ✓ vert, false → ✗ gris, string → valeur libre.
function renderComparisonCell(value: CompCell): React.ReactNode {
  if (value === true) return <span className="comp-check" aria-label="Inclus">✓</span>;
  if (value === false) return <span className="comp-cross" aria-label="Non inclus">✗</span>;
  return <span className="comp-value">{value}</span>;
}

// Logo embarqué en base64 dans la maquette → on réutilise l'asset public existant.
const LOGO_SRC = '/concorde-workly-light.jpg';
const DOWNLOAD_URL = 'https://concorde-work-force.com/download';

// ── Liens de paiement Stripe (Checkout hébergé) ─────────────────────────────
// Un lien par pack payant × cycle de facturation. Le tunnel Stripe inclut déjà
// l'essai gratuit 30 jours : le bouton « Essai gratuit 30j » des cartes ouvre
// donc directement le checkout du pack choisi (cf. cycle mensuel / annuel).
// Enterprise Plus n'a pas de lien (tarification sur devis → section contact).
type PaidPack = 'starter' | 'standard' | 'premium';
const STRIPE_LINKS: Record<PaidPack, Record<BillingCycle, string>> = {
  starter: {
    monthly: 'https://buy.stripe.com/9B6dR21dX83v9JBcZX00002',
    annual: 'https://buy.stripe.com/aFa9AMcWFgA14ph2lj00003',
  },
  standard: {
    monthly: 'https://buy.stripe.com/9B628k09TbfHaNF2lj00004',
    annual: 'https://buy.stripe.com/00w4gs2i197z7Bt1hf00005',
  },
  premium: {
    monthly: 'https://buy.stripe.com/8x24gs1dX83v8Fxgc900006',
    annual: 'https://buy.stripe.com/4gMcMY4q91F7091cZX00007',
  },
};

// Payment Links des modules optionnels (ordre = dict.optModules). Essai/abonnement Stripe.
const OPTIONAL_MODULE_LINKS = [
  'https://buy.stripe.com/5kQfZa4q9gA1bRJ1hf0000b', // Assistant RH IA — 79 €/mois
  'https://buy.stripe.com/cNi28k1dX3Nf6xpaRP0000a', // Signature électronique — 19 €/mois
  'https://buy.stripe.com/6oU8wI5ud1F79JBaRP00009', // Stockage supplémentaire 100 Go — 29 €/mois
];
// Payment Links des services ponctuels (ordre = dict.serviceItems).
const SERVICE_LINKS = [
  'https://buy.stripe.com/3cI14g7Cl4RjaNF9NL0000d', // Formation administrateurs (visio) — 290 €
  'https://buy.stripe.com/aFa3coe0J97zcVN3pn0000e', // Accompagnement Expert (visio) — 190 €
  'https://buy.stripe.com/3cI00c6yhbfH8Fxgc90000f', // Accompagnement demi-journée — 490 €
  'https://buy.stripe.com/dRmcMY5udabDaNF1hf0000g', // Journée complète d'accompagnement — 890 €
];

export default function HomePage() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const lang: Lang = i18n.language === 'en' ? 'en' : 'fr';
  const d = LANG[lang];

  const { uticod } = useAuth();
  const isAuthenticated = Boolean(uticod);

  const [signupOpen, setSignupOpen] = useState(false);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('annual');
  const [activeStep, setActiveStep] = useState<StepIndex>(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const countdown = useFounderCountdown();
  const pad = (n: number) => String(n).padStart(2, '0');

  // Rotation automatique de l'étape illustrée (4 étapes × 3,5 s).
  useEffect(() => {
    const id = window.setInterval(() => {
      setActiveStep((prev) => (((prev + 1) % 4) as StepIndex));
    }, 3500);
    return () => window.clearInterval(id);
  }, []);

  // ── Tarifs — Offre Fondateur Été 2026 (alignés avec PlanCatalog côté backend) ──
  const monthly = billingCycle === 'monthly';
  const fmt = (v: number) => new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'en-US', { maximumFractionDigits: 2 }).format(v);
  const monthlyBase = { starter: 99, standard: 219, premium: 449 };
  const annualMonthly = { starter: 69, standard: 119, premium: 249 };
  const annualSavings = { starter: 360, standard: 1200, premium: 2400 };
  // Tarif du collaborateur supplémentaire au-delà de l'inclus (HT / mois) — aligné sur
  // PlanCatalog.OverageRatePerEmployeeEur côté serveur ET sur l'item « collaborateur
  // supplémentaire » des Payment Links Stripe (ex. Starter 4,90 €/mois = 58,80 €/an).
  const overageRates = { starter: 4.9, standard: 6.9, premium: 9.9 };
  const prices = {
    starter: monthly ? monthlyBase.starter : annualMonthly.starter,
    standard: monthly ? monthlyBase.standard : annualMonthly.standard,
    premium: monthly ? monthlyBase.premium : annualMonthly.premium,
  };

  // ── Navigation / CTAs ──────────────────────────────────────────────────────
  const scrollToId = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };
  // « Essayer 30 jours gratuit » : si déjà connecté → dashboard ; sinon popup d'inscription.
  const goToSignup = () => {
    if (isAuthenticated) { navigate('/dashboard'); return; }
    setSignupOpen(true);
  };
  const goToLogin = () => {
    if (isAuthenticated) { navigate('/dashboard'); return; }
    navigate('/login');
  };
  // « Essai gratuit 30j » d'une carte payante (Payment Link Stripe, essai 30 j inclus).
  // Pour que le paiement soit rattaché au bon tenant côté webhook
  // (checkout.session.completed → ApplyCheckoutSubscriptionAsync), le lien doit porter
  // ?client_reference_id={slug}. On ne dispose de ce slug qu'une fois le compte créé :
  //   • visiteur anonyme  → on ouvre d'abord l'inscription (essai 30 j sans CB) ; le
  //     paiement/abonnement via le lien se fera ensuite depuis l'espace « Mon abonnement ».
  //   • utilisateur connecté → on ouvre directement le Payment Link avec son slug.
  // Le cycle actif (mensuel / annuel) sélectionne le bon lien. Nouvel onglet.
  const goToCheckout = (pack: PaidPack) => {
    // Conversion : clic « Essai gratuit » sur une carte payante (intention d'achat).
    trackEvent('begin_checkout', { pack, cycle: billingCycle });
    const slug = (typeof window !== 'undefined' && window.localStorage.getItem('tenantSlug')) || '';
    if (!isAuthenticated || !slug) {
      goToSignup();
      return;
    }
    const url = `${STRIPE_LINKS[pack][billingCycle]}?client_reference_id=${encodeURIComponent(slug)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  // Ouvre un Payment Link Stripe d'un module / service. On y injecte client_reference_id
  // (slug du tenant) quand il est disponible pour rattacher l'achat au bon tenant côté
  // webhook. `requireTenant` = true pour les modules qui débloquent des fonctionnalités
  // (il FAUT un compte pour les rattacher → visiteur anonyme redirigé vers l'inscription) ;
  // false pour les services ponctuels (formation/accompagnement), ouverts directement.
  const openStripeLink = (url: string, requireTenant: boolean) => {
    const slug = (typeof window !== 'undefined' && window.localStorage.getItem('tenantSlug')) || '';
    if (requireTenant && (!isAuthenticated || !slug)) { goToSignup(); return; }
    const full = slug ? `${url}?client_reference_id=${encodeURIComponent(slug)}` : url;
    window.open(full, '_blank', 'noopener,noreferrer');
  };
  // Le formulaire de contact n'a pas encore d'endpoint dédié : on redirige vers
  // la page contact-sales existante (graceful fallback, pas de perte de prospect).
  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/contact-sales');
  };

  // ── Comparatif : lignes (labels suivent la langue) ──────────────────────────
  const comparisonRows: CompRow[] = [
    { type: 'section', label: d.csPointage },
    { type: 'feature', label: d.cfWeb, s: true, st: true, b: true },
    { type: 'feature', label: d.cfMobile, s: true, st: true, b: true },
    { type: 'feature', label: d.cfGeo, s: false, st: true, b: true },
    { type: 'section', label: d.csEmp },
    { type: 'feature', label: d.cfFiches, s: true, st: true, b: true },
    { type: 'feature', label: d.cfCoffre, s: false, st: true, b: true },
    { type: 'feature', label: d.cfSign, s: false, st: true, b: true },
    { type: 'section', label: d.csConges },
    { type: 'feature', label: d.cfConges, s: true, st: true, b: true },
    { type: 'section', label: d.csPaie },
    { type: 'feature', label: d.cfPaie, s: false, st: true, b: true },
    { type: 'section', label: d.csSecu },
    { type: 'feature', label: d.cfOvh, s: true, st: true, b: true },
    { type: 'feature', label: d.cfCrypto, s: true, st: true, b: true },
    // Branding personnalisé retiré du comparatif des packs (2026-06-02) : désormais
    // « sur devis » (cf. section « Modules et services sur devis » ci-dessus).
    { type: 'section', label: d.csLimites },
    { type: 'feature', label: d.cfCollab, s: '10', st: '25', b: '50' },
    { type: 'feature', label: d.cfStockage, s: '10 Go', st: '50 Go', b: '200 Go' },
    { type: 'feature', label: d.cfSupport, s: d.cvSup1, st: d.cvSup2, b: d.cvSup3 },
  ];

  const stepNum = activeStep + 1;

  // Styles partagés des nouvelles sections (modules optionnels / services / sur devis).
  const secHeading: React.CSSProperties = { fontFamily: 'inherit', fontSize: 18, fontWeight: 800, color: '#0040a1', letterSpacing: '.06em', textTransform: 'uppercase', textAlign: 'center', margin: '0 0 8px' };
  const secSub: React.CSSProperties = { textAlign: 'center', color: '#64748b', maxWidth: 720, margin: '0 auto 28px', fontSize: 15, lineHeight: 1.55 };
  const tblWrap: React.CSSProperties = { overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 14, background: '#fff' };
  const tbl: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 14 };
  const thS: React.CSSProperties = { padding: '14px 16px', textAlign: 'left', fontWeight: 700, color: '#0f172a', background: '#f7f9fb', borderBottom: '2px solid #e5e7eb' };
  const tdS: React.CSSProperties = { padding: '14px 16px', color: '#334155', borderBottom: '1px solid #e5e7eb', verticalAlign: 'top', lineHeight: 1.5 };
  const addBtnS: React.CSSProperties = { background: 'linear-gradient(135deg,#0040a1,#0056d2)', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,64,161,.22)' };
  const quoteBtnS: React.CSSProperties = { background: 'transparent', color: '#0040a1', border: '1.5px solid #0040a1', borderRadius: 9, padding: '9px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' };

  return (
    <div className="hp2">
      <PageSeo
        title="Concorde Workforce – Logiciel RH & pointage pour PME"
        description="Gérez la RH de votre PME avec Concorde Workforce : pointage, congés, contrats et plannings réunis dans une seule plateforme. Essai gratuit 1 mois, sans CB."
      />

      {/* NAV */}
      <nav className="nav">
        <div className="nav-logo">
          <img className="logo" src={LOGO_SRC} alt="Concorde Workforce" />
          <span>Concorde Workforce</span>
        </div>
        <ul className="nav-links">
          <li><a onClick={() => scrollToId('pricing')}>{d.navPricing}</a></li>
          <li><a onClick={() => scrollToId('comp')}>{d.navComp}</a></li>
          <li><a onClick={() => scrollToId('download')}>{d.navDownload}</a></li>
          <li><a onClick={() => scrollToId('contact')}>{d.navContact}</a></li>
        </ul>
        <div className="nav-right">
          <LanguageSwitcher />
          <button type="button" className="btn-ghost" onClick={goToLogin}>{d.login}</button>
          <button type="button" className="btn-primary" onClick={goToSignup}>{d.signup} <span>→</span></button>
          <button
            type="button"
            className={`nav-mobile-toggle${mobileMenuOpen ? ' is-open' : ''}`}
            aria-label={mobileMenuOpen ? d.closeMenu : d.openMenu}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((o) => !o)}
          >
            <span /><span /><span />
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="nav-mobile-menu" role="menu">
          <a role="menuitem" onClick={() => scrollToId('pricing')}>{d.navPricing}</a>
          <a role="menuitem" onClick={() => scrollToId('comp')}>{d.navComp}</a>
          <a role="menuitem" onClick={() => scrollToId('download')}>{d.navDownload}</a>
          <a role="menuitem" onClick={() => scrollToId('contact')}>{d.navContact}</a>
          <div className="nav-mobile-actions">
            <button type="button" className="btn-ghost" onClick={() => { setMobileMenuOpen(false); goToLogin(); }}>{d.login}</button>
            <button type="button" className="btn-primary" onClick={() => { setMobileMenuOpen(false); goToSignup(); }}>{d.signup} <span>→</span></button>
          </div>
        </div>
      )}

      {/* HERO SPLIT */}
      <section className="hero" id="hero">
        <div className="hero-left">
          <h1>{d.heroTitle}<br />{d.heroTitle2} <span className="accent">{d.heroAccent}</span></h1>
          <p>{d.heroSub}</p>
          <div className="hero-cta">
            <button type="button" className="btn-hp" onClick={goToSignup}>{d.btnHero1}</button>
            <button type="button" className="btn-hs" onClick={() => scrollToId('contact')}><span>🎬</span> {d.btnHero2}</button>
          </div>
          <div className="trust">
            <div><span className="ti">✓</span><span>{d.t1}</span></div>
            <div className="tsep" />
            <div><span className="ti">✓</span><span>{d.t2}</span></div>
            <div className="tsep" />
            <div><span className="ti">✓</span><span>{d.t3}</span></div>
            <div className="tsep" />
            <div><span className="ti">✓</span><span>{d.t4}</span></div>
          </div>
        </div>
        <div className="hero-right">
          <video className="hero-video-box" src="/vide_o_finale_.mp4" controls muted loop playsInline autoPlay />
        </div>
      </section>

      {/* PROMO FONDATEUR NAVY */}
      {!countdown.expired && (
        <section className="promo" aria-label="Offre Fondateur Été 2026">
          <div className="promo-inner">
            <span className="promo-pill">{d.promoPill}</span>
            <div className="promo-row">
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 className="promo-title">{d.promoTitleA}<br /><span className="promo-accent">{d.promoAccent}</span></h2>
                <p className="promo-sub">
                  {d.promoSubPre} <span className="promo-sub-hl">{d.promoDate1}</span> {d.promoMid}{' '}
                  <span className="promo-sub-hl">{d.promoDate2}</span> {d.promoSuf}
                </p>
              </div>
              <div className="countdown" aria-label={d.cdLabel}>
                <div className="countdown-label">{d.cdLabel}</div>
                <div className="countdown-grid">
                  <div className="cu"><span className="cn">{pad(countdown.jours)}</span><span className="cs">{d.cdDays}</span></div>
                  <span className="csep">:</span>
                  <div className="cu"><span className="cn">{pad(countdown.heures)}</span><span className="cs">{d.cdHours}</span></div>
                  <span className="csep">:</span>
                  <div className="cu"><span className="cn">{pad(countdown.minutes)}</span><span className="cs">{d.cdMin}</span></div>
                  <span className="csep">:</span>
                  <div className="cu"><span className="cn">{pad(countdown.secondes)}</span><span className="cs">{d.cdSec}</span></div>
                </div>
              </div>
            </div>
            <ul className="avantages">
              {d.avantages.map((a) => (
                <li key={a.t} className="av">
                  <div className="av-icon">{a.icon}</div>
                  <div className="av-text"><strong>{a.t}</strong><span>{a.d}</span></div>
                </li>
              ))}
            </ul>
            <button type="button" className="promo-cta" onClick={goToSignup}>{d.promoCta}</button>
            <div className="promo-trust">
              <span>{d.pt1}</span><span>{d.pt2}</span><span>{d.pt3}</span><span>{d.pt4}</span>
            </div>
          </div>
        </section>
      )}

      {/* STATS */}
      <div className="stats">
        <div className="stat"><div className="stat-num">500+</div><div className="stat-label">{d.sl1}</div></div>
        <div className="stat"><div className="stat-num">5 {lang === 'fr' ? 'pays' : 'countries'}</div><div className="stat-label">{d.sl2}</div></div>
        <div className="stat"><div className="stat-num">−34%</div><div className="stat-label">{d.sl3}</div></div>
        <div className="stat"><div className="stat-num">2 {lang === 'fr' ? 'sem.' : 'wks'}</div><div className="stat-label">{d.sl4}</div></div>
      </div>

      {/* DOWNLOAD */}
      <div id="download" className="download">
        <div>
          <div className="dl-tag">{d.dlTag}</div>
          <div className="dl-title">{d.dlTitle}</div>
          <div className="dl-sub">
            {d.dlSubA} <a className="dl-link" href={DOWNLOAD_URL} target="_blank" rel="noopener noreferrer">concorde-work-force.com</a> {d.dlSubB}
          </div>
        </div>
        <div className="store-btns">
          <a className="store-btn" href={DOWNLOAD_URL} target="_blank" rel="noopener noreferrer">
            <div className="store-icon">⬇</div>
            <div><span className="store-small">APK direct</span><span className="store-large">concorde-work-force.com</span></div>
          </a>
        </div>
      </div>

      {/* HOW — DÉCOUVRIR LA PLATEFORME */}
      <section className="how" id="how">
        <div className="section-tag">{d.howTag}</div>
        <h2 className="section-title"><span>{d.howTitle}</span> <span className="accent">{d.howAccent}</span></h2>
        <p className="section-sub">{d.howSub}</p>
        <div className="how-layout">
          <div className="steps">
            {d.steps.map((s, i) => (
              <div
                key={s.title}
                className={`step${activeStep === i ? ' active' : ''}`}
                onClick={() => setActiveStep(i as StepIndex)}
              >
                <div className="step-num">{pad(i + 1)}</div>
                <div>
                  <div className="step-title">{s.title}</div>
                  <div className="step-desc">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="how-detail">
            <div className="detail-badge">{pad(stepNum)}</div>
            <div className="detail-step-label">{d.stepLabel.replace('{n}', String(stepNum))}</div>
            <div className="detail-title">{d.steps[activeStep].title}</div>
            <div className="detail-desc">{d.steps[activeStep].long}</div>
            <div className="detail-slider-wrap">
              <div className="detail-slider-head">
                <span>{d.slideStart}</span>
                <span>{d.slideEnd}</span>
              </div>
              <input
                type="range" min={0} max={3} step={1} value={activeStep}
                className="detail-slider"
                style={{ '--fill': `${(activeStep / 3) * 100}%` } as React.CSSProperties}
                onChange={(e) => setActiveStep(Number(e.target.value) as StepIndex)}
              />
              <div className="detail-dots">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={`detail-dot${activeStep === i ? ' active' : ''}`}
                    onClick={() => setActiveStep(i as StepIndex)}
                  >{pad(i + 1)}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="pricing">
        <div style={{ textAlign: 'center' }}>
          <div className="section-tag">{d.pTag}</div>
          <h2 className="section-title" style={{ margin: '0 auto 0', textAlign: 'center' }}>
            {d.pTitleA} <span className="accent">{d.pTitleAccent}</span>
          </h2>
          <div className="pricing-banner">
            <span style={{ fontSize: 26 }}>🎁</span>
            <div>
              <div className="banner-title">{d.pBannerTitle}</div>
              <div className="banner-sub">{d.pBannerSub}</div>
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: 18 }}>
            <button type="button" className="demo-cta" onClick={() => scrollToId('contact')}>{d.pDemoCta}</button>
          </div>
        </div>

        <div className="pricing-toggle">
          <button type="button" className={`toggle-btn${monthly ? ' active' : ''}`} onClick={() => setBillingCycle('monthly')}>{d.btnMonthly}</button>
          <button type="button" className={`toggle-btn${!monthly ? ' active' : ''}`} onClick={() => setBillingCycle('annual')}>{d.btnAnnual}</button>
        </div>

        <div className="pricing-grid">
          {/* STARTER */}
          <div className="price-card">
            <div className="price-tier">Starter</div>
            <div className="price-from">{d.from}</div>
            <div className="price-amount"><span className="cu">€</span>{fmt(prices.starter)}<span className="pe">{d.perMonth}</span></div>
            {!monthly && <div className="price-commit">{d.commitAnnual}</div>}
            {!monthly && <div className="price-cross">{fmt(monthlyBase.starter)}{d.crossSuffix}</div>}
            {!monthly && <div className="price-save">{d.savePrefix}{fmt(annualSavings.starter)}{d.saveSuffix}</div>}
            <div className="price-incl">{d.pi1}</div>
            <div className="price-extra" style={{ fontSize: 12.5, color: '#64748b', margin: '4px 0 2px' }}>{d.extraCollab.replace('{price}', fmt(overageRates.starter))}</div>
            <div className="price-per">{d.annualBill}</div>
            <button type="button" className="btn-trial" onClick={() => goToCheckout('starter')}>{d.trialBtn}</button>
            <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--on-v)', margin: '10px 0', fontWeight: 500 }}>✓ {d.noCard}</div>
            <button type="button" className="btn-demo-card" onClick={() => scrollToId('contact')}>{d.demoCard}</button>
            <ul className="price-list">{d.starterFeatures.map((f, i) => <li key={i}>{f}</li>)}</ul>
          </div>

          {/* STANDARD */}
          <div className="price-card featured">
            <div className="popular-badge">{d.popularBadge}</div>
            <div className="price-tier" style={{ marginTop: 14 }}>Standard</div>
            <div className="price-from">{d.from}</div>
            <div className="price-amount"><span className="cu">€</span>{fmt(prices.standard)}<span className="pe">{d.perMonth}</span></div>
            {!monthly && <div className="price-commit">{d.commitAnnual}</div>}
            {!monthly && <div className="price-cross">{fmt(monthlyBase.standard)}{d.crossSuffix}</div>}
            {!monthly && <div className="price-save">{d.savePrefix}{fmt(annualSavings.standard)}{d.saveSuffix}</div>}
            <div className="price-incl">{d.pi2}</div>
            <div className="price-extra" style={{ fontSize: 12.5, color: '#64748b', margin: '4px 0 2px' }}>{d.extraCollab.replace('{price}', fmt(overageRates.standard))}</div>
            <div className="price-per">{d.annualBill}</div>
            <button type="button" className="btn-trial" onClick={() => goToCheckout('standard')}>{d.trialBtn}</button>
            <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--on-v)', margin: '10px 0', fontWeight: 500 }}>✓ {d.noCard}</div>
            <button type="button" className="btn-demo-card" onClick={() => scrollToId('contact')}>{d.demoCard}</button>
            <ul className="price-list">{d.standardFeatures.map((f, i) => <li key={i}>{f}</li>)}</ul>
          </div>

          {/* BUSINESS / PREMIUM — couleur OR (2026-06) : aligné sur le ton doré du
              comparatif (#b8860b). Dégradés gold : #b8860b (texte) → #d4af37 (accent). */}
          <div className="price-card" style={{ border: '2px solid #b8860b', background: 'linear-gradient(180deg,#fdf8ec,#fff)' }}>
            <div style={{ position: 'absolute', top: -12, right: 20, background: 'linear-gradient(135deg,#b8860b,#d4af37)', color: '#fff', fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 999, letterSpacing: '.08em', textTransform: 'uppercase' }}>{d.premiumBadge}</div>
            <div className="price-tier" style={{ color: '#b8860b' }}>Premium</div>
            <div className="price-from" style={{ color: '#b8860b' }}>{d.from}</div>
            <div className="price-amount" style={{ color: '#b8860b' }}><span className="cu">€</span>{fmt(prices.premium)}<span className="pe" style={{ color: '#b8860b' }}>{d.perMonth}</span></div>
            {!monthly && <div className="price-commit" style={{ color: '#b8860b' }}>{d.commitAnnual}</div>}
            {!monthly && <div className="price-cross" style={{ color: '#b9a05f' }}>{fmt(monthlyBase.premium)}{d.crossSuffix}</div>}
            {!monthly && <div className="price-save">{d.savePrefix}{fmt(annualSavings.premium)}{d.saveSuffix}</div>}
            <div className="price-incl" style={{ color: '#b8860b' }}>{d.pi3}</div>
            <div className="price-extra" style={{ fontSize: 12.5, color: '#a67c00', margin: '4px 0 2px' }}>{d.extraCollab.replace('{price}', fmt(overageRates.premium))}</div>
            <div className="price-per">{d.annualBill}</div>
            <button type="button" className="btn-trial" style={{ background: 'linear-gradient(135deg,#b8860b,#d4af37)', boxShadow: '0 6px 18px rgba(184,134,11,.32)' }} onClick={() => goToCheckout('premium')}>{d.trialBtn}</button>
            <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--on-v)', margin: '10px 0', fontWeight: 500 }}>✓ {d.noCard}</div>
            <button type="button" className="btn-demo-card" style={{ borderColor: '#b8860b', color: '#b8860b' }} onClick={() => scrollToId('contact')}>{d.demoCard}</button>
            <ul className="price-list">{d.businessFeatures.map((f, i) => <li key={i}>{f}</li>)}</ul>
          </div>

          {/* ENTERPRISE PLUS */}
          <div className="price-card" style={{ border: '2px solid #43466B', background: 'linear-gradient(135deg,#43466B 0%,#505880 100%)', color: '#fff', boxShadow: '0 8px 32px rgba(67,70,107,.4)' }}>
            <div style={{ position: 'absolute', top: -12, right: 20, background: '#43466B', color: '#fff', fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 999, letterSpacing: '.08em', textTransform: 'uppercase' }}>{d.entBadge}</div>
            <div className="price-tier" style={{ color: '#7dd3fc' }}>Enterprise Plus</div>
            <div className="price-from" style={{ color: '#fff' }}>{d.entPriceLabel}</div>
            <div className="price-amount" style={{ color: '#fff' }}>{d.entAmount}<span className="pe" style={{ color: '#fff', fontSize: 13 }}>{d.entAmountSuffix}</span></div>
            <div className="price-commit" style={{ color: '#fff', fontSize: 12 }}>{d.entCommit}</div>
            <div style={{ color: '#fff', marginTop: 14, marginBottom: 18 }}>{d.entSub}</div>
            <button type="button" className="btn-trial" style={{ background: '#fff', color: '#43466B', fontWeight: 600, boxShadow: '0 6px 18px rgba(67,70,107,.32)', marginBottom: 16 }} onClick={() => scrollToId('contact')}>{d.entCta}</button>
            <ul className="price-list" style={{ color: '#fff' }}>{d.entFeatures.map((f, i) => <li key={i}>{f}</li>)}</ul>
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: 28, fontSize: 14, color: '#64748b' }}>{d.pricingFoot}</p>

        {/* MODULES OPTIONNELS — juste sous les 4 packs. Bouton « Ajouter » → Payment Link
            Stripe du module (rattaché au tenant via client_reference_id ; visiteur anonyme
            redirigé d'abord vers l'inscription car un module débloque des fonctionnalités). */}
        <div style={{ maxWidth: 1100, margin: '56px auto 0' }}>
          <h3 style={secHeading}>{d.optTitle}</h3>
          <p style={secSub}>{d.optSub}</p>
          <div style={tblWrap}>
            <table style={tbl}>
              <thead>
                <tr>
                  <th style={thS}>{d.modCol}</th>
                  <th style={thS}>{d.descCol}</th>
                  <th style={{ ...thS, whiteSpace: 'nowrap' }}>{d.tarifCol}</th>
                  <th style={{ ...thS, textAlign: 'center' }} aria-label={d.addBtn} />
                </tr>
              </thead>
              <tbody>
                {d.optModules.map((m, i) => (
                  <tr key={m.name}>
                    <td style={{ ...tdS, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>{m.name}</td>
                    <td style={tdS}>{m.desc}</td>
                    <td style={{ ...tdS, fontWeight: 700, color: '#0040a1', whiteSpace: 'nowrap' }}>{m.price}</td>
                    <td style={{ ...tdS, textAlign: 'center' }}>
                      <button type="button" style={addBtnS} onClick={() => openStripeLink(OPTIONAL_MODULE_LINKS[i], true)}>{d.addBtn}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* NOS SERVICES + MODULES SUR DEVIS — placés juste sous les modules optionnels.
              Services : bouton « Ajouter » → Payment Link Stripe (prestation ponctuelle,
              ouvert directement ; client_reference_id ajouté si un tenant est connu).
              Sur devis : bouton « Demander un devis » → section contact (formulaire). */}
          <div style={{ marginTop: 56 }}>
            <h3 style={secHeading}>{d.svcTitle}</h3>
            <p style={secSub}>{d.svcSub}</p>
            <div style={tblWrap}>
              <table style={tbl}>
                <thead>
                  <tr>
                    <th style={thS}>{d.svcCol}</th>
                    <th style={thS}>{d.descCol}</th>
                    <th style={{ ...thS, whiteSpace: 'nowrap' }}>{d.tarifCol}</th>
                    <th style={{ ...thS, textAlign: 'center' }} aria-label={d.addBtn} />
                  </tr>
                </thead>
                <tbody>
                  {d.serviceItems.map((s, i) => (
                    <tr key={s.name}>
                      <td style={{ ...tdS, fontWeight: 700, color: '#0f172a' }}>{s.name}</td>
                      <td style={tdS}>{s.desc}</td>
                      <td style={{ ...tdS, fontWeight: 700, color: '#0040a1', whiteSpace: 'nowrap' }}>{s.price}</td>
                      <td style={{ ...tdS, textAlign: 'center' }}>
                        <button type="button" style={addBtnS} onClick={() => openStripeLink(SERVICE_LINKS[i], false)}>{d.addBtn}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ marginTop: 56 }}>
            <h3 style={secHeading}>{d.quoteTitle}</h3>
            <p style={secSub}>{d.quoteSub}</p>
            <div style={tblWrap}>
              <table style={tbl}>
                <thead>
                  <tr>
                    <th style={thS}>{d.modCol}</th>
                    <th style={thS}>{d.descCol}</th>
                    <th style={{ ...thS, textAlign: 'center' }} aria-label={d.quoteBtn} />
                  </tr>
                </thead>
                <tbody>
                  {d.quoteModules.map((q) => (
                    <tr key={q.name}>
                      <td style={{ ...tdS, fontWeight: 700, color: '#0f172a' }}>{q.name}</td>
                      <td style={tdS}>{q.desc}</td>
                      <td style={{ ...tdS, textAlign: 'center' }}>
                        <button type="button" style={quoteBtnS} onClick={() => scrollToId('contact')}>{d.quoteBtn}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* COMPARATIF */}
      <section id="comp" className="comp">
        <div className="section-tag" style={{ display: 'block', margin: '0 auto 16px', textAlign: 'center' }}>{d.compTag}</div>
        <h2 className="section-title" style={{ margin: '0 auto 12px', textAlign: 'center' }}>
          {d.compTitleA} <span className="accent">{d.compAccent}</span>
        </h2>
        <p className="section-sub" style={{ margin: '0 auto 36px', textAlign: 'center' }}>{d.compSub}</p>
        <div className="comp-wrapper">
          <table className="comp-table">
            <thead>
              <tr>
                <th className="comp-corner">{d.compCorner}</th>
                <th className="comp-plan">
                  <div className="comp-plan-name">Starter</div>
                  <div className="comp-plan-price">{d.fromShort} <strong>{fmt(annualMonthly.starter)} €</strong> HT{lang === 'en' ? ' / mo' : ' / mois'}</div>
                  <button type="button" className="comp-cta" onClick={() => goToCheckout('starter')}>{d.compTrial}</button>
                </th>
                <th className="comp-plan comp-plan-featured">
                  <div className="comp-plan-badge">{d.popularBadge}</div>
                  <div className="comp-plan-name">Standard</div>
                  <div className="comp-plan-price">{d.fromShort} <strong>{fmt(annualMonthly.standard)} €</strong> HT{lang === 'en' ? ' / mo' : ' / mois'}</div>
                  <button type="button" className="comp-cta comp-cta-primary" onClick={() => goToCheckout('standard')}>{d.compTrial}</button>
                </th>
                <th className="comp-plan">
                  <div className="comp-plan-name" style={{ color: '#b8860b' }}>Premium</div>
                  <div className="comp-plan-price">{d.fromShort} <strong>{fmt(annualMonthly.premium)} €</strong> HT{lang === 'en' ? ' / mo' : ' / mois'}</div>
                  <button type="button" className="comp-cta comp-cta-premium" onClick={() => goToCheckout('premium')}>{d.compTrial}</button>
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row, idx) => {
                if (row.type === 'section') {
                  return <tr key={`s-${idx}`} className="comp-section-row"><td colSpan={4}>{row.label}</td></tr>;
                }
                return (
                  <tr key={`f-${idx}`} className="comp-feature-row">
                    <td>{row.label}</td>
                    <td className="comp-cell">{renderComparisonCell(row.s)}</td>
                    <td className="comp-cell comp-cell-featured">{renderComparisonCell(row.st)}</td>
                    <td className="comp-cell">{renderComparisonCell(row.b)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* INFORMATIONS COMMERCIALES */}
      <section className="info-box">
        <h3>{d.infoTitle}</h3>
        <p><strong>{d.infoLead}</strong></p>
        <ul>{d.infoItems.map((it, i) => <li key={i}>{it}</li>)}</ul>
        <p>{d.infoP1}</p>
        <p>{d.infoP2}</p>
        <p style={{ marginBottom: 0 }}>{d.infoP3}</p>
      </section>

      {/* PROMO CTA */}
      <div className="promo-cta-section">
        <div className="promo-cta-badge">{d.pctaBadge}</div>
        <h2>{d.pctaH2}</h2>
        <p>{d.pctaP}</p>
        <div className="promo-feats">
          <div className="pf"><span className="pf-check">✓</span><span>{d.pf1}</span></div>
          <div className="pf"><span className="pf-check">✓</span><span>{d.pf2}</span></div>
          <div className="pf"><span className="pf-check">✓</span><span>{d.pf3}</span></div>
          <div className="pf"><span className="pf-check">✓</span><span>{d.pf4}</span></div>
        </div>
        <button type="button" className="btn-cta-light" onClick={goToSignup}>{d.pctaBtn}</button>
      </div>

      {/* CONTACT */}
      <section id="contact" className="contact">
        <div className="contact-inner">
          <div>
            <h2 className="contact-title">{d.ctTitle}</h2>
            <p className="contact-sub">{d.ctSub}</p>
            <div className="info-list">
              <div className="info-item"><div className="info-icon">✉</div><div><div className="info-label">{d.ctEl}</div><a className="info-value" href="mailto:contact@concorde-tech.fr">contact@concorde-tech.fr</a></div></div>
              <div className="info-item"><div className="info-icon">📍</div><div><div className="info-label">{d.ctAl}</div><div className="info-value">{d.ctAv}</div></div></div>
              <div className="info-item"><div className="info-icon">🕐</div><div><div className="info-label">{d.ctHl}</div><div className="info-value">{d.ctHv}</div></div></div>
              <div className="info-item"><div className="info-icon">🚀</div><div><div className="info-label">{d.ctDl}</div><div className="info-value">{d.ctDv}</div></div></div>
            </div>
            <div className="trial-box">
              <div className="trial-title">{d.trialTitle}</div>
              <div className="trial-sub">{d.trialSub}</div>
              <button type="button" className="trial-btn" onClick={goToSignup}>{d.trialNowBtn}</button>
            </div>
          </div>
          <div>
            <div className="form-card">
              <h3 className="form-title">{d.formTitle}</h3>
              <form className="contact-form" onSubmit={handleContactSubmit}>
                <div className="form-row">
                  <div className="form-field"><label>{d.flPrenom}</label><input type="text" placeholder="Marie" /></div>
                  <div className="form-field"><label>{d.flNom}</label><input type="text" placeholder="Dupont" /></div>
                </div>
                <div className="form-field"><label>{d.flEmail}</label><input type="email" placeholder="marie.dupont@entreprise.fr" /></div>
                <div className="form-field"><label>{d.flEnt}</label><input type="text" placeholder={d.flEnt} /></div>
                <div className="form-field"><label>{d.flEmp}</label>
                  <select defaultValue=""><option value="" disabled>{d.flEmpSel}</option><option>1 – 10</option><option>11 – 50</option><option>51 – 200</option></select>
                </div>
                <div className="form-field"><label>{d.flObj}</label>
                  <select defaultValue=""><option value="" disabled>{d.flObjSel}</option><option>{d.flObjDemo}</option><option>{d.flObjEnt}</option><option>{d.flObjRec}</option><option>{d.flObjAut}</option></select>
                </div>
                <div className="form-field"><label>{d.flMsg}</label><textarea rows={4} placeholder={d.flMsgPh} /></div>
                <button type="submit" className="form-submit">{d.formSubmit}</button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="footer-grid">
          <div>
            <div className="footer-logo">
              <img src={LOGO_SRC} alt="Concorde Workforce" />
              <span>Concorde Workforce</span>
            </div>
            <div className="footer-desc">{d.fDesc}</div>
            <div className="footer-flags">🇫🇷 🇧🇪 🇲🇦 🇸🇳 · {d.fFlags}</div>
            <div className="footer-social">
              <a href="https://www.linkedin.com/company/concorde-tech-innovation/about/" target="_blank" rel="noopener noreferrer" className="si" aria-label="LinkedIn">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
              </a>
              <a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer" className="si" aria-label="Instagram">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" /></svg>
              </a>
              <a href="https://www.facebook.com/" target="_blank" rel="noopener noreferrer" className="si" aria-label="Facebook">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
              </a>
              <a href="https://www.youtube.com/" target="_blank" rel="noopener noreferrer" className="si" aria-label="YouTube">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>
              </a>
              <a href="mailto:contact@concorde-tech.fr" className="si" aria-label="Email">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" /></svg>
              </a>
            </div>
          </div>
          <div className="footer-col">
            <h4>{d.fcol1}</h4>
            <div className="footer-links">
              <a onClick={() => scrollToId('pricing')}>{d.flPricing}</a>
              <a href={DOWNLOAD_URL} target="_blank" rel="noopener noreferrer">{d.flMobile}</a>
              <a onClick={() => scrollToId('contact')}>{d.flContact}</a>
            </div>
          </div>
          <div className="footer-col">
            <h4>{d.fcol2}</h4>
            <div className="footer-links">
              <a onClick={() => navigate('/about')}>{d.flAbout}</a>
              <a onClick={goToLogin}>{d.flLogin}</a>
              <a onClick={goToSignup}>{d.flSignup}</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>{d.copyright}</span>
          <span className="footer-bottom-links">
            <a href="/docs/politique-confidentialite.pdf" target="_blank" rel="noopener noreferrer">{d.privacy}</a>
            <a href="/docs/cgu.pdf" target="_blank" rel="noopener noreferrer">{d.cgu}</a>
            <a href="/docs/mentions-legales.pdf" target="_blank" rel="noopener noreferrer">{d.legal}</a>
            <a onClick={() => openCookieConsent()}>{d.cookies}</a>
          </span>
        </div>
      </footer>

      {/* Popup d'inscription (essai gratuit 30 j) — formulaire signup direct, sans
          sélecteur de pack (pack Standard par défaut, modifiable ensuite). */}
      <Dialog
        open={signupOpen}
        onClose={() => setSignupOpen(false)}
        maxWidth="sm"
        fullWidth
        scroll="body"
        PaperProps={{ sx: { borderRadius: '20px', overflow: 'visible' } }}
      >
        <IconButton
          aria-label="Fermer"
          onClick={() => setSignupOpen(false)}
          sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1, color: '#64748b' }}
        >
          <CloseIcon />
        </IconButton>
        <DialogContent sx={{ p: { xs: 2, sm: 3 } }}>
          {/* Wrapper .home-page : réinjecte les styles scopés de la carte d'auth
              (le Dialog est portalisé hors de .hp2 — voir HomePage.css). */}
          <div className="home-page home-page-dialog">
            <InlineAuthCard defaultTab="register" hidePlanPicker />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
