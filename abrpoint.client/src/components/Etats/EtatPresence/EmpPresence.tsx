import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  IconButton,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  CalendarToday,
  ExpandLess,
  ExpandMore,
  Search,
  TrendingUp,
} from '@mui/icons-material';
import { useDateRange } from '../../Pointeuse/EtatPeriodique/FilterContext';
import EtatPresence from '../../../models/EtatPresece';
import useGetEtatPresence from '../../../hooks/presenceHooks/useGetEtatPresence';

const DASH = '\u2014';

type DateRangeContext = {
  dateRange: {
    dateDebut: Date;
    dateFin: Date;
    selectedRegime: string;
    mois: string;
    empcods: string[] | null;
  };
};

const hasTimeValue = (value?: string | null): boolean => {
  if (!value) return false;
  const cleaned = value.trim();
  return cleaned !== '' && cleaned !== '00:00' && cleaned !== DASH && cleaned !== '-';
};

const toMinutes = (value?: string | null): number => {
  if (!hasTimeValue(value)) return 0;
  const match = (value ?? '').match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
};

const toHHMM = (minutes: number): string => {
  const safe = Math.max(0, minutes);
  const h = Math.floor(safe / 60).toString().padStart(2, '0');
  const m = Math.floor(safe % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
};

const formatDate = (value?: Date | string | null): string => {
  if (!value) return DASH;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return DASH;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatDateLong = (value?: Date | string | null): string => {
  if (!value) return DASH;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return DASH;
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
};

const asBool = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.toLowerCase();
    return v === 'true' || v === '1' || v === 'oui';
  }
  return false;
};

const initials = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'NA';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
};

const readRetard = (row: EtatPresence): string => {
  const total = toMinutes(row.preretmateup) + toMinutes(row.preretameup);
  return total > 0 ? toHHMM(total) : row.totalRetard || '00:00';
};

