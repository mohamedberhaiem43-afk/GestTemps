import { useRef, useState } from 'react';
import { Box, Button, CircularProgress, Tooltip } from '@mui/material';
import { useFeedbackSnackbar } from '../../helper/FeedbackSnackbar';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import * as XLSX from 'xlsx';
import { useNavigate } from 'react-router-dom';
import apiInstance from '../../API/apiInstance';
import { useAuth } from '../../helper/AuthProvider';

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
  /** Optionnel : libellés humains pour les en-têtes du modèle Excel (clé = clé de
   *  columnMap, valeur = libellé affiché). Si absent, on affiche la clé brute (ex
   *  « Empcod ») qui est techniquement le nom DB et reste illisible. Les libellés
   *  fournis doivent figurer dans les alias de columnMap (sinon le ré-upload ne
   *  matcherait pas la colonne). Le matching à l'import reste insensible à la casse. */
  labelMap?: Record<string, string>;
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
  templateFileName, templateExample, labelMap,
}: ExcelImportButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const feedback = useFeedbackSnackbar();
  const navigate = useNavigate();
  // Gate plan : l'import en masse Excel est réservé Standard/Premium. On garde le
  // composant monté sur Starter (téléchargement du modèle reste utile en avant-vente),
  // mais le bouton « Importer » devient un CTA d'upgrade vers /upgrade?feature=BulkImport.
  const { planAllows, planFeatures } = useAuth();
  // Pendant que /me est en vol, planFeatures est null → on neutralise l'import
  // pour éviter d'envoyer une requête qui sera rejetée par un 402. Une fois /me
  // résolu, planAllows() renvoie true/false selon le plan réel.
  const importAllowed = planFeatures === null ? false : planAllows('bulkImport');

  const handlePick = () => {
    if (!importAllowed) {
      // Redirige vers la page d'upgrade avec la feature pré-remplie. PlanUpgradePage
      // lit `feature` depuis location.state ou ?feature=… pour proposer Standard.
      navigate('/upgrade', {
        state: { feature: 'BulkImport', currentPlan: undefined, from: window.location.pathname },
      });
      return;
    }
    inputRef.current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];

      // Lecture en mode `header: 1` (array-of-arrays) plutôt que le mode objet
      // par défaut. Pourquoi : le mode objet repose sur la propriété `!ref` de
      // la feuille pour borner la lecture, or certains éditeurs (Google Sheets
      // export, LibreOffice anciennes versions, sauvegardes via XLSX.writeFile
      // d'un modèle initialement vide) n'étendent pas `!ref` quand l'utilisateur
      // ajoute des lignes — résultat : seule la première ligne de données était
      // remontée et le reste était silencieusement ignoré. `header: 1` itère sur
      // toutes les lignes effectivement présentes dans la feuille indépendamment
      // de `!ref`.
      const aoa = XLSX.utils.sheet_to_json<any[]>(sheet, {
        header: 1,
        defval: '',
        blankrows: false,
        raw: false, // formate dates / nombres en chaînes lisibles
      });

      if (aoa.length < 2) {
        feedback.showWarning('Le fichier ne contient pas de données — uniquement la ligne d\'en-tête.');
        return;
      }

      const headerRow = (aoa[0] ?? []).map((h) => String(h ?? '').trim().toLowerCase());
      // Pré-calcule l'index de colonne pour chaque alias attendu — évite de
      // refaire `indexOf` à chaque ligne (perf sur gros imports).
      const colIndex: Record<string, number> = {};
      Object.entries(columnMap).forEach(([targetKey, aliases]) => {
        for (const alias of aliases) {
          const idx = headerRow.indexOf(alias.toLowerCase());
          if (idx >= 0) { colIndex[targetKey] = idx; break; }
        }
      });

      const rows = aoa.slice(1).map((arr) => {
        const out: Record<string, any> = {};
        Object.entries(colIndex).forEach(([targetKey, idx]) => {
          const v = arr[idx];
          if (v !== undefined && v !== null && v !== '') {
            out[targetKey] = String(v).trim();
          }
        });
        return out;
      }).filter(r => Object.values(r).some(v => v !== undefined && v !== ''));

      if (rows.length === 0) {
        feedback.showWarning('Aucune ligne valide trouvée. Vérifiez que les en-têtes correspondent au modèle.');
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
      const keys = Object.keys(columnMap);
      if (keys.length === 0) {
        feedback.showWarning('Aucune colonne définie pour le modèle.');
        return;
      }
      // En-têtes affichés : libellés humains (labelMap) si fournis, sinon la
      // clé brute (ex « Empcod »). Les libellés DOIVENT figurer dans les alias
      // de columnMap pour que le ré-upload retrouve la colonne (matching
      // insensible à la casse, déjà géré dans handleFile).
      const displayHeaders = keys.map(k => labelMap?.[k] ?? k);

      // Construction explicite en array-of-arrays via aoa_to_sheet — garantit
      // que `!ref` couvre exactement (entêtes + exemple) au lieu de pouvoir
      // rester à A1:A1 sur un appel json_to_sheet([]) (cause de la régression
      // « seule la 1ère ligne est importée »).
      const aoa: any[][] = [displayHeaders];
      if (templateExample) {
        aoa.push(keys.map(k => templateExample[k] ?? ''));
      }
      const sheet = XLSX.utils.aoa_to_sheet(aoa);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet, 'Modèle');

      // Largeur de colonnes approximative basée sur la longueur du libellé
      // affiché. Sans ça, les colonnes type « Date d'embauche » sont compressées
      // à ~10 chars dans Excel et l'utilisateur ne voit pas l'en-tête en entier.
      sheet['!cols'] = displayHeaders.map(h => ({ wch: Math.max(14, h.length + 4) }));

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
        <Tooltip
          title={importAllowed ? '' : "L'import en masse Excel est inclus dès le pack Standard. Cliquez pour découvrir les options de mise à niveau."}
          arrow
        >
          <Button
            variant="outlined"
            startIcon={
              importing
                ? <CircularProgress size={16} />
                : importAllowed
                  ? <UploadFileIcon />
                  : <LockOutlinedIcon />
            }
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
              ...(importAllowed ? {} : {
                // Style "verrouillé" : on garde le bouton cliquable (CTA vers /upgrade)
                // mais visuellement neutralisé pour signaler que la feature est payante.
                color: '#94a3b8',
                borderColor: '#e2e8f0',
                background: '#f8fafc',
              }),
            }}
          >
            {importing ? 'Import…' : label}
          </Button>
        </Tooltip>
      </Box>
      {feedback.element}
    </>
  );
}
