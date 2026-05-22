import { Box, Container, Typography, Paper, Divider, Link as MuiLink } from '@mui/material';

/**
 * Politique de confidentialité — RGPD / Apple App Store / Google Play.
 *
 * Page PUBLIQUE (cf. PUBLIC_PATHS dans RouteGuards.tsx).
 * Doit rester accessible sans authentification : les bots de review Apple/Google
 * et les utilisateurs candidats à l'inscription la consultent avant tout login.
 *
 * Version sémantique : voir constante VERSION ci-dessous. À bumper à chaque
 * révision significative (changement de finalité, ajout de sous-traitant, etc.).
 * Conserver les anciennes versions en archive (PR git) pour audit RGPD Art. 5.2.
 */
const VERSION = '2026-05-22';
const COMPANY_NAME = 'Concorde Tech';
const APP_NAME = 'Concorde Workly';
const DPO_EMAIL = 'contact@concorde-tech.fr';
const PRIVACY_EMAIL = 'privacy@concorde-work-force.com';
const COMPANY_ADDRESS = 'Concorde Tech, [Adresse postale], France';

export default function PrivacyPolicyPage() {
  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: { xs: 4, md: 8 } }}>
      <Container maxWidth="md">
        <Paper elevation={0} sx={{ p: { xs: 3, md: 6 }, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
            Politique de confidentialité
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            Dernière mise à jour : <strong>{VERSION}</strong> · Application : {APP_NAME} · Éditeur : {COMPANY_NAME}
          </Typography>

          <Section title="1. Identité du responsable de traitement">
            <P>
              <strong>{COMPANY_NAME}</strong>, éditeur de l'application <strong>{APP_NAME}</strong> (site web :{' '}
              <MuiLink href="https://concorde-work-force.com">concorde-work-force.com</MuiLink>),
              agit en qualité de responsable de traitement au sens du Règlement Général sur la Protection des
              Données (RGPD, UE 2016/679) lorsque vous utilisez la version SaaS publique de l'application.
            </P>
            <P>
              Lorsque l'application est utilisée dans le cadre d'un contrat d'abonnement souscrit par votre
              employeur (un tenant), {COMPANY_NAME} agit en qualité de <strong>sous-traitant</strong> de votre
              employeur (responsable de traitement) au sens de l'article 28 RGPD. L'accès, la rectification ou
              l'effacement de vos données doit dans ce cas être demandé en priorité à votre employeur, qui
              transmettra à {COMPANY_NAME} si nécessaire.
            </P>
            <P>
              <strong>Adresse :</strong> {COMPANY_ADDRESS}<br />
              <strong>Contact général :</strong> <MuiLink href={`mailto:${DPO_EMAIL}`}>{DPO_EMAIL}</MuiLink><br />
              <strong>Demandes RGPD / DPO :</strong> <MuiLink href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</MuiLink>
            </P>
          </Section>

          <Section title="2. Catégories de données collectées">
            <P>Dans le cadre du fonctionnement de l'application, nous collectons et traitons :</P>
            <ul>
              <li><strong>Données d'identification :</strong> nom, prénom, civilité, e-mail professionnel, téléphone.</li>
              <li><strong>Données d'authentification :</strong> mot de passe (haché serveur — jamais stocké en clair), jetons de session, jetons de rafraîchissement, empreinte biométrique <em>locale uniquement</em> (stockée dans le keystore du téléphone via <code>expo-secure-store</code>, jamais transmise au serveur).</li>
              <li><strong>Données d'emploi :</strong> société d'appartenance, fonction, poste, planning de travail, soldes de congé, demandes d'autorisation, missions, frais professionnels.</li>
              <li><strong>Données de pointage :</strong> horodatages d'entrée et sortie, position GPS <em>si et seulement si</em> votre employeur a activé le module GeoZones (paramètre tenant désactivé par défaut).</li>
              <li><strong>Pièces jointes :</strong> photos de justificatifs de frais, signatures électroniques, documents RH (contrats, certificats), photos de profil — uniquement à votre initiative.</li>
              <li><strong>Données de notifications :</strong> jeton push Expo, préférences de notification.</li>
              <li><strong>Données techniques :</strong> empreinte de l'appareil (modèle, OS, version applicative), adresse IP, logs d'accès et d'erreur.</li>
              <li><strong>Données IA (Rag) :</strong> contenu des questions posées à l'assistant IA, contenu des documents que vous indexez volontairement dans la base de connaissances de votre tenant.</li>
              <li><strong>Données de facturation (B2B) :</strong> uniquement pour l'administrateur du tenant ayant souscrit l'abonnement — nom de l'entreprise, numéro SIRET/BCE, adresse de facturation. Les <strong>données de paiement (carte bancaire, IBAN) ne transitent jamais par nos serveurs</strong> : elles sont traitées directement par Stripe (cf. section 5).</li>
            </ul>
          </Section>

          <Section title="3. Finalités et bases légales du traitement">
            <P>Chaque traitement repose sur une base légale au sens de l'article 6 RGPD :</P>
            <ul>
              <li><strong>Exécution du contrat (art. 6.1.b) :</strong> fourniture du service de gestion RH/pointage commandé par votre employeur, gestion de votre compte utilisateur, traitement des demandes de congé/autorisation/mission/frais.</li>
              <li><strong>Obligation légale (art. 6.1.c) :</strong> conservation des journaux d'accès et logs d'audit (180 jours par défaut, RGPD art. 32 sécurité du traitement ; durée alignable avec les obligations du Code du travail si applicables).</li>
              <li><strong>Intérêt légitime (art. 6.1.f) :</strong> sécurité des comptes (détection de connexions frauduleuses, empreinte d'appareil, rate-limiting), prévention de la fraude.</li>
              <li><strong>Consentement (art. 6.1.a) :</strong> activation de l'authentification biométrique (Face ID / empreinte digitale) — révocable à tout moment via les paramètres de l'application ; envoi de notifications push ; activation du module GeoZones par votre employeur lorsqu'applicable.</li>
            </ul>
            <P>
              Les données dites « sensibles » au sens de l'article 9 RGPD (par exemple, lorsqu'un motif de
              congé maladie révèle indirectement une information de santé) sont traitées sur la base de
              l'article 9.2.b — droit du travail — uniquement par les personnes habilitées (manager direct,
              service RH) avec une trace d'audit.
            </P>
          </Section>

          <Section title="4. Durées de conservation">
            <P>Conformément à l'article 5.1.e RGPD (limitation de la conservation) :</P>
            <ul>
              <li><strong>Données RH actives :</strong> pendant toute la durée du contrat de travail + durées légales post-rupture (5 ans pour les bulletins de paie en France, art. L3243-4 Code du travail).</li>
              <li><strong>Journaux d'audit et de connexion :</strong> 180 jours (paramétrable par le tenant, plancher applicatif 30 jours pour conformité forensique).</li>
              <li><strong>Jetons de rafraîchissement expirés :</strong> 30 jours après expiration, puis suppression automatique.</li>
              <li><strong>Appareils connus inactifs :</strong> 365 jours sans connexion, puis nettoyage automatique.</li>
              <li><strong>Jetons push inactifs :</strong> 90 jours sans envoi réussi, puis suppression.</li>
              <li><strong>Conversations avec l'assistant IA :</strong> 90 jours, puis suppression automatique.</li>
              <li><strong>Compte supprimé :</strong> les données personnelles sont supprimées ou anonymisées sous 30 jours, sauf si une obligation légale impose une conservation plus longue (ex. : justificatifs comptables 10 ans).</li>
            </ul>
          </Section>

          <Section title="5. Destinataires et sous-traitants">
            <P>Les destinataires de vos données sont strictement limités à :</P>
            <ul>
              <li><strong>Votre employeur (tenant) :</strong> votre manager direct, service RH, administrateur tenant — pour les données utiles à la gestion RH.</li>
              <li><strong>{COMPANY_NAME} :</strong> personnel technique habilité, uniquement à des fins de support et de maintenance, avec engagement de confidentialité.</li>
            </ul>
            <P><strong>Sous-traitants techniques :</strong></P>
            <ul>
              <li><strong>Stripe Payments Europe Ltd</strong> (Irlande) — traitement des paiements abonnements B2B. Vous n'avez pas de relation directe avec Stripe en tant qu'employé ; seul l'administrateur de votre tenant fournit des données de paiement.</li>
              <li><strong>OVH SAS</strong> (France) — hébergement de l'infrastructure principale, e-mails transactionnels SMTP.</li>
              <li><strong>Anthropic PBC</strong> (États-Unis) — moteur d'IA générative pour la fonctionnalité assistant. <em>Voir section 6 sur les transferts internationaux.</em></li>
              <li><strong>Expo / EAS</strong> (États-Unis) — distribution des notifications push (jeton uniquement, pas le contenu sensible).</li>
              <li><strong>Apple Inc.</strong> et <strong>Google LLC</strong> — distribution de l'application via App Store et Google Play.</li>
            </ul>
            <P>
              Aucune donnée n'est cédée, vendue ou louée à des tiers à des fins commerciales ou publicitaires.
            </P>
          </Section>

          <Section title="6. Transferts internationaux">
            <P>
              Les serveurs principaux de {APP_NAME} sont hébergés au sein de l'Union européenne (France).
              Certains sous-traitants peuvent toutefois traiter vos données hors UE :
            </P>
            <ul>
              <li><strong>Anthropic (USA)</strong> — utilisé pour le module d'assistant IA. Le transfert est encadré par les <em>Clauses Contractuelles Types</em> de la Commission européenne (décision 2021/914), et notre paramétrage par défaut privilégie l'endpoint Anthropic direct (résidence UE pour les comptes Enterprise sous contrat de confidentialité étendu). Les requêtes IA ne contiennent <strong>pas</strong> d'informations directement identifiantes au-delà du strict nécessaire à la réponse.</li>
              <li><strong>Expo / EAS (USA)</strong> — uniquement pour le relais des notifications push (jeton anonyme + payload de notification non sensible).</li>
            </ul>
          </Section>

          <Section title="7. Sécurité">
            <P>
              Nous mettons en œuvre les mesures techniques et organisationnelles de l'article 32 RGPD :
              chiffrement TLS 1.2+ avec <em>certificate pinning</em> mobile, chiffrement au repos pour les
              champs sensibles, hachage Argon2 des mots de passe, jetons de rafraîchissement hachés,
              authentification multi-facteur biométrique optionnelle, journaux d'audit horodatés non
              modifiables, verrouillage automatique après inactivité, masquage de l'écran de
              prévisualisation en arrière-plan iOS/Android, revues de code et tests de sécurité réguliers.
            </P>
          </Section>

          <Section title="8. Vos droits">
            <P>Conformément aux articles 15 à 22 RGPD, vous disposez des droits suivants :</P>
            <ul>
              <li><strong>Droit d'accès</strong> à vos données et à leur copie</li>
              <li><strong>Droit de rectification</strong> de données inexactes ou incomplètes</li>
              <li><strong>Droit à l'effacement</strong> dans les limites des obligations légales</li>
              <li><strong>Droit à la limitation</strong> du traitement</li>
              <li><strong>Droit à la portabilité</strong> de vos données dans un format structuré et lisible</li>
              <li><strong>Droit d'opposition</strong> au traitement fondé sur l'intérêt légitime</li>
              <li><strong>Droit de retirer votre consentement</strong> à tout moment (biométrie, notifications, géolocalisation)</li>
              <li><strong>Droit de définir des directives</strong> sur le sort de vos données après votre décès (art. 85 Loi Informatique et Libertés)</li>
            </ul>
            <P>
              Pour exercer ces droits, contactez :
              <br />— votre employeur en priorité (lorsqu'il est responsable de traitement) ;
              <br />— ou directement <MuiLink href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</MuiLink> en
              joignant une copie d'une pièce d'identité (qui sera détruite après vérification).
            </P>
            <P>
              <strong>Délai de réponse :</strong> 30 jours, prorogeable de 2 mois pour les demandes complexes.
            </P>
            <P>
              <strong>Réclamation auprès d'une autorité de contrôle :</strong> vous pouvez à tout moment
              déposer une plainte auprès de la CNIL (France —{' '}
              <MuiLink href="https://www.cnil.fr/fr/plaintes" target="_blank" rel="noopener">cnil.fr/plaintes</MuiLink>)
              ou de l'autorité de protection des données de votre pays de résidence.
            </P>
          </Section>

          <Section title="9. Cookies et traceurs (interface web)">
            <P>
              Le site <MuiLink href="https://concorde-work-force.com">concorde-work-force.com</MuiLink> utilise
              des cookies strictement nécessaires au fonctionnement (session, préférences linguistiques, thème
              sombre/clair). Aucun cookie publicitaire ou de profilage n'est déposé. La bannière de consentement
              affichée au premier accès permet de gérer vos préférences.
            </P>
            <P>L'application mobile ne dépose pas de cookies — elle utilise un stockage sécurisé local équivalent.</P>
          </Section>

          <Section title="10. Mineurs">
            <P>
              {APP_NAME} est un service professionnel destiné aux salariés des entreprises clientes.
              L'application n'est pas destinée à des personnes de moins de 16 ans. Aucune donnée d'enfant
              n'est sciemment collectée. Si vous estimez que des données d'un mineur ont été collectées,
              contactez <MuiLink href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</MuiLink> pour suppression immédiate.
            </P>
          </Section>

          <Section title="11. Modifications">
            <P>
              Toute modification substantielle de la présente politique sera notifiée par e-mail aux
              utilisateurs actifs au moins 15 jours avant son entrée en vigueur, et fera l'objet d'une mise à
              jour de la date affichée en tête du document. Les versions précédentes sont conservées en archive
              et peuvent être communiquées sur demande.
            </P>
          </Section>

          <Divider sx={{ my: 4 }} />
          <Typography variant="caption" color="text.secondary">
            Version : <strong>{VERSION}</strong> — Pour toute question :{' '}
            <MuiLink href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</MuiLink>
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
