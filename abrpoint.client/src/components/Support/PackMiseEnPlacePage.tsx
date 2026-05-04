import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Divider } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AddBusinessIcon from '@mui/icons-material/AddBusiness';
import VerifiedIcon from '@mui/icons-material/Verified';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useTranslation } from 'react-i18next';

const USE_CASE_KEYS: { key: string; icon: React.ReactNode }[] = [
  { key: 'start', icon: <PlayArrowIcon sx={{ color: '#ea580c' }} /> },
  { key: 'branch', icon: <AddBusinessIcon sx={{ color: '#ea580c' }} /> },
  { key: 'expert', icon: <VerifiedIcon sx={{ color: '#ea580c' }} /> },
];

const INCLUDE_KEYS = [
  'import', 'calendar', 'rules', 'users', 'overtime',
  'devices', 'templates', 'test', 'training',
];

const PackMiseEnPlacePage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <Box sx={{ p: { xs: 3, md: 5 }, maxWidth: 1080, mx: 'auto' }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/dashboard/support')} sx={{ mb: 2, color: '#475569', textTransform: 'none', fontWeight: 600 }}>
        {t('support.common.back')}
      </Button>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
        <Box sx={{ width: 56, height: 56, borderRadius: 2, bgcolor: '#ea580c15', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <RocketLaunchIcon sx={{ fontSize: 32 }} />
        </Box>
        <Typography sx={{ fontSize: 28, fontWeight: 800, color: '#191c1e' }}>{t('support.pack.title')}</Typography>
      </Box>
      <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#ea580c', mb: 2 }}>
        {t('support.pack.tagline')}
      </Typography>
      <Typography sx={{ fontSize: 14, color: '#475569', mb: 1.5, lineHeight: 1.7 }}>
        {t('support.pack.intro1')}
      </Typography>
      <Typography sx={{ fontSize: 14, color: '#475569', mb: 4, lineHeight: 1.7, fontWeight: 600 }}>
        {t('support.pack.intro2')}
      </Typography>

      <Box sx={{ p: { xs: 3, md: 4 }, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#fff', mb: 3 }}>
        <Typography sx={{ fontSize: 18, fontWeight: 700, mb: 2, color: '#191c1e' }}>
          {t('support.pack.whatTitle')}
        </Typography>
        <Typography sx={{ fontSize: 14, color: '#475569', lineHeight: 1.7 }}>
          {t('support.pack.whatBody')}
        </Typography>
      </Box>

      <Box sx={{ p: { xs: 3, md: 4 }, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#fff', mb: 3 }}>
        <Typography sx={{ fontSize: 18, fontWeight: 700, mb: 3, color: '#191c1e' }}>
          {t('support.pack.whenTitle')}
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {USE_CASE_KEYS.map((u) => (
            <Box key={u.key} sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
              <Box sx={{ flexShrink: 0, width: 40, height: 40, borderRadius: 2, bgcolor: '#ea580c15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {u.icon}
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 14.5, color: '#191c1e', mb: 0.5 }}>
                  {t(`support.pack.useCases.${u.key}.title`)}
                </Typography>
                <Typography sx={{ fontSize: 13.5, color: '#475569', lineHeight: 1.6 }}>
                  {t(`support.pack.useCases.${u.key}.body`)}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      <Box sx={{ p: { xs: 3, md: 4 }, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#fff', mb: 3 }}>
        <Typography sx={{ fontSize: 18, fontWeight: 700, mb: 1, color: '#191c1e' }}>
          {t('support.pack.includesTitle')}
        </Typography>
        <Typography sx={{ fontSize: 12.5, color: '#64748b', mb: 3, fontStyle: 'italic' }}>
          {t('support.pack.includesNote')}
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {INCLUDE_KEYS.map((k) => (
            <Box key={k} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
              <CheckCircleIcon sx={{ color: '#ea580c', fontSize: 22, flexShrink: 0, mt: 0.1 }} />
              <Typography sx={{ fontSize: 13.5, color: '#334155', lineHeight: 1.6 }}>
                {t(`support.pack.includes.${k}`)}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      <Box sx={{ p: 4, borderRadius: 3, bgcolor: '#fff7ed', border: '1px solid #fdba74', mb: 3 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 700, mb: 1, color: '#9a3412' }}>
          {t('support.pack.pricingTitle')}
        </Typography>
        <Typography sx={{ fontSize: 14, color: '#7c2d12', mb: 2.5, lineHeight: 1.7 }}>
          {t('support.pack.pricingBody')}
          <br />• {t('support.pack.pricingSmall')} : <strong>{t('support.pack.pricingSmallValue')}</strong>
          <br />• {t('support.pack.pricingMedium')} : <strong>{t('support.pack.pricingMediumValue')}</strong>
          <br />• {t('support.pack.pricingLarge')} : <strong>{t('support.pack.pricingLargeValue')}</strong>
        </Typography>
        <Button variant="contained" onClick={() => navigate('/dashboard/support/contact')} sx={{ bgcolor: '#ea580c', textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: '#c2410c' } }}>
          {t('support.common.requestQuote')}
        </Button>
      </Box>

      <Divider sx={{ my: 3 }} />
      <Box sx={{ textAlign: 'center', py: 2 }}>
        <Typography sx={{ fontSize: 18, fontWeight: 800, color: '#191c1e', mb: 1.5 }}>
          {t('support.pack.ctaTitle')}
        </Typography>
        <Typography sx={{ fontSize: 13.5, color: '#475569', mb: 2.5, lineHeight: 1.7 }}>
          {t('support.pack.ctaBody')}
        </Typography>
        <Button variant="contained" size="large" onClick={() => navigate('/dashboard/support/contact')} sx={{ bgcolor: '#ea580c', textTransform: 'none', fontWeight: 700, px: 5, py: 1.5, '&:hover': { bgcolor: '#c2410c' } }}>
          {t('support.common.contactUs')}
        </Button>
      </Box>
    </Box>
  );
};

export default PackMiseEnPlacePage;
