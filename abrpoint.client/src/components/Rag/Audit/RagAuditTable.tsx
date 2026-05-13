import { useState } from 'react';
import {
  Box,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import HistoryIcon from '@mui/icons-material/History';
import ThumbUpAltIcon from '@mui/icons-material/ThumbUpAlt';
import ThumbDownAltIcon from '@mui/icons-material/ThumbDownAlt';
import { useAuth } from '../../helper/AuthProvider';
import AccessDenied from '../../helper/AccessDenied';
import { useRagAudit } from '../../../hooks/ragHooks/useRagChat';
function FeedbackBadge({ score }: { score?: number | null }) {
  if (score == null) return <Chip size="small" label="—" variant="outlined" />;
  if (score >= 4) return <Chip size="small" icon={<ThumbUpAltIcon />} color="success" label={score} />;
  if (score <= 2) return <Chip size="small" icon={<ThumbDownAltIcon />} color="error" label={score} />;
  return <Chip size="small" label={score} />;
}

function RagAuditTableContent() {
  const { t, i18n } = useTranslation();
  const { isAdmin } = useAuth();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);

  const skip = page * rowsPerPage;
  const { data, isLoading } = useRagAudit(skip, rowsPerPage);
  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  if (!isAdmin) {
    return <AccessDenied message={t('rag.audit.adminOnly')} />;
  }

  const dateFmt = new Intl.DateTimeFormat(i18n.language === 'fr' ? 'fr-FR' : 'en-US', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1280, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <HistoryIcon color="primary" sx={{ fontSize: 32 }} />
        <Box flex={1}>
          <Typography variant="h5" fontWeight={700}>
            {t('rag.audit.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('rag.audit.subtitle')}
          </Typography>
        </Box>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('rag.audit.col.date')}</TableCell>
              <TableCell>{t('rag.audit.col.user')}</TableCell>
              <TableCell>{t('rag.audit.col.question')}</TableCell>
              <TableCell>{t('rag.audit.col.answer')}</TableCell>
              <TableCell align="right">{t('rag.audit.col.tokens')}</TableCell>
              <TableCell align="right">{t('rag.audit.col.latency')}</TableCell>
              <TableCell align="center">{t('rag.audit.col.feedback')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <CircularProgress size={20} />
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  {t('rag.audit.empty')}
                </TableCell>
              </TableRow>
            ) : (
              items.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{dateFmt.format(new Date(row.createdAt))}</TableCell>
                  <TableCell>{row.uticod ?? '—'}</TableCell>
                  <TableCell sx={{ maxWidth: 280 }}>
                    <Typography variant="body2" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {row.question ?? '—'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 360 }}>
                    <Typography variant="body2" sx={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {row.answer ?? '—'}
                    </Typography>
                    {row.sources && row.sources.length > 0 && (
                      <Typography variant="caption" color="text.secondary">
                        {t('rag.audit.sourceCount', { count: row.sources.length })}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {row.tokensIn ?? '—'} / {row.tokensOut ?? '—'}
                  </TableCell>
                  <TableCell align="right">{row.latencyMs ? `${row.latencyMs} ms` : '—'}</TableCell>
                  <TableCell align="center">
                    <FeedbackBadge score={row.feedbackScore} />
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
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </TableContainer>
    </Box>
  );
}

export default function RagAuditTable() {
  return (
    <RagAuditTableContent />
  );
}
