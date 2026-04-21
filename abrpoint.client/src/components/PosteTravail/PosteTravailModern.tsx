import { Box, Typography, Switch, Paper } from "@mui/material";
import { useContext, useState, useEffect, useMemo } from "react";
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

import CustomizedSnackbars from "../Snackbar/Snackbar";
import AlertModal from "../AlertModal/AlertModal";
import "./PosteTravailModern.css";

const emptySchedule = [
  { jour: 'Lundi', prefix: 'lun', DebEntree: "", Entrée: "", FinEntree: "", Sortie: "", DebEntree2: "", Entree2: "", Sortie2: "", FinEntree2: "", repasBonus: "0", repos: "0" },
  { jour: 'Mardi', prefix: 'mar', DebEntree: "", Entrée: "", FinEntree: "", Sortie: "", DebEntree2: "", Entree2: "", Sortie2: "", FinEntree2: "", repasBonus: "0", repos: "0" },
  { jour: 'Mercredi', prefix: 'mer', DebEntree: "", Entrée: "", FinEntree: "", Sortie: "", DebEntree2: "", Entree2: "", Sortie2: "", FinEntree2: "", repasBonus: "0", repos: "0" },
  { jour: 'Jeudi', prefix: 'jeu', DebEntree: "", Entrée: "", FinEntree: "", Sortie: "", DebEntree2: "", Entree2: "", Sortie2: "", FinEntree2: "", repasBonus: "0", repos: "0" },
  { jour: 'Vendredi', prefix: 'ven', DebEntree: "", Entrée: "", FinEntree: "", Sortie: "", DebEntree2: "", Entree2: "", Sortie2: "", FinEntree2: "", repasBonus: "0", repos: "0" },
  { jour: 'Samedi', prefix: 'sam', DebEntree: "", Entrée: "", FinEntree: "", Sortie: "", DebEntree2: "", Entree2: "", Sortie2: "", FinEntree2: "", repasBonus: "0", repos: "1" },
  { jour: 'Dimanche', prefix: 'dim', DebEntree: "", Entrée: "", FinEntree: "", Sortie: "", DebEntree2: "", Entree2: "", Sortie2: "", FinEntree2: "", repasBonus: "0", repos: "1" },
];

