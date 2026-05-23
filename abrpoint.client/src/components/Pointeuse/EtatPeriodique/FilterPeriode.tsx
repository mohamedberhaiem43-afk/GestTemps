import { useEffect, useState } from "react";
import { Typography } from "@mui/material";
import SearchIcon from '@mui/icons-material/Search';
import PrintIcon from '@mui/icons-material/Print';
import { useTranslation } from "react-i18next";
import { useDateRange } from "./FilterContext";
import useGetEmployeesLibs from "../../../hooks/employeHooks/useGetEmployeesLibs";
import useGetEtatAbsence from "../../../hooks/absenceHooks/useGetEtatAbsence";
import RadioGroupComponent, { FormControlLabelComponent } from "../../RadioGroupComponent/RadioGroupComponent";
import { useAbsenceContext } from "../../helper/AbsParamsContext";
import { useAuth } from "../../helper/AuthProvider";
import apiInstance from "../../API/apiInstance";
import { useEmployeeFilter } from "../../../hooks/employeHooks/useEmployeeFilter";
import '../../Etats/CahierConge/CahierConge.css';

function FilterPeriode() {
  const { t } = useTranslation();
  const { soccod } = useAuth();

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

  const regimeOptions: Record<string, string> = { 'M': 'Mensuelle', 'H': 'Horaire' };
  const { setAbsParams } = useAbsenceContext();

  const [pres] = useState("P");
  const [mois] = useState("7");
  const [absret, setAbsret] = useState<boolean>(true);
  const [absaut, setAbsaut] = useState<boolean>(true);
  const [sansPointageInvalide, setSansPointageInvalide] = useState<boolean>(true);
  const [presNonOpt, setPresNonOpt] = useState<boolean>(false);
  const [radioValue, setRadioValue] = useState<string>("1");
  const [dateDebut, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dateFin, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [annee, setAnnee] = useState(new Date().getFullYear().toString());

  const dateRangeContext = useDateRange();
  const setDateRange = dateRangeContext?.setDateRange;
  const isAllAbsenceMode = radioValue === "1";

  const { data: absenceData = [] } = useGetEtatAbsence(
    new Date(dateDebut),
    new Date(dateFin),
    effectiveEmpcods.length > 0 ? effectiveEmpcods : null,
    absaut,
    absret,
    presNonOpt,
    sansPointageInvalide,
    radioValue,
  );

  useEffect(() => {
    if (radioValue === "0") {
      setAbsret(false);
      setAbsaut(false);
      setSansPointageInvalide(false);
      setPresNonOpt(false);
    }
    if (radioValue === "1") {
      setAbsret(true);
      setAbsaut(true);
      setSansPointageInvalide(true);
    }
    if (radioValue === "3") {
      setAbsret(true);
      setAbsaut(true);
      setSansPointageInvalide(false);
      setPresNonOpt(false);
    }
  }, [radioValue]);

  const { data: emplibs = {} } = useGetEmployeesLibs(selectedFiliale, selectedService, undefined, selectedRegime);

  useEffect(() => {
    if (!soccod) return;

    apiInstance.get(`/Parametres/deb-mois/${soccod}`)
      .then((res) => {
        const { joudeb, joufin, moisdeb, moisfin } = res.data;

        const currentYear = new Date().getFullYear();
        let currentMonth = new Date().getMonth() + 1;

        let startMonth = moisdeb === "P" ? currentMonth - 1 : currentMonth;
        let endMonth = moisfin === "P" ? currentMonth - 1 : currentMonth;

        let startYear = startMonth === 0 ? currentYear - 1 : currentYear;
        let endYear = endMonth === 0 ? currentYear - 1 : currentYear;

        startMonth = startMonth === 0 ? 12 : startMonth;
        endMonth = endMonth === 0 ? 12 : endMonth;

        const formattedStartMonth = String(startMonth).padStart(2, "0");
        const formattedEndMonth = String(endMonth).padStart(2, "0");
        const startDay = Math.min(Math.max(Number(joudeb) || 1, 1), new Date(startYear, startMonth, 0).getDate());
        const endDay = Math.min(Math.max(Number(joufin) || 1, 1), new Date(endYear, endMonth, 0).getDate());

        const initialDateDebut = `${startYear}-${formattedStartMonth}-${String(startDay).padStart(2, "0")}`;
        const initialDateFin = `${endYear}-${formattedEndMonth}-${String(endDay).padStart(2, "0")}`;

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
      const payload = {
        soclib: sessionStorage.getItem("soclib") ?? "",
        date: new Date().toISOString().slice(0, 10),
        dateDebut,
        dateFin,
        data: absenceData,
      };

      const response = await apiInstance.post(`/Absences/get-etat-absence-report`, payload, {
        responseType: "blob",
      });

      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `etat-absence-${dateDebut}-${dateFin}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error("Erreur generation rapport:", error);
    }
  };

  useEffect(() => {
    if (annee) {
      const startDateParts = dateDebut.split("-");
      const endDateParts = dateFin.split("-");
      setStartDate(`${annee}-${startDateParts[1]}-${startDateParts[2]}`);
      setEndDate(`${annee}-${endDateParts[1]}-${endDateParts[2]}`);
    }
  }, [annee]);

  const handleApplyFilter = () => {
    if (setDateRange) {
      setDateRange({
        dateDebut: new Date(dateDebut),
        dateFin: new Date(dateFin),
        selectedFiliale,
        selectedRegime,
        selectedService,
        pres,
        mois,
        empcods: effectiveEmpcods.length > 0 ? effectiveEmpcods : null,
        compterAvance: false,
        retapres: false,
        retmat: false,
        retmin: 0,
      });
    }

    setAbsParams({
      absret,
      absaut,
      sansPointageInvalide,
      presNonOpt,
      radioValue,
    });
  };

  return (
    <div className="cc-filter-section">
      <div className="cc-filter-row">
        <div className="cc-filter-field-narrow">
          <label className="cc-filter-label">Site</label>
          <select className="cc-filter-select" value={selectedFiliale} onChange={(e) => setSelectedFiliale(e.target.value)}>
            <option value="">Tous</option>
            {Object.entries(filiale).map(([cod, lib]) => (
              <option key={cod} value={cod}>{lib}</option>
            ))}
          </select>
        </div>

        <div className="cc-filter-field-narrow">
          <label className="cc-filter-label">Service</label>
          <select className="cc-filter-select" value={selectedService} onChange={(e) => setSelectedService(e.target.value)}>
            <option value="">Tous</option>
            {Object.entries(services).map(([cod, lib]) => (
              <option key={cod} value={cod}>{lib}</option>
            ))}
          </select>
        </div>

        <div className="cc-filter-field-narrow">
          <label className="cc-filter-label">Regime</label>
          <select className="cc-filter-select" value={selectedRegime} onChange={(e) => setSelectedRegime(e.target.value)}>
            <option value="">Tous</option>
            {Object.entries(regimeOptions).map(([cod, lib]) => (
              <option key={cod} value={cod}>{lib}</option>
            ))}
          </select>
        </div>

        <div className="cc-filter-field-narrow">
          <label className="cc-filter-label">Date Debut</label>
          <input className="cc-filter-input" type="date" value={dateDebut} onChange={(e) => setStartDate(e.target.value)} />
        </div>

        <div className="cc-filter-field-narrow">
          <label className="cc-filter-label">Date Fin</label>
          <input className="cc-filter-input" type="date" value={dateFin} onChange={(e) => setEndDate(e.target.value)} />
        </div>

        <div className="cc-filter-field-narrow">
          <label className="cc-filter-label">Annee</label>
          <input className="cc-filter-input" type="number" value={annee} onChange={(e) => setAnnee(e.target.value)} />
        </div>

        <div className="cc-filter-field">
          <label className="cc-filter-label">Employes</label>
          <select
            className="cc-filter-select"
            multiple
            value={selectedEmpcods}
            onChange={(e) => {
              const values = Array.from(e.target.selectedOptions).map((option) => option.value);
              setSelectedEmpcods(values);
            }}
          >
            {Object.entries((emplibs || {}) as Record<string, string>).map(([cod, lib]) => (
              <option key={cod} value={cod}>{lib}</option>
            ))}
          </select>
        </div>

        <button className="cc-search-btn" onClick={handleApplyFilter} disabled={!hasEffectiveEmployees}>
          <SearchIcon sx={{ fontSize: 16 }} /> RECHERCHE
        </button>

        <button className="cc-export-btn" onClick={handlePrintReport} disabled={!hasEffectiveEmployees}>
          <PrintIcon sx={{ fontSize: 16 }} /> IMPRIMER
        </button>
      </div>

      <div className="cc-filter-row" style={{ marginTop: 10 }}>
        <RadioGroupComponent value={radioValue} setValue={setRadioValue}>
          <FormControlLabelComponent radioValue={"0"} label={t("filter.withoutPointage")} />
          <FormControlLabelComponent radioValue={"1"} label={t("filter.allAbsence")} />
          <FormControlLabelComponent radioValue={"2"} label={t("filter.justifiedAbsence")} />
          <FormControlLabelComponent radioValue={"3"} label={t("filter.invalidPointage")} />
        </RadioGroupComponent>
      </div>

      <div className="cc-filter-row" style={{ marginTop: 8 }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#334155' }}>
          <input type="checkbox" checked={absret} onChange={(e) => setAbsret(e.target.checked)} disabled={!isAllAbsenceMode} /> {t("filter.absenceDayLate")}
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#334155' }}>
          <input type="checkbox" checked={absaut} onChange={(e) => setAbsaut(e.target.checked)} disabled={!isAllAbsenceMode} /> {t("filter.authorizedAbsence")}
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#334155' }}>
          <input type="checkbox" checked={sansPointageInvalide} onChange={(e) => setSansPointageInvalide(e.target.checked)} disabled={!isAllAbsenceMode} /> {t("filter.withoutInvalidPointage")}
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#334155' }}>
          <input type="checkbox" checked={presNonOpt} onChange={(e) => setPresNonOpt(e.target.checked)} disabled={!isAllAbsenceMode} /> {t("filter.presenceNotOptimized")}
        </label>
      </div>

      <Typography variant="body2" color={hasEffectiveEmployees ? "text.secondary" : "warning.main"} sx={{ mt: 1.2 }}>
        {hasEffectiveEmployees
          ? effectiveEmployeesLabel
          : "Aucun employe actif ne correspond aux filtres selectionnes. Selectionnez un employe."}
      </Typography>
    </div>
  );
}

export default FilterPeriode;
