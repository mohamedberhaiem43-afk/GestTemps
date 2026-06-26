// ─────────────────────────────────────────────────────────────────────────────
//  Contenu de la documentation in-app (centre d'aide /dashboard/documentation).
//
//  Convention projet (cf. DownloadPage / RoiPage) : les pages riches portent leur
//  contenu bilingue dans un dictionnaire local sélectionné par `i18n.language`,
//  plutôt que dans translation.json (évite d'alourdir le bundle i18n et les pièges
//  d'échappement JSON pour de longs blocs rédactionnels).
//
//  Séparation des responsabilités :
//   • DOC_CATEGORIES / DOC_ARTICLES_META  → structure LANGUE-NEUTRE (ordre, icône,
//     couleur, audience). L'icône est un nom (string) résolu vers un composant MUI
//     dans DOC_ICONS pour garder ce module sans JSX.
//   • DOC_CONTENT[lang]                    → textes localisés (titres, corps, étapes).
//
//  Audience :
//   • 'all'        → visible par tout utilisateur connecté (guide salarié).
//   • 'management' → réservé Admin / RH / Manager (guide administrateur). Le gating
//     est appliqué côté UI via useAuth().isManagementView (cf. DocumentationPage).
// ─────────────────────────────────────────────────────────────────────────────

export type DocAudience = 'all' | 'management';
export type DocLang = 'fr' | 'en';

/** Métadonnées langue-neutres d'un article. */
export interface DocArticleMeta {
  /** Slug d'URL (/dashboard/documentation/<slug>) ET clé de contenu. */
  slug: string;
  /** Nom d'icône résolu via DOC_ICONS. */
  icon: string;
  /** Couleur d'accent (pastille + accents de l'article). */
  color: string;
  audience: DocAudience;
}

/** Métadonnées langue-neutres d'une catégorie. */
export interface DocCategoryMeta {
  key: string;
  audience: DocAudience;
  /** Slugs des articles, dans l'ordre d'affichage. */
  articleSlugs: string[];
}

/** Une section d'article (localisée). */
export interface DocSection {
  heading: string;
  /** Paragraphe d'introduction de la section (optionnel). */
  body?: string;
  /** Liste ordonnée d'étapes (optionnelle). */
  steps?: string[];
  /** Encadré « bon à savoir » : puces de conseils (optionnel). */
  tips?: string[];
}

/** Contenu localisé d'un article. */
export interface DocArticle {
  title: string;
  /** Résumé affiché sur la carte du hub + utilisé par la recherche. */
  summary: string;
  sections: DocSection[];
}

/** Libellés localisés de la coquille (shell) du centre d'aide. */
export interface DocShell {
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  noResults: string;
  resultsFor: string;
  back: string;
  onThisPage: string;
  stepsLabel: string;
  tipsLabel: string;
  needHelpTitle: string;
  needHelpBody: string;
  contactSupport: string;
  readArticle: string;
  managementBadge: string;
}

export interface DocContent {
  shell: DocShell;
  categories: Record<string, { title: string; subtitle: string }>;
  articles: Record<string, DocArticle>;
}

// ── Structure langue-neutre ──────────────────────────────────────────────────

export const DOC_CATEGORIES: DocCategoryMeta[] = [
  {
    key: 'gettingStarted',
    audience: 'all',
    articleSlugs: ['bienvenue', 'application-mobile'],
  },
  {
    key: 'salarie',
    audience: 'all',
    articleSlugs: ['pointage', 'demandes-conges', 'soldes', 'profil-coffre'],
  },
  {
    key: 'administration',
    audience: 'management',
    articleSlugs: [
      'parametrage-societe',
      'gestion-employes',
      'horaires-postes',
      'utilisateurs-droits',
      'validations',
      'preparation-paie',
      'conformite-rgpd',
    ],
  },
];

export const DOC_ARTICLES_META: Record<string, DocArticleMeta> = {
  // Prise en main
  'bienvenue': { slug: 'bienvenue', icon: 'home', color: '#0040a1', audience: 'all' },
  'application-mobile': { slug: 'application-mobile', icon: 'smartphone', color: '#0891b2', audience: 'all' },
  // Salarié
  'pointage': { slug: 'pointage', icon: 'fingerprint', color: '#7c3aed', audience: 'all' },
  'demandes-conges': { slug: 'demandes-conges', icon: 'calendar', color: '#16a34a', audience: 'all' },
  'soldes': { slug: 'soldes', icon: 'wallet', color: '#ea580c', audience: 'all' },
  'profil-coffre': { slug: 'profil-coffre', icon: 'shield', color: '#0d9488', audience: 'all' },
  // Administration / RH
  'parametrage-societe': { slug: 'parametrage-societe', icon: 'building', color: '#0040a1', audience: 'management' },
  'gestion-employes': { slug: 'gestion-employes', icon: 'users', color: '#7c3aed', audience: 'management' },
  'horaires-postes': { slug: 'horaires-postes', icon: 'schedule', color: '#0891b2', audience: 'management' },
  'utilisateurs-droits': { slug: 'utilisateurs-droits', icon: 'key', color: '#db2777', audience: 'management' },
  'validations': { slug: 'validations', icon: 'checklist', color: '#16a34a', audience: 'management' },
  'preparation-paie': { slug: 'preparation-paie', icon: 'payments', color: '#ea580c', audience: 'management' },
  'conformite-rgpd': { slug: 'conformite-rgpd', icon: 'shieldcheck', color: '#475569', audience: 'management' },
};

