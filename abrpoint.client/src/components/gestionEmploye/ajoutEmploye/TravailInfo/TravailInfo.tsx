import {Box, FormControl, FormControlLabel,Grid,InputLabel, MenuItem, Radio, RadioGroup, Select, Typography } from "@mui/material";
import apiInstance from "../../../API/apiInstance";
import { useEffect, useState } from "react";
import SelectInputComponent from "../../../SelectInputComponent/SelectInputComponent";
import InputComponent from "../../../Inputs/Input";
import CheckboxComponent from "../../../CheckboxComponent/CheckboxComponent";
import { useAuth } from "../../../helper/AuthProvider";
import { useTranslation } from 'react-i18next';
import useGetSiteLibs from "../../../../hooks/siteHooks/useGetSiteLibs";

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
  const { soccod } = useAuth();
  const { t } = useTranslation();
  const { data: filiales = {} } = useGetSiteLibs();
  const [services,setServices] = useState<Record<string,string>>({});
  const [directions,setDirections] = useState<Record<string,string>>({});
  const [horaires,setHoraires] = useState<Record<string,string>>({});
  const [calendrier,setCalendrier] = useState<any[]>([]);

  const handleCheckboxChange = (e:any) => {
    const { name, checked } = e.target;
    handleChange({ target: { name, value: checked ? '1' : '0' } });
  };
  useEffect(()=>{
    apiInstance
    .get(`/Services/get-servlibs/${soccod}`)
    .then((res) => setServices(res.data))
    .catch((err) => console.error("Error fetching services", err));
    apiInstance
    .get(`/Directions/get-dirlibs/${soccod}`)
    .then((res) => setDirections(res.data))
    .catch((err) => console.error("Error fetching directions", err));
    apiInstance
    .get(`/Lcategories/get-horlibs/${soccod}`)
    .then((res) => setHoraires(res.data))
    .catch((err) => console.error("Error fetching horaires", err));
    apiInstance
    .get(`/Calendriers`)
    .then((res) => setCalendrier(res.data))
    .catch((err) => console.error("Error fetching calendriers", err));

  },[soccod])
  
  return (
    <Box>
      <Grid container spacing={2}>
        <Grid item xs={2}>
        <FormControl variant="standard" fullWidth>
        <InputLabel  shrink id="employe-label">{t('employe.work.regime') || 'Régime'}</InputLabel>
          <Select
            fullWidth
            size="small"
            label={t('employe.work.regime') || 'Régime'}
            name="empreg"
            value={formData.empreg}
            onChange={handleChange}
            required
          >
            <MenuItem value="H">{t('employe.work.hourly') || 'Horaire'}</MenuItem>
            <MenuItem value="M">{t('employe.work.monthly') || 'Mensuelle'}</MenuItem>
          </Select>
          </FormControl>
        </Grid>
        <Grid item xs={2}>
        <FormControl variant="standard" fullWidth>
        <InputLabel  shrink id="employe-label">{t('employe.work.branch') || 'Site'}</InputLabel>
        <Select
              fullWidth
              size="small"
              label={t('employe.work.branch') || 'Site'}
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
        <Grid item xs={2}>
          <SelectInputComponent label={t('employe.work.service') || 'Service'} value={formData.sercod} setValue={(value)=>handleChange({target:{ name: 'sercod', value }})} maplist={services} />
        </Grid>
        <Grid item xs={2}>
          <SelectInputComponent label={t('employe.work.direction') || 'Direction'} value={formData.dircod} setValue={(value)=>handleChange({target:{ name: 'dircod', value }})} maplist={directions} />
        </Grid>
       
        <Grid item xs={2}>
          <SelectInputComponent label={t('employe.work.timeClass') || 'Classe Horaire'} value={formData.catcod} setValue={(value)=> handleChange({target:{name:'catcod',value}})} maplist={horaires} />
        </Grid>
        <Grid item xs={2} >
            <FormControl variant="standard" fullWidth>
                      <InputLabel shrink  id="employe-label">{t('employe.work.calendarType') || 'Type Calendrier'}</InputLabel>
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
        <Grid item xs={1}>
          <InputComponent type='number' label={t('employe.work.maxDaysPerMonth') || 'Jour Max/Mois'} value={formData.empmaxjour} setValue={(value:string)=>handleChange({target:{ name: 'empmaxjour', value }})} />
        </Grid>
        <Grid item xs={2}>
          <InputComponent type='number' label={t('employe.work.maxHoursPerDay') || 'Max Heure/Jour'} value={formData.empmaxhre} setValue={(value:string)=>handleChange({target:{ name: 'empmaxhre', value }})} />
        </Grid>
        <Grid item xs={1}>
          <InputComponent type='number' label={t('employe.work.minHoursPerDay') || 'Min Heure/Jour'} value={formData.empminhjour} setValue={(value)=>handleChange({target:{ name: 'empminhjour', value }})} />
        </Grid>
        <Grid item xs={1} mt={3}>
          <CheckboxComponent label={t('employe.work.eliminateDelay') || 'Eliminer Retard'}   value={formData.empretard === '1'}    setValue={(checked) => handleCheckboxChange({ target: { name: 'empretard', checked } })} />
        </Grid>
                <Grid container item xs={2} alignItems="end">
          <Grid item>
            <InputLabel shrink>{t('employe.work.charge') || 'Charge:'}</InputLabel>
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
              label={<Typography fontSize="small">{t('employe.work.direct') || 'Directe'}</Typography>}
            />
            <FormControlLabel
              value="2"
              control={<Radio size="small" />}
              label={<Typography fontSize="small">{t('employe.work.indirect') || 'Indirecte'}</Typography>}
            />
          </RadioGroup>
        </Grid>
        </Grid>
      </Grid>
    </Box>
  );
};

export default TravailInfo;

