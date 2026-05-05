import { Box, Grid, IconButton } from "@mui/material";
import InputComponent from "../../Inputs/Input";
import SelectInputComponent from "../../SelectInputComponent/SelectInputComponent";
import { useContext, useEffect, useState } from "react";
import { useTranslation } from 'react-i18next';
import { useDateRange } from "./FilterContext";
import { Print, Search } from "@mui/icons-material";
import useGetEmployee from "../../../hooks/employeHooks/useGetEmployee";
import { useAuth } from "../../helper/AuthProvider";
import { EmployeeContext } from "./EmployeeContext";
import useGenerateEtatDetaille from "../../../hooks/presenceHooks/useGenerateEtatDetaille";
import apiInstance from "../../API/apiInstance";
import axios from "axios";

function FilterEtatPeriodique() {
    const { t } = useTranslation();
    const { soccod } = useAuth();
    const regime = {
        'M': "Mensuelle",
        'H': "Horaire"
    };
    // Défaut 01 → 30 pour couvrir le mois entier quand l'admin n'a rien
    // configuré dans Param. Société. Janvier (31j) tolère 30 sans perte ;
    // Février obtient un overflow vers début mars (Date.toISOString
    // normalise) — acceptable pour un filtre période.
    const [paramMois, setParamMois] = useState({ joudeb: '01', joufin: '30', moisdeb: 'P', moisfin: 'P' });
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
    const {data:emplibs=[]} = useGetEmployee(selectedFiliale, selectedService, undefined, selectedRegime);
    const {empEtatData,selectedEmpLib,} = useContext(EmployeeContext);
    const { mutateAsync: generatePdf } = useGenerateEtatDetaille();
    const { selectedEmpMat } = useContext(EmployeeContext);
    const currentEmpcod = selectedEmpMat;

    const handlePrintReport = async () => {
        if (empEtatData.length === 0) {
        alert('Aucune donnée à imprimer. Sélectionnez un employé d\'abord.');
        return;
        }

        try {
        const blob = await generatePdf({
            soccod: soccod || '',
            empcod:   currentEmpcod,
            emplib:   selectedEmpLib,
            dateDebut: dateDebut,
            dateFin:   dateFin,
            rows:      empEtatData,
        });

      // Télécharger le PDF
      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href     = url;
      link.download = `EtatDetaille_${currentEmpcod}_${dateDebut}_${dateFin}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erreur impression :', err);
      alert('Erreur lors de la génération du rapport.');
    }
  };

    useEffect(() => {
        if (!soccod) return;
        
        apiInstance.get(`/Sites/get-sitlibs/${soccod}`)
            .then((res) => setFiliale(res.data))
            .catch((err) => console.error(err));

        apiInstance.get(`/Parametres/deb-mois/${soccod}`)
            .then((res) => {
                const { joudeb, joufin, moisdeb, moisfin } = res.data;
                // Si l'admin n'a pas saisi de plage, on retombe sur 01 → 30 pour
                // que le filtre couvre le mois entier au lieu de planter sur des
                // valeurs vides.
                const safeJoudeb = joudeb && String(joudeb).trim() !== '' ? joudeb : '01';
                const safeJoufin = joufin && String(joufin).trim() !== '' ? joufin : '30';
                setParamMois({ joudeb: safeJoudeb, joufin: safeJoufin, moisdeb, moisfin });

                const currentYear = new Date().getFullYear();
                let currentMonth = new Date().getMonth() + 1;

                let startMonth = moisdeb === 'P' ? currentMonth - 1 : currentMonth;
                let endMonth = moisfin === 'P' ? currentMonth - 1: currentMonth;

                let startYear = startMonth === 0 ? currentYear - 1 : currentYear;
                let endYear = endMonth === 0 ? currentYear - 1 : currentYear;

                startMonth = startMonth === 0 ? 12 : startMonth;
                endMonth = endMonth === 0 ? 12 : endMonth;

                const formattedStartMonth = String(startMonth).padStart(2, '0');
                const formattedEndMonth = String(endMonth).padStart(2, '0');

                const initialDateDebut = `${startYear}-${formattedStartMonth}-${safeJoudeb}`;
                const initialDateFin = `${endYear}-${formattedEndMonth}-${safeJoufin}`;
                //setMois(formattedStartMonth);
                setAnnee(currentYear.toString());
                setStartDate(initialDateDebut);
                setEndDate(initialDateFin);
            })
            .catch((err) => {
                console.error("Error:", err.response ? err.response.data : err.message);
            });
    }, [soccod]);



    useEffect(() => {
        axios.get(`${import.meta.env.VITE_REACT_APP_API_URL}/Services/get-servlibs/${soccod}`, { withCredentials: true })
            .then((res) => setServices(res.data))
            .catch((err) => console.error(err));
    }, [soccod]);

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
       if (setDateRange) {
            setDateRange({
                dateDebut: new Date(dateDebut),
                dateFin: new Date(dateFin),
                selectedFiliale: selectedFiliale ?? '',
                selectedRegime,
                selectedService,
                pres,
                mois,
                empcods: selectedEmpcods,
                retapres: false,
                retmat: false,
                retmin: 0,
                compterAvance: false,
            });
        }
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
                        label={t('empEtatPeriodique.filters.month')}
                        value={mois}
                        setValue={setMois}
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
export default FilterEtatPeriodique;