/** Tous les slugs déclarés (utile pour le routage / validation). */
export const DOC_ALL_SLUGS: string[] = DOC_CATEGORIES.flatMap((c) => c.articleSlugs);

// ── Contenu FR ───────────────────────────────────────────────────────────────

const FR: DocContent = {
  shell: {
    title: 'Documentation',
    subtitle: 'Guides pas à pas pour prendre en main Concorde Workforce, côté salarié comme côté administrateur.',
    searchPlaceholder: 'Rechercher dans la documentation…',
    noResults: 'Aucun article ne correspond à votre recherche.',
    resultsFor: 'Résultats pour',
    back: 'Retour à la documentation',
    onThisPage: 'Sur cette page',
    stepsLabel: 'Étapes',
    tipsLabel: 'Bon à savoir',
    needHelpTitle: 'Vous ne trouvez pas votre réponse ?',
    needHelpBody: 'Notre équipe support et la FAQ sont là pour vous aider sur les cas particuliers.',
    contactSupport: 'Contacter le support',
    readArticle: 'Lire le guide',
    managementBadge: 'Admin / RH',
  },
  categories: {
    gettingStarted: {
      title: 'Prise en main',
      subtitle: 'Vos premiers pas sur la plateforme, sur le web comme sur mobile.',
    },
    salarie: {
      title: 'Guide du salarié',
      subtitle: 'Pointer, demander un congé, suivre vos soldes et gérer votre espace personnel.',
    },
    administration: {
      title: 'Guide administrateur & RH',
      subtitle: 'Paramétrer la société, gérer le personnel, les validations et la paie.',
    },
  },
  articles: {
    'bienvenue': {
      title: 'Première connexion & navigation',
      summary: 'Connectez-vous, découvrez le tableau de bord et l’organisation des menus.',
      sections: [
        {
          heading: 'Se connecter',
          body: 'Votre administrateur crée votre compte et vous transmet vos identifiants par e-mail.',
          steps: [
            'Ouvrez l’adresse de votre espace Concorde Workforce dans votre navigateur.',
            'Saisissez votre e-mail professionnel et votre mot de passe.',
            'À la première connexion, vous pouvez être invité à définir un nouveau mot de passe.',
          ],
          tips: [
            'Mot de passe oublié ? Utilisez le lien « Mot de passe oublié » sur l’écran de connexion.',
            'Cochez « Se souvenir de moi » uniquement sur un appareil personnel.',
          ],
        },
        {
          heading: 'Comprendre l’interface',
          body: 'Le menu latéral regroupe les modules par thème (Personnel, Pointage, Congés, Rapports…). Le tableau de bord affiche vos indicateurs et raccourcis du moment.',
        },
        {
          heading: 'Recherche rapide & raccourcis',
          body: 'La palette de commandes (Ctrl/Cmd + K) permet de sauter directement vers n’importe quelle page. Le champ de recherche du menu filtre les rubriques par nom.',
        },
        {
          heading: 'Langue, thème et aide',
          body: 'Changez de langue (français / anglais) et basculez en thème clair ou sombre depuis la barre supérieure. La rubrique Support reste accessible à tout moment depuis le bas du menu.',
        },
      ],
    },
    'application-mobile': {
      title: 'Application mobile',
      summary: 'Installez l’app Android pour pointer et gérer vos demandes en mobilité.',
      sections: [
        {
          heading: 'Installer l’application',
          steps: [
            'Depuis le menu, ouvrez la page « Télécharger » ou scannez le QR code proposé.',
            'Téléchargez l’application Android (APK) et autorisez l’installation si demandé.',
            'Connectez-vous avec les mêmes identifiants que sur le web.',
          ],
        },
        {
          heading: 'Pointer depuis le mobile',
          body: 'L’application permet un pointage géolocalisé : un point d’entrée et un point de sortie horodatés, avec la position lorsque l’option est activée par votre entreprise.',
        },
        {
          heading: 'Mes demandes en mobilité',
          body: 'Déposez et suivez vos demandes de congés, d’absence ou de télétravail directement depuis votre téléphone, et recevez les notifications de validation.',
        },
        {
          heading: 'Mode hors-ligne',
          body: 'En cas de coupure réseau, certains pointages sont conservés localement puis synchronisés automatiquement dès le retour de la connexion.',
        },
      ],
    },
    'pointage': {
      title: 'Pointer mes heures',
      summary: 'Méthodes de pointage : badgeuse, mobile géolocalisé, et corrections.',
      sections: [
        {
          heading: 'Les méthodes de pointage',
          body: 'Selon votre organisation, vous pointez via une badgeuse physique, l’application mobile ou un poste web. Chaque pointage enregistre une entrée et une sortie.',
        },
        {
          heading: 'Pointer sur une badgeuse',
          steps: [
            'Présentez votre badge ou votre doigt sur le terminal.',
            'Vérifiez le bip / message de confirmation.',
            'Renouvelez l’opération à la sortie et lors des pauses si votre régime l’exige.',
          ],
        },
        {
          heading: 'Pointer en mobilité',
          body: 'Sur l’application mobile, le bouton de pointage horodate votre arrivée et votre départ ; la géolocalisation peut être requise pour les équipes terrain.',
        },
        {
          heading: 'Oubli ou erreur de pointage',
          body: 'Un oubli se régularise auprès de votre manager ou des RH. Vos pointages du mois sont consultables dans votre espace pour vérification.',
          tips: [
            'Signalez rapidement un oubli pour éviter un écart sur la préparation de paie.',
            'Un pointage manquant n’est pas modifiable par le salarié : il relève de la validation hiérarchique.',
          ],
        },
      ],
    },
    'demandes-conges': {
      title: 'Demander un congé ou une absence',
      summary: 'Déposez une demande de congé, d’absence ou de télétravail et suivez sa validation.',
      sections: [
        {
          heading: 'Déposer une demande',
          steps: [
            'Ouvrez Mon Espace → Demande de congé (ou Demande d’absence / de télétravail).',
            'Choisissez le type, les dates de début et de fin, et le motif si nécessaire.',
            'Vérifiez le décompte de jours puis validez l’envoi.',
          ],
        },
        {
          heading: 'Types de demandes',
          body: 'Congés payés, absences (maladie, événements familiaux…), télétravail et autorisations de sortie suivent chacun leur propre circuit de validation.',
        },
        {
          heading: 'Suivre l’avancement',
          body: 'Le statut de chaque demande (en attente, validée, refusée) est visible dans votre espace, et vous êtes notifié à chaque changement.',
        },
        {
          heading: 'Télétravail',
          body: 'La demande de télétravail précise les jours concernés ; une fois validée par votre manager, elle apparaît dans votre planning.',
          tips: [
            'Anticipez vos demandes : certains types nécessitent un délai de prévenance.',
            'Une demande validée peut être annulée selon les règles définies par votre entreprise.',
          ],
        },
      ],
    },
    'soldes': {
      title: 'Consulter mes soldes & CET',
      summary: 'Lisez vos soldes de congés, alimentez votre Compte Épargne Temps et consultez l’historique.',
      sections: [
        {
          heading: 'Lire mes soldes',
          body: 'Mon Espace → Solde de congé affiche vos droits acquis, pris et restants par type de congé, mis à jour à chaque validation.',
        },
        {
          heading: 'Le Compte Épargne Temps (CET)',
          body: 'Le CET permet de capitaliser certains droits non pris. Les congés non soldés à la date butoir paramétrée y sont transférés automatiquement, dans la limite définie par votre entreprise.',
        },
        {
          heading: 'Alimenter mon CET',
          steps: [
            'Ouvrez Mon Espace → Alimenter le CET.',
            'Indiquez le nombre de jours à épargner dans la limite autorisée.',
            'Validez : la demande suit le circuit d’approbation habituel.',
          ],
        },
        {
          heading: 'Historique des mouvements',
          body: 'Chaque acquisition, prise ou transfert est tracé, ce qui vous permet de vérifier l’évolution de vos compteurs.',
        },
      ],
    },
    'profil-coffre': {
      title: 'Mon profil & coffre-fort',
      summary: 'Mettez à jour vos informations et accédez à vos documents dans le coffre-fort numérique.',
      sections: [
        {
          heading: 'Mettre à jour mon profil',
          steps: [
            'Ouvrez Mon Espace → Profil.',
            'Modifiez les informations autorisées (coordonnées, photo…).',
            'Enregistrez : certaines modifications peuvent nécessiter une validation RH.',
          ],
        },
        {
          heading: 'Le coffre-fort numérique',
          body: 'Le coffre-fort regroupe vos documents personnels (bulletins, contrats, attestations) de façon sécurisée et accessible à tout moment.',
        },
        {
          heading: 'Documents à signer',
          body: 'Lorsqu’un document requiert votre signature électronique, vous êtes notifié et pouvez le signer directement depuis votre espace.',
          tips: [
            'Vos documents restent disponibles même après la fin du contrat, selon la politique de conservation.',
            'Téléchargez une copie locale de vos documents importants pour vos archives.',
          ],
        },
      ],
    },
    'parametrage-societe': {
      title: 'Paramétrer la société',
      summary: 'Renseignez les informations de l’entreprise, la structure organisationnelle, les sites et le branding.',
      sections: [
        {
          heading: 'Informations de la société',
          steps: [
            'Ouvrez Référentiel & Paramètres → Société.',
            'Renseignez raison sociale, coordonnées et règles de calcul (heures/mois, seuils).',
            'Enregistrez : ces paramètres alimentent les calculs de temps et de paie.',
          ],
        },
        {
          heading: 'Structure organisationnelle',
          body: 'Direction, service, section : définissez votre arborescence pour rattacher correctement les employés et filtrer les rapports.',
        },
        {
          heading: 'Sites & multi-établissements',
          body: 'Chaque site (filiale / établissement) isole ses données. Les rôles RH et managers sont scopés à leur site, tandis que l’administrateur a une vue globale.',
        },
        {
          heading: 'Branding personnalisé',
          body: 'Si l’option est souscrite, personnalisez le logo et les couleurs de la plateforme pour vos équipes depuis les paramètres de société.',
        },
        {
          heading: 'Calendrier & jours fériés',
          body: 'Le calendrier société définit les jours fériés et jours non travaillés pris en compte dans les décomptes de congés et le calcul des temps.',
        },
      ],
    },
    'gestion-employes': {
      title: 'Gérer les employés & contrats',
      summary: 'Créez les fiches employés, importez en masse et suivez les contrats.',
      sections: [
        {
          heading: 'Créer un employé',
          steps: [
            'Ouvrez Gestion du Personnel → Gestion des employés → Nouvel employé.',
            'Renseignez identité, e-mail, fonction, qualification et régime horaire.',
            'Enregistrez : le code est généré automatiquement selon le paramétrage société.',
          ],
        },
        {
          heading: 'Import Excel',
          body: 'Le bouton « Import Excel » de la liste des employés permet une création en masse à partir d’un fichier modèle (code, nom, prénom, e-mail, fonction, régime…).',
        },
        {
          heading: 'Contrats & avenants',
          body: 'Suivez les types de contrat, leurs échéances et générez les documents depuis les modèles du coffre-fort. Les échéances proches remontent dans les rapports.',
        },
        {
          heading: 'Statut actif / inactif',
          body: 'Le statut détermine la présence d’un employé dans les listes et calculs. Vérifiez ce champ lors des entrées et sorties pour garder des effectifs justes.',
          tips: [
            'Un e-mail valide est indispensable pour que l’employé puisse se connecter.',
            'Désactivez plutôt que de supprimer un employé sortant afin de conserver son historique.',
          ],
        },
      ],
    },
    'horaires-postes': {
      title: 'Horaires & postes de travail',
      summary: 'Définissez les classes horaires, les postes de travail, repos et jours fériés.',
      sections: [
        {
          heading: 'Classes horaires',
          steps: [
            'Ouvrez Horaires & Postes → Classe horaire.',
            'Définissez les plages, pauses et règles de tolérance (retard, heures sup).',
            'Affectez la classe horaire aux employés ou groupes concernés.',
          ],
        },
        {
          heading: 'Postes de travail',
          body: 'Les postes de travail relient une organisation de temps à des emplacements ou équipes, et conditionnent l’interprétation des pointages.',
        },
        {
          heading: 'Repos & jours fériés',
          body: 'Le paramétrage des repos hebdomadaires et des jours fériés alimente automatiquement les calculs d’absences, d’heures et de soldes.',
          tips: [
            'Testez une classe horaire sur un employé avant un déploiement large.',
            'Un changement de règle s’applique aux périodes ouvertes : vérifiez l’impact sur le mois en cours.',
          ],
        },
      ],
    },
    'utilisateurs-droits': {
      title: 'Utilisateurs & droits d’accès',
      summary: 'Créez des comptes, attribuez des rôles et cadrez les droits par site.',
      sections: [
        {
          heading: 'Créer un utilisateur',
          steps: [
            'Ouvrez Administration → Utilisateurs → Nouvel utilisateur.',
            'Reliez le compte à un employé et attribuez un rôle.',
            'Enregistrez : l’utilisateur reçoit ses accès selon le rôle choisi.',
          ],
        },
        {
          heading: 'Rôles & permissions',
          body: 'Chaque rôle ouvre un ensemble de modules en consultation et/ou modification. L’écran Droit d’accès permet d’affiner les permissions module par module.',
        },
        {
          heading: 'Droits par site',
          body: 'Les rôles RH et manager sont limités à leur(s) site(s) ; l’administrateur dispose d’une vue globale. Cette isolation protège les données entre établissements.',
        },
        {
          heading: 'Prévention des escalades de privilège',
          body: 'L’attribution de rôles privilégiés est contrôlée : un utilisateur ne peut pas s’octroyer plus de droits qu’il n’en possède. Réservez le rôle administrateur à un nombre restreint de personnes.',
          tips: [
            'Appliquez le principe du moindre privilège : n’ouvrez que les modules nécessaires.',
            'Revoyez périodiquement la liste des comptes administrateurs.',
          ],
        },
      ],
    },
    'validations': {
      title: 'Workflows de validation',
      summary: 'Validez congés, absences, télétravail et heures supplémentaires.',
      sections: [
        {
          heading: 'Principe',
          body: 'Chaque demande d’un salarié arrive dans une file de validation accessible aux managers et RH habilités, avec notification à la clé.',
        },
        {
          heading: 'Valider un congé',
          steps: [
            'Ouvrez Congés & Validations → Validation congé.',
            'Examinez la demande, le solde et les chevauchements d’équipe.',
            'Approuvez ou refusez : le salarié est notifié et son solde mis à jour.',
          ],
        },
        {
          heading: 'Absences & télétravail',
          body: 'Les demandes d’absence et de télétravail disposent de leurs propres écrans de validation, avec le même principe d’approbation et de notification.',
        },
        {
          heading: 'Heures supplémentaires',
          body: 'Les heures supplémentaires déclarées sont soumises à validation avant d’être reprises dans la préparation de paie.',
          tips: [
            'Traitez les demandes avant la clôture mensuelle pour éviter les écarts de paie.',
            'Une demande refusée doit idéalement être motivée pour le salarié.',
          ],
        },
      ],
    },
    'preparation-paie': {
      title: 'Préparation de la paie',
      summary: 'Clôturez la période, contrôlez les états et exportez vers la paie.',
      sections: [
        {
          heading: 'Clôturer la période',
          steps: [
            'Vérifiez que les pointages, absences et heures sup du mois sont validés.',
            'Ouvrez Préparation Paie → Pointage du mois pour contrôler les compteurs.',
            'Corrigez les anomalies signalées avant de figer la période.',
          ],
        },
        {
          heading: 'Contrôler les états',
          body: 'Les états de présence, de retard et d’absence permettent de fiabiliser les données avant export et de justifier les compteurs.',
        },
        {
          heading: 'Exports',
          body: 'Exportez les données consolidées (Excel / formats comptables) vers votre solution de paie. Les rubriques de paie reflètent votre paramétrage société.',
        },
        {
          heading: 'Transfert CET',
          body: 'À la date butoir, les congés non pris sont transférés vers le CET selon le plafond défini, ce qui est à vérifier avant la clôture annuelle.',
        },
      ],
    },
    'conformite-rgpd': {
      title: 'Conformité & RGPD',
      summary: 'Pilotez la rétention des données, les journaux d’audit et les droits des personnes.',
      sections: [
        {
          heading: 'Politique de rétention',
          body: 'L’écran Rétention RGPD définit les durées de conservation par type de donnée et déclenche les purges automatiques arrivées à échéance.',
        },
        {
          heading: 'Journaux d’audit',
          body: 'Les actions sensibles sont tracées dans les journaux d’audit, consultables par l’administrateur pour répondre à un contrôle ou investiguer un incident.',
        },
        {
          heading: 'Droits des personnes',
          body: 'Accès, rectification, effacement : la plateforme fournit les outils pour répondre aux demandes des salariés dans les délais réglementaires.',
        },
        {
          heading: 'Signature électronique',
          body: 'Les documents signés sont scellés (empreinte SHA-256) pour en garantir l’intégrité et la valeur probante.',
          tips: [
            'Documentez vos durées de conservation dans le registre des traitements.',
            'Limitez l’accès aux journaux d’audit aux seuls profils habilités.',
          ],
        },
      ],
    },
  },
};