const EmpPresence = () => {
  const { dateRange } = useDateRange() as DateRangeContext;
  const [search, setSearch] = useState('');
  const [dailyDetailOpen, setDailyDetailOpen] = useState(false);

  const theme = useTheme();
  const isLgUp = useMediaQuery(theme.breakpoints.up('lg'));

  const { data = [], isLoading } = useGetEtatPresence(
    dateRange.dateDebut,
    dateRange.dateFin,
    dateRange.empcods ?? [],
    dateRange.selectedRegime,
  );

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;

    return data.filter((row) => {
      const text = `${row.emplib ?? ''} ${row.empcod ?? ''} ${row.empmat ?? ''} ${row.motif ?? ''} ${formatDate(row.predat)}`.toLowerCase();
      return text.includes(q);
    });
  }, [data, search]);

  const [selectedKey, setSelectedKey] = useState<string>('');

  useEffect(() => {
    if (!filteredRows.length) {
      setSelectedKey('');
      return;
    }
    const exists = filteredRows.some((row, idx) => `${row.empcod}-${row.predat}-${idx}` === selectedKey);
    if (!exists) setSelectedKey(`${filteredRows[0].empcod}-${filteredRows[0].predat}-0`);
  }, [filteredRows, selectedKey]);

  const selectedRow = useMemo(() => {
    if (!filteredRows.length) return null;
    return filteredRows.find((row, idx) => `${row.empcod}-${row.predat}-${idx}` === selectedKey) ?? filteredRows[0];
  }, [filteredRows, selectedKey]);

  const kpis = useMemo(() => {
    const lateRows = filteredRows.filter((row) => toMinutes(readRetard(row)) > 0);
    const lateMinutes = lateRows.reduce((acc, row) => acc + toMinutes(readRetard(row)), 0);
    const totalNightMinutes = filteredRows.reduce((acc, row) => acc + toMinutes(row.tothnuit), 0);
    const totalEmployees = new Set(filteredRows.map((row) => row.empcod).filter(Boolean)).size;
    const impactedEmployees = new Set(lateRows.map((row) => row.empcod).filter(Boolean)).size;
    const rate = totalEmployees > 0 ? (impactedEmployees / totalEmployees) * 100 : 0;
    const punctuality = totalEmployees > 0 ? (100 - rate) : 100;

    return {
      lateRate: rate.toFixed(1),
      totalLate: toHHMM(lateMinutes),
      avgLate: lateRows.length > 0 ? `${Math.round(lateMinutes / lateRows.length)} min` : '0 min',
      impactedEmployees,
      totalEmployees,
      totalNight: toHHMM(totalNightMinutes),
      punctuality: punctuality.toFixed(1),
    };
  }, [filteredRows]);

  const periodLabel = `${new Date(dateRange.dateDebut).toLocaleDateString('fr-FR')} - ${new Date(dateRange.dateFin).toLocaleDateString('fr-FR')}`;

  if (isLoading) {
    return (
      <Stack spacing={1.5}>
        <Skeleton variant="rounded" height={70} />
        <Skeleton variant="rounded" height={110} />
        <Skeleton variant="rounded" height={420} />
      </Stack>
    );
  }

  

  return (
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: 2 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack spacing={2.2}>
          {/* KPIs */}
          <Paper sx={{ p: 2.5, borderRadius: 2.5, border: '1px solid #e7eaf0', boxShadow: '0 20px 48px -20px rgba(15,23,42,0.16)' }}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
              <Box>
                <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#64748b' }}>
                  Analytique Presence
                </Typography>
                <Typography sx={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: { xs: '1.7rem', md: '2rem' }, color: '#0f172a' }}>
                  Etat de Presence
                </Typography>
              </Box>
              <Chip label={`Ponctualite ${kpis.punctuality}%`} sx={{ bgcolor: '#dbeafe', color: '#1d4ed8', fontWeight: 700, alignSelf: 'start' }} />
            </Stack>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2,1fr)', xl: 'repeat(4,1fr)' }, gap: 1.4, mt: 2 }}>
              <Paper variant="outlined" sx={{ p: 1.6, borderRadius: 2 }}>
                <Typography sx={{ fontSize: '0.64rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Taux de retard global</Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography sx={{ fontSize: '1.45rem', fontWeight: 900, fontFamily: 'Manrope' }}>{kpis.lateRate}%</Typography>
                  <TrendingUp sx={{ fontSize: 16, color: '#dc2626' }} />
                </Stack>
              </Paper>
              <Paper variant="outlined" sx={{ p: 1.6, borderRadius: 2 }}>
                <Typography sx={{ fontSize: '0.64rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Temps de retard total</Typography>
                <Typography sx={{ fontSize: '1.45rem', fontWeight: 900, fontFamily: 'Manrope', color: '#0040a1' }}>{kpis.totalLate}</Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 1.6, borderRadius: 2 }}>
                <Typography sx={{ fontSize: '0.64rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Moyenne retard</Typography>
                <Typography sx={{ fontSize: '1.45rem', fontWeight: 900, fontFamily: 'Manrope' }}>{kpis.avgLate}</Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 1.6, borderRadius: 2 }}>
                <Typography sx={{ fontSize: '0.64rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>H. Nuit total</Typography>
                <Typography sx={{ fontSize: '1.45rem', fontWeight: 900, fontFamily: 'Manrope', color: '#6b21a8' }}>{kpis.totalNight}</Typography>
              </Paper>
            </Box>
          </Paper>

          {/* Tableau avec filtres intégrés */}
          <Paper sx={{ borderRadius: 2.5, border: '1px solid #e7eaf0', overflow: 'hidden' }}>
            {/* Filtres au-dessus du tableau */}
            <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #eef2f7', bgcolor: '#f8fafc' }}>
              <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} alignItems={{ lg: 'center' }}>
                <TextField
                  label="Periode"
                  size="small"
                  value={periodLabel}
                  InputProps={{ startAdornment: <CalendarToday sx={{ mr: 1, fontSize: 16, color: '#64748b' }} /> }}
                  fullWidth
                />
                <TextField label="Regime" size="small" value={dateRange.selectedRegime || 'Tous'} sx={{ minWidth: 180 }} />
                <TextField
                  label="Recherche"
                  size="small"
                  placeholder="ID ou Nom"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  InputProps={{ startAdornment: <Search sx={{ mr: 1, fontSize: 16, color: '#64748b' }} /> }}
                  fullWidth
                />
                <Button variant="contained" onClick={() => undefined} sx={{ minWidth: 110, height: 40, flexShrink: 0 }}>
                  Filtrer
                </Button>
              </Stack>
            </Box>

            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 1050 }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#eef2f7' }}>
                    <TableCell sx={{ fontSize: '0.67rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>Employe</TableCell>
                    <TableCell sx={{ fontSize: '0.67rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>Date</TableCell>
                    <TableCell sx={{ fontSize: '0.67rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>Horaire</TableCell>
                    <TableCell sx={{ fontSize: '0.67rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>Pointage</TableCell>
                    <TableCell align="center" sx={{ fontSize: '0.67rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>Duree retard</TableCell>
                    <TableCell sx={{ fontSize: '0.67rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>Statut</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredRows.map((row, index) => {
                    const key = `${row.empcod}-${row.predat}-${index}`;
                    const isActive = selectedKey === key;
                    const employeeName = row.emplib || row.empcod || 'Employe';
                    const planned = `${row.entree1 || DASH} - ${row.sortie2 || DASH}`;
                    const pointage = row.entree1 || DASH;
                    const retard = readRetard(row);
                    const statusLabel = asBool(row.hasConge) ? 'Conge' : (asBool(row.allaitement) ? 'Allaitement' : 'Normal');

                    return (
                      <TableRow key={key} hover selected={isActive} onClick={() => setSelectedKey(key)} sx={{ cursor: 'pointer' }}>
                        <TableCell>
                          <Stack direction="row" spacing={1.2} alignItems="center">
                            <Avatar sx={{ width: 34, height: 34, bgcolor: '#dbeafe', color: '#1d4ed8', fontWeight: 800, fontSize: '0.75rem' }}>
                              {initials(employeeName)}
                            </Avatar>
                            <Box>
                              <Typography sx={{ fontSize: '0.82rem', fontWeight: 700 }}>{employeeName}</Typography>
                              <Typography sx={{ fontSize: '0.68rem', color: '#64748b' }}>ID: {row.empcod || DASH}</Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.79rem', fontWeight: 600 }}>{formatDate(row.predat)}</TableCell>
                        <TableCell sx={{ fontSize: '0.79rem', color: '#64748b' }}>{planned}</TableCell>
                        <TableCell sx={{ fontSize: '0.79rem', color: '#b91c1c', fontWeight: 800 }}>{pointage}</TableCell>
                        <TableCell align="center">
                          <Chip label={retard} size="small" sx={{ bgcolor: '#fee2e2', color: '#991b1b', fontWeight: 700 }} />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={statusLabel}
                            size="small"
                            sx={{
                              bgcolor: statusLabel === 'Conge' ? '#e2e8f0' : (statusLabel === 'Allaitement' ? '#dcfce7' : '#dbeafe'),
                              color: statusLabel === 'Conge' ? '#334155' : (statusLabel === 'Allaitement' ? '#166534' : '#1d4ed8'),
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              fontSize: '0.6rem',
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {/* Détail journalier repliable sous le tableau */}
          {!isLgUp && selectedRow && (
            <Paper sx={{ borderRadius: 2.5, border: '1px solid #e7eaf0', overflow: 'hidden' }}>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ px: 2, py: 1.5, cursor: 'pointer', bgcolor: '#f8fafc', borderBottom: dailyDetailOpen ? '1px solid #eef2f7' : 'none' }}
                onClick={() => setDailyDetailOpen((prev) => !prev)}
              >
                <Stack direction="row" spacing={1.2} alignItems="center">
                  <Avatar sx={{ width: 34, height: 34, bgcolor: '#dbeafe', color: '#1d4ed8', fontWeight: 800, fontSize: '0.75rem' }}>
                    {initials(selectedRow.emplib || selectedRow.empcod || 'NA')}
                  </Avatar>
                  <Box>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 700 }}>Details Presence</Typography>
                    <Typography sx={{ fontSize: '0.68rem', color: '#64748b' }}>{formatDateLong(selectedRow.predat)}</Typography>
                  </Box>
                </Stack>
                <IconButton size="small">
                  {dailyDetailOpen ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
              </Stack>

              <Collapse in={dailyDetailOpen}>
                <Box sx={{ p: 2 }}>
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1.2} alignItems="center">
                      <Avatar sx={{ width: 48, height: 48, bgcolor: '#dbeafe', color: '#1d4ed8', fontWeight: 800 }}>
                        {initials(selectedRow.emplib || selectedRow.empcod || 'NA')}
                      </Avatar>
                      <Box>
                        <Typography sx={{ fontWeight: 700 }}>{selectedRow.emplib || DASH}</Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>{selectedRow.empmat || selectedRow.empcod || DASH}</Typography>
                      </Box>
                    </Stack>

                    <Divider />

                    <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2, bgcolor: '#f8fafc' }}>
                      <Typography sx={{ fontSize: '0.64rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 800 }}>Date</Typography>
                      <Typography sx={{ fontSize: '0.86rem', fontWeight: 700 }}>{formatDateLong(selectedRow.predat)}</Typography>
                    </Paper>

                    <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2 }}>
                      <Typography sx={{ fontSize: '0.64rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 800, mb: 0.6 }}>Pointages enregistres</Typography>
                      <Stack spacing={0.8}>
                        <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: '0.78rem' }}>Entree matin</Typography><Typography sx={{ fontSize: '0.78rem', fontWeight: 700 }}>{selectedRow.entree1 || DASH}</Typography></Stack>
                        <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: '0.78rem' }}>Sortie matin</Typography><Typography sx={{ fontSize: '0.78rem', fontWeight: 700 }}>{selectedRow.sortie1 || DASH}</Typography></Stack>
                        <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: '0.78rem' }}>Entree apres-midi</Typography><Typography sx={{ fontSize: '0.78rem', fontWeight: 700 }}>{selectedRow.entree2 || DASH}</Typography></Stack>
                        <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: '0.78rem' }}>Sortie apres-midi</Typography><Typography sx={{ fontSize: '0.78rem', fontWeight: 700 }}>{selectedRow.sortie2 || DASH}</Typography></Stack>
                        <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: '0.78rem' }}>Retard total</Typography><Chip size="small" label={readRetard(selectedRow)} sx={{ bgcolor: '#fee2e2', color: '#991b1b', fontWeight: 700 }} /></Stack>
                        <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: '0.78rem' }}>Heure nuit</Typography><Chip size="small" label={selectedRow.tothnuit || '00:00'} sx={{ bgcolor: '#f3e8ff', color: '#6b21a8', fontWeight: 700 }} /></Stack>
                      </Stack>
                    </Paper>
                  </Stack>
                </Box>
              </Collapse>
            </Paper>
          )}
        </Stack>
      </Box>

      {/* Panneau détail latéral (xl+) */}
      {isLgUp && (
        <Paper sx={{ width: 300, flexShrink: 0, p: 2.5, borderRadius: 2.5, border: '1px solid #e7eaf0', height: 'fit-content', position: 'sticky', top: 16 }}>
          <Typography sx={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: '1.1rem', mb: 2 }}>Details Presence</Typography>
          {selectedRow ? (
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1.2} alignItems="center">
                <Avatar sx={{ width: 52, height: 52, bgcolor: '#dbeafe', color: '#1d4ed8', fontWeight: 800 }}>
                  {initials(selectedRow.emplib || selectedRow.empcod || 'NA')}
                </Avatar>
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>{selectedRow.emplib || DASH}</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>{selectedRow.empmat || selectedRow.empcod || DASH}</Typography>
                </Box>
              </Stack>

              <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2, bgcolor: '#f8fafc' }}>
                <Typography sx={{ fontSize: '0.64rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 800 }}>Date</Typography>
                <Typography sx={{ fontSize: '0.86rem', fontWeight: 700 }}>{formatDateLong(selectedRow.predat)}</Typography>
              </Paper>

              <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2 }}>
                <Typography sx={{ fontSize: '0.64rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 800, mb: 0.6 }}>Pointages enregistres</Typography>
                <Stack spacing={0.8}>
                  <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: '0.78rem' }}>Entree matin</Typography><Typography sx={{ fontSize: '0.78rem', fontWeight: 700 }}>{selectedRow.entree1 || DASH}</Typography></Stack>
                  <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: '0.78rem' }}>Sortie matin</Typography><Typography sx={{ fontSize: '0.78rem', fontWeight: 700 }}>{selectedRow.sortie1 || DASH}</Typography></Stack>
                  <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: '0.78rem' }}>Entree apres-midi</Typography><Typography sx={{ fontSize: '0.78rem', fontWeight: 700 }}>{selectedRow.entree2 || DASH}</Typography></Stack>
                  <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: '0.78rem' }}>Sortie apres-midi</Typography><Typography sx={{ fontSize: '0.78rem', fontWeight: 700 }}>{selectedRow.sortie2 || DASH}</Typography></Stack>
                  <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: '0.78rem' }}>Retard total</Typography><Chip size="small" label={readRetard(selectedRow)} sx={{ bgcolor: '#fee2e2', color: '#991b1b', fontWeight: 700 }} /></Stack>
                  <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: '0.78rem' }}>Heure nuit</Typography><Chip size="small" label={selectedRow.tothnuit || '00:00'} sx={{ bgcolor: '#f3e8ff', color: '#6b21a8', fontWeight: 700 }} /></Stack>
                </Stack>
              </Paper>

              <Button
                variant="outlined"
                fullWidth
                startIcon={dailyDetailOpen ? <ExpandLess /> : <ExpandMore />}
                onClick={() => setDailyDetailOpen((prev) => !prev)}
              >
                Voir le detail journalier
              </Button>

              <Collapse in={dailyDetailOpen}>
                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: '#f8fafc' }}>
                  <Typography sx={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 800, mb: 1 }}>Detail journalier</Typography>
                  <Stack spacing={0.6}>
                    <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>Total heures</Typography><Typography sx={{ fontSize: '0.75rem', fontWeight: 700 }}>{selectedRow.totalHeure || DASH}</Typography></Stack>
                    <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>Retard matin</Typography><Typography sx={{ fontSize: '0.75rem', fontWeight: 700 }}>{selectedRow.preretmateup || DASH}</Typography></Stack>
                    <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>Retard apres-midi</Typography><Typography sx={{ fontSize: '0.75rem', fontWeight: 700 }}>{selectedRow.preretameup || DASH}</Typography></Stack>
                    <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>Regime</Typography><Typography sx={{ fontSize: '0.75rem', fontWeight: 700 }}>{selectedRow.empreg || DASH}</Typography></Stack>
                    <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>Motif</Typography><Typography sx={{ fontSize: '0.75rem', fontWeight: 700 }}>{selectedRow.motif || DASH}</Typography></Stack>
                  </Stack>
                </Paper>
              </Collapse>
            </Stack>
          ) : (
            <Alert severity="info">Aucune ligne selectionnee.</Alert>
          )}
        </Paper>
      )}
    </Box>
  );
};

export default EmpPresence;
