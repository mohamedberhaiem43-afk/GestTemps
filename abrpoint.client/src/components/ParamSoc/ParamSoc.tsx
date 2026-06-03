import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Snackbar,
  Alert,
  Tooltip,
  Switch,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import {
  Save as SaveIcon,
  Functions as FunctionsIcon,
  EventAvailable as EventIcon,
  NightsStay as NightIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  InfoOutlined as InfoOutlinedIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { Collapse, Paper, IconButton } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../helper/AuthProvider';
import useGetParametres from '../../hooks/parametreHooks/useGetParametres';
import useUpdateParametres from '../../hooks/parametreHooks/useUpdateParametres';
import useUpdateParTranche from '../../hooks/partrancheHooks/useUpdateParTranche';
import useUpdateSocHeures from '../../hooks/societeHooks/useUpdateSocHeures';
import useGetParTranche from '../../hooks/partrancheHooks/useGetParTranche';
import useGetSocHeures from '../../hooks/societeHooks/useGetSocHeures';
import useGetCalendrier from '../../hooks/calendrierHooks/useGetCalendriers';
import { Parametre } from '../../models/Parametre';
import ParTranche from '../../models/ParTranche';
import './ParamSocModern.css';

export default function ParamSocModern() {
  const { t } = useTranslation();
  const { soccod } = useAuth();
  const { data: parametres, refetch } = useGetParametres();
  const { data: partranche, refetch: refetchPartranche } = useGetParTranche();
  const { data: socheures, refetch: refetchSocheures } = useGetSocHeures();
  const { data: calendriers = {} } = useGetCalendrier();

  const updateParametreMutation = useUpdateParametres();
  const updateParTrancheMutation = useUpdateParTranche();
  const updateSocHeuresMutation = useUpdateSocHeures();

  const [activeTab, setActiveTab] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" as "success" | "error" });
  const [isLoading, setIsLoading] = useState(false);
  const [showGuide, setShowGuide] = useState(true);

  const [formData, setFormData] = useState<Partial<Parametre>>({});
  const [tranchesH, setTranchesH] = useState<ParTranche[]>([]);
  const [tranchesM, setTranchesM] = useState<ParTranche[]>([]);
  const [socHeuresData, setSocHeuresData] = useState({ socpresence: 'P', sochsup: 'P' });

  const calendriersList = Object.entries(calendriers ?? {}).map(([caltype, callib]) => ({ caltype, callib }));

  useEffect(() => {
    if (parametres) setFormData(parametres);
    if (socheures) setSocHeuresData({ socpresence: socheures.socpresence || 'P', sochsup: socheures.sochsup || 'P' });
    if (partranche) {
      setTranchesH(partranche.filter(p => p.empreg === 'H') || []);
      setTranchesM(partranche.filter(p => p.empreg === 'M') || []);
    }
  }, [parametres, partranche, socheures]);

  const handleUpdate = () => {
    setIsLoading(true);
    const dataToSend = { ...formData, soccod: soccod || '' } as Parametre;
    const trancheDataToSend = [...tranchesH, ...tranchesM];

    let successCount = 0;
    const total = 3;

    const checkAllDone = () => {
      successCount++;
      if (successCount >= total) {
        setIsLoading(false);
        setSnackbar({ open: true, message: t('paramSoc.common.updateSuccess'), severity: "success" });
        // Refetch les 3 sources : sinon, refetch() seul rafraîchit parametres,
        // useEffect re-déclenche, et setTranchesH/M réinitialise depuis la
        // cache partranche stale (sans la tranche qu'on vient d'enregistrer)
        // → la nouvelle ligne disparaît jusqu'à F5.
        refetch();
        refetchPartranche();
        refetchSocheures();
      }
    };

    const onError = () => {
      setIsLoading(false);
      setSnackbar({ open: true, message: t('paramSoc.common.updateError'), severity: "error" });
    };

    updateParametreMutation.mutate(dataToSend, { onSuccess: checkAllDone, onError });
    updateParTrancheMutation.mutate(trancheDataToSend, { onSuccess: checkAllDone, onError });
    updateSocHeuresMutation.mutate(socHeuresData, { onSuccess: checkAllDone, onError });
  };

  const handleInputChange = (field: keyof Parametre, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleTrancheChange = (idx: number, field: keyof ParTranche, value: any, type: 'H' | 'M') => {
    if (type === 'H') {
      const newTranches = [...tranchesH];
      newTranches[idx] = { ...newTranches[idx], [field]: value };
      setTranchesH(newTranches);
    } else {
      const newTranches = [...tranchesM];
      newTranches[idx] = { ...newTranches[idx], [field]: value };
      setTranchesM(newTranches);
    }
  };

  const addTranche = (type: 'H' | 'M') => {
    const newTranche: ParTranche = {
      soccod: soccod || '',
      ordre: (type === 'H' ? tranchesH.length : tranchesM.length) + 1,
      caltype: '',
      empreg: type,
      partranche1: 0,
      partaux1: 0,
      partranche2: 0,
      partaux2: 0
    };
    if (type === 'H') setTranchesH([...tranchesH, newTranche]);
    else setTranchesM([...tranchesM, newTranche]);
  };

  const removeTranche = (idx: number, type: 'H' | 'M') => {
    if (type === 'H') setTranchesH(tranchesH.filter((_, i) => i !== idx));
    else setTranchesM(tranchesM.filter((_, i) => i !== idx));
  };

  const tabs = [
    { label: t('paramSoc.tabs.calculsDates'), icon: <FunctionsIcon /> },
    { label: t('paramSoc.tabs.heuresSup'), icon: <EventIcon /> },
    { label: t('paramSoc.tabs.heuresNuit'), icon: <NightIcon /> },
  ];

  return (
    <div className="ps-modern-container">
      <header className="ps-modern-header">
        <Box>
          <span style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.2em' }}>{t('paramSoc.common.configuration')}</span>
          <h1 className="ps-modern-title">{t('paramSoc.common.title')}</h1>
          <p className="ps-modern-subtitle">{t('paramSoc.common.subtitle')}</p>
        </Box>
      </header>

      <nav className="ps-modern-tabs">
        {tabs.map((tab, i) => (
          <button key={i} className={`ps-modern-tab ${activeTab === i ? 'ps-modern-tab--active' : ''}`} onClick={() => setActiveTab(i)}>{tab.label}</button>
        ))}
        <button
          className="ps-modern-tab"
          onClick={() => setShowGuide(g => !g)}
          style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          title={showGuide ? 'Masquer le guide' : 'Afficher le guide'}
        >
          <InfoOutlinedIcon sx={{ fontSize: 18 }} />
          <span style={{ fontSize: 13 }}>{showGuide ? 'Masquer le guide' : 'Afficher le guide'}</span>
        </button>
      </nav>

      {/* Guide contextuel — change de contenu selon l'onglet actif. Replié via le
          bouton de la barre d'onglets. Chaque champ visible plus bas est expliqué
          ici pour que l'utilisateur RH n'ait pas à deviner l'effet métier. */}
      <Collapse in={showGuide}>
        <Paper elevation={0} sx={{
          mb: 2, p: 2.5, borderRadius: '14px',
          background: 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)',
          border: '1px solid #bfdbfe',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
            <InfoOutlinedIcon sx={{ color: '#0040a1', fontSize: 22, flexShrink: 0, mt: '2px' }} />
            <Box sx={{ flex: 1 }}>
              {activeTab === 0 && (
                <>
                  <Typography sx={{ fontWeight: 800, fontSize: 15, color: '#0f172a', mb: 1 }}>
                    Calculs &amp; dates de paie
                  </Typography>
                  <Typography sx={{ fontSize: 13, color: '#334155', lineHeight: 1.55, mb: 1.25 }}>
                    Cet onglet définit la <strong>fenêtre de paie</strong> du tenant et les règles globales
                    qui s'appliquent à tous les calculs de pointage. Chaque champ est consommé par le
                    moteur de calcul pour déterminer ce qui finit dans le bulletin.
                  </Typography>
                  <Box component="ul" sx={{ m: 0, pl: 2.5, fontSize: 13, color: '#334155', lineHeight: 1.7 }}>
                    <li><strong>Jour début / Jour fin</strong> &mdash; bornes du mois de paie. Ex.&nbsp;: «&nbsp;26 du mois précédent au 25 du mois courant&nbsp;».</li>
                    <li><strong>Mois début / Mois fin</strong> &mdash; <em>Courant</em> ou <em>Précédent</em>&nbsp;: décale la fenêtre vers le mois calendaire précédent.</li>
                    <li><strong>Ancienneté (jours)</strong> &mdash; nombre de jours requis avant qu'un nouveau salarié soit pris en compte dans certains calculs (ex.&nbsp;: prime).</li>
                    <li><strong>Heures congé / repos / férié</strong> &mdash; valeur en heures d'une journée de chaque type. Sert à valoriser un congé ou un férié dans la paie.</li>
                    <li><strong>Travail férié</strong> &mdash; switch global qui active ou non la majoration férié.</li>
                    <li><strong>Écart minutes</strong> &mdash; tolérance de pointage entre 2 badges consécutifs (en deçà = doublon ignoré).</li>
                    <li><strong>Min / Max heures par jour</strong> &mdash; bornes de plausibilité. En deçà du min → marqué incomplet&nbsp;; au-delà du max → écrêté pour éviter les fraudes.</li>
                    <li><strong>Max férié majoré</strong> &mdash; plafond d'heures fériées prises en compte dans la majoration (au-delà = heures normales).</li>
                    <li><strong>Éliminer férié</strong> &mdash; règle quand un jour férié tombe sur un jour normalement travaillé&nbsp;: 0 = ne rien faire, 1 = retirer du planning, 2 = compenser.</li>
                    <li><strong>Mode déduction repos</strong> &mdash; comment la pause repos est déduite des heures totales (0 = pas déduite, 2 = déduite si pointage entrée/sortie repas, 3 = déduite forfaitairement).</li>
                  </Box>
                </>
              )}
              {activeTab === 1 && (
                <>
                  <Typography sx={{ fontWeight: 800, fontSize: 15, color: '#0f172a', mb: 1 }}>
                    Heures supplémentaires
                  </Typography>
                  <Typography sx={{ fontSize: 13, color: '#334155', lineHeight: 1.55, mb: 1.25 }}>
                    Définit les <strong>tranches de majoration</strong> appliquées au-delà du temps de travail
                    légal. Deux modes&nbsp;: hebdomadaire (typique CDI 35-40h) ou mensuel (forfait
                    cadre). On peut activer plusieurs catégories en parallèle.
                  </Typography>
                  <Box component="ul" sx={{ m: 0, pl: 2.5, fontSize: 13, color: '#334155', lineHeight: 1.7 }}>
                    <li><strong>Cadre / Maîtrise / Exécutant</strong> &mdash; cases à cocher pour activer les tranches selon la catégorie d'employé. Permet d'avoir des taux différents par CSP.</li>
                    <li><strong>Calendrier</strong> &mdash; rattache la tranche à un calendrier (ex.&nbsp;: «&nbsp;Plein temps&nbsp;» vs «&nbsp;Mi-temps&nbsp;»). Sans calendrier, la tranche s'applique partout.</li>
                    <li><strong>Tr1 / %1</strong> &mdash; <em>première</em> tranche d'heures sup et son taux de majoration. Ex.&nbsp;: 8h à 25%.</li>
                    <li><strong>Tr2 / %2</strong> &mdash; <em>deuxième</em> tranche d'heures sup et son taux. Ex.&nbsp;: au-delà de 8h à 50%.</li>
                    <li><strong>Hebdomadaire</strong> &mdash; les bornes Tr1/Tr2 s'évaluent sur la semaine glissante.</li>
                    <li><strong>Mensuel</strong> &mdash; les bornes s'évaluent sur le mois de paie configuré dans l'onglet précédent.</li>
                  </Box>
                </>
              )}
              {activeTab === 2 && (
                <>
                  <Typography sx={{ fontWeight: 800, fontSize: 15, color: '#0f172a', mb: 1 }}>
                    Heures de nuit
                  </Typography>
                  <Typography sx={{ fontSize: 13, color: '#334155', lineHeight: 1.55, mb: 1.25 }}>
                    Définit la <strong>plage horaire considérée «&nbsp;de nuit&nbsp;»</strong> et les règles associées
                    (majoration, panier, exclusion d'absence). Le moteur de calcul intersecte les pointages
                    réels avec cette plage pour déterminer les heures éligibles.
                  </Typography>
                  <Box component="ul" sx={{ m: 0, pl: 2.5, fontSize: 13, color: '#334155', lineHeight: 1.7 }}>
                    <li><strong>Activer (switch en haut)</strong> &mdash; si désactivé, aucun calcul d'heure de nuit n'est effectué (gain CPU pour les sociétés en horaires de bureau uniquement).</li>
                    <li><strong>Début / Fin</strong> &mdash; bornes de la plage de nuit (ex.&nbsp;: 22:00 → 06:00). La plage peut chevaucher minuit&nbsp;: c'est géré nativement.</li>
                    <li><strong>Diminuer panier</strong> &mdash; coche pour retirer la pause repas du décompte d'heures de nuit (le panier reste payé séparément).</li>
                    <li><strong>Compter sortie</strong> &mdash; inclut la dernière sortie effective dans le calcul même si elle dépasse la plage théorique.</li>
                    <li><strong>Exclure nuit</strong> &mdash; n'incrémente pas l'absence pour un employé qui ne se présente pas pendant la plage de nuit (utilisé pour les gardes optionnelles).</li>
                    <li><strong>Majorer Hnuit</strong> &mdash; applique un taux de majoration spécifique aux heures de nuit (en plus des heures sup s'il y a cumul).</li>
                    <li><strong>Seuil minimal</strong> &mdash; nombre d'heures minimum dans la plage pour déclencher la majoration nuit (évite la prime pour 5 minutes de débordement).</li>
                  </Box>
                </>
              )}
            </Box>
            <IconButton size="small" onClick={() => setShowGuide(false)} sx={{ flexShrink: 0 }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Paper>
      </Collapse>

      {activeTab === 0 && (
        <div className="ps-modern-grid">
          <div className="ps-modern-card ps-modern-card--large">
            <div className="ps-modern-card-header">
              <h3 className="ps-modern-card-title">{t('paramSoc.tabsHeader.calculsTitle')}</h3>
              <FunctionsIcon sx={{ color: 'rgba(0, 64, 161, 0.1)', fontSize: 40 }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
              {/* Diviseur Mensuel - Commented out
              <div className="ps-modern-form-group" style={{ gridColumn: 'span 2' }}>
                <label className="ps-modern-label">Diviseur Mensuel</label>
                <div className="ps-modern-input-wrapper">
                  <input type="number" className="ps-modern-input" value={formData.parjhnfixe || ''} onChange={(e) => handleInputChange('parjhnfixe', e.target.value)} />
                  <span className="ps-modern-unit">heures</span>
                </div>
              </div>
              */}

              <div className="ps-modern-form-group">
                <label className="ps-modern-label">{t('paramSoc.calculs.moisDebut')}</label>
                <input type="number" className="ps-modern-input" value={formData.joudeb || ''} onChange={(e) => handleInputChange('joudeb', e.target.value)} placeholder="01" />
              </div>
              <div className="ps-modern-form-group">
                <label className="ps-modern-label">{t('paramSoc.calculs.moisDebutLabel')}</label>
                <Select fullWidth variant="standard" value={formData.moisdeb || 'C'} onChange={(e) => handleInputChange('moisdeb', e.target.value)}>
                  <MenuItem value="C">{t('paramSoc.calculs.current')}</MenuItem>
                  <MenuItem value="P">{t('paramSoc.calculs.previous')}</MenuItem>
                </Select>
              </div>
              <div className="ps-modern-form-group">
                <label className="ps-modern-label">{t('paramSoc.calculs.moisFin')}</label>
                <input type="number" className="ps-modern-input" value={formData.joufin || ''} onChange={(e) => handleInputChange('joufin', e.target.value)} placeholder="31" />
              </div>
              <div className="ps-modern-form-group">
                <label className="ps-modern-label">{t('paramSoc.calculs.moisFinLabel')}</label>
                <Select fullWidth variant="standard" value={formData.moisfin || 'C'} onChange={(e) => handleInputChange('moisfin', e.target.value)}>
                  <MenuItem value="C">{t('paramSoc.calculs.current')}</MenuItem>
                  <MenuItem value="P">{t('paramSoc.calculs.previous')}</MenuItem>
                </Select>
              </div>

              {/* Intégration Paie - Commented out
              <div className="ps-modern-form-group" style={{ gridColumn: 'span 2' }}>
                <label className="ps-modern-label">Intégration Paie</label>
                <Select fullWidth variant="standard" value={formData.paie || ''} onChange={(e) => handleInputChange('paie', e.target.value)}>
                  <MenuItem value="paie">Paie Interne</MenuItem>
                  <MenuItem value="navision">Navision</MenuItem>
                  <MenuItem value="sage">Sage</MenuItem>
                </Select>
              </div>
              */}

              <div className="ps-modern-form-group" style={{ gridColumn: 'span 2' }}>
                <label className="ps-modern-label">{t('paramSoc.calculs.anciennete')}</label>
                <input type="number" className="ps-modern-input" value={formData.pardroitnbj || 0} onChange={(e) => handleInputChange('pardroitnbj', parseInt(e.target.value) || 0)} />
              </div>
            </div>
          </div>

          <div className="ps-modern-card ps-modern-card--small">
            <h3 className="ps-modern-card-title">{t('paramSoc.tabsHeader.joursFeries')}</h3>
            <div className="ps-modern-form-group">
              <label className="ps-modern-label">{t('paramSoc.calculs.heuresConge')}</label>
              <div className="ps-modern-input-wrapper">
                <input type="number" step="0.5" className="ps-modern-input" value={formData.nbhconge ?? ''} onChange={(e) => handleInputChange('nbhconge', parseFloat(e.target.value) || 0)} />
                <span className="ps-modern-unit">h</span>
              </div>
            </div>
            <div className="ps-modern-form-group">
              <label className="ps-modern-label">{t('paramSoc.calculs.heuresRepos')}</label>
              <div className="ps-modern-input-wrapper">
                <input type="number" className="ps-modern-input" value={formData.nbhrepos ?? ''} onChange={(e) => handleInputChange('nbhrepos', parseInt(e.target.value) || 0)} />
                <span className="ps-modern-unit">h</span>
              </div>
            </div>
            <div className="ps-modern-form-group">
              <label className="ps-modern-label">{t('paramSoc.calculs.heuresFerie')}</label>
              <div className="ps-modern-input-wrapper">
                <input type="number" className="ps-modern-input" value={formData.nbhferier ?? ''} onChange={(e) => handleInputChange('nbhferier', parseInt(e.target.value) || 0)} />
                <span className="ps-modern-unit">h</span>
              </div>
            </div>
            <div className="ps-modern-switch-row"><span>{t('paramSoc.calculs.travailFerie')}</span><Switch checked={formData.fertrv === 1} onChange={(e) => handleInputChange('fertrv', e.target.checked ? 1 : 0)} /></div>
          </div>

          <div className="ps-modern-card" style={{ gridColumn: '1 / -1' }}>
            <h3 className="ps-modern-card-title">{t('paramSoc.tabsHeader.pointageCalcul')}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
              <div className="ps-modern-form-group">
                <label className="ps-modern-label">{t('paramSoc.calculs.ecartMin')}</label>
                <input type="number" className="ps-modern-input" value={formData.parecart || 0} onChange={(e) => handleInputChange('parecart', parseInt(e.target.value) || 0)} />
              </div>
              <div className="ps-modern-form-group">
                <label className="ps-modern-label">{t('paramSoc.calculs.minHoursDay')}</label>
                <div className="ps-modern-input-wrapper">
                  <input type="number" className="ps-modern-input" value={formData.parminhjour ?? 0} onChange={(e) => handleInputChange('parminhjour', Number(e.target.value))} />
                  <span className="ps-modern-unit">h</span>
                </div>
              </div>
              <div className="ps-modern-form-group">
                <label className="ps-modern-label">{t('paramSoc.calculs.maxHoursDay')}</label>
                <div className="ps-modern-input-wrapper">
                  <input type="number" className="ps-modern-input" value={formData.parmaxhjour ?? 0} onChange={(e) => handleInputChange('parmaxhjour', Number(e.target.value))} />
                  <span className="ps-modern-unit">h</span>
                </div>
              </div>
              <div className="ps-modern-form-group">
                <label className="ps-modern-label">{t('paramSoc.calculs.maxFerieMajore')}</label>
                <div className="ps-modern-input-wrapper">
                  {/* Plafond d'heures travaillées sur jour férié comptabilisées en HreFerieTrv
                      (= colonne "H.Fér.Trv" du Pointage du Mois). Vide / non saisi = ILLIMITÉ
                      (le backend prend toutes les heures travaillées sur férié). 0 explicite =
                      aucune heure férié payée. Ancien bug : `?? 0` affichait 0 par défaut,
                      faisant croire à l'admin qu'aucune limite n'était imposée alors que le
                      backend lisait ce 0 comme un cap à zéro → H.Fér.Trv = 0 sur toutes les
                      lignes (cf. ParametreRepository.cs:458 + HeuresSupp...ervice.cs:201). */}
                  <input
                    type="number"
                    className="ps-modern-input"
                    placeholder="∞ (illimité)"
                    value={formData.parmaxfer ?? ''}
                    onChange={(e) => handleInputChange('parmaxfer',
                      e.target.value === '' ? null : Number(e.target.value))}
                  />
                  <span className="ps-modern-unit">h</span>
                </div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.25rem', fontStyle: 'italic' }}>
                  Plafond H.Fér.Trv (Pointage Mois). Vide = illimité. 0 = aucune heure férié comptée.
                </div>
              </div>
              <div className="ps-modern-form-group">
                <label className="ps-modern-label">{t('paramSoc.calculs.eliminerFerie')}</label>
                <Select fullWidth variant="standard" value={formData.parelimftrv || '0'} onChange={(e) => handleInputChange('parelimftrv', e.target.value)}>
                  <MenuItem value="0">{t('paramSoc.calculs.elim0')}</MenuItem>
                  <MenuItem value="1">{t('paramSoc.calculs.elim1')}</MenuItem>
                  <MenuItem value="2">{t('paramSoc.calculs.elim2')}</MenuItem>
                  <MenuItem value="3">{t('paramSoc.calculs.elim3')}</MenuItem>
                  <MenuItem value="4">{t('paramSoc.calculs.elim4')}</MenuItem>
                </Select>
              </div>
              <div className="ps-modern-form-group">
                <label className="ps-modern-label">{t('paramSoc.calculs.modeDeductionRepos')}</label>
                <Select fullWidth variant="standard" value={formData.parreptrv || '0'} onChange={(e) => handleInputChange('parreptrv', e.target.value)}>
                  <MenuItem value="0">{t('paramSoc.calculs.rep0')}</MenuItem>
                  <MenuItem value="1">{t('paramSoc.calculs.rep1')}</MenuItem>
                  <MenuItem value="2">{t('paramSoc.calculs.rep2')}</MenuItem>
                  <MenuItem value="3">{t('paramSoc.calculs.rep3')}</MenuItem>
                </Select>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 1 && (
        <div className="ps-modern-grid">
          <div className="ps-modern-card ps-modern-card--large">
            <h3 className="ps-modern-card-title">{t('paramSoc.heuresSup.modeTitle')}</h3>
            <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 2, mt: 1 }}>
              {t('paramSoc.heuresSup.modeHint')}
            </Typography>
            <Select
              value={formData.parhsupmode === 'A' ? 'A' : 'V'}
              onChange={(e) => handleInputChange('parhsupmode', e.target.value)}
              size="small"
              fullWidth
              sx={{ borderRadius: '8px', maxWidth: 460, mb: 1 }}
            >
              <MenuItem value="V">{t('paramSoc.heuresSup.modeValidation')}</MenuItem>
              <MenuItem value="A">{t('paramSoc.heuresSup.modeAuto')}</MenuItem>
            </Select>
          </div>

          <div className="ps-modern-card ps-modern-card--large">
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
              <h3 className="ps-modern-card-title">{t('paramSoc.tabsHeader.tranchesHsup')}</h3>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControlLabel control={<Checkbox checked={formData.parcadre === '1'} onChange={(e) => handleInputChange('parcadre', e.target.checked ? '1' : '0')} />} label={t('paramSoc.heuresSup.cadre')} />
                <FormControlLabel control={<Checkbox checked={formData.parmaitrise === '1'} onChange={(e) => handleInputChange('parmaitrise', e.target.checked ? '1' : '0')} />} label={t('paramSoc.heuresSup.maitrise')} />
                <FormControlLabel control={<Checkbox checked={formData.parexec === '1'} onChange={(e) => handleInputChange('parexec', e.target.checked ? '1' : '0')} />} label={t('paramSoc.heuresSup.executant')} />
              </Box>
            </Box>

            <Box sx={{ mb: 4 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>{t('paramSoc.heuresSup.hebdomadaire')}</Typography>
                <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => addTranche('H')}>{t('paramSoc.heuresSup.ajouter')}</Button>
              </Box>
              <Box sx={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <table className="ps-modern-table">
                  <thead><tr><th>{t('paramSoc.heuresSup.calendrier')}</th><th>{t('paramSoc.heuresSup.tr1')}</th><th>%1</th><th>{t('paramSoc.heuresSup.tr2')}</th><th>%2</th><th></th></tr></thead>
                  <tbody>
                    {tranchesH.map((tr, i) => (
                      <tr key={i}>
                        <td style={{ minWidth: '150px' }}>
                          <Select
                            value={tr.caltype}
                            onChange={(e) => handleTrancheChange(i, 'caltype', e.target.value, 'H')}
                            size="small"
                            fullWidth
                            sx={{ borderRadius: '8px' }}
                          >
                            <MenuItem value="">{t('paramSoc.common.selectPlaceholder')}</MenuItem>
                            {calendriersList.map((cal) => (
                              <MenuItem key={cal.caltype} value={cal.caltype}>{cal.callib || cal.caltype}</MenuItem>
                            ))}
                          </Select>
                        </td>
                        <td><input type="number" style={{ width: '60px', border: '1px solid #eee', padding: '8px', borderRadius: '4px' }} value={tr.partranche1} onChange={(e) => handleTrancheChange(i, 'partranche1', Number(e.target.value), 'H')} />h</td>
                        <td><input type="number" style={{ width: '60px', border: '1px solid #eee', padding: '8px', borderRadius: '4px' }} value={tr.partaux1} onChange={(e) => handleTrancheChange(i, 'partaux1', Number(e.target.value), 'H')} />%</td>
                        <td><input type="number" style={{ width: '60px', border: '1px solid #eee', padding: '8px', borderRadius: '4px' }} value={tr.partranche2} onChange={(e) => handleTrancheChange(i, 'partranche2', Number(e.target.value), 'H')} />h</td>
                        <td><input type="number" style={{ width: '60px', border: '1px solid #eee', padding: '8px', borderRadius: '4px' }} value={tr.partaux2} onChange={(e) => handleTrancheChange(i, 'partaux2', Number(e.target.value), 'H')} />%</td>
                        <td><Button size="small" variant="text" color="error" onClick={() => removeTranche(i, 'H')}><DeleteIcon sx={{ fontSize: 18 }} /></Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Box>
            </Box>

            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>{t('paramSoc.heuresSup.mensuel')}</Typography>
                <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => addTranche('M')}>{t('paramSoc.heuresSup.ajouter')}</Button>
              </Box>
              <Box sx={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <table className="ps-modern-table">
                  <thead><tr><th>{t('paramSoc.heuresSup.calendrier')}</th><th>{t('paramSoc.heuresSup.tr1')}</th><th>%1</th><th>{t('paramSoc.heuresSup.tr2')}</th><th>%2</th><th></th></tr></thead>
                  <tbody>
                    {tranchesM.map((tr, i) => (
                      <tr key={i}>
                        <td style={{ minWidth: '150px' }}>
                          <Select
                            value={tr.caltype}
                            onChange={(e) => handleTrancheChange(i, 'caltype', e.target.value, 'M')}
                            size="small"
                            fullWidth
                            sx={{ borderRadius: '8px' }}
                          >
                            <MenuItem value="">{t('paramSoc.common.selectPlaceholder')}</MenuItem>
                            {calendriersList.map((cal) => (
                              <MenuItem key={cal.caltype} value={cal.caltype}>{cal.callib || cal.caltype}</MenuItem>
                            ))}
                          </Select>
                        </td>
                        <td><input type="number" style={{ width: '60px', border: '1px solid #eee', padding: '8px', borderRadius: '4px' }} value={tr.partranche1} onChange={(e) => handleTrancheChange(i, 'partranche1', Number(e.target.value), 'M')} />h</td>
                        <td><input type="number" style={{ width: '60px', border: '1px solid #eee', padding: '8px', borderRadius: '4px' }} value={tr.partaux1} onChange={(e) => handleTrancheChange(i, 'partaux1', Number(e.target.value), 'M')} />%</td>
                        <td><input type="number" style={{ width: '60px', border: '1px solid #eee', padding: '8px', borderRadius: '4px' }} value={tr.partranche2} onChange={(e) => handleTrancheChange(i, 'partranche2', Number(e.target.value), 'M')} />h</td>
                        <td><input type="number" style={{ width: '60px', border: '1px solid #eee', padding: '8px', borderRadius: '4px' }} value={tr.partaux2} onChange={(e) => handleTrancheChange(i, 'partaux2', Number(e.target.value), 'M')} />%</td>
                        <td><Button size="small" variant="text" color="error" onClick={() => removeTranche(i, 'M')}><DeleteIcon sx={{ fontSize: 18 }} /></Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Box>
            </Box>
          </div>
        </div>
      )}

      {activeTab === 2 && (
        <div className="ps-modern-grid">
          <div className="ps-modern-card ps-modern-card--medium">
            <div className="ps-modern-card-header">
              <h3 className="ps-modern-card-title">{t('paramSoc.tabsHeader.configurationNuit')}</h3>
              <Switch checked={formData.parnuit === '1'} onChange={(e) => handleInputChange('parnuit', e.target.checked ? '1' : '0')} />
            </div>
            <div style={{ marginBottom: '0.5rem', fontWeight: 700, color: '#475569', fontSize: '0.85rem' }}>
              {t('paramSoc.nuit.plageNormale')}
            </div>
            <div className="ps-modern-time-grid" style={{ marginBottom: '1.5rem' }}>
              <div className="ps-modern-input-wrapper">
                <label className="ps-modern-label">{t('paramSoc.nuit.debut')}</label>
                {/* placeholder, pas value-fallback : un value=`||'22:00'` afficherait 22:00 alors que
                    formData.nuitdeb reste '' → la sauvegarde envoyait vide et le calcul H.Nuit
                    retournait 0 sans signaler quoi que ce soit. */}
                <input type="text" className="ps-modern-input" placeholder="22:00" value={formData.nuitdeb || ''} onChange={(e) => handleInputChange('nuitdeb', e.target.value)} />
              </div>
              <div className="ps-modern-input-wrapper">
                <label className="ps-modern-label">{t('paramSoc.nuit.fin')}</label>
                <input type="text" className="ps-modern-input" placeholder="06:00" value={formData.nuitfin || ''} onChange={(e) => handleInputChange('nuitfin', e.target.value)} />
              </div>
            </div>

            <div style={{ marginBottom: '0.5rem', fontWeight: 700, color: '#475569', fontSize: '0.85rem' }}>
              {t('paramSoc.nuit.plageSpeciale')}
            </div>
            <div className="ps-modern-time-grid" style={{ marginBottom: '0.5rem' }}>
              <div className="ps-modern-input-wrapper">
                <label className="ps-modern-label">{t('paramSoc.nuit.debut')}</label>
                <input type="text" className="ps-modern-input" value={formData.nuitsdeb || ''} onChange={(e) => handleInputChange('nuitsdeb', e.target.value)} />
              </div>
              <div className="ps-modern-input-wrapper">
                <label className="ps-modern-label">{t('paramSoc.nuit.fin')}</label>
                <input type="text" className="ps-modern-input" value={formData.nuitsfin || ''} onChange={(e) => handleInputChange('nuitsfin', e.target.value)} />
              </div>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '1.5rem', fontStyle: 'italic' }}>
              {t('paramSoc.nuit.plageSpecialeHint')}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <FormControlLabel control={<Checkbox checked={formData.moinsrepas === 1} onChange={(e) => handleInputChange('moinsrepas', e.target.checked ? 1 : 0)} />} label={t('paramSoc.nuit.diminuerPanier')} />
              <FormControlLabel control={<Checkbox checked={formData.ajustupd === '1'} onChange={(e) => handleInputChange('ajustupd', e.target.checked ? '1' : '0')} />} label={t('paramSoc.nuit.compterSortie')} />
              <FormControlLabel control={<Checkbox checked={formData.parretabs === '1'} onChange={(e) => handleInputChange('parretabs', e.target.checked ? '1' : '0')} />} label={t('paramSoc.nuit.exclureNuit')} />
              <FormControlLabel control={<Checkbox checked={formData.parhnuitspec === '1'} onChange={(e) => handleInputChange('parhnuitspec', e.target.checked ? '1' : '0')} />} label={t('paramSoc.nuit.majoreHnuit')} />
            </div>

            <div className="ps-modern-form-group" style={{ marginTop: 3, maxWidth: '200px' }}>
              <label className="ps-modern-label">{t('paramSoc.nuit.seuilMin')}</label>
              <input type="number" className="ps-modern-input" value={formData.parminhjour || 0} onChange={(e) => handleInputChange('parminhjour', Number(e.target.value))} />
            </div>
          </div>
        </div>
      )}

      {/* Save Button Footer - Sticky and prominent */}
      <Box
        sx={{
          position: 'sticky',
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          padding: '2rem',
          background: 'linear-gradient(to top, rgba(255,255,255,1), rgba(255,255,255,0.95))',
          backdropFilter: 'blur(10px)',
          borderTop: '1px solid #e2e8f0',
          zIndex: 1000,
        }}
      >
        <Tooltip title={t('paramSoc.common.saveTooltip')}>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleUpdate}
            disabled={isLoading}
            sx={{
              bgcolor: 'var(--primary)',
              color: 'white',
              fontWeight: 900,
              fontSize: '1.1rem',
              padding: '12px 48px',
              borderRadius: '12px',
              boxShadow: '0 8px 24px rgba(0, 64, 161, 0.3)',
              transition: 'all 0.3s ease',
              '&:hover': {
                boxShadow: '0 12px 32px rgba(0, 64, 161, 0.4)',
                transform: 'translateY(-2px)',
              },
              '&:disabled': {
                bgcolor: '#cbd5e0',
              },
            }}
          >
            {isLoading ? t('paramSoc.common.savingButton') : t('paramSoc.common.saveButton')}
          </Button>
        </Tooltip>
      </Box>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snackbar.severity} sx={{ width: '100%', borderRadius: '12px', fontWeight: 700 }}>{snackbar.message}</Alert>
      </Snackbar>
    </div>
  );
}