// ── Contenu EN ───────────────────────────────────────────────────────────────

const EN: DocContent = {
  shell: {
    title: 'Documentation',
    subtitle: 'Step-by-step guides to get the most out of Concorde Workforce, for employees and administrators alike.',
    searchPlaceholder: 'Search the documentation…',
    noResults: 'No article matches your search.',
    resultsFor: 'Results for',
    back: 'Back to documentation',
    onThisPage: 'On this page',
    stepsLabel: 'Steps',
    tipsLabel: 'Good to know',
    needHelpTitle: 'Can’t find your answer?',
    needHelpBody: 'Our support team and the FAQ are here to help with specific cases.',
    contactSupport: 'Contact support',
    readArticle: 'Read guide',
    managementBadge: 'Admin / HR',
  },
  categories: {
    gettingStarted: {
      title: 'Getting started',
      subtitle: 'Your first steps on the platform, on the web and on mobile.',
    },
    salarie: {
      title: 'Employee guide',
      subtitle: 'Clock in, request leave, track your balances and manage your personal space.',
    },
    administration: {
      title: 'Administrator & HR guide',
      subtitle: 'Configure the company, manage staff, approvals and payroll.',
    },
  },
  articles: {
    'bienvenue': {
      title: 'First login & navigation',
      summary: 'Sign in, discover the dashboard and how the menus are organised.',
      sections: [
        {
          heading: 'Signing in',
          body: 'Your administrator creates your account and sends your credentials by email.',
          steps: [
            'Open your Concorde Workforce workspace address in your browser.',
            'Enter your work email and password.',
            'On first login you may be prompted to set a new password.',
          ],
          tips: [
            'Forgot your password? Use the “Forgot password” link on the sign-in screen.',
            'Only tick “Remember me” on a personal device.',
          ],
        },
        {
          heading: 'Understanding the interface',
          body: 'The side menu groups modules by theme (Staff, Time, Leave, Reports…). The dashboard shows your key indicators and shortcuts.',
        },
        {
          heading: 'Quick search & shortcuts',
          body: 'The command palette (Ctrl/Cmd + K) jumps straight to any page. The menu search field filters sections by name.',
        },
        {
          heading: 'Language, theme and help',
          body: 'Switch language (French / English) and toggle light or dark theme from the top bar. The Support section is always available at the bottom of the menu.',
        },
      ],
    },
    'application-mobile': {
      title: 'Mobile app',
      summary: 'Install the Android app to clock in and manage your requests on the go.',
      sections: [
        {
          heading: 'Installing the app',
          steps: [
            'From the menu, open the “Download” page or scan the provided QR code.',
            'Download the Android app (APK) and allow installation if prompted.',
            'Sign in with the same credentials as on the web.',
          ],
        },
        {
          heading: 'Clocking in from mobile',
          body: 'The app supports geolocated clocking: a timestamped clock-in and clock-out, with location when the option is enabled by your company.',
        },
        {
          heading: 'My requests on the go',
          body: 'Submit and track leave, absence or remote-work requests directly from your phone, and receive approval notifications.',
        },
        {
          heading: 'Offline mode',
          body: 'If the network drops, some clock-ins are stored locally and synced automatically as soon as the connection is back.',
        },
      ],
    },
    'pointage': {
      title: 'Clocking my hours',
      summary: 'Clocking methods: time clock, geolocated mobile, and corrections.',
      sections: [
        {
          heading: 'Clocking methods',
          body: 'Depending on your organisation, you clock in via a physical time clock, the mobile app or a web station. Each clocking records an in and an out.',
        },
        {
          heading: 'Clocking on a time clock',
          steps: [
            'Present your badge or finger on the terminal.',
            'Check the confirmation beep / message.',
            'Repeat on the way out and during breaks if your schedule requires it.',
          ],
        },
        {
          heading: 'Clocking on the go',
          body: 'On the mobile app, the clocking button timestamps your arrival and departure; geolocation may be required for field teams.',
        },
        {
          heading: 'Missed or wrong clocking',
          body: 'A missed clocking is corrected by your manager or HR. Your monthly clockings are available in your space for review.',
          tips: [
            'Report a missed clocking quickly to avoid a discrepancy in payroll.',
            'A missing clocking cannot be edited by the employee: it goes through line-management approval.',
          ],
        },
      ],
    },
    'demandes-conges': {
      title: 'Requesting leave or absence',
      summary: 'Submit a leave, absence or remote-work request and track its approval.',
      sections: [
        {
          heading: 'Submitting a request',
          steps: [
            'Open My Space → Leave request (or Absence / Remote-work request).',
            'Choose the type, start and end dates, and a reason if needed.',
            'Check the day count then confirm submission.',
          ],
        },
        {
          heading: 'Request types',
          body: 'Paid leave, absences (sickness, family events…), remote work and exit authorisations each follow their own approval flow.',
        },
        {
          heading: 'Tracking progress',
          body: 'The status of each request (pending, approved, rejected) is visible in your space, and you are notified on every change.',
        },
        {
          heading: 'Remote work',
          body: 'A remote-work request specifies the days concerned; once approved by your manager, it appears in your planning.',
          tips: [
            'Plan ahead: some types require advance notice.',
            'An approved request may be cancelled according to your company’s rules.',
          ],
        },
      ],
    },
    'soldes': {
      title: 'Checking my balances & TSA',
      summary: 'Read your leave balances, top up your Time Savings Account and review history.',
      sections: [
        {
          heading: 'Reading my balances',
          body: 'My Space → Leave balance shows your accrued, taken and remaining entitlements per leave type, updated on each approval.',
        },
        {
          heading: 'The Time Savings Account (TSA/CET)',
          body: 'The TSA lets you bank certain unused entitlements. Leave not used by the configured cut-off date is transferred automatically, up to the limit set by your company.',
        },
        {
          heading: 'Topping up my TSA',
          steps: [
            'Open My Space → Top up the TSA.',
            'Enter the number of days to save, within the allowed limit.',
            'Confirm: the request follows the usual approval flow.',
          ],
        },
        {
          heading: 'Movement history',
          body: 'Every accrual, use or transfer is tracked, so you can verify how your counters evolve.',
        },
      ],
    },
    'profil-coffre': {
      title: 'My profile & vault',
      summary: 'Update your information and access your documents in the digital vault.',
      sections: [
        {
          heading: 'Updating my profile',
          steps: [
            'Open My Space → Profile.',
            'Edit the allowed information (contact details, photo…).',
            'Save: some changes may require HR approval.',
          ],
        },
        {
          heading: 'The digital vault',
          body: 'The vault securely gathers your personal documents (payslips, contracts, certificates) and keeps them available at any time.',
        },
        {
          heading: 'Documents to sign',
          body: 'When a document requires your electronic signature, you are notified and can sign it directly from your space.',
          tips: [
            'Your documents remain available even after the contract ends, subject to the retention policy.',
            'Download a local copy of your important documents for your records.',
          ],
        },
      ],
    },
    'parametrage-societe': {
      title: 'Configuring the company',
      summary: 'Set up company information, the org structure, sites and branding.',
      sections: [
        {
          heading: 'Company information',
          steps: [
            'Open Reference & Settings → Company.',
            'Fill in legal name, contact details and calculation rules (hours/month, thresholds).',
            'Save: these settings feed the time and payroll calculations.',
          ],
        },
        {
          heading: 'Organisational structure',
          body: 'Division, department, section: define your hierarchy to correctly attach employees and filter reports.',
        },
        {
          heading: 'Sites & multi-establishment',
          body: 'Each site (subsidiary / establishment) isolates its data. HR and manager roles are scoped to their site, while the administrator has a global view.',
        },
        {
          heading: 'Custom branding',
          body: 'If the option is subscribed, customise the platform logo and colours for your teams from the company settings.',
        },
        {
          heading: 'Calendar & public holidays',
          body: 'The company calendar defines public holidays and non-working days used in leave counting and time calculation.',
        },
      ],
    },
    'gestion-employes': {
      title: 'Managing employees & contracts',
      summary: 'Create employee records, bulk-import, and track contracts.',
      sections: [
        {
          heading: 'Creating an employee',
          steps: [
            'Open Staff Management → Employees → New employee.',
            'Fill in identity, email, role, qualification and working schedule.',
            'Save: the code is generated automatically based on company settings.',
          ],
        },
        {
          heading: 'Excel import',
          body: 'The “Excel import” button on the employee list enables bulk creation from a template file (code, last name, first name, email, role, schedule…).',
        },
        {
          heading: 'Contracts & amendments',
          body: 'Track contract types, their end dates, and generate documents from the vault templates. Upcoming end dates surface in the reports.',
        },
        {
          heading: 'Active / inactive status',
          body: 'Status determines whether an employee appears in lists and calculations. Check this field on entries and exits to keep headcount accurate.',
          tips: [
            'A valid email is essential for the employee to be able to sign in.',
            'Deactivate rather than delete a leaving employee to keep their history.',
          ],
        },
      ],
    },
    'horaires-postes': {
      title: 'Schedules & workstations',
      summary: 'Define schedule classes, workstations, rest days and public holidays.',
      sections: [
        {
          heading: 'Schedule classes',
          steps: [
            'Open Schedules & Workstations → Schedule class.',
            'Define time ranges, breaks and tolerance rules (lateness, overtime).',
            'Assign the schedule class to the relevant employees or groups.',
          ],
        },
        {
          heading: 'Workstations',
          body: 'Workstations link a time organisation to locations or teams, and shape how clockings are interpreted.',
        },
        {
          heading: 'Rest days & public holidays',
          body: 'Configuring weekly rest and public holidays automatically feeds the absence, hours and balance calculations.',
          tips: [
            'Test a schedule class on one employee before a wide rollout.',
            'A rule change applies to open periods: check the impact on the current month.',
          ],
        },
      ],
    },
    'utilisateurs-droits': {
      title: 'Users & access rights',
      summary: 'Create accounts, assign roles and scope rights per site.',
      sections: [
        {
          heading: 'Creating a user',
          steps: [
            'Open Administration → Users → New user.',
            'Link the account to an employee and assign a role.',
            'Save: the user receives access according to the chosen role.',
          ],
        },
        {
          heading: 'Roles & permissions',
          body: 'Each role opens a set of modules for viewing and/or editing. The Access rights screen refines permissions module by module.',
        },
        {
          heading: 'Rights per site',
          body: 'HR and manager roles are limited to their site(s); the administrator has a global view. This isolation protects data across establishments.',
        },
        {
          heading: 'Preventing privilege escalation',
          body: 'Assigning privileged roles is controlled: a user cannot grant themselves more rights than they hold. Reserve the administrator role for a small number of people.',
          tips: [
            'Apply least privilege: only open the modules that are needed.',
            'Periodically review the list of administrator accounts.',
          ],
        },
      ],
    },
    'validations': {
      title: 'Approval workflows',
      summary: 'Approve leave, absences, remote work and overtime.',
      sections: [
        {
          heading: 'Principle',
          body: 'Each employee request lands in an approval queue available to authorised managers and HR, with a notification each time.',
        },
        {
          heading: 'Approving leave',
          steps: [
            'Open Leave & Approvals → Leave approval.',
            'Review the request, the balance and team overlaps.',
            'Approve or reject: the employee is notified and their balance updated.',
          ],
        },
        {
          heading: 'Absences & remote work',
          body: 'Absence and remote-work requests have their own approval screens, with the same approve-and-notify principle.',
        },
        {
          heading: 'Overtime',
          body: 'Declared overtime is subject to approval before being picked up in payroll preparation.',
          tips: [
            'Process requests before the monthly close to avoid payroll discrepancies.',
            'A rejected request should ideally include a reason for the employee.',
          ],
        },
      ],
    },
    'preparation-paie': {
      title: 'Payroll preparation',
      summary: 'Close the period, check the reports and export to payroll.',
      sections: [
        {
          heading: 'Closing the period',
          steps: [
            'Make sure the month’s clockings, absences and overtime are approved.',
            'Open Payroll Preparation → Monthly clocking to check the counters.',
            'Fix the flagged anomalies before locking the period.',
          ],
        },
        {
          heading: 'Checking the reports',
          body: 'Attendance, lateness and absence reports help validate the data before export and justify the counters.',
        },
        {
          heading: 'Exports',
          body: 'Export the consolidated data (Excel / accounting formats) to your payroll solution. Payroll items reflect your company configuration.',
        },
        {
          heading: 'TSA transfer',
          body: 'At the cut-off date, unused leave is transferred to the TSA up to the defined cap, which should be checked before the annual close.',
        },
      ],
    },
    'conformite-rgpd': {
      title: 'Compliance & GDPR',
      summary: 'Drive data retention, audit logs and data-subject rights.',
      sections: [
        {
          heading: 'Retention policy',
          body: 'The GDPR retention screen sets retention durations per data type and triggers automatic purges once they fall due.',
        },
        {
          heading: 'Audit logs',
          body: 'Sensitive actions are recorded in the audit logs, available to the administrator to answer an audit or investigate an incident.',
        },
        {
          heading: 'Data-subject rights',
          body: 'Access, rectification, erasure: the platform provides the tools to answer employee requests within regulatory deadlines.',
        },
        {
          heading: 'Electronic signature',
          body: 'Signed documents are sealed (SHA-256 hash) to guarantee their integrity and evidential value.',
          tips: [
            'Document your retention durations in the records of processing activities.',
            'Restrict audit-log access to authorised profiles only.',
          ],
        },
      ],
    },
  },
};

export const DOC_CONTENT: Record<DocLang, DocContent> = { fr: FR, en: EN };

/** Sélectionne le contenu pour la langue i18n courante (fallback FR). */
export function getDocContent(language: string): DocContent {
  return language === 'en' ? DOC_CONTENT.en : DOC_CONTENT.fr;
}
