import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  CalendarToday,
  Search,
  TrendingDown,
  TrendingUp,
} from '@mui/icons-material';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useTranslation } from 'react-i18next';
import useGetPresence from '../../../hooks/presenceHooks/useGetPresence';
import { useDateRange } from '../../Pointeuse/EtatPeriodique/FilterContext';

const DASH = '\u2014';

type DateRangeState = {
  dateDebut: Date;
  dateFin: Date;
  selectedRegime: string;
  empcods: string[] | null;
  retmin: number;
  retmat: boolean;
  retapres: boolean;
  compterAvance: boolean;
};

type RetardRow = {
  empcod?: string;
  empmat?: string;
  emplib?: string;
  regime?: string;
  empreg?: string;
  predat?: Date | string;
  entree1?: string;
  sortie1?: string;
  entree2?: string;
  sortie2?: string;
  preretmateup?: string;
  preretameup?: string;
  preretmatsup?: string;
  preretamsup?: string;
  motif?: string;
  totalRetard?: string;
};

const toMinutes = (value?: string | null): number => {
  if (!value || value === '00:00' || value === DASH) return 0;
  const [h, m] = value.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
};

const toHHMM = (minutes: number): string => {
  const safe = Math.max(0, minutes);
  const h = Math.floor(safe / 60).toString().padStart(2, '0');
  const m = Math.floor(safe % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
};

const formatDate = (value?: Date | string): string => {
  if (!value) return DASH;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return DASH;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatDateLong = (value?: Date | string): string => {
  if (!value) return DASH;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return DASH;
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
};

const initials = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'NA';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
};

const EmpRetard = () => {
  const { t } = useTranslation();
  const { dateRange } = useDateRange() as { dateRange: DateRangeState };
  const [search, setSearch] = useState('');

  const { data = [], isLoading } = useGetPresence(
    dateRange.dateDebut,
    dateRange.dateFin,
    dateRange.selectedRegime,
    dateRange.empcods,
  );

  const rows = useMemo(() => {
    const minRetard = dateRange.retmin || 0;

    return (data as RetardRow[]).map((row) => {
      const retardMatin = toMinutes(row.preretmateup);
      const retardAm = toMinutes(row.preretameup);
      const avanceMatin = toMinutes(row.preretmatsup);
      const avanceAm = toMinutes(row.preretamsup);

      const filteredRetardMatin = dateRange.retmat && retardMatin > minRetard ? retardMatin : 0;
      const filteredRetardAm = dateRange.retapres && retardAm > minRetard ? retardAm : 0;
      const filteredAvanceMatin = dateRange.compterAvance && avanceMatin > minRetard ? avanceMatin : 0;
      const filteredAvanceAm = dateRange.compterAvance && avanceAm > minRetard ? avanceAm : 0;

      const totalRetard = filteredRetardMatin + filteredRetardAm + filteredAvanceMatin + filteredAvanceAm;

      return {
        ...row,
        preretmateup: toHHMM(filteredRetardMatin),
        preretameup: toHHMM(filteredRetardAm),
        preretmatsup: toHHMM(filteredAvanceMatin),
        preretamsup: toHHMM(filteredAvanceAm),
        totalRetard: toHHMM(totalRetard),
      };
    });
  }, [data, dateRange.compterAvance, dateRange.retapres, dateRange.retmat, dateRange.retmin]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((row) => {
      const text = `${row.emplib ?? ''} ${row.empcod ?? ''} ${row.empmat ?? ''} ${formatDate(row.predat)}`.toLowerCase();
      return text.includes(q);
    });
  }, [rows, search]);

  const [selectedKey, setSelectedKey] = useState<string>('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  const handleChangePage = (_: any, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  useEffect(() => {
    if (!filteredRows.length) {
      setSelectedKey('');
      return;
    }

    const exists = filteredRows.some((row, idx) => `${row.empcod}-${row.predat}-${idx}` === selectedKey);
    if (!exists) {
      setSelectedKey(`${filteredRows[0].empcod}-${filteredRows[0].predat}-0`);
    }
  }, [filteredRows, selectedKey]);

  const selectedRow = useMemo(() => {
    if (!filteredRows.length) return null;
    const found = filteredRows.find((row, idx) => `${row.empcod}-${row.predat}-${idx}` === selectedKey);
    return found ?? filteredRows[0];
  }, [filteredRows, selectedKey]);

  const kpis = useMemo(() => {
    const impactedMinutes = filteredRows.reduce((acc, row) => acc + toMinutes(row.totalRetard), 0);
    const impactedRows = filteredRows.filter((row) => toMinutes(row.totalRetard) > 0);
    const uniqueEmployees = new Set(filteredRows.map((row) => row.empcod).filter(Boolean)).size;
    const impactedEmployees = new Set(impactedRows.map((row) => row.empcod).filter(Boolean)).size;
    const rate = uniqueEmployees > 0 ? (impactedEmployees / uniqueEmployees) * 100 : 0;
    const avg = impactedRows.length > 0 ? Math.round(impactedMinutes / impactedRows.length) : 0;

    return {
      rate: rate.toFixed(1),
      totalRetard: toHHMM(impactedMinutes),
      avgByDay: `${avg} min`,
      impactedEmployees,
      totalEmployees: uniqueEmployees,
    };
  }, [filteredRows]);

  const periodLabel = `${new Date(dateRange.dateDebut).toLocaleDateString('fr-FR')} - ${new Date(dateRange.dateFin).toLocaleDateString('fr-FR')}`;

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape' });

    autoTable(doc, {
      head: [['Employe', 'Date', 'Horaire', 'Pointage', 'Retard', 'Statut']],
      body: filteredRows.map((row) => {
        const planned = `${row.entree1 || DASH} - ${row.sortie2 || DASH}`;
        const pointage = row.entree1 || DASH;
        const status = row.motif ? 'Justifie' : 'Non justifie';

        return [
          `${row.emplib || DASH} (${row.empcod || DASH})`,
          formatDate(row.predat),
          planned,
          pointage,
          row.totalRetard || '00:00',
          status,
        ];
      }),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 64, 161] },
      margin: { top: 18 },
    });

    doc.save('suivi-retards.pdf');
  };

  if (isLoading) {
    return (
      <Stack spacing={1.5}>
        <Skeleton variant="rounded" height={70} />
        <Skeleton variant="rounded" height={110} />
        <Skeleton variant="rounded" height={420} />
      </Stack>
    );
  }

  if (!rows.length) {
    return <Alert severity="info">{t('etats.retard.noData')}</Alert>;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', xl: 'row' }, gap: 2 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack spacing={2.2}>
          <Paper sx={{ p: 2.5, borderRadius: 2.5, border: '1px solid #e7eaf0', boxShadow: '0 20px 48px -20px rgba(15,23,42,0.16)' }}>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
              <Box>
                <Typography sx={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#64748b' }}>
                  {t('etats.retard.analyticTitle')}
                </Typography>
                <Typography sx={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: { xs: '1.7rem', md: '2rem' }, color: '#0f172a' }}>
                  {t('etats.retard.title')}
                </Typography>
              </Box>
              <Chip label={t('etats.retard.upToDate')} sx={{ bgcolor: '#dcfce7', color: '#166534', fontWeight: 700, alignSelf: 'start' }} />
            </Stack>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2,1fr)', xl: 'repeat(4,1fr)' }, gap: 1.4, mt: 2 }}>
              <Paper variant="outlined" sx={{ p: 1.6, borderRadius: 2 }}>
                <Typography sx={{ fontSize: '0.64rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>{t('etats.retard.kpiGlobalRate')}</Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography sx={{ fontSize: '1.45rem', fontWeight: 900, fontFamily: 'Manrope' }}>{kpis.rate}%</Typography>
                  <TrendingUp sx={{ fontSize: 16, color: '#dc2626' }} />
                </Stack>
              </Paper>
              <Paper variant="outlined" sx={{ p: 1.6, borderRadius: 2 }}>
                <Typography sx={{ fontSize: '0.64rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>{t('etats.retard.kpiTotalDuration')}</Typography>
                <Typography sx={{ fontSize: '1.45rem', fontWeight: 900, fontFamily: 'Manrope', color: '#0040a1' }}>{kpis.totalRetard}</Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 1.6, borderRadius: 2 }}>
                <Typography sx={{ fontSize: '0.64rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>{t('etats.retard.kpiAvgByPunch')}</Typography>
                <Typography sx={{ fontSize: '1.45rem', fontWeight: 900, fontFamily: 'Manrope' }}>{kpis.avgByDay}</Typography>
              </Paper>
              <Paper variant="outlined" sx={{ p: 1.6, borderRadius: 2 }}>
                <Typography sx={{ fontSize: '0.64rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>{t('etats.retard.kpiImpacted')}</Typography>
                <Stack direction="row" spacing={1} alignItems="baseline">
                  <Typography sx={{ fontSize: '1.45rem', fontWeight: 900, fontFamily: 'Manrope' }}>{kpis.impactedEmployees}</Typography>
                  <Typography sx={{ fontSize: '0.74rem', color: '#64748b' }}>/ {kpis.totalEmployees}</Typography>
                </Stack>
              </Paper>
            </Box>
          </Paper>

          <Paper sx={{ p: 2, borderRadius: 2.5, border: '1px solid #e7eaf0', bgcolor: '#f8fafc' }}>
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} alignItems={{ lg: 'end' }}>
              <TextField
                label={t('etats.retard.period')}
                size="small"
                value={periodLabel}
                InputProps={{ startAdornment: <CalendarToday sx={{ mr: 1, fontSize: 16, color: '#64748b' }} /> }}
                fullWidth
              />
              <TextField label={t('etats.retard.site')} size="small" value={dateRange.selectedRegime ? t('etats.retard.regimePrefix', { value: dateRange.selectedRegime }) : t('etats.retard.allRegimes')} sx={{ minWidth: 180 }} />
              <TextField
                label={t('etats.retard.search')}
                size="small"
                placeholder={t('etats.retard.searchPlaceholder')}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                InputProps={{ startAdornment: <Search sx={{ mr: 1, fontSize: 16, color: '#64748b' }} /> }}
                fullWidth
              />
              <Button variant="contained" onClick={() => undefined} sx={{ minWidth: 110, height: 40 }}>
                {t('etats.retard.filter')}
              </Button>
            </Stack>
          </Paper>

          <Paper sx={{ borderRadius: 2.5, border: '1px solid #e7eaf0', overflow: 'hidden' }}>
            <TableContainer sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 1050 }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#eef2f7' }}>
                    <TableCell sx={{ fontSize: '0.67rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>{t('etats.retard.headers.employee')}</TableCell>
                    <TableCell sx={{ fontSize: '0.67rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>{t('etats.retard.headers.date')}</TableCell>
                    <TableCell sx={{ fontSize: '0.67rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>{t('etats.retard.headers.schedule')}</TableCell>
                    <TableCell sx={{ fontSize: '0.67rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>{t('etats.retard.headers.punch')}</TableCell>
                    <TableCell align="center" sx={{ fontSize: '0.67rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>{t('etats.retard.headers.lateDuration')}</TableCell>
                    <TableCell sx={{ fontSize: '0.67rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>{t('etats.retard.headers.status')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredRows
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((row, index) => {
                      const absoluteIndex = page * rowsPerPage + index;
                      const key = `${row.empcod}-${row.predat}-${absoluteIndex}`;
                    const isActive = selectedKey === key;
                    const employeeName = row.emplib || row.empcod || t('etats.retard.fallbackEmployee');
                    const planned = `${row.entree1 || DASH} - ${row.sortie2 || DASH}`;
                    const pointage = row.entree1 || DASH;
                    const justified = Boolean(row.motif && row.motif.trim() && row.motif !== DASH);

                    return (
                      <TableRow
                        key={key}
                        hover
                        selected={isActive}
                        onClick={() => setSelectedKey(key)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>
                          <Stack direction="row" spacing={1.2} alignItems="center">
                            <Avatar sx={{ width: 34, height: 34, bgcolor: '#dbeafe', color: '#1d4ed8', fontWeight: 800, fontSize: '0.75rem' }}>
                              {initials(employeeName)}
                            </Avatar>
                            <Box>
                              <Typography sx={{ fontSize: '0.82rem', fontWeight: 700 }}>{employeeName}</Typography>
                              <Typography sx={{ fontSize: '0.68rem', color: '#64748b' }}>{t('etats.retard.id')}: {row.empcod || DASH}</Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.79rem', fontWeight: 600 }}>{formatDate(row.predat)}</TableCell>
                        <TableCell sx={{ fontSize: '0.79rem', color: '#64748b' }}>{planned}</TableCell>
                        <TableCell sx={{ fontSize: '0.79rem', color: '#b91c1c', fontWeight: 800 }}>{pointage}</TableCell>
                        <TableCell align="center">
                          <Chip
                            label={row.totalRetard || '00:00'}
                            size="small"
                            sx={{ bgcolor: '#fee2e2', color: '#991b1b', fontWeight: 700 }}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={justified ? t('etats.retard.justified') : t('etats.retard.notJustified')}
                            size="small"
                            sx={{
                              bgcolor: justified ? '#064e3b' : '#e2e8f0',
                              color: justified ? '#ecfdf5' : '#334155',
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
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={filteredRows.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              labelRowsPerPage={t('etats.retard.rowsPerPage')}
              sx={{ borderTop: '1px solid #eef2f7' }}
            />
            <Box sx={{ px: 2, py: 1.2, borderTop: '1px solid #eef2f7', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
              <Stack direction="row" spacing={1}>
                <Button size="small" variant="outlined" onClick={exportPdf}>{t('etats.retard.exportPdf')}</Button>
                <Button size="small" variant="outlined" startIcon={<TrendingDown />}>{t('etats.retard.detailsBtn')}</Button>
              </Stack>
            </Box>
          </Paper>
        </Stack>
      </Box>

      <Paper
        sx={{
          width: 340,
          p: 2,
          borderRadius: 2.5,
          border: '1px solid #e7eaf0',
          boxShadow: '0 20px 48px -24px rgba(15,23,42,0.25)',
          height: 'fit-content',
          display: { xs: 'none', xl: 'block' },
        }}
      >
        <Typography sx={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: '1.1rem', mb: 2 }}>{t('etats.retard.detailsTitle')}</Typography>
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
              <Typography sx={{ fontSize: '0.64rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 800 }}>{t('etats.retard.headers.date')}</Typography>
              <Typography sx={{ fontSize: '0.86rem', fontWeight: 700 }}>{formatDateLong(selectedRow.predat)}</Typography>
            </Paper>

            <Paper variant="outlined" sx={{ p: 1.2, borderRadius: 2 }}>
              <Typography sx={{ fontSize: '0.64rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 800, mb: 0.6 }}>{t('etats.retard.punchesRecorded')}</Typography>
              <Stack spacing={0.8}>
                <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: '0.78rem' }}>{t('etats.retard.entryMorning')}</Typography><Typography sx={{ fontSize: '0.78rem', fontWeight: 700 }}>{selectedRow.entree1 || DASH}</Typography></Stack>
                <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: '0.78rem' }}>{t('etats.retard.lateMorning')}</Typography><Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#b91c1c' }}>{selectedRow.preretmateup || '00:00'}</Typography></Stack>
                <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: '0.78rem' }}>{t('etats.retard.entryAfternoon')}</Typography><Typography sx={{ fontSize: '0.78rem', fontWeight: 700 }}>{selectedRow.entree2 || DASH}</Typography></Stack>
                <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: '0.78rem' }}>{t('etats.retard.lateAfternoon')}</Typography><Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#b91c1c' }}>{selectedRow.preretameup || '00:00'}</Typography></Stack>
                <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: '0.78rem' }}>{t('etats.retard.total')}</Typography><Chip size="small" label={selectedRow.totalRetard || '00:00'} sx={{ bgcolor: '#fee2e2', color: '#991b1b', fontWeight: 700 }} /></Stack>
              </Stack>
            </Paper>

            <Stack spacing={1}>
              <Button variant="outlined" fullWidth>{t('etats.retard.justifyAction')}</Button>
              <Button variant="outlined" fullWidth>{t('etats.retard.notifyAction')}</Button>
            </Stack>
          </Stack>
        ) : (
          <Alert severity="info">{t('etats.retard.noSelection')}</Alert>
        )}
      </Paper>
    </Box>
  );
};

export default EmpRetard;
