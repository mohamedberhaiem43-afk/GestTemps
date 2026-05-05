import { InputLabel, Input } from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs, { Dayjs } from "dayjs";
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
}

export default function InputComponent({
  type,
  label,
  value,
  setValue,
  onChange,
  name,
  readOnly = false,
  required = false
}: InputComponentProps): JSX.Element {
  // Pour le type "date", on remplace l'input HTML natif (qui n'offre pas de
  // dropdown année et est lent à dérouler) par MUI X DatePicker. Le picker
  // affiche une vue année navigable + saisie manuelle au format DD/MM/YYYY.
  // L'API en sortie reste identique (string ISO YYYY-MM-DD) pour ne pas
  // casser les 15 composants qui consomment InputComponent.
  if (type === "date") {
    const parsed: Dayjs | null = value
      ? (typeof value === "string" ? dayjs(value) : dayjs(value))
      : null;
    const valid = parsed && parsed.isValid() ? parsed : null;

    const emitChange = (next: Dayjs | null) => {
      const iso = next && next.isValid() ? next.format("YYYY-MM-DD") : "";
      if (onChange) {
        // Émule l'event d'un input natif pour les callers qui s'attendent à ChangeEvent.
        onChange({ target: { name, value: iso } } as unknown as React.ChangeEvent<HTMLInputElement>);
      } else if (setValue) {
        setValue(iso);
      }
    };

    return (
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="fr">
        <InputLabel shrink>{label}</InputLabel>
        <DatePicker
          value={valid}
          onChange={emitChange}
          format="DD/MM/YYYY"
          // Active la vue année (dropdown des années) en plus de mois/jour.
          views={["year", "month", "day"]}
          openTo="day"
          // Plage très large : 50 ans en arrière, 5 ans en avant. Couvre le
          // recrutement (ancienneté) et la planification de contrats CDD.
          minDate={dayjs().subtract(50, "year")}
          maxDate={dayjs().add(5, "year")}
          disabled={readOnly}
          slotProps={{
            textField: {
              size: "small",
              variant: "standard",
              required,
              fullWidth: true,
              name,
              InputProps: { readOnly },
            },
            // Header du picker mois+année cliquables (passe en vue année d'un clic).
            calendarHeader: { format: "MMMM YYYY" },
          }}
        />
      </LocalizationProvider>
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
      />
    </>
  );
}
