import React from 'react';
import { Box, Breadcrumbs, Link, Typography } from '@mui/material';
import { useLocation } from 'react-router-dom';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import HomeIcon from '@mui/icons-material/Home';

interface BreadcrumbNavigationProps {
  customTitle?: string;
}

const BreadcrumbNavigation: React.FC<BreadcrumbNavigationProps> = ({ customTitle }) => {
  const location = useLocation();

  // Fonction pour générer le breadcrumb basé sur le chemin actuel
  const generateBreadcrumbs = () => {
    const pathnames = location.pathname.split('/').filter((x) => x);

    // Mapping des segments de chemin vers des noms lisibles
    const pathNameMap: { [key: string]: string } = {
      'dashboard': 'Dashboard',
      'param-societe': 'Paramètres Société',
      'societe': 'Société',
      'profile': 'Profile',
      'calendrier-societe': 'Calendrier',
      'gestion-societe': 'Gestion Société',
      'gestion-utilisateur': 'Utilisateurs',
      'droit-accees': 'Droits d\'accès',
      'direction': 'Direction',
      'service': 'Service',
      'ville': 'Ville',
      'filiale': 'Filiale',
      'pays': 'Pays',
      'fonction': 'Fonction',
      'rubrique': 'Rubrique',
      'section': 'Section',
      'gestion-employe': 'Gestion Employés',
      'saisie-classe-horaire': 'Classe Horaire',
      'saisie-poste-de-travail': 'Poste de Travail',
      'intitule-des-absences': 'Natures d\'absences',
      'Repos': 'Jours Fériés et Repos',
      'accompte-salaire': 'Accompte Salaire',
      'pointage-du-mois': 'Pointage du Mois',
      'droit-de-conge': 'Droit de Congé',
      'etat-de-presence': 'État de Présence',
      'etat-de-retard': 'État de Retard',
      'etat-des-absences': 'État des Absences',
      'echeance-contrat': 'Échéance Contrat',
      'cahier-conge': 'Cahier de Congé',
      'lecture-pointeuse': 'Lecture Pointeuse',
      'liste-pointeuse': 'Liste Pointeuse',
      'optimisation-pointage': 'Optimisation Pointage',
      'etat-periodique': 'État Périodique',
      'allaitement': 'Allaitement',
      'contrat': 'Contrat',
      'renouvellement-contrat': 'Renouvellement',
      'gestion-de-conge': 'Demande de Congé',
      'gestion-de-solde': 'Solde de Congé',
      'titre-de-conge': 'Titre de Congé',
      'titre-de-conge-general': 'Conge Général',
      'jour-de-compensation': 'Jour Compensation',
      'autorisation-de-sortie': 'Autorisation Sortie',
      'autorisation-de-sortie-generale': 'Sortie Générale',
      'absence-et-sanction': 'Absence et Sanction',
    };

    return pathnames.map((name, index) => {
      const to = `/${pathnames.slice(0, index + 1).join('/')}`;
      const isLast = index === pathnames.length - 1;
      const displayName = pathNameMap[name] || name.charAt(0).toUpperCase() + name.slice(1).replace('-', ' ');

      return isLast ? (
        <Typography key={to} color="text.primary" variant="subtitle1" fontWeight="bold">
          {customTitle || displayName}
        </Typography>
      ) : (
        <Link key={to} color="inherit" href={to} sx={{ textDecoration: 'none' }}>
          {displayName}
        </Link>
      );
    });
  };

  return (
    <Box sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
      <Breadcrumbs
        separator={<NavigateNextIcon fontSize='small' />}
        aria-label="breadcrumb"
        sx={{ mb: 1 }}
      >
        <Link
          color="inherit"
          href="/dashboard"
          sx={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
          Dashboard
        </Link>
        {generateBreadcrumbs()}
      </Breadcrumbs>
    </Box>
  );
};

export default BreadcrumbNavigation;