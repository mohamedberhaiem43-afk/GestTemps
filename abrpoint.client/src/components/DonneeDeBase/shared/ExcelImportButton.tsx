import { useRef, useState } from 'react';
import { Button, CircularProgress, Snackbar, Alert } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import * as XLSX from 'xlsx';
import apiInstance from '../../API/apiInstance';

interface ExcelImportButtonProps {
  /** Endpoint relatif (ex: '/BulkImport/services'). */
  endpoint: string;
  /** Champs attendus par row côté backend ; on les extrait du .xlsx en mappant les
   *  noms de colonnes (case insensitive) vers ces clés. */
  columnMap: Record<string, string[]>;
  /** Body extra (ex: { Soccod, Sitcod }) injecté à côté de Rows. */
  extraBody?: Record<string, any>;
  /** Callback après import réussi (pour refetch). */
  onImported?: () => void;
  label?: string;
}

/**
 * Bouton d'import Excel générique. Parse le fichier côté client avec SheetJS, mappe
 * les colonnes et POST le résultat sur l'endpoint indiqué.
 */
export default function ExcelImportButton({
  endpoint, columnMap, extraBody, onImported, label = 'Importer Excel'
}: ExcelImportButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [snack, setSnack] = useState({ open: false, msg: '', sev: 'success' as 'success' | 'error' | 'warning' });

  const handlePick = () => inputRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

      // Mapping insensible à la casse / espaces : pour chaque clé attendue, on cherche
      // la 1ère colonne du fichier dont le nom (lowercased + trimmé) match l'un des alias.
      const rows = json.map((srcRow) => {
        const out: Record<string, any> = {};
        const normalized: Record<string, any> = {};
        Object.keys(srcRow).forEach(k => { normalized[k.trim().toLowerCase()] = srcRow[k]; });
        Object.entries(columnMap).forEach(([targetKey, aliases]) => {
          for (const alias of aliases) {
            const v = normalized[alias.toLowerCase()];
            if (v !== undefined && v !== '') { out[targetKey] = String(v).trim(); break; }
          }
        });
        return out;
      }).filter(r => Object.values(r).some(v => v !== undefined && v !== ''));

      if (rows.length === 0) {
        setSnack({ open: true, msg: 'Aucune ligne valide trouvée dans le fichier.', sev: 'warning' });
        return;
      }

      const { data } = await apiInstance.post(endpoint, { Rows: rows, ...(extraBody || {}) });
      const inserted = data.inserted ?? 0;
      const skipped = data.skipped ?? 0;
      const created = data.created ?? 0;
      let msg = `${inserted} ligne(s) importée(s)`;
      if (skipped) msg += `, ${skipped} ignorée(s)`;
      if (created) msg += `, ${created} entité(s) auto-créée(s)`;
      const errs: string[] = data.errors ?? [];
      setSnack({ open: true, msg: errs.length ? `${msg}. ${errs.length} erreur(s).` : msg, sev: errs.length ? 'warning' : 'success' });
      onImported?.();
    } catch (err: any) {
      setSnack({ open: true, msg: err?.response?.data?.error || 'Erreur lors de l\'import du fichier.', sev: 'error' });
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <>
      <input ref={inputRef} type="file" accept=".xlsx,.xls" hidden onChange={handleFile} />
      <Button
        variant="outlined"
        startIcon={importing ? <CircularProgress size={16} /> : <UploadFileIcon />}
        onClick={handlePick}
        disabled={importing}
        // Mobile : pleine largeur (le label long "Importer Directions (Excel)"
        // débordait sur petits écrans). Desktop : largeur auto.
        sx={{
          borderRadius: '10px',
          textTransform: 'none',
          fontWeight: 600,
          width: { xs: '100%', sm: 'auto' },
          fontSize: { xs: '12px', sm: '13px' },
          whiteSpace: 'nowrap',
          minHeight: 36,
        }}
      >
        {importing ? 'Import…' : label}
      </Button>
      <Snackbar open={snack.open} autoHideDuration={6000} onClose={() => setSnack(s => ({ ...s, open: false }))}>
        <Alert severity={snack.sev} onClose={() => setSnack(s => ({ ...s, open: false }))} sx={{ borderRadius: '10px' }}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </>
  );
}
