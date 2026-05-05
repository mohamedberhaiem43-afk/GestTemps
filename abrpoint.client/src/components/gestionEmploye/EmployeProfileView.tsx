import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box, Typography, Avatar, Button, Chip, CircularProgress, Alert,
  Divider, Tooltip, IconButton,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import BadgeIcon from '@mui/icons-material/Badge';
import CakeIcon from '@mui/icons-material/Cake';
import WcIcon from '@mui/icons-material/Wc';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import WorkHistoryIcon from '@mui/icons-material/WorkHistory';
import GroupsIcon from '@mui/icons-material/Groups';
import ApartmentIcon from '@mui/icons-material/Apartment';
import BusinessCenterIcon from '@mui/icons-material/BusinessCenter';
import PaymentsIcon from '@mui/icons-material/Payments';
import SchoolIcon from '@mui/icons-material/School';
import VerifiedIcon from '@mui/icons-material/Verified';
import FlagIcon from '@mui/icons-material/Flag';
import HomeIcon from '@mui/icons-material/Home';
import PrintIcon from '@mui/icons-material/Print';
import dayjs from 'dayjs';
import apiInstance from '../API/apiInstance';
import { useAuth } from '../helper/AuthProvider';

// Fiche salarié style CV : page lecture seule qui synthétise toutes les
// informations clés du collaborateur dans une mise en page lisible. Remplace
// l'ancienne expérience où le clic sur l'œil ouvrait directement la page de
// modification (peu lisible, formulaire éditable). L'admin peut basculer en
// édition via le bouton "Modifier".

interface EmployeFull {
  empcod: string;
  emplib?: string | null;
  empmat?: string | null;
  empfonc?: string | null;
  empsexe?: string | null;
  empsitfam?: string | null;
  empnbp?: number | null;
  empdnais?: string | null;
  emplnais?: string | null;
  empcin?: string | null;
  empdcin?: string | null;
  empacin?: string | null;
  empadr?: string | null;
  emptel?: string | null;
  empmob?: string | null;
  empemail?: string | null;
  empemb?: string | null;
  empsort?: string | null;
  empcontrat?: string | null;
  empniv?: string | null;
  empreg?: string | null;
  natcod?: string | null;
  vilcod?: string | null;
  catcod?: string | null;
  sercod?: string | null;
  dircod?: string | null;
  poscod?: string | null;
  foncod?: string | null;
  quacod?: string | null;
  empresp?: string | null;
  empsbase?: string | null;
  empsbrut?: string | null;
  empsnet?: string | null;
  empcat?: string | null;
  caltype?: string | null;
  actif?: string | null;
}

const fmtDate = (d: any): string => {
  if (!d) return '—';
  const parsed = dayjs(d);
  return parsed.isValid() ? parsed.format('DD MMMM YYYY') : '—';
};

const computeSeniority = (hireDate: any, exitDate: any): string => {
  if (!hireDate) return '—';
  const start = dayjs(hireDate);
  if (!start.isValid()) return '—';
  const end = exitDate ? dayjs(exitDate) : dayjs();
  if (!end.isValid()) return '—';
  const years = end.diff(start, 'year');
  const months = end.diff(start.add(years, 'year'), 'month');
  if (years === 0 && months === 0) return 'Moins d\'1 mois';
  if (years === 0) return `${months} mois`;
  if (months === 0) return `${years} an${years > 1 ? 's' : ''}`;
  return `${years} an${years > 1 ? 's' : ''} et ${months} mois`;
};

const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) => (
  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, py: 1 }}>
    <Box sx={{ color: '#0040a1', mt: 0.25 }}>{icon}</Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography sx={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', letterSpacing: 0.5, textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 13, color: '#1e293b', fontWeight: 600, wordBreak: 'break-word' }}>
        {value || '—'}
      </Typography>
    </Box>
  </Box>
);

