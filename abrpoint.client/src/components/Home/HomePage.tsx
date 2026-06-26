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
import { sendSupportMessage } from '../../services/ContactService';
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
  csLimites: string; cfCollab: string; cfSites: string; cfAdmins: string; cfStockage: string; cfSupport: string;
  cvSup1: string; cvSup2: string; cvSup3: string; cvUnlimited: string;
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
  flPricing: string; flMobile: string; flContact: string; flLogin: string; flSignup: string;
  flPointage: string; flConges: string; flPersonnel: string;
  copyright: string; privacy: string; cgu: string; legal: string; cookies: string; accountDeletion: string;
  // ── MISE À JOUR MAQUETTE v2-2 ──────────────────────────────────────────────
  // HERO : 2e paragraphe, mention « sans CB », encart compatibilité pointeuse, 5e gage.
  heroLead2: string; heroNoCard: string;
  heroCompatTitle: string; heroCompatDesc: string; heroCompatCta: string; t5: string; t6: string;
  // DOWNLOAD enrichi (sous-titre en gras + texte, liste de fonctionnalités, conclusion, 3 stores).
  dlSubBold: string; dlSubText: string; dlFeatsTitle: string; dlFeats: string[];
  dlOutroBold: string; dlOutroText: string;
  stApkSmall: string; stApkLarge: string; stGoogleSmall: string; stGoogleLarge: string;
  stAppleSmall: string; stAppleLarge: string;
  // PRICING : note de bas de carte Premium (compatibilité fabricants).
  premiumFootnote: string;
  // ENTERPRISE PLUS — panneau « Entreprises sur mesure » (remplace la 4e carte).
  epxRibbon: string; epxEyebrow: string; epxTitleA: string; epxTitleB: string;
  epxLeadPre: string; epxLeadBold: string; epxDesc: string;
  epxFeats: Avantage[]; epxAccoTitle: string; epxAccoItems: string[];
  epxSlaStrong: string; epxSlaSpan: string;
  epxContactStrong: string; epxContactSpan: string; epxContactBtn: string;
  epxRightHead: string; epxCaps: Avantage[]; epxPartnerStrong: string; epxPartnerSpan: string;
  // ── OFFRE FONDATEUR — maquette claire « offre-fondateur-clair » (jauge radiale) ──
  fdrEyebrow: string; fdrTitlePre: string; fdrTitleAccent: string;
  fdrSubExcl: string; fdrSubClose: string;
  fdrCta: string; fdrReassureBold: string; fdrReassureRest: string;
  fdrDaysLabel: string; fdrBadge: string;
  // 6 avantages (icône SVG fixe rendue par index) + 4 gages de confiance.
  fdrBenefits: { t: string; d: string }[]; fdrTrust: string[];
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
    { icon: '🎁', t: "30 jours d'essai gratuit", d: 'Toutes les fonctionnalités' },
    { icon: '💳', t: 'Sans carte bancaire', d: 'Aucun engagement requis' },
    { icon: '🎓', t: 'Accompagnement au démarrage', d: 'Mise en route guidée' },
    { icon: '🏷️', t: "−20 % sur l'engagement annuel", d: 'Tarif préférentiel Fondateur' },
    { icon: '⚡', t: 'Mise en service rapide', d: 'Opérationnel sans délai' },
  ],
  promoCta: "🌟 Rejoindre l'offre Fondateur →",
  pt1: '🛡 Sécurisé & conforme RGPD', pt2: '🏦 Hébergement France OVH', pt3: '⚡ Mise en place en 48h', pt4: '🎧 Support francophone humain',

  sl1: 'Entreprises clientes', sl2: 'Multi-pays', sl3: 'Absentéisme moyen', sl4: 'Pour déployer',

  dlTag: '📱 Application mobile', dlTitle: "Téléchargez l'app Concorde Workly",
  dlSubA: 'Android · Mode offline · Géolocalisation optionnelle. Rendez-vous sur',
  dlSubB: 'pour récupérer la dernière version.',

  howTag: 'Découvrir la plateforme', howTitle: 'Opérationnel en', howAccent: '2 semaines',
  howSub: 'Un déploiement guidé, sans technicien, sans résistance interne.',
  steps: [
    { title: 'Inscrivez-vous & validez votre SIRET', desc: "Création du compte en 5 minutes. Vérification automatique du numéro d'entreprise (SIRET FR, BCE BE, ICE MA, NINEA SN).", long: "Création du compte en 5 minutes. Vérification automatique du numéro d'entreprise (SIRET FR, BCE BE, ICE MA, NINEA SN). Aucune installation, aucun technicien requis : vous démarrez immédiatement depuis votre navigateur." },
    { title: 'Importez vos équipes', desc: "Upload CSV ou saisie manuelle de vos collaborateurs, sites et départements. Paramétrage en moins d'une heure.", long: "Upload CSV ou saisie manuelle de vos collaborateurs, sites et départements. Paramétrage en moins d'une heure. Vos données sont chiffrées et hébergées en France dès l'import." },
    { title: 'Déployez sur le terrain', desc: 'Application mobile pour les collaborateurs. Pointeuses biométriques compatibles. Mode offline disponible.', long: 'Application mobile pour les collaborateurs. Pointeuses biométriques compatibles. Mode offline disponible pour les sites sans connexion. Déploiement progressif site par site.' },
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
  pi3: '100 collaborateurs inclus · 200 Go stockage sécurisé',
  extraCollab: 'puis +{price} € HT / mois par collaborateur supplémentaire',
  starterFeatures: ["Jusqu'à 10 collaborateurs", '1 administrateur', 'Pointage Web', 'Gestion RH essentielle', 'Fiches salariés', 'Congés et absences', 'Tableau de bord RH', 'Notifications e-mail', 'Export Excel', 'Hébergement sécurisé France (OVH)', '10 Go stockage sécurisé', 'Support standard'],
  standardFeatures: ['Tout le pack Starter', "Jusqu'à 25 collaborateurs", '2 administrateurs', 'Application mobile Workly', 'Pointage mobile', 'Géolocalisation optionnelle', 'Signature électronique', 'Coffre numérique salarié', 'Import Excel en masse', 'Préparation paie', 'Export paie', 'Congés, RTT et CET', 'Notifications push et e-mail', 'Reporting RH avancé', 'Multi-sites simple', '50 Go stockage sécurisé', 'Support prioritaire'],
  businessFeatures: ['Tout le pack Standard', "Jusqu'à 100 collaborateurs", 'Administrateurs illimités', 'Multi-sites avancé', 'Workflow de validation avancé', 'Tableaux de bord RH avancés', 'Exports personnalisés', 'Connecteur pointeuses biométriques', 'Compatibilité terminaux de pointage existants*', 'Assistant IA RH', 'Audit et journaux avancés', 'Supervision avancée', 'API standard', '200 Go stockage sécurisé', 'SLA prioritaire', 'Onboarding accompagné'],
  entFeatures: ['IA RH avancée', 'Recherche documentaire', 'Workflows intelligents', 'API avancées & SSO', 'Hébergement dédié', 'Architecture sur mesure'],
  entPriceLabel: 'Sur devis', entAmount: 'Tarification', entAmountSuffix: ' personnalisée',
  entCommit: 'selon votre structure & volume', entSub: 'Administrateurs illimités · Onboarding accompagné', entCta: 'Demander un devis →',
  trialBtn: 'Essai gratuit 30j', demoCard: '🎬 Demander une démo gratuitement',
  pricingFoot: 'Sans engagement de durée · TVA en sus · Facturation Stripe sécurisée',

  compTag: 'Comparatif détaillé', compTitleA: 'Tout ce qui est inclus dans', compAccent: 'chaque pack',
  compSub: 'La matrice complète des modules et fonctionnalités, pack par pack. Choisissez en toute transparence.',
  compCorner: 'Fonctionnalités', fromShort: 'à partir de', compTrial: 'Essai gratuit 30j',
  csPointage: 'Pointage & présence', cfWeb: 'Pointage web', cfMobile: 'Application mobile', cfGeo: 'Pointage géolocalisé',
  csEmp: 'Gestion des employés', cfFiches: 'Fiches collaborateurs', cfCoffre: 'Coffre numérique', cfSign: 'Signature électronique',
  csConges: 'Congés & absences', cfConges: 'Demandes de congés', csPaie: 'Paie & frais', cfPaie: 'Préparation paie · export paie',
  csSecu: 'Sécurité & conformité', cfOvh: 'Hébergement France OVH', cfCrypto: 'Chiffrement AES-256 + TLS 1.3', cfBrand: 'Branding personnalisé',
  csLimites: 'Limites & quotas', cfCollab: 'Collaborateurs inclus', cfSites: 'Sites inclus', cfAdmins: 'Administrateurs', cfStockage: 'Stockage inclus', cfSupport: 'Support',
  cvSup1: 'Standard', cvSup2: 'Prioritaire', cvSup3: 'SLA prioritaire', cvUnlimited: 'Illimités',

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
  flPointage: 'Pointage', flConges: 'Congés & absences', flPersonnel: 'Gestion du personnel',
  flLogin: 'Se connecter', flSignup: 'Créer un compte',
  copyright: '© 2026 Concorde Workforce · Tous droits réservés',
  privacy: 'Confidentialité', cgu: 'CGUS', legal: 'Mentions légales', cookies: 'Cookies',
  accountDeletion: 'Suppression de compte',

  heroLead2: "Conservez votre matériel actuel ou passez au pointage mobile Workly. Concorde Workforce s'adapte à votre organisation.",
  heroNoCard: 'Sans carte bancaire',
  heroCompatTitle: 'Vous possédez déjà une pointeuse ?',
  heroCompatDesc: "Notre équipe étudie gratuitement les possibilités d'intégration avec votre matériel existant.",
  heroCompatCta: 'Vérifier la compatibilité de ma pointeuse',
  t5: 'Assurance Cyber Professionnelle', t6: 'Paiement sécurisé',

  dlSubBold: 'Le compagnon mobile de vos collaborateurs.',
  dlSubText: 'Pointage mobile, géolocalisation optionnelle, signature électronique, transfert sécurisé de documents, coffre-fort numérique RH, gestion des horaires, congés et absences — tout est accessible depuis une seule application.',
  dlFeatsTitle: 'Fonctionnalités principales',
  dlFeats: [
    'Pointage mobile en temps réel',
    'Géolocalisation optionnelle pour les équipes terrain',
    'Demandes et validation des congés',
    'Gestion des horaires et suivi du temps de travail',
    'Signature électronique des documents RH',
    'Transfert sécurisé de documents',
    'Coffre-fort numérique salarié',
    'Consultation des bulletins et documents RH',
    'Notifications et alertes en temps réel',
    'Mode hors connexion (Offline)',
  ],
  dlOutroBold: 'Workly simplifie le quotidien des salariés et des managers.',
  dlOutroText: " Depuis leur smartphone, les collaborateurs peuvent pointer, consulter leurs horaires, transmettre des documents, signer électroniquement des formulaires RH et accéder à leur coffre-fort numérique sécurisé.",
  stApkSmall: 'APK direct', stApkLarge: 'concorde-work-force.com',
  stGoogleSmall: 'Disponible sur', stGoogleLarge: 'Google Play',
  stAppleSmall: "Télécharger dans l'", stAppleLarge: 'App Store',

  premiumFootnote: '* Compatible avec les principaux fabricants (ZKTeco, Hikvision, Suprema, Anviz, etc.). Intégration spécifique sur étude.',

  epxRibbon: 'OFFRE GRANDS COMPTES',
  epxEyebrow: 'Enterprise Plus',
  epxTitleA: 'Entreprises', epxTitleB: 'sur mesure',
  epxLeadPre: 'Une solution RH construite pour ', epxLeadBold: 'les organisations ambitieuses',
  epxDesc: "Concorde Workforce s'adapte à votre organisation, vos processus et vos enjeux. Une plateforme évolutive, sécurisée et 100 % modulable.",
  epxFeats: [
    { icon: '👥', t: '+500 salariés', d: 'Idéal pour les grandes entreprises' },
    { icon: '🏢', t: 'Multi-filiales & multi-sociétés', d: 'Centralisez toutes vos entités' },
    { icon: '🌍', t: 'Déploiement national ou international', d: 'Une solution sans frontières' },
    { icon: '🎚️', t: 'Tarification sur mesure', d: 'Selon votre structure, vos volumes et vos besoins' },
  ],
  epxAccoTitle: 'Accompagnement Premium',
  epxAccoItems: ['Chef de projet dédié', 'Onboarding personnalisé', 'Formation et transfert de compétences', 'Support prioritaire 24/7'],
  epxSlaStrong: 'SLA Entreprise garanti', epxSlaSpan: 'Engagement de service et réactivité maximale',
  epxContactStrong: 'Parlons de votre projet',
  epxContactSpan: 'Nos experts vous proposent une étude personnalisée et une démonstration adaptée à vos besoins.',
  epxContactBtn: 'Demander une étude personnalisée →',
  epxRightHead: 'Votre solution 100 % personnalisée',
  epxCaps: [
    { icon: '✓', t: 'Administrateurs illimités', d: 'Gestion des accès avancée et sécurisée' },
    { icon: '✓', t: 'Salariés illimités', d: 'Aucun plafond, aucune contrainte' },
    { icon: '✓', t: 'Multi-filiales & multi-entités', d: 'Gestion centralisée ou décentralisée' },
    { icon: '✓', t: 'IA RH avancée & recherche documentaire', d: 'Automatisez, analysez, décidez' },
    { icon: '✓', t: 'Workflows intelligents', d: 'Processus sur mesure et automatisations' },
    { icon: '✓', t: 'API avancées & SSO', d: 'Azure AD, Google, Microsoft 365, Okta, …' },
    { icon: '✓', t: 'Connecteurs ERP & Paie', d: 'SAP, Sage, Cegid, ADP, et plus encore' },
    { icon: '✓', t: 'Compatibilité terminaux de pointage', d: 'Intégration avec de nombreux terminaux' },
    { icon: '✓', t: 'Hébergement dédié & sécurité renforcée', d: 'Infrastructure dédiée en France ou UE' },
    { icon: '✓', t: 'Architecture sur mesure', d: 'Développements spécifiques & évolutifs' },
    { icon: '✓', t: 'Développement spécifique', d: 'Modules et fonctionnalités sur mesure développés pour vos process métier' },
    { icon: '✓', t: 'Agent vocal IA', d: 'Pointage et requêtes RH en langage naturel, pilotés par la voix' },
    { icon: '✓', t: 'SLA Entreprise & support prioritaire 24/7', d: 'Engagement de service et réactivité maximale' },
  ],
  epxPartnerStrong: "Plus qu'un logiciel, un partenaire de croissance",
  epxPartnerSpan: "Concorde Workforce vous accompagne aujourd'hui et à chaque étape de votre développement.",

  fdrEyebrow: 'Offre Fondateur · Été 2026',
  fdrTitlePre: 'Conditions tarifaires préférentielles ',
  fdrTitleAccent: 'Fondateur',
  fdrSubExcl: 'une fenêtre exclusive',
  fdrSubClose: ', puis on referme.',
  fdrCta: "Rejoindre l'offre Fondateur",
  fdrReassureBold: 'Sans carte bancaire', fdrReassureRest: ' · sans engagement',
  fdrDaysLabel: 'jours restants',
  fdrBadge: 'Fenêtre Fondateur · 1 juin → 31 août',
  fdrBenefits: [
    { t: '1 mois offert', d: 'Sans carte bancaire' },
    { t: 'Activation rapide', d: 'Opérationnel en 48 h' },
    { t: 'Onboarding inclus', d: 'Accompagnement expert' },
    { t: 'Support prioritaire', d: 'Accès file prioritaire' },
    { t: 'Accès anticipé', d: 'Nouvelles fonctionnalités' },
    { t: 'Sans engagement', d: "Vous décidez après l'essai" },
  ],
  fdrTrust: ['Sécurisé & conforme RGPD', 'Hébergement France · OVH', 'Mise en place en 48 h', 'Support francophone humain'],
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
    { icon: '🎁', t: '30-day free trial', d: 'All features' },
    { icon: '💳', t: 'No credit card', d: 'No commitment required' },
    { icon: '🎓', t: 'Start-up guidance', d: 'Guided onboarding' },
    { icon: '🏷️', t: '−20% on annual commitment', d: 'Preferential Founder rate' },
    { icon: '⚡', t: 'Fast go-live', d: 'Operational without delay' },
  ],
  promoCta: '🌟 Join the Founder offer →',
  pt1: '🛡 Secure & GDPR compliant', pt2: '🏦 Hosted in France OVH', pt3: '⚡ Set up in 48h', pt4: '🎧 Human French-speaking support',

  sl1: 'Client companies', sl2: 'Multi-country', sl3: 'Avg absenteeism', sl4: 'To deploy',

  dlTag: '📱 Mobile app', dlTitle: 'Download the Concorde Workly app',
  dlSubA: 'Android · Offline mode · Optional geolocation. Visit',
  dlSubB: 'to get the latest version.',

  howTag: 'Discover the platform', howTitle: 'Operational in', howAccent: '2 weeks',
  howSub: 'A guided deployment, without a technician, without internal resistance.',
  steps: [
    { title: 'Sign up & validate your company number', desc: 'Account creation in 5 minutes. Automatic verification of your company number (SIRET FR, BCE BE, ICE MA, NINEA SN).', long: 'Account creation in 5 minutes. Automatic verification of your company number (SIRET FR, BCE BE, ICE MA, NINEA SN). No installation, no technician required: you start right away from your browser.' },
    { title: 'Import your teams', desc: 'CSV upload or manual entry of your employees, sites and departments. Setup in under an hour.', long: 'CSV upload or manual entry of your employees, sites and departments. Setup in under an hour. Your data is encrypted and hosted in France from the very first import.' },
    { title: 'Deploy in the field', desc: 'Android mobile app for employees. Compatible biometric terminals. Offline mode available.', long: 'Android mobile app for employees. Compatible biometric terminals. Offline mode available for sites without connectivity. Gradual roll-out, site by site.' },
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
  pi3: '100 users included · 200 GB secure storage',
  extraCollab: 'then +€{price} excl. tax / mo per additional employee',
  starterFeatures: ['Up to 10 employees', '1 administrator', 'Web clocking', 'Essential HR management', 'Employee records', 'Leave and absences', 'HR dashboard', 'Email notifications', 'Excel export', 'Secure hosting in France (OVH)', '10 GB secure storage', 'Standard support'],
  standardFeatures: ['Everything in Starter', 'Up to 25 employees', '2 administrators', 'Workly mobile app', 'Mobile clocking', 'Optional geolocation', 'Electronic signature', 'Employee digital vault', 'Bulk Excel import', 'Payroll preparation', 'Payroll export', 'Leave, RTT and time-off account', 'Push and email notifications', 'Advanced HR reporting', 'Simple multi-site', '50 GB secure storage', 'Priority support'],
  businessFeatures: ['Everything in Standard', 'Up to 100 employees', 'Unlimited administrators', 'Advanced multi-site', 'Advanced approval workflow', 'Advanced HR dashboards', 'Custom exports', 'Biometric time-clock connector', 'Compatibility with existing clocking terminals', 'HR AI Assistant', 'Advanced audit and logs', 'Advanced supervision', 'Standard API', '200 GB secure storage', 'Priority SLA', 'Guided onboarding'],
  entFeatures: ['Advanced HR AI', 'Document search', 'Smart workflows', 'Advanced APIs & SSO', 'Dedicated hosting', 'Tailor-made architecture'],
  entPriceLabel: 'Custom quote', entAmount: 'Custom', entAmountSuffix: ' pricing',
  entCommit: 'based on your structure & volume', entSub: 'Unlimited administrators · Guided onboarding', entCta: 'Request a quote →',
  trialBtn: '30-day free trial', demoCard: '🎬 Request a free demo',
  pricingFoot: 'No time commitment · VAT extra · Secure Stripe billing',

  compTag: 'Detailed comparison', compTitleA: 'Everything included in', compAccent: 'each plan',
  compSub: 'The complete feature matrix, plan by plan. Choose with full transparency.',
  compCorner: 'Features', fromShort: 'from', compTrial: '30-day free trial',
  csPointage: 'Time tracking & attendance', cfWeb: 'Web time tracking', cfMobile: 'Mobile app (Android)', cfGeo: 'Geolocated time tracking',
  csEmp: 'Employee management', cfFiches: 'Employee records', cfCoffre: 'Digital vault', cfSign: 'Electronic signature',
  csConges: 'Leave & absences', cfConges: 'Leave requests', csPaie: 'Payroll & expenses', cfPaie: 'Payroll preparation · payroll export',
  csSecu: 'Security & compliance', cfOvh: 'Hosted in France OVH', cfCrypto: 'AES-256 + TLS 1.3 encryption', cfBrand: 'Custom branding',
  csLimites: 'Limits & quotas', cfCollab: 'Employees included', cfSites: 'Sites included', cfAdmins: 'Administrators', cfStockage: 'Storage included', cfSupport: 'Support',
  cvSup1: 'Standard', cvSup2: 'Priority', cvSup3: 'Priority SLA', cvUnlimited: 'Unlimited',

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
  flPointage: 'Time tracking', flConges: 'Leave & absences', flPersonnel: 'Staff management',
  flLogin: 'Log in', flSignup: 'Create account',
  copyright: '© 2026 Concorde Workforce · All rights reserved',
  privacy: 'Privacy', cgu: 'Terms', legal: 'Legal notice', cookies: 'Cookies',
  accountDeletion: 'Account deletion',

  heroLead2: 'Keep your current hardware or switch to Workly mobile clocking. Concorde Workforce adapts to your organization.',
  heroNoCard: 'No credit card',
  heroCompatTitle: 'Already have a time clock?',
  heroCompatDesc: 'Our team assesses integration options with your existing hardware free of charge.',
  heroCompatCta: "Check my time clock's compatibility",
  t5: 'Professional Cyber Insurance', t6: 'Secure payment',

  dlSubBold: "Your employees' mobile companion.",
  dlSubText: 'Mobile clocking, optional geolocation, electronic signature, secure document transfer, HR digital vault, schedule management, leave and absences — all from a single app.',
  dlFeatsTitle: 'Key features',
  dlFeats: [
    'Real-time mobile clocking',
    'Optional geolocation for field teams',
    'Leave requests and approvals',
    'Schedule management and working-time tracking',
    'Electronic signature of HR documents',
    'Secure document transfer',
    'Employee digital vault',
    'Access to payslips and HR documents',
    'Real-time notifications and alerts',
    'Offline mode',
  ],
  dlOutroBold: 'Workly simplifies everyday life for employees and managers.',
  dlOutroText: ' From their smartphone, employees can clock in, view their schedules, submit documents, electronically sign HR forms and access their secure digital vault.',
  stApkSmall: 'Direct APK', stApkLarge: 'concorde-work-force.com',
  stGoogleSmall: 'Available on', stGoogleLarge: 'Google Play',
  stAppleSmall: 'Download on the', stAppleLarge: 'App Store',

  premiumFootnote: '* Compatible with major manufacturers (ZKTeco, Hikvision, Suprema, Anviz, etc.). Specific integration upon assessment.',

  epxRibbon: 'KEY ACCOUNTS OFFER',
  epxEyebrow: 'Enterprise Plus',
  epxTitleA: 'Tailor-made', epxTitleB: 'enterprises',
  epxLeadPre: 'An HR solution built for ', epxLeadBold: 'ambitious organizations',
  epxDesc: 'Concorde Workforce adapts to your organization, your processes and your challenges. A scalable, secure and 100% modular platform.',
  epxFeats: [
    { icon: '👥', t: '500+ employees', d: 'Ideal for large enterprises' },
    { icon: '🏢', t: 'Multi-subsidiary & multi-company', d: 'Centralize all your entities' },
    { icon: '🌍', t: 'National or international rollout', d: 'A borderless solution' },
    { icon: '🎚️', t: 'Custom pricing', d: 'Based on your structure, volumes and needs' },
  ],
  epxAccoTitle: 'Premium support',
  epxAccoItems: ['Dedicated project manager', 'Personalized onboarding', 'Training and skills transfer', '24/7 priority support'],
  epxSlaStrong: 'Guaranteed Enterprise SLA', epxSlaSpan: 'Service commitment and maximum responsiveness',
  epxContactStrong: "Let's talk about your project",
  epxContactSpan: 'Our experts offer a personalized assessment and a demo tailored to your needs.',
  epxContactBtn: 'Request a personalized assessment →',
  epxRightHead: 'Your 100% personalized solution',
  epxCaps: [
    { icon: '✓', t: 'Unlimited administrators', d: 'Advanced, secure access management' },
    { icon: '✓', t: 'Unlimited employees', d: 'No cap, no constraint' },
    { icon: '✓', t: 'Multi-subsidiary & multi-entity', d: 'Centralized or decentralized management' },
    { icon: '✓', t: 'Advanced multi-site', d: 'Organization, geolocation and global reporting' },
    { icon: '✓', t: 'Advanced HR AI & document search', d: 'Automate, analyze, decide' },
    { icon: '✓', t: 'Smart workflows', d: 'Custom processes and automations' },
    { icon: '✓', t: 'Advanced APIs & SSO', d: 'Azure AD, Google, Microsoft 365, Okta, …' },
    { icon: '✓', t: 'ERP & Payroll connectors', d: 'SAP, Sage, Cegid, ADP, and more' },
    { icon: '✓', t: 'Time-clock terminal compatibility', d: 'Integration with many terminals' },
    { icon: '✓', t: 'Dedicated hosting & enhanced security', d: 'Dedicated infrastructure in France or EU' },
    { icon: '✓', t: 'Tailor-made architecture', d: 'Specific & scalable developments' },
    { icon: '✓', t: 'Custom development', d: 'Bespoke modules and features built for your business processes' },
    { icon: '✓', t: 'AI voice agent', d: 'Voice-driven clocking and HR queries in natural language' },
    { icon: '✓', t: 'Enterprise SLA & 24/7 priority support', d: 'Service commitment and maximum responsiveness' },
  ],
  epxPartnerStrong: 'More than software, a growth partner',
  epxPartnerSpan: 'Concorde Workforce supports you today and at every stage of your development.',

  fdrEyebrow: 'Founder Offer · Summer 2026',
  fdrTitlePre: 'Preferential Founder ',
  fdrTitleAccent: 'pricing',
  fdrSubExcl: 'an exclusive window',
  fdrSubClose: ', then it closes.',
  fdrCta: 'Join the Founder offer',
  fdrReassureBold: 'No credit card', fdrReassureRest: ' · no commitment',
  fdrDaysLabel: 'days left',
  fdrBadge: 'Founder window · Jun 1 → Aug 31',
  fdrBenefits: [
    { t: '1 month free', d: 'No credit card' },
    { t: 'Fast activation', d: 'Up and running in 48h' },
    { t: 'Onboarding included', d: 'Expert guidance' },
    { t: 'Priority support', d: 'Priority queue access' },
    { t: 'Early access', d: 'New features' },
    { t: 'No commitment', d: 'You decide after the trial' },
  ],
  fdrTrust: ['Secure & GDPR compliant', 'Hosted in France · OVH', 'Set up in 48h', 'French-speaking human support'],
};

