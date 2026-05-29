import { Button, Paper, Typography } from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DownloadIcon from '@mui/icons-material/Download';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

interface LegalPdfBannerProps {
  /** Chemin du PDF servi depuis /public (ex: '/docs/cgu.pdf'). */
  href: string;
  /** Nom de fichier proposé au téléchargement (ex: 'CGU-Concorde.pdf'). */
  downloadName: string;
  /** Libellé du document (ex: 'Conditions Générales d'Utilisation'). */
  label: string;
}

/**
 * Bandeau permettant de consulter / télécharger la version PDF officielle d'un
 * document légal (CGU, mentions légales, politique de confidentialité). Les PDF
 * signés sont servis comme assets statiques depuis /public/docs ; la page HTML
 * en reste la version lisible/accessible, le PDF étant la version de référence.
 */
export default function LegalPdfBanner({ href, downloadName, label }: LegalPdfBannerProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 2,
        p: 2,
        mb: 4,
        borderRadius: 2,
        bgcolor: 'action.hover',
      }}
    >
      <PictureAsPdfIcon sx={{ color: '#ba1a1a' }} />
      <Typography variant="body2" sx={{ flex: 1, minWidth: 200 }}>
        Version PDF officielle&nbsp;: <strong>{label}</strong>
      </Typography>
      <Button
        variant="outlined"
        size="small"
        startIcon={<OpenInNewIcon />}
        href={href}
        target="_blank"
        rel="noopener"
        sx={{ textTransform: 'none', fontWeight: 600 }}
      >
        Consulter
      </Button>
      <Button
        variant="contained"
        size="small"
        startIcon={<DownloadIcon />}
        href={href}
        download={downloadName}
        sx={{ textTransform: 'none', fontWeight: 600 }}
      >
        Télécharger
      </Button>
    </Paper>
  );
}
