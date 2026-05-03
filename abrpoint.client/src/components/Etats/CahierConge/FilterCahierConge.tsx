import { Box, Grid, IconButton, Typography } from "@mui/material";
import InputComponent from "../../Inputs/Input";
import SelectInputComponent from "../../SelectInputComponent/SelectInputComponent";
import { useEffect, useState } from "react";
import { Print, Search } from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import useGetEmployeesLibs from "../../../hooks/employeHooks/useGetEmployeesLibs";
import { useDateRange } from "../../Pointeuse/EtatPeriodique/FilterContext";
import { useAuth } from "../../helper/AuthProvider";
import apiInstance from "../../API/apiInstance";
import { useEmployeeFilter } from "../../../hooks/employeHooks/useEmployeeFilter";

function FilterCahierConge() {
    const { t } = useTranslation();
    const { soccod } = useAuth();
    const regime = {
        'M': t('cahierConge.filter.regimeMonthly'),
        'H': t('cahierConge.filter.regimeHourly')
    };

    const justifiedOptions = {
        '': t('cahierConge.filter.justifiedOptions.all'),
        '1': t('cahierConge.filter.justifiedOptions.yes'),
        '0': t('cahierConge.filter.justifiedOptions.no')
    };

    const absenceTypeOptions = {
        '': t('cahierConge.filter.absenceTypeOptions.all'),
        '1': t('cahierConge.filter.absenceTypeOptions.csf'),
        '2': t('cahierConge.filter.absenceTypeOptions.justified'),
        '3': t('cahierConge.filter.absenceTypeOptions.notJustified'),
        '4': t('cahierConge.filter.absenceTypeOptions.map'),
        '5': t('cahierConge.filter.absenceTypeOptions.css'),
        '6': t('cahierConge.filter.absenceTypeOptions.fm'),
        '8': t('cahierConge.filter.absenceTypeOptions.workAccident'),
        '9': t('cahierConge.filter.absenceTypeOptions.sickness')
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
    const [justified, setJustified] = useState<string>('');
    const [absenceType, setAbsenceType] = useState<string>('');

    const dateRangeContext = useDateRange();
    const setDateRange = dateRangeContext?.setDateRange;
    const {data:emplibs=[]} = useGetEmployeesLibs(selectedFiliale, selectedService, undefined, selectedRegime);

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
                    params: { 
                        empcods: effectiveEmpcods.join(','),
                        justified: justified,
                        absenceType: absenceType
                    }
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
                            label={t('cahierConge.filter.filiale')}
                            value={selectedFiliale}
                            setValue={setSelectedFiliale}
                            maplist={filiale}
                        />
                    )}
                </Grid>
                <Grid item xs={1.5}>
                    {services && (
                        <SelectInputComponent
                            label={t('cahierConge.filter.service')}
                            value={selectedService}
                            setValue={setSelectedService}
                            maplist={services}
                        />
                    )}
                </Grid>
                <Grid item xs={1}>
                    <SelectInputComponent
                        label={t('cahierConge.filter.regime')}
                        value={selectedRegime}
                        setValue={setSelectedRegime}
                        maplist={regime}
                    />
                </Grid>
                <Grid item xs={1.2}>
                    <SelectInputComponent
                        label={t('cahierConge.filter.absenceJustified')}
                        value={justified}
                        setValue={setJustified}
                        maplist={justifiedOptions}
                    />
                </Grid>
                <Grid item xs={1.5}>
                    <SelectInputComponent
                        label={t('cahierConge.filter.absenceType')}
                        value={absenceType}
                        setValue={setAbsenceType}
                        maplist={absenceTypeOptions}
                    />
                </Grid>
                <Grid item xs={1.5}>
                    <SelectInputComponent
                        label={t('cahierConge.filter.employees')}
                        value={selectedEmpcods ?? []}
                        setValue={setSelectedEmpcods}
                        maplist={emplibs}
                        multiple={true}
                    />
               </Grid>
                <Grid item xs={0.6}>
                    <InputComponent
                        type='number'
                        label={t('cahierConge.filter.month')}
                        value={mois}
                        setValue={setMois}
                    />
                </Grid>
                <Grid item xs={0.6}>
                    <InputComponent
                        type='number'
                        label={t('cahierConge.filter.year')}
                        value={annee}
                        setValue={setAnnee}
                    />
                </Grid>
                <Grid item xs={1}>
                    <InputComponent
                        type='date'
                        label={t('cahierConge.filter.dateStart')}
                        value={dateDebut}
                        setValue={setStartDate}
                    />
                </Grid>
                <Grid item xs={1}>
                    <InputComponent
                        type='date'
                        label={t('cahierConge.filter.dateEnd')}
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
                            : t('cahierConge.filter.noEmpFilterLong')}
                    </Typography>
                </Grid>
            </Grid>
        </Box>
    );
}

export default FilterCahierConge;
