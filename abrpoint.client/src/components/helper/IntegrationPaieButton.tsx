import React, { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Typography,
  Alert,
  Snackbar,
  Tooltip,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useTranslation } from 'react-i18next';
import * as XLSX from 'xlsx';

// ============================================================================
// TYPES
// ============================================================================

interface RubriquePaireDto {
  rubcod?: string;
  soccod?: string;
  vartype?: string;
  rubunite?: string;
  rubregime?: string;
}

interface PointageMois {
  empCode: string;
  empMat: string;
  heuresSupplementairesResultats?: HeureSupResultat[];
}

interface HeureSupResultat {
  tothre?: number;
  nbJours?: number;
  retard?: number;
  heuresSupTranche1?: number;
  heuresSupTranche2?: number;
  hreSupSemaine?: number;
  hreFerier?: number;
  hreFerieTrv?: number;
  hreFerieTrv2?: number;
  nbJourFerier?: number;
  hreAllaitement?: number;
  absnp?: number;
  totalAbsence?: number;
  nbJourPointer?: number;
  nbNuits?: number;
  nbJourCngPaye?: number;
  nbHeureConge?: number;
  hcsf?: number;
  heuresNormales?: number;
  jourRepos?: number;
  hreNuits?: number;
  heureRepos?: number;
  deplacement?: number;
  act?: number;
  fm?: number;
  absj?: number;
  ct?: number;
  maladie?: number;
  absnj?: number;
  csf?: number;
  css?: number;
  map?: number;
}

interface ExcelRow {
  Matricule: string;
  'Code Rubrique': string;
  Valeur: number;
}

// ============================================================================
// MAPPING CONFIGURATION
// ============================================================================

/**
 * Mapping entre le vartype (code de la rubrique) et la propriété correspondante
 * dans HeureSupResultat qui contient la valeur à exporter
 */
const VARTYPE_TO_PROPERTY_MAP: Record<string, keyof HeureSupResultat> = {
  'T': 'nbJourPointer',      // Jour Trv
  'H': 'tothre',             // Heure Trv
  'J': 'nbJours',            // Jour Complet
  'C': 'nbJourCngPaye',      // Congé A
  'S': 'csf',                // C.S.F
  'F': 'hreFerier',          // Férié
  'R': 'nbJourFerier',       // Jour Férié Travaillé
  'Y': 'hreFerieTrv',        // Heure Férié Travaillé
  'Z': 'hreFerieTrv2',       // Heure Férié Trav. Sup
  'P': 'jourRepos',          // Jour Repos Travaillé
  'D': 'act',                // Accident de travaille
  'A': 'hreAllaitement',     // Allaitement
  'O': 'deplacement',        // Déplacement
  'G': 'deplacement',        // Hébergement (utilise déplacement)
  'U': 'nbNuits',            // Nuit
  '2': 'heuresSupTranche1',  // H.SUPP I (25%)
  '5': 'heuresSupTranche2',  // H.SUPP II (50%)
  '7': 'hreSupSemaine',      // H.SUPP III
  '1': 'hreSupSemaine',      // H.SUPP IV
  'M': 'nbJours',            // Semaine Trv
  'I': 'hreFerier',          // Férié non payé
  'K': 'maladie',            // Maladie
  'V': 'totalAbsence',       // Autorisation de sortie
  '3': 'totalAbsence',       // Heures Abs.
  '4': 'deplacement',        // Prime Panier
  '6': 'map',                // Mise à Pieds
  '8': 'nbJourPointer',      // Prime N.Abs
  '9': 'heuresNormales',     // Prime Qualité
};

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

interface IntegrationPaieProps {
  pointageMoisData: PointageMois[];
  rubriques: RubriquePaireDto[];
  mois: string;
  annee: string;
}

