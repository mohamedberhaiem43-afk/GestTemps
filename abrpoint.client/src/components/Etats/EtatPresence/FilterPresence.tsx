import { useContext, useEffect, useState } from "react";
import SearchIcon from '@mui/icons-material/Search';
import PrintIcon from '@mui/icons-material/Print';
import { useTranslation } from "react-i18next";
import useGetEmployeesLibs from "../../../hooks/employeHooks/useGetEmployeesLibs";
import { useDateRange } from "../../Pointeuse/EtatPeriodique/FilterContext";
import { EmployeeContext } from "../../Pointeuse/EtatPeriodique/EmployeeContext";
import { useAuth } from "../../helper/AuthProvider";
import apiInstance from "../../API/apiInstance";
import { useEmployeeFilter } from "../../../hooks/employeHooks/useEmployeeFilter";
import EmployeeMultiSelectDropdown from "../../helper/EmployeeMultiSelectDropdown";
import '../CahierConge/CahierConge.css';

function FilterPresence() {
  const { t } = useTranslation();
  const { soccod } = useAuth();
  const { setSelectedEmp } = useContext(EmployeeContext);
  const {
    selectedEmpCodes,
    accessibleEmployees,
    filiale,
    services,
    selectedFiliale,
    setSelectedFiliale,
    selectedService,
    setSelectedService,
    selectedRegime,
    setSelectedRegime,
    isServiceLocked,
    effectiveEmpcods,
    hasEffectiveEmployees,
    handleEmployeeSelection: baseHandleEmployeeSelection,
  } = useEmployeeFilter();

  const regimeOptions: Record<string, string> = { 'M': 'Mensuelle', 'H': 'Horaire' };

  useEffect(() => {
    setSelectedRegime("T");
  }, [setSelectedRegime]);

  const [pres] = useState("P");
  const [mois] = useState("7");
  const [dateDebut, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dateFin, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [annee, setAnnee] = useState(new Date().getFullYear().toString());

  const dateRangeContext = useDateRange();
  const setDateRange = dateRangeContext?.setDateRange;
  const { data: emplibs = {} } = useGetEmployeesLibs(selectedFiliale, selectedService, undefined, selectedRegime);

  useEffect(() => {
    if (!soccod) return;

    apiInstance
      .get(`/Parametres/deb-mois/${soccod}`)
      .then((res) => {
        const { joudeb, joufin, moisdeb, moisfin } = res.data;

        const currentYear = new Date().getFullYear();
        let currentMonth = new Date().getMonth() + 1;

        let startMonth = moisdeb === "P" ? currentMonth - 1 : currentMonth;
        let endMonth = moisfin === "P" ? currentMonth - 1 : currentMonth;

        const startYear = startMonth === 0 ? currentYear - 1 : currentYear;
        const endYear = endMonth === 0 ? currentYear - 1 : currentYear;

        startMonth = startMonth === 0 ? 12 : startMonth;
        endMonth = endMonth === 0 ? 12 : endMonth;

        const formattedStartMonth = String(startMonth).padStart(2, "0");
        const formattedEndMonth = String(endMonth).padStart(2, "0");
        const initialDateDebut = `${startYear}-${formattedStartMonth}-${joudeb}`;
        const initialDateFin = `${endYear}-${formattedEndMonth}-${joufin}`;

        setAnnee(currentYear.toString());
        setStartDate(initialDateDebut);
        setEndDate(initialDateFin);
      })
      .catch((err) => {
        console.error('Error:', err.response ? err.response.data : err.message);
      });
  }, [soccod]);

  useEffect(() => {
    if (annee) {
      const startDateParts = dateDebut.split("-");
      const endDateParts = dateFin.split("-");
      setStartDate(`${annee}-${startDateParts[1]}-${startDateParts[2]}`);
      setEndDate(`${annee}-${endDateParts[1]}-${endDateParts[2]}`);
    }
  }, [annee]);

  const handlePrintReport = async () => {
    try {
      if (!soccod || !hasEffectiveEmployees) return;

      const params = new URLSearchParams();
      effectiveEmpcods.forEach((code) => params.append("empcods", code));

      const response = await apiInstance.get(
        `/Presences/get-etat-presence-report/${soccod}/${dateDebut}/${dateFin}/${selectedRegime}`,
        {
          params,
          responseType: "blob",
        },
      );

      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `etat-de-presence-${new Date().toISOString()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      // Args séparés (pas de concat avec le résultat de t(…)) — évite les format-specifiers
      // injectés via les fichiers i18n qui forgeraient le message console.
      console.error(t('etats.filter.reportError'), error);
    }
  };

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
        empcods: hasEffectiveEmployees ? effectiveEmpcods : null,
        retapres: false,
        retmat: false,
        retmin: 0,
        compterAvance: false,
      });
    }
  };

  const handleEmployeeSelection = (selected: string[]) => {
    baseHandleEmployeeSelection(selected);
    if (selected.length === 1) {
      const emp = accessibleEmployees.find((employee) => employee.empcod === selected[0]);
      setSelectedEmp(emp || null);
    } else {
      setSelectedEmp(null);
    }
  };

  return (
    <div className="cc-filter-section">
      <div className="cc-filter-row">
        <div className="cc-filter-field-narrow">
          <label className="cc-filter-label">{t('etats.filter.branch')}</label>
          <select className="cc-filter-select" value={selectedFiliale} onChange={(e) => setSelectedFiliale(e.target.value)}>
            <option value="">{t('etats.filter.all')}</option>
            {Object.entries(filiale).map(([cod, lib]) => (
              <option key={cod} value={cod}>{lib}</option>
            ))}
          </select>
        </div>

        <div className="cc-filter-field-narrow">
          <label className="cc-filter-label">{t('etats.filter.service')}</label>
          <select className="cc-filter-select" value={selectedService} onChange={(e) => setSelectedService(e.target.value)} disabled={isServiceLocked}>
            <option value="">{isServiceLocked ? t('etats.filter.myService') : t('etats.filter.allService')}</option>
            {Object.entries(services).map(([cod, lib]) => (
              <option key={cod} value={cod}>{lib}</option>
            ))}
          </select>
        </div>

        <div className="cc-filter-field-narrow">
          <label className="cc-filter-label">{t('etats.filter.regime')}</label>
          <select className="cc-filter-select" value={selectedRegime} onChange={(e) => setSelectedRegime(e.target.value)}>
            <option value="">{t('etats.filter.regimeAll')}</option>
            {Object.entries(regimeOptions).map(([cod, lib]) => (
              <option key={cod} value={cod}>{lib}</option>
            ))}
          </select>
        </div>

        <div className="cc-filter-field-narrow">
          <label className="cc-filter-label">{t('etats.filter.dateStart')}</label>
          <input className="cc-filter-input" type="date" value={dateDebut} onChange={(e) => setStartDate(e.target.value)} />
        </div>

        <div className="cc-filter-field-narrow">
          <label className="cc-filter-label">{t('etats.filter.dateEnd')}</label>
          <input className="cc-filter-input" type="date" value={dateFin} onChange={(e) => setEndDate(e.target.value)} />
        </div>

        <div className="cc-filter-field-narrow">
          <label className="cc-filter-label">{t('etats.filter.year')}</label>
          <input className="cc-filter-input" type="number" value={annee} onChange={(e) => setAnnee(e.target.value)} />
        </div>

        <div className="cc-filter-field" style={{ minWidth: 220 }}>
          <label className="cc-filter-label">{t('etats.filter.employees')}</label>
          <EmployeeMultiSelectDropdown
            options={Object.entries((emplibs || {}) as Record<string, string>).map(([code, label]) => ({ code, label: String(label) }))}
            value={selectedEmpCodes}
            onChange={handleEmployeeSelection}
          />
        </div>

        <button className="cc-search-btn" onClick={handleApplyFilter} disabled={!hasEffectiveEmployees}>
          <SearchIcon sx={{ fontSize: 16 }} /> {t('etats.filter.filterBtn')}
        </button>

        <button className="cc-export-btn" onClick={handlePrintReport} disabled={!hasEffectiveEmployees}>
          <PrintIcon sx={{ fontSize: 16 }} /> {t('etats.filter.printBtn')}
        </button>
      </div>

    </div>
  );
}

export default FilterPresence;
