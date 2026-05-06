import * as React from 'react';
import { Box, Typography, Chip, Paper, FormControlLabel, Checkbox, MenuItem, Select } from '@mui/material';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import apiInstance from '../../API/apiInstance';
import { useAuth } from '../../helper/AuthProvider';

/**
 * TeamCalendarPage — vue calendrier mensuelle des absences/congés/missions
 * de l'équipe.
 *
 * Pourquoi cette page : avant, un manager voulant savoir « qui sera absent
 * la semaine du 15 ? » devait croiser plusieurs listes (DemConge,
 * DemandeAutorisation, Mission). FullCalendar affiche tout sur un seul
 * écran, avec barres horizontales colorées par type — c'est le format
 * dont les RH/managers ont l'habitude (Outlook, Google Calendar, Notion).
 *
 * Données :
 *   • Congés acceptés via `/DemConges/by-soc/{soccod}` (statut accepté)
 *   • Missions approuvées via `/Missions/by-soc/{soccod}`
 *   • Demandes d'autorisation acceptées via `/DemandeAutorisations/by-soc/{soccod}`
 * Tout est chargé en parallèle ; les filtres clients (par type, par employé)
 * se font sans round-trip.
 */

interface CongeRow {
  concod: string;
  empcod: string;
  emplib?: string;
  abscod?: string;
  condep?: string;
  conret?: string;
  etat?: string;
  conrefus?: string;
}
interface MissionRow {
  misCod: string;
  empcod: string;
  emplib?: string;
  misObjet?: string;
  misDateDebut?: string;
  misDateFin?: string;
  misEtat?: string;
}
interface AutoRow {
  id: string;
  empcod: string;
  emplib?: string;
  motif?: string;
  condep?: string;
  conret?: string;
  etat?: string;
}

type FilterKey = 'conges' | 'missions' | 'autorisations';

const COLORS: Record<FilterKey, { bg: string; text: string; border: string; label: string }> = {
  conges:        { bg: '#dbeafe', text: '#1e40af', border: '#60a5fa', label: 'Congés' },
  missions:      { bg: '#fce7f3', text: '#9d174d', border: '#f472b6', label: 'Missions' },
  autorisations: { bg: '#fef3c7', text: '#92400e', border: '#fbbf24', label: 'Autorisations' },
};

