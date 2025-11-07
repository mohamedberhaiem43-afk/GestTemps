import { Alert, Box, Grid, IconButton, Snackbar } from "@mui/material";
import InputComponent from "../../Inputs/Input";
import SelectInputComponent from "../../SelectInputComponent/SelectInputComponent";
import axios from "axios";
import { useEffect, useState } from "react";
import {  useDateMoisPointageRange } from "./FilterPointageMoisContext";
import useGetEmployeesLibs from "../../../hooks/employeHooks/useGetEmployeesLibs";
import { Search } from "@mui/icons-material";
import './WeeklyHoursTable.css'
import { useAuth } from "../../helper/AuthProvider";

function FilterPointageMois() {
    const token = localStorage.getItem('authToken');
    const { soccod } = useAuth();
    const headers = { Authorization: `Bearer ${token}` };
    // Add this new state
    const [selectedEmpcods, setSelectedEmpcods] = useState<string[]>([]);
    const { data: employeesLibs = [] } = useGetEmployeesLibs();

    const regime = {
        'M': "Mensuelle",
        'H': "Horaire"
    };
    const semaine = {
        '0': "Toute",
        '1': "SEM 1",
        '2': "SEM 2",
        '3': "SEM 3",
        '4': "SEM 4",
        '5': "SEM 5",
        '6': "SEM 6",
    };
    const [paramMois, setParamMois] = useState({ joudeb: '01', joufin: '28', moisdeb: 'P', moisfin: 'P' });

    
    const [filiale, setFiliale] = useState<Record<string,string>>();
    const [services, setServices] = useState<Record<string,string>>();
    const dateRangeContext = useDateMoisPointageRange();
    const setDateRange = dateRangeContext?.setDateRange;


    // Remove the local dateRange state and use these instead:
    const [mois, setMois] = useState((new Date().getMonth()+1).toString());
    // Removed unused setDebMois state
    const [dateDebut, setStartDate] = useState('');
    const [dateFin, setEndDate] = useState('');
    const [annee, setAnnee] = useState(new Date().getFullYear().toString());
    const [selectedFiliale, setSelectedFiliale] = useState(sessionStorage.getItem('sitcod'));
    const [selectedService, setSelectedService] = useState('');
    const [selectedRegime, setSelectedRegime] = useState('');
    const [selectedSemaine, setSelectedSemaine] = useState('0');
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
   // Memoize mois and selectedSemaine values
 const handleSnackbarClose = () => {
        setSnackbarOpen(false);
    };
    useEffect(() => {
        axios.get(`${import.meta.env.VITE_REACT_APP_API_URL}/Sites/get-sitlibs`)
            .then((res) => setFiliale(res.data))
            .catch((err) => console.error(err));

        axios.get(`${import.meta.env.VITE_REACT_APP_API_URL}/Parametres/deb-mois/${soccod}`, { headers })
            .then((res) => {
                const { joudeb, joufin, moisdeb, moisfin } = res.data;
                // Removed setDebMois as it is unused
                        setParamMois({ joudeb, joufin, moisdeb, moisfin }); // <-- Save for reuse

                const currentYear = new Date().getFullYear();
                let currentMonth = new Date().getMonth() + 1; // Add 1 to zero-based month

                let startMonth = moisdeb === 'P' ? currentMonth - 1 : currentMonth;
                let endMonth = moisfin === 'P' ? currentMonth - 1: currentMonth;

                let startYear = startMonth === 0 ? currentYear - 1 : currentYear;
                let endYear = endMonth === 0 ? currentYear - 1 : currentYear;

                startMonth = startMonth === 0 ? 12 : startMonth;
                endMonth = endMonth === 0 ? 12 : endMonth;

                const formattedStartMonth = String(startMonth).padStart(2, '0');
                const formattedEndMonth = String(endMonth).padStart(2, '0');

                const initialDateDebut = `${startYear}-${formattedStartMonth}-${joudeb}`;
                const initialDateFin = `${endYear}-${formattedEndMonth}-${joufin}`;
                //setMois(formattedStartMonth);
                setAnnee(currentYear.toString());
                setStartDate(initialDateDebut);
                setEndDate(initialDateFin);
            })
            .catch((err) => {
                console.error("Error:", err.response ? err.response.data : err.message);
            });
    }, []);

    useEffect(() => {
        axios.get(`${import.meta.env.VITE_REACT_APP_API_URL}/Services/get-servlibs/${soccod}`, { headers })
            .then((res) => setServices(res.data))
            .catch((err) => console.error(err));
    }, [soccod]);

    // Update dateDebut and dateFin when annee changes
    useEffect(() => {
    if (annee && mois && paramMois.joudeb && paramMois.joufin) {
        const { joudeb, joufin, moisdeb, moisfin } = paramMois;

        const currentMonth = parseInt(mois, 10);
        let startMonth = moisdeb === 'P' ? currentMonth - 1 : currentMonth;
        let endMonth = moisfin === 'P' ? currentMonth - 1 : currentMonth;

        let startYear = startMonth === 0 ? parseInt(annee) - 1 : parseInt(annee);
        let endYear = endMonth === 0 ? parseInt(annee) - 1 : parseInt(annee);

        startMonth = startMonth === 0 ? 12 : startMonth;
        endMonth = endMonth === 0 ? 12 : endMonth;

        const formattedStartMonth = String(startMonth).padStart(2, '0');
        const formattedEndMonth = String(endMonth).padStart(2, '0');

        setStartDate(`${startYear}-${formattedStartMonth}-${joudeb}`);
        setEndDate(`${endYear}-${formattedEndMonth}-${joufin}`);
    }
}, [mois, annee, paramMois]);


 const handleApplyFilter = () => {
        if (selectedEmpcods.length === 0) {
            setSnackbarMessage("Veuillez sélectionner au moins un employé.");
            setSnackbarOpen(true);
            return;
        }

        if (setDateRange) {
            setDateRange(prev => ({
                ...prev,
                dateDebut,
                dateFin,
                selectedFiliale: selectedFiliale ?? '',
                selectedRegime,
                selectedService,
                mois,
                semaine: selectedSemaine,
                annee,
                empcods: selectedEmpcods,
            }));
        }
    };
    return (
        <Box>
            <Grid container direction="row" spacing={2} alignItems="end">
               <Grid item xs={1.5}>
                    <SelectInputComponent
                        label='Employés'
                        value={selectedEmpcods ?? []}
                        setValue={setSelectedEmpcods}
                        maplist={employeesLibs}
                        multiple={true}
                    />
                </Grid>
                <Grid item xs={1.5}>    
                    {filiale && (
                        <SelectInputComponent
                            label='Filiale'
                            value={selectedFiliale ?? ''}
                            setValue={setSelectedFiliale}
                            maplist={filiale}
                        />
                    )}
                </Grid>
                <Grid item xs={1.5}>
                    {services && (
                        <SelectInputComponent
                            label='Service'
                            value={selectedService}
                            setValue={setSelectedService}
                            maplist={services || []}
                        />
                    )}
                </Grid>
                <Grid item xs={1.5}>
                    <SelectInputComponent
                        label='Régime'
                        value={selectedRegime}
                        setValue={setSelectedRegime}
                        maplist={regime}
                    />
                </Grid>
                <Grid item xs={0.6}>
                    <InputComponent
                        type='number'
                        label='Mois'
                        value={mois}
                        setValue={setMois}
                    />
                </Grid>
                <Grid item xs={0.9}>
                    <InputComponent
                        type='number'
                        label='Année'
                        value={annee}
                        setValue={setAnnee}
                    />
                </Grid>
                <Grid item xs={1}>
                    <InputComponent
                        type='date'
                        label='Date Début'
                        value={dateDebut}
                        setValue={setStartDate}
                    />
                </Grid>
                <Grid item xs={1}>
                    <InputComponent
                        type='date'
                        label='Date Fin'
                        value={dateFin}
                        setValue={setEndDate}
                    />
                </Grid>
                <Grid item xs={1}>
                    <SelectInputComponent
                        label='Semaine'
                        value={selectedSemaine}
                        setValue={setSelectedSemaine}
                        maplist={semaine}
                    />
                </Grid>
                <Grid item xs={0.5}>
                    <IconButton
                        color="primary"
                        onClick={handleApplyFilter}
                        sx={{ border: '1px solid', borderColor: 'divider' }}
                    >
                        <Search />
                    </IconButton>
                </Grid>
            </Grid>
             {/* ✅ Snackbar for validation */}
            <Snackbar
                open={snackbarOpen}
                autoHideDuration={4000}
                onClose={handleSnackbarClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={handleSnackbarClose} severity="warning" variant="filled">
                    {snackbarMessage}
                </Alert>
            </Snackbar>
        </Box>
    );

}
export default FilterPointageMois;
