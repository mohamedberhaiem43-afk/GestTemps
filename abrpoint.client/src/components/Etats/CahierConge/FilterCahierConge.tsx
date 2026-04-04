import { Box, Grid, IconButton, Typography } from "@mui/material";
import InputComponent from "../../Inputs/Input";
import SelectInputComponent from "../../SelectInputComponent/SelectInputComponent";
import { useEffect, useState } from "react";
import { Print, Search } from "@mui/icons-material";
import useGetEmployeesLibs from "../../../hooks/employeHooks/useGetEmployeesLibs";
import { useDateRange } from "../../Pointeuse/EtatPeriodique/FilterContext";
import { useAuth } from "../../helper/AuthProvider";
import apiInstance from "../../API/apiInstance";
import { useEmployeeFilter } from "../../../hooks/employeHooks/useEmployeeFilter";

function FilterCahierConge() {
    const { soccod } = useAuth();
    const regime = {
        'M': "Mensuelle",
        'H': "Horaire"
    };

    const {
        selectedEmpCodes: selectedEmpcods,
        setSelectedEmpCodes: setSelectedEmpcods,
        filiale,
        services,
        selectedFiliale,
        setSelectedFiliale,
        selectedService,
        setSelectedService,
        selectedRegime,
        setSelectedRegime,
        effectiveEmpcods,
        hasEffectiveEmployees,
        effectiveEmployeesLabel,
    } = useEmployeeFilter();

    const [pres] = useState('P');
    const [mois, setMois] = useState('7');
    const [dateDebut, setStartDate] = useState(() =>new Date().toISOString().slice(0, 10));
    const [dateFin, setEndDate] = useState(() =>new Date().toISOString().slice(0, 10));
    const [annee, setAnnee] = useState(new Date().getFullYear().toString());

    const dateRangeContext = useDateRange();
    const setDateRange = dateRangeContext?.setDateRange;
    const {data:emplibs=[]} = useGetEmployeesLibs();

    useEffect(() => {
        if (!soccod) return;

        apiInstance.get(`/Parametres/deb-mois/${soccod}`)
            .then((res) => {
                const { joudeb, joufin, moisdeb, moisfin } = res.data;

                const currentYear = new Date().getFullYear();
                let currentMonth = new Date().getMonth() + 1;

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
    }, [soccod]);

    const handlePrintReport = async () => {
        try {
            if (!soccod || !hasEffectiveEmployees) return;

            const response = await apiInstance.get(
                `/Conges/get-cahier-de-conge-report/${soccod}/${dateDebut}/${dateFin}`,
                {
                    responseType: 'blob',
                    params: { empcods: effectiveEmpcods.join(',') }
                }
            );

            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `cahier-de-conge.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error("Erreur generation rapport:", error);
        }
    };

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
                empcods: hasEffectiveEmployees ? effectiveEmpcods : null,
                retapres: false,
                retmat: false,
                retmin: 0,
                compterAvance: false
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
                        label='Regime'
                        value={selectedRegime}
                        setValue={setSelectedRegime}
                        maplist={regime}
                    />
                </Grid>
                <Grid item xs={1.5}>
                    <SelectInputComponent
                        label='Employes'
                        value={selectedEmpcods ?? []}
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
                        label='Annee'
                        value={annee}
                        setValue={setAnnee}
                    />
                </Grid>
                <Grid item xs={1}>
                    <InputComponent
                        type='date'
                        label='Date Debut'
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
                        disabled={!hasEffectiveEmployees}
                        onClick={handleApplyFilter}
                        sx={{ border: '1px solid', borderColor: 'divider' }}
                    >
                        <Search />
                    </IconButton>
                </Grid>
                <Grid item xs={0.5}>
                    <IconButton
                        color="primary"
                        disabled={!hasEffectiveEmployees}
                        onClick={handlePrintReport}
                        sx={{ border: '1px solid', borderColor: 'divider' }}
                    >
                        <Print />
                    </IconButton>
                </Grid>
                <Grid item xs={12}>
                    <Typography variant="body2" color={hasEffectiveEmployees ? "text.secondary" : "warning.main"}>
                        {hasEffectiveEmployees
                            ? effectiveEmployeesLabel
                            : "Aucun employe actif ne correspond aux filtres selectionnes. Selectionnez un employe ou ajustez la filiale, le service ou le regime."}
                    </Typography>
                </Grid>
            </Grid>
        </Box>
    );
}

export default FilterCahierConge;
