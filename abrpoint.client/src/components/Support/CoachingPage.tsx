import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Divider } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import TuneIcon from '@mui/icons-material/Tune';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import KeyIcon from '@mui/icons-material/Key';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import EventNoteIcon from '@mui/icons-material/EventNote';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useTranslation } from 'react-i18next';

const REASON_KEYS: { key: string; icon: React.ReactNode }[] = [
  { key: 'tailored', icon: <TuneIcon sx={{ color: '#0891b2' }} /> },
  { key: 'concrete', icon: <LightbulbIcon sx={{ color: '#0891b2' }} /> },
  { key: 'key', icon: <KeyIcon sx={{ color: '#0891b2' }} /> },
  { key: 'roi', icon: <TrendingUpIcon sx={{ color: '#0891b2' }} /> },
  { key: 'prep', icon: <EventNoteIcon sx={{ color: '#0891b2' }} /> },
];

const STEP_KEYS = [
  { n: 1, key: 'needs' },
  { n: 2, key: 'preparation' },
  { n: 3, key: 'session' },
  { n: 4, key: 'autonomy' },
];

const CoachingPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <Box sx={{ p: { xs: 3, md: 5 }, maxWidth: 1080, mx: 'auto' }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/dashboard/support')} sx={{ mb: 2, color: '#475569', textTransform: 'none', fontWeight: 600 }}>
        {t('support.common.back')}
      </Button>

      <Typography sx={{ fontSize: 28, fontWeight: 800, color: '#191c1e', mb: 1 }}>{t('support.coaching.title')}</Typography>
      <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#0891b2', mb: 2 }}>
        {t('support.coaching.tagline')}
      </Typography>
      <Typography sx={{ fontSize: 14, color: '#475569', mb: 1.5, lineHeight: 1.7 }}>
        {t('support.coaching.intro1')}
      </Typography>
      <Typography sx={{ fontSize: 14, color: '#475569', mb: 4, lineHeight: 1.7 }}>
        {t('support.coaching.intro2')}
      </Typography>

      <Box sx={{ p: { xs: 3, md: 4 }, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#fff', mb: 3 }}>
        <Typography sx={{ fontSize: 18, fontWeight: 700, mb: 3, color: '#191c1e' }}>
          {t('support.coaching.whyTitle')}
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {REASON_KEYS.map((r) => (
            <Box key={r.key} sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
              <Box sx={{ flexShrink: 0, width: 40, height: 40, borderRadius: 2, bgcolor: '#0891b215', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {r.icon}
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 14.5, color: '#191c1e', mb: 0.5 }}>
                  {t(`support.coaching.reasons.${r.key}.title`)}
                </Typography>
                <Typography sx={{ fontSize: 13.5, color: '#475569', lineHeight: 1.6 }}>
                  {t(`support.coaching.reasons.${r.key}.body`)}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      <Box sx={{ p: { xs: 3, md: 4 }, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#fff', mb: 3 }}>
        <Typography sx={{ fontSize: 18, fontWeight: 700, mb: 3, color: '#191c1e' }}>{t('support.coaching.howTitle')}</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {STEP_KEYS.map((s) => (
            <Box key={s.n} sx={{ display: 'flex', alignItems: 'flex-start', gap: 2.5 }}>
              <Box sx={{ flexShrink: 0, width: 36, height: 36, borderRadius: '999px', bgcolor: '#0891b2', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14 }}>
                {s.n}
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 14.5, color: '#191c1e', mb: 0.5 }}>
                  {t(`support.coaching.steps.${s.key}.title`)}
                </Typography>
                <Typography sx={{ fontSize: 13.5, color: '#475569', lineHeight: 1.6 }}>
                  {t(`support.coaching.steps.${s.key}.body`)}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      <Box sx={{ p: 4, borderRadius: 3, color: '#fff', mb: 3, background: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)' }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, opacity: 0.85, textTransform: 'uppercase', letterSpacing: 1.5, mb: 1 }}>
          {t('support.coaching.priceLabel')}
        </Typography>
        <Typography sx={{ fontSize: 32, fontWeight: 900, lineHeight: 1 }}>
          {t('support.coaching.priceValue')}{' '}
          <span style={{ fontSize: 16, opacity: 0.85, fontWeight: 600 }}>{t('support.coaching.perHour')}</span>
        </Typography>
        <Typography sx={{ fontSize: 13.5, opacity: 0.92, mt: 1.5, mb: 3, lineHeight: 1.6 }}>
          {t('support.coaching.priceSubtitle')}
        </Typography>
        <Button variant="contained" onClick={() => navigate('/dashboard/support/contact')} sx={{ bgcolor: '#fff', color: '#0e7490', textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: '#f1f5f9' } }}>
          {t('support.common.bookSession')}
        </Button>
      </Box>

      <Box sx={{ p: 3, borderRadius: 3, bgcolor: '#fef3c7', border: '1px solid #fcd34d', display: 'flex', gap: 2, alignItems: 'flex-start', mb: 3 }}>
        <InfoOutlinedIcon sx={{ color: '#92400e', flexShrink: 0, mt: 0.2 }} />
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 13.5, color: '#78350f', mb: 0.5 }}>
            {t('support.coaching.fundingTitle')}
          </Typography>
          <Typography sx={{ fontSize: 13, color: '#92400e', lineHeight: 1.6 }}>
            {t('support.coaching.fundingBody')}
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ my: 3 }} />
      <Box sx={{ textAlign: 'center', py: 2 }}>
        <Typography sx={{ fontSize: 18, fontWeight: 800, color: '#191c1e', mb: 1.5 }}>
          {t('support.coaching.ctaTitle')}
        </Typography>
        <Typography sx={{ fontSize: 13.5, color: '#475569', mb: 2.5, lineHeight: 1.7 }}>
          {t('support.coaching.ctaBody')}
        </Typography>
        <Button variant="contained" size="large" onClick={() => navigate('/dashboard/support/contact')} sx={{ bgcolor: '#0891b2', textTransform: 'none', fontWeight: 700, px: 5, py: 1.5, '&:hover': { bgcolor: '#0e7490' } }}>
          {t('support.common.contactUs')}
        </Button>
      </Box>
    </Box>
  );
};

export default CoachingPage;
