import { useState, useMemo } from 'react';
import { Box, Typography, Button, Collapse, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress } from '@mui/material';
import { useFeedbackSnackbar } from '../../helper/FeedbackSnackbar';
import SaveIcon from '@mui/icons-material/Save';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import SearchIcon from '@mui/icons-material/Search';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CloseIcon from '@mui/icons-material/Close';
import LibraryAddIcon from '@mui/icons-material/LibraryAdd';
import { useTranslation } from 'react-i18next';
import useGetRubriques from '../../../hooks/rubriqueHooks/useGetRubriques';
import useAddRubrique from '../../../hooks/rubriqueHooks/useAddRubrique';
import useUpdateRubrique from '../../../hooks/rubriqueHooks/useUpdateRubrique';
import useDeleteRubrique from '../../../hooks/rubriqueHooks/useDeleteRubrique';
import { Rubrique } from '../../../models/Rubrique';
import { useAuth } from '../../helper/AuthProvider';
import AccessDenied from '../../helper/AccessDenied';
import ExcelImportButton from '../shared/ExcelImportButton';
import apiInstance from '../../API/apiInstance';
import '../shared/RefModern.css';

const emptyForm: Rubrique = { rubcod: '', soccod: '', rubunite: '', rublib: '', rubtaux: 0, rubregime: '', vartype: '' };

// Codes vartype attendus par l'export "Intégration Paie" (cf. IntegrationPaieButton.tsx).
// Chaque entrée pointe vers la grandeur calculée par le moteur de pointage. C'est CETTE
// liste qui doit être visible dans le formulaire — sinon les rubriques sauvegardées ne
// génèrent aucune ligne dans l'export Excel et l'utilisateur voit "Lignes à exporter : 0".
const VARTYPE_OPTIONS: Array<{ code: string; label: string; group: string }> = [
  { code: 'T', label: 'T — Jours travaillés (présence)', group: 'Temps de travail' },
  { code: 'H', label: 'H — Heures travaillées totales', group: 'Temps de travail' },
  { code: 'J', label: 'J — Jours complets (semaine)', group: 'Temps de travail' },
  { code: 'M', label: 'M — Semaines travaillées', group: 'Temps de travail' },
  { code: '2', label: '2 — Heures supplémentaires 25%', group: 'Heures supplémentaires' },
  { code: '5', label: '5 — Heures supplémentaires 50%', group: 'Heures supplémentaires' },
  { code: '7', label: '7 — Heures supplémentaires (cumul semaine)', group: 'Heures supplémentaires' },
  { code: '1', label: '1 — Heures supplémentaires (autre tranche)', group: 'Heures supplémentaires' },
  { code: 'F', label: 'F — Jours / heures fériés', group: 'Fériés / Repos' },
  { code: 'R', label: 'R — Jours fériés travaillés', group: 'Fériés / Repos' },
  { code: 'Y', label: 'Y — Heures fériées travaillées', group: 'Fériés / Repos' },
  { code: 'Z', label: 'Z — Heures fériées sup. travaillées', group: 'Fériés / Repos' },
  { code: 'I', label: 'I — Férié non payé', group: 'Fériés / Repos' },
  { code: 'P', label: 'P — Repos travaillés', group: 'Fériés / Repos' },
  { code: 'U', label: 'U — Nuits / heures de nuit', group: 'Fériés / Repos' },
  { code: 'C', label: 'C — Congés payés', group: 'Absences' },
  { code: 'K', label: 'K — Maladie', group: 'Absences' },
  { code: 'V', label: 'V — Autorisations de sortie', group: 'Absences' },
  { code: '3', label: '3 — Heures d\'absence', group: 'Absences' },
  { code: '6', label: '6 — Mise à pied', group: 'Absences' },
  { code: 'A', label: 'A — Allaitement', group: 'Absences' },
  { code: 'D', label: 'D — Accident de travail', group: 'Absences' },
  { code: 'S', label: 'S — Complément social familial (CSF)', group: 'Primes / Compléments' },
  { code: 'O', label: 'O — Déplacement', group: 'Primes / Compléments' },
  { code: 'G', label: 'G — Hébergement', group: 'Primes / Compléments' },
  { code: '4', label: '4 — Prime panier', group: 'Primes / Compléments' },
  { code: '8', label: '8 — Prime non-absence', group: 'Primes / Compléments' },
  { code: '9', label: '9 — Prime qualité (heures normales)', group: 'Primes / Compléments' },
];

