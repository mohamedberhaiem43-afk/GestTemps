import { Button, Alert, Stack, CircularProgress, TextField } from "@mui/material";
import { useTranslation } from 'react-i18next';
import { useAuth } from "../../helper/AuthProvider";
import useOptimisePresence from "../../../hooks/presenceHooks/useOptimizePresence";
import { useEffect, useState } from "react";

interface Props {
  empcod: string;
  date: string; // date sélectionnée
  onSuccess?: () => void;
}

const OptimisationPointage = ({ empcod, date, onSuccess }: Props) => {
  const { soccod } = useAuth();
  const { mutate, isLoading } = useOptimisePresence();
  const { t } = useTranslation();

  const [dateDeb, setDateDeb] = useState<string>(date);
  const [dateFin, setDateFin] = useState<string>(date);

  // Si l’utilisateur change de ligne → reset par défaut
  useEffect(() => {
    setDateDeb(date);
    setDateFin(date);
  }, [date]);

  const handleOptimize = () => {
    if (!soccod || !empcod || !dateDeb || !dateFin) return;

    mutate(
      {
        soccod,
        empMat: empcod,
        dateDeb,
        dateFin,
      },
      {
        onSuccess: () => {
          onSuccess?.();
        },
        onError: (error: any) => {
          console.error("Erreur optimisation :", error);
        },
      }
    );
  };

  return (
    <Stack spacing={2} sx={{ mt: 2 }}>
      <Alert severity="info">
        {t('optimisation.info')}
      </Alert>

      {/* Date début */}
      <TextField
        label={t('optimisation.dateStart')}
        type="date"
        size="small"
        value={dateDeb?.substring(0, 10)}
        onChange={(e) => setDateDeb(e.target.value)}
        InputLabelProps={{ shrink: true }}
      />

      {/* Date fin */}
      <TextField
        label={t('optimisation.dateEnd')}
        type="date"
        size="small"
        value={dateFin?.substring(0, 10)}
        onChange={(e) => setDateFin(e.target.value)}
        InputLabelProps={{ shrink: true }}
      />

      <Button
        variant="contained"
        color="warning"
        onClick={handleOptimize}
        disabled={isLoading}
        startIcon={isLoading ? <CircularProgress size={18} /> : null}
      >
        {isLoading ? t('optimisation.optimizing') : t('optimisation.optimizeButton')}
      </Button>
    </Stack>
  );
};

export default OptimisationPointage;
