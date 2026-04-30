import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Card, CardActionArea, CardContent } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import SchoolIcon from '@mui/icons-material/School';
import PsychologyIcon from '@mui/icons-material/Psychology';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import EmailIcon from '@mui/icons-material/Email';

const cards = [
  {
    title: 'FAQ',
    desc: 'Réponses aux questions les plus fréquentes sur la plateforme Concorde Workforce.',
    icon: <HelpOutlineIcon sx={{ fontSize: 36 }} />,
    href: '/dashboard/support/faq',
    color: '#0040a1',
  },
  {
    title: 'Formations au logiciel',
    desc: 'Sessions de formation en ligne ou présentielles pour maîtriser chaque module.',
    icon: <SchoolIcon sx={{ fontSize: 36 }} />,
    href: '/dashboard/support/formations',
    color: '#7c3aed',
  },
  {
    title: 'Coaching sur mesure',
    desc: "Accompagnement personnalisé d'un expert RH dédié à votre organisation.",
    icon: <PsychologyIcon sx={{ fontSize: 36 }} />,
    href: '/dashboard/support/coaching',
    color: '#0891b2',
  },
  {
    title: 'Pack de mise en place',
    desc: 'Déploiement clés en main : paramétrage, import des données, formation des équipes.',
    icon: <RocketLaunchIcon sx={{ fontSize: 36 }} />,
    href: '/dashboard/support/pack-mise-en-place',
    color: '#ea580c',
  },
  {
    title: 'Contactez-nous',
    desc: 'Notre équipe support répond à vos demandes par email, téléphone ou chat.',
    icon: <EmailIcon sx={{ fontSize: 36 }} />,
    href: '/dashboard/support/contact',
    color: '#16a34a',
  },
];

const SupportPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <Box sx={{ p: { xs: 3, md: 5 }, maxWidth: 1280, mx: 'auto' }}>
      <Box sx={{ mb: 5 }}>
        <Typography sx={{ fontSize: 28, fontWeight: 800, color: '#191c1e', letterSpacing: '-0.02em' }}>
          Centre d'assistance
        </Typography>
        <Typography sx={{ fontSize: 14, color: '#424654', mt: 1 }}>
          Choisissez le type d'accompagnement qui correspond à votre besoin.
        </Typography>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, gap: 3 }}>
        {cards.map((c) => (
          <Card key={c.href} sx={{ borderRadius: 3, boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}>
            <CardActionArea onClick={() => navigate(c.href)} sx={{ p: 0, height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ width: 56, height: 56, borderRadius: 2, bgcolor: `${c.color}15`, color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                  {c.icon}
                </Box>
                <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#191c1e', mb: 0.5 }}>{c.title}</Typography>
                <Typography sx={{ fontSize: 13, color: '#475569', lineHeight: 1.55 }}>{c.desc}</Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Box>
    </Box>
  );
};

export default SupportPage;