const IntegrationPaieButton: React.FC<IntegrationPaieProps> = ({
  pointageMoisData,
  rubriques,
  mois,
  annee,
}) => {
  const { t } = useTranslation();
  const [openDialog, setOpenDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'warning',
  });

  /**
   * Calcule le total d'une propriété sur toutes les semaines d'un employé
   */
  const calculateTotal = (
    resultats: HeureSupResultat[] | undefined,
    property: keyof HeureSupResultat
  ): number => {
    if (!resultats || resultats.length === 0) return 0;
    
    return resultats.reduce((sum, resultat) => {
      const value = resultat[property];
      return sum + (typeof value === 'number' ? value : 0);
    }, 0);
  };

  /**
   * Détermine la propriété à utiliser selon le vartype et l'unité
   */
  const getPropertyForRubrique = (vartype: string, rubunite?: string): keyof HeureSupResultat | null => {
    // Cas spéciaux selon l'unité
    if (rubunite === 'J') {
      // Si unité est Jour, utiliser les propriétés de nombre de jours
      switch (vartype) {
        case 'P': return 'jourRepos';        // Repos travaillés
        case 'U': return 'nbNuits';          // Nuits
        case 'C': return 'nbJourCngPaye';    // Congé
        case 'F': return 'nbJourFerier';     // Férié
        case 'R': return 'nbJourFerier';     // Férié travaillé
        case 'T': return 'nbJourPointer';    // Nombre de jours
        case 'H': return 'nbJours';          // Heures de jour
        default: break;
      }
    } else {
      // Si unité est Heure, utiliser les propriétés d'heures
      switch (vartype) {
        case 'P': return 'heureRepos';       // Repos travaillés
        case 'U': return 'hreNuits';         // Nuits
        case 'C': return 'nbHeureConge';     // Congé
        case 'F': return 'hreFerier';        // Férié
        case 'R': return 'hreFerieTrv';      // Férié travaillé
        case 'T': return 'tothre';           // Nombre de jours
        case 'H': return 'tothre';           // Heures de jour
        default: break;
      }
    }

    // Pour les autres vartypes, utiliser le mapping standard
    return VARTYPE_TO_PROPERTY_MAP[vartype] || null;
  };

  /**
   * Génère les données à exporter dans Excel
   * Pour chaque employé et chaque rubrique configurée, calcule le total du mois
   */
  const generateExcelData = (): ExcelRow[] => {
    const rows: ExcelRow[] = [];

    pointageMoisData.forEach((emp) => {
      // Pour chaque rubrique configurée dans le système
      rubriques.forEach((rubrique) => {
        if (!rubrique.vartype || !rubrique.rubcod) return;

        // Trouver la propriété correspondante selon vartype et unité
        const property = getPropertyForRubrique(rubrique.vartype, rubrique.rubunite);
        if (!property) {
          console.warn(`Vartype non mappé: ${rubrique.vartype} pour rubrique ${rubrique.rubcod}`);
          return;
        }

        // Calculer le total du mois pour cette propriété
        const valeur = calculateTotal(
          emp.heuresSupplementairesResultats,
          property
        );

        // N'ajouter que si la valeur est > 0 (optimisation)
        if (valeur > 0) {
          rows.push({
            Matricule: emp.empMat,
            'Code Rubrique': rubrique.rubcod,
            // Pas d'arrondi à 2 décimales : on transmet la valeur exacte au moteur
            // de paie (un écart de 0.01 h = 36 secondes peut induire un mismatch
            // payroll). On plafonne à 4 décimales pour absorber le bruit flottant
            // sans tronquer l'information utile.
            Valeur: Number(valeur.toFixed(4)),
          });
        }
      });
    });

    return rows;
  };

  /**
   * Génère et télécharge le fichier Excel
   */
  const handleGenerateExcel = () => {
    setLoading(true);

    try {
      const data = generateExcelData();

      if (data.length === 0) {
        setSnackbar({
          open: true,
          message: 'Aucune donnée à exporter',
          severity: 'warning',
        });
        setLoading(false);
        return;
      }

      // Créer le workbook Excel
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Variables Paie');

      // Définir la largeur des colonnes pour une meilleure lisibilité
      ws['!cols'] = [
        { wch: 12 },  // Matricule
        { wch: 30 },  // Nom et Prénom
        { wch: 15 },  // Code Rubrique
        { wch: 30 },  // Libellé Rubrique
        { wch: 12 },  // Valeur
      ];

      // Générer le nom du fichier
      const fileName = `Integration_Paie_${mois}_${annee}.xlsx`;

      // Télécharger le fichier
      XLSX.writeFile(wb, fileName);

      setSnackbar({
        open: true,
        message: `Fichier généré avec succès : ${data.length} lignes exportées`,
        severity: 'success',
      });

      setOpenDialog(false);
    } catch (error) {
      console.error('Erreur lors de la génération du fichier:', error);
      setSnackbar({
        open: true,
        message: 'Erreur lors de la génération du fichier Excel',
        severity: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  // Aperçu des données pour la dialog
  const previewData = generateExcelData().slice(0, 5);
  const totalRows = generateExcelData().length;

  // Bouton TOUJOURS cliquable : l'utilisateur doit pouvoir ouvrir le dialog,
  // voir l'aperçu et comprendre pourquoi il n'y a éventuellement rien à exporter
  // (rubriques manquantes, pointage non chargé). Auparavant on désactivait sur
  // `!hasRubriques`, ce qui laissait l'utilisateur sans explication ni piste.
  const hasRubriques = Array.isArray(rubriques) && rubriques.length > 0;
  const hasPointage = Array.isArray(pointageMoisData) && pointageMoisData.length > 0;
  const tooltipMsg = !hasRubriques
    ? 'Aucune rubrique paie configurée — cliquez pour voir le détail.'
    : !hasPointage
      ? 'Aucune donnée chargée — cliquez pour voir le détail.'
      : '';

  return (
    <>
      <Tooltip title={tooltipMsg} arrow disableHoverListener={!tooltipMsg}>
        <span>
          <Button
            variant="contained"
            color="primary"
            startIcon={<UploadFileIcon />}
            onClick={() => setOpenDialog(true)}
          >
            Intégrer
          </Button>
        </span>
      </Tooltip>

      <Dialog
        open={openDialog}
        onClose={() => !loading && setOpenDialog(false)}
        maxWidth="md"
        fullWidth
        sx={{
        '& .MuiDialog-container': {
          alignItems: 'center',
        },
        '& .MuiDialog-paper': {
          margin: { xs: 0, sm: '32px' },
          width: { xs: '30%', sm: 'auto' },
          maxWidth: { xs: '50%', sm: '500px' },
        },
      }}
      >
        <DialogTitle>
          Intégration Paie - {mois} {annee}
        </DialogTitle>

        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Ce fichier Excel contiendra les variables de paie (constantes de pointage)
              pour l'intégration dans Sage Paie.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              <strong>{t('i18nFix.integrationPaie.employeesLabel')} :</strong> {pointageMoisData.length}
              <br />
              <strong>{t('i18nFix.integrationPaie.rubriquesLabel')} :</strong> {rubriques.length}
              <br />
              <strong>{t('i18nFix.integrationPaie.linesLabel')} :</strong> {totalRows}
            </Typography>
          </Box>

          {previewData.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Aperçu (5 premières lignes) :
              </Typography>
              <Box
                sx={{
                  maxHeight: 200,
                  overflow: 'auto',
                  border: '1px solid #e0e0e0',
                  borderRadius: 1,
                  p: 1,
                  fontSize: '0.85rem',
                  backgroundColor: '#f9f9f9',
                }}
              >
                {previewData.map((row, idx) => (
                  <Box key={idx} sx={{ mb: 0.5, fontFamily: 'monospace' }}>
                    {row.Matricule} | {row['Code Rubrique']} | {row.Valeur}
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {/* Diagnostic explicite quand l'export est vide : on indique exactement
              quoi corriger pour débloquer l'intégration. */}
          {totalRows === 0 && (
            <Alert severity="info" sx={{ mt: 2 }}>
              {!hasRubriques
                ? 'Aucune rubrique paie n\'est configurée. Rendez-vous dans Données de base → Rubriques pour les définir.'
                : !hasPointage
                  ? 'Aucun pointage n\'est chargé. Lancez une recherche (filtre + bouton Rechercher) pour charger les données du mois.'
                  : 'Aucune valeur > 0 à exporter pour ce mois.'}
            </Alert>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setOpenDialog(false)} disabled={loading}>
            Annuler
          </Button>
          <Button
            onClick={handleGenerateExcel}
            variant="contained"
            color="primary"
            disabled={loading || totalRows === 0}
            startIcon={loading ? <CircularProgress size={20} /> : <UploadFileIcon />}
          >
            {loading ? 'Génération...' : 'Générer Excel'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default IntegrationPaieButton;

// ============================================================================
// UTILISATION DANS PointageDuMois
// ============================================================================

/**
 * Pour intégrer ce composant dans votre PointageDuMoisContent :
 * 
 * 1. Importer le composant et le hook useGetRubriquesPaire :
 * 
 * import IntegrationPaieButton from './IntegrationPaieButton';
 * import useGetRubriquesPaire from '../../../hooks/rubriqueHooks/useGetRubriquesPaire';
 * 
 * 2. Dans PointageDuMoisContent, récupérer les rubriques :
 * 
 * const { data: rubriques = [] } = useGetRubriquesPaire();
 * 
 * 3. Ajouter le bouton dans la Grid, par exemple après le filtre :
 * 
 * <Grid item xs={12} display="flex" justifyContent="space-between" alignItems="center">
 *   <FilterPointageMois />
 *   <IntegrationPaieButton
 *     pointageMoisData={pointageMois}
 *     rubriques={rubriques}
 *     mois={mois}
 *     annee={annee}
 *   />
 * </Grid>
 */