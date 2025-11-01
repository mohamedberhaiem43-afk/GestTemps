import { useEffect, useMemo, useState } from "react";
import { MaterialReactTable, type MRT_ColumnDef } from "material-react-table";
import { Box, Button, Typography } from "@mui/material";
import { Avance } from "../../../models/Avance";
import useGetAvances from "../../../hooks/avanceHooks/useGetAvances";
import useUpdateAvance from "../../../hooks/avanceHooks/useUpdateAvance";

interface AccompteListProps {
  month: string;
  year: string;
  niveau: string;
}

function AccompteList({ month, year, niveau }: AccompteListProps) {
  const { data, isLoading, isError } = useGetAvances(month, year, niveau);
  const [avances, setAvances] = useState<Avance[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<string, string | undefined>>({});
  const [editedAvances, setEditedAvances] = useState<Record<string, Avance>>({});

  useEffect(() => {
    if (Array.isArray(data)) {
      setAvances(data);
    } else {
      setAvances([]);
    }
  }, [data]);

  const validateMontant = (value: number) => !isNaN(value) && value >= 0;

  const columns = useMemo<MRT_ColumnDef<Avance>[]>(() => [
    {
      accessorKey: "empcod",
      header: "Matricule",
      enableEditing: false,
      size: 100,
    },
    {
      accessorKey: "emplib",
      header: "Nom et Prénom",
      enableEditing: false,
      size: 150,
    },
    {
      accessorKey: "montant",
      header: "Montant",
      size: 100,
      muiEditTextFieldProps: ({ cell, row }) => ({
        type: "number",
        required: true,
        error: !!validationErrors?.[cell.id],
        helperText: validationErrors?.[cell.id],
        onBlur: (event) => {
          const value = parseFloat(event.currentTarget.value);
          const validationError = !validateMontant(value)
            ? "Invalid montant"
            : undefined;
          setValidationErrors({
            ...validationErrors,
            [cell.id]: validationError,
          });
          setEditedAvances({
            ...editedAvances,
            [row.id]: { ...row.original, montant: value },
          });
        },
      }),
    },
  ], [validationErrors, editedAvances]);

  const updateAvanceMutation = useUpdateAvance();

const handleSaveAvances = async () => {
  if (Object.values(validationErrors).some((e) => !!e)) return;

  const updates = Object.values(editedAvances);

  for (const avance of updates) {
    try {
      await updateAvanceMutation.mutateAsync({
        mois: month,
        annee: year,
        niveau,
        empcod: avance.empcod,
        montant: avance.montant,
      });
    } catch (error) {
      console.error("Erreur lors de la mise à jour :", error);
    }
  }

  const updated = avances.map((a) =>
    editedAvances[a.empcod] ? { ...a, ...editedAvances[a.empcod] } : a
  );

  setAvances(updated);
  setEditedAvances({});
};


  return (
    <MaterialReactTable
      columns={columns}
      data={avances}
      getRowId={(row) => row.empcod}
      enableEditing
      editDisplayMode="cell"
      renderBottomToolbarCustomActions={() => (
        <Box sx={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <Button
            variant="contained"
            color="success"
            onClick={handleSaveAvances}
            disabled={
              Object.keys(editedAvances).length === 0 ||
              Object.values(validationErrors).some((e) => !!e)
            }
          >
            Save
          </Button>
          {Object.values(validationErrors).some((e) => !!e) && (
            <Typography color="error">
              Fix validation errors before saving.
            </Typography>
          )}
        </Box>
      )}
      state={{
        isLoading,
        showAlertBanner: isError,
        showProgressBars: isLoading,
      }}
    />
  );
}

export default AccompteList;
