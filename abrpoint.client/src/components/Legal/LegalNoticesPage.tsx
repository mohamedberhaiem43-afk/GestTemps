import { Box, Typography, Container } from '@mui/material';
import DashboardLayoutBasic from '../navigation/Navigation';

function LegalNoticesPage() {
  return (
    <>
      <DashboardLayoutBasic />
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Mentions légales
          </Typography>
          <Typography variant="body1" paragraph>
            {/* Placeholder content – replace with actual legal mentions */}
            Ceci est la page des mentions légales. Veuillez ajouter le contenu juridique approprié ici.
          </Typography>
        </Box>
      </Container>
    </>
  );
}

export default LegalNoticesPage;
