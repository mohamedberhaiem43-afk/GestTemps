import {Box, FormControl, FormControlLabel,Grid,InputLabel, MenuItem, Radio, RadioGroup, Select, Typography } from "@mui/material";
import axios from "axios";
import { useEffect, useState } from "react";
import SelectInputComponent from "../../../SelectInputComponent/SelectInputComponent";
import InputComponent from "../../../Inputs/Input";
import CheckboxComponent from "../../../CheckboxComponent/CheckboxComponent";
import { useAuth } from "../../../helper/AuthProvider";

const TravailInfo = ({
  formData,
  handleChange,
}: {
  formData: { [key: string]: any };
  handleChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | 
       { target: { name: string; value: any } }
  ) => void;
}) => {
  const token = localStorage.getItem("authToken");
  const uticod = localStorage.getItem("Uticod");
  const { soccod } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };
  const [filiales,setFiliales] = useState([]);
  const [services,setServices] = useState([]);
  const [directions,setDirections] = useState([]);
  const [horaires,setHoraires] = useState([]);
  const [calendrier,setCalendrier] = useState([]);

  const handleCheckboxChange = (e:any) => {
    const { name, checked } = e.target;
    handleChange({ target: { name, value: checked ? '1' : '0' } });
  };
  useEffect(()=>{
    axios
    .get(`${import.meta.env.VITE_REACT_APP_API_URL}/Sites/get-sitlibs/${soccod}/${uticod}`, { headers })
    .then((res) =>setFiliales(res.data))
    .catch((err) => console.error("Error adding sanction", err));
    axios
    .get(`${import.meta.env.VITE_REACT_APP_API_URL}/Services/get-servlibs/${soccod}`, { headers })
    .then((res) =>setServices(res.data))
    .catch((err) => console.error("Error adding sanction", err));
    axios
    .get(`${import.meta.env.VITE_REACT_APP_API_URL}/Directions/get-dirlibs/${soccod}`, { headers })
    .then((res) =>setDirections(res.data))
    .catch((err) => console.error("Error adding sanction", err));
    axios
    .get(`${import.meta.env.VITE_REACT_APP_API_URL}/Lcategories/get-horlibs/${soccod}`, { headers })
    .then((res) =>setHoraires(res.data))
    .catch((err) => console.error("Error adding sanction", err));
    axios
    .get(`${import.meta.env.VITE_REACT_APP_API_URL}/Calendriers`, { headers })
    .then((res) =>setCalendrier(res.data))
    .catch((err) => console.error("Error adding sanction", err));

  },[])
  
  return (
    <Box>
      <Grid container spacing={2}>
        <Grid item xs={2}>
        <FormControl variant="standard" fullWidth>
        <InputLabel  shrink id="employe-label">Régime</InputLabel>
          <Select
            fullWidth
            size="small"
            label="Régime"
            name="empreg"
            value={formData.empreg}
            onChange={handleChange}
            required
          >
            <MenuItem value="H">Horaire</MenuItem>
            <MenuItem value="M">Mensuelle</MenuItem>
          </Select>
          </FormControl>
        </Grid>
        <Grid item xs={2}>
        <FormControl variant="standard" fullWidth>
        <InputLabel  shrink id="employe-label">Filiale</InputLabel>
        <Select
              fullWidth
              size="small"
              label="Filiale"
              name="sitcod"
              value={formData.sitcod}
              onChange={handleChange}
              required
            >
              {Object.entries(filiales).map(([sitcod, sitlib]) => (
                <MenuItem key={sitcod} value={sitcod}>
                  {sitlib }
                </MenuItem>
              ))}
            </Select>
              </FormControl>
        </Grid>
        <Grid container item xs={2} alignItems="end">
          <Grid item>
            <InputLabel shrink>Charge:</InputLabel>
          </Grid>
        <Grid item>
          <RadioGroup
            row
            aria-label="chargeType"
            name="emptype"
            value={formData.emptype}
            onChange={handleChange}
          >
            <FormControlLabel
              value="1"
              control={<Radio size="small" />}
              label={<Typography fontSize="small">Directe</Typography>}
            />
            <FormControlLabel
              value="2"
              control={<Radio size="small" />}
              label={<Typography fontSize="small">Indirecte</Typography>}
            />
          </RadioGroup>
        </Grid>
        </Grid>

        <Grid item xs={2}>
          <SelectInputComponent label='Service' value={formData.sercod} setValue={(value)=>handleChange({target:{ name: 'sercod', value }})} maplist={services} />
        </Grid>
        <Grid item xs={2}>
          <SelectInputComponent label='Direction' value={formData.dircod} setValue={(value)=>handleChange({target:{ name: 'dircod', value }})} maplist={directions} />
        </Grid>
       
        <Grid item xs={2}>
          <SelectInputComponent label='Classe Horaire' value={formData.catcod} setValue={(value)=> handleChange({target:{name:'catcod',value}})} maplist={horaires} />
        </Grid>
        <Grid item xs={1}>
          <InputComponent type='number' label='Jour Max/Mois' value={formData.empmaxjour} setValue={(value:string)=>handleChange({target:{ name: 'empmaxjour', value }})} />
        </Grid>
        <Grid item xs={2}>
          <InputComponent type='number' label='Max Heure/Jour' value={formData.empmaxhre} setValue={(value:string)=>handleChange({target:{ name: 'empmaxhre', value }})} />
        </Grid>
        <Grid item xs={2} mt={1}>
        <FormControl variant="standard" fullWidth>
                  <InputLabel shrink  id="employe-label">Type Calendrier</InputLabel>
                  <Select
                    size="small"
                    value={formData.caltype}
                    name="caltype"
                    onChange={handleChange}
                  >
                      {calendrier.map(({ caltype, callib }) => (
                        <MenuItem key={caltype} value={caltype} sx={{ fontSize: '0.85rem' }}>
                          {callib}
                        </MenuItem>
                      ))}
                  </Select>
                  </FormControl>
        </Grid>
        <Grid item xs={1.5} mt={3}>
          <CheckboxComponent label='Eliminer Retard'   value={formData.empretard === '1'}    setValue={(checked) => handleCheckboxChange({ target: { name: 'empretard', checked } })} />
        </Grid>
        <Grid item xs={1}>
          <InputComponent type='number' label='Min Heure/Jour' value={formData.minheurejour} setValue={(value)=>handleChange({target:{ name: 'minheurejour', value }})} />
        </Grid>
      </Grid>
    </Box>
  );
};

export default TravailInfo;

