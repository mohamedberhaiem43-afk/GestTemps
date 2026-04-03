import { Box, Grid, IconButton } from "@mui/material";
import InputComponent from "../../Inputs/Input";
import SelectInputComponent from "../../SelectInputComponent/SelectInputComponent";
import apiInstance from "../../API/apiInstance";
import { useContext, useEffect, useState } from "react";
import { Print, Search } from "@mui/icons-material";
import useGetEmployeesLibs from "../../../hooks/employeHooks/useGetEmployeesLibs";
import { useDateRange } from "../../Pointeuse/EtatPeriodique/FilterContext";
import { EmployeeContext } from "../../Pointeuse/EtatPeriodique/EmployeeContext";
import { useAuth } from "../../helper/AuthProvider";
import CheckboxComponent from "../../CheckboxComponent/CheckboxComponent";

function FilterRetard() {
    const { soccod } = useAuth();
    const regime = {
        'M': "Mensuelle",
        'H': "Horaire"
    };
    const presence = null;
    
    const { selectedEmp, setSelectedEmp } = useContext(EmployeeContext);
    const [selectedEmpCodes, setSelectedEmpCodes] = useState<string[]>([]);
    const [compterAvance, setCompterAvance] = useState(false);
    const [retmat, setRetmat] = useState(true);
    const [retapres, setRetapres] = useState(true);
    const [retmin, setRetmin] = useState(0);

    const [filiale, setFiliale] = useState<Record<string,string>>({});
    const [services, setServices] = useState<Record<string,string>>({});
    const [pres, setPres] = useState('P');
    const [mois] = useState('7');
    const [dateDebut, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [dateFin, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [annee, setAnnee] = useState(new Date().getFullYear().toString());
    const [selectedFiliale, setSelectedFiliale] = useState<string>(sessionStorage.getItem('sitcod') ?? '');
    const [selectedService, setSelectedService] = useState<string>('');
    const [selectedRegime, setSelectedRegime] = useState<string>('T');
    
    const dateRangeContext = useDateRange();
    const setDateRange = dateRangeContext?.setDateRange;
    const { data: emplibs = [] } = useGetEmployeesLibs();

    useEffect(() => {
        if (!soccod) return;
        
        apiInstance.get(`/Sites/get-sitlibs/${soccod}`)
            .then((res) => setFiliale(res.data))
            .catch((err) => console.error(err));

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
    }, []);

    const handlePrintReport = async () => {
        try {
            if (!soccod) return;
            
            // Convert selected employees to codes if needed
            const empCodesToSend = selectedEmpCodes.length > 0 
                ? selectedEmpCodes 
                : (selectedEmp ? [selectedEmp.empcod] : []);

            const params = new URLSearchParams();
            empCodesToSend.forEach(code => params.append('empcods', code));

            const response = await apiInstance.get(
                `/Presences/get-etat-retard-report/${soccod}/${dateDebut}/${dateFin}/${selectedRegime}`,
                {
                                        params,
                    responseType: 'blob'
                }
            );

            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `etat-retard-${new Date().toISOString()}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error("Erreur génération rapport:", error);
        }
    };

    useEffect(() => {
        apiInstance.get(`/Services/get-servlibs/${soccod}`)
            .then((res) => setServices(res.data))
            .catch((err) => console.error(err));
    }, [soccod]);

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
                empcods: selectedEmpCodes,
                compterAvance,
                retmin,
                retmat,
                retapres
            });
        }
    };
        useEffect(() => {
            if (!setDateRange) return;

            setDateRange(prev => ({
                ...prev,
                compterAvance,
                retmin,
                retmat,
                retapres
            }));
        }, [compterAvance,retmin,retmat,retapres]);

    const handleEmployeeSelection = (selected: string[]) => {
        setSelectedEmpCodes(selected);
        // If you need to also set the full employee object in context:
        if (selected.length === 1) {
            const emp = emplibs.find(e => e.empcod === selected[0]);
            setSelectedEmp(emp || null);
        } else {
            setSelectedEmp(null);
        }
    };

    return (
        <Box>
            <Grid container direction="row" spacing={2} alignItems="end">
                <Grid item xs={1}>
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
                <Grid item xs={1}>
                    <SelectInputComponent
                        label='Employés'
                        value={selectedEmpCodes}
                        setValue={handleEmployeeSelection}
                        maplist={emplibs}
                        multiple={true}
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
                <Grid item xs={1}>
                    <InputComponent type="number" label="Retard min (min)" value={retmin} setValue={setRetmin} />
                </Grid>
                <Grid item xs={0.7}>
                    <CheckboxComponent label={"Compter avance"} value={compterAvance} setValue={setCompterAvance} />
                </Grid>
                <Grid item xs={0.7}>
                    <CheckboxComponent label={"Ret. Mat"} value={retmat} setValue={setRetmat} />
                </Grid>
                <Grid item xs={0.7}>
                    <CheckboxComponent label={"Ret. AM"} value={retapres} setValue={setRetapres} />
                </Grid>
                <Grid item display={'flex'} flexDirection={'row'} xs={1} justifyContent={'space-around'} >
                    <Grid item xs={0.3}>
                        <IconButton
                            color="primary"
                            onClick={handleApplyFilter}
                            sx={{ border: '1px solid', borderColor: 'divider' }}
                        >
                            <Search />
                        </IconButton>
                    </Grid>
                    <Grid item xs={0.3}>
                        <IconButton
                            color="primary"
                            onClick={handlePrintReport}
                            sx={{ border: '1px solid', borderColor: 'divider' }}
                        >
                            <Print />
                        </IconButton>
                    </Grid>
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

export default FilterRetard;