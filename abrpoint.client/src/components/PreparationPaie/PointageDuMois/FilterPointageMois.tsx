import { Box, Grid, IconButton } from "@mui/material";
import { useFeedbackSnackbar } from "../../helper/FeedbackSnackbar";
import { Search } from "@mui/icons-material";
import { useEffect, useState } from "react";
import axios from "axios";
import InputComponent from "../../Inputs/Input";
import SelectInputComponent from "../../SelectInputComponent/SelectInputComponent";
import { useDateMoisPointageRange } from "./FilterPointageMoisContext";
import useGetEmployeesLibs from "../../../hooks/employeHooks/useGetEmployeesLibs";
import { useAuth } from "../../helper/AuthProvider";
import apiInstance from "../../API/apiInstance";
import "./WeeklyHoursTable.css";

type ParamMois = {
  joudeb: string;
  joufin: string;
  moisdeb: string;
  moisfin: string;
};

// 30 par défaut (ramené à 28/29/31 selon le mois par clampDay()) pour couvrir
// le mois entier quand l'admin n'a rien configuré dans Param. Société.
const defaultParamMois: ParamMois = {
  joudeb: "01",
  joufin: "30",
  moisdeb: "P",
  moisfin: "P",
};

const getCurrentMonthValue = () => String(new Date().getMonth() + 1);
const getCurrentYearValue = () => new Date().getFullYear().toString();

const clampDay = (dayValue: string, year: number, month: number) => {
  const maxDay = new Date(year, month, 0).getDate();
  const parsedDay = Number.parseInt(dayValue, 10);

  if (Number.isNaN(parsedDay)) {
    return 1;
  }

  return Math.min(Math.max(parsedDay, 1), maxDay);
};

const pad = (value: number) => String(value).padStart(2, "0");

const normalizeMonth = (value: string) => {
  if (!value) {
    return "";
  }

  const parsedMonth = Number.parseInt(value, 10);
  if (Number.isNaN(parsedMonth)) {
    return "";
  }

  return String(Math.min(Math.max(parsedMonth, 1), 12));
};

const buildDateRange = (monthValue: string, yearValue: string, paramMois: ParamMois) => {
  const parsedMonth = Number.parseInt(monthValue, 10);
  const parsedYear = Number.parseInt(yearValue, 10);

  if (Number.isNaN(parsedMonth) || Number.isNaN(parsedYear)) {
    return { dateDebut: "", dateFin: "" };
  }

  let startMonth = paramMois.moisdeb === "P" ? parsedMonth - 1 : parsedMonth;
  let endMonth = paramMois.moisfin === "P" ? parsedMonth - 1 : parsedMonth;

  let startYear = startMonth === 0 ? parsedYear - 1 : parsedYear;
  let endYear = endMonth === 0 ? parsedYear - 1 : parsedYear;

  startMonth = startMonth === 0 ? 12 : startMonth;
  endMonth = endMonth === 0 ? 12 : endMonth;

  const startDay = clampDay(paramMois.joudeb, startYear, startMonth);
  const endDay = clampDay(paramMois.joufin, endYear, endMonth);

  return {
    dateDebut: `${startYear}-${pad(startMonth)}-${pad(startDay)}`,
    dateFin: `${endYear}-${pad(endMonth)}-${pad(endDay)}`,
  };
};

