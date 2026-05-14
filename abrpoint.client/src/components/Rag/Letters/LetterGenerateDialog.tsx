import { useEffect, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  RadioGroup,
  Radio,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import DownloadIcon from '@mui/icons-material/Download';
import useGetEmployeesLibs from '../../../hooks/employeHooks/useGetEmployeesLibs';
import { useGenerateLetter } from '../../../hooks/ragHooks/useRagLetters';
import { RagLetterTemplate } from '../../../models/RagLetterTemplate';

interface Props {
  open: boolean;
  template: RagLetterTemplate | null;
  onClose: () => void;
}

export default function LetterGenerateDialog({ open, template, onClose }: Props) {
  const { t } = useTranslation();
  const { data: employeesMap = {} } = useGetEmployeesLibs();
  const generate = useGenerateLetter();

  const [empcod, setEmpcod] = useState<string | null>(null);
  const [polish, setPolish] = useState(false);
  const [format, setFormat] = useState<'docx' | 'pdf'>('docx');
  const [error, setError] = useState<string | null>(null);

  // Le hook renvoie un dict { empcod: 'Nom Prénom' } ; on convertit en options.
  const empOptions = Object.entries(employeesMap as Record<string, string>).map(
    ([code, label]) => ({ code, label }),
  );

  useEffect(() => {
    if (open) {
      setEmpcod(null);
      setPolish(false);
      setFormat('docx');
      setError(null);
    }
  }, [open]);

  const handleGenerate = async () => {
    if (!template || !empcod) return;
    setError(null);
    try {
      const { blob, fileName } = await generate.mutateAsync({
        templateId: template.id,
        empcod,
        polishWithAi: polish,
        format,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || t('rag.letters.generateError'));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {t('rag.letters.generateCta')}
        {template && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {template.name}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Autocomplete
            options={empOptions}
            getOptionLabel={(o) => `${o.label} (${o.code})`}
            value={empOptions.find((o) => o.code === empcod) ?? null}
            onChange={(_, v) => setEmpcod(v?.code ?? null)}
            renderInput={(p) => (
              <TextField {...p} label={t('rag.letters.field.employee')} required />
            )}
          />

          <FormControlLabel
            control={
              <Switch checked={polish} onChange={(_, v) => setPolish(v)} />
            }
            label={t('rag.letters.polishWithAi')}
          />
          {polish && (
            <Typography variant="caption" color="text.secondary">
              {t('rag.letters.polishHint')}
            </Typography>
          )}

          <RadioGroup
            row
            value={format}
            onChange={(_, v) => setFormat(v as 'docx' | 'pdf')}
          >
            <FormControlLabel value="docx" control={<Radio />} label="DOCX" />
            <FormControlLabel value="pdf" control={<Radio />} label="PDF" />
          </RadioGroup>

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('rag.letters.cancel')}</Button>
        <Button
          onClick={handleGenerate}
          variant="contained"
          startIcon={generate.isPending ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
          disabled={!empcod || generate.isPending}
        >
          {t('rag.letters.generateAndDownload')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
