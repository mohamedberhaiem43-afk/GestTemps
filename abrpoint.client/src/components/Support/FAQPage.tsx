import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Accordion, AccordionSummary, AccordionDetails, Button } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

const faqs = [
  { q: 'Comment ajouter un nouvel employé ?', a: 'Allez dans Gestion → Employés → Nouvel employé. Le code est généré automatiquement selon le paramètre Parmodemp configuré dans la société.' },
  { q: "Comment paramétrer le calcul des heures supplémentaires ?", a: 'Dans Données de base → Société, le champ « Heures / Mois » fixe le standard légal. Les seuils par catégorie (cadre, maîtrise, exécution) se règlent dans Paramètres avancés.' },
  { q: "Pourquoi un employé ne peut-il pas se connecter après création ?", a: "Vérifiez que l'email de l'employé est bien renseigné. L'index TenantEmailIndex est mis à jour automatiquement à la création." },
  { q: 'Comment importer des employés via Excel ?', a: 'Sur la liste des employés, utilisez le bouton « Import Excel » en haut à droite. Le fichier modèle accepte les colonnes Code, Nom, Prénom, Email, Fonction, Régime, etc.' },
  { q: 'Que se passe-t-il avec les congés non pris au 31 mai ?', a: "Les congés payés non pris à cette date sont automatiquement transférés vers le Compte Épargne Temps (CET), dans la limite de 10 jours par défaut. Date et plafond sont paramétrables dans Société → Paramètres." },
  { q: 'Comment exporter mon abonnement ?', a: "Vos factures Stripe sont accessibles depuis Mon profil → Facturation. Vous pouvez aussi modifier votre plan à tout moment via /dashboard/plan-configuration." },
  { q: 'Comment générer un contrat pour un employé ?', a: "Allez dans Coffre-fort → Bibliothèque de modèles, sélectionnez un modèle, cliquez sur « Exporter pour un employé » et choisissez l'employé cible." },
];

const FAQPage: React.FC = () => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<number | false>(0);
  return (
    <Box sx={{ p: { xs: 3, md: 5 }, maxWidth: 980, mx: 'auto' }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/dashboard/support')} sx={{ mb: 2, color: '#475569', textTransform: 'none', fontWeight: 600 }}>
        Retour au centre d'assistance
      </Button>
      <Typography sx={{ fontSize: 28, fontWeight: 800, color: '#191c1e', mb: 1 }}>FAQ</Typography>
      <Typography sx={{ fontSize: 14, color: '#475569', mb: 4 }}>
        Réponses aux questions fréquentes. Si la vôtre n'y figure pas, contactez-nous.
      </Typography>
      <Box sx={{ borderRadius: 3, overflow: 'hidden', border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
        {faqs.map((f, i) => (
          <Accordion
            key={i}
            expanded={expanded === i}
            onChange={(_, isOpen) => setExpanded(isOpen ? i : false)}
            disableGutters
            elevation={0}
            sx={{ borderBottom: i === faqs.length - 1 ? 'none' : '1px solid #e2e8f0', '&:before': { display: 'none' } }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 3, py: 1.5 }}>
              <Typography sx={{ fontWeight: 600, fontSize: 14, color: '#191c1e' }}>{f.q}</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 3, pb: 3, color: '#475569', fontSize: 13.5, lineHeight: 1.7 }}>{f.a}</AccordionDetails>
          </Accordion>
        ))}
      </Box>
    </Box>
  );
};

export default FAQPage;
