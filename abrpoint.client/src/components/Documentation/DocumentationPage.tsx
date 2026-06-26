import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Typography, Card, CardActionArea, CardContent, InputBase, Paper, Chip, useTheme,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../helper/AuthProvider';
import { DocIcon } from './docsIcons';
import {
  DOC_CATEGORIES, DOC_ARTICLES_META, getDocContent, type DocArticleMeta,
} from './docsContent';

/** Une entrée d'article résolue (méta + contenu localisé) prête à l'affichage. */
interface ResolvedArticle {
  meta: DocArticleMeta;
  title: string;
  summary: string;
  /** Texte indexé pour la recherche (titres de sections inclus), en minuscules. */
  haystack: string;
}

const DocumentationPage: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { i18n } = useTranslation();
  // Gating : seul un utilisateur en vue gestion (admin / RH / manager) voit la
  // catégorie « administration ». Un salarié — ou un dual-rôle basculé en vue
  // salarié — ne voit que les guides à audience 'all'. Cf. memory dual-role-view-mode.
  const { isManagementView } = useAuth();
  const content = getDocContent(i18n.language);
  const [query, setQuery] = React.useState('');

  const titleColor = isDark ? '#f1f5f9' : '#191c1e';
  const subColor = isDark ? '#94a3b8' : '#475569';
  const borderColor = isDark ? '#334155' : '#e2e8f0';
  const cardBg = isDark ? '#1e293b' : '#fff';

  // Catégories visibles selon l'audience, avec leurs articles résolus.
  const visibleCategories = React.useMemo(() => {
    return DOC_CATEGORIES
      .filter((cat) => cat.audience === 'all' || isManagementView)
      .map((cat) => {
        const articles: ResolvedArticle[] = cat.articleSlugs
          .map((slug) => {
            const meta = DOC_ARTICLES_META[slug];
            const art = content.articles[slug];
            if (!meta || !art) return null;
            // On masque aussi au niveau article (défense en profondeur si une
            // catégorie 'all' contenait un article 'management').
            if (meta.audience === 'management' && !isManagementView) return null;
            const haystack = [
              art.title,
              art.summary,
              ...art.sections.map((s) => s.heading),
            ].join(' ').toLowerCase();
            return { meta, title: art.title, summary: art.summary, haystack };
          })
          .filter((a): a is ResolvedArticle => a !== null);
        return { key: cat.key, meta: content.categories[cat.key], articles };
      })
      .filter((cat) => cat.articles.length > 0);
  }, [content, isManagementView]);

  // Filtrage par recherche (sur titre, résumé et titres de sections).
  const q = query.trim().toLowerCase();
  const filtered = React.useMemo(() => {
    if (!q) return visibleCategories;
    return visibleCategories
      .map((cat) => ({ ...cat, articles: cat.articles.filter((a) => a.haystack.includes(q)) }))
      .filter((cat) => cat.articles.length > 0);
  }, [visibleCategories, q]);

  const renderCard = (a: ResolvedArticle) => (
    <Card
      key={a.meta.slug}
      sx={{ borderRadius: 3, boxShadow: 'none', border: `1px solid ${borderColor}`, bgcolor: cardBg, height: '100%' }}
    >
      <CardActionArea
        onClick={() => navigate(`/dashboard/documentation/${a.meta.slug}`)}
        sx={{ p: 0, height: '100%' }}
      >
        <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box
            sx={{
              width: 52, height: 52, borderRadius: 2, mb: 2,
              bgcolor: `${a.meta.color}15`, color: a.meta.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <DocIcon name={a.meta.icon} sx={{ fontSize: 28 }} />
          </Box>
          <Typography sx={{ fontSize: 16.5, fontWeight: 700, color: titleColor, mb: 0.75 }}>
            {a.title}
          </Typography>
          <Typography sx={{ fontSize: 13, color: subColor, lineHeight: 1.55, flexGrow: 1 }}>
            {a.summary}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 2, color: a.meta.color }}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 700 }}>{content.shell.readArticle}</Typography>
            <ArrowForwardIcon sx={{ fontSize: 15 }} />
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );

  return (
    <Box sx={{ p: { xs: 3, md: 5 }, maxWidth: 1280, mx: 'auto', width: '100%' }}>
      {/* En-tête */}
      <Box sx={{ mb: 4 }}>
        <Typography sx={{ fontSize: 30, fontWeight: 800, color: titleColor, letterSpacing: '-0.02em' }}>
          {content.shell.title}
        </Typography>
        <Typography sx={{ fontSize: 14.5, color: subColor, mt: 1, maxWidth: 720, lineHeight: 1.6 }}>
          {content.shell.subtitle}
        </Typography>
      </Box>

      {/* Barre de recherche */}
      <Paper
        elevation={0}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.25, mb: 4,
          borderRadius: 3, border: `1px solid ${borderColor}`, bgcolor: cardBg, maxWidth: 560,
        }}
      >
        <SearchIcon sx={{ color: subColor, fontSize: 22 }} />
        <InputBase
          fullWidth
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={content.shell.searchPlaceholder}
          sx={{ fontSize: 14.5, color: titleColor }}
          inputProps={{ 'aria-label': content.shell.searchPlaceholder }}
        />
      </Paper>

      {q && (
        <Typography sx={{ fontSize: 13, color: subColor, mb: 2 }}>
          {content.shell.resultsFor} « {query} »
        </Typography>
      )}

      {/* Catégories */}
      {filtered.length === 0 ? (
        <Box sx={{ py: 8, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 14.5, color: subColor }}>{content.shell.noResults}</Typography>
        </Box>
      ) : (
        filtered.map((cat) => (
          <Box key={cat.key} sx={{ mb: 5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
              <Typography sx={{ fontSize: 19, fontWeight: 800, color: titleColor }}>
                {cat.meta?.title}
              </Typography>
              {DOC_CATEGORIES.find((c) => c.key === cat.key)?.audience === 'management' && (
                <Chip
                  label={content.shell.managementBadge}
                  size="small"
                  sx={{
                    height: 22, fontSize: 11, fontWeight: 700,
                    bgcolor: isDark ? '#334155' : '#eef2ff', color: isDark ? '#cbd5e1' : '#4338ca',
                  }}
                />
              )}
            </Box>
            {cat.meta?.subtitle && (
              <Typography sx={{ fontSize: 13.5, color: subColor, mb: 2.5 }}>{cat.meta.subtitle}</Typography>
            )}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
                gap: 2.5,
              }}
            >
              {cat.articles.map(renderCard)}
            </Box>
          </Box>
        ))
      )}

      {/* Encadré « besoin d'aide » → Support */}
      <Card
        sx={{
          mt: 2, borderRadius: 3, boxShadow: 'none', border: `1px solid ${borderColor}`,
          bgcolor: isDark ? 'rgba(0,64,161,0.12)' : '#f8fafc',
        }}
      >
        <CardActionArea onClick={() => navigate('/dashboard/support')} sx={{ p: { xs: 2.5, md: 3 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 48, height: 48, borderRadius: 2, flexShrink: 0,
                bgcolor: isDark ? 'rgba(147,197,253,0.15)' : '#e0e7ff', color: theme.palette.primary.main,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <SupportAgentIcon />
            </Box>
            <Box sx={{ flexGrow: 1 }}>
              <Typography sx={{ fontSize: 15.5, fontWeight: 700, color: titleColor }}>
                {content.shell.needHelpTitle}
              </Typography>
              <Typography sx={{ fontSize: 13, color: subColor, mt: 0.25 }}>
                {content.shell.needHelpBody}
              </Typography>
            </Box>
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 0.5, color: theme.palette.primary.main }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{content.shell.contactSupport}</Typography>
              <ArrowForwardIcon sx={{ fontSize: 16 }} />
            </Box>
          </Box>
        </CardActionArea>
      </Card>
    </Box>
  );
};

export default DocumentationPage;