const LANG: Record<Lang, Dict> = { fr: FR, en: EN };

// ─── OFFRE FONDATEUR ÉTÉ 2026 — compte à rebours live (1er juin → 31 août 2026) ──
const FOUNDER_OFFER_START = new Date('2026-06-01T00:00:00+02:00');
const FOUNDER_OFFER_END = new Date('2026-09-01T00:00:00+02:00');

// Jauge radiale (maquette « offre-fondateur-clair ») : 12 graduations réparties sur le
// cercle (r=100, viewBox 240×240) + circonférence pour le calcul du stroke-dashoffset.
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * 100; // ≈ 628.3
const GAUGE_TICKS = Array.from({ length: 12 }, (_, i) => {
  const a = (i * 30 * Math.PI) / 180;
  return {
    x1: (120 + 92 * Math.cos(a)).toFixed(1),
    y1: (120 + 92 * Math.sin(a)).toFixed(1),
    x2: (120 + 100 * Math.cos(a)).toFixed(1),
    y2: (120 + 100 * Math.sin(a)).toFixed(1),
  };
});

// Icônes SVG (indépendantes de la langue) des 6 avantages Fondateur, dans l'ordre de fdrBenefits.
const FDR_BENEFIT_ICONS: React.ReactNode[] = [
  <svg key="b0" viewBox="0 0 24 24"><path d="M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" /></svg>,
  <svg key="b1" viewBox="0 0 24 24"><path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2 0-2.8a2 2 0 0 0-3 0zM12 15l-3-3a22 22 0 0 1 8-10c2 0 4 0 6 2s2 4 2 6a22 22 0 0 1-10 8zM9 12H4l2.5-4h4M12 15v5l4-2.5v-4" /></svg>,
  <svg key="b2" viewBox="0 0 24 24"><path d="M22 10 12 5 2 10l10 5 10-5zM6 12v5c0 1 2.7 3 6 3s6-2 6-3v-5M22 10v6" /></svg>,
  <svg key="b3" viewBox="0 0 24 24"><path d="M3 14v-2a9 9 0 0 1 18 0v2M3 14a2 2 0 0 0 2 2h1v-5H5a2 2 0 0 0-2 2zM21 14a2 2 0 0 1-2 2h-1v-5h1a2 2 0 0 1 2 2zM18 16v1a4 4 0 0 1-4 4h-2" /></svg>,
  <svg key="b4" viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg>,
  <svg key="b5" viewBox="0 0 24 24"><path d="M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 9h18M8 3v3M16 3v3M9 15l2 2 4-4" /></svg>,
];

