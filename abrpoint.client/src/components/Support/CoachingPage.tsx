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

const reasons = [
  {
    icon: <TuneIcon sx={{ color: '#0891b2' }} />,
    title: 'Un accompagnement 100% adapté à votre réalité',
    body: "Nous prenons en compte votre domaine d'activité, la typologie de votre entreprise et vos défis spécifiques pour vous offrir un coaching pertinent et actionnable.",
  },
  {
    icon: <LightbulbIcon sx={{ color: '#0891b2' }} />,
    title: 'Résolvez vos problématiques concrètes',
    body: "Vous rencontrez un blocage sur une fonctionnalité ? Vous souhaitez mettre en place un flux de travail particulier ? Nos experts vous guident pas à pas vers la solution.",
  },
  {
    icon: <KeyIcon sx={{ color: '#0891b2' }} />,
    title: 'Maîtrisez les fonctionnalités clés qui vous importent',
    body: "Concentrez-vous sur les aspects du logiciel qui ont un impact direct sur votre quotidien et gagnez en efficacité.",
  },
  {
    icon: <TrendingUpIcon sx={{ color: '#0891b2' }} />,
    title: 'Un investissement rentable pour votre performance',
    body: "En optimisant votre utilisation de Concorde-work-force, vous gagnez du temps, réduisez les erreurs et améliorez votre productivité globale.",
  },
  {
    icon: <EventNoteIcon sx={{ color: '#0891b2' }} />,
    title: 'Préparation en amont pour une efficacité maximale',
    body: "En nous exposant votre problématique et/ou les fonctionnalités que vous souhaitez explorer, notre expert préparera un accompagnement ciblé et performant.",
  },
];

const steps = [
  {
    n: 1,
    title: 'Exprimez vos besoins',
    body: "Lors de votre commande, vous aurez la possibilité de détailler votre problématique et/ou les fonctionnalités de Concorde-work-force sur lesquelles vous souhaitez être accompagné.",
  },
  {
    n: 2,
    title: 'Préparation personnalisée',
    body: "Notre expert Concorde-work-force analysera vos besoins afin de préparer au mieux la séance de coaching.",
  },
  {
    n: 3,
    title: 'Coaching individuel et interactif',
    body: "Bénéficiez d'une heure d'accompagnement en direct, où vous pourrez poser vos questions, partager votre écran et mettre en pratique les conseils de notre expert.",
  },
  {
    n: 4,
    title: 'Gagnez en autonomie',
    body: "Notre objectif est de vous rendre autonome et confiant dans votre utilisation de Concorde-work-force.",
  },
];

const CoachingPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <Box sx={{ p: { xs: 3, md: 5 }, maxWidth: 1080, mx: 'auto' }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/dashboard/support')} sx={{ mb: 2, color: '#475569', textTransform: 'none', fontWeight: 600 }}>
        Retour au centre d'assistance
      </Button>

      <Typography sx={{ fontSize: 28, fontWeight: 800, color: '#191c1e', mb: 1 }}>Coaching sur mesure</Typography>
      <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#0891b2', mb: 2 }}>
        Développez votre maîtrise de Concorde-work-force
      </Typography>
      <Typography sx={{ fontSize: 14, color: '#475569', mb: 1.5, lineHeight: 1.7 }}>
        Vous utilisez Concorde-work-force et souhaitez exploiter tout son potentiel pour optimiser la gestion de votre entreprise ?
      </Typography>
      <Typography sx={{ fontSize: 14, color: '#475569', mb: 4, lineHeight: 1.7 }}>
        Que vous soyez un nouvel utilisateur désireux de prendre en main les fonctionnalités clés, ou un utilisateur expérimenté souhaitant affiner vos processus spécifiques, nos heures de coaching personnalisées sont conçues pour répondre précisément à vos besoins.
      </Typography>

      {/* Pourquoi opter ? */}
      <Box sx={{ p: { xs: 3, md: 4 }, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#fff', mb: 3 }}>
        <Typography sx={{ fontSize: 18, fontWeight: 700, mb: 3, color: '#191c1e' }}>
          Pourquoi opter pour un coaching Concorde-work-force sur mesure ?
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {reasons.map((r, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
              <Box sx={{ flexShrink: 0, width: 40, height: 40, borderRadius: 2, bgcolor: '#0891b215', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {r.icon}
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 14.5, color: '#191c1e', mb: 0.5 }}>{r.title}</Typography>
                <Typography sx={{ fontSize: 13.5, color: '#475569', lineHeight: 1.6 }}>{r.body}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Comment ça marche ? */}
      <Box sx={{ p: { xs: 3, md: 4 }, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#fff', mb: 3 }}>
        <Typography sx={{ fontSize: 18, fontWeight: 700, mb: 3, color: '#191c1e' }}>Comment ça marche ?</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {steps.map((s) => (
            <Box key={s.n} sx={{ display: 'flex', alignItems: 'flex-start', gap: 2.5 }}>
              <Box sx={{ flexShrink: 0, width: 36, height: 36, borderRadius: '999px', bgcolor: '#0891b2', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14 }}>
                {s.n}
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 14.5, color: '#191c1e', mb: 0.5 }}>{s.title}</Typography>
                <Typography sx={{ fontSize: 13.5, color: '#475569', lineHeight: 1.6 }}>{s.body}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Tarif */}
      <Box sx={{ p: 4, borderRadius: 3, color: '#fff', mb: 3, background: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)' }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, opacity: 0.85, textTransform: 'uppercase', letterSpacing: 1.5, mb: 1 }}>Tarif</Typography>
        <Typography sx={{ fontSize: 32, fontWeight: 900, lineHeight: 1 }}>180 € HT <span style={{ fontSize: 16, opacity: 0.85, fontWeight: 600 }}>/ heure</span></Typography>
        <Typography sx={{ fontSize: 13.5, opacity: 0.92, mt: 1.5, mb: 3, lineHeight: 1.6 }}>
          Un investissement sur mesure pour une maîtrise optimale de votre outil de gestion.
        </Typography>
        <Button variant="contained" onClick={() => navigate('/dashboard/support/contact')} sx={{ bgcolor: '#fff', color: '#0e7490', textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: '#f1f5f9' } }}>
          Réserver une session
        </Button>
      </Box>

      {/* Information importante */}
      <Box sx={{ p: 3, borderRadius: 3, bgcolor: '#fef3c7', border: '1px solid #fcd34d', display: 'flex', gap: 2, alignItems: 'flex-start', mb: 3 }}>
        <InfoOutlinedIcon sx={{ color: '#92400e', flexShrink: 0, mt: 0.2 }} />
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 13.5, color: '#78350f', mb: 0.5 }}>Information importante concernant le financement</Typography>
          <Typography sx={{ fontSize: 13, color: '#92400e', lineHeight: 1.6 }}>
            Cette prestation de coaching personnalisé n'est pas éligible à un financement par les fonds publics dédiés à la formation professionnelle.
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ my: 3 }} />
      <Box sx={{ textAlign: 'center', py: 2 }}>
        <Typography sx={{ fontSize: 18, fontWeight: 800, color: '#191c1e', mb: 1.5 }}>
          Prêt à optimiser votre utilisation de Concorde-work-force ?
        </Typography>
        <Typography sx={{ fontSize: 13.5, color: '#475569', mb: 2.5, lineHeight: 1.7 }}>
          N'attendez plus pour bénéficier d'un accompagnement personnalisé qui vous fera gagner en temps et en efficacité.
        </Typography>
        <Button variant="contained" size="large" onClick={() => navigate('/dashboard/support/contact')} sx={{ bgcolor: '#0891b2', textTransform: 'none', fontWeight: 700, px: 5, py: 1.5, '&:hover': { bgcolor: '#0e7490' } }}>
          Nous contacter
        </Button>
      </Box>
    </Box>
  );
};

export default CoachingPage;