// Catalogue par défaut — couvre les colonnes du Pointage du mois / état périodique
// (Nb. Heures, HS25, HS50, J. Fériés, Congé, Maladie, MAP, Panier, etc.). Chaque entrée
// est mappée vers le vartype consommé par l'export "Intégration Paie". L'import passe par
// /BulkImport/rubriques qui dédoublonne sur Rubcod ET Rublib — appelable plusieurs fois
// sans risque (les rubriques déjà saisies sont ignorées, pas écrasées).
const DEFAULT_RUBRIQUES_CATALOG: Array<{ rubcod: string; rublib: string; rubunite: 'H' | 'J'; vartype: string }> = [
  // Temps de travail
  { rubcod: 'NBH',   rublib: 'Nb. Heures',                  rubunite: 'H', vartype: 'H' },
  { rubcod: 'NBJ',   rublib: 'Nb. Jours',                   rubunite: 'J', vartype: 'J' },
  { rubcod: 'JPT',   rublib: 'J. Pointés',                  rubunite: 'J', vartype: 'T' },
  { rubcod: 'HN',    rublib: 'H. Normales',                 rubunite: 'H', vartype: '9' },
  // Heures supplémentaires
  { rubcod: 'HS25',  rublib: 'Heures supp. 25%',            rubunite: 'H', vartype: '2' },
  { rubcod: 'HS50',  rublib: 'Heures supp. 50%',            rubunite: 'H', vartype: '5' },
  { rubcod: 'HS',    rublib: 'Heures supp. cumul semaine',  rubunite: 'H', vartype: '7' },
  { rubcod: 'HS1',   rublib: 'Heures supp. tranche 1',      rubunite: 'H', vartype: '1' },
  // Fériés / Repos
  { rubcod: 'JF',    rublib: 'J. Fériés',                   rubunite: 'J', vartype: 'F' },
  { rubcod: 'HF',    rublib: 'H. Fériés',                   rubunite: 'H', vartype: 'F' },
  { rubcod: 'JFT',   rublib: 'J. Fériés travaillés',        rubunite: 'J', vartype: 'R' },
  { rubcod: 'HFT',   rublib: 'H. Fériés travaillées',       rubunite: 'H', vartype: 'Y' },
  { rubcod: 'HFTS',  rublib: 'H. Fériés sup. travaillées',  rubunite: 'H', vartype: 'Z' },
  { rubcod: 'FNP',   rublib: 'Férié non payé',              rubunite: 'J', vartype: 'I' },
  { rubcod: 'JREP',  rublib: 'J. Repos travaillés',         rubunite: 'J', vartype: 'P' },
  { rubcod: 'HNUI',  rublib: 'H. Nuits',                    rubunite: 'H', vartype: 'U' },
  // Absences
  { rubcod: 'CP',    rublib: 'Congé payé',                  rubunite: 'J', vartype: 'C' },
  { rubcod: 'MAL',   rublib: 'Maladie',                     rubunite: 'J', vartype: 'K' },
  { rubcod: 'AUTS',  rublib: 'Autorisation de sortie',      rubunite: 'H', vartype: 'V' },
  { rubcod: 'HABS',  rublib: 'H. Absences',                 rubunite: 'H', vartype: '3' },
  { rubcod: 'MAP',   rublib: 'Mise à pied',                 rubunite: 'J', vartype: '6' },
  { rubcod: 'ALL',   rublib: 'Allaitement',                 rubunite: 'H', vartype: 'A' },
  { rubcod: 'ACT',   rublib: 'Accident de travail',         rubunite: 'J', vartype: 'D' },
  // Primes / Compléments
  { rubcod: 'CSF',   rublib: 'Compl. social familial',      rubunite: 'H', vartype: 'S' },
  { rubcod: 'DEPL',  rublib: 'Déplacement',                 rubunite: 'J', vartype: 'O' },
  { rubcod: 'HEB',   rublib: 'Hébergement',                 rubunite: 'J', vartype: 'G' },
  { rubcod: 'PAN',   rublib: 'Prime panier',                rubunite: 'J', vartype: '4' },
  { rubcod: 'PNA',   rublib: 'Prime non-absence',           rubunite: 'J', vartype: '8' },
];