const SectionCard = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
  <Box
    sx={{
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: '14px',
      p: 2.5,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      animation: 'profileCardIn 0.45s ease-out both',
      '@keyframes profileCardIn': {
        '0%':   { opacity: 0, transform: 'translateY(10px)' },
        '100%': { opacity: 1, transform: 'translateY(0)' },
      },
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, pb: 1.5, borderBottom: '1px solid #f1f5f9' }}>
      <Box sx={{ color: '#0040a1' }}>{icon}</Box>
      <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#0040a1', letterSpacing: 0.3, textTransform: 'uppercase' }}>
        {title}
      </Typography>
    </Box>
    {children}
  </Box>
);

export default function EmployeProfileView() {
  const navigate = useNavigate();
  const { soccod, hasPermission } = useAuth();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const empcod = searchParams.get('id');

  const [emp, setEmp] = useState<EmployeFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canModify = hasPermission('Gestion Employés', 'modify');

  useEffect(() => {
    if (!empcod || !soccod) { setLoading(false); return; }
    setLoading(true);
    apiInstance.get(`/Employes/get-employe/${soccod}/${empcod}`)
      .then(res => { setEmp(res.data); setError(null); })
      .catch(() => setError(t('employe.loadError') as string))
      .finally(() => setLoading(false));
  }, [empcod, soccod, t]);

  const seniority = useMemo(() => computeSeniority(emp?.empemb, emp?.empsort), [emp?.empemb, emp?.empsort]);
  const initials = useMemo(() => {
    const name = emp?.emplib || '';
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p.charAt(0).toUpperCase()).join('') || '?';
  }, [emp?.emplib]);

  const isActive = (emp?.actif ?? '').toUpperCase() !== 'N' && !emp?.empsort;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress sx={{ color: '#0040a1' }} />
      </Box>
    );
  }

  if (error || !emp) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" action={
          <Button onClick={() => navigate('/dashboard/gestion-employe')}>Retour</Button>
        }>
          {error || 'Employé introuvable.'}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200, mx: 'auto' }}>
      {/* Toolbar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Tooltip title="Retour à la liste">
          <IconButton onClick={() => navigate('/dashboard/gestion-employe')} sx={{ color: '#64748b' }}>
            <ArrowBackIcon />
          </IconButton>
        </Tooltip>
        <Typography sx={{ flex: 1, fontSize: 14, fontWeight: 700, color: '#94a3b8', letterSpacing: 0.5, textTransform: 'uppercase' }}>
          Fiche collaborateur
        </Typography>
        <Tooltip title="Imprimer la fiche">
          <IconButton onClick={() => window.print()} sx={{ color: '#64748b' }}>
            <PrintIcon />
          </IconButton>
        </Tooltip>
        {canModify && (
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={() => navigate(`/dashboard/profil-employe?id=${empcod}&edit=true`)}
            sx={{
              textTransform: 'none', fontWeight: 700,
              background: 'linear-gradient(135deg, #0040a1 0%, #0056d2 100%)',
              boxShadow: '0 4px 12px rgba(0,64,161,0.25)',
              '&:hover': { background: 'linear-gradient(135deg, #003280 0%, #0040a1 100%)' },
            }}
          >
            Modifier
          </Button>
        )}
      </Box>

      {/* Hero card — bandeau gradient + avatar + nom + statut */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #0040a1 0%, #0056d2 60%, #1a6eff 100%)',
          borderRadius: '20px',
          p: { xs: 3, md: 4 },
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          flexWrap: 'wrap',
          mb: 3,
          boxShadow: '0 12px 32px rgba(0,64,161,0.20)',
          animation: 'profileHeroIn 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both',
          '@keyframes profileHeroIn': {
            '0%':   { opacity: 0, transform: 'translateY(-12px) scale(0.97)' },
            '100%': { opacity: 1, transform: 'translateY(0) scale(1)' },
          },
        }}
      >
        <Avatar
          sx={{
            width: 96, height: 96,
            background: 'rgba(255,255,255,0.18)',
            border: '4px solid rgba(255,255,255,0.4)',
            fontSize: 36, fontWeight: 800,
            boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
          }}
        >
          {initials}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 200 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, opacity: 0.85 }}>
            #{emp.empmat || emp.empcod}
          </Typography>
          <Typography sx={{ fontSize: { xs: 22, md: 28 }, fontWeight: 800, mt: 0.5, lineHeight: 1.2 }}>
            {emp.emplib || '—'}
          </Typography>
          <Typography sx={{ fontSize: 14, opacity: 0.92, mt: 0.5 }}>
            {emp.empfonc || 'Poste non défini'}
            {emp.dircod ? ` · ${emp.dircod}` : ''}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
            <Chip
              label={isActive ? '● Actif' : '● Sorti'}
              size="small"
              sx={{
                background: isActive ? 'rgba(74,222,128,0.25)' : 'rgba(252,165,165,0.25)',
                color: isActive ? '#86efac' : '#fca5a5',
                fontWeight: 800, fontSize: 11, letterSpacing: 0.3,
              }}
            />
            {emp.empcontrat && (
              <Chip
                label={emp.empcontrat}
                size="small"
                sx={{ background: 'rgba(255,255,255,0.18)', color: '#fff', fontWeight: 700, fontSize: 11 }}
              />
            )}
            {emp.empreg && (
              <Chip
                label={emp.empreg === 'M' ? 'Mensuel' : emp.empreg === 'H' ? 'Horaire' : emp.empreg}
                size="small"
                sx={{ background: 'rgba(255,255,255,0.18)', color: '#fff', fontWeight: 700, fontSize: 11 }}
              />
            )}
            <Chip
              icon={<WorkHistoryIcon sx={{ color: '#fff !important', fontSize: 14 }} />}
              label={`Ancienneté : ${seniority}`}
              size="small"
              sx={{ background: 'rgba(255,255,255,0.18)', color: '#fff', fontWeight: 700, fontSize: 11 }}
            />
          </Box>
        </Box>
      </Box>

      {/* Grid des sections */}
      <Box sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
        gap: 2,
      }}>
        {/* Coordonnées */}
        <SectionCard title="Coordonnées" icon={<EmailIcon fontSize="small" />}>
          <InfoRow icon={<EmailIcon fontSize="small" />} label="Email" value={emp.empemail || '—'} />
          <Divider sx={{ borderColor: '#f1f5f9' }} />
          <InfoRow icon={<PhoneIcon fontSize="small" />} label="Téléphone" value={emp.emptel || emp.empmob || '—'} />
          <Divider sx={{ borderColor: '#f1f5f9' }} />
          <InfoRow icon={<HomeIcon fontSize="small" />} label="Adresse" value={emp.empadr || '—'} />
        </SectionCard>

        {/* Identité */}
        <SectionCard title="Identité" icon={<BadgeIcon fontSize="small" />}>
          <InfoRow icon={<BadgeIcon fontSize="small" />} label="CIN" value={emp.empcin ? `${emp.empcin}${emp.empacin ? ` (${emp.empacin})` : ''}` : '—'} />
          <Divider sx={{ borderColor: '#f1f5f9' }} />
          <InfoRow icon={<CakeIcon fontSize="small" />} label="Date de naissance"
            value={`${fmtDate(emp.empdnais)}${emp.emplnais ? ` à ${emp.emplnais}` : ''}`} />
          <Divider sx={{ borderColor: '#f1f5f9' }} />
          <InfoRow icon={<WcIcon fontSize="small" />} label="Sexe / Situation"
            value={[emp.empsexe === 'M' ? 'Homme' : emp.empsexe === 'F' ? 'Femme' : null,
                    emp.empsitfam, emp.empnbp != null ? `${emp.empnbp} enfant(s)` : null]
                  .filter(Boolean).join(' · ') || '—'} />
          <Divider sx={{ borderColor: '#f1f5f9' }} />
          <InfoRow icon={<FlagIcon fontSize="small" />} label="Nationalité" value={emp.natcod || '—'} />
        </SectionCard>

        {/* Poste & affectation */}
        <SectionCard title="Poste & affectation" icon={<BusinessCenterIcon fontSize="small" />}>
          <InfoRow icon={<BusinessCenterIcon fontSize="small" />} label="Fonction" value={emp.empfonc || '—'} />
          <Divider sx={{ borderColor: '#f1f5f9' }} />
          <InfoRow icon={<ApartmentIcon fontSize="small" />} label="Direction / Service"
            value={[emp.dircod, emp.sercod].filter(Boolean).join(' · ') || '—'} />
          <Divider sx={{ borderColor: '#f1f5f9' }} />
          <InfoRow icon={<GroupsIcon fontSize="small" />} label="Manager" value={emp.empresp || '—'} />
          <Divider sx={{ borderColor: '#f1f5f9' }} />
          <InfoRow icon={<SchoolIcon fontSize="small" />} label="Catégorie / Niveau"
            value={[emp.catcod, emp.empniv].filter(Boolean).join(' · ') || '—'} />
          <Divider sx={{ borderColor: '#f1f5f9' }} />
          <InfoRow icon={<VerifiedIcon fontSize="small" />} label="Qualification" value={emp.quacod || '—'} />
        </SectionCard>

        {/* Carrière */}
        <SectionCard title="Carrière" icon={<CalendarTodayIcon fontSize="small" />}>
          <InfoRow icon={<CalendarTodayIcon fontSize="small" />} label="Date d'embauche" value={fmtDate(emp.empemb)} />
          <Divider sx={{ borderColor: '#f1f5f9' }} />
          <InfoRow icon={<WorkHistoryIcon fontSize="small" />} label="Ancienneté" value={seniority} />
          <Divider sx={{ borderColor: '#f1f5f9' }} />
          <InfoRow icon={<CalendarTodayIcon fontSize="small" />} label="Type de contrat" value={emp.empcontrat || '—'} />
          {emp.empsort && (
            <>
              <Divider sx={{ borderColor: '#f1f5f9' }} />
              <InfoRow icon={<CalendarTodayIcon fontSize="small" />} label="Date de sortie" value={fmtDate(emp.empsort)} />
            </>
          )}
        </SectionCard>

        {/* Rémunération — visible uniquement si l'utilisateur a le droit modify
            (les admins/RH), pour ne pas exposer le salaire à un manager simple
            qui n'a que la consultation. */}
        {canModify && (emp.empsbase || emp.empsbrut || emp.empsnet) && (
          <SectionCard title="Rémunération" icon={<PaymentsIcon fontSize="small" />}>
            <InfoRow icon={<PaymentsIcon fontSize="small" />} label="Salaire de base" value={emp.empsbase || '—'} />
            <Divider sx={{ borderColor: '#f1f5f9' }} />
            <InfoRow icon={<PaymentsIcon fontSize="small" />} label="Salaire brut" value={emp.empsbrut || '—'} />
            <Divider sx={{ borderColor: '#f1f5f9' }} />
            <InfoRow icon={<PaymentsIcon fontSize="small" />} label="Salaire net" value={emp.empsnet || '—'} />
          </SectionCard>
        )}

        {/* Lieu de travail */}
        <SectionCard title="Lieu de travail" icon={<LocationOnIcon fontSize="small" />}>
          <InfoRow icon={<LocationOnIcon fontSize="small" />} label="Ville" value={emp.vilcod || '—'} />
          <Divider sx={{ borderColor: '#f1f5f9' }} />
          <InfoRow icon={<ApartmentIcon fontSize="small" />} label="Poste de travail" value={emp.poscod || '—'} />
          <Divider sx={{ borderColor: '#f1f5f9' }} />
          <InfoRow icon={<CalendarTodayIcon fontSize="small" />} label="Calendrier" value={emp.caltype || '—'} />
        </SectionCard>
      </Box>
    </Box>
  );
}
