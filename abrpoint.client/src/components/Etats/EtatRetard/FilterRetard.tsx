import { useContext, useEffect, useState } from "react";
import { Typography } from "@mui/material";
import SearchIcon from '@mui/icons-material/Search';
import PrintIcon from '@mui/icons-material/Print';
import useGetEmployeesLibs from "../../../hooks/employeHooks/useGetEmployeesLibs";
import { useDateRange } from "../../Pointeuse/EtatPeriodique/FilterContext";
import { EmployeeContext } from "../../Pointeuse/EtatPeriodique/EmployeeContext";
import { useAuth } from "../../helper/AuthProvider";
import apiInstance from "../../API/apiInstance";
import { useEmployeeFilter } from "../../../hooks/employeHooks/useEmployeeFilter";
import '../CahierConge/CahierConge.css';

function FilterRetard() {
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
    effectiveEmployeesLabel,
    handleEmployeeSelection: baseHandleEmployeeSelection,
  } = useEmployeeFilter();

  const regimeOptions: Record<string, string> = { 'M': 'Mensuelle', 'H': 'Horaire' };

  useEffect(() => {
    setSelectedRegime("T");
  }, [setSelectedRegime]);

  const [compterAvance, setCompterAvance] = useState(false);
  const [retmat, setRetmat] = useState(true);
  const [retapres, setRetapres] = useState(true);
  const [retmin, setRetmin] = useState(0);

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
        console.error("Error:", err.response ? err.response.data : err.message);
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
        compterAvance,
        retmin,
        retmat,
        retapres,
      });
    }
  };

  // Options (checkboxes) are applied immediately without refetching data
  useEffect(() => {
    if (!setDateRange) return;

    setDateRange((prev) => ({
      ...prev,
      compterAvance,
      retmin,
      retmat,
      retapres,
    }));
  }, [compterAvance, retmin, retmat, retapres, setDateRange]);

  const handlePrintReport = async () => {
    try {
      if (!soccod || !hasEffectiveEmployees) return;

      const params = new URLSearchParams();
      effectiveEmpcods.forEach((code) => params.append("empcods", code));

      const response = await apiInstance.get(
        `/Presences/get-etat-retard-report/${soccod}/${dateDebut}/${dateFin}/${selectedRegime}`,
        {
          params,
          responseType: "blob",
        },
      );

      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `etat-retard-${new Date().toISOString()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Erreur generation rapport:", error);
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
          <label className="cc-filter-label">Filiale</label>
          <select className="cc-filter-select" value={selectedFiliale} onChange={(e) => setSelectedFiliale(e.target.value)}>
            <option value="">Toutes</option>
            {Object.entries(filiale).map(([cod, lib]) => (
              <option key={cod} value={cod}>{lib}</option>
            ))}
          </select>
        </div>

        <div className="cc-filter-field-narrow">
          <label className="cc-filter-label">Service</label>
          <select className="cc-filter-select" value={selectedService} onChange={(e) => setSelectedService(e.target.value)} disabled={isServiceLocked}>
            <option value="">{isServiceLocked ? 'Mon service' : 'Tous'}</option>
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

        <div className="cc-filter-field-narrow">
          <label className="cc-filter-label">Retard min</label>
          <input className="cc-filter-input" type="number" value={retmin} onChange={(e) => setRetmin(Number(e.target.value || 0))} />
        </div>

        <div className="cc-filter-field">
          <label className="cc-filter-label">Employes</label>
          <select
            className="cc-filter-select"
            multiple
            value={selectedEmpCodes}
            onChange={(e) => {
              const values = Array.from(e.target.selectedOptions).map((option) => option.value);
              handleEmployeeSelection(values);
            }}
          >
            {Object.entries((emplibs || {}) as Record<string, string>).map(([cod, lib]) => (
              <option key={cod} value={cod}>{lib}</option>
            ))}
          </select>
        </div>

        <button className="cc-search-btn" onClick={handleApplyFilter} disabled={!hasEffectiveEmployees}>
          <SearchIcon sx={{ fontSize: 16 }} /> FILTRER
        </button>

        <button className="cc-export-btn" onClick={handlePrintReport} disabled={!hasEffectiveEmployees}>
          <PrintIcon sx={{ fontSize: 16 }} /> IMPRIMER
        </button>
      </div>

      <div className="cc-filter-row" style={{ marginTop: 10 }}>
        <label className="cc-filter-label" style={{ marginBottom: 0, marginRight: 8 }}>Options:</label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#334155' }}>
          <input type="checkbox" checked={compterAvance} onChange={(e) => setCompterAvance(e.target.checked)} /> Compter avance
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#334155' }}>
          <input type="checkbox" checked={retmat} onChange={(e) => setRetmat(e.target.checked)} /> Retard matin
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#334155' }}>
          <input type="checkbox" checked={retapres} onChange={(e) => setRetapres(e.target.checked)} /> Retard AM
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

export default FilterRetard;