function FilterPointageMois() {
  const { soccod } = useAuth();
  const [selectedFiliale, setSelectedFiliale] = useState(sessionStorage.getItem("sitcod") ?? "");
  const [selectedService, setSelectedService] = useState("");
  const [selectedRegime, setSelectedRegime] = useState("");

  const { data: employeesLibs = [] } = useGetEmployeesLibs(selectedFiliale, selectedService, undefined, selectedRegime);
  const dateRangeContext = useDateMoisPointageRange();
  const setDateRange = dateRangeContext?.setDateRange;

  const regime = {
    M: "Mensuelle",
    H: "Horaire",
  };

  const semaine = {
    0: "Toute",
    1: "SEM 1",
    2: "SEM 2",
    3: "SEM 3",
    4: "SEM 4",
    5: "SEM 5",
    6: "SEM 6",
  };

  const [selectedEmpcods, setSelectedEmpcods] = useState<string[]>([]);
  const [paramMois, setParamMois] = useState<ParamMois>(defaultParamMois);
  const [filiale, setFiliale] = useState<Record<string, string>>();
  const [services, setServices] = useState<Record<string, string>>();
  const [mois, setMois] = useState(getCurrentMonthValue());
  const [dateDebut, setStartDate] = useState("");
  const [dateFin, setEndDate] = useState("");
  const [annee, setAnnee] = useState(getCurrentYearValue());
  const [selectedSemaine, setSelectedSemaine] = useState("0");
  const feedback = useFeedbackSnackbar();

  useEffect(() => {
    if (!soccod) {
      return;
    }

    apiInstance
      .get(`/Sites/get-sitlibs/${soccod}`)
      .then((res) => setFiliale(res.data))
      .catch((err) => console.error(err));

    apiInstance
      .get(`/Parametres/deb-mois/${soccod}`)
      .then((res) => {
        const nextParamMois: ParamMois = {
          joudeb: res.data.joudeb,
          joufin: res.data.joufin,
          moisdeb: res.data.moisdeb,
          moisfin: res.data.moisfin,
        };

        const currentMonth = getCurrentMonthValue();
        const currentYear = getCurrentYearValue();
        const initialRange = buildDateRange(currentMonth, currentYear, nextParamMois);

        setParamMois(nextParamMois);
        setMois(currentMonth);
        setAnnee(currentYear);
        setStartDate(initialRange.dateDebut);
        setEndDate(initialRange.dateFin);

        if (setDateRange) {
          setDateRange((prev) => ({
            ...prev,
            dateDebut: initialRange.dateDebut,
            dateFin: initialRange.dateFin,
            selectedFiliale: sessionStorage.getItem("sitcod") ?? "",
            selectedRegime: "",
            selectedService: "",
            mois: currentMonth,
            semaine: "0",
            annee: currentYear,
            empcods: [],
          }));
        }
      })
      .catch((err) => {
        console.error("Error:", err.response ? err.response.data : err.message);
      });
  }, [soccod, setDateRange]);

  useEffect(() => {
    if (!soccod) {
      return;
    }

    axios
      .get(`${import.meta.env.VITE_REACT_APP_API_URL}/Services/get-servlibs/${soccod}`, {
        withCredentials: true,
      })
      .then((res) => setServices(res.data))
      .catch((err) => console.error(err));
  }, [soccod]);

  useEffect(() => {
    const nextRange = buildDateRange(mois, annee, paramMois);

    setStartDate(nextRange.dateDebut);
    setEndDate(nextRange.dateFin);
  }, [mois, annee, paramMois]);

  const handleApplyFilter = () => {
    if (selectedEmpcods.length === 0) {
      feedback.showWarning("Veuillez sélectionner au moins un employé.");
      return;
    }

    if (setDateRange) {
      setDateRange((prev) => ({
        ...prev,
        dateDebut,
        dateFin,
        selectedFiliale: selectedFiliale ?? "",
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
            label="Employes"
            value={selectedEmpcods ?? []}
            setValue={setSelectedEmpcods}
            maplist={employeesLibs}
            multiple={true}
          />
        </Grid>

        <Grid item xs={1.5}>
          {filiale && (
            <SelectInputComponent
              label="Site"
              value={selectedFiliale ?? ""}
              setValue={setSelectedFiliale}
              maplist={filiale}
            />
          )}
        </Grid>

        <Grid item xs={1.5}>
          {services && (
            <SelectInputComponent
              label="Service"
              value={selectedService}
              setValue={setSelectedService}
              maplist={services}
            />
          )}
        </Grid>

        <Grid item xs={1.5}>
          <SelectInputComponent
            label="Regime"
            value={selectedRegime}
            setValue={setSelectedRegime}
            maplist={regime}
          />
        </Grid>

        <Grid item xs={0.6}>
          <InputComponent
            type="number"
            label="Mois"
            value={mois}
            setValue={(value: string) => setMois(normalizeMonth(value))}
          />
        </Grid>

        <Grid item xs={0.9}>
          <InputComponent
            type="number"
            label="Annee"
            value={annee}
            setValue={setAnnee}
          />
        </Grid>

        <Grid item xs={1.5}>
          <InputComponent
            type="date"
            label="Date Debut"
            value={dateDebut}
            setValue={setStartDate}
          />
        </Grid>

        <Grid item xs={1.5}>
          <InputComponent
            type="date"
            label="Date Fin"
            value={dateFin}
            setValue={setEndDate}
          />
        </Grid>

        <Grid item xs={1}>
          <SelectInputComponent
            label="Semaine"
            value={selectedSemaine}
            setValue={setSelectedSemaine}
            maplist={semaine}
          />
        </Grid>

        <Grid item xs={0.5}>
          <IconButton
            color="primary"
            onClick={handleApplyFilter}
            sx={{ border: "1px solid", borderColor: "divider" }}
          >
            <Search />
          </IconButton>
        </Grid>
      </Grid>

      {feedback.element}
    </Box>
  );
}

export default FilterPointageMois;
