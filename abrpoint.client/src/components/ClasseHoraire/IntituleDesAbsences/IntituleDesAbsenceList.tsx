import { CheckCircle, Cancel } from "@mui/icons-material";
import { Alert, Box, Container, Grid, Skeleton, Snackbar } from "@mui/material";
import { MRT_ColumnDef } from "material-react-table";
import { useState, useEffect, useMemo } from "react";
import useDeleteAbsence from "../../../hooks/absenceHooks/useDeleteAbsence";
import useGetAllAbsences from "../../../hooks/absenceHooks/useGetAllAbsence";
import { Absence, AbsenceDto } from "../../../models/Absence";
import { useAbsenceContext } from "../../helper/AbsenceContext";
import DataList from "../../lists/list";
import ForbiddenMessage from "../../AlertModal/ForbiddenMessage";

const AbsenceListContent = () => {
  const soccod = sessionStorage.getItem('soccod');
  const [data, setData] = useState<Absence[]>([]);
  const { setSelectedAbsence } = useAbsenceContext();

  const { data: fetchedData = [], refetch, isLoading } = useGetAllAbsences();
  const { mutate: deleteAbsence } = useDeleteAbsence();
  const [forbiddenMsg, setForbiddenMsg] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error",
  });

  useEffect(() => {
    setData(fetchedData);
  }, [fetchedData]);

  // Now takes an id to delete
  const deleteIntituleAbs = (absence: AbsenceDto) => {
    let code = absence.abscod;
    deleteAbsence(
      { soccod: soccod ?? "", code },
      {
        onSuccess() {
          setData((prev) => prev.filter((abs) => abs.abscod !== absence.abscod));
          setSnackbar({
            open: true,
            message: "Absence supprimée avec succès!",
            severity: "success",
          });
        },
        onError(error: any) {
          if (error?.response?.status === 403) {
            setForbiddenMsg("Vous n’avez pas la permission de supprimer cette absence.");
          } else {
            setSnackbar({
              open: true,
              message: `Erreur: ${error.message}`,
              severity: "error",
            });
          }
        },
      }
    );
  };


  const columns = useMemo<MRT_ColumnDef<Absence>[]>(() => [
    {
      id: 'absenceDetails',
      header: '',
      columns: [
        { accessorKey: 'abscod', header: 'Code', size: 60 },
        { accessorKey: 'abslib', header: 'Absence', size: 150 },
        {
          accessorKey: 'abscng',
          header: 'Congé',
          size: 60,
          Cell: ({ cell }) =>
            cell.getValue() === '0' ? <CheckCircle color="success" /> : <Cancel color="error" />,
        },
        {
          accessorKey: 'abspayer',
          header: 'Payé',
          size: 60,
          Cell: ({ cell }) =>
            cell.getValue() === 'O' ? <CheckCircle color="success" /> : <Cancel color="error" />,
        },
        {
          accessorKey: 'abssanc',
          header: 'Sanction',
          size: 60,
          Cell: ({ cell }) =>
            cell.getValue() === 'O' ? <CheckCircle color="success" /> : <Cancel color="error" />,
        },
        {
          accessorKey: 'absaut',
          header: 'Autorisé',
          size: 60,
          Cell: ({ cell }) =>
            cell.getValue() === 1 ? <CheckCircle color="success" /> : <Cancel color="error" />,
        },
        {
          accessorKey: 'abspar',
          header: 'Périodicité',
          size: 60,
          Cell: ({ cell }) => {
            const val = cell.getValue();
            return val === 'A' ? 'Annuelle'
              : val === 'M' ? 'Mensuelle'
              : val === 'T' ? 'Trimestre'
              : val === 'S' ? 'Semestre'
              : String(val);
          },
        },
      ],
    },
  ], []);

  if (isLoading) {
    return (
      <Container>
        <Skeleton variant="circular" width={40} height={40} />
      </Container>
    );
  }

  return (
    <Box>
      <Grid container>
        <Grid item xs={12}>
          {/* Forbidden message */}
          {forbiddenMsg && <ForbiddenMessage message={forbiddenMsg} />}
          <DataList
            data={data}
            columns={columns}
            message="Vous êtes sûr de supprimer cette intitulé d'absence ?"
            deleteMethod={deleteIntituleAbs} // now gets the code
            idKey="abscod"
            refetchMethod={refetch}
            reportGeneration1={undefined}
            reportGeneration2={undefined}
            reportGeneration3={undefined}
            reportGeneration4={undefined}
            empHoraires={undefined}
            actions={true}
            setData={setSelectedAbsence} pageSize={10} purge={undefined}
            />
        </Grid>

        {/* Snackbar notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
      </Grid>
    </Box>
  );
};
export default AbsenceListContent