import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import useGetCummulMensuelle from "../../../hooks/calendrierHooks/useGetCummulMensuelle";
import { Calendrier } from "../../../models/Calendrier";
import InputComponent from "../../Inputs/Input";
import { Box, Grid } from "@mui/material";
import { useState } from "react";
import { useCalendrierContext } from "../../helper/CalendrierContext";
import { t } from "i18next";

const MONTHS = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
  "Juil", "Août", "Sep", "Oct", "Nov", "Déc"
];

function CumulHeuresMensuelle() {
  const {selectedCalendrier} = useCalendrierContext();
  const { data = [] } = useGetCummulMensuelle(selectedCalendrier ?? "");
  const calendrierData = Array.isArray(data) ? data : [];
  const [nbHreJour, setNbHreJour] = useState(8);
  const [nbJourMois, setNbJourMois] = useState(20);
  const [nbHreMois, setNbHreMois] = useState(nbHreJour * nbJourMois);
  // Initialize an empty matrix
  const formattedData: Record<string, Record<number, number>> = {
    "Jours/Mois": {},
    "Heures/Mois": {},
    "Heures Ouv": {},
    "Heures/Jour": {}
  };

  // Fill the matrix with the correct values
  calendrierData.forEach((calendrier: Calendrier) => {
    const monthIndex = calendrier.calMois; // Ensure this is a number (1-12)

    formattedData["Jours/Mois"][parseInt(monthIndex)] = calendrier.calTrav;
    formattedData["Heures/Mois"][parseInt(monthIndex)] = calendrier.calNbh;
    formattedData["Heures Ouv"][parseInt(monthIndex)] = calendrier.calHouv;
    formattedData["Heures/Jour"][parseInt(monthIndex)] = calendrier.calHjour;
  });

  return (
    <Box  display={'flex'} gap={5}>
      <Grid>
        <TableContainer component={Paper} sx={{ maxHeight: 450}} >
          
          <Table size="small" aria-label="table-cumul-heures">
            <TableHead sx={{ backgroundColor: "#1976d2" }}>
              <TableRow>
                <TableCell align="left" sx={{ color: "white" }}>Nombre</TableCell>
                {MONTHS.map((month) => (
                  <TableCell key={month} align="center" sx={{ color: "white" }}>{month}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(formattedData).map(([label, values]) => (
                <TableRow key={label}>
                  <TableCell align="left">{label}</TableCell>
                  {MONTHS.map((_, index) => (
                    <TableCell key={index} align="center">
                      {values[index + 1] ?? "-"}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>

        </TableContainer>
      </Grid>
      <Grid container spacing={2} mt={2}>
      <Grid item xs={4} sm={4} md={4}>
            <InputComponent type="number" label={t('common.hoursPerDay')} value={nbHreJour} setValue={setNbHreJour} />
        </Grid>
        <Grid item xs={4} sm={4} md={4}>
            <InputComponent type="number" label={t('common.daysPerMonth')} value={nbJourMois} setValue={setNbJourMois} />
        </Grid>
        <Grid item xs={4} sm={4} md={4}>
            <InputComponent type="number" label={t('common.hoursPerMonth')} value={nbHreMois} setValue={setNbHreMois} />
        </Grid>
      </Grid>
    </Box>

  );
}

export default CumulHeuresMensuelle;