// Convertit YYYY-MM-DD ou Date ISO vers Date plain (00:00 local). Sans ça,
// FullCalendar interprète parfois la string comme UTC et l'évènement « saute »
// d'un jour selon la timezone.
const toLocalDate = (s?: string | null): Date | null => {
  if (!s) return null;
  const d = typeof s === 'string' ? new Date(s.length > 10 ? s : `${s}T00:00:00`) : new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

const isAccepted = (etat?: string, refus?: string) => {
  if (refus === '1') return false;
  const e = (etat || '').toLowerCase();
  return e.includes('accept') || e.includes('approuv') || e.includes('approved');
};

export default function TeamCalendarPage() {
  const { t } = useTranslation();
  const { soccod } = useAuth();
  const navigate = useNavigate();

  const [conges, setConges] = React.useState<CongeRow[]>([]);
  const [missions, setMissions] = React.useState<MissionRow[]>([]);
  const [autos, setAutos] = React.useState<AutoRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filters, setFilters] = React.useState<Record<FilterKey, boolean>>({
    conges: true, missions: true, autorisations: true,
  });
  const [empFilter, setEmpFilter] = React.useState<string>('all');

  React.useEffect(() => {
    if (!soccod) return;
    setLoading(true);
    Promise.all([
      apiInstance.get(`/DemConges/by-soc/${soccod}`).catch(() => ({ data: [] })),
      apiInstance.get(`/Missions/by-soc/${soccod}`).catch(() => ({ data: [] })),
      apiInstance.get(`/DemandeAutorisations/by-soc/${soccod}`).catch(() => ({ data: [] })),
    ]).then(([cR, mR, aR]) => {
      setConges(Array.isArray(cR.data) ? cR.data : []);
      setMissions(Array.isArray(mR.data) ? mR.data : []);
      setAutos(Array.isArray(aR.data) ? aR.data : []);
    }).finally(() => setLoading(false));
  }, [soccod]);

  // Liste unique d'employés pour le filtre dropdown.
  const employees = React.useMemo(() => {
    const map = new Map<string, string>();
    [...conges, ...missions, ...autos].forEach(r => {
      if (r.empcod && !map.has(r.empcod)) map.set(r.empcod, r.emplib || r.empcod);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [conges, missions, autos]);

  // Convertit toutes les sources en évènements FullCalendar.
  // Note : end est exclusif côté FullCalendar (allDay range), donc on ajoute
  // 1 jour pour que la barre couvre le jour de retour.
  const events = React.useMemo(() => {
    const acc: any[] = [];
    const addDay = (d: Date | null): string | undefined => {
      if (!d) return undefined;
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      return next.toISOString().split('T')[0];
    };

    if (filters.conges) {
      conges.filter(c => isAccepted(c.etat, c.conrefus)).forEach(c => {
        if (empFilter !== 'all' && c.empcod !== empFilter) return;
        const start = toLocalDate(c.condep);
        const end = toLocalDate(c.conret);
        if (!start) return;
        acc.push({
          id: `conge-${c.concod}`,
          title: `🏖️ ${c.emplib || c.empcod}${c.abscod ? ` (${c.abscod})` : ''}`,
          start: start.toISOString().split('T')[0],
          end: addDay(end || start),
          allDay: true,
          backgroundColor: COLORS.conges.bg,
          borderColor: COLORS.conges.border,
          textColor: COLORS.conges.text,
          extendedProps: { kind: 'conges', empcod: c.empcod, ref: c.concod },
        });
      });
    }

    if (filters.missions) {
      missions.filter(m => isAccepted(m.misEtat)).forEach(m => {
        if (empFilter !== 'all' && m.empcod !== empFilter) return;
        const start = toLocalDate(m.misDateDebut);
        const end = toLocalDate(m.misDateFin);
        if (!start) return;
        acc.push({
          id: `mission-${m.misCod}`,
          title: `🚀 ${m.emplib || m.empcod}${m.misObjet ? ` — ${m.misObjet}` : ''}`,
          start: start.toISOString().split('T')[0],
          end: addDay(end || start),
          allDay: true,
          backgroundColor: COLORS.missions.bg,
          borderColor: COLORS.missions.border,
          textColor: COLORS.missions.text,
          extendedProps: { kind: 'missions', empcod: m.empcod, ref: m.misCod },
        });
      });
    }

    if (filters.autorisations) {
      autos.filter(a => isAccepted(a.etat)).forEach(a => {
        if (empFilter !== 'all' && a.empcod !== empFilter) return;
        const start = toLocalDate(a.condep);
        const end = toLocalDate(a.conret);
        if (!start) return;
        acc.push({
          id: `auto-${a.id}`,
          title: `⏱️ ${a.emplib || a.empcod}${a.motif ? ` — ${a.motif}` : ''}`,
          start: start.toISOString().split('T')[0],
          end: addDay(end || start),
          allDay: true,
          backgroundColor: COLORS.autorisations.bg,
          borderColor: COLORS.autorisations.border,
          textColor: COLORS.autorisations.text,
          extendedProps: { kind: 'autorisations', empcod: a.empcod, ref: a.id },
        });
      });
    }

    return acc;
  }, [conges, missions, autos, filters, empFilter]);

  const handleEventClick = (info: any) => {
    const kind = info.event.extendedProps.kind as FilterKey;
    // On redirige vers la page de gestion correspondante. Plus tard on pourra
    // ouvrir un dialog inline ; pour l'instant, redirection la plus simple.
    if (kind === 'conges') navigate('/dashboard/gestion-de-conge');
    else if (kind === 'missions') navigate('/dashboard/missions');
    else if (kind === 'autorisations') navigate('/dashboard/demande-autorisation');
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, fontFamily: 'Inter, sans-serif' }}>
      <Box sx={{ mb: 2.5 }}>
        <Typography sx={{ fontSize: { xs: 22, sm: 26 }, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
          {t('teamCalendar.title', 'Calendrier équipe')}
        </Typography>
        <Typography sx={{ fontSize: 13, color: '#64748b', mt: 0.5 }}>
          {t('teamCalendar.subtitle', 'Vue mensuelle des congés, missions et autorisations approuvés.')}
        </Typography>
      </Box>

      {/* Filtres */}
      <Paper sx={{ p: 1.5, mb: 2, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, borderRadius: '12px' }}>
        {(Object.keys(filters) as FilterKey[]).map(k => (
          <FormControlLabel
            key={k}
            control={
              <Checkbox
                size="small"
                checked={filters[k]}
                onChange={() => setFilters(p => ({ ...p, [k]: !p[k] }))}
                sx={{ p: 0.5, color: COLORS[k].border, '&.Mui-checked': { color: COLORS[k].text } }}
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
                <Box sx={{ width: 12, height: 12, borderRadius: '3px', backgroundColor: COLORS[k].bg, border: `1px solid ${COLORS[k].border}` }} />
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>{COLORS[k].label}</Typography>
              </Box>
            }
            sx={{ ml: 0, mr: 1 }}
          />
        ))}
        <Box sx={{ flex: 1 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontSize: 12, color: '#64748b' }}>Employé :</Typography>
          <Select
            size="small"
            value={empFilter}
            onChange={(e) => setEmpFilter(e.target.value)}
            sx={{ minWidth: 200, fontSize: 13, borderRadius: '8px', backgroundColor: '#f8fafc' }}
          >
            <MenuItem value="all">Tous</MenuItem>
            {employees.map(([cod, lib]) => (
              <MenuItem key={cod} value={cod}>{lib}</MenuItem>
            ))}
          </Select>
        </Box>
        {loading && <Chip label="Chargement…" size="small" sx={{ fontSize: 11 }} />}
      </Paper>

      {/* Calendar */}
      <Paper sx={{
        p: 1.5,
        borderRadius: '12px',
        // Surcharges visuelles légères pour aligner FullCalendar à la charte
        // Concorde (boutons rounded, header bleu, jours du week-end teintés).
        '& .fc': { fontFamily: 'Inter, sans-serif' },
        '& .fc-toolbar-title': { fontSize: '18px !important', fontWeight: 800, color: '#0f172a' },
        '& .fc-button-primary': {
          backgroundColor: '#0040a1 !important',
          borderColor: '#0040a1 !important',
          textTransform: 'none', fontWeight: 600,
        },
        '& .fc-button-primary:hover': { backgroundColor: '#003280 !important' },
        '& .fc-button-primary:disabled': { backgroundColor: '#94a3b8 !important', borderColor: '#94a3b8 !important', opacity: 1 },
        '& .fc-button-active': { backgroundColor: '#003280 !important' },
        '& .fc-day-today': { backgroundColor: '#e0e7ff !important' },
        '& .fc-day-sat, & .fc-day-sun': { backgroundColor: '#f8fafc' },
        '& .fc-event': { borderRadius: '6px', padding: '2px 6px', cursor: 'pointer', borderWidth: '1px', fontWeight: 600 },
        '& .fc-event:hover': { filter: 'brightness(0.95)' },
      }}>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locale="fr"
          firstDay={1}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek',
          }}
          buttonText={{ today: "Aujourd'hui", month: 'Mois', week: 'Semaine' }}
          events={events}
          eventClick={handleEventClick}
          height="auto"
          dayMaxEvents={3}
          weekends
          // Empêche le drag par défaut : on est en mode lecture seule pour
          // le moment (les actions passent par la page d'origine au clic).
          editable={false}
          selectable={false}
        />
      </Paper>
    </Box>
  );
}
