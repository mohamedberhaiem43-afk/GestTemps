import { InputLabel, Input, TextField, Box, Typography } from "@mui/material";
import dayjs from "dayjs";
import "dayjs/locale/fr";

interface InputComponentProps {
  type: string;
  label: string;
  value: any;
  setValue?: (value: any) => void;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  name?: string;
  readOnly?: boolean;
  required?: boolean;
  /** Longueur max. côté saisie — à aligner sur la colonne SQL pour éviter les 400 de validation. */
  maxLength?: number;
}

export default function InputComponent({
  type,
  label,
  value,
  setValue,
  onChange,
  name,
  readOnly = false,
  required = false,
  maxLength,
}: InputComponentProps): JSX.Element {
  // 2026-05-27 — Refonte du rendu type="date" :
  //   AVANT : MUI X DatePicker avec dropdown année + locale fr. UX moins
  //   cohérente avec le reste de l'app (notamment SaisieContratModern qui
  //   utilise un <input type="date"> natif). Le label « shrink » au-dessus +
  //   le standalone TextField faisait ressembler les champs DOB à des
  //   formulaires legacy, là où la grille contrat avait un look moderne
  //   pill-shaped gris-clair.
  //   APRÈS : on s'aligne sur la grille contrat — <TextField type="date">
  //   avec fond gris clair (#f2f4f6) + radius 8px + label uppercase compact
  //   au-dessus. Plus de dépendance directe à @mui/x-date-pickers ici (les
  //   appelants qui veulent encore un DatePicker complet peuvent l'importer
  //   directement). Sortie iso "YYYY-MM-DD" identique → 0 breaking change
  //   pour les consommateurs (handleChange déjà câblé sur cet ISO).
  if (type === "date") {
    // Normalisation valeur : accepte string ISO, Date, Dayjs ou null. Le
    // <input type="date"> exige strict "YYYY-MM-DD" sinon il reste vide.
    let isoValue = "";
    if (value) {
      const d = typeof value === "string" ? dayjs(value) : dayjs(value);
      if (d.isValid()) isoValue = d.format("YYYY-MM-DD");
    }

    return (
      <Box sx={{ width: "100%" }}>
        <Typography
          sx={{
            fontSize: "10px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "#515f74",
            mb: 0.5,
          }}
        >
          {label}{required ? " *" : ""}
        </Typography>
        <TextField
          type="date"
          size="small"
          fullWidth
          required={required}
          name={name}
          value={isoValue}
          onChange={(e) => {
            const next = e.target.value; // déjà ISO YYYY-MM-DD côté natif
            if (onChange) onChange(e as React.ChangeEvent<HTMLInputElement>);
            else if (setValue) setValue(next);
          }}
          InputProps={{ readOnly }}
          sx={{
            backgroundColor: "#f2f4f6",
            borderRadius: "8px",
            "& .MuiOutlinedInput-notchedOutline": { border: "none" },
            "&:hover": { backgroundColor: "#ffffff" },
            "& .Mui-focused": { backgroundColor: "#ffffff" },
          }}
        />
      </Box>
    );
  }

  return (
    <>
      <InputLabel shrink>{label}</InputLabel>
      <Input
        required={required}
        size="small"
        type={type}
        name={name}
        value={value}
        onChange={(e:any) => {
          if (onChange) onChange(e);
          else if (setValue) setValue(e.target.value);
        }}
        fullWidth
        readOnly={readOnly}
        inputProps={maxLength != null ? { maxLength } : undefined}
      />
    </>
  );
}
