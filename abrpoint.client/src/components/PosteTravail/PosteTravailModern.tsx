import { Box, Typography, Switch, Paper, Collapse, IconButton, Button } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CloseIcon from "@mui/icons-material/Close";
import { useContext, useState, useEffect, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { PosteContext } from "../helper/PostProvider/PostContext";
import { Poste } from "../../models/Poste";
import useGetAllPostes from "../../hooks/posteHooks/useGetAllPostes";
import useGetPoste from "../../hooks/posteHooks/useGetPoste";
import useUpdatePoste from "../../hooks/posteHooks/useUpdatePoste";
import useAddPoste from "../../hooks/posteHooks/useAddPoste";
import useDeletePoste from "../../hooks/posteHooks/useDeletePoste";
import useGetLPoste from "../../hooks/posteHooks/useGetLPoste";
import { useAuth } from "../helper/AuthProvider";
import AccessDenied from "../helper/AccessDenied";
import apiInstance from "../API/apiInstance";

import CustomizedSnackbars from "../Snackbar/Snackbar";
import AlertModal from "../AlertModal/AlertModal";
import OnboardingNextStepHint from "../Dashboard/OnboardingNextStepHint";
import "./PosteTravailModern.css";

const emptySchedule = [
  { jour: 'Lundi', prefix: 'lun', DebEntree: "", Entrée: "", FinEntree: "", Sortie: "", DebEntree2: "", Entree2: "", Sortie2: "", FinEntree2: "", repasBonus: "0", repos: "0", repasDeb: "", repasFin: "" },
  { jour: 'Mardi', prefix: 'mar', DebEntree: "", Entrée: "", FinEntree: "", Sortie: "", DebEntree2: "", Entree2: "", Sortie2: "", FinEntree2: "", repasBonus: "0", repos: "0", repasDeb: "", repasFin: "" },
  { jour: 'Mercredi', prefix: 'mer', DebEntree: "", Entrée: "", FinEntree: "", Sortie: "", DebEntree2: "", Entree2: "", Sortie2: "", FinEntree2: "", repasBonus: "0", repos: "0", repasDeb: "", repasFin: "" },
  { jour: 'Jeudi', prefix: 'jeu', DebEntree: "", Entrée: "", FinEntree: "", Sortie: "", DebEntree2: "", Entree2: "", Sortie2: "", FinEntree2: "", repasBonus: "0", repos: "0", repasDeb: "", repasFin: "" },
  { jour: 'Vendredi', prefix: 'ven', DebEntree: "", Entrée: "", FinEntree: "", Sortie: "", DebEntree2: "", Entree2: "", Sortie2: "", FinEntree2: "", repasBonus: "0", repos: "0", repasDeb: "", repasFin: "" },
  { jour: 'Samedi', prefix: 'sam', DebEntree: "", Entrée: "", FinEntree: "", Sortie: "", DebEntree2: "", Entree2: "", Sortie2: "", FinEntree2: "", repasBonus: "0", repos: "1", repasDeb: "", repasFin: "" },
  { jour: 'Dimanche', prefix: 'dim', DebEntree: "", Entrée: "", FinEntree: "", Sortie: "", DebEntree2: "", Entree2: "", Sortie2: "", FinEntree2: "", repasBonus: "0", repos: "1", repasDeb: "", repasFin: "" },
];

export default function PosteTravailModern() {
  const { t } = useTranslation();
  const [saisieData, setSaisieData] = useState<Poste>({} as Poste);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "info" as "success" | "error" | "warning" | "info"
  });
  const [scheduleData, setScheduleData] = useState<any[]>(emptySchedule);
  const [mode, setMode] = useState<string>("add");
  const [showGuide, setShowGuide] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [toleranceEntry, setToleranceEntry] = useState({ avant: 0, apres: 0 });
  const [toleranceExit, setToleranceExit] = useState({ avant: 0, apres: 0 });

  const { soccod, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const context = useContext(PosteContext);
  if (!context) throw new Error("PosteContext must be used within a PostProvider");
  const { selectedPoste, setSelectedPoste } = context;

  const canAdd = hasPermission('Paramètres de Temps', 'add');
  const canModify = hasPermission('Paramètres de Temps', 'modify');
  const canDelete = hasPermission('Paramètres de Temps', 'delete');

  if (!hasPermission('Paramètres de Temps', 'consult')) {
    return <AccessDenied message={t('posteTravail.noConsultRight')} />;
  }

  const { data: poste } = useGetAllPostes(selectedPoste?.codposte);
  const { data: lposte } = useGetLPoste(selectedPoste?.codposte);
  const { data: postesList = [] } = useGetPoste();
  const { mutate: updatePoste } = useUpdatePoste();
  const { mutate: addPoste } = useAddPoste();
  const { mutate: deletePoste } = useDeletePoste();

  useEffect(() => {
    if (poste) {
      // Ensure libposte is preserved if missing from the detailed response
      setSaisieData(prev => ({
        ...prev,
        ...poste,
        libposte: poste.libposte || selectedPoste?.libposte || prev.libposte
      }));
      
      setScheduleData([
        { jour: 'Lundi', prefix: 'lun', DebEntree: poste.lunhdematin, Entrée: poste.lunhdmat, FinEntree: poste.lunhfematin, Sortie: poste.lunhfmat, DebEntree2: poste.lunhdeamidi, Entree2: poste.lunhdam, Sortie2: poste.lunhfam, FinEntree2: poste.lunhfeamidi, repasBonus: poste.lunrepas, repos: poste.lunrepos, repasDeb: (poste as any).lunhdrep ?? '', repasFin: (poste as any).lunhfrep ?? '' },
        { jour: 'Mardi', prefix: 'mar', DebEntree: poste.marhdematin, Entrée: poste.marhdmat, FinEntree: poste.marhfematin, Sortie: poste.marhfmat, DebEntree2: poste.marhdeamidi, Entree2: poste.marhdam, Sortie2: poste.marhfam, FinEntree2: poste.marhfeamidi, repasBonus: poste.marrepas, repos: poste.marrepos, repasDeb: (poste as any).marhdrep ?? '', repasFin: (poste as any).marhfrep ?? '' },
        { jour: 'Mercredi', prefix: 'mer', DebEntree: poste.merhdematin, Entrée: poste.merhdmat, FinEntree: poste.merhfematin, Sortie: poste.merhfmat, DebEntree2: poste.merhdeamidi, Entree2: poste.merhdam, Sortie2: poste.merhfam, FinEntree2: poste.merhfeamidi, repasBonus: poste.merrepas, repos: poste.merrepos, repasDeb: (poste as any).merhdrep ?? '', repasFin: (poste as any).merhfrep ?? '' },
        { jour: 'Jeudi', prefix: 'jeu', DebEntree: poste.jeuhdematin, Entrée: poste.jeuhdmat, FinEntree: poste.jeuhfematin, Sortie: poste.jeuhfmat, DebEntree2: poste.jeuhdeamidi, Entree2: poste.jeuhdam, Sortie2: poste.jeuhfam, FinEntree2: poste.jeuhfeamidi, repasBonus: poste.jeurepas, repos: poste.jeurepos, repasDeb: (poste as any).jeuhdrep ?? '', repasFin: (poste as any).jeuhfrep ?? '' },
        { jour: 'Vendredi', prefix: 'ven', DebEntree: poste.venhdematin, Entrée: poste.venhdmat, FinEntree: poste.venhfematin, Sortie: poste.venhfmat, DebEntree2: poste.venhdeamidi, Entree2: poste.venhdam, Sortie2: poste.venhfam, FinEntree2: poste.venhfeamidi, repasBonus: poste.venrepas, repos: poste.venrepos, repasDeb: (poste as any).venhdrep ?? '', repasFin: (poste as any).venhfrep ?? '' },
        { jour: 'Samedi', prefix: 'sam', DebEntree: poste.samhdematin, Entrée: poste.samhdmat, FinEntree: poste.samhfematin, Sortie: poste.samhfmat, DebEntree2: poste.samhdeamidi, Entree2: poste.samhdam, Sortie2: poste.samhfam, FinEntree2: poste.samhfeamidi, repasBonus: poste.samrepas, repos: poste.samrepos, repasDeb: (poste as any).samhdrep ?? '', repasFin: (poste as any).samhfrep ?? '' },
        { jour: 'Dimanche', prefix: 'dim', DebEntree: poste.dimhdematin, Entrée: poste.dimhdmat, FinEntree: poste.dimhfematin, Sortie: poste.dimhfmat, DebEntree2: poste.dimhdeamidi, Entree2: poste.dimhdam, Sortie2: poste.dimhfam, FinEntree2: poste.dimhfeamidi, repasBonus: poste.dimrepas, repos: poste.dimrepos, repasDeb: (poste as any).dimhdrep ?? '', repasFin: (poste as any).dimhfrep ?? '' },
      ]);
      setMode("update");
    }
  }, [poste, selectedPoste]);

  useEffect(() => {
    if (lposte) {
      setToleranceEntry({ avant: lposte.avantent || 0, apres: lposte.apresent || 0 });
      setToleranceExit({ avant: lposte.avantsort || 0, apres: lposte.apressort || 0 });
    }
  }, [lposte]);

  // Auto-génération du codposte : appelé au mount en mode add et après chaque
  // resetForm. Aligné sur le pattern contrat / congé (cf. SaisieContratModern).
  // Le user voit immédiatement le code qui sera attribué et ne peut pas le modifier.
  const fetchNextCodposte = useCallback(async () => {
    if (!soccod) return;
    try {
      const r = await apiInstance.get(`/Postes/get-next-codposte/${soccod}`);
      if (r.data?.codposte) {
        setSaisieData(prev => ({ ...prev, codposte: r.data.codposte }));
      }
    } catch {
      // Échec silencieux : le user verra "NEW" et la création échouera côté backend
      // si le code est requis — pas de blocage UI car la sauvegarde renvoie un message clair.
    }
  }, [soccod]);

  useEffect(() => {
    if (mode === 'add' && !saisieData.codposte && soccod) {
      fetchNextCodposte();
    }
  }, [mode, saisieData.codposte, soccod, fetchNextCodposte]);

  const showSnackbar = (message: string, severity: "success" | "error" | "warning" | "info") => {
    setSnackbar({ open: true, message, severity });
  };

  const handleScheduleChange = (index: number, field: string, value: any) => {
    const updated = [...scheduleData];
    updated[index][field] = value;
    setScheduleData(updated);
  };

  const handleSave = () => {
    const mergedData: any = {
      ...saisieData,
      soccod,
      avantent: toleranceEntry.avant,
      apresent: toleranceEntry.apres,
      avantsort: toleranceExit.avant,
      apressort: toleranceExit.apres
    };

    scheduleData.forEach((row) => {
      const p = row.prefix;
      mergedData[`${p}hdematin`] = row.DebEntree;
      mergedData[`${p}hdmat`] = row.Entrée;
      mergedData[`${p}hfematin`] = row.FinEntree;
      mergedData[`${p}hfmat`] = row.Sortie;
      mergedData[`${p}hdeamidi`] = row.DebEntree2;
      mergedData[`${p}hdam`] = row.Entree2;
      mergedData[`${p}hfeamidi`] = row.FinEntree2;
      mergedData[`${p}hfam`] = row.Sortie2;
      mergedData[`${p}repas`] = row.repasBonus;
      mergedData[`${p}repos`] = row.repos;
      // Plage repas (déduite des heures travaillées/h.supp en état périodique
      // même si l'employé ne pointe pas sa sortie déjeuner). Colonnes
      // lunhdrep/lunhfrep (et équivalents par jour) déjà présentes en DB.
      mergedData[`${p}hdrep`] = row.repasDeb;
      mergedData[`${p}hfrep`] = row.repasFin;
    });

    if (mode === "update") {
      updatePoste(mergedData, {
        onSuccess: () => {
          showSnackbar(t('posteTravail.msg.updatedSuccess'), "success");
          queryClient.invalidateQueries({ queryKey: ["postes", soccod] });
          queryClient.invalidateQueries({ queryKey: ["all-postes", soccod] });
        },
        onError: (err: any) => showSnackbar(err?.response?.data?.message || t('posteTravail.msg.updateError'), "error")
      });
    } else {
      addPoste(mergedData, {
        onSuccess: (res: any) => {
          showSnackbar(res.message, res.success ? "success" : "warning");
          // Le poste n'apparaît pas dans la liste tant que la query [postes, soccod] reste cachée :
          // on invalide pour que useGetPoste refasse la requête et affiche le nouveau poste.
          queryClient.invalidateQueries({ queryKey: ["postes", soccod] });
          queryClient.invalidateQueries({ queryKey: ["all-postes", soccod] });
          if (res.success && mergedData.codposte) {
            setSelectedPoste({ codposte: mergedData.codposte || '', libposte: mergedData.libposte || '', soccod: soccod || '' });
          }
        },
        onError: (err: any) => showSnackbar(err?.response?.data?.message || t('posteTravail.msg.addError'), "error")
      });
    }
  };

  const handleDelete = () => {
    if (!selectedPoste) return;
    deletePoste(
      { soccod: soccod || '', poscod: selectedPoste.codposte },
      {
        onSuccess: (res) => {
          showSnackbar(res.message, res.success ? "success" : "warning");
          queryClient.invalidateQueries({ queryKey: ["postes", soccod] });
          queryClient.invalidateQueries({ queryKey: ["all-postes", soccod] });
          setModalOpen(false);
          resetForm();
        },
        onError: (err: any) => showSnackbar(err?.response?.data?.message || t('posteTravail.msg.deleteError'), "error")
      }
    );
  };

  const resetForm = () => {
    setSelectedPoste(undefined);
    setSaisieData({ codposte: '', libposte: '', soccod: soccod || '' } as Poste);
    setScheduleData(emptySchedule);
    setToleranceEntry({ avant: 0, apres: 0 });
    setToleranceExit({ avant: 0, apres: 0 });
    setMode("add");
  };

  const handleApplyAll = () => {
    const monday = scheduleData[0];
    if (!monday) return;
    const updated = scheduleData.map((row, idx) => {
      if (idx === 0) return row;
      return {
        ...row,
        DebEntree: monday.DebEntree,
        Entrée: monday.Entrée,
        FinEntree: monday.FinEntree,
        Sortie: monday.Sortie,
        DebEntree2: monday.DebEntree2,
        Entree2: monday.Entree2,
        FinEntree2: monday.FinEntree2,
        Sortie2: monday.Sortie2,
        repasBonus: monday.repasBonus,
        repasDeb: monday.repasDeb,
        repasFin: monday.repasFin,
      };
    });
    setScheduleData(updated);
    showSnackbar(t('posteTravail.msg.appliedAll'), "info");
  };

  const postesArray = useMemo(() => {
    if (!postesList) return [];
    return Object.entries(postesList).map(([codposte, libposte]) => ({
      codposte,
      libposte: String(libposte),
    }));
  }, [postesList]);

  return (
    <Box className="poste-travail-modern-container">
      {/* Bandeau de progression onboarding : étape 1/5 → bascule en mode succès
          dès qu'au moins un poste existe et propose la classe horaire. */}
      <OnboardingNextStepHint
        currentStep="poste"
        dataCount={Object.keys(postesList || {}).length}
      />

      {/* Guide d'utilisation — explique ce qu'est un poste, ce qu'on saisit ici,
          et comment ça s'enchaîne avec la classe horaire / le pointage. Repliable
          (icône ✕) ; bouton "Afficher le guide" pour réafficher. */}
      <Collapse in={showGuide}>
        <Paper elevation={0} sx={{
          mb: 2, p: 2.5, borderRadius: '14px',
          background: 'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 100%)',
          border: '1px solid #bfdbfe',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
            <InfoOutlinedIcon sx={{ color: '#0040a1', fontSize: 22, flexShrink: 0, mt: '2px' }} />
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontWeight: 800, fontSize: 15, color: '#0f172a', mb: 1 }}>
                À quoi sert un poste de travail&nbsp;?
              </Typography>
              <Typography sx={{ fontSize: 13, color: '#334155', lineHeight: 1.55, mb: 1 }}>
                Un <strong>poste</strong> représente un horaire-type (ex.&nbsp;: «&nbsp;Bureau 8h-17h&nbsp;», «&nbsp;Équipe nuit&nbsp;»,
                «&nbsp;Mi-temps matin&nbsp;»). Vous décrivez ici les heures théoriques d'arrivée / sortie
                pour chaque jour de la semaine, ainsi que les tolérances et les sanctions de retard.
                Ces données servent ensuite à&nbsp;:
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2.5, fontSize: 13, color: '#334155', lineHeight: 1.7 }}>
                <li><strong>Calculer le retard / l'absence</strong> à partir des pointages réels (entrée/sortie réelle vs poste).</li>
                <li><strong>Détecter les heures supplémentaires</strong> au-delà des bornes du poste.</li>
                <li><strong>Composer une classe horaire</strong> (rotation hebdomadaire de plusieurs postes) qu'on affecte ensuite à un employé.</li>
              </Box>
              <Typography sx={{ fontSize: 13, color: '#334155', lineHeight: 1.55, mt: 1.5, mb: 0.75, fontWeight: 700 }}>
                Champs clés
              </Typography>
              <Box component="ul" sx={{ m: 0, pl: 2.5, fontSize: 13, color: '#334155', lineHeight: 1.7 }}>
                <li><strong>Code poste</strong> &mdash; généré automatiquement (2 caractères, format paie).</li>
                <li><strong>Libellé</strong> &mdash; nom lisible affiché dans les listes (ex.&nbsp;: «&nbsp;Bureau 8h-17h&nbsp;»).</li>
                <li><strong>Horaires par jour</strong> &mdash; entrée matin, fin matin, reprise après-midi, sortie soir. Laisser vide = jour de repos.</li>
                <li><strong>Tolérances entrée / sortie</strong> &mdash; minutes de marge avant/après l'horaire théorique sans déclencher de retard.</li>
                <li><strong>Sanctions de retard</strong> (matin / après-midi) &mdash; seuil en minutes au-delà duquel un coefficient multiplicateur s'applique au retard pour la paie.</li>
                <li><strong>Repas / repos</strong> &mdash; cases à cocher par jour pour exclure le créneau de pause du calcul des heures travaillées.</li>
              </Box>
              <Box sx={{ mt: 1.5, p: 1.5, borderRadius: '8px', bgcolor: '#fef9c3', border: '1px solid #fde68a' }}>
                <Typography sx={{ fontSize: 12, color: '#854d0e', lineHeight: 1.5 }}>
                  <strong>Étape suivante&nbsp;:</strong> une fois le poste enregistré, allez dans <em>Classe horaire</em>
                  pour le rattacher à une rotation, ou directement dans la fiche d'un employé pour l'affecter.
                </Typography>
              </Box>
            </Box>
            <IconButton size="small" onClick={() => setShowGuide(false)} sx={{ flexShrink: 0 }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Paper>
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

      {/* Header Section */}
      <Box className="poste-modern-header">
        <Box>
          <Box className="shift-id-badge">
            <span className="id-tag">{saisieData.codposte || 'NEW'}</span>
            <span className="id-label">{t('posteTravail.header.shiftId')}</span>
          </Box>
          <Typography className="shift-title">{saisieData.libposte || t('posteTravail.header.newPoste')}</Typography>
          <Typography className="shift-subtitle">{t('posteTravail.header.subtitle')}</Typography>
        </Box>
        <Box className="header-actions">
          {mode === 'update' && canDelete && (
            <button className="btn-cancel" style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fee2e2' }} onClick={() => setModalOpen(true)}>
              {t('posteTravail.header.delete')}
            </button>
          )}
          <button className="btn-cancel" onClick={resetForm}>{t('posteTravail.header.cancel')}</button>
          {((mode === 'add' && canAdd) || (mode === 'update' && canModify)) && (
            <button className="btn-save" onClick={handleSave}>{t('posteTravail.header.save')}</button>
          )}
        </Box>
      </Box>

      {/* Dashboard Grid */}
      <Box className="modern-grid">
        {/* Left Column: Settings */}
        <Box className="main-column" sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
            {/* Poste Info */}
            <Paper className="modern-card">
              <Box className="card-header">
                <span className="material-symbols-outlined">edit</span>
                <Typography className="card-title">{t('posteTravail.identification.title')}</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 2, flexDirection: 'column' }}>
                <Box>
                  <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#64748b', mb: 0.5 }}>{t('posteTravail.identification.codePoste')}</Typography>
                  {/* Code auto-généré côté serveur (cf. /Postes/get-next-codposte) — non éditable, comme num ordre contrat / congé. */}
                  <input className="modern-input" value={saisieData.codposte || ''} readOnly disabled />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#64748b', mb: 0.5 }}>{t('posteTravail.identification.labelPoste')}</Typography>
                  <input className="modern-input" value={saisieData.libposte || ''} onChange={e => setSaisieData({ ...saisieData, libposte: e.target.value })} disabled={(mode === 'add' && !canAdd) || (mode === 'update' && !canModify)} />
                </Box>
              </Box>
            </Paper>

            {/* Tolerance Settings */}
            <Paper className="modern-card">
              <Box className="card-header">
                <span className="material-symbols-outlined">timer</span>
                <Typography className="card-title">{t('posteTravail.tolerance.title')}</Typography>
              </Box>
              <Box className="tolerance-grid">
                <Box>
                  <span className="tolerance-col-title">{t('posteTravail.tolerance.entry')}</span>
                  <Box className="tolerance-input-group">
                    <span>{t('posteTravail.tolerance.before')}</span>
                    <input className="modern-input" type="number"
                      value={toleranceEntry.avant}
                      onChange={e => setToleranceEntry({ ...toleranceEntry, avant: Number(e.target.value) })}
                      disabled={(mode === 'add' && !canAdd) || (mode === 'update' && !canModify)}
                    />
                  </Box>
                  <Box className="tolerance-input-group">
                    <span>{t('posteTravail.tolerance.after')}</span>
                    <input className="modern-input" type="number"
                      value={toleranceEntry.apres}
                      onChange={e => setToleranceEntry({ ...toleranceEntry, apres: Number(e.target.value) })}
                      disabled={(mode === 'add' && !canAdd) || (mode === 'update' && !canModify)}
                    />
                  </Box>
                </Box>
                <Box>
                  <span className="tolerance-col-title">{t('posteTravail.tolerance.exit')}</span>
                  <Box className="tolerance-input-group">
                    <span>{t('posteTravail.tolerance.before')}</span>
                    <input className="modern-input" type="number"
                      value={toleranceExit.avant}
                      onChange={e => setToleranceExit({ ...toleranceExit, avant: Number(e.target.value) })}
                      disabled={(mode === 'add' && !canAdd) || (mode === 'update' && !canModify)}
                    />
                  </Box>
                  <Box className="tolerance-input-group">
                    <span>{t('posteTravail.tolerance.after')}</span>
                    <input className="modern-input" type="number"
                      value={toleranceExit.apres}
                      onChange={e => setToleranceExit({ ...toleranceExit, apres: Number(e.target.value) })}
                      disabled={(mode === 'add' && !canAdd) || (mode === 'update' && !canModify)}
                    />
                  </Box>
                </Box>
              </Box>
            </Paper>
          </Box>

          {/* Sanctions de retard — branche les 4 champs réels du modèle Poste :
              retmin / retsanc (matin) et retminam / retsancam (après-midi).
              Logique métier : passé `retmin` minutes de retard sur l'entrée
              matin, le retard est multiplié par `retsanc` dans le calcul de
              présence (ex. retsanc=2 → 1h de retard décomptée comme 2h). */}
          <Paper className="modern-card">
            <Box>
              <Box className="card-header">
                <span className="material-symbols-outlined">gavel</span>
                <Typography className="card-title">
                  {t('posteTravail.sanction.title', { defaultValue: 'Sanctions de retard' })}
                </Typography>
              </Box>
              <Box className="tolerance-grid">
                <Box>
                  <span className="tolerance-col-title">
                    {t('posteTravail.sanction.morning', { defaultValue: 'Matin' })}
                  </span>
                  <Box className="tolerance-input-group">
                    <span>{t('posteTravail.sanction.threshold', { defaultValue: 'Seuil (min)' })}</span>
                    <input className="modern-input" type="number" min={0}
                      value={saisieData.retmin ?? 0}
                      onChange={e => setSaisieData({ ...saisieData, retmin: Number(e.target.value) })}
                      disabled={(mode === 'add' && !canAdd) || (mode === 'update' && !canModify)}
                    />
                  </Box>
                  <Box className="tolerance-input-group">
                    <span>{t('posteTravail.sanction.coef', { defaultValue: 'Coefficient' })}</span>
                    <input className="modern-input" type="number" min={1} step="0.1"
                      value={saisieData.retsanc ?? 1}
                      onChange={e => setSaisieData({ ...saisieData, retsanc: Number(e.target.value) })}
                      disabled={(mode === 'add' && !canAdd) || (mode === 'update' && !canModify)}
                    />
                  </Box>
                </Box>
                <Box>
                  <span className="tolerance-col-title">
                    {t('posteTravail.sanction.afternoon', { defaultValue: 'Après-midi' })}
                  </span>
                  <Box className="tolerance-input-group">
                    <span>{t('posteTravail.sanction.threshold', { defaultValue: 'Seuil (min)' })}</span>
                    <input className="modern-input" type="number" min={0}
                      value={saisieData.retminam ?? 0}
                      onChange={e => setSaisieData({ ...saisieData, retminam: Number(e.target.value) })}
                      disabled={(mode === 'add' && !canAdd) || (mode === 'update' && !canModify)}
                    />
                  </Box>
                  <Box className="tolerance-input-group">
                    <span>{t('posteTravail.sanction.coef', { defaultValue: 'Coefficient' })}</span>
                    <input className="modern-input" type="number" min={1} step="0.1"
                      value={saisieData.retsancam ?? 1}
                      onChange={e => setSaisieData({ ...saisieData, retsancam: Number(e.target.value) })}
                      disabled={(mode === 'add' && !canAdd) || (mode === 'update' && !canModify)}
                    />
                  </Box>
                </Box>
              </Box>
              <Typography sx={{ fontSize: '11px', color: '#64748b', mt: 1.5, fontStyle: 'italic' }}>
                {t('posteTravail.sanction.hint', { defaultValue: 'Le retard est multiplié par le coefficient au-delà du seuil. Ex. coefficient 2 : 1 h de retard est décomptée comme 2 h.' })}
              </Typography>
            </Box>
          </Paper>

          {/* Weekly Schedule Table */}
          <Paper className="modern-card table-card">
            <Box className="table-header-row">
              <Typography className="card-title">{t('posteTravail.schedule.title')}</Typography>
              {((mode === 'add' && canAdd) || (mode === 'update' && canModify)) && (
                <button className="btn-apply-all" onClick={handleApplyAll}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>content_copy</span>
                  {t('posteTravail.schedule.applyAll')}
                </button>
              )}
            </Box>
            <Box className="modern-table-container">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>{t('posteTravail.schedule.headers.day')}</th>
                    <th>{t('posteTravail.schedule.headers.startMorning')}</th>
                    <th>{t('posteTravail.schedule.headers.entryMorning')}</th>
                    <th>{t('posteTravail.schedule.headers.endMorning')}</th>
                    <th>{t('posteTravail.schedule.headers.exitMorning')}</th>
                    <th>{t('posteTravail.schedule.headers.startNoon')}</th>
                    <th>{t('posteTravail.schedule.headers.entryNoon')}</th>
                    <th>{t('posteTravail.schedule.headers.exitPm')}</th>
                    <th>{t('posteTravail.schedule.headers.endPm')}</th>
                    <th>{t('posteTravail.schedule.headers.mealStart', { defaultValue: 'Début repas' })}</th>
                    <th>{t('posteTravail.schedule.headers.mealEnd', { defaultValue: 'Fin repas' })}</th>
                    <th>{t('posteTravail.schedule.headers.meal')}</th>
                    <th>{t('posteTravail.schedule.headers.rest')}</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduleData.map((row, idx) => (
                    <tr key={idx} className={row.repos === '1' ? 'row-weekend' : ''}>
                      <td className="row-day">{row.jour}</td>
                      {row.repos === '1' ? (
                        <td colSpan={11} className="weekend-text">{t('posteTravail.schedule.weeklyRest')}</td>
                      ) : (
                        <>
                          <td><input type="time" className="modern-input" style={{ width: 90 }} value={row.DebEntree || ''} onChange={e => handleScheduleChange(idx, 'DebEntree', e.target.value)} disabled={(mode === 'add' && !canAdd) || (mode === 'update' && !canModify)} /></td>
                          <td><input type="time" className="modern-input" style={{ width: 90 }} value={row.Entrée || ''} onChange={e => handleScheduleChange(idx, 'Entrée', e.target.value)} disabled={(mode === 'add' && !canAdd) || (mode === 'update' && !canModify)} /></td>
                          <td><input type="time" className="modern-input" style={{ width: 90 }} value={row.FinEntree || ''} onChange={e => handleScheduleChange(idx, 'FinEntree', e.target.value)} disabled={(mode === 'add' && !canAdd) || (mode === 'update' && !canModify)} /></td>
                          <td><input type="time" className="modern-input" style={{ width: 90 }} value={row.Sortie || ''} onChange={e => handleScheduleChange(idx, 'Sortie', e.target.value)} disabled={(mode === 'add' && !canAdd) || (mode === 'update' && !canModify)} /></td>

                          <td><input type="time" className="modern-input" style={{ width: 90 }} value={row.DebEntree2 || ''} onChange={e => handleScheduleChange(idx, 'DebEntree2', e.target.value)} disabled={(mode === 'add' && !canAdd) || (mode === 'update' && !canModify)} /></td>
                          <td><input type="time" className="modern-input" style={{ width: 90 }} value={row.Entree2 || ''} onChange={e => handleScheduleChange(idx, 'Entree2', e.target.value)} disabled={(mode === 'add' && !canAdd) || (mode === 'update' && !canModify)} /></td>
                          <td><input type="time" className="modern-input" style={{ width: 90 }} value={row.Sortie2 || ''} onChange={e => handleScheduleChange(idx, 'Sortie2', e.target.value)} disabled={(mode === 'add' && !canAdd) || (mode === 'update' && !canModify)} /></td>
                          <td><input type="time" className="modern-input" style={{ width: 90 }} value={row.FinEntree2 || ''} onChange={e => handleScheduleChange(idx, 'FinEntree2', e.target.value)} disabled={(mode === 'add' && !canAdd) || (mode === 'update' && !canModify)} /></td>

                          {/* Début/Fin repas : si renseignés, les heures de cette plage
                              sont éliminées de Tothre + H.Sup en état périodique
                              même si l'employé n'a pas pointé sa sortie déjeuner. */}
                          <td><input type="time" className="modern-input" style={{ width: 90 }} value={row.repasDeb || ''} onChange={e => handleScheduleChange(idx, 'repasDeb', e.target.value)} disabled={(mode === 'add' && !canAdd) || (mode === 'update' && !canModify)} /></td>
                          <td><input type="time" className="modern-input" style={{ width: 90 }} value={row.repasFin || ''} onChange={e => handleScheduleChange(idx, 'repasFin', e.target.value)} disabled={(mode === 'add' && !canAdd) || (mode === 'update' && !canModify)} /></td>

                          <td><input className="modern-input" style={{ width: 55 }} type="number" min="0" value={row.repasBonus || '0'} onChange={e => handleScheduleChange(idx, 'repasBonus', e.target.value)} disabled={(mode === 'add' && !canAdd) || (mode === 'update' && !canModify)} /></td>
                        </>
                      )}
                      <td>
                        <Switch checked={row.repos === '1'} onChange={e => handleScheduleChange(idx, 'repos', e.target.checked ? '1' : '0')} size="small" disabled={(mode === 'add' && !canAdd) || (mode === 'update' && !canModify)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          </Paper>
        </Box>

        {/* Right Column: Sidebar Shifts */}
        <Box className="side-column" sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Paper className="modern-card">
            <Box className="list-header">
              <Typography className="card-title">{t('posteTravail.list.title')}</Typography>
              {canAdd && (
                <button className="btn-add-poste" onClick={resetForm}>
                  <span className="material-symbols-outlined">add</span>
                </button>
              )}
            </Box>
            <Box className="poste-items-list">
              {postesArray.map((p: any) => (
                <Box
                  key={p.codposte}
                  className={`poste-item-card ${selectedPoste?.codposte === p.codposte ? 'poste-item-active' : 'poste-item-inactive'}`}
                  onClick={() => setSelectedPoste(p)}
                >
                  <Box className="poste-item-header">
                    <span className="poste-id-text">{t('posteTravail.list.idPrefix', { id: p.codposte })}</span>
                    {selectedPoste?.codposte === p.codposte && <span className="material-symbols-outlined" style={{ fontSize: 14 }}>lock</span>}
                  </Box>
                  <Typography className="poste-name-text">{p.libposte}</Typography>
                  <Typography className="poste-desc-text">{t('posteTravail.list.active')}</Typography>
                </Box>
              ))}
            </Box>
          </Paper>

          {/* Carte "Aperçu Impact" retirée : les valeurs étaient des estimations
              fictives (postes × 12, 78% en dur) sans rattachement à de la donnée réelle. */}
        </Box>
      </Box>

      {/* Confirmation Modal */}
      <AlertModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleDelete}
        message={t('posteTravail.confirmDelete', { label: selectedPoste?.libposte ?? '' })}
      />

      <CustomizedSnackbars
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      />
    </Box>
  );
}