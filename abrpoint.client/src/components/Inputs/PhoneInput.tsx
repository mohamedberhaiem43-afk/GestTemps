import { useMemo } from "react";
import { Box, InputLabel, MenuItem, Select, Input, Stack } from "@mui/material";

/**
 * Champ téléphone avec sélecteur d'indicatif pays. La valeur émise/lue est une
 * **chaîne unique** (ex. « +33 612345678 ») afin de rester compatible avec les
 * colonnes existantes (societe.soctel/socfax = varchar(20), employe.emptel) sans
 * migration de schéma.
 *
 * - Lecture : on tente de reconnaître un indicatif « +XX » en tête de la valeur ;
 *   sinon on retombe sur le pays par défaut (France) et tout le texte devient le
 *   numéro national.
 * - Écriture : on émet `${indicatif} ${numéro}` (numéro vide → chaîne vide, pour
 *   ne pas enregistrer un indicatif seul).
 */

interface Country {
  /** Indicatif international, ex. « +33 ». */
  dial: string;
  /** Drapeau emoji. */
  flag: string;
  /** Nom court affiché dans la liste. */
  name: string;
}

// Liste ordonnée : France en tête (défaut), puis pays fréquents pour un SaaS FR.
// Plusieurs pays partagent « +1 » — on ne garde qu'une entrée par indicatif pour
// la reconnaissance (le drapeau n'est qu'indicatif visuel).
export const PHONE_COUNTRIES: Country[] = [
  { dial: "+33", flag: "🇫🇷", name: "France" },
  { dial: "+32", flag: "🇧🇪", name: "Belgique" },
  { dial: "+41", flag: "🇨🇭", name: "Suisse" },
  { dial: "+352", flag: "🇱🇺", name: "Luxembourg" },
  { dial: "+49", flag: "🇩🇪", name: "Allemagne" },
  { dial: "+34", flag: "🇪🇸", name: "Espagne" },
  { dial: "+39", flag: "🇮🇹", name: "Italie" },
  { dial: "+351", flag: "🇵🇹", name: "Portugal" },
  { dial: "+44", flag: "🇬🇧", name: "Royaume-Uni" },
  { dial: "+31", flag: "🇳🇱", name: "Pays-Bas" },
  { dial: "+212", flag: "🇲🇦", name: "Maroc" },
  { dial: "+213", flag: "🇩🇿", name: "Algérie" },
  { dial: "+216", flag: "🇹🇳", name: "Tunisie" },
  { dial: "+221", flag: "🇸🇳", name: "Sénégal" },
  { dial: "+225", flag: "🇨🇮", name: "Côte d'Ivoire" },
  { dial: "+1", flag: "🇨🇦", name: "Canada / USA" },
];

export const DEFAULT_DIAL = "+33";

// Map pays souscrit (countryCode ISO-3166 alpha-2 renvoyé par /Utilisateurs/me) → indicatif.
// Permet de pré-remplir le « + indicatif » selon le pays du tenant (gestion société, fiche
// employé…) sans saisie manuelle. Pays non listé → DEFAULT_DIAL.
export const COUNTRY_TO_DIAL: Record<string, string> = {
  FR: "+33", BE: "+32", CH: "+41", LU: "+352", DE: "+49", ES: "+34",
  IT: "+39", PT: "+351", GB: "+44", NL: "+31", MA: "+212", DZ: "+213",
  TN: "+216", SN: "+221", CI: "+225", CA: "+1", US: "+1",
};

/** Indicatif (« +33 ») correspondant à un countryCode, ou DEFAULT_DIAL si inconnu/absent. */
export function dialForCountry(countryCode?: string | null): string {
  if (!countryCode) return DEFAULT_DIAL;
  return COUNTRY_TO_DIAL[countryCode.trim().toUpperCase()] ?? DEFAULT_DIAL;
}

// Indicatifs triés du plus long au plus court pour éviter qu'un préfixe court
// (« +1 ») ne masque un indicatif long (« +1… » vs « +33 »).
const DIALS_BY_LENGTH = [...PHONE_COUNTRIES]
  .map((c) => c.dial)
  .sort((a, b) => b.length - a.length);

/** Assemble indicatif + numéro en une valeur stockable (vide si pas de numéro). */
export function formatPhone(dial: string, rawNumber: string): string {
  const cleanNumber = (rawNumber ?? "").replace(/[^\d\s.-]/g, "").trim();
  return cleanNumber ? `${dial} ${cleanNumber}` : "";
}

/**
 * Sépare une valeur stockée en { dial, number }. `defaultDial` est l'indicatif retenu quand
 * la valeur n'en contient pas (ex. dialForCountry(countryCode) pour suivre le pays du tenant).
 */
export function parsePhone(raw: string, defaultDial: string = DEFAULT_DIAL): { dial: string; number: string } {
  const value = (raw ?? "").trim();
  if (value.startsWith("+")) {
    const compact = value.replace(/\s+/g, "");
    const match = DIALS_BY_LENGTH.find((d) => compact.startsWith(d));
    if (match) {
      return { dial: match, number: compact.slice(match.length) };
    }
    // « + » présent mais indicatif non listé : on garde le défaut et tout le reste.
    return { dial: defaultDial, number: value };
  }
  // Numéro local existant sans indicatif → numéro national, indicatif par défaut (pays tenant).
  return { dial: defaultDial, number: value };
}

interface PhoneInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  required?: boolean;
  /** Indicatif présélectionné quand la valeur n'en a pas. Typiquement dialForCountry(countryCode). */
  defaultDial?: string;
}

export default function PhoneInput({
  label,
  value,
  onChange,
  readOnly = false,
  required = false,
  defaultDial = DEFAULT_DIAL,
}: PhoneInputProps): JSX.Element {
  const { dial, number } = useMemo(() => parsePhone(value || "", defaultDial), [value, defaultDial]);

  const emit = (nextDial: string, nextNumber: string) => {
    // Numéro vide → on n'enregistre pas un indicatif orphelin.
    onChange(formatPhone(nextDial, nextNumber));
  };

  return (
    <Box sx={{ width: "100%" }}>
      <InputLabel shrink>{label}{required ? " *" : ""}</InputLabel>
      <Stack direction="row" spacing={1} alignItems="flex-end">
        <Select
          value={dial}
          variant="standard"
          disabled={readOnly}
          onChange={(e) => emit(e.target.value, number)}
          sx={{ minWidth: 92 }}
          renderValue={(d) => {
            const c = PHONE_COUNTRIES.find((x) => x.dial === d);
            return <span>{c ? `${c.flag} ${c.dial}` : d}</span>;
          }}
        >
          {PHONE_COUNTRIES.map((c) => (
            <MenuItem key={`${c.dial}-${c.name}`} value={c.dial}>
              {c.flag}&nbsp;{c.name}&nbsp;({c.dial})
            </MenuItem>
          ))}
        </Select>
        <Input
          type="tel"
          size="small"
          fullWidth
          required={required}
          readOnly={readOnly}
          value={number}
          onChange={(e) => emit(dial, e.target.value)}
        />
      </Stack>
    </Box>
  );
}
