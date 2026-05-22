import { Box, Container, Typography, Paper, Divider, Link as MuiLink } from '@mui/material';

/**
 * CGU — Conditions Générales d'Utilisation.
 *
 * Page PUBLIQUE (cf. PUBLIC_PATHS dans RouteGuards.tsx).
 * Apple Guideline 3.1.2(a) et Google Play Policy : un ToS / EULA doit être
 * accessible depuis l'app ET depuis le store listing.
 */
const VERSION = '2026-05-22';
const COMPANY_NAME = 'Concorde Tech';
const APP_NAME = 'Concorde Workly';
const SUPPORT_EMAIL = 'support@concorde-work-force.com';
const LEGAL_EMAIL = 'contact@concorde-tech.fr';

export default function TermsOfServicePage() {
  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: { xs: 4, md: 8 } }}>
      <Container maxWidth="md">
        <Paper elevation={0} sx={{ p: { xs: 3, md: 6 }, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
            Conditions Générales d'Utilisation
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            Dernière mise à jour : <strong>{VERSION}</strong> · Application : {APP_NAME} · Éditeur : {COMPANY_NAME}
          </Typography>

          <Section title="1. Objet">
            <P>
              Les présentes Conditions Générales d'Utilisation (« CGU ») régissent l'accès et l'utilisation
              de l'application <strong>{APP_NAME}</strong> (web et mobile, ci-après « le Service »), édité par{' '}
              <strong>{COMPANY_NAME}</strong>. L'utilisation du Service implique l'acceptation pleine et
              entière des présentes CGU. Toute personne qui ne les accepte pas ne doit pas utiliser le Service.
            </P>
          </Section>

          <Section title="2. Description du Service">
            <P>
              {APP_NAME} est un logiciel en tant que service (SaaS) de gestion des ressources humaines et
              du temps de travail destiné aux entreprises (B2B). Il permet notamment : pointage entrée/sortie,
              gestion des congés et autorisations, gestion des frais professionnels, planification des
              missions, suivi des soldes, génération d'états, dématérialisation documentaire, signature
              électronique, assistant IA contextuel pour les fonctions support.
            </P>
            <P>
              Le Service est commercialisé uniquement aux entités professionnelles (entreprises, indépendants,
              associations). Les utilisateurs finaux sont les salariés et collaborateurs de ces entités, dont
              l'accès est paramétré par leur employeur (« Client »).
            </P>
          </Section>

          <Section title="3. Création de compte et accès">
            <P>
              L'inscription au Service est réservée à un représentant légal ou mandaté de l'entreprise. Le
              compte administrateur du Client crée ensuite les comptes des utilisateurs finaux ou délègue
              cette création.
            </P>
            <P>Chaque utilisateur s'engage à :</P>
            <ul>
              <li>Fournir des informations exactes et à jour ;</li>
              <li>Maintenir confidentiels ses identifiants de connexion ;</li>
              <li>Activer l'authentification biométrique ou un second facteur lorsque proposé ;</li>
              <li>Signaler immédiatement à <MuiLink href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</MuiLink> toute utilisation non autorisée de son compte.</li>
            </ul>
          </Section>

          <Section title="4. Abonnement, période d'essai et facturation">
            <P>
              Le Service est proposé selon une grille tarifaire détaillée sur{' '}
              <MuiLink href="https://concorde-work-force.com">concorde-work-force.com</MuiLink>. Une période
              d'essai gratuite de 30 jours est offerte sans communication de moyen de paiement ; à l'issue de
              cette période, le passage à un abonnement payant est nécessaire pour conserver l'accès aux
              fonctionnalités.
            </P>
            <P>
              <strong>Paiement :</strong> les abonnements sont prélevés mensuellement ou annuellement (au
              choix du Client) via notre prestataire Stripe Payments Europe Ltd. Aucune donnée bancaire
              n'est stockée sur les serveurs de {COMPANY_NAME}.
            </P>
            <P>
              <strong>Renouvellement automatique :</strong> sauf résiliation avant l'échéance, l'abonnement
              est tacitement renouvelé pour la même période. Le Client peut résilier à tout moment depuis
              l'interface administrateur ; la résiliation prend effet à la fin de la période en cours.
            </P>
            <P>
              <strong>Pas de remboursement :</strong> sauf cas légalement obligatoire ou défaillance imputable
              à {COMPANY_NAME}, les sommes versées ne sont pas remboursées au prorata en cas de résiliation
              anticipée.
            </P>
          </Section>

          <Section title="5. Usage acceptable">
            <P>L'utilisateur s'engage à ne pas :</P>
            <ul>
              <li>Utiliser le Service pour des activités illégales, frauduleuses ou contraires à l'ordre public ;</li>
              <li>Tenter de contourner les mécanismes de sécurité, d'authentification ou de quota ;</li>
              <li>Procéder à des opérations de rétro-ingénierie, désassemblage ou décompilation ;</li>
              <li>Extraire de manière automatisée et massive (scraping) les données du Service ;</li>
              <li>Charger des contenus illicites, diffamatoires, injurieux ou portant atteinte aux droits de tiers ;</li>
              <li>Utiliser le Service pour héberger des données ne relevant pas de l'activité professionnelle du Client ;</li>
              <li>Soumettre à l'assistant IA des données sensibles non nécessaires à la résolution de votre demande.</li>
            </ul>
            <P>
              {COMPANY_NAME} se réserve le droit de suspendre ou résilier sans préavis tout compte en
              infraction avec les présentes règles ou avec la loi.
            </P>
          </Section>

          <Section title="6. Propriété intellectuelle">
            <P>
              L'ensemble des éléments composant le Service (code source, design, marques, logos, contenus
              éditoriaux, bases de données structurelles) est la propriété exclusive de {COMPANY_NAME} ou de
              ses partenaires et licenciés, protégés par les lois sur la propriété intellectuelle.
            </P>
            <P>
              Aucune cession de droits n'est consentie à l'utilisateur, à l'exception d'un droit d'utilisation
              non exclusif, non transférable et limité à la durée de l'abonnement.
            </P>
            <P>
              <strong>Données Client :</strong> le Client conserve l'entière propriété des données qu'il
              importe ou génère sur le Service. {COMPANY_NAME} ne dispose que des droits strictement
              nécessaires à la fourniture du Service.
            </P>
          </Section>

          <Section title="7. Disponibilité du Service">
            <P>
              {COMPANY_NAME} met en œuvre des efforts raisonnables pour assurer la disponibilité du Service
              7j/7, 24h/24, hors fenêtres de maintenance planifiée annoncées en avance. {COMPANY_NAME} ne
              garantit toutefois pas une disponibilité absolue : des interruptions techniques, des incidents
              de réseau, des cyberattaques ou des cas de force majeure peuvent affecter le Service.
            </P>
            <P>
              <strong>SLA :</strong> les engagements de niveau de service (taux de disponibilité, temps de
              réponse support) sont définis dans le contrat d'abonnement souscrit par le Client.
            </P>
          </Section>

          <Section title="8. Données personnelles">
            <P>
              Le traitement des données personnelles est régi par la{' '}
              <MuiLink href="/confidentialite">Politique de confidentialité</MuiLink>, qui fait partie
              intégrante des présentes CGU.
            </P>
          </Section>

          <Section title="9. Responsabilité et garanties">
            <P>
              Le Service est fourni « en l'état » dans les limites permises par la loi. {COMPANY_NAME} ne
              saurait être tenu responsable :
            </P>
            <ul>
              <li>D'un usage non conforme aux présentes CGU ;</li>
              <li>De la perte de données résultant d'une mauvaise manipulation par l'utilisateur ;</li>
              <li>Des dommages indirects (perte d'exploitation, perte de chiffre d'affaires, perte d'image) ;</li>
              <li>Des défaillances des sous-traitants techniques externes (Stripe, hébergeur, opérateur télécom) lorsqu'elles relèvent du fait de ces tiers.</li>
            </ul>
            <P>
              <strong>Plafond de responsabilité :</strong> en tout état de cause, et dans les limites
              permises par la loi, la responsabilité globale de {COMPANY_NAME} envers le Client au titre du
              Service est plafonnée au montant total des sommes effectivement versées par le Client durant
              les 12 mois précédant l'événement à l'origine du dommage.
            </P>
            <P>
              <strong>Contenu IA :</strong> les réponses de l'assistant IA sont générées automatiquement et
              peuvent contenir des inexactitudes. Elles ne constituent en aucun cas un conseil juridique,
              comptable ou médical. L'utilisateur reste responsable de la vérification des informations
              avant toute prise de décision.
            </P>
          </Section>

          <Section title="10. Résiliation">
            <P>
              <strong>Par le Client :</strong> à tout moment depuis l'interface administrateur. Effet à la
              fin de la période d'abonnement en cours.
            </P>
            <P>
              <strong>Par {COMPANY_NAME} :</strong> avec préavis de 30 jours pour convenance, ou sans préavis
              en cas de violation grave des CGU, de défaut de paiement après mise en demeure restée sans
              effet pendant 15 jours, ou de tout fait engageant la responsabilité de {COMPANY_NAME}.
            </P>
            <P>
              <strong>Effets de la résiliation :</strong> suspension immédiate de l'accès. Le Client dispose
              d'un délai de 30 jours après résiliation pour demander l'export de ses données via
              <MuiLink href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</MuiLink>. Passé ce délai, les
              données sont supprimées (sauf obligations légales de conservation).
            </P>
          </Section>

          <Section title="11. Force majeure">
            <P>
              Aucune des parties ne peut être tenue responsable d'un manquement résultant d'un cas de force
              majeure au sens de l'article 1218 du Code civil (catastrophe naturelle, pandémie, conflit armé,
              décision étatique, panne généralisée d'Internet, cyberattaque massive sur l'infrastructure
              tierce, etc.).
            </P>
          </Section>

          <Section title="12. Évolution des CGU">
            <P>
              {COMPANY_NAME} se réserve le droit de modifier les présentes CGU à tout moment. Les
              modifications substantielles seront notifiées par e-mail aux administrateurs des Clients avec
              un préavis d'au moins 30 jours avant entrée en vigueur. La poursuite de l'utilisation du
              Service après cette date vaut acceptation des nouvelles CGU.
            </P>
          </Section>

          <Section title="13. Droit applicable et juridiction">
            <P>
              Les présentes CGU sont régies par le droit français. Tout différend relatif à leur
              interprétation ou à leur exécution sera, à défaut de résolution amiable préalable, soumis aux
              tribunaux compétents du ressort du siège social de {COMPANY_NAME}.
            </P>
          </Section>

          <Section title="14. Contact">
            <P>
              <strong>Support technique et commercial :</strong>{' '}
              <MuiLink href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</MuiLink>
              <br />
              <strong>Questions juridiques :</strong>{' '}
              <MuiLink href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</MuiLink>
            </P>
          </Section>

          <Divider sx={{ my: 4 }} />
          <Typography variant="caption" color="text.secondary">
            Version : <strong>{VERSION}</strong>
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2, color: 'primary.main' }}>
        {title}
      </Typography>
      <Box sx={{ '& p': { mb: 1.5 }, '& ul': { pl: 3, mb: 1.5 }, '& li': { mb: 0.5 }, lineHeight: 1.7 }}>
        {children}
      </Box>
    </Box>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <Typography component="p" variant="body1">{children}</Typography>;
}
