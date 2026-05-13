import React, { useState, useEffect } from "react";
import {
  Button,
  Checkbox,
  FormControlLabel,
  Grid,
  Box,
  Paper,
  TextField,
  Snackbar,
  Alert,
} from "@mui/material";
import { Save, Refresh, Cancel } from "@mui/icons-material";

import { Qualification as QualificationModel } from "../../../models/Qualification";
import useAddQualification from "../../../hooks/QualificationHooks/useAddQualification";
import useUpdateQualification from "../../../hooks/QualificationHooks/useUpdateQualification";

interface QualificationFormProps {
  qualificationToEdit?: QualificationModel | null;
  onEditComplete?: () => void;
}

export function QualificationForm({
  qualificationToEdit,
  onEditComplete,
}: QualificationFormProps) {
  const emptyForm: QualificationModel = {
    quacod: "",
    soccod: "",
    qualib: "",
    catcod: "0",
  };

  const [formData, setFormData] =
    useState<QualificationModel>(emptyForm);

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({
    open: false,
    message: "",
    severity: "success",
  });

  const { mutate: addQualification, isPending: isAdding } =
    useAddQualification();
  const { mutate: updateQualification, isPending: isUpdating } =
    useUpdateQualification();

  const isEditMode = !!qualificationToEdit;
  const isLoading = isAdding || isUpdating;

  useEffect(() => {
    if (qualificationToEdit) {
      setFormData(qualificationToEdit);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [qualificationToEdit]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({ ...prev, [id]: value }));
  };

  const handleCheckboxChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      catcod: e.target.checked ? "1" : "0",
    }));
  };

  const handleReset = () => {
    setFormData(emptyForm);
    onEditComplete?.();
  };

  const handleSubmit = () => {
    if (!formData.quacod || !formData.qualib) {
      setSnackbar({
        open: true,
        message: "Le code et le libellé sont obligatoires.",
        severity: "error",
      });
      return;
    }

    const onSuccess = () => {
      setSnackbar({
        open: true,
        message: isEditMode
          ? "Qualification modifiée avec succès !"
          : "Qualification enregistrée avec succès !",
        severity: "success",
      });
      handleReset();
    };

    const onError = () => {
      setSnackbar({
        open: true,
        message: isEditMode
          ? "Erreur lors de la modification."
          : "Erreur lors de l'enregistrement.",
        severity: "error",
      });
    };

    if (isEditMode) {
      updateQualification(formData, { onSuccess, onError });
    } else {
      addQualification(formData, { onSuccess, onError });
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
      <Grid container spacing={2}>
        <Grid item xs={4} md={4}>
          <TextField
            fullWidth
            size="small"
            label="Code"
            id="quacod"
            value={formData.quacod}
            onChange={handleChange}
            disabled={isEditMode}
            required
          />
        </Grid>

        <Grid item xs={4} md={6}>
          <TextField
            fullWidth
            size="small"
            label="Libellé"
            id="qualib"
            value={formData.qualib}
            onChange={handleChange}
            required
          />
        </Grid>

        <Grid item xs={4} md={4}>
          <FormControlLabel
            control={
              <Checkbox
                checked={formData.catcod == "1" || formData.catcod == 1}
                onChange={handleCheckboxChange}
              />
            }
            label="Exonéré de la retenue à la source"
          />
        </Grid>
      </Grid>

      <Box mt={3} display="flex" gap={1.5} flexWrap="wrap">
        <Button
          variant="contained"
          startIcon={<Save />}
          onClick={handleSubmit}
          disabled={isLoading}
          size="small"
        >
          {isLoading
            ? "Enregistrement..."
            : isEditMode
            ? "Modifier"
            : "Enregistrer"}
        </Button>

        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={handleReset}
          disabled={isLoading}
          size="small"
        >
          Nouveau
        </Button>

        {isEditMode && (
          <Button
            variant="outlined"
            color="error"
            startIcon={<Cancel />}
            onClick={handleReset}
            size="small"
          >
            Annuler
          </Button>
        )}
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() =>
          setSnackbar((s) => ({ ...s, open: false }))
        }
      >
        <Alert
          severity={snackbar.severity}
          onClose={() =>
            setSnackbar((s) => ({ ...s, open: false }))
          }
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Paper>
  );
}