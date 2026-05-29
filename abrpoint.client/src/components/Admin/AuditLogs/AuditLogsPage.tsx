import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/History';
import RefreshIcon from '@mui/icons-material/Refresh';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import DownloadIcon from '@mui/icons-material/FileUpload';
import SearchIcon from '@mui/icons-material/Search';
import { useTranslation } from 'react-i18next';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useAuth } from '../../helper/AuthProvider';
import AccessDenied from '../../helper/AccessDenied';
import { AuditLogsApi, AuditLogRow } from './auditLogsApi';

// Couleurs des chips Action — on garde une palette stable pour faciliter le scan
// visuel : vert pour Added, orange pour Modified, rouge pour Deleted, gris pour
// le reste (TrustReport, libellés ad-hoc).
function actionChipColor(action: string | null): 'default' | 'success' | 'warning' | 'error' | 'info' {
  if (!action) return 'default';
  const a = action.toLowerCase();
  if (a.startsWith('added')) return 'success';
  if (a.startsWith('modified')) return 'warning';
  if (a.startsWith('deleted')) return 'error';
  if (a.startsWith('trust')) return 'info';
  return 'default';
}

// 2026-05-23 — Demande UX : ne plus afficher le nom technique de table
// (`employes`, `conges`, `utilisateurs`…) dans la colonne « Description »,
// ni les codes d'action brute (« Added », « Modified »…). À la place, on
// affiche une phrase courte en français lisible pour le métier.
//
// On garde le couple (action, table) en source de vérité côté backend ; ce
// mapping reste un détail de présentation, sans contrat avec l'API. Si un
// nom de table n'est pas mappé, on retombe sur l'action brute pour rester
// informatif (jamais d'écran vide).
const TABLE_LABELS: Record<string, string> = {
  employes: 'collaborateur',
  utilisateurs: 'utilisateur',
  conges: 'congé',
  demconge: 'demande de congé',
  contrats: 'contrat',
  societes: 'société',
  sites: 'site',
  filiale: 'filiale',
  services: 'service',
  fonctions: 'fonction',
  presences: 'pointage',
  pointage: 'pointage',
  notedefrais: 'note de frais',
  noteDeFrais: 'note de frais',
  missions: 'mission',
  teletravail: 'demande de télétravail',
  demande_absence: "demande d'absence",
  autoriser: "demande d'autorisation",
  documents: 'document',
  vault_document: 'document du coffre',
  refresh_token: 'session',
  known_devices: 'appareil de confiance',
  notifications: 'notification',
};

function actionVerb(action: string | null): string | null {
  if (!action) return null;
  const a = action.toLowerCase();
  if (a.startsWith('added'))    return 'ajout';
  if (a.startsWith('modified')) return 'modification';
  if (a.startsWith('deleted'))  return 'suppression';
  if (a.startsWith('trust'))    return 'audit appareil';
  return null;
}

function describeAction(action: string | null, tableName: string | null): string {
  // Format produit attendu (cf. demande métier 2026-05-24) : phrase courte
  // tout en bas-de-casse façon "suppression employé", "ajout congé", etc.
  // Avant : on rendait `${verb} : ${label}` mais avec verb = OBJET (cf. bug
  // ancien `return ${verb} : ${label}` qui sortait "[object Object] : employé").
  // Maintenant : actionVerb retourne directement une string + on supprime les
  // deux-points pour une lecture plus naturelle dans la liste d'audit.
  const verb = actionVerb(action);
  const tableKey = (tableName ?? '').toLowerCase().trim();
  const label = TABLE_LABELS[tableKey];
  if (verb && label) return `${verb} ${label}`;
  // Fallback : action brute pour ne jamais laisser un écran vide quand une
  // nouvelle table apparaît sans entrée dans TABLE_LABELS.
  if (verb && !label) return verb;
  if (action) return action;
  return '—';
}

