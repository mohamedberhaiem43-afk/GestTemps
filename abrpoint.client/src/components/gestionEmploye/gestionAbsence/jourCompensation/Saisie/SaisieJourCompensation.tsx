import {
  Alert,
  Box,
  Button,
  Grid,
  Card,
  CardContent,
  Snackbar,
  Typography,
  CircularProgress,
  TextField,
} from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers";
import dayjs, { Dayjs } from "dayjs";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { useEffect, useState } from "react";
import { useTranslation } from 'react-i18next';
import SaveIcon from "@mui/icons-material/Save";
import RefreshIcon from '@mui/icons-material/Refresh';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import InfoIcon from '@mui/icons-material/Info';
import "./SaisieJourCompensation.css";
import useAddCompensation from "../../../../../hooks/compensationHooks/useAddCompensation";
import useGetCompensations from "../../../../../hooks/compensationHooks/useGetCompensations";
import useGetAbsencesLibs from "../../../../../hooks/absenceHooks/useGetAbsenceLibs";
import useGetEmployee from "../../../../../hooks/employeHooks/useGetEmployee";
import { useCompensationContext } from "../../../../helper/CompensationContext";
import useUpdateCompensation from "../../../../../hooks/compensationHooks/useUpdateCompensation";
import InputComponent from "../../../../Inputs/Input";
import SelectInputComponent from "../../../../SelectInputComponent/SelectInputComponent";
import { Compenser } from "../../../../../Compense";
import DateTimeRangeInput from "./DateTimeRangeInput";
import { useAuth } from "../../../../helper/AuthProvider";

const calculateHourDifference = (start: Dayjs | null, end: Dayjs | null) => {
  if (dayjs.isDayjs(start) && dayjs.isDayjs(end)) {
    return end.diff(start, "hour", true);
  }
  return 0;
};

