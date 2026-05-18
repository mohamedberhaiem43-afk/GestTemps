import { useRef, useState } from 'react';
import { Box, Button, CircularProgress } from '@mui/material';
import { useFeedbackSnackbar } from '../../helper/FeedbackSnackbar';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
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
  /** Nom du fichier modèle téléchargé. Par défaut dérivé de l'endpoint
   *  (ex: '/BulkImport/fonctions' → 'modele-fonctions.xlsx'). */
  templateFileName?: string;
  /** Optionnel : une ligne d'exemple (clés = clés de columnMap, valeurs = échantillon)
   *  pour montrer à l'utilisateur le format attendu. La ligne reste éditable
   *  ou supprimable dans Excel. */
  templateExample?: Record<string, string | number>;
}

/**
 * Bouton d'import Excel générique. Parse le fichier côté client avec SheetJS, mappe
 * les colonnes et POST le résultat sur l'endpoint indiqué.
 *
 * Inclut aussi un bouton « Modèle » qui télécharge un .xlsx vierge avec les
 * en-têtes attendues pré-remplies — l'utilisateur n'a plus à deviner la
 * structure et la collision noms de colonnes / aliases est évitée.
 */
export default function ExcelImportButton({
  endpoint, columnMap, extraBody, onImported, label = 'Importer Excel',
  templateFileName, templateExample,
}: ExcelImportButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const feedback = useFeedbackSnackbar();

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
        feedback.showWarning('Aucune ligne valide enregistrée dans le fichier.');
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
      if (errs.length) feedback.showWarning(`${msg}. ${errs.length} erreur(s).`);
      else feedback.showSuccess(msg);
      onImported?.();
    } catch (err) {
      feedback.showError(err, "Erreur lors de l'import du fichier.");
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDownloadTemplate = () => {
    try {
      const headers = Object.keys(columnMap);
      if (headers.length === 0) {
        feedback.showWarning('Aucune colonne définie pour le modèle.');
        return;
      }
      // Une seule ligne : la ligne d'en-tête. Si templateExample est fourni,
      // on ajoute une ligne d'exemple pour aider à la saisie.
      const rows: Record<string, any>[] = templateExample
        ? [headers.reduce<Record<string, any>>((acc, h) => {
            acc[h] = templateExample[h] ?? '';
            return acc;
          }, {})]
        : [];
      const sheet = XLSX.utils.json_to_sheet(rows, { header: headers });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet, 'Modèle');

      // Largeur de colonnes approximative basée sur la longueur de l'en-tête.
      // Sans ça, les colonnes "Empemail" ou "Empadr" sont compressées à 8 chars
      // dans Excel et l'utilisateur ne voit pas l'en-tête en entier.
      sheet['!cols'] = headers.map(h => ({ wch: Math.max(12, h.length + 4) }));

      // Nom du fichier : préfixe "modele-" + dernier segment de l'endpoint si pas
      // de templateFileName explicite. '/BulkImport/fonctions' → 'modele-fonctions.xlsx'.
      const fallback = `modele-${endpoint.split('/').filter(Boolean).pop() || 'import'}.xlsx`;
      XLSX.writeFile(wb, templateFileName || fallback);
      feedback.showSuccess('Modèle téléchargé.');
    } catch (err) {
      feedback.showError(err, 'Erreur lors de la génération du modèle.');
    }
  };

  return (
    <>
      <input ref={inputRef} type="file" accept=".xlsx,.xls" hidden onChange={handleFile} />
      <Box sx={{ display: 'flex', gap: 1, width: { xs: '100%', sm: 'auto' }, flexWrap: 'wrap' }}>
        <Button
          variant="text"
          startIcon={<DownloadIcon />}
          onClick={handleDownloadTemplate}
          // Le bouton modèle est secondaire (variant text) : il ne doit pas
          // détourner l'attention du bouton d'import principal, mais il doit
          // être visible pour les utilisateurs qui découvrent le format.
          sx={{
            borderRadius: '10px',
            textTransform: 'none',
            fontWeight: 600,
            color: '#0040a1',
            fontSize: { xs: '12px', sm: '13px' },
            whiteSpace: 'nowrap',
            minHeight: 36,
            flex: { xs: 1, sm: 'unset' },
          }}
        >
          Modèle
        </Button>
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
            flex: { xs: 1, sm: 'unset' },
            fontSize: { xs: '12px', sm: '13px' },
            whiteSpace: 'nowrap',
            minHeight: 36,
          }}
        >
          {importing ? 'Import…' : label}
        </Button>
      </Box>
      {feedback.element}
    </>
  );
}
