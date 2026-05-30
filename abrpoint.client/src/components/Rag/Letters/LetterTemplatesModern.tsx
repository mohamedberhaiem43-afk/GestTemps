import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import FilePlusIcon from '@mui/icons-material/PostAdd';
import { useAuth } from '../../helper/AuthProvider';
import AccessDenied from '../../helper/AccessDenied';
import {
  useCreateLetterTemplate,
  useDeleteLetterTemplate,
  useLetterTemplates,
  useUpdateLetterTemplate,
} from '../../../hooks/ragHooks/useRagLetters';
import { RagLetterTemplate, RagLetterTemplateUpsert } from '../../../models/RagLetterTemplate';
import LetterGenerateDialog from './LetterGenerateDialog';
const emptyForm: RagLetterTemplateUpsert = {
  name: '',
  description: '',
  bodyHtml: '',
  category: 'autre',
};

function LetterTemplatesModernContent() {
  const { t, i18n } = useTranslation();
  const { isAdmin } = useAuth();

  const { data: templates = [], isLoading } = useLetterTemplates();
  const create = useCreateLetterTemplate();
  const update = useUpdateLetterTemplate();
  const del = useDeleteLetterTemplate();

  const [editing, setEditing] = useState<RagLetterTemplate | null>(null);
  const [form, setForm] = useState<RagLetterTemplateUpsert>(emptyForm);
  const [editorOpen, setEditorOpen] = useState(false);
  const [generateTarget, setGenerateTarget] = useState<RagLetterTemplate | null>(null);
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' as 'success' | 'error' });

  if (!isAdmin) return <AccessDenied message={t('rag.letters.adminOnly')} />;

  const dateFmt = new Intl.DateTimeFormat(i18n.language === 'fr' ? 'fr-FR' : 'en-US', {
    dateStyle: 'short',
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setEditorOpen(true);
  };

  const openEdit = (row: RagLetterTemplate) => {
    setEditing(row);
    setForm({
      name: row.name,
      description: row.description ?? '',
      bodyHtml: row.bodyHtml,
      category: row.category ?? 'autre',
    });
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.bodyHtml.trim()) {
      setSnack({ open: true, msg: t('rag.letters.requiredFields'), sev: 'error' });
      return;
    }
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, req: form });
      } else {
        await create.mutateAsync(form);
      }
      setEditorOpen(false);
      setSnack({ open: true, msg: t('rag.letters.savedOk'), sev: 'success' });
    } catch (err: any) {
      setSnack({
        open: true,
        msg: err?.response?.data?.error || t('rag.letters.saveError'),
        sev: 'error',
      });
    }
  };

  const handleDelete = async (row: RagLetterTemplate) => {
    if (!window.confirm(t('rag.letters.deleteConfirm'))) return;
    try {
      await del.mutateAsync(row.id);
      setSnack({ open: true, msg: t('rag.letters.deletedOk'), sev: 'success' });
    } catch {
      setSnack({ open: true, msg: t('rag.letters.deleteError'), sev: 'error' });
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1280, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <FilePlusIcon color="primary" sx={{ fontSize: 32 }} />
        <Box flex={1}>
          <Typography variant="h5" fontWeight={700}>
            {t('rag.letters.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('rag.letters.subtitle')}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          {t('rag.letters.newTemplate')}
        </Button>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('rag.letters.col.name')}</TableCell>
              <TableCell>{t('rag.letters.col.description')}</TableCell>
              <TableCell>{t('rag.letters.col.placeholders')}</TableCell>
              <TableCell>{t('rag.letters.col.updatedAt')}</TableCell>
              <TableCell align="right">{t('rag.letters.col.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <CircularProgress size={20} />
                </TableCell>
              </TableRow>
            ) : templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  {t('rag.letters.empty')}
                </TableCell>
              </TableRow>
            ) : (
              templates.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>
                      {row.name}
                    </Typography>
                    {row.category && (
                      <Typography variant="caption" color="text.secondary">
                        {row.category}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ maxWidth: 320 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {row.description ?? '—'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 220 }}>
                    <Stack direction="row" gap={0.5} flexWrap="wrap">
                      {row.placeholders.length === 0 && '—'}
                      {row.placeholders.slice(0, 6).map((p) => (
                        <Chip key={p} size="small" label={p} variant="outlined" />
                      ))}
                      {row.placeholders.length > 6 && (
                        <Chip size="small" label={`+${row.placeholders.length - 6}`} />
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    {dateFmt.format(new Date(row.updatedAt ?? row.createdAt))}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title={t('rag.letters.actions.generate')}>
                      <IconButton size="small" color="primary" onClick={() => setGenerateTarget(row)}>
                        <PlayArrowIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('rag.letters.actions.edit')}>
                      <IconButton size="small" onClick={() => openEdit(row)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('rag.letters.actions.delete')}>
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

      {/* Editor */}
      <Dialog open={editorOpen} onClose={() => setEditorOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editing ? t('rag.letters.edit') : t('rag.letters.newTemplate')}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('rag.letters.field.name')}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label={t('rag.letters.field.category')}
              value={form.category ?? ''}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              fullWidth
              size="small"
              placeholder="attestation, avenant, sanction…"
            />
            <TextField
              label={t('rag.letters.field.description')}
              value={form.description ?? ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              fullWidth
              multiline
              minRows={2}
            />
            <TextField
              label={t('rag.letters.field.body')}
              value={form.bodyHtml}
              onChange={(e) => setForm({ ...form, bodyHtml: e.target.value })}
              fullWidth
              required
              multiline
              minRows={10}
              placeholder={t('rag.letters.bodyPlaceholder') as string}
            />
            <Alert severity="info" variant="outlined">
              {t('rag.letters.placeholdersHelp')}
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditorOpen(false)}>{t('rag.letters.cancel')}</Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={create.isPending || update.isPending}
          >
            {t('rag.letters.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Generate */}
      <LetterGenerateDialog
        open={!!generateTarget}
        template={generateTarget}
        onClose={() => setGenerateTarget(null)}
      />

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

export default function LetterTemplatesModern() {
  return (
    <LetterTemplatesModernContent />
  );
}
