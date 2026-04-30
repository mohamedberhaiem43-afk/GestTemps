import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Divider } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import AddBusinessIcon from '@mui/icons-material/AddBusiness';
import VerifiedIcon from '@mui/icons-material/Verified';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const useCases = [
  {
    icon: <PlayArrowIcon sx={{ color: '#ea580c' }} />,
    title: 'Démarrage sur Concorde-work-force',
    body: "Simplifiez l'importation des données de votre ancien outil (entreprises, employés, etc.) et assurez une transition fluide.",
  },
  {
    icon: <AddBusinessIcon sx={{ color: '#ea580c' }} />,
    title: "Ouverture d'une nouvelle filiale",
    body: "Configurez rapidement et efficacement votre nouvel espace Concorde-work-force.",
  },
  {
    icon: <VerifiedIcon sx={{ color: '#ea580c' }} />,
    title: "Besoin d'une configuration experte",
    body: "Bénéficiez de notre savoir-faire pour optimiser votre compte dès le départ.",
  },
];

const includes = [
  "Importation de vos données existantes (sociétés, filiales, employés, contrats, soldes de congés)",
  "Paramétrage du calendrier (jours fériés, repos hebdomadaires, conventions collectives)",
  "Configuration des règles de pointage, classes horaires et postes de travail",
  "Création des comptes utilisateurs et attribution des droits d'accès (RBAC)",
  "Mise en place des règles de calcul des heures supplémentaires et absences",
  "Connexion des badgeuses / pointeuses biométriques existantes",
  "Personnalisation des modèles de documents (contrats, attestations, certificats)",
  "Test de bout en bout sur un échantillon avant la mise en production",
  "Formation initiale des administrateurs (1 session de 2h)",
];

const PackMiseEnPlacePage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <Box sx={{ p: { xs: 3, md: 5 }, maxWidth: 1080, mx: 'auto' }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/dashboard/support')} sx={{ mb: 2, color: '#475569', textTransform: 'none', fontWeight: 600 }}>
        Retour au centre d'assistance
      </Button>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
        <Box sx={{ width: 56, height: 56, borderRadius: 2, bgcolor: '#ea580c15', color: '#ea580c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <RocketLaunchIcon sx={{ fontSize: 32 }} />
        </Box>
        <Typography sx={{ fontSize: 28, fontWeight: 800, color: '#191c1e' }}>Pack de Mise en Place</Typography>
      </Box>
      <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#ea580c', mb: 2 }}>
        Gagnez un temps précieux et assurez un démarrage optimal sur Concorde-work-force
      </Typography>
      <Typography sx={{ fontSize: 14, color: '#475569', mb: 1.5, lineHeight: 1.7 }}>
        Vous êtes un nouvel utilisateur de Concorde-work-force et vous souhaitez intégrer vos données existantes sans tracas ?
        Vous ouvrez une nouvelle filiale et avez besoin d'une configuration rapide et efficace ?
      </Typography>
      <Typography sx={{ fontSize: 14, color: '#475569', mb: 4, lineHeight: 1.7, fontWeight: 600 }}>
        Notre « Pack de Mise en Place » est la solution idéale pour vous !
      </Typography>

      {/* Qu'est-ce que ? */}
      <Box sx={{ p: { xs: 3, md: 4 }, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#fff', mb: 3 }}>
        <Typography sx={{ fontSize: 18, fontWeight: 700, mb: 2, color: '#191c1e' }}>
          Qu'est-ce que le Pack de Mise en Place Concorde-work-force ?
        </Typography>
        <Typography sx={{ fontSize: 14, color: '#475569', lineHeight: 1.7 }}>
          Notre équipe de spécialistes Concorde-work-force prend en charge la configuration initiale de votre compte,
          vous permettant de vous concentrer pleinement sur votre cœur de métier. Nous vous accompagnons pas à pas
          pour paramétrer votre environnement Concorde-work-force selon vos besoins spécifiques.
        </Typography>
      </Box>

      {/* Quand faire appel ? */}
      <Box sx={{ p: { xs: 3, md: 4 }, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#fff', mb: 3 }}>
        <Typography sx={{ fontSize: 18, fontWeight: 700, mb: 3, color: '#191c1e' }}>
          Quand faire appel à notre Pack de Mise en Place ?
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {useCases.map((u, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
              <Box sx={{ flexShrink: 0, width: 40, height: 40, borderRadius: 2, bgcolor: '#ea580c15', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {u.icon}
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 14.5, color: '#191c1e', mb: 0.5 }}>{u.title}</Typography>
                <Typography sx={{ fontSize: 13.5, color: '#475569', lineHeight: 1.6 }}>{u.body}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Ce que comprend le pack */}
      <Box sx={{ p: { xs: 3, md: 4 }, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#fff', mb: 3 }}>
        <Typography sx={{ fontSize: 18, fontWeight: 700, mb: 1, color: '#191c1e' }}>
          Ce que notre Pack de Mise en Place peut comprendre
        </Typography>
        <Typography sx={{ fontSize: 12.5, color: '#64748b', mb: 3, fontStyle: 'italic' }}>
          Sur-mesure selon votre devis — nous adaptons le périmètre à votre contexte.
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {includes.map((item, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
              <CheckCircleIcon sx={{ color: '#ea580c', fontSize: 22, flexShrink: 0, mt: 0.1 }} />
              <Typography sx={{ fontSize: 13.5, color: '#334155', lineHeight: 1.6 }}>{item}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Tarification */}
      <Box sx={{ p: 4, borderRadius: 3, bgcolor: '#fff7ed', border: '1px solid #fdba74', mb: 3 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 700, mb: 1, color: '#9a3412' }}>Tarification indicative</Typography>
        <Typography sx={{ fontSize: 14, color: '#7c2d12', mb: 2.5, lineHeight: 1.7 }}>
          Le pack est tarifé sur devis en fonction du périmètre :
          <br />• Petite équipe (≤ 30 collaborateurs) : <strong>1 800 € HT</strong>
          <br />• Moyenne équipe (≤ 200 collaborateurs) : <strong>4 500 € HT</strong>
          <br />• Grande organisation : <strong>sur devis</strong>
        </Typography>
        <Button variant="contained" onClick={() => navigate('/dashboard/support/contact')} sx={{ bgcolor: '#ea580c', textTransform: 'none', fontWeight: 700, '&:hover': { bgcolor: '#c2410c' } }}>
          Demander un devis
        </Button>
      </Box>

      <Divider sx={{ my: 3 }} />
      <Box sx={{ textAlign: 'center', py: 2 }}>
        <Typography sx={{ fontSize: 18, fontWeight: 800, color: '#191c1e', mb: 1.5 }}>
          Prêt à démarrer rapidement sur Concorde-work-force ?
        </Typography>
        <Typography sx={{ fontSize: 13.5, color: '#475569', mb: 2.5, lineHeight: 1.7 }}>
          Confiez-nous votre paramétrage initial et concentrez-vous sur l'essentiel : votre activité.
        </Typography>
        <Button variant="contained" size="large" onClick={() => navigate('/dashboard/support/contact')} sx={{ bgcolor: '#ea580c', textTransform: 'none', fontWeight: 700, px: 5, py: 1.5, '&:hover': { bgcolor: '#c2410c' } }}>
          Nous contacter
        </Button>
      </Box>
    </Box>
  );
};

export default PackMiseEnPlacePage;
