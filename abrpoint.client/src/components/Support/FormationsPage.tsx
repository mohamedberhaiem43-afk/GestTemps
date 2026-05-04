import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Chip } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import VideocamIcon from '@mui/icons-material/Videocam';
import GroupsIcon from '@mui/icons-material/Groups';
import SchoolIcon from '@mui/icons-material/School';
import { useTranslation, Trans } from 'react-i18next';

const FormationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const sessions = [
    { key: 'intro', icon: <VideocamIcon />, modeKey: 'remote', duration: '2h', audienceKey: 'everyone' },
    { key: 'payroll', icon: <VideocamIcon />, modeKey: 'remote', duration: '3h', audienceKey: 'hrFinance' },
    { key: 'devices', icon: <GroupsIcon />, modeKey: 'onsite', duration: '4h', audienceKey: 'itOps' },
    { key: 'leaves', icon: <VideocamIcon />, modeKey: 'remote', duration: '2h', audienceKey: 'managers' },
  ];

  return (
    <Box sx={{ p: { xs: 3, md: 5 }, maxWidth: 1100, mx: 'auto' }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/dashboard/support')} sx={{ mb: 2, color: '#475569', textTransform: 'none', fontWeight: 600 }}>
        {t('support.common.back')}
      </Button>
      <Typography sx={{ fontSize: 28, fontWeight: 800, color: '#191c1e', mb: 1 }}>{t('support.formations.title')}</Typography>
      <Typography sx={{ fontSize: 14, color: '#475569', mb: 4 }}>
        {t('support.formations.subtitle')}
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 3 }}>
        {sessions.map((s) => (
          <Box key={s.key} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#fff', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: '#7c3aed15', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {s.icon}
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#191c1e' }}>
                  {t(`support.formations.sessions.${s.key}.title`)}
                </Typography>
                <Typography sx={{ fontSize: 12, color: '#64748b' }}>
                  {t(`support.formations.audiences.${s.audienceKey}`)}
                </Typography>
              </Box>
            </Box>
            <Typography sx={{ fontSize: 13.5, color: '#475569', lineHeight: 1.6 }}>
              {t(`support.formations.sessions.${s.key}.desc`)}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Chip size="small" label={s.duration} sx={{ bgcolor: '#f1f5f9', fontWeight: 600 }} />
              <Chip size="small" label={t(`support.formations.modes.${s.modeKey}`)} sx={{ bgcolor: '#7c3aed15', color: '#7c3aed', fontWeight: 600 }} />
            </Box>
          </Box>
        ))}
      </Box>
      <Box sx={{ mt: 4, p: 3, borderRadius: 3, bgcolor: '#7c3aed10', display: 'flex', alignItems: 'center', gap: 2 }}>
        <SchoolIcon sx={{ color: '#7c3aed' }} />
        <Typography sx={{ fontSize: 13.5, color: '#475569' }}>
          <Trans i18nKey="support.formations.footer" components={{ strong: <strong /> }} />
        </Typography>
      </Box>
    </Box>
  );
};

export default FormationsPage;
