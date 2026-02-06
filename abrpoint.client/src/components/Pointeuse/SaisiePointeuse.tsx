import { useEffect, useState } from "react";
import { useTranslation } from 'react-i18next';
import { Box, Grid, InputLabel, Input, IconButton, FormControl, Select, MenuItem, SelectChangeEvent } from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import { Pointeuse } from "../../models/PointeuseModel";
import axios from "axios";

interface Props {
  selected: Pointeuse | null;
}

export default function SaisiePointeuse({ selected }: Props) {
  const [ncom] = useState('D');
  const [pointeuse, setPointeuse] = useState<Pointeuse>({
    poicod: '',
    soccod: sessionStorage.getItem('soccod')||'',
    poilib: '',
    poiadrip1: undefined,
    poiadrip2: undefined,
    poiadrip3: undefined,
    poiadrip4: undefined,
    poiport: undefined,
    poietat: '',
    poicom: ncom
  });

  useEffect(() => {
    if (selected) {
      setPointeuse(selected); // optionnel : remplir le formulaire avec les valeurs sélectionnées
    }
  }, [selected]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    // Add the API call here to submit the form data
    axios.post(`${import.meta.env.VITE_REACT_APP_API_URL}/Pointeuse`, pointeuse, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
        'Content-Type': 'application/json',
      }
    })
      .then(() => {
        
        setPointeuse({
          poicod: '',
          soccod: sessionStorage.getItem('soccod') || "",
          poilib: '',
          poiadrip1: undefined,
          poiadrip2: undefined,
          poiadrip3: undefined,
          poiadrip4: undefined,
          poiport: undefined,
          poietat: '',
          poicom: undefined
        });
      })
      .catch((error) => {
        console.error("Error adding pointeuse:", error);
      });
  }
const handleSelectChange = (e: SelectChangeEvent) => {
  const { name, value } = e.target;
  setPointeuse((prev) => ({
    ...prev,
    [name]: value,
  }));
};

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPointeuse((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const { t } = useTranslation();

  return (
    <>
      <Box component="form" onSubmit={handleSubmit}>
        <Grid container spacing={2}>

          <Grid item xs={1} sm={1.5}>
            <InputLabel shrink>{t('common.code')}</InputLabel>
            <Input
              name="poicod"
              size="small"
              fullWidth
              value={pointeuse.poicod}
              onChange={handleChange}
              required
            />
          </Grid>


          {/* Libellé (poilib) */}
          <Grid item xs={2} sm={1}>
            <InputLabel shrink>{t('common.label')}</InputLabel>
            <Input
              name="poilib"
              size="small"
              fullWidth
              value={pointeuse.poilib || ''}
              onChange={handleChange}
            />
          </Grid>

          {/* Adresse IP (poiadrip1, poiadrip2, poiadrip3, poiadrip4) */}
          <Grid item xs={1}>
            <InputLabel shrink>Partie 1</InputLabel>
            <Input
              name="poiadrip1"
              type="number"
              size="small"
              fullWidth
              value={pointeuse.poiadrip1 || ''}
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={1}>
            <InputLabel shrink>Partie 2</InputLabel>
            <Input
              name="poiadrip2"
              type="number"
              size="small"
              fullWidth
              value={pointeuse.poiadrip2 || ''}
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={1}>
            <InputLabel shrink> Partie 3</InputLabel>
            <Input
              name="poiadrip3"
              type="number"
              size="small"
              fullWidth
              value={pointeuse.poiadrip3 || ''}
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={1}>
            <InputLabel shrink> Partie 4</InputLabel>
            <Input
              name="poiadrip4"
              type="number"
              size="small"
              fullWidth
              value={pointeuse.poiadrip4 || ''}
              onChange={handleChange}
            />
          </Grid>

          {/* Port (poiport) */}
          <Grid item xs={1} sm={1}>
            <InputLabel shrink>N° Port</InputLabel>
            <Input
              name="poiport"
              type="number"
              size="small"
              fullWidth
              value={pointeuse.poiport || ''}
              onChange={handleChange}
            />
          </Grid>

          {/* Communication Status (poicom) */}
          <Grid item xs={1.5} sm={1} mt={0.5}>
            <FormControl variant="standard" fullWidth>
            <InputLabel shrink>N° Com</InputLabel>
            <Select
              name="poicom"
              fullWidth
              value={pointeuse.poicom || ''}
              onChange={handleSelectChange}
            >
                <MenuItem value="D">ZKTeco</MenuItem>
                <MenuItem value="H">Hikvision</MenuItem>
            </Select>
            </FormControl>
          </Grid>

          {/* Submit Button */}
          <Grid item xs={12}>
            <IconButton color="primary" aria-label="save" type="submit">
              <SaveIcon />
            </IconButton>
          </Grid>
        </Grid>
      </Box>
    </>
  );
}
