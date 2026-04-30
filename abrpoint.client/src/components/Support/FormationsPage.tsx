import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Chip } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import VideocamIcon from '@mui/icons-material/Videocam';
import GroupsIcon from '@mui/icons-material/Groups';
import SchoolIcon from '@mui/icons-material/School';

const sessions = [
  {
    title: 'Prise en main de la plateforme',
    duration: '2h',
    mode: 'Visio',
    icon: <VideocamIcon />,
    desc: "Tour d'horizon complet : navigation, modules clés, premiers gestes administrateur.",
    audience: 'Tous publics',
  },
  {
    title: 'Configuration paie & exports comptables',
    duration: '3h',
    mode: 'Visio',
    icon: <VideocamIcon />,
    desc: 'Paramétrage des règles de calcul, génération du livre de paie, export DSN/SIG.',
    audience: 'RH / DAF',
  },
  {
    title: 'Atelier badgeuses & pointeuses',
    duration: '4h',
    mode: 'Présentiel',
    icon: <GroupsIcon />,
    desc: 'Installation, synchronisation des terminaux ZK / Suprema, troubleshooting réseau.',
    audience: 'IT / Ops',
  },
  {
    title: 'Module Congés & autorisations',
    duration: '2h',
    mode: 'Visio',
    icon: <VideocamIcon />,
    desc: 'Workflows de validation, soldes, jours fériés, transfert CET, autorisations de sortie.',
    audience: 'Managers',
  },
];

const FormationsPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <Box sx={{ p: { xs: 3, md: 5 }, maxWidth: 1100, mx: 'auto' }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/dashboard/support')} sx={{ mb: 2, color: '#475569', textTransform: 'none', fontWeight: 600 }}>
        Retour au centre d'assistance
      </Button>
      <Typography sx={{ fontSize: 28, fontWeight: 800, color: '#191c1e', mb: 1 }}>Formations au logiciel</Typography>
      <Typography sx={{ fontSize: 14, color: '#475569', mb: 4 }}>
        Sessions animées par nos formateurs experts — incluses dans les plans Standard et Premium.
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 3 }}>
        {sessions.map((s, i) => (
          <Box key={i} sx={{ p: 3, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#fff', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: '#7c3aed15', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {s.icon}
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#191c1e' }}>{s.title}</Typography>
                <Typography sx={{ fontSize: 12, color: '#64748b' }}>{s.audience}</Typography>
              </Box>
            </Box>
            <Typography sx={{ fontSize: 13.5, color: '#475569', lineHeight: 1.6 }}>{s.desc}</Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Chip size="small" label={s.duration} sx={{ bgcolor: '#f1f5f9', fontWeight: 600 }} />
              <Chip size="small" label={s.mode} sx={{ bgcolor: '#7c3aed15', color: '#7c3aed', fontWeight: 600 }} />
            </Box>
          </Box>
        ))}
      </Box>
      <Box sx={{ mt: 4, p: 3, borderRadius: 3, bgcolor: '#7c3aed10', display: 'flex', alignItems: 'center', gap: 2 }}>
        <SchoolIcon sx={{ color: '#7c3aed' }} />
        <Typography sx={{ fontSize: 13.5, color: '#475569' }}>
          Pour réserver une session, contactez votre Account Manager ou écrivez à <strong>formations@concorde-tech.fr</strong>.
        </Typography>
      </Box>
    </Box>
  );
};

export default FormationsPage;
