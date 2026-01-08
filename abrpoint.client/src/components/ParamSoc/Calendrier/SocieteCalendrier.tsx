import { useEffect, useState } from "react";
import {
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  Grid,
  Typography,
  IconButton,
} from "@mui/material";
import CheckboxComponent from "../../CheckboxComponent/CheckboxComponent";
import InputComponent from "../../Inputs/Input";
import SelectInputComponent from "../../SelectInputComponent/SelectInputComponent";
import useGetCalendrierSociete from "../../../hooks/calendrierHooks/useGetCalendrierSociete";
import SaveIcon from "@mui/icons-material/Save";
import useUpdateCalendrier from "../../../hooks/calendrierHooks/useUpdateCalendrier";
import { useCalendrierContext } from "../../helper/CalendrierContext";
import useGetCalendrier from "../../../hooks/calendrierHooks/useGetCalendriers";
import useCloneCalendrier from "../../../hooks/calendrierHooks/useCloneCalendrier";
import { ContentCopy } from "@mui/icons-material";

const WEEKDAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const daysRecord = {
  "0": "Dimanche",
  "1": "Lundi",
  "2": "Mardi",
  "3": "Mercredi",
  "4": "Jeudi",
  "5": "Vendredi",
  "6": "Samedi",
  "7": "Samdim"
};
type CalendarEntry = {
  soccod: string;
  calAn: string;
  calTrav: number;
  calNbh: number;
  calHouv: number;
  calHjour: number;
  calMois: string;
  calSem: string;
  calDate: string;
};
function SocieteCalendrier() {
  const {selectedCalendrier,setSelectedCalendrier} = useCalendrierContext();

  const [selectedMonth, setSelectedMonth] = useState("01");
  const [tousLesMois, setTousLesMois] = useState(false);
  const [jourRepos, setJourRepos] = useState("0");
  const [allDay, setAllDay] = useState("8");
  const [calendrier, setCalendrier] = useState("8");
  const [samedi, setSamedi] = useState("5");
  useEffect(() => {
    setSelectedCalendrier("2024");
  }, [setSelectedCalendrier]); // Runs only once when component mounts
  const { data = [],refetch } = useGetCalendrierSociete(selectedCalendrier ?? "");
  const { data : calends = [] } = useGetCalendrier();
  const soccod = localStorage.getItem("soccod") || "01"; // Default to "01" if not found
 // ✅ Use the mutation hook
  const updateCalendrier = useUpdateCalendrier(
    soccod,
    selectedCalendrier ?? "",
    selectedMonth,
    Number(allDay),
    Number(samedi),
    tousLesMois ? 1 : 0,
    jourRepos
  );
  const cloneCalendrier = useCloneCalendrier(
  Number(selectedCalendrier)
);
const handleClone = () => {
  if (
    !window.confirm(
      `Cloner le calendrier ${Number(selectedCalendrier) - 1} vers ${selectedCalendrier} ?`
    )
  )
    return;

  cloneCalendrier.mutate(undefined, {
    onSuccess: () => {
      refetch();
    },
  });
};




  // ✅ Function to handle Save Click
  const handleSave = () => {
    updateCalendrier.mutate(undefined, {
      onSuccess: () => {
        refetch();
      },
    });
  };
  
 // Properly type the filtered data
  const filteredData: CalendarEntry[] = Array.isArray(data)
    ? data.filter((entry: CalendarEntry) => entry.calMois === selectedMonth)
    : [];

  let totalMonthHours = 0;
  let totalMonthDays = 0;

  filteredData.forEach((entry: { calNbh: number; }) => {
    totalMonthHours += entry.calNbh;
    if (entry.calNbh > 0) totalMonthDays += 1;
  });

  return (
    <TableContainer component={Paper} sx={{ margin: "auto", mt: 2, mr: 17 }}>
      <Tabs
        value={selectedMonth}
        onChange={(e, newValue) =>
          {
            e.preventDefault();
            setSelectedMonth(newValue.toString().padStart(2, "0"))}
          } 
        variant="scrollable"
        scrollButtons="auto"
        sx={{ borderBottom: 1, borderColor: "divider" }}
      >
        {[...new Set((Array.isArray(data) ? data : []).map((entry: { calMois: any; }) => entry.calMois))].map((month, index) => (
          <Tab key={index} label={`Mois ${month}`} value={month} />
        ))}
      </Tabs>

      <Box sx={{ display: "flex", justifyContent: "center", gap: 5, mt: 2 }}>
        <Grid item xs={1}>
          <InputComponent type="number" label="Année" value={selectedCalendrier} setValue={setSelectedCalendrier}  />
        </Grid>
        <Grid item xs={1}>
          <InputComponent type="number" label="Tous les jours" value={allDay} setValue={setAllDay}  />
        </Grid>
        <Grid item xs={1}>
          <InputComponent type="number" label="Samedi" value={samedi} setValue={setSamedi}  />
        </Grid>
        <Grid item xs={1.5}>
          <SelectInputComponent label="Jour de Repos" value={jourRepos} setValue={setJourRepos} maplist={daysRecord} />
        </Grid>
        <Grid item xs={1.5} sm={4} mt={2.5}>
          <CheckboxComponent label="Tous les mois" value={tousLesMois} setValue={setTousLesMois} />
        </Grid>
        <Grid item xs={1.5}>
            <SelectInputComponent label="Calendrier" value={calendrier} setValue={setCalendrier} maplist={calends} /> 
        </Grid>
        <IconButton onClick={handleSave} color="primary" aria-label="save" type="submit">
              <SaveIcon />
        </IconButton>
        <IconButton
          onClick={handleClone}
          color="secondary"
          aria-label="clone"
          title="Cloner l'année précédente"
        >
          <ContentCopy />
        </IconButton>

      </Box>

      <Table size="small" aria-label="company calendar">
        <TableHead sx={{ backgroundColor: "#1976d2" }}>
          <TableRow>
            <TableCell align="center" sx={{ color: "white" }}>Semaine</TableCell>
            {WEEKDAYS.map((day) => (
              <TableCell key={day} align="center" sx={{ color: "white" }}>{day}</TableCell>
            ))}
            <TableCell align="center" sx={{ color: "white" }}>Total Heures</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {[...new Set(filteredData.map((entry: { calSem: any; }) => entry.calSem))].map((weekNumber) => {
            const weekEntries = filteredData.filter((entry: { calSem: unknown; }) => entry.calSem === weekNumber);
            let totalWeekHours = 0;
            
            return (
                    <TableRow key={weekNumber}>
                      <TableCell align="center">{weekNumber}</TableCell>
                      {WEEKDAYS.map((day, index) => {
                        const dayEntry = weekEntries.find((entry: CalendarEntry) => 
                          new Date(entry.calDate).getDay() === (index + 1) % 7
                        );
                        const hours = dayEntry ? dayEntry.calNbh : 0;
                        totalWeekHours += hours;
                        return (
                          <TableCell key={day} align="center">  {/* Using day as key instead of index */}
                            {dayEntry ? `${dayEntry.calDate.split("T")[0]} (${hours}h)` : "-"}
                          </TableCell>
                        );
                      })}
                      <TableCell align="center">{totalWeekHours}h</TableCell>
                    </TableRow>
                  );
          })}
        </TableBody>
      </Table>

      <Typography variant="h6" align="center" sx={{ mt: 2 }} color={'error'}>
        Total du mois : {totalMonthHours} heures - {totalMonthDays} jours travaillés
      </Typography>
    </TableContainer>
  );
}

export default SocieteCalendrier;
