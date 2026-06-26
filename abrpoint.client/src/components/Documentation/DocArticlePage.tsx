import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Paper, Divider, useTheme,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../helper/AuthProvider';
import { DocIcon } from './docsIcons';
import { DOC_ARTICLES_META, getDocContent } from './docsContent';

interface DocArticlePageProps {
  slug: string;
}

const DocArticlePage: React.FC<DocArticlePageProps> = ({ slug }) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { i18n } = useTranslation();
  const { isManagementView } = useAuth();
  const content = getDocContent(i18n.language);

  const meta = DOC_ARTICLES_META[slug];
  const article = content.articles[slug];

  const titleColor = isDark ? '#f1f5f9' : '#191c1e';
  const subColor = isDark ? '#94a3b8' : '#475569';
  const borderColor = isDark ? '#334155' : '#e2e8f0';
  const cardBg = isDark ? '#1e293b' : '#fff';

  const backToHub = () => navigate('/dashboard/documentation');

  // Article inconnu OU réservé à la gestion consulté par un salarié (accès direct
  // à l'URL) → message neutre + retour, sans divulguer le contenu admin.
  const isGated = meta?.audience === 'management' && !isManagementView;
  if (!meta || !article || isGated) {
    return (
      <Box sx={{ p: { xs: 3, md: 5 }, maxWidth: 980, mx: 'auto' }}>
        <Button startIcon={<ArrowBackIcon />} onClick={backToHub} sx={{ mb: 3, color: subColor, textTransform: 'none', fontWeight: 600 }}>
          {content.shell.back}
        </Button>
        <Paper elevation={0} sx={{ p: 5, borderRadius: 3, border: `1px solid ${borderColor}`, bgcolor: cardBg, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 16, fontWeight: 700, color: titleColor, mb: 1 }}>
            {content.shell.noResults}
          </Typography>
          <Button variant="contained" onClick={backToHub} sx={{ mt: 2, textTransform: 'none', fontWeight: 700 }}>
            {content.shell.title}
          </Button>
        </Paper>
      </Box>
    );
  }

  const scrollToSection = (i: number) => {
    const el = document.getElementById(`doc-section-${i}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <Box sx={{ p: { xs: 3, md: 5 }, maxWidth: 980, mx: 'auto', width: '100%' }}>
      <Button startIcon={<ArrowBackIcon />} onClick={backToHub} sx={{ mb: 3, color: subColor, textTransform: 'none', fontWeight: 600 }}>
        {content.shell.back}
      </Button>

      {/* En-tête de l'article */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2.5, mb: 1.5 }}>
        <Box
          sx={{
            width: 56, height: 56, borderRadius: 2, flexShrink: 0,
            bgcolor: `${meta.color}15`, color: meta.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <DocIcon name={meta.icon} sx={{ fontSize: 30 }} />
        </Box>
        <Box>
          <Typography sx={{ fontSize: 26, fontWeight: 800, color: titleColor, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            {article.title}
          </Typography>
          <Typography sx={{ fontSize: 14.5, color: subColor, mt: 0.75, lineHeight: 1.6 }}>
            {article.summary}
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ my: 3, borderColor }} />

      {/* Sommaire « Sur cette page » */}
      {article.sections.length > 1 && (
        <Paper
          elevation={0}
          sx={{ p: 2.5, mb: 4, borderRadius: 3, border: `1px solid ${borderColor}`, bgcolor: isDark ? 'rgba(148,163,184,0.06)' : '#f8fafc' }}
        >
          <Typography sx={{ fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: subColor, mb: 1.25 }}>
            {content.shell.onThisPage}
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {article.sections.map((s, i) => (
              <Box component="li" key={i}>
                <Box
                  component="button"
                  onClick={() => scrollToSection(i)}
                  sx={{
                    p: 0, border: 'none', bgcolor: 'transparent', cursor: 'pointer',
                    color: theme.palette.primary.main, fontSize: 13.5, fontWeight: 600,
                    textAlign: 'left', fontFamily: 'inherit', '&:hover': { textDecoration: 'underline' },
                  }}
                >
                  {s.heading}
                </Box>
              </Box>
            ))}
          </Box>
        </Paper>
      )}

      {/* Sections */}
      {article.sections.map((s, i) => (
        <Box key={i} id={`doc-section-${i}`} sx={{ mb: 4, scrollMarginTop: 90 }}>
          <Typography sx={{ fontSize: 18.5, fontWeight: 800, color: titleColor, mb: 1.25 }}>
            {s.heading}
          </Typography>

          {s.body && (
            <Typography sx={{ fontSize: 14.5, color: subColor, lineHeight: 1.75, mb: s.steps || s.tips ? 2 : 0 }}>
              {s.body}
            </Typography>
          )}

          {/* Étapes (liste ordonnée) */}
          {s.steps && s.steps.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: s.tips ? 2.5 : 0 }}>
              {s.steps.map((step, j) => (
                <Box key={j} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.75 }}>
                  <Box
                    sx={{
                      flexShrink: 0, width: 26, height: 26, borderRadius: '999px',
                      bgcolor: meta.color, color: '#fff', fontSize: 13, fontWeight: 800,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', mt: '1px',
                    }}
                  >
                    {j + 1}
                  </Box>
                  <Typography sx={{ fontSize: 14.5, color: subColor, lineHeight: 1.65, pt: '2px' }}>
                    {step}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}

          {/* Encadré « Bon à savoir » */}
          {s.tips && s.tips.length > 0 && (
            <Paper
              elevation={0}
              sx={{
                p: 2.25, borderRadius: 2.5, border: `1px solid ${isDark ? '#3f3a1f' : '#fcd34d'}`,
                bgcolor: isDark ? 'rgba(252,211,77,0.08)' : '#fffbeb',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <LightbulbIcon sx={{ fontSize: 18, color: isDark ? '#fcd34d' : '#b45309' }} />
                <Typography sx={{ fontSize: 12.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: isDark ? '#fcd34d' : '#b45309' }}>
                  {content.shell.tipsLabel}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {s.tips.map((tip, k) => (
                  <Box key={k} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                    <CheckCircleIcon sx={{ fontSize: 16, color: isDark ? '#fcd34d' : '#b45309', mt: '2px', flexShrink: 0 }} />
                    <Typography sx={{ fontSize: 13.5, color: isDark ? '#d1c5a0' : '#92400e', lineHeight: 1.6 }}>
                      {tip}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Paper>
          )}
        </Box>
      ))}

      <Divider sx={{ my: 4, borderColor }} />

      {/* Bas de page : retour + support */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', justifyContent: 'space-between' }}>
        <Button startIcon={<ArrowBackIcon />} onClick={backToHub} sx={{ color: subColor, textTransform: 'none', fontWeight: 600 }}>
          {content.shell.back}
        </Button>
        <Button
          startIcon={<SupportAgentIcon />}
          variant="outlined"
          onClick={() => navigate('/dashboard/support')}
          sx={{ textTransform: 'none', fontWeight: 700, borderColor, color: titleColor }}
        >
          {content.shell.contactSupport}
        </Button>
      </Box>
    </Box>
  );
};

export default DocArticlePage;