function toCsv(rows: AuditLogRow[]): string {
  // Export aligné sur les colonnes affichées : on remplace « Action » + « Table »
  // par la même description courte que l'UI (cf. describeAction).
  const header = ['Date', 'Uticod', 'Utilisateur', 'Description', 'IP'];
  const escape = (v: string | null | undefined) => {
    const s = (v ?? '').toString();
    if (s.includes('"') || s.includes(',') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = rows.map((r) =>
    [
      new Date(r.dateAction).toISOString(),
      r.uticod,
      r.userDisplay,
      describeAction(r.action, r.tableName),
      r.ipAddress,
    ]
      .map(escape)
      .join(','),
  );
  return [header.join(','), ...lines].join('\n');
}

export default function AuditLogsPage() {
  const { t, i18n } = useTranslation();
  const { isAdmin, isManager } = useAuth();
  const allowed = isAdmin || isManager;

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  // Filtres « en cours d'édition » vs « appliqués » : le bouton Rechercher copie
  // les premiers dans les seconds, ce qui évite de re-fetcher à chaque keystroke.
  const [draftFilters, setDraftFilters] = useState({
    from: '',
    to: '',
    uticod: '',
    action: '',
    table: '',
    ip: '',
    search: '',
  });
  const [filters, setFilters] = useState(draftFilters);

  const params = useMemo(
    () => ({
      ...filters,
      from: filters.from ? new Date(filters.from).toISOString() : undefined,
      to: filters.to ? new Date(filters.to).toISOString() : undefined,
      skip: page * rowsPerPage,
      take: rowsPerPage,
    }),
    [filters, page, rowsPerPage],
  );

  const { data, isFetching, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'audit-logs', params],
    queryFn: () => AuditLogsApi.list(params),
    placeholderData: keepPreviousData,
    enabled: allowed,
  });

  const { data: facets } = useQuery({
    queryKey: ['admin', 'audit-logs', 'facets'],
    queryFn: () => AuditLogsApi.facets(),
    enabled: allowed,
    staleTime: 5 * 60_000,
  });

  if (!allowed) {
    return <AccessDenied message={t('auditLogs.adminOnly', "Accès réservé aux administrateurs et managers.")} />;
  }

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const dateFmt = new Intl.DateTimeFormat(i18n.language === 'fr' ? 'fr-FR' : 'en-US', {
    dateStyle: 'short',
    timeStyle: 'medium',
  });

  const applyFilters = () => {
    setPage(0);
    setFilters(draftFilters);
  };

  const resetFilters = () => {
    const cleared = { from: '', to: '', uticod: '', action: '', table: '', ip: '', search: '' };
    setDraftFilters(cleared);
    setFilters(cleared);
    setPage(0);
  };

  const exportCsv = () => {
    if (items.length === 0) return;
    const csv = toCsv(items);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <HistoryIcon color="primary" sx={{ fontSize: 32 }} />
        <Box flex={1}>
          <Typography variant="h5" fontWeight={700}>
            {t('auditLogs.title', "Journaux d'audit")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('auditLogs.subtitle', 'Traçabilité des actions effectuées sur la base de données.')}
          </Typography>
        </Box>
        <Tooltip title={t('auditLogs.refresh', 'Actualiser')}>
          <span>
            <IconButton onClick={() => refetch()} disabled={isFetching}>
              <RefreshIcon />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={t('auditLogs.export', 'Exporter la page (CSV)')}>
          <span>
            <IconButton onClick={exportCsv} disabled={items.length === 0}>
              <DownloadIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'stretch', md: 'flex-end' }}
          flexWrap="wrap"
          useFlexGap
        >
          <TextField
            size="small"
            type="datetime-local"
            label={t('auditLogs.from', 'Du')}
            InputLabelProps={{ shrink: true }}
            value={draftFilters.from}
            onChange={(e) => setDraftFilters((f) => ({ ...f, from: e.target.value }))}
            sx={{ minWidth: 200 }}
          />
          <TextField
            size="small"
            type="datetime-local"
            label={t('auditLogs.to', 'Au')}
            InputLabelProps={{ shrink: true }}
            value={draftFilters.to}
            onChange={(e) => setDraftFilters((f) => ({ ...f, to: e.target.value }))}
            sx={{ minWidth: 200 }}
          />
          <TextField
            size="small"
            label={t('auditLogs.user', 'Utilisateur (uticod)')}
            value={draftFilters.uticod}
            onChange={(e) => setDraftFilters((f) => ({ ...f, uticod: e.target.value }))}
            sx={{ minWidth: 160 }}
          />
          <TextField
            size="small"
            select
            label={t('auditLogs.action', 'Action')}
            value={draftFilters.action}
            onChange={(e) => setDraftFilters((f) => ({ ...f, action: e.target.value }))}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">{t('auditLogs.all', 'Toutes')}</MenuItem>
            {(facets?.actions ?? []).map((a) => (
              <MenuItem key={a} value={a}>{a}</MenuItem>
            ))}
          </TextField>
          {/* Filtre « Table » retiré 2026-05-23 : l'utilisateur final n'a pas
              à voir les noms de tables techniques. La description suffit pour
              filtrer mentalement, et la recherche libre couvre les besoins
              avancés. Le champ `table` reste dans le state pour compat URL/CSV
              mais n'est plus présent dans l'UI. */}
          <TextField
            size="small"
            label={t('auditLogs.ip', 'Adresse IP')}
            value={draftFilters.ip}
            onChange={(e) => setDraftFilters((f) => ({ ...f, ip: e.target.value }))}
            sx={{ minWidth: 160 }}
          />
          <TextField
            size="small"
            label={t('auditLogs.search', 'Recherche libre')}
            value={draftFilters.search}
            onChange={(e) => setDraftFilters((f) => ({ ...f, search: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') applyFilters(); }}
            sx={{ minWidth: 200, flex: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={applyFilters}>
              {t('auditLogs.apply', 'Rechercher')}
            </Button>
            <Tooltip title={t('auditLogs.reset', 'Réinitialiser')}>
              <IconButton onClick={resetFilters}>
                <FilterAltOffIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('auditLogs.col.date', 'Date')}</TableCell>
              <TableCell>{t('auditLogs.col.user', 'Utilisateur')}</TableCell>
              {/* Colonnes « Action » et « Table » fusionnées en une description
                  courte lisible métier (2026-05-23). */}
              <TableCell>{t('auditLogs.col.description', 'Description')}</TableCell>
              <TableCell>{t('auditLogs.col.ip', 'Adresse IP')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={20} />
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  {t('auditLogs.empty', 'Aucun journal trouvé pour ces critères.')}
                </TableCell>
              </TableRow>
            ) : (
              items.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {dateFmt.format(new Date(row.dateAction))}
                  </TableCell>
                  <TableCell>
                    {row.userDisplay ?? row.uticod ?? '—'}
                    {row.userDisplay && row.uticod && row.userDisplay !== row.uticod && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {row.uticod}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={describeAction(row.action, row.tableName)}
                      color={actionChipColor(row.action)}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                    {row.ipAddress ?? '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50, 100, 200]}
          labelRowsPerPage={t('auditLogs.rowsPerPage', 'Lignes par page')}
        />
      </TableContainer>
    </Box>
  );
}
