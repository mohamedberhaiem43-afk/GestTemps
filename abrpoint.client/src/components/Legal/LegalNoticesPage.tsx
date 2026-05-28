import { Box, Typography, Container, Divider, Paper } from '@mui/material';
import DashboardLayoutBasic from '../navigation/Navigation';

interface LegalSectionProps {
  title: string;
  children: React.ReactNode;
}

function LegalSection({ title, children }: LegalSectionProps) {
  return (
    <Box sx={{ mb: 4 }}>
      <Typography
        variant="h6"
        component="h2"
        sx={{ fontWeight: 700, mb: 1.5, color: 'primary.main' }}
      >
        {title}
      </Typography>
      <Divider sx={{ mb: 2 }} />
      {children}
    </Box>
  );
}

function LegalNoticesPage() {
  return (
    <>
      <DashboardLayoutBasic />
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 700, mb: 4 }}>
          Mentions légales
        </Typography>

        <Paper elevation={0} variant="outlined" sx={{ p: { xs: 3, md: 5 }, borderRadius: 2 }}>

          {/* Éditeur */}
          <LegalSection title="Éditeur">
            <Typography variant="body1" paragraph>
              Le site, la plateforme <strong>« Concorde Workforce »</strong> et l'application{' '}
              <strong>« Concorde Workly »</strong> sont édités par la société{' '}
              <strong>CONCORDE TECH INNOVATION</strong>, société par actions simplifiée (SAS) au
              capital social de <strong>5 000 euros</strong>, dont le siège social est situé au{' '}
              <strong>50 avenue des Champs-Élysées, 75008 Paris (France)</strong>, immatriculée au
              Registre du commerce et des sociétés de Paris sous le numéro{' '}
              <strong>102 487 774</strong>, numéro de TVA intracommunautaire{' '}
              <strong>FR09102487774</strong>.
            </Typography>
            <Typography variant="body1" paragraph>
              <strong>Directrice de la publication :</strong> Madame Ayadi Aida
            </Typography>
            <Typography variant="body1">
              <strong>Contact :</strong>{' '}
              <a href="mailto:contact@concorde-tech.fr">contact@concorde-tech.fr</a>
            </Typography>
          </LegalSection>

          {/* Hébergeur */}
          <LegalSection title="Hébergeur">
            <Typography variant="body1" paragraph>
              Le site et la plateforme sont hébergés par <strong>OVH SAS (« OVHcloud »)</strong>,
              société par actions simplifiée dont le siège social est situé au{' '}
              <strong>2 rue Kellermann, 59100 Roubaix (France)</strong>, immatriculée au RCS Lille
              Métropole sous le numéro <strong>424 761 419</strong> — tél. :{' '}
              <a href="tel:+33972101007">+33 (0)9 72 10 10 07</a>.
            </Typography>
            <Typography variant="body1">
              Les serveurs assurant l'hébergement sont situés au sein de l'Union européenne, dans
              les centres de données d'OVHcloud localisés à{' '}
              <strong>Roubaix et/ou Gravelines (France)</strong>.
            </Typography>
          </LegalSection>

          {/* Stockage des données */}
          <LegalSection title="Stockage des données">
            <Typography variant="body1" paragraph>
              Le stockage des données traitées au moyen de la plateforme est assuré par{' '}
              <strong>OVH SAS (« OVHcloud »)</strong>, société par actions simplifiée dont le siège
              social est situé au <strong>2 rue Kellermann, 59100 Roubaix (France)</strong>,
              immatriculée au RCS Lille Métropole sous le numéro <strong>424 761 419</strong>.
            </Typography>
            <Typography variant="body1">
              Les données sont stockées au sein de l'Union européenne, dans les centres de données
              d'OVHcloud localisés à <strong>Roubaix et/ou Gravelines (France)</strong>.
            </Typography>
          </LegalSection>

        </Paper>
      </Container>
    </>
  );
}

export default LegalNoticesPage;