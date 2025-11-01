import { Box, Grid, IconButton } from "@mui/material";
import InputComponent from "../../Inputs/Input";
import SelectInputComponent from "../../SelectInputComponent/SelectInputComponent";
import axios from "axios";
import { useEffect, useState } from "react";
import { useDateRange } from "./FilterContext";
import { Print, Search } from "@mui/icons-material";
import useGetEmployee from "../../../hooks/employeHooks/useGetEmployee";

function FilterEtatPeriodique() {
    const token = localStorage.getItem('authToken');
    const soccod = sessionStorage.getItem('soccod');
    const headers = { Authorization: `Bearer ${token}` };
    const regime = {
        'M': "Mensuelle",
        'H': "Horaire"
    };
    const presence = null;
    const [selectedEmpcods, setSelectedEmpcods] = useState<string[]>([]);
    const [filiale, setFiliale] = useState<Record<string,string>>({});
    const [services, setServices] = useState<Record<string,string>>({});
    const [pres, setPres] = useState('P');
    // Removed unused setDebMois state
    const [dateDebut, setStartDate] = useState(() =>new Date().toISOString().slice(0, 10));
    const [dateFin, setEndDate] = useState(() =>new Date().toISOString().slice(0, 10));
    const [mois, setMois] = useState('7');
    
    const [annee, setAnnee] = useState(new Date().getFullYear().toString());
    const [selectedFiliale, setSelectedFiliale] = useState<string>(sessionStorage.getItem('sitcod') ?? '');
    const [selectedService, setSelectedService] = useState<string>('');
    const [selectedRegime, setSelectedRegime] = useState<string>('');
    const dateRangeContext = useDateRange();
    const setDateRange = dateRangeContext?.setDateRange;
    const {data:emplibs=[]} = useGetEmployee();
    useEffect(() => {
        axios.get(`${import.meta.env.VITE_REACT_APP_API_URL}/Sites/get-sitlibs`)
            .then((res) => setFiliale(res.data))
            .catch((err) => console.error(err));

        axios.get(`${import.meta.env.VITE_REACT_APP_API_URL}/Parametres/deb-mois/${soccod}`, { headers })
            .then((res) => {
                const { joudeb, joufin, moisdeb, moisfin } = res.data;
                // Removed setDebMois as it is unused
                
                const currentYear = new Date().getFullYear();
                let currentMonth = new Date().getMonth() + 1; // Add 1 to zero-based month

                let startMonth = moisdeb === 'P' ? currentMonth - 1 : currentMonth;
                let endMonth = moisfin === 'P' ? currentMonth - 1 : currentMonth;

                let startYear = startMonth === 0 ? currentYear - 1 : currentYear;
                let endYear = endMonth === 0 ? currentYear - 1 : currentYear;

                startMonth = startMonth === 0 ? 12 : startMonth;
                endMonth = endMonth === 0 ? 12 : endMonth;

                const formattedStartMonth = String(startMonth).padStart(2, '0');
                const formattedEndMonth = String(endMonth).padStart(2, '0');

                const initialDateDebut = `${startYear}-${formattedStartMonth}-${joudeb}`;
                const initialDateFin = `${endYear}-${formattedEndMonth}-${joufin}`;

                setAnnee(currentYear.toString());
                setStartDate(initialDateDebut);
                setEndDate(initialDateFin);
            })
            .catch((err) => {
                console.error("Error:", err.response ? err.response.data : err.message);
            });
    }, []);

    const handlePrintReport = async () => {};



    useEffect(() => {
        axios.get(`${import.meta.env.VITE_REACT_APP_API_URL}/Services/get-servlibs/${soccod}`, { headers })
            .then((res) => setServices(res.data))
            .catch((err) => console.error(err));
    }, [soccod]);

    // Update dateDebut and dateFin when annee changes
    useEffect(() => {
        if (annee) {
            const startDateParts = dateDebut.split('-');
            const endDateParts = dateFin.split('-');
            setStartDate(`${annee}-${startDateParts[1]}-${startDateParts[2]}`);
            setEndDate(`${annee}-${endDateParts[1]}-${endDateParts[2]}`);
        }
    }, [annee]);
    const handleApplyFilter = () => {
       if (setDateRange) {
            setDateRange({
                dateDebut: new Date(dateDebut),
                dateFin: new Date(dateFin),
                selectedFiliale: selectedFiliale ?? '',
                selectedRegime,
                selectedService,
                pres,
                mois,
                empcods: selectedEmpcods
            });
        }
    };

    return (
        <Box>
            <Grid container direction="row" spacing={2} alignItems="end">
               
                <Grid item xs={1.5}>
                    {filiale && (
                        <SelectInputComponent
                            label='Filiale'
                            value={selectedFiliale}
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
                            maplist={services}
                        />
                    )}
                </Grid>
                <Grid item xs={1}>
                    <SelectInputComponent
                        label='Régime'
                        value={selectedRegime}
                        setValue={setSelectedRegime}
                        maplist={regime}
                    />
                </Grid>
                <Grid item xs={1.5}>
                    <SelectInputComponent
                    label='Employés'
                    value={selectedEmpcods}
                    setValue={setSelectedEmpcods}
                    maplist={emplibs}
                    multiple={true}
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
                <Grid item xs={0.6}>
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
                <Grid item xs={0.5}>
                    <IconButton
                        color="primary"
                        onClick={handleApplyFilter}
                        sx={{ border: '1px solid', borderColor: 'divider' }}
                    >
                        <Search />
                    </IconButton>
                </Grid>
                {/* Bouton Imprimer */}
                <Grid item xs={0.5}>
                    <IconButton
                        color="primary"
                        onClick={handlePrintReport}
                        sx={{ border: '1px solid', borderColor: 'divider' }}
                    >
                        <Print />
                    </IconButton>
                </Grid>
                <Grid item xs={1}>
                {presence && (
                        <SelectInputComponent
                            label='Présence'
                            value={pres}
                            setValue={setPres}
                            maplist={presence}
                        />
                    )}
                </Grid>
            </Grid>
        </Box>
    );

}
export default FilterEtatPeriodique;
