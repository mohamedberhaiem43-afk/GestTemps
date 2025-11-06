import { Box, Container, Grid, IconButton, Typography } from "@mui/material";
import DataList from "../../lists/list";
import { useMemo, useState } from "react";
import { MRT_ColumnDef } from "material-react-table";
import EchContrat from "../../../models/EcheanceContrat";
import InputComponent from "../../Inputs/Input";
import { Print, Search } from "@mui/icons-material";
import axios from "axios";
import formatDateForApi from "../../helper/TimeConverter/formatDateForApi";
import ContratReportService from "../../../services/ContratService/ContratReportService";
import CustomizedSnackbars from "../../Snackbar/Snackbar";

function EcheanceContrat() {
  const [echdeb, setEchdeb] = useState<string>(formatDateForApi(new Date()));
  const [echfin, setEchfin] = useState<string>(formatDateForApi(new Date()));
  const [contrats, setContrats] = useState<EchContrat[]>([]);

  // Snackbar state
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "info" as "success" | "error" | "warning" | "info",
  });

  const handleSnackbarOpen = (message: string, severity: 'success' | 'error' | 'warning' | 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const soccod = sessionStorage.getItem('soccod');
  const token = localStorage.getItem('authToken');
  const headers = { Authorization: `Bearer ${token}` };

  const columns = useMemo<MRT_ColumnDef<EchContrat>[]>(() => [
    {
      id: 'echeance-contrats',
      header: '',
      columns: [
        { accessorKey: 'empmat', header: 'Matricule', size: 60 },
        { accessorKey: 'emplib', header: 'Nom et Prénom', size: 60 },
        {
          accessorKey: 'condat',
          header: 'Date Contrat',
          size: 180,
          Cell: ({ cell }) => {
            const value = cell.getValue<Date>();
            return value ? new Date(value).toLocaleDateString() : '';
          },
        },
        { accessorKey: 'concod', header: 'N°Contrat', size: 180 },
        {
          accessorKey: 'empemb',
          header: 'Date Début',
          size: 180,
          Cell: ({ cell }) => {
            const value = cell.getValue<Date>();
            return value ? new Date(value).toLocaleDateString() : '';
          },
        },
        {
          accessorKey: 'empsort',
          header: 'Date Fin',
          size: 180,
          Cell: ({ cell }) => {
            const value = cell.getValue<Date>();
            return value ? new Date(value).toLocaleDateString() : '';
          },
        },
      ],
    },
  ], []);

  async function handleApplyFilter(): Promise<void> {
    const uticod = localStorage.getItem('Uticod');
    if (!soccod || !uticod) return;

    try {
      const formattedEchdeb = formatDateForApi(new Date(echdeb));
      const formattedEchfin = formatDateForApi(new Date(echfin));

      const response = await axios.get(
        `${import.meta.env.VITE_REACT_APP_API_URL}/Contrats/get-echeance/${soccod}/${formattedEchdeb}/${formattedEchfin}/${uticod}`,
        { headers }
      );
      setContrats(response.data);
    } catch (error: any) {
      if (error?.response?.status === 403) {
        handleSnackbarOpen("Action interdite : vous n'avez pas la permission.", "error");
      } else {
        handleSnackbarOpen("Erreur lors de la récupération des contrats.", "error");
      }
      console.error("Erreur lors de la récupération des contrats:", error);
    }
  }

  const handlePrintReport = async () => {
    try {
      const formattedEchdeb = formatDateForApi(new Date(echdeb));
      const formattedEchfin = formatDateForApi(new Date(echfin));

      const pdfBlob = await ContratReportService.getReport(
        `get-echeance-contrat-report/${soccod}/${formattedEchdeb}/${formattedEchfin}`
      );

      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `EcheanceContrat_${formattedEchdeb}_${formattedEchfin}.pdf`);
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      link.remove();
    } catch (error: any) {
      if (error?.response?.status === 403) {
        handleSnackbarOpen("Accès refusé à la génération du rapport.", "error");
      } else {
        handleSnackbarOpen("Erreur lors de la génération du rapport.", "error");
      }
      console.error("Erreur génération rapport:", error);
    }
  };

  return (
    <Container>
      <Box width={'95vw'} height={'85vh'} mt={-1}>
        <Typography variant="h6" fontWeight={'bold'} color={'primary'}>
          Echéance Contrat
        </Typography>

        <Grid container xs={12} spacing={2} display={'flex'} justifyContent={'center'} mt={2}>
          <Grid item xs={2}>
            <InputComponent type={'date'} label={'Echéance Début'} value={echdeb} setValue={setEchdeb} />
          </Grid>
          <Grid item xs={2}>
            <InputComponent type={'date'} label={'Echéance Fin'} value={echfin} setValue={setEchfin} />
          </Grid>
          <Grid item xs={4} display={'flex'}>
            <Grid item xs={1.5} mt={2}>
              <IconButton color="primary" onClick={handleApplyFilter} sx={{ border: '1px solid', borderColor: 'divider' }}>
                <Search />
              </IconButton>
            </Grid>
            <Grid item xs={1.5} mt={2}>
              <IconButton color="primary" onClick={handlePrintReport} sx={{ border: '1px solid', borderColor: 'divider' }}>
                <Print />
              </IconButton>
            </Grid>
          </Grid>
        </Grid>

        <Grid mt={3}>
          <DataList
            data={contrats}
            columns={columns}
            message={undefined}
            deleteMethod={undefined}
            idKey={'concod'}
            refetchMethod={undefined}
            reportGeneration1={undefined}
            reportGeneration2={undefined}
            reportGeneration3={undefined}
            reportGeneration4={undefined}
            empHoraires={undefined}
            setData={undefined}
            pageSize={5}
            purge={undefined}
          />
        </Grid>
      </Box>

      {/* ✅ Snackbar affiché ici */}
      <CustomizedSnackbars
        open={snackbar.open}
        message={snackbar.message}
        severity={snackbar.severity}
        onClose={handleSnackbarClose}
      />
    </Container>
  );
}

export default EcheanceContrat;