function RubriqueModernContent() {
  const { t } = useTranslation();
  const { soccod, hasPermission } = useAuth();
  const [form, setForm] = useState<Rubrique>({ ...emptyForm, soccod: soccod || '' });
  const feedback = useFeedbackSnackbar();
  const [search, setSearch] = useState('');
  const [showGuide, setShowGuide] = useState(true);
  const [defaultsOpen, setDefaultsOpen] = useState(false);
  const [importingDefaults, setImportingDefaults] = useState(false);

  const { data: rubriques = [], refetch, isLoading } = useGetRubriques();
  const { mutate: addRub } = useAddRubrique();
  const { mutate: updateRub } = useUpdateRubrique();
  const { mutate: deleteRub } = useDeleteRubrique();

  const isEditMode = form.rubcod !== '' && rubriques.some(r => r.rubcod === form.rubcod);

  const canAdd = hasPermission('Données de Base', 'add');
  const canModify = hasPermission('Données de Base', 'modify');
  const canDelete = hasPermission('Données de Base', 'delete');

  if (!hasPermission('Données de Base', 'consult')) {
    return <AccessDenied message={t('donneeBase.rubrique.noConsultRight')} />;
  }

  const filtered = useMemo(() => {
    if (!search) return rubriques;
    const q = search.toLowerCase();
    return rubriques.filter(r => r.rubcod.toLowerCase().includes(q) || r.rublib.toLowerCase().includes(q));
  }, [rubriques, search]);

  const handleSubmit = () => {
    if (!form.rubcod || !form.rublib) {
      feedback.showError(t('donneeBase.rubrique.codeRequired'));
      return;
    }
    const payload = { ...form, soccod: soccod || '' };
    const onSuccess = () => {
      feedback.showSuccess(isEditMode ? t('donneeBase.rubrique.msgUpdated') : t('donneeBase.rubrique.msgAdded'));
      setForm({ ...emptyForm, soccod: soccod || '' });
      refetch();
    };
    const onError = (err: any) => feedback.showError(err, t('donneeBase.common.saveError'));
    if (isEditMode) { updateRub(payload, { onSuccess, onError }); } else { addRub(payload, { onSuccess, onError }); }
  };

  const handleEdit = (row: Rubrique) => { setForm(row); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const handleDelete = (row: Rubrique) => {
    if (window.confirm(t('donneeBase.rubrique.deleteConfirm'))) {
      deleteRub({ rubcod: row.rubcod }, { onSuccess: () => refetch() });
    }
  };

  // Pré-calcule, pour la dialogue, ce qui sera réellement importé en regardant ce qui
  // existe déjà côté serveur (même règle de dédoublonnage que /BulkImport/rubriques :
  // Rubcod insensible à la casse OU Rublib insensible à la casse).
  const existingCodesUpper = useMemo(
    () => new Set(rubriques.map(r => (r.rubcod || '').trim().toUpperCase()).filter(Boolean)),
    [rubriques],
  );
  const existingLibsLower = useMemo(
    () => new Set(rubriques.map(r => (r.rublib || '').trim().toLowerCase()).filter(Boolean)),
    [rubriques],
  );
  const defaultsPreview = useMemo(
    () => DEFAULT_RUBRIQUES_CATALOG.map(r => ({
      ...r,
      alreadyExists:
        existingCodesUpper.has(r.rubcod.toUpperCase()) ||
        existingLibsLower.has(r.rublib.toLowerCase()),
    })),
    [existingCodesUpper, existingLibsLower],
  );
  const toImportCount = defaultsPreview.filter(r => !r.alreadyExists).length;

  const handleImportDefaults = async () => {
    setImportingDefaults(true);
    try {
      const { data } = await apiInstance.post('/BulkImport/rubriques', {
        Rows: DEFAULT_RUBRIQUES_CATALOG.map(r => ({
          Rubcod: r.rubcod, Rublib: r.rublib, Rubunite: r.rubunite, Vartype: r.vartype,
        })),
        Soccod: soccod || '',
      });
      const inserted = data.inserted ?? 0;
      const skipped = data.skipped ?? 0;
      const errs: string[] = data.errors ?? [];
      let msg = `${inserted} rubrique(s) importée(s)`;
      if (skipped) msg += `, ${skipped} ignorée(s) (déjà présente)`;
      if (errs.length) {
        feedback.showWarning(`${msg}. ${errs.length} erreur(s).`);
      } else {
        feedback.showSuccess(msg);
      }
      setDefaultsOpen(false);
      refetch();
    } catch (err) {
      feedback.showError(err, "Erreur lors de l'import des rubriques par défaut.");
    } finally {
      setImportingDefaults(false);
    }
  };

  return (
    <Box className="ref-container">
      <Box className="ref-header">
        <Box>
          <Typography className="ref-header-title">{t('donneeBase.breadcrumb')}</Typography>
          <Typography className="ref-header-heading">{t('donneeBase.rubrique.heading')}</Typography>
          <Typography className="ref-header-sub">{t('donneeBase.rubrique.subtitle')}</Typography>
        </Box>
        <Box className="ref-header-actions">
          {!isEditMode && canAdd && (
            <Button
              variant="outlined"
              startIcon={<LibraryAddIcon />}
              onClick={() => setDefaultsOpen(true)}
              sx={{ textTransform: 'none', borderRadius: '10px', fontWeight: 600 }}
            >
              Charger rubriques par défaut
            </Button>
          )}
          {!isEditMode && canAdd && (
            <ExcelImportButton
              endpoint="/BulkImport/rubriques"
              extraBody={{ Soccod: soccod }}
              columnMap={{
                Rubcod: ['rubcod', 'code', 'code rubrique'],
                Rublib: ['rublib', 'libelle', 'libellé', 'rubrique', 'nom', 'designation', 'désignation'],
                Rubunite: ['rubunite', 'unite', 'unité', 'unit'],
                Vartype: ['vartype', 'variable', 'grandeur', 'type'],
              }}
              labelMap={{
                Rubcod: 'Code rubrique',
                Rublib: 'Libellé',
                Rubunite: 'Unité',
                Vartype: 'Type',
              }}
              templateExample={{ Rubcod: '', Rublib: 'Prime de transport', Rubunite: 'MAD', Vartype: 'Gain' }}
              onImported={() => refetch()}
              label={t('donneeBase.rubrique.importExcel')}
            />
          )}
          {isEditMode && <Button className="ref-cancel-btn" variant="outlined" onClick={() => setForm({ ...emptyForm, soccod: soccod || '' })}>{t('donneeBase.common.cancel')}</Button>}
          {((isEditMode && canModify) || (!isEditMode && canAdd)) && (
            <Button className="ref-save-btn" variant="contained" startIcon={<SaveIcon />} onClick={handleSubmit} disabled={isLoading}>
              {isEditMode ? t('donneeBase.common.update') : t('donneeBase.common.save')}
            </Button>
          )}
        </Box>
      </Box>
      <Box className="ref-body">
        {/* Guide d'utilisation : explique le rôle de cette page et son lien avec
            l'intégration paie. Repliable mais affiché par défaut tant qu'aucune
            rubrique n'est encore configurée — c'est le moment où le contexte aide
            le plus. */}
        <Collapse in={showGuide}>
          <Box sx={{
            mb: 2, p: 2.5, borderRadius: '14px',
            background: 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)',
            border: '1px solid #bfdbfe', position: 'relative',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
              <InfoOutlinedIcon sx={{ color: '#0040a1', fontSize: 22, flexShrink: 0, mt: '2px' }} />
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#0f172a', mb: 0.5 }}>
                  À quoi sert cette page ?
                </Typography>
                <Typography sx={{ fontSize: 13, color: '#334155', lineHeight: 1.55, mb: 1 }}>
                  Les <strong>rubriques de paie</strong> font le lien entre vos données de pointage et votre logiciel
                  de paie (ex&nbsp;: Sage). Pour chaque grandeur que vous voulez exporter (heures supp., congés,
                  primes…), créez une rubrique avec&nbsp;:
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 2.5, fontSize: 13, color: '#334155', lineHeight: 1.7 }}>
                  <li><strong>Code</strong> &mdash; le code attendu par votre logiciel de paie (ex&nbsp;: «&nbsp;HS25&nbsp;»).</li>
                  <li><strong>Libellé</strong> &mdash; nom lisible (ex&nbsp;: «&nbsp;Heures supp. 25%&nbsp;»).</li>
                  <li><strong>Unité</strong> &mdash; Heure ou Jour. Détermine si l'export fournit des heures ou un nombre de jours.</li>
                  <li><strong>Variable de pointage</strong> &mdash; <em>la grandeur source</em> à extraire (heures sup. 25%, congé payé, etc.).</li>
                </Box>
                <Typography sx={{ fontSize: 13, color: '#334155', lineHeight: 1.55, mt: 1 }}>
                  Le bouton <strong>« Intégrer »</strong> dans <em>Pointage du mois</em> consomme cette liste pour
                  générer un fichier Excel avec, pour chaque salarié et chaque rubrique configurée, la valeur
                  cumulée du mois. <strong>Sans rubrique mappée, l'export reste vide.</strong>
                </Typography>

                {/* Format attendu par "Importer (Excel)". Les noms de colonnes sont
                    matchés en insensible à la casse via ExcelImportButton.columnMap. */}
                <Box sx={{ mt: 1.5, p: 1.5, borderRadius: '10px', background: '#fff', border: '1px dashed #bfdbfe' }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 13, color: '#0f172a', mb: 0.5 }}>
                    Format du fichier Excel à importer
                  </Typography>
                  <Typography sx={{ fontSize: 12.5, color: '#334155', lineHeight: 1.55, mb: 0.75 }}>
                    Une rubrique par ligne. La 1<sup>re</sup> ligne doit être l'en-tête (les noms ci-dessous,
                    insensibles à la casse et aux accents).
                  </Typography>
                  <Box component="ul" sx={{ m: 0, pl: 2.5, fontSize: 12.5, color: '#334155', lineHeight: 1.7 }}>
                    <li><strong>Code</strong> (alias acceptés&nbsp;: <code>rubcod</code>) &mdash; optionnel, auto-généré si vide.</li>
                    <li><strong>Libellé</strong> (alias&nbsp;: <code>rublib</code>, <code>libelle</code>, <code>désignation</code>, <code>nom</code>) &mdash; <em>obligatoire</em>.</li>
                    <li><strong>Unité</strong> (alias&nbsp;: <code>rubunite</code>, <code>unite</code>) &mdash; <code>H</code> / <code>Heure</code> ou <code>J</code> / <code>Jour</code>.</li>
                    <li><strong>Variable</strong> (alias&nbsp;: <code>vartype</code>, <code>grandeur</code>, <code>type</code>) &mdash; un des codes de la liste «&nbsp;Variable de pointage&nbsp;» (ex.&nbsp;<code>2</code>, <code>5</code>, <code>F</code>, <code>C</code>, <code>K</code>…).</li>
                  </Box>
                  <Box sx={{ mt: 1, p: 1, borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', overflowX: 'auto' }}>
                    <Box component="table" sx={{
                      width: '100%', borderCollapse: 'collapse', fontSize: 11.5,
                      '& th, & td': { padding: '4px 8px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' },
                      '& th': { background: '#f1f5f9', fontWeight: 700, color: '#0f172a' },
                    }}>
                      <thead>
                        <tr><th>Code</th><th>Libellé</th><th>Unité</th><th>Variable</th></tr>
                      </thead>
                      <tbody>
                        <tr><td>HS25</td><td>Heures supp. 25%</td><td>H</td><td>2</td></tr>
                        <tr><td>HS50</td><td>Heures supp. 50%</td><td>H</td><td>5</td></tr>
                        <tr><td>CP</td><td>Congés payés</td><td>J</td><td>C</td></tr>
                        <tr><td><em>(vide)</em></td><td>Prime panier</td><td>J</td><td>4</td></tr>
                      </tbody>
                    </Box>
                  </Box>
                  <Typography sx={{ fontSize: 11.5, color: '#64748b', mt: 1, fontStyle: 'italic' }}>
                    Les lignes dont le libellé est déjà présent ou le code déjà utilisé sont ignorées (compteur «&nbsp;ignorée(s)&nbsp;» dans le rapport d'import).
                  </Typography>
                </Box>
              </Box>
              <IconButton size="small" onClick={() => setShowGuide(false)} sx={{ flexShrink: 0 }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        </Collapse>
        {!showGuide && (
          <Button
            size="small"
            startIcon={<InfoOutlinedIcon />}
            onClick={() => setShowGuide(true)}
            sx={{ mb: 2, textTransform: 'none', color: '#0040a1', fontWeight: 600 }}
          >
            Afficher le guide
          </Button>
        )}

        <Box className="ref-card">
          <Box className="ref-card-header">
            <Box className="ref-card-icon"><ReceiptLongIcon fontSize="small" /></Box>
            <Typography className="ref-card-title">{isEditMode ? t('donneeBase.rubrique.editTitle') : t('donneeBase.rubrique.newTitle')}</Typography>
          </Box>
          {/* Formulaire réduit aux champs effectivement consommés par l'intégration paie :
              code, libellé, unité (H/J), et variable de pointage. Les anciens champs
              "Type comptable G/R/C" et "Régime / Taux" n'étaient pas relus côté export
              et ajoutaient du bruit — retirés. */}
          <Box className="ref-form-grid ref-form-grid--2">
            <Box className="ref-field">
              <label>{t('donneeBase.common.code')}</label>
              <input type="text" value={form.rubcod} onChange={e => setForm(p => ({ ...p, rubcod: e.target.value }))} readOnly={isEditMode} placeholder={t('donneeBase.rubrique.codePlaceholder')} />
            </Box>
            <Box className="ref-field">
              <label>{t('donneeBase.common.label')}</label>
              <input type="text" value={form.rublib} onChange={e => setForm(p => ({ ...p, rublib: e.target.value }))} placeholder={t('donneeBase.rubrique.labelPlaceholder')} />
            </Box>
            <Box className="ref-field">
              <label>{t('donneeBase.rubrique.unitLabel')}</label>
              <select value={form.rubunite || ''} onChange={e => setForm(p => ({ ...p, rubunite: e.target.value }))}>
                <option value="">—</option>
                <option value="H">{t('donneeBase.rubrique.unit.hour')}</option>
                <option value="J">{t('donneeBase.rubrique.unit.day')}</option>
              </select>
            </Box>
            <Box className="ref-field">
              <label>Variable de pointage <span style={{ color: '#94a3b8', fontWeight: 400 }}>(grandeur source)</span></label>
              <select value={form.vartype || ''} onChange={e => setForm(p => ({ ...p, vartype: e.target.value }))}>
                <option value="">— Sélectionner —</option>
                {Array.from(new Set(VARTYPE_OPTIONS.map(o => o.group))).map(group => (
                  <optgroup key={group} label={group}>
                    {VARTYPE_OPTIONS.filter(o => o.group === group).map(o => (
                      <option key={o.code} value={o.code}>{o.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Box>
          </Box>
        </Box>
        <Box className="ref-table-section">
          <Box className="ref-table-header">
            <Typography className="ref-table-title">{t('donneeBase.rubrique.tableTitle', { count: filtered.length })}</Typography>
            <Box className="ref-table-search">
              <SearchIcon sx={{ fontSize: 16, color: '#8896a8' }} />
              <input type="text" placeholder={t('donneeBase.common.search')} value={search} onChange={e => setSearch(e.target.value)} />
            </Box>
          </Box>
          {/* Conteneur scrollable : utilise .ref-table-container (max-height 60vh +
              overflow-y auto + thead sticky) défini dans RefModern.css. Évite que la
              page entière déroule pour atteindre les dernières rubriques quand le
              catalogue dépasse 25-30 entrées (typique après "Charger défauts" + import). */}
          <Box className="ref-table-container">
            <table className="ref-table">
              <thead><tr><th style={{ width: 80 }}>{t('donneeBase.common.actions')}</th><th>{t('donneeBase.common.code')}</th><th>{t('donneeBase.common.label')}</th><th>{t('donneeBase.rubrique.unitLabel')}</th><th>Variable de pointage</th></tr></thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} className="ref-empty">{t('donneeBase.rubrique.noResults')}</td></tr>
                ) : filtered.map(r => {
                  const vartypeLabel = VARTYPE_OPTIONS.find(o => o.code === r.vartype)?.label;
                  return (
                    <tr key={r.rubcod}>
                      <td><Box sx={{ display: 'flex', gap: '4px' }}>
                        {canModify && (
                          <button className="ref-action-btn ref-action-btn--edit" onClick={() => handleEdit(r)}><EditIcon sx={{ fontSize: 16 }} /></button>
                        )}
                        {canDelete && (
                          <button className="ref-action-btn ref-action-btn--delete" onClick={() => handleDelete(r)}><DeleteOutlineIcon sx={{ fontSize: 16 }} /></button>
                        )}
                        {!canModify && !canDelete && <Typography variant="caption">—</Typography>}
                      </Box></td>
                      <td style={{ fontWeight: 700, color: '#0f172a' }}>{r.rubcod}</td>
                      <td>{r.rublib}</td>
                      <td><span className="ref-badge ref-badge--gray">{r.rubunite || '—'}</span></td>
                      <td>
                        {r.vartype
                          ? <span className="ref-badge ref-badge--blue" title={vartypeLabel}>{vartypeLabel || r.vartype}</span>
                          : <span className="ref-badge ref-badge--gray">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Box>
          <Box className="ref-table-footer"><span>{t('donneeBase.rubrique.footerCount', { count: filtered.length })}</span></Box>
        </Box>
      </Box>
      <Dialog open={defaultsOpen} onClose={() => !importingDefaults && setDefaultsOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <LibraryAddIcon sx={{ color: '#0040a1' }} />
          Charger les rubriques par défaut
        </DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ fontSize: 13, color: '#475569', mb: 1.5 }}>
            Le catalogue ci-dessous couvre toutes les grandeurs calculées par le moteur de pointage
            (heures travaillées, h. supp., congés, fériés, primes…). Les rubriques dont le <strong>code</strong>
            ou le <strong>libellé</strong> existe déjà sont marquées « Déjà présent » et seront ignorées
            côté serveur — vous pouvez relancer cet import sans risque.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, mb: 1.5, flexWrap: 'wrap' }}>
            <Box sx={{ px: 1.5, py: 0.75, borderRadius: '8px', background: '#dcfce7', color: '#166534', fontSize: 12.5, fontWeight: 700 }}>
              {toImportCount} à importer
            </Box>
            <Box sx={{ px: 1.5, py: 0.75, borderRadius: '8px', background: '#f1f5f9', color: '#475569', fontSize: 12.5, fontWeight: 700 }}>
              {DEFAULT_RUBRIQUES_CATALOG.length - toImportCount} déjà présent(es)
            </Box>
            <Box sx={{ px: 1.5, py: 0.75, borderRadius: '8px', background: '#eff6ff', color: '#0040a1', fontSize: 12.5, fontWeight: 700 }}>
              Total catalogue : {DEFAULT_RUBRIQUES_CATALOG.length}
            </Box>
          </Box>
          <Box sx={{ maxHeight: 360, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
            <Box component="table" sx={{
              width: '100%', borderCollapse: 'collapse', fontSize: 12.5,
              '& th, & td': { padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid #e2e8f0' },
              '& th': { background: '#f8fafc', fontWeight: 700, color: '#0f172a', position: 'sticky', top: 0 },
            }}>
              <thead>
                <tr><th>Code</th><th>Libellé</th><th style={{ width: 70 }}>Unité</th><th>Variable</th><th style={{ width: 130 }}>Statut</th></tr>
              </thead>
              <tbody>
                {defaultsPreview.map(r => {
                  const vartypeLabel = VARTYPE_OPTIONS.find(o => o.code === r.vartype)?.label;
                  return (
                    <tr key={r.rubcod} style={{ opacity: r.alreadyExists ? 0.55 : 1 }}>
                      <td style={{ fontWeight: 700 }}>{r.rubcod}</td>
                      <td>{r.rublib}</td>
                      <td><span className="ref-badge ref-badge--gray">{r.rubunite}</span></td>
                      <td><span className="ref-badge ref-badge--blue" title={vartypeLabel}>{vartypeLabel || r.vartype}</span></td>
                      <td>
                        {r.alreadyExists
                          ? <span className="ref-badge ref-badge--gray">Déjà présent</span>
                          : <span className="ref-badge ref-badge--blue" style={{ background: '#dcfce7', color: '#166534' }}>À importer</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDefaultsOpen(false)} disabled={importingDefaults}>Annuler</Button>
          <Button
            variant="contained"
            onClick={handleImportDefaults}
            disabled={importingDefaults || toImportCount === 0}
            startIcon={importingDefaults ? <CircularProgress size={16} color="inherit" /> : <LibraryAddIcon />}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {importingDefaults ? 'Import en cours…' : `Importer (${toImportCount})`}
          </Button>
        </DialogActions>
      </Dialog>
      {feedback.element}
    </Box>
  );
}

export default function RubriqueModern() {
  return <RubriqueModernContent />;
}