// Icônes SVG des 4 gages de confiance Fondateur, dans l'ordre de fdrTrust.
const FDR_TRUST_ICONS: React.ReactNode[] = [
  <svg key="t0" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  <svg key="t1" viewBox="0 0 24 24"><path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6" /></svg>,
  <svg key="t2" viewBox="0 0 24 24"><path d="M12 8v4l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0z" /></svg>,
  <svg key="t3" viewBox="0 0 24 24"><path d="M3 14v-2a9 9 0 0 1 18 0v2M5 16h1v-5H5a2 2 0 0 0 0 5zM19 16h-1v-5h1a2 2 0 0 1 0 5zM18 16v1a4 4 0 0 1-4 4h-2" /></svg>,
];

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
  if (value === false) return <span className="comp-none" aria-hidden="true" />;
  return <span className="comp-value">{value}</span>;
}

// Logo embarqué en base64 dans la maquette → on réutilise l'asset public existant.
const LOGO_SRC = '/concorde-workly-light.jpg';
const DOWNLOAD_URL = 'https://concorde-work-force.com/download';
// Téléchargement DIRECT de l'APK Android : /api/download/android fait un 302 vers
// l'artefact EAS (cf. Download:ApkUrl côté serveur) → le clic télécharge le .apk
// sans passer par la page intermédiaire /download. L'attribut `download` côté <a>
// force le comportement de téléchargement plutôt qu'une navigation.
const APK_DIRECT_URL = 'https://concorde-work-force.com/api/download/android';
// Fiche App Store (iOS) — application « Concorde Workly » publiée.
const IOS_APP_STORE_URL = 'https://apps.apple.com/us/app/concorde-workly/id6780909371';