export default function SaisieJourCompensation() {
  const { t } = useTranslation();
  const { selectedCompensation, setSelectedCompensation } = useCompensationContext();
  const { soccod } = useAuth();
  
  const [empcod, setEmpcod] = useState("");
  const [concod, setConcod] = useState("");
  const [conmotif, setConmotif] = useState("");
  const [connbheures, setConnbheures] = useState(0);
  const [abscod, setAbscod] = useState("");
  const [ref, setRef] = useState("");
  const [condat, setCondat] = useState<[Dayjs, Dayjs]>([dayjs(), dayjs()]);
  const [mode, setMode] = useState('save');
  const [writable, setWritable] = useState(true);
  const [isSnackbarOpen, setIsSnackbarOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [severity, setSeverity] = useState<'success' | 'error'>('success');
  const [isLoading, setIsLoading] = useState(false);

  const addCompensation = useAddCompensation();
  const { refetch } = useGetCompensations();
  const { data: absences = [] } = useGetAbsencesLibs();
  const { data: employes = [] } = useGetEmployee();
  const { mutate: updateCompensation } = useUpdateCompensation();

  useEffect(() => {
    if (selectedCompensation) {
      setAbscod(selectedCompensation.abscod || "");
      setConcod(selectedCompensation.concod || "");
      setRef(selectedCompensation.conref || "");
      setConmotif(selectedCompensation.conmotif || "");
      setEmpcod(selectedCompensation.empcod || "");
      setConnbheures(selectedCompensation.connbjour || 0);
      
      if (selectedCompensation.condep && selectedCompensation.conret) {
        const startDate = dayjs(selectedCompensation.condep);
        const endDate = dayjs(selectedCompensation.conret);
        setCondat([startDate.isValid() ? startDate : dayjs(), endDate.isValid() ? endDate : dayjs()]);
      } else {
        setCondat([dayjs(), dayjs()]);
      }
      setWritable(false);
      setMode("edit");
    }
  }, [selectedCompensation]);

  useEffect(() => {
    const x = calculateHourDifference(condat[0], condat[1]);
    setConnbheures(x);
  }, [condat]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!condat[0] || !condat[1]) {
      handleSnackbarOpening("Veuillez sélectionner des dates valides", "error");
      return;
    }

    setIsLoading(true);

    const data: Compenser = {
      soccod: soccod || "",
      empcod: empcod,
      concod: concod,
      abscod: abscod,
      conref: ref,
      conmotif: conmotif,
      condat: condat[0].format("YYYY-MM-DD"),
      condep: condat[0].toISOString(),
      conret: condat[1].toISOString(),
      connbjour: connbheures,
    };

    if (mode === 'save') {
      addCompensation.mutate(data, {
        onSuccess() {
          handleSnackbarOpening("Compensation ajoutée avec succès", 'success');
          resetForm();
          setIsLoading(false);
        },
        onError() {
          handleSnackbarOpening("Échec d'ajout de la compensation", 'error');
          setIsLoading(false);
        }
      });
    } else if (mode === 'edit') {
      updateCompensation(data, {
        onSuccess: () => {
          handleSnackbarOpening("Compensation modifiée avec succès", 'success');
          resetForm();
          setIsLoading(false);
        },
        onError() {
          handleSnackbarOpening("Erreur lors de modification de la compensation", 'error');
          setIsLoading(false);
        },
      });
    }
  };

  const resetForm = () => {
    setAbscod('');
    setConcod('');
    setConmotif('');
    setRef('');
    setEmpcod('');
    setCondat([dayjs(), dayjs()]);
    setWritable(true);
    setMode('save');
    setSelectedCompensation(null);
    refetch();
  };

  const handleSnackbarOpening = (message: string, severity: 'success' | 'error') => {
    setMessage(message);
    setSeverity(severity);
    setIsSnackbarOpen(true);
  };

  const handleSnackbarClose = () => {
    setIsSnackbarOpen(false);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box component="form" onSubmit={handleSave} sx={{ mx: "auto" }}>
        
        {/* En-tête avec Actions */}
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              onClick={resetForm}
              color="secondary"
              startIcon={<RefreshIcon />}
            >
              Nouveau
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isLoading}
              startIcon={isLoading ? <CircularProgress size={20} /> : <SaveIcon />}
            >
              Enregistrer
            </Button>
          </Box>
        </Box>

        {/* Card principale */}
        <Card sx={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: 2 }}>
          <CardContent sx={{ p: 3 }}>
            
            {/* Les 3 sections en ligne */}
            <Grid container spacing={2} sx={{ mb: 3 }} wrap="nowrap" alignItems="flex-start">
              
              {/* Section 1: Informations Générales */}
              <Grid item xs={4}>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: '#666', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AssignmentIcon fontSize="small" /> Informations Générales
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <InputComponent
                        readOnly={!writable}
                        type='text'
                        label={t('common.orderNumber')}
                        value={concod}
                        setValue={setConcod}
                      />
                    </Grid>
                    <Grid item xs={6} mt={1}>
                      <SelectInputComponent
                        label={t('common.employee')}
                        value={empcod}
                        setValue={setEmpcod}
                        maplist={employes}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <InputComponent
                        type='text'
                        label={t('common.ref')}
                        value={ref}
                        setValue={setRef}
                      />
                    </Grid>
                  </Grid>
                </Box>
              </Grid>

              {/* Section 2: Période à Compenser */}
              <Grid item xs={4}>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: '#666', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AccessTimeIcon fontSize="small" /> Journée à Compenser
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <DateTimeRangeInput
                        value={[condat[0].format("YYYY-MM-DDTHH:mm"), condat[1].format("YYYY-MM-DDTHH:mm")]}
                        onChange={(newRange) => setCondat([dayjs(newRange[0]), dayjs(newRange[1])])}
                        disabled={!writable}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        label="Nombre d'heures"
                        size="small"
                        fullWidth
                        value={`${connbheures.toFixed(2)} heures`}
                        InputProps={{
                          readOnly: true,
                          sx: {
                            backgroundColor: '#f5f5f5',
                            fontWeight: 600,
                            fontSize: '1rem',
                            color: '#1976d2'
                          }
                        }}
                      />
                    </Grid>
                  </Grid>
                </Box>
              </Grid>

              {/* Section 3: Type et Motif */}
              <Grid item xs={4}>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: '#666', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <InfoIcon fontSize="small" /> Type et Motif
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <SelectInputComponent
                        label={t('common.imputation')}
                        value={abscod}
                        setValue={setAbscod}
                        maplist={absences}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <InputComponent
                        type='text'
                        label={t('common.reason')}
                        value={conmotif}
                        setValue={setConmotif}
                      />
                    </Grid>
                  </Grid>
                </Box>
              </Grid>

            </Grid>

          </CardContent>
        </Card>

        {/* Snackbar */}
        <Snackbar open={isSnackbarOpen} autoHideDuration={1500} onClose={handleSnackbarClose}>
          <Alert onClose={handleSnackbarClose} severity={severity}>
            {message}
          </Alert>
        </Snackbar>
      </Box>
    </LocalizationProvider>
  );
}