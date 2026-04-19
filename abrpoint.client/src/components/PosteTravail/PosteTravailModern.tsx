import { Box, Button, IconButton, TextField, Typography, Switch, FormControlLabel, Chip, Paper } from "@mui/material";
import { useContext, useState, useEffect } from "react";
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
import SaveIcon from "@mui/icons-material/Save";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CustomizedSnackbars from "../Snackbar/Snackbar";
import AlertModal from "../AlertModal/AlertModal";
import "./PosteTravailModern.css";

const emptySchedule = [
  { jour: 'Lundi', DebEntree: "", Entrée: "", FinEntree: "", Sortie: "", repasBonus: "0", repos: "0", DebEntree2: "", Entree2: "", Sortie2: "", FinEntree2: "", maxhre: "", minhjour: "", minhdemijour: "", Douche: "" },
  { jour: 'Mardi', DebEntree: "", Entrée: "", FinEntree: "", Sortie: "", repasBonus: "0", repos: "0", DebEntree2: "", Entree2: "", Sortie2: "", FinEntree2: "", maxhre: "", minhjour: "", minhdemijour: "", Douche: "" },
  { jour: 'Mercredi', DebEntree: "", Entrée: "", FinEntree: "", Sortie: "", repasBonus: "0", repos: "0", DebEntree2: "", Entree2: "", Sortie2: "", FinEntree2: "", maxhre: "", minhjour: "", minhdemijour: "", Douche: "" },
  { jour: 'Jeudi', DebEntree: "", Entrée: "", FinEntree: "", Sortie: "", repasBonus: "0", repos: "0", DebEntree2: "", Entree2: "", Sortie2: "", FinEntree2: "", maxhre: "", minhjour: "", minhdemijour: "", Douche: "" },
  { jour: 'Vendredi', DebEntree: "", Entrée: "", FinEntree: "", Sortie: "", repasBonus: "0", repos: "0", DebEntree2: "", Entree2: "", Sortie2: "", FinEntree2: "", maxhre: "", minhjour: "", minhdemijour: "", Douche: "" },
  { jour: 'Samedi', DebEntree: "", Entrée: "", FinEntree: "", Sortie: "", repasBonus: "0", repos: "0", DebEntree2: "", Entree2: "", Sortie2: "", FinEntree2: "", maxhre: "", minhjour: "", minhdemijour: "", Douche: "" },
  { jour: 'Dimanche', DebEntree: "", Entrée: "", FinEntree: "", Sortie: "", repasBonus: "0", repos: "0", DebEntree2: "", Entree2: "", Sortie2: "", FinEntree2: "", maxhre: "", minhjour: "", minhdemijour: "", Douche: "" },
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
  const [overtimeEnabled, setOvertimeEnabled] = useState(false);

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

  const { data: poste = {} } = useGetAllPostes(selectedPoste?.codposte);
  const { data: lposte } = useGetLPoste(selectedPoste?.codposte);
  const { data: postesList = [] } = useGetPoste();
  const { mutate: updatePoste } = useUpdatePoste();
  const { mutate: addPoste } = useAddPoste();
  const { mutate: deletePoste } = useDeletePoste();

  // Update schedule data when poste changes
  useEffect(() => {
    if (poste) {
      setScheduleData([
        { jour: 'Lundi', DebEntree: poste?.lunhdematin, Entrée: poste?.lunhdmat, FinEntree: poste?.lunhfematin, Sortie: poste?.lunhfmat, repasBonus: poste?.lunrepas, repos: poste?.lunrepos, DebEntree2: poste?.lunhdeamidi, Entree2: poste?.lunhdam, Sortie2: poste?.lunhfam, FinEntree2: poste?.lunhfeamidi, maxhre: poste?.maxhrelun, minhjour: poste?.minhjourlun, minhdemijour: poste?.minhdemijourlun, Douche: poste?.lundouche },
        { jour: 'Mardi', DebEntree: poste?.marhdematin, Entrée: poste?.marhdmat, FinEntree: poste?.marhfematin, Sortie: poste?.marhfmat, repasBonus: poste?.marrepas, repos: poste?.marrepos, DebEntree2: poste?.marhdeamidi, Entree2: poste?.marhdam, Sortie2: poste?.marhfam, FinEntree2: poste?.marhfeamidi, maxhre: poste?.maxhremar, minhjour: poste?.minhjourmar, minhdemijour: poste?.minhdemijourmar, Douche: poste?.mardouche },
        { jour: 'Mercredi', DebEntree: poste?.merhdematin, Entrée: poste?.merhdmat, FinEntree: poste?.merhfematin, Sortie: poste?.merhfmat, repasBonus: poste?.merrepas, repos: poste?.merrepos, DebEntree2: poste?.merhdeamidi, Entree2: poste?.merhdam, Sortie2: poste?.merhfam, FinEntree2: poste?.merhfeamidi, maxhre: poste?.maxhremer, minhjour: poste?.minhjourmer, minhdemijour: poste?.minhdemijourmer, Douche: poste?.merdouche },
        { jour: 'Jeudi', DebEntree: poste?.jeuhdematin, Entrée: poste?.jeuhdmat, FinEntree: poste?.jeuhfematin, Sortie: poste?.jeuhfmat, repasBonus: poste?.jeurepas, repos: poste?.jeurepos, DebEntree2: poste?.jeuhdeamidi, Entree2: poste?.jeuhdam, Sortie2: poste?.jeuhfam, FinEntree2: poste?.jeuhfeamidi, maxhre: poste?.maxhrejeu, minhjour: poste?.minhjourjeu, minhdemijour: poste?.minhdemijourjeu, Douche: poste?.jeudouche },
        { jour: 'Vendredi', DebEntree: poste?.venhdematin, Entrée: poste?.venhdmat, FinEntree: poste?.venhfematin, Sortie: poste?.venhfmat, repasBonus: poste?.venrepas, repos: poste?.venrepos, DebEntree2: poste?.venhdeamidi, Entree2: poste?.venhdam, Sortie2: poste?.venhfam, FinEntree2: poste?.venhfeamidi, maxhre: poste?.maxhreven, minhjour: poste?.minhjourven, minhdemijour: poste?.minhdemijourven, Douche: poste?.vendouche },
        { jour: 'Samedi', DebEntree: poste?.samhdematin, Entrée: poste?.samhdmat, FinEntree: poste?.samhfematin, Sortie: poste?.samhfmat, repasBonus: poste?.samrepas, repos: poste?.samrepos, DebEntree2: poste?.samhdeamidi, Entree2: poste?.samhdam, Sortie2: poste?.samhfam, FinEntree2: poste?.samhfeamidi, maxhre: poste?.maxhresam, minhjour: poste?.minhjoursam, minhdemijour: poste?.minhdemijoursam, Douche: poste?.samdouche },
        { jour: 'Dimanche', DebEntree: poste?.dimhdematin, Entrée: poste?.dimhdmat, FinEntree: poste?.dimhfematin, Sortie: poste?.dimhfmat, repasBonus: poste?.dimrepas, repos: poste?.dimrepos, DebEntree2: poste?.dimhdeamidi, Entree2: poste?.dimhdam, Sortie2: poste?.dimhfam, FinEntree2: poste?.dimhfeamidi, maxhre: poste?.maxhredim, minhjour: poste?.minhjourdim, minhdemijour: poste?.minhdemijourdim, Douche: poste?.dimdouche },
      ]);
    }
  }, [poste]);

  // Update tolerance from lposte
  useEffect(() => {
    if (lposte) {
      setToleranceEntry({ avant: lposte.avantent || 0, apres: lposte.apresent || 0 });
      setToleranceExit({ avant: lposte.avantsort || 0, apres: lposte.apressort || 0 });
    }
  }, [lposte]);

  // Update saisieData when selectedPoste changes
  useEffect(() => {
    if (selectedPoste) {
      setSaisieData({
        ...saisieData,
        codposte: selectedPoste.codposte || '',
        libposte: selectedPoste.libposte || ''
      });
      setMode("update");
    }
  }, [selectedPoste]);

  const showSnackbar = (message: string, severity: "success" | "error" | "warning" | "info") => {
    setSnackbar({ open: true, message, severity });
  };

  const handleScheduleChange = (index: number, field: string, value: any) => {
    const updated = [...scheduleData];
    updated[index][field] = value;
    setScheduleData(updated);
  };

  const handleSave = () => {
    const scheduleMap: any = {
      0: ["lunhdematin", "lunhdmat", "lunhfematin", "lunhfmat", "lunrepas", "lunrepos", "lunhdeamidi", "lunhdam", "lunhfam", "lunhfeamidi", "maxhrelun", "minhjourlun", "minhdemijourlun", "lundouche"],
      1: ["marhdematin", "marhdmat", "marhfematin", "marhfmat", "marrepas", "marrepos", "marhdeamidi", "marhdam", "marhfam", "marhfeamidi", "maxhremar", "minhjourmar", "minhdemijourmar", "mardouche"],
      2: ["merhdematin", "merhdmat", "merhfematin", "merhfmat", "merrepas", "merrepos", "merhdeamidi", "merhdam", "merhfam", "merhfeamidi", "maxhremer", "minhjourmer", "minhdemijourmer", "merdouche"],
      3: ["jeuhdematin", "jeuhdmat", "jeuhfematin", "jeuhfmat", "jeurepas", "jeurepos", "jeuhdeamidi", "jeuhdam", "jeuhfam", "jeuhfeamidi", "maxhrejeu", "minhjourjeu", "minhdemijourjeu", "jeudouche"],
      4: ["venhdematin", "venhdmat", "venhfematin", "venhfmat", "venrepas", "venrepos", "venhdeamidi", "venhdam", "venhfam", "venhfeamidi", "maxhreven", "minhjourven", "minhdemijourven", "vendouche"],
      5: ["samhdematin", "samhdmat", "samhfematin", "samhfmat", "samrepas", "samrepos", "samhdeamidi", "samhdam", "samhfam", "samhfeamidi", "maxhresam", "minhjoursam", "minhdemijoursam", "samdouche"],
      6: ["dimhdematin", "dimhdmat", "dimhfematin", "dimhfmat", "dimrepas", "dimrepos", "dimhdeamidi", "dimhdam", "dimhfam", "dimhfeamidi", "maxhredim", "minhjourdim", "minhdemijourdim", "dimdouche"]
    };

    const mergedData: any = { 
      ...saisieData, 
      soccod,
      avantent: toleranceEntry.avant,
      apresent: toleranceEntry.apres,
      avantsort: toleranceExit.avant,
      apressort: toleranceExit.apres
    };

    scheduleData.forEach((row, i) => {
      const [debMatin, entreeMatin, finMatin, sortieMatin, repas, repos, debAprem, entreeAprem, sortieAprem, finAprem, maxh, minhjour, minhdemijour, douche] = scheduleMap[i];
      mergedData[debMatin] = row.DebEntree;
      mergedData[entreeMatin] = row.Entrée;
      mergedData[finMatin] = row.FinEntree;
      mergedData[sortieMatin] = row.Sortie;
      mergedData[repas] = row.repasBonus;
      mergedData[repos] = row.repos;
      mergedData[debAprem] = row.DebEntree2;
      mergedData[entreeAprem] = row.Entree2;
      mergedData[sortieAprem] = row.Sortie2;
      mergedData[finAprem] = row.FinEntree2;
      mergedData[maxh] = row.maxhre;
      mergedData[minhjour] = row.minhjour;
      mergedData[minhdemijour] = row.minhdemijour;
      mergedData[douche] = row.Douche;
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
    setSaisieData({} as Poste);
    setScheduleData(emptySchedule);
    setToleranceEntry({ avant: 0, apres: 0 });
    setToleranceExit({ avant: 0, apres: 0 });
    setMode("add");
  };

  const postesArray: any[] = postesList
    ? Object.entries(postesList).map(([codposte, libposte]) => ({
        codposte,
        libposte: String(libposte),
      }))
    : [];

  const activeCount = postesArray.length;
  const workingDays = scheduleData.filter(s => s.repos !== '1').length;

  return (
    <Box className="poste-travail-container">
      {/* Header */}
      <Box className="poste-header">
        <Box className="poste-header-left">
          <Typography className="poste-title">Gestion poste de travail</Typography>
          {selectedPoste && (
            <Chip 
              label={`Shift ID: ${selectedPoste.codposte}`} 
              className="poste-chip"
              icon={<AccessTimeIcon />}
            />
          )}
        </Box>
        <Box className="poste-header-actions">
          {((mode === "update" && canModify) || (mode === "add" && canAdd)) && (
            <IconButton className="action-btn save" onClick={handleSave}>
              <SaveIcon />
            </IconButton>
          )}
          {canAdd && (
            <Button className="action-btn new" startIcon={<AddIcon />} onClick={resetForm}>
              Nouveau
            </Button>
          )}
          {canDelete && (
            <Button 
              className="action-btn delete" 
              startIcon={<DeleteIcon />}
              disabled={!selectedPoste}
              onClick={() => setModalOpen(true)}
            >
              Supprimer
            </Button>
          )}
        </Box>
      </Box>

      {/* Main Content */}
      <Box className="poste-content">
        {/* Left Column - 9 cols */}
        <Box className="poste-left-column">
          {/* Code and Label */}
          <Box className="poste-info-row">
            <Box className="poste-field">
              <label>Code</label>
              <TextField
                size="small"
                value={saisieData.codposte || ''}
                onChange={(e) => setSaisieData({ ...saisieData, codposte: e.target.value })}
                variant="outlined"
                className="poste-input"
              />
            </Box>
            <Box className="poste-field poste-field-large">
              <label>Libellé</label>
              <TextField
                size="small"
                value={saisieData.libposte || ''}
                onChange={(e) => setSaisieData({ ...saisieData, libposte: e.target.value })}
                variant="outlined"
                className="poste-input"
                fullWidth
              />
            </Box>
          </Box>

          {/* Tolerance and Pauses Row */}
          <Box className="poste-settings-row">
            {/* Tolerance Entry */}
            <Paper className="poste-card tolerance-card">
              <Typography className="card-title error">Tolérance Entrée</Typography>
              <Box className="tolerance-fields">
                <Box className="tolerance-field">
                  <label>Avant</label>
                  <TextField
                    type="number"
                    size="small"
                    value={toleranceEntry.avant}
                    onChange={(e) => setToleranceEntry({ ...toleranceEntry, avant: Number(e.target.value) })}
                    className="tolerance-input"
                  />
                </Box>
                <Box className="tolerance-field">
                  <label>Après</label>
                  <TextField
                    type="number"
                    size="small"
                    value={toleranceEntry.apres}
                    onChange={(e) => setToleranceEntry({ ...toleranceEntry, apres: Number(e.target.value) })}
                    className="tolerance-input"
                  />
                </Box>
              </Box>
            </Paper>

            {/* Tolerance Exit */}
            <Paper className="poste-card tolerance-card">
              <Typography className="card-title error">Tolérance Sortie</Typography>
              <Box className="tolerance-fields">
                <Box className="tolerance-field">
                  <label>Avant</label>
                  <TextField
                    type="number"
                    size="small"
                    value={toleranceExit.avant}
                    onChange={(e) => setToleranceExit({ ...toleranceExit, avant: Number(e.target.value) })}
                    className="tolerance-input"
                  />
                </Box>
                <Box className="tolerance-field">
                  <label>Après</label>
                  <TextField
                    type="number"
                    size="small"
                    value={toleranceExit.apres}
                    onChange={(e) => setToleranceExit({ ...toleranceExit, apres: Number(e.target.value) })}
                    className="tolerance-input"
                  />
                </Box>
              </Box>
            </Paper>

            {/* Pauses & Rules */}
            <Paper className="poste-card pauses-card">
              <Typography className="card-title">Pauses & Règles</Typography>
              <Box className="pauses-options">
                <FormControlLabel
                  control={<Switch checked={pausesEnabled} onChange={(e) => setPausesEnabled(e.target.checked)} />}
                  label="Pauses automatiques"
                />
                <FormControlLabel
                  control={<Switch checked={repasEnabled} onChange={(e) => setRepasEnabled(e.target.checked)} />}
                  label="Temps repas"
                />
                <FormControlLabel
                  control={<Switch checked={overtimeEnabled} onChange={(e) => setOvertimeEnabled(e.target.checked)} />}
                  label="Heures supplémentaires"
                />
              </Box>
            </Paper>
          </Box>

          {/* Weekly Schedule Table */}
          <Paper className="poste-card schedule-card">
            <Box className="schedule-header">
              <Typography className="card-title">Horaires Hebdomadaires</Typography>
              <Box className="schedule-legend">
                <span className="legend-item"><Box className="legend-dot work" /> Travail</span>
                <span className="legend-item"><Box className="legend-dot rest" /> Repos</span>
              </Box>
            </Box>
            <Box className="schedule-table-container">
              <table className="schedule-table">
                <thead>
                  <tr>
                    <th>Journée</th>
                    <th colSpan={4}>Matin</th>
                    <th colSpan={4}>Après-midi</th>
                    <th>Repas</th>
                    <th>Repos</th>
                    <th>Actions</th>
                  </tr>
                  <tr className="sub-header">
                    <th></th>
                    <th>Début</th>
                    <th>Entrée</th>
                    <th>Fin</th>
                    <th>Sortie</th>
                    <th>Début</th>
                    <th>Entrée</th>
                    <th>Fin</th>
                    <th>Sortie</th>
                    <th></th>
                    <th></th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {scheduleData.map((row, index) => (
                    <tr key={index} className={row.repos === '1' ? 'rest-day' : ''}>
                      <td className="day-cell">{row.jour}</td>
                      <td><TextField size="small" value={row.DebEntree || ''} onChange={(e) => handleScheduleChange(index, 'DebEntree', e.target.value)} /></td>
                      <td><TextField size="small" value={row.Entrée || ''} onChange={(e) => handleScheduleChange(index, 'Entrée', e.target.value)} /></td>
                      <td><TextField size="small" value={row.FinEntree || ''} onChange={(e) => handleScheduleChange(index, 'FinEntree', e.target.value)} /></td>
                      <td><TextField size="small" value={row.Sortie || ''} onChange={(e) => handleScheduleChange(index, 'Sortie', e.target.value)} /></td>
                      <td><TextField size="small" value={row.DebEntree2 || ''} onChange={(e) => handleScheduleChange(index, 'DebEntree2', e.target.value)} /></td>
                      <td><TextField size="small" value={row.Entree2 || ''} onChange={(e) => handleScheduleChange(index, 'Entree2', e.target.value)} /></td>
                      <td><TextField size="small" value={row.Sortie2 || ''} onChange={(e) => handleScheduleChange(index, 'Sortie2', e.target.value)} /></td>
                      <td><TextField size="small" value={row.FinEntree2 || ''} onChange={(e) => handleScheduleChange(index, 'FinEntree2', e.target.value)} /></td>
                      <td><TextField size="small" value={row.repasBonus || '0'} onChange={(e) => handleScheduleChange(index, 'repasBonus', e.target.value)} /></td>
                      <td>
                        <Switch
                          size="small"
                          checked={row.repos === '1'}
                          onChange={(e) => handleScheduleChange(index, 'repos', e.target.checked ? '1' : '0')}
                        />
                      </td>
                      <td>
                        <IconButton size="small" className="edit-btn">
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          </Paper>
        </Box>

        {/* Right Column - 3 cols */}
        <Box className="poste-right-column">
          {/* List of Postes */}
          <Paper className="poste-card list-card">
            <Typography className="card-title">Liste des Postes</Typography>
            <Box className="postes-list">
              {postesArray.map((poste) => (
                <Box
                  key={poste.codposte}
                  className={`poste-item ${selectedPoste?.codposte === poste.codposte ? 'active' : ''}`}
                  onClick={() => setSelectedPoste(poste)}
                >
                  <Box className="poste-item-indicator" />
                  <Box className="poste-item-content">
                    <Typography className="poste-item-code">{poste.codposte}</Typography>
                    <Typography className="poste-item-label">{poste.libposte}</Typography>
                  </Box>
                  {selectedPoste?.codposte === poste.codposte && (
                    <CheckCircleIcon className="poste-item-check" />
                  )}
                </Box>
              ))}
            </Box>
          </Paper>

          {/* Stats Card */}
          <Paper className="poste-card stats-card">
            <Typography className="stats-title">Statistiques</Typography>
            <Box className="stats-grid">
              <Box className="stat-item">
                <Typography className="stat-value">{activeCount}</Typography>
                <Typography className="stat-label">Postes Actifs</Typography>
              </Box>
              <Box className="stat-item">
                <Typography className="stat-value">{workingDays}</Typography>
                <Typography className="stat-label">Jours Travaillés</Typography>
              </Box>
              <Box className="stat-item">
                <Typography className="stat-value">{toleranceEntry.avant + toleranceEntry.apres}</Typography>
                <Typography className="stat-label">Tol. Entrée (min)</Typography>
              </Box>
              <Box className="stat-item">
                <Typography className="stat-value">{toleranceExit.avant + toleranceExit.apres}</Typography>
                <Typography className="stat-label">Tol. Sortie (min)</Typography>
              </Box>
            </Box>
          </Paper>
        </Box>
      </Box>

      {/* Confirmation Modal */}
      <AlertModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleDelete}
        message={`Voulez-vous vraiment supprimer le poste "${selectedPoste?.libposte}" ?`}
      />

      {/* Snackbar */}
      <CustomizedSnackbars
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      />
    </Box>
  );
}