// ── Packs payants (parcours d'abonnement) ───────────────────────────────────
// L'essai gratuit 30 jours est accordé UNE seule fois, à l'inscription (signup →
// CreateCustomerAndTrialAsync, sans CB). Les cartes tarifaires ne rouvrent donc PAS
// de Payment Link Stripe externe depuis la home (un tel lien porte un 2e essai 30 j
// → cumul/farming) :
//   • visiteur anonyme     → inscription (essai 30 j) ;
//   • utilisateur connecté → gestion d'abonnement in-app « Mon abonnement »
//     (Changer de pack) — tunnel unique, cf. goToCheckout ci-dessous. La garde
//     serveur ApplyCheckoutSubscription neutralise par ailleurs tout essai dupliqué.
// Enterprise Plus n'a pas de pack (tarification sur devis → section contact).
type PaidPack = 'starter' | 'standard' | 'premium';

// NB : les Payment Links des services ponctuels + la table « Modules sur devis »
// ne sont plus sur la landing publique ; ils ont été déplacés dans la popup
// Espace client (components/Services/ServicesAccompagnementModal), ouverte après
// connexion via le menu avatar (2026-06).

export default function HomePage() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const lang: Lang = i18n.language === 'en' ? 'en' : 'fr';
  const d = LANG[lang];

  const { uticod } = useAuth();
  const isAuthenticated = Boolean(uticod);
  // Label du CTA des cartes de pack : pour un visiteur anonyme c'est l'essai gratuit
  // (accordé au signup) ; pour un connecté (essai/tenant déjà existants) c'est un choix
  // de pack qui mène à « Mon abonnement » — pas un nouvel essai (cf. goToCheckout).
  const cardCtaLabel = isAuthenticated ? (lang === 'fr' ? 'Choisir ce pack' : 'Choose this plan') : d.trialBtn;

  const [signupOpen, setSignupOpen] = useState(false);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('annual');
  const [activeStep, setActiveStep] = useState<StepIndex>(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Formulaire de contact (section CONTACT) — envoi direct via /contact/support.
  const [contactSending, setContactSending] = useState(false);
  const [contactSent, setContactSent] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  const countdown = useFounderCountdown();
  const pad = (n: number) => String(n).padStart(2, '0');

  // Jauge radiale Offre Fondateur : fraction écoulée de la fenêtre (start → end). Recalculée
  // à chaque tick du compte à rebours (re-render 1/s) → l'anneau se remplit en continu.
  const founderElapsedPct = (() => {
    const total = FOUNDER_OFFER_END.getTime() - FOUNDER_OFFER_START.getTime();
    if (total <= 0) return 0;
    const elapsed = Date.now() - FOUNDER_OFFER_START.getTime();
    return Math.min(1, Math.max(0, elapsed / total));
  })();
  const founderDashoffset = (GAUGE_CIRCUMFERENCE * founderElapsedPct).toFixed(1);

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
  // CTA d'une carte de pack payant. L'essai 30 j est accordé UNE seule fois (au signup),
  // donc on ne rouvre jamais de Payment Link externe ici (il porterait un 2e essai) :
  //   • visiteur anonyme     → inscription (essai 30 j sans CB) ;
  //   • utilisateur connecté → page « Mon abonnement » (tunnel in-app unique, cohérent
  //     avec TrialBanner/AjoutEmploye — convention 2026-05-22). Le pack + cycle choisis
  //     sont transmis en query pour pré-ouvrir la modale « Changer de pack ».
  const goToCheckout = (pack: PaidPack) => {
    // Conversion : clic sur une carte payante (intention d'achat / changement de pack).
    trackEvent('begin_checkout', { pack, cycle: billingCycle });
    if (!isAuthenticated) {
      goToSignup();
      return;
    }
    navigate(`/dashboard/mon-abonnement?changePlan=${pack}&cycle=${billingCycle}`);
  };
  // Envoi DIRECT du formulaire de contact via /contact/support (plus de redirection
  // vers /contact-sales). On lit les champs via FormData (name=...). Entreprise et
  // effectif sont repliés dans le corps du message pour garder le contexte côté support.
  const handleContactSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setContactError(null);
    const fd = new FormData(e.currentTarget);
    const prenom = String(fd.get('prenom') ?? '').trim();
    const nom = String(fd.get('nom') ?? '').trim();
    const email = String(fd.get('email') ?? '').trim();
    const entreprise = String(fd.get('entreprise') ?? '').trim();
    const effectif = String(fd.get('effectif') ?? '').trim();
    const objet = String(fd.get('objet') ?? '').trim();
    const message = String(fd.get('message') ?? '').trim();

    if (!prenom || !nom || !email || !objet || !message) {
      setContactError(lang === 'fr'
        ? 'Prénom, nom, email, objet et message sont obligatoires.'
        : 'First name, last name, email, subject and message are required.');
      return;
    }

    setContactSending(true);
    try {
      const context = [
        entreprise ? `Entreprise : ${entreprise}` : null,
        effectif ? `Effectif : ${effectif}` : null,
      ].filter(Boolean).join('\n');
      await sendSupportMessage({
        name: `${prenom} ${nom}`,
        email,
        subject: objet,
        message: context ? `${message}\n\n— ${context}` : message,
      });
      setContactSent(true);
      // Conversions GA — déclenchées UNIQUEMENT sur envoi réussi (pas au clic).
      trackEvent('contact_form_submit');
      trackEvent('generate_lead', { form: 'home-contact', subject: objet });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setContactError(msg ?? (lang === 'fr'
        ? "Échec de l'envoi. Réessayez plus tard."
        : 'Sending failed. Please try again later.'));
    } finally {
      setContactSending(false);
    }
  };

  // ── Comparatif : lignes (labels suivent la langue) ──────────────────────────
  const comparisonRows: CompRow[] = [
    { type: 'section', label: d.csPointage },
    { type: 'feature', label: d.cfWeb, s: true, st: true, b: true },
    // Application mobile réservée Standard/Premium (2026-06) : le Starter est un pack
    // « pointage web ». Le backend bloque la connexion mobile des comptes Starter
    // (PlanFeatures.MobileApp=false → /MobileAuth/login renvoie 402).
    { type: 'feature', label: d.cfMobile, s: false, st: true, b: true },
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
    { type: 'feature', label: d.cfCollab, s: '10', st: '25', b: '100' },
    // Sites & administrateurs : contraintes dures réellement gatées côté serveur
    // (SitesController → MaxSites 1/5/∞ ; UtilisateursController → IncludedAdmins 1/3/∞).
    { type: 'feature', label: d.cfSites, s: '1', st: '5', b: d.cvUnlimited },
    { type: 'feature', label: d.cfAdmins, s: '1', st: '2', b: d.cvUnlimited },
    { type: 'feature', label: d.cfStockage, s: '10 Go', st: '50 Go', b: '200 Go' },
    { type: 'feature', label: d.cfSupport, s: d.cvSup1, st: d.cvSup2, b: d.cvSup3 },
  ];

  const stepNum = activeStep + 1;

  return (
    <div className="hp2">
      <PageSeo
        title={lang === 'en'
          ? 'Concorde Workforce – HR & time-tracking software for SMEs'
          : 'Concorde Workforce – Logiciel RH & pointage pour PME'}
        description={lang === 'en'
          ? 'Manage your SME’s HR with Concorde Workforce: time tracking, leave, contracts and schedules in one platform. Free 1-month trial, no credit card.'
          : 'Gérez la RH de votre PME avec Concorde Workforce : pointage, congés, contrats et plannings réunis dans une seule plateforme. Essai gratuit 1 mois, sans CB.'}
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
          <p className="lead">{d.heroSub}</p>
          <p className="lead2">{d.heroLead2}</p>
          <div className="hero-cta">
            <button type="button" className="btn-hp" onClick={goToSignup}>{d.btnHero1}</button>
            <button type="button" className="btn-hs" onClick={() => scrollToId('contact')}><span>🎬</span> {d.btnHero2}</button>
            {/* Calculateur ROI déplacé ici, à côté des CTA du hero (page dédiée, cf. RoiPage). */}
            <button
              type="button"
              onClick={() => navigate(lang === 'en' ? '/en/roi' : '/roi')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                background: '#0040A1', color: '#fff',
                border: 'none', borderRadius: 999, padding: '12px 26px',
                fontSize: 14.5, fontWeight: 700, letterSpacing: '.01em',
                boxShadow: '0 6px 20px rgba(0,64,161,.28)',
              }}
            >
              🧮 {lang === 'en' ? 'Calculate your ROI' : 'Calculez votre ROI'} <span>→</span>
            </button>
          </div>
          <div className="hero-nocard">✓ {d.heroNoCard}</div>
          {/* Encart compatibilité pointeuse — relié thématiquement à la fonctionnalité
              « Liste des pointeuses » réservée au Premium (cf. PointeuseController). */}
          <div className="hero-compat">
            <div className="hero-compat-body">
              <strong>{d.heroCompatTitle}</strong>
              <span>{d.heroCompatDesc}</span>
            </div>
            <button type="button" className="hero-compat-cta" onClick={() => scrollToId('contact')}>{d.heroCompatCta} <span>→</span></button>
          </div>
          <div className="trust">
            <div className="t"><span className="ti">✓</span><span>{d.t1}</span></div>
            <div className="tsep" />
            <div className="t"><span className="ti">✓</span><span>{d.t2}</span></div>
            <div className="tsep" />
            <div className="t"><span className="ti">✓</span><span>{d.t3}</span></div>
            <div className="tsep" />
            <div className="t"><span className="ti">✓</span><span>{d.t4}</span></div>
            <div className="tsep" />
            <div className="t"><span className="ti">✓</span><span>{d.t5}</span></div>
            <div className="tsep" />
            <div className="t"><span className="ti">✓</span><span>{d.t6}</span></div>
          </div>
        </div>
        <div className="hero-right">
          <video className="hero-video-box" src="/vide_o_finale_.mp4" controls muted loop playsInline autoPlay />
        </div>
      </section>

      {/* OFFRE FONDATEUR — maquette claire « offre-fondateur-clair » (jauge radiale).
          Portée fidèle de la maquette, classes préfixées .fdr-* pour éviter les
          collisions avec .hero/.trust de la landing. L'espace blanc en haut de la
          maquette d'origine (padding body + flex centré) est neutralisé via le CSS. */}
      {!countdown.expired && (
        <section className="fdr" aria-label="Offre Fondateur Été 2026">
          <div className="fdr-hero">
            <div className="fdr-aurora fdr-aur-a" />
            <div className="fdr-aurora fdr-aur-b" />
            <div className="fdr-inner">
              <div className="fdr-top">
                <div>
                  <span className="fdr-eyebrow"><i />{d.fdrEyebrow}</span>
                  <h1 className="fdr-h1">{d.fdrTitlePre}<span className="fdr-accent">{d.fdrTitleAccent}</span></h1>
                  <p className="fdr-sub">
                    {d.promoSubPre} <b>{d.promoDate1}</b> {d.promoMid} <b>{d.promoDate2}</b> — <span className="fdr-c">{d.fdrSubExcl}</span>{d.fdrSubClose}
                  </p>
                  <div className="fdr-actions">
                    <button type="button" className="fdr-cta" onClick={goToSignup}>
                      <span className="fdr-shine" />{d.fdrCta}
                      <span className="fdr-arr"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg></span>
                    </button>
                    <span className="fdr-reassure"><b>{d.fdrReassureBold}</b>{d.fdrReassureRest}</span>
                  </div>
                </div>

                <div className="fdr-gauge" role="img" aria-label={d.cdLabel}>
                  <div className="fdr-sweep" />
                  <svg viewBox="0 0 240 240" aria-hidden="true">
                    <defs><linearGradient id="fdrG" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0" stopColor="#0C53D6" /><stop offset="0.5" stopColor="#1E7BFF" /><stop offset="1" stopColor="#19C5F5" />
                    </linearGradient></defs>
                    <circle className="fdr-track" cx="120" cy="120" r="100" />
                    <circle className="fdr-chrome-ring" cx="120" cy="120" r="112" />
                    <circle
                      className="fdr-prog" cx="120" cy="120" r="100"
                      strokeDasharray={GAUGE_CIRCUMFERENCE.toFixed(1)}
                      strokeDashoffset={founderDashoffset}
                    />
                    <g className="fdr-ticks">
                      {GAUGE_TICKS.map((t, i) => <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} />)}
                    </g>
                  </svg>
                  <div className="fdr-center">
                    <div className="fdr-big">{countdown.jours}</div>
                    <div className="fdr-big-lab">{d.fdrDaysLabel}</div>
                    <div className="fdr-hms"><b>{pad(countdown.heures)}</b>h <b>{pad(countdown.minutes)}</b>m <b>{pad(countdown.secondes)}</b>s</div>
                  </div>
                  <span className="fdr-badge">{d.fdrBadge}</span>
                </div>
              </div>

              <div className="fdr-divider" />

              <section className="fdr-benefits" aria-label="Avantages">
                {d.fdrBenefits.map((b, i) => (
                  <div key={b.t} className="fdr-b">
                    <div className="fdr-ic">{FDR_BENEFIT_ICONS[i]}</div>
                    <div><h3>{b.t}</h3><p>{b.d}</p></div>
                  </div>
                ))}
              </section>

              <div className="fdr-trust">
                {d.fdrTrust.map((t, i) => (
                  <span key={t}>{FDR_TRUST_ICONS[i]}{t}</span>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* DOWNLOAD — application mobile Workly (enrichi maquette v2-2, placé avant les stats) */}
      <div id="download" className="download">
        <div className="dl-info">
          <div className="dl-tag">{d.dlTag}</div>
          <div className="dl-title">{d.dlTitle}</div>
          <div className="dl-sub"><strong>{d.dlSubBold}</strong><br />{d.dlSubText}</div>
          <div className="dl-feats-title">{d.dlFeatsTitle}</div>
          <ul className="dl-feats">
            {d.dlFeats.map((f) => (
              <li key={f}><span className="fi">✅</span><span>{f}</span></li>
            ))}
          </ul>
          <div className="dl-outro"><strong>{d.dlOutroBold}</strong>{d.dlOutroText}</div>
        </div>
        <div className="dl-stores">
          <a className="store-btn" href={APK_DIRECT_URL} download target="_blank" rel="noopener noreferrer">
            <div className="store-icon">⬇</div>
            <div><span className="store-small">{d.stApkSmall}</span><span className="store-large">{d.stApkLarge}</span></div>
          </a>
          <a className="store-btn" href={DOWNLOAD_URL} target="_blank" rel="noopener noreferrer">
            <div className="store-icon"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M3.063 1.94C2.84 2.17 2.71 2.53 2.71 3v18c0 .47.13.83.353 1.06l.06.06L13.2 12.07v-.14L3.123 1.88z" fill="#00d2ff" /><path d="M16.81 15.4l-3.61-3.33v-.14l3.62-3.34.08.05L21.2 10.7c1.23.7 1.23 1.85 0 2.55l-4.3 2.05z" fill="#ffce00" /><path d="M16.89 15.35L13.2 12 3.06 22.06c.41.43 1.07.48 1.83.05l11.99-6.76z" fill="#fd3b4a" /><path d="M16.89 8.65L4.89 1.89C4.13 1.46 3.47 1.51 3.06 1.94L13.2 12z" fill="#00f076" /></svg></div>
            <div><span className="store-small">{d.stGoogleSmall}</span><span className="store-large">{d.stGoogleLarge}</span></div>
          </a>
          <a className="store-btn" href={IOS_APP_STORE_URL} target="_blank" rel="noopener noreferrer">
            <div className="store-icon"><svg viewBox="0 0 384 512" width="22" height="22" fill="#fff" aria-hidden="true"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zM262.1 104.5c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" /></svg></div>
            <div><span className="store-small">{d.stAppleSmall}</span><span className="store-large">{d.stAppleLarge}</span></div>
          </a>
        </div>
      </div>

      {/* STATS */}
      <div className="stats">
        <div className="stat"><div className="stat-num">500+</div><div className="stat-label">{d.sl1}</div></div>
        <div className="stat"><div className="stat-num">5 {lang === 'fr' ? 'pays' : 'countries'}</div><div className="stat-label">{d.sl2}</div></div>
        <div className="stat"><div className="stat-num">−34%</div><div className="stat-label">{d.sl3}</div></div>
        <div className="stat"><div className="stat-num">2 {lang === 'fr' ? 'sem.' : 'wks'}</div><div className="stat-label">{d.sl4}</div></div>
      </div>

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

        <div className="pricing-grid pricing-grid-3">
          {/* STARTER — couleur VERTE (maquette v2-2) */}
          <div className="price-card" style={{ border: '2px solid #0a8a4f', background: 'linear-gradient(180deg,#f1faf4,#fff)' }}>
            <div className="price-tier" style={{ color: '#0a8a4f' }}>Starter</div>
            <div className="price-from">{d.from}</div>
            <div className="price-amount"><span className="cu">€</span>{fmt(prices.starter)}<span className="pe">{d.perMonth}</span></div>
            {!monthly && <div className="price-commit" style={{ color: '#0a8a4f' }}>{d.commitAnnual}</div>}
            {!monthly && <div className="price-cross">{fmt(monthlyBase.starter)}{d.crossSuffix}</div>}
            {!monthly && <div className="price-save">{d.savePrefix}{fmt(annualSavings.starter)}{d.saveSuffix}</div>}
            <div className="price-incl" style={{ color: '#0a8a4f' }}>{d.pi1}</div>
            <div className="price-extra" style={{ fontSize: 12.5, color: '#64748b', margin: '4px 0 2px' }}>{d.extraCollab.replace('{price}', fmt(overageRates.starter))}</div>
            <div className="price-per">{d.annualBill}</div>
            <button type="button" className="btn-trial" style={{ background: 'linear-gradient(135deg,#0a8a4f,#13b06a)', boxShadow: '0 6px 18px rgba(10,138,79,.3)' }} onClick={() => goToCheckout('starter')}>{cardCtaLabel}</button>
            <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--on-v)', margin: '10px 0', fontWeight: 500 }}>✓ {d.noCard}</div>
            <button type="button" className="btn-demo-card" style={{ borderColor: '#0a8a4f', color: '#0a8a4f' }} onClick={() => scrollToId('contact')}>{d.demoCard}</button>
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
            <button type="button" className="btn-trial" onClick={() => goToCheckout('standard')}>{cardCtaLabel}</button>
            <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--on-v)', margin: '10px 0', fontWeight: 500 }}>✓ {d.noCard}</div>
            <button type="button" className="btn-demo-card" onClick={() => scrollToId('contact')}>{d.demoCard}</button>
            <ul className="price-list">{d.standardFeatures.map((f, i) => <li key={i}>{f}</li>)}</ul>
          </div>

          {/* PREMIUM — couleur OR. 100 collaborateurs inclus (aligné PlanCatalog, cf. pi3). */}
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
            <button type="button" className="btn-trial" style={{ background: 'linear-gradient(135deg,#b8860b,#d4af37)', boxShadow: '0 6px 18px rgba(184,134,11,.32)' }} onClick={() => goToCheckout('premium')}>{cardCtaLabel}</button>
            <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--on-v)', margin: '10px 0', fontWeight: 500 }}>✓ {d.noCard}</div>
            <button type="button" className="btn-demo-card" style={{ borderColor: '#b8860b', color: '#b8860b' }} onClick={() => scrollToId('contact')}>{d.demoCard}</button>
            <ul className="price-list">{d.businessFeatures.map((f, i) => <li key={i}>{f}</li>)}</ul>
            <div style={{ fontSize: 11, lineHeight: 1.4, color: '#a67c00', marginTop: 10, textAlign: 'left' }}>{d.premiumFootnote}</div>
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: 28, fontSize: 14, color: '#64748b' }}>{d.pricingFoot}</p>

        {/* ENTERPRISE PLUS — panneau « Entreprises sur mesure » (remplace la 4e carte). */}
        <section className="epx" id="ent-sur-mesure" aria-label="Enterprise Plus — Entreprises sur mesure">
          <div className="epx-panel">
            <div className="epx-left">
              <div className="epx-head">
                <div className="epx-ribbon">
                  <svg viewBox="0 0 576 512" aria-hidden="true"><path d="M309 106c11.4-7 19-19.7 19-34c0-22.1-17.9-40-40-40s-40 17.9-40 40c0 14.4 7.6 27 19 34L209.7 220.6c-9.1 18.2-32.7 23.4-48.6 10.7L72 160c5-6.7 8-15 8-24c0-22.1-17.9-40-40-40S0 113.9 0 136s17.9 40 40 40c.2 0 .5 0 .7 0L86.4 427.4c5.5 30.4 32 52.6 63 52.6H426.6c30.9 0 57.4-22.1 63-52.6L535.3 176c.2 0 .5 0 .7 0c22.1 0 40-17.9 40-40s-17.9-40-40-40s-40 17.9-40 40c0 9 3 17.3 8 24l-89.1 71.3c-15.9 12.7-39.5 7.5-48.6-10.7L309 106z" /></svg>
                  <b>{d.epxRibbon}</b>
                </div>
                <div className="epx-photo" aria-hidden="true">
                  <svg viewBox="0 0 230 215" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <linearGradient id="epxSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#cfe0f7" /><stop offset="1" stopColor="#8fb2e2" /></linearGradient>
                      <linearGradient id="epxG1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#5a86cf" /><stop offset="1" stopColor="#21407e" /></linearGradient>
                      <linearGradient id="epxG2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3f6cbf" /><stop offset="1" stopColor="#1a346b" /></linearGradient>
                      <linearGradient id="epxG3" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6f97d6" /><stop offset="1" stopColor="#2c4f8c" /></linearGradient>
                    </defs>
                    <rect width="230" height="215" fill="url(#epxSky)" />
                    <rect x="14" y="58" width="58" height="157" fill="url(#epxG2)" />
                    <rect x="70" y="18" width="96" height="197" fill="url(#epxG1)" />
                    <rect x="160" y="78" width="60" height="137" fill="url(#epxG3)" />
                    <polygon points="50.6,0 60,0 9,215 0,215" fill="#d4af37" />
                  </svg>
                </div>
                <span className="epx-eyebrow">{d.epxEyebrow}</span>
                <h2 className="epx-title">{d.epxTitleA}<br />{d.epxTitleB}</h2>
                <p className="epx-lead">{d.epxLeadPre}<b>{d.epxLeadBold}</b></p>
                <p className="epx-desc">{d.epxDesc}</p>
              </div>

              <div className="epx-card">
                <div className="epx-feats">
                  {d.epxFeats.map((f) => (
                    <div key={f.t} className="epx-feat">
                      <div className="epx-feat-ic">{f.icon}</div>
                      <strong>{f.t}</strong><span>{f.d}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="epx-card">
                <div className="epx-acco">
                  <div className="epx-acco-l">
                    <div className="epx-acco-badge">🎧</div>
                    <div>
                      <p className="epx-acco-title">{d.epxAccoTitle}</p>
                      <ul>{d.epxAccoItems.map((it) => <li key={it}>{it}</li>)}</ul>
                    </div>
                  </div>
                  <div className="epx-acco-r">
                    <div className="epx-acco-shield">🛡️</div>
                    <strong>{d.epxSlaStrong}</strong>
                    <span>{d.epxSlaSpan}</span>
                  </div>
                </div>
              </div>

              <div className="epx-card">
                <div className="epx-contact">
                  <div className="epx-contact-ic">📞</div>
                  <div className="epx-contact-tx">
                    <strong>{d.epxContactStrong}</strong>
                    <span>{d.epxContactSpan}</span>
                  </div>
                  <button type="button" className="epx-contact-btn" onClick={() => scrollToId('contact')}>{d.epxContactBtn}</button>
                </div>
              </div>
            </div>

            <div className="epx-right">
              <div className="epx-right-head">
                <div className="epx-rh-ic">🏢</div>
                <b>{d.epxRightHead}</b>
              </div>
              <ul className="epx-caps2">
                {d.epxCaps.map((c) => (
                  <li key={c.t} className="epx-cap2">
                    <span className="epx-cap2-ic">✓</span>
                    <div><strong>{c.t}</strong><span>{c.d}</span></div>
                  </li>
                ))}
              </ul>
              <div className="epx-partner">
                <div className="epx-partner-ic">📈</div>
                <div>
                  <strong>{d.epxPartnerStrong}</strong>
                  <span>{d.epxPartnerSpan}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

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
                  <div className="comp-plan-name starter-green">Starter</div>
                  <div className="comp-plan-price">{d.fromShort} <strong>{fmt(annualMonthly.starter)} €</strong> HT{lang === 'en' ? ' / mo' : ' / mois'}</div>
                  <button type="button" className="comp-cta comp-cta-starter" onClick={() => goToCheckout('starter')}>{d.compTrial}</button>
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

      {/* HOW — DÉCOUVRIR LA PLATEFORME (déplacé après le CTA promo, cf. maquette v2-2) */}
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

      {/* CONTACT */}
      <section id="contact" className="contact">
        <div className="contact-inner">
          <div>
            <h2 className="contact-title">{d.ctTitle}</h2>
            <p className="contact-sub">{d.ctSub}</p>
            <div className="info-list">
              <div className="info-item"><div className="info-icon">✉</div><div><div className="info-label">{d.ctEl}</div><a className="info-value" href="mailto:postmaster@concorde-work-force.com">postmaster@concorde-work-force.com</a></div></div>
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
              {contactSent ? (
                <p style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', borderRadius: 12, padding: '16px 18px', lineHeight: 1.6, fontWeight: 600, margin: 0 }}>
                  {lang === 'fr'
                    ? 'Merci ! Votre message a bien été envoyé. Notre équipe vous répond sous 24h ouvrées.'
                    : 'Thank you! Your message has been sent. Our team will reply within 24 business hours.'}
                </p>
              ) : (
              <form className="contact-form" onSubmit={handleContactSubmit}>
                {contactError && (
                  <div style={{ background: '#fff1f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 10, padding: '10px 14px', fontSize: 14, fontWeight: 600 }}>
                    {contactError}
                  </div>
                )}
                <div className="form-row">
                  <div className="form-field"><label>{d.flPrenom}</label><input name="prenom" type="text" placeholder="Marie" /></div>
                  <div className="form-field"><label>{d.flNom}</label><input name="nom" type="text" placeholder="Dupont" /></div>
                </div>
                <div className="form-field"><label>{d.flEmail}</label><input name="email" type="email" placeholder="marie.dupont@entreprise.fr" /></div>
                <div className="form-field"><label>{d.flEnt}</label><input name="entreprise" type="text" placeholder={d.flEnt} /></div>
                <div className="form-field"><label>{d.flEmp}</label>
                  <select name="effectif" defaultValue=""><option value="" disabled>{d.flEmpSel}</option><option>1-19</option><option>20-30</option><option>31-50</option><option>51-100</option><option>101-150</option><option>151-300</option><option>301-500</option><option>501-1000</option><option>1000+</option></select>
                </div>
                <div className="form-field"><label>{d.flObj}</label>
                  <select name="objet" defaultValue=""><option value="" disabled>{d.flObjSel}</option><option>{d.flObjDemo}</option><option>{d.flObjEnt}</option><option>{d.flObjRec}</option><option>{d.flObjAut}</option></select>
                </div>
                <div className="form-field"><label>{d.flMsg}</label><textarea name="message" rows={4} placeholder={d.flMsgPh} /></div>
                <button type="submit" className="form-submit" disabled={contactSending}>
                  {contactSending ? (lang === 'fr' ? 'Envoi…' : 'Sending…') : d.formSubmit}
                </button>
              </form>
              )}
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
              <a href="mailto:postmaster@concorde-work-force.com" className="si" aria-label="Email">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" /></svg>
              </a>
            </div>
          </div>
          <div className="footer-col">
            <h4>{d.fcol1}</h4>
            <div className="footer-links">
              {/* Pages SEO statiques (servies depuis public/, hors SPA) → liens réels. */}
              <a href="/logiciel-pointage">{d.flPointage}</a>
              <a href="/logiciel-gestion-conges-absences">{d.flConges}</a>
              <a href="/logiciel-gestion-du-personnel">{d.flPersonnel}</a>
              <a onClick={() => scrollToId('pricing')}>{d.flPricing}</a>
              <a href={DOWNLOAD_URL} target="_blank" rel="noopener noreferrer">{d.flMobile}</a>
              <a onClick={() => scrollToId('contact')}>{d.flContact}</a>
            </div>
          </div>
          <div className="footer-col">
            <h4>{d.fcol2}</h4>
            <div className="footer-links">
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
            <a href={lang === 'en' ? '/en/suppression-compte' : '/suppression-compte'}>{d.accountDeletion}</a>
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
