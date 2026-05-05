import { useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { QueryClient, QueryClientProvider } from 'react-query';
import { useTranslation } from 'react-i18next';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';
import DescriptionIcon from '@mui/icons-material/Description';
import { useAuth } from '../../helper/AuthProvider';
import AccessDenied from '../../helper/AccessDenied';
import {
  useDeleteRagDocument,
  useRagDocuments,
  useRagHealth,
  useReindexRagDocument,
  useUploadRagDocument,
} from '../../../hooks/ragHooks/useRagDocuments';
import RagService from '../../../services/RagService';
import { RagDocument, RagDocumentCategory, RagDocumentStatus } from '../../../models/RagDocument';

const queryClient = new QueryClient();

const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
];

function StatusChip({ status }: { status: RagDocumentStatus }) {
  const { t } = useTranslation();
  const colorMap: Record<RagDocumentStatus, 'default' | 'success' | 'error' | 'warning'> = {
    pending: 'warning',
    indexed: 'success',
    failed: 'error',
  };
  return <Chip size="small" color={colorMap[status]} label={t(`rag.documents.status.${status}`)} />;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentsModernContent() {
  const { t, i18n } = useTranslation();
  const { isAdmin } = useAuth();

  const { data: docs = [], isLoading } = useRagDocuments();
  const { data: health } = useRagHealth();

  const upload = useUploadRagDocument();
  const remove = useDeleteRagDocument();
  const reindex = useReindexRagDocument();

  const [category, setCategory] = useState<RagDocumentCategory>('convention');
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' as 'success' | 'error' });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isAdmin) {
    return <AccessDenied message={t('rag.documents.adminOnly')} />;
  }

  const handlePickFile = () => fileInputRef.current?.click();

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setSnack({ open: true, msg: t('rag.documents.unsupportedType'), sev: 'error' });
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setSnack({ open: true, msg: t('rag.documents.tooLarge'), sev: 'error' });
      return;
    }

    try {
      await upload.mutateAsync({ file, category });
      setSnack({ open: true, msg: t('rag.documents.uploadOk'), sev: 'success' });
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || t('rag.documents.uploadError');
      setSnack({ open: true, msg, sev: 'error' });
    }
  };

  const handleDelete = async (row: RagDocument) => {
    if (!window.confirm(t('rag.documents.deleteConfirm'))) return;
    try {
      await remove.mutateAsync(row.id);
      setSnack({ open: true, msg: t('rag.documents.deletedOk'), sev: 'success' });
    } catch {
      setSnack({ open: true, msg: t('rag.documents.deleteError'), sev: 'error' });
    }
  };

  const handleReindex = async (row: RagDocument) => {
    try {
      await reindex.mutateAsync(row.id);
      setSnack({ open: true, msg: t('rag.documents.reindexQueued'), sev: 'success' });
    } catch {
      setSnack({ open: true, msg: t('rag.documents.reindexError'), sev: 'error' });
    }
  };

  const handleDownload = async (row: RagDocument) => {
    try {
      const blob = await RagService.download(row.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = row.originalName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setSnack({ open: true, msg: t('rag.documents.downloadError'), sev: 'error' });
    }
  };

  const dateFmt = new Intl.DateTimeFormat(i18n.language === 'fr' ? 'fr-FR' : 'en-US', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1280, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <DescriptionIcon color="primary" sx={{ fontSize: 32 }} />
        <Box flex={1}>
          <Typography variant="h5" fontWeight={700}>
            {t('rag.documents.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('rag.documents.subtitle')}
          </Typography>
        </Box>
        {health && (
          <Chip
            size="small"
            color={health.ok ? 'success' : 'warning'}
            label={t(health.ok ? 'rag.documents.healthOk' : 'rag.documents.healthDegraded')}
          />
        )}
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
          <Select
            size="small"
            value={category}
            onChange={(e) => setCategory(e.target.value as RagDocumentCategory)}
            sx={{ minWidth: 220 }}
          >
            <MenuItem value="convention">{t('rag.documents.categories.convention')}</MenuItem>
            <MenuItem value="reglement">{t('rag.documents.categories.reglement')}</MenuItem>
            <MenuItem value="accord">{t('rag.documents.categories.accord')}</MenuItem>
            <MenuItem value="autre">{t('rag.documents.categories.autre')}</MenuItem>
          </Select>
          <Button
            variant="contained"
            startIcon={upload.isLoading ? <CircularProgress size={18} color="inherit" /> : <CloudUploadIcon />}
            onClick={handlePickFile}
            disabled={upload.isLoading}
          >
            {t('rag.documents.uploadCta')}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
            hidden
            onChange={handleFileSelected}
          />
          <Typography variant="caption" color="text.secondary">
            {t('rag.documents.supportedFormats')}
          </Typography>
        </Stack>
      </Paper>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('rag.documents.col.name')}</TableCell>
              <TableCell>{t('rag.documents.col.category')}</TableCell>
              <TableCell align="right">{t('rag.documents.col.size')}</TableCell>
              <TableCell>{t('rag.documents.col.uploadedAt')}</TableCell>
              <TableCell align="center">{t('rag.documents.col.status')}</TableCell>
              <TableCell align="right">{t('rag.documents.col.chunks')}</TableCell>
              <TableCell align="right">{t('rag.documents.col.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <CircularProgress size={20} />
                </TableCell>
              </TableRow>
            ) : docs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ color: 'text.secondary', py: 4 }}>
                  {t('rag.documents.empty')}
                </TableCell>
              </TableRow>
            ) : (
              docs.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {row.originalName}
                    </Typography>
                    {row.errorMessage && (
                      <Typography variant="caption" color="error" sx={{ display: 'block' }}>
                        {row.errorMessage}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{t(`rag.documents.categories.${row.category}`)}</TableCell>
                  <TableCell align="right">{formatBytes(row.sizeBytes)}</TableCell>
                  <TableCell>{dateFmt.format(new Date(row.uploadedAt))}</TableCell>
                  <TableCell align="center">
                    <StatusChip status={row.status} />
                  </TableCell>
                  <TableCell align="right">{row.chunksCount ?? '—'}</TableCell>
                  <TableCell align="right">
                    <Tooltip title={t('rag.documents.actions.download')}>
                      <IconButton size="small" onClick={() => handleDownload(row)}>
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {row.status !== 'pending' && (
                      <Tooltip title={t('rag.documents.actions.reindex')}>
                        <IconButton size="small" onClick={() => handleReindex(row)}>
                          <RefreshIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title={t('rag.documents.actions.delete')}>
                      <IconButton size="small" color="error" onClick={() => handleDelete(row)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Snackbar
        open={snack.open}
        autoHideDuration={3500}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.sev} onClose={() => setSnack((s) => ({ ...s, open: false }))} variant="filled">
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default function DocumentsModern() {
  return (
    <QueryClientProvider client={queryClient}>
      <DocumentsModernContent />
    </QueryClientProvider>
  );
}
