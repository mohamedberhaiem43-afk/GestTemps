import { Box, Grid, IconButton } from "@mui/material";
import InputComponent from "../../Inputs/Input";
import SelectInputComponent from "../../SelectInputComponent/SelectInputComponent";
import { useEffect, useState } from "react";
import { useTranslation } from 'react-i18next';
import { useDateRange } from "./FilterContext";
import { Print, Search } from "@mui/icons-material";
import useGetEmployeesLibs from "../../../hooks/employeHooks/useGetEmployeesLibs";
import CheckboxComponent from "../../CheckboxComponent/CheckboxComponent";
import useGetAbsencesLibs from "../../../hooks/absenceHooks/useGetAbsenceLibs";
import useGetEtatAbsence from "../../../hooks/absenceHooks/useGetEtatAbsence";
import RadioGroupComponent, { FormControlLabelComponent } from "../../RadioGroupComponent/RadioGroupComponent";
import { useAbsenceContext } from "../../helper/AbsParamsContext";
import { useAuth } from "../../helper/AuthProvider";
import apiInstance from "../../API/apiInstance";


function FilterPeriode() {
    const { t } = useTranslation();
    const { soccod } =useAuth();
    const regime = {
        'M': "Mensuelle",
        'H': "Horaire"
    };
    const presence = null;
    
    const [selectedEmpcods, setSelectedEmpcods] = useState<string[]>([]);
    const { setAbsParams } = useAbsenceContext();
    const {data:abslibs={}} = useGetAbsencesLibs();
    const [filiale, setFiliale] = useState<Record<string,string>>({});
    const [services, setServices] = useState<Record<string,string>>({});
    const [pres, setPres] = useState('P');
    const [mois] = useState('7');
    const [absret, setAbsret] = useState<boolean>(true);
    const [absaut, setAbsaut] = useState<boolean>(true);
    const [sansPointageInvalide, setSansPointageInvalide] = useState<boolean>(true);
    const [presNonOpt, setPresNonOpt] = useState<boolean>(false);
    const [dispTypeabs, setDispTypeabs] = useState<string>('none');
    const [radioValue, setRadioValue] = useState<string>('1');
    // Removed unused setDebMois state
    const [dateDebut, setStartDate] = useState(() =>new Date().toISOString().slice(0, 10));
    const [dateFin, setEndDate] = useState(() =>new Date().toISOString().slice(0, 10));
    const [annee, setAnnee] = useState(new Date().getFullYear().toString());
    const [selectedFiliale, setSelectedFiliale] = useState<string>(sessionStorage.getItem('sitcod') ?? '');
    const [selectedService, setSelectedService] = useState<string>('');
    const [selectedAbstype, setSelectedAbstype] = useState<string>('0');
    const [selectedRegime, setSelectedRegime] = useState<string>('');
    const dateRangeContext = useDateRange();
    const setDateRange = dateRangeContext?.setDateRange;
    
    // RÃ©cupÃ©rer les donnÃ©es d'absence avec le hook
    const { data: absenceData = [] } = useGetEtatAbsence(
        new Date(dateDebut),
        new Date(dateFin),
        selectedEmpcods.length > 0 ? selectedEmpcods : null,
        absaut,
        absret,
        presNonOpt,
        sansPointageInvalide,
        selectedAbstype
    );
    useEffect(()=>{
        if(radioValue == "0"){
            setAbsret(false);
            setAbsaut(false);
            setSansPointageInvalide(false);
            setPresNonOpt(false);
        }
        if(radioValue == "1"){
            setAbsret(true);
            setAbsaut(true);
            setSansPointageInvalide(true);
        }
        if(radioValue == "3"){
            setAbsret(true);
            setAbsaut(true);
            setSansPointageInvalide(false);
        }
        if(radioValue == "2")
            setDispTypeabs('block');
        else
            setDispTypeabs('none');
    },[radioValue])
    const {data:emplibs=[]} = useGetEmployeesLibs();
    useEffect(() => {
        if (!soccod) return;
        
        apiInstance.get(`/Sites/get-sitlibs/${soccod}`)
            .then((res) => setFiliale(res.data))
            .catch((err) => console.error(err));

        apiInstance.get(`/Parametres/deb-mois/${soccod}`)
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
                const startDay = Math.min(Math.max(Number(joudeb) || 1, 1), new Date(startYear, startMonth, 0).getDate());
                const endDay = Math.min(Math.max(Number(joufin) || 1, 1), new Date(endYear, endMonth, 0).getDate());

                const initialDateDebut = `${startYear}-${formattedStartMonth}-${String(startDay).padStart(2, '0')}`;
                const initialDateFin = `${endYear}-${formattedEndMonth}-${String(endDay).padStart(2, '0')}`;


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
                const payload = {
                    soclib:sessionStorage.getItem('soclib') ?? '',
                    date: new Date().toISOString().slice(0, 10),
                    dateDebut: dateDebut,
                    dateFin: dateFin,
                    data: absenceData
                };
                const response = await apiInstance.post(
                    `/Absences/get-etat-absence-report`,
                    payload,
                    {
                        responseType: 'blob',
                    }
                );

                // CrÃ©er le blob PDF
                const blob = new Blob([response.data], { type: 'application/pdf' });
                const url = window.URL.createObjectURL(blob);

                // TÃ©lÃ©charger le fichier
                const link = document.createElement('a');
                link.href = url;
                link.download = `etat-absence-${dateDebut}-${dateFin}.pdf`;
                document.body.appendChild(link);
                link.click();
                
                // Nettoyage
                link.remove();
                window.URL.revokeObjectURL(url);

            } catch (error: any) {
                console.error("Erreur gÃ©nÃ©ration rapport:", error);
                
                if (error.response) {
                    console.error("Status:", error.response.status);
                    console.error("Status Text:", error.response.statusText);
                    
                    // Si c'est une erreur 405, vÃ©rifier la configuration
                    if (error.response.status === 405) {
                        alert("Erreur 405: MÃ©thode non autorisÃ©e. VÃ©rifiez la configuration du serveur.");
                    } else if (error.response.status === 401) {
                        alert("Non autorisÃ©. Veuillez vous reconnecter.");
                    } else if (error.response.status === 403) {
                        alert("AccÃ¨s interdit. Vous n'avez pas les permissions nÃ©cessaires.");
                    } else {
                        alert("Erreur lors de la gÃ©nÃ©ration du rapport.");
                    }
                } else {
                    alert("Erreur de connexion au serveur.");
                }
            }
        };

    useEffect(() => {
        apiInstance.get(`/Services/get-servlibs/${soccod}`)
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
            empcods:selectedEmpcods,
            compterAvance:false,
            retapres: false,
            retmat: false,
            retmin: 0
            });
        }
        setAbsParams({
            absret,
            absaut,
            sansPointageInvalide,
            presNonOpt,
            selectedAbstype,
        });
    };

    return (
        <Box>
            <Grid container direction="row" spacing={2} alignItems="end">
               
                <Grid item xs={1.5}>
                    {filiale && (
                        <SelectInputComponent
                            label={t('empEtatPeriodique.filters.branch')}
                            value={selectedFiliale}
                            setValue={setSelectedFiliale}
                            maplist={filiale}
                        />
                    )}
                </Grid>
                <Grid item xs={1.5}>
                    {services && (
                        <SelectInputComponent
                            label={t('empEtatPeriodique.filters.service')}
                            value={selectedService}
                            setValue={setSelectedService}
                            maplist={services}
                        />
                    )}
                </Grid>
                <Grid item xs={1}>
                    <SelectInputComponent
                        label={t('empEtatPeriodique.filters.regime')}
                        value={selectedRegime}
                        setValue={setSelectedRegime}
                        maplist={regime}
                    />
                </Grid>
                <Grid item xs={1.5}>
                    <SelectInputComponent
                    label={t('empEtatPeriodique.filters.employees')}
                    value={selectedEmpcods}
                    setValue={setSelectedEmpcods}
                    maplist={emplibs}
                    multiple={true}
                />
               </Grid>
                <Grid item xs={0.6}>
                    <InputComponent
                        type='number'
                        label={t('empEtatPeriodique.filters.year')}
                        value={annee}
                        setValue={setAnnee}
                    />
                </Grid>
                <Grid item xs={1}>
                    <InputComponent
                        type='date'
                        label={t('common.dateStart')}
                        value={dateDebut}
                        setValue={setStartDate}
                    />
                </Grid>
                <Grid item xs={1}>
                    <InputComponent
                        type='date'
                        label={t('common.dateEnd')}
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
                <Grid item xs={5}>
                    <RadioGroupComponent value={radioValue} setValue={setRadioValue}>
                        <FormControlLabelComponent radioValue={"0"} label={t('filter.withoutPointage')} />
                        <FormControlLabelComponent radioValue={"1"} label={t('filter.allAbsence')} />
                        <FormControlLabelComponent radioValue={"2"} label={t('filter.justifiedAbsence')} />
                        <FormControlLabelComponent radioValue={"3"} label={t('filter.invalidPointage')} />
                    </RadioGroupComponent>
                </Grid>
                <Grid item xs={2}>
                    <CheckboxComponent label={t('filter.absenceDayLate')} value={absret} setValue={setAbsret} />
                </Grid>
                <Grid item xs={1.3}>
                    <CheckboxComponent label={t('filter.authorizedAbsence')} value={absaut} setValue={setAbsaut} />
                </Grid>
                <Grid item xs={1.5}>
                    <CheckboxComponent label={t('filter.withoutInvalidPointage')} value={sansPointageInvalide} setValue={setSansPointageInvalide} />
                </Grid>
                <Grid item xs={2}>
                    <CheckboxComponent label={t('filter.presenceNotOptimized')} value={presNonOpt} setValue={setPresNonOpt} />
                </Grid>
                <Grid item xs={1} display={dispTypeabs}>
                    <SelectInputComponent label={"Type Absence"}
                    value={selectedAbstype} 
                    setValue={setSelectedAbstype}
                    maplist={abslibs} />
                </Grid>
                <Grid item xs={1}>
                {presence && (
                        <SelectInputComponent
                            label={t('common.presence')}
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
export default FilterPeriode;