export default function PosteTravailModern() {
  const [saisieData, setSaisieData] = useState<Poste>({} as Poste);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "info" as "success" | "error" | "warning" | "info"
  });
  const [scheduleData, setScheduleData] = useState<any[]>(emptySchedule);
  const [mode, setMode] = useState<string>("add");
  const [modalOpen, setModalOpen] = useState(false);
  const [toleranceEntry, setToleranceEntry] = useState({ avant: 0, apres: 0 });
  const [toleranceExit, setToleranceExit] = useState({ avant: 0, apres: 0 });
  const [pausesEnabled, setPausesEnabled] = useState(true);
  const [repasEnabled, setRepasEnabled] = useState(true);
  const [sanctionRetard, setSanctionRetard] = useState(true);
  const [bonusPresence, setBonusPresence] = useState(false);

  const { soccod, hasPermission } = useAuth();
  const context = useContext(PosteContext);
  if (!context) throw new Error("PosteContext must be used within a PostProvider");
  const { selectedPoste, setSelectedPoste } = context;

  const canAdd = hasPermission('Paramètres de Temps', 'add');
  const canModify = hasPermission('Paramètres de Temps', 'modify');
  const canDelete = hasPermission('Paramètres de Temps', 'delete');

  if (!hasPermission('Paramètres de Temps', 'consult')) {
    return <AccessDenied message="Vous n'avez pas le droit de consulter les postes de travail." />;
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
        { jour: 'Lundi', prefix: 'lun', DebEntree: poste.lunhdematin, Entrée: poste.lunhdmat, FinEntree: poste.lunhfematin, Sortie: poste.lunhfmat, DebEntree2: poste.lunhdeamidi, Entree2: poste.lunhdam, Sortie2: poste.lunhfam, FinEntree2: poste.lunhfeamidi, repasBonus: poste.lunrepas, repos: poste.lunrepos },
        { jour: 'Mardi', prefix: 'mar', DebEntree: poste.marhdematin, Entrée: poste.marhdmat, FinEntree: poste.marhfematin, Sortie: poste.marhfmat, DebEntree2: poste.marhdeamidi, Entree2: poste.marhdam, Sortie2: poste.marhfam, FinEntree2: poste.marhfeamidi, repasBonus: poste.marrepas, repos: poste.marrepos },
        { jour: 'Mercredi', prefix: 'mer', DebEntree: poste.merhdematin, Entrée: poste.merhdmat, FinEntree: poste.merhfematin, Sortie: poste.merhfmat, DebEntree2: poste.merhdeamidi, Entree2: poste.merhdam, Sortie2: poste.merhfam, FinEntree2: poste.merhfeamidi, repasBonus: poste.merrepas, repos: poste.merrepos },
        { jour: 'Jeudi', prefix: 'jeu', DebEntree: poste.jeuhdematin, Entrée: poste.jeuhdmat, FinEntree: poste.jeuhfematin, Sortie: poste.jeuhfmat, DebEntree2: poste.jeuhdeamidi, Entree2: poste.jeuhdam, Sortie2: poste.jeuhfam, FinEntree2: poste.jeuhfeamidi, repasBonus: poste.jeurepas, repos: poste.jeurepos },
        { jour: 'Vendredi', prefix: 'ven', DebEntree: poste.venhdematin, Entrée: poste.venhdmat, FinEntree: poste.venhfematin, Sortie: poste.venhfmat, DebEntree2: poste.venhdeamidi, Entree2: poste.venhdam, Sortie2: poste.venhfam, FinEntree2: poste.venhfeamidi, repasBonus: poste.venrepas, repos: poste.venrepos },
        { jour: 'Samedi', prefix: 'sam', DebEntree: poste.samhdematin, Entrée: poste.samhdmat, FinEntree: poste.samhfematin, Sortie: poste.samhfmat, DebEntree2: poste.samhdeamidi, Entree2: poste.samhdam, Sortie2: poste.samhfam, FinEntree2: poste.samhfeamidi, repasBonus: poste.samrepas, repos: poste.samrepos },
        { jour: 'Dimanche', prefix: 'dim', DebEntree: poste.dimhdematin, Entrée: poste.dimhdmat, FinEntree: poste.dimhfematin, Sortie: poste.dimhfmat, DebEntree2: poste.dimhdeamidi, Entree2: poste.dimhdam, Sortie2: poste.dimhfam, FinEntree2: poste.dimhfeamidi, repasBonus: poste.dimrepas, repos: poste.dimrepos },
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
    });

    if (mode === "update") {
      updatePoste(mergedData, {
        onSuccess: () => showSnackbar("Poste mis à jour avec succès", "success"),
        onError: (err: any) => showSnackbar(err?.response?.data?.message || "Erreur lors de la mise à jour", "error")
      });
    } else {
      addPoste(mergedData, {
        onSuccess: (res: any) => showSnackbar(res.message, res.success ? "success" : "warning"),
        onError: (err: any) => showSnackbar(err?.response?.data?.message || "Erreur lors de l'ajout", "error")
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
          setModalOpen(false);
          resetForm();
        },
        onError: (err: any) => showSnackbar(err?.response?.data?.message || "Erreur lors de la suppression", "error")
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
        repasBonus: monday.repasBonus
      };
    });
    setScheduleData(updated);
    showSnackbar("Horaires appliqués à tous les jours", "info");
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
      {/* Header Section */}
      <Box className="poste-modern-header">
        <Box>
          <Box className="shift-id-badge">
            <span className="id-tag">{saisieData.codposte || 'NEW'}</span>
            <span className="id-label">Shift ID</span>
          </Box>
          <Typography className="shift-title">{saisieData.libposte || 'Nouveau Poste'}</Typography>
          <Typography className="shift-subtitle">Configuration détaillée du planning de travail</Typography>
        </Box>
        <Box className="header-actions">
          {mode === 'update' && canDelete && (
            <button className="btn-cancel" style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fee2e2' }} onClick={() => setModalOpen(true)}>
              Supprimer
            </button>
          )}
          <button className="btn-cancel" onClick={resetForm}>Annuler</button>
          {((mode === 'add' && canAdd) || (mode === 'update' && canModify)) && (
            <button className="btn-save" onClick={handleSave}>Enregistrer</button>
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
                <Typography className="card-title">Identification</Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 2, flexDirection: 'column' }}>
                <Box>
                  <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#64748b', mb: 0.5 }}>CODE POSTE</Typography>
                  <input className="modern-input" value={saisieData.codposte || ''} onChange={e => setSaisieData({ ...saisieData, codposte: e.target.value })} disabled={mode === 'update' || (mode === 'add' && !canAdd)} />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#64748b', mb: 0.5 }}>LIBELLÉ DU POSTE</Typography>
                  <input className="modern-input" value={saisieData.libposte || ''} onChange={e => setSaisieData({ ...saisieData, libposte: e.target.value })} disabled={(mode === 'add' && !canAdd) || (mode === 'update' && !canModify)} />
                </Box>
              </Box>
            </Paper>

            {/* Tolerance Settings */}
            <Paper className="modern-card">
              <Box className="card-header">
                <span className="material-symbols-outlined">timer</span>
                <Typography className="card-title">Tolérances (min)</Typography>
              </Box>
              <Box className="tolerance-grid">
                <Box>
                  <span className="tolerance-col-title">Entrée</span>
                  <Box className="tolerance-input-group">
                    <span>AVANT</span>
                    <input className="modern-input" type="number" 
                      value={toleranceEntry.avant} 
                      onChange={e => setToleranceEntry({ ...toleranceEntry, avant: Number(e.target.value) })} 
                      disabled={(mode === 'add' && !canAdd) || (mode === 'update' && !canModify)}
                    />
                  </Box>
                  <Box className="tolerance-input-group">
                    <span>APRÈS</span>
                    <input className="modern-input" type="number" 
                      value={toleranceEntry.apres} 
                      onChange={e => setToleranceEntry({ ...toleranceEntry, apres: Number(e.target.value) })} 
                      disabled={(mode === 'add' && !canAdd) || (mode === 'update' && !canModify)}
                    />
                  </Box>
                </Box>
                <Box>
                  <span className="tolerance-col-title">Sortie</span>
                  <Box className="tolerance-input-group">
                    <span>AVANT</span>
                    <input className="modern-input" type="number" 
                      value={toleranceExit.avant} 
                      onChange={e => setToleranceExit({ ...toleranceExit, avant: Number(e.target.value) })} 
                      disabled={(mode === 'add' && !canAdd) || (mode === 'update' && !canModify)}
                    />
                  </Box>
                  <Box className="tolerance-input-group">
                    <span>APRÈS</span>
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

          {/* Rules & Pauses */}
          <Paper className="modern-card">
            <Box>
              <Box className="card-header">
                <span className="material-symbols-outlined">coffee</span>
                <Typography className="card-title">Pauses & Règles</Typography>
              </Box>
              <Box className="rules-container" sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Box className="rule-row" style={{ opacity: ((mode === 'add' && !canAdd) || (mode === 'update' && !canModify)) ? 0.6 : 1 }}>
                  <Box className="rule-label">
                    <Switch checked={pausesEnabled} onChange={e => setPausesEnabled(e.target.checked)} size="small" disabled={(mode === 'add' && !canAdd) || (mode === 'update' && !canModify)} />
                    <span>Pause Auto Avant Travail</span>
                  </Box>
                  <select className="modern-select" disabled={(mode === 'add' && !canAdd) || (mode === 'update' && !canModify)}>
                    <option>15 min</option>
                    <option>30 min</option>
                  </select>
                </Box>
                <Box className="rule-row" style={{ opacity: ((mode === 'add' && !canAdd) || (mode === 'update' && !canModify)) ? 0.6 : 1 }}>
                  <Box className="rule-label">
                    <Switch checked={repasEnabled} onChange={e => setRepasEnabled(e.target.checked)} size="small" disabled={(mode === 'add' && !canAdd) || (mode === 'update' && !canModify)} />
                    <span>Pause Auto Après Travail</span>
                  </Box>
                  <select className="modern-select" disabled={(mode === 'add' && !canAdd) || (mode === 'update' && !canModify)}>
                    <option>15 min</option>
                    <option>30 min</option>
                  </select>
                </Box>
                <Box className="rule-row" style={{ opacity: ((mode === 'add' && !canAdd) || (mode === 'update' && !canModify)) ? 0.6 : 1 }}>
                  <Box className="rule-label">
                    <Switch checked={sanctionRetard} onChange={e => setSanctionRetard(e.target.checked)} size="small" disabled={(mode === 'add' && !canAdd) || (mode === 'update' && !canModify)} />
                    <span>Sanction Retard</span>
                  </Box>
                </Box>
                <Box className="rule-row" style={{ opacity: ((mode === 'add' && !canAdd) || (mode === 'update' && !canModify)) ? 0.6 : 1 }}>
                  <Box className="rule-label">
                    <Switch checked={bonusPresence} onChange={e => setBonusPresence(e.target.checked)} size="small" disabled={(mode === 'add' && !canAdd) || (mode === 'update' && !canModify)} />
                    <span>Bonus Présence</span>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Paper>

          {/* Weekly Schedule Table */}
          <Paper className="modern-card table-card">
            <Box className="table-header-row">
              <Typography className="card-title">Planning Hebdomadaire</Typography>
              {((mode === 'add' && canAdd) || (mode === 'update' && canModify)) && (
                <button className="btn-apply-all" onClick={handleApplyAll}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>content_copy</span>
                  Appliquer à tous les jours (basé sur Lundi)
                </button>
              )}
            </Box>
            <Box className="modern-table-container">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Journée</th>
                    <th>Début Matin</th>
                    <th>Entrée M.</th>
                    <th>Fin M.</th>
                    <th>Sortie M.</th>
                    <th>Début Midi</th>
                    <th>Entrée Midi</th>
                    <th>Sortie PM</th>
                    <th>Fin PM</th>
                    <th>Bonus</th>
                    <th>Repos</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduleData.map((row, idx) => (
                    <tr key={idx} className={row.repos === '1' ? 'row-weekend' : ''}>
                      <td className="row-day">{row.jour}</td>
                      {row.repos === '1' ? (
                        <td colSpan={9} className="weekend-text">Repos hebdomadaire</td>
                      ) : (
                        <>
                          <td><input className="modern-input" style={{ width: 65 }} value={row.DebEntree || ''} onChange={e => handleScheduleChange(idx, 'DebEntree', e.target.value)} disabled={(mode === 'add' && !canAdd) || (mode === 'update' && !canModify)} /></td>
                          <td><input className="modern-input" style={{ width: 65 }} value={row.Entrée || ''} onChange={e => handleScheduleChange(idx, 'Entrée', e.target.value)} disabled={(mode === 'add' && !canAdd) || (mode === 'update' && !canModify)} /></td>
                          <td><input className="modern-input" style={{ width: 65 }} value={row.FinEntree || ''} onChange={e => handleScheduleChange(idx, 'FinEntree', e.target.value)} disabled={(mode === 'add' && !canAdd) || (mode === 'update' && !canModify)} /></td>
                          <td><input className="modern-input" style={{ width: 65 }} value={row.Sortie || ''} onChange={e => handleScheduleChange(idx, 'Sortie', e.target.value)} disabled={(mode === 'add' && !canAdd) || (mode === 'update' && !canModify)} /></td>

                          <td><input className="modern-input" style={{ width: 65 }} value={row.DebEntree2 || ''} onChange={e => handleScheduleChange(idx, 'DebEntree2', e.target.value)} disabled={(mode === 'add' && !canAdd) || (mode === 'update' && !canModify)} /></td>
                          <td><input className="modern-input" style={{ width: 65 }} value={row.Entree2 || ''} onChange={e => handleScheduleChange(idx, 'Entree2', e.target.value)} disabled={(mode === 'add' && !canAdd) || (mode === 'update' && !canModify)} /></td>
                          <td><input className="modern-input" style={{ width: 65 }} value={row.Sortie2 || ''} onChange={e => handleScheduleChange(idx, 'Sortie2', e.target.value)} disabled={(mode === 'add' && !canAdd) || (mode === 'update' && !canModify)} /></td>
                          <td><input className="modern-input" style={{ width: 65 }} value={row.FinEntree2 || ''} onChange={e => handleScheduleChange(idx, 'FinEntree2', e.target.value)} disabled={(mode === 'add' && !canAdd) || (mode === 'update' && !canModify)} /></td>

                          <td><input className="modern-input" style={{ width: 45 }} value={row.repasBonus || '0'} onChange={e => handleScheduleChange(idx, 'repasBonus', e.target.value)} disabled={(mode === 'add' && !canAdd) || (mode === 'update' && !canModify)} /></td>
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
              <Typography className="card-title">Liste des Postes</Typography>
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
                    <span className="poste-id-text">ID {p.codposte}</span>
                    {selectedPoste?.codposte === p.codposte && <span className="material-symbols-outlined" style={{ fontSize: 14 }}>lock</span>}
                  </Box>
                  <Typography className="poste-name-text">{p.libposte}</Typography>
                  <Typography className="poste-desc-text">Poste Actif</Typography>
                </Box>
              ))}
            </Box>
          </Paper>

          {/* Stats Card */}
          <Box className="stats-card-modern">
            <Box className="stats-card-header">
              <span className="material-symbols-outlined">analytics</span>
              <span className="stats-card-label">Aperçu Impact</span>
            </Box>
            <Box>
              <Typography className="stats-value-lg">{postesArray.length * 12}</Typography>
              <Typography className="stats-subtext">Estimations employés assignés</Typography>
            </Box>
            <Box className="progress-bar-bg">
              <Box className="progress-bar-fill" sx={{ width: '78%' }} />
            </Box>
            <Typography className="progress-footer-text">78% de la capacité totale estimée</Typography>
          </Box>
        </Box>
      </Box>

      {/* Confirmation Modal */}
      <AlertModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleDelete}
        message={`Voulez-vous vraiment supprimer le poste "${selectedPoste?.libposte}" ?`}
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