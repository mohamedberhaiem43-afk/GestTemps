import React from 'react';
import { Box, Breadcrumbs, Link, Typography } from '@mui/material';
import { useLocation } from 'react-router-dom';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import HomeIcon from '@mui/icons-material/Home';
import { useTranslation } from 'react-i18next';

interface BreadcrumbNavigationProps {
  customTitle?: string;
}

const BreadcrumbNavigation: React.FC<BreadcrumbNavigationProps> = ({ customTitle }) => {
  const location = useLocation();
  const { t } = useTranslation();

  // Fonction pour générer le breadcrumb basé sur le chemin actuel
  const generateBreadcrumbs = () => {
    const pathnames = location.pathname.split('/').filter((x) => x);

    // Mapping des segments de chemin vers des clés de traduction
    const pathKeyMap: { [key: string]: string } = {
      'dashboard': 'navigation.dashboard',
      'param-societe': 'navigation.companyParameter',
      'societe': 'navigation.society',
      'profile': 'navigation.profile',
      'calendrier-societe': 'navigation.companyCalendar',
      'gestion-societe': 'navigation.companySettings',
      'gestion-utilisateur': 'navigation.users',
      'droit-accees': 'navigation.accessRights',
      'direction': 'navigation.direction',
      'service': 'navigation.service',
      'ville': 'navigation.city',
      'filiale': 'navigation.branch',
      'pays': 'navigation.country',
      'fonction': 'navigation.function',
      'rubrique': 'navigation.rubric',
      'section': 'navigation.section',
      'gestion-employe': 'navigation.employeeManagement',
      'saisie-classe-horaire': 'navigation.timeClass',
      'saisie-poste-de-travail': 'navigation.workStation',
      'intitule-des-absences': 'navigation.absenceTypes',
      'Repos': 'navigation.publicHolidays',
      'accompte-salaire': 'navigation.salaryAdvance',
      'pointage-du-mois': 'navigation.monthlyClocking',
      'droit-de-conge': 'navigation.leaveRights',
      'etat-de-presence': 'navigation.attendanceReport',
      'etat-de-retard': 'navigation.lateReport',
      'etat-des-absences': 'navigation.absenceReport',
      'echeance-contrat': 'navigation.contractExpiry',
      'cahier-conge': 'navigation.leaveBook',
      'lecture-pointeuse': 'navigation.clockingReading',
      'liste-pointeuse': 'navigation.clockingList',
      'optimisation-pointage': 'navigation.clockingOptimization',
      'etat-periodique': 'navigation.periodicReport',
      'allaitement': 'navigation.breastfeeding',
      'contrat': 'navigation.contract',
      'gestion-de-conge': 'navigation.leaveRequest',
      'gestion-de-solde': 'navigation.leaveBalance',
      'titre-de-conge': 'navigation.leaveTitle',
      'titre-de-conge-general': 'navigation.generalLeave',
      'jour-de-compensation': 'navigation.compensationDay',
      'autorisation-de-sortie': 'navigation.exitAuthorization',
      'autorisation-de-sortie-generale': 'navigation.generalExit',
      'absence-et-sanction': 'navigation.absenceAndSanction',
    };

    return pathnames.map((name, index) => {
      const to = `/${pathnames.slice(0, index + 1).join('/')}`;
      const isLast = index === pathnames.length - 1;
      const fallback = name.charAt(0).toUpperCase() + name.slice(1).replace('-', ' ');
      const translated = pathKeyMap[name] ? t(pathKeyMap[name], { defaultValue: fallback }) : t(`breadcrumb.${name}`, { defaultValue: fallback });
      const displayName = customTitle || translated;

      return isLast ? (
        <Typography key={to} color="text.primary" variant="subtitle1" fontWeight="bold">
          {displayName}
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