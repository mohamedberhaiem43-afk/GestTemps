import { useState, useEffect } from "react";
import { Grid, FormControl, MenuItem, Select, InputLabel, Input } from "@mui/material";
import SelectInputComponent from "../../../SelectInputComponent/SelectInputComponent";
import InputComponent from "../../../Inputs/Input";
import RadioGroupComponent, { FormControlLabelComponent } from "../../../RadioGroupComponent/RadioGroupComponent";
import CheckboxComponent from "../../../CheckboxComponent/CheckboxComponent";
import useGetQualificationsLibs from "../../../../hooks/QualificationHooks/useGetQualificationsLibs";
import useGetFonctionsLibs from "../../../../hooks/fonctionHooks/useGetFonctionsLibs";
import useGetSectionsLibs from "../../../../hooks/sectionHooks/useGetSectionsLibs";
import Employe from "../../../../models/Employe";
import { useTranslation } from 'react-i18next';
import apiInstance from "../../../API/apiInstance";
import { useAuth } from "../../../helper/AuthProvider";
interface EmployeDetailsProps {
  onChange: (data: any) => void;
  empData:Employe
}
export default function shrinkEmployeInfo({ onChange,empData }:EmployeDetailsProps) {

    const [formData, setFormData] = useState<Employe>(empData);
    useEffect(() => {
        setFormData(empData);
    }, [empData]);

    
        const handleChange = (e:any) => {
        const { name, value } = e.target;
        if (name === "foncod") {
            // Find the selected fonction's label (fonlib) and set both foncod and empfonc
            // const selectedFonction = fonctions[value]; // Since it's a map, access directly using value
            setFormData(prevState => ({
                ...prevState,
                foncod: value,
                // empfonc: selectedFonction || '' // Set empfonc to fonlib, if found
            }));
        } else {
            setFormData(prevState => ({
                ...prevState,
                [name]: value
            }));
        }
    };
    
    const { t } = useTranslation();
    const { soccod } = useAuth();
    const {data:sections = []} = useGetSectionsLibs()
    const {data:qualifications = []} = useGetQualificationsLibs()
    const {data:fonctions = []} = useGetFonctionsLibs()
    const [calendrier, setCalendrier] = useState<any[]>([]);

    useEffect(() => {
        apiInstance
            .get(`/Calendriers`)
            .then((res) => setCalendrier(res.data))
            .catch((err) => console.error("Error fetching calendriers", err));
    }, [soccod]);

    useEffect(() => {
        onChange(formData);
    }, [formData, onChange]);

    return (
        <Grid container spacing={2}>
            <Grid item xs={2} mt={1}>
                <RadioGroupComponent value={formData.empniv} setValue={(value)=> handleChange({target:{name:'empniv',value}})}>
                    <FormControlLabelComponent radioValue='2' label={t('employeeLevel.cadre')} />
                    <FormControlLabelComponent radioValue='1' label={t('employeeLevel.maitrise')} />
                    <FormControlLabelComponent radioValue='0' label={t('employeeLevel.executant')} />
                </RadioGroupComponent>
            </Grid>
            <Grid item xs={2}>
            <FormControl variant="standard" fullWidth>
                {/* <SelectInputComponent label='Hre Nuit' value={undefined} setValue={undefined} maplist={undefined} /> */}
            <InputLabel shrink id="employe-label">{t('employe.fields.nightHours') || 'Night hours'}</InputLabel>
                <Select
                    fullWidth
                    size="small"
                    name="empnuit"
                    value={formData.empnuit}
                    onChange={handleChange}
                    
                >
                    <MenuItem value="0">{t('employe.options.nightHours.0') || '0-Normal'}</MenuItem>
                    <MenuItem value="1">{t('employe.options.nightHours.1') || '1-Special'}</MenuItem>
                </Select>
                </FormControl>
            </Grid>
            <Grid item xs={1.5}>
            <FormControl variant="standard" fullWidth>
            <InputLabel shrink id="employe-label">{t('employe.fields.lunch') || 'Lunch'}</InputLabel>
                <Select
                    fullWidth
                    size="small"
                    name="emppanier"
                    value={formData.emppanier}
                    onChange={handleChange}
                    
                >
                    <MenuItem value="0">{t('employe.options.panier.0') || '0- No lunch'}</MenuItem>
                    <MenuItem value="1">{t('employe.options.panier.1') || '1- Lunch 7H'}</MenuItem>
                    <MenuItem value="2">{t('employe.options.panier.2') || '2- Lunch 6H'}</MenuItem>
                </Select>
                </FormControl>
            </Grid>
            <Grid item xs={1.5} mt={2}>
                <CheckboxComponent 
                label={t('employe.labels.active')}
                value={formData.actif=='A'} 
                setValue={(value)=> handleChange({target:{name:'actif',value: value ? 'A' : 'N'}})} 
                />
            </Grid> 
            <Grid item xs={2.5}>
                <SelectInputComponent label={t('common.function')} value={formData.foncod} setValue={(value)=>handleChange({target:{ name: 'foncod', value }})} maplist={fonctions} />
            </Grid>
            <Grid style={{display:'none'}} item xs={2}>
                <FormControl hiddenLabel variant="standard" fullWidth>
                    <InputLabel shrink>Fonction (Label)</InputLabel>
                    <Input
                        fullWidth
                        size="small"
                        name="empfonc"
                        value={formData.empfonc} // This is now auto-populated with fonlib
                        readOnly // Make it read-only since it's based on the selected foncod
                        hidden
                    />
                </FormControl>
            </Grid>

            <Grid item xs={2}>
                <SelectInputComponent label={t('common.qualification')} value={formData.quacod} 
                setValue={(value)=>handleChange({target:{ name: 'quacod', value }})} maplist={qualifications} />
            </Grid>
            <Grid item xs={2}>
                <SelectInputComponent label={t('common.section')} value={formData.seccod}
                setValue={(value)=>handleChange({target:{ name: 'seccod', value }})}
                maplist={sections} />
            </Grid>
            <Grid item xs={2.5}>
                <FormControl variant="standard" fullWidth>
            <InputLabel shrink id="employe-label">{t('employe.fields.position') || 'Position'}</InputLabel>
                <Select
                    fullWidth
                    size="small"
                    name="poste"
                    value={formData.poscod}
                    onChange={handleChange}
                    
                >
                    <MenuItem value="Finance">{t('employe.options.poste.finance') || 'Finance'}</MenuItem>
                    <MenuItem value="Gestionnaire">{t('employe.options.poste.manager') || 'Manager'}</MenuItem>
                </Select>
                </FormControl>
            </Grid>
            <Grid item xs={2} mt={1}>
                <FormControl variant="standard" fullWidth>
                {/* <SelectInputComponent label='Hre Nuit' value={undefined} setValue={undefined} maplist={undefined} /> */}
            <InputLabel shrink id="employe-label">{t('employe.fields.countRest') || 'Count Rest'}</InputLabel>
                <Select
                    fullWidth
                    size="small"
                    name="empferepos"
                    value={formData.empferepos}
                    onChange={handleChange}
                    
                >
                    <MenuItem value="0">{t('employe.options.countRest.0') || '0- No Count'}</MenuItem>
                    <MenuItem value="1">{t('employe.options.countRest.1') || '1- All Rest'}</MenuItem>
                    <MenuItem value="2">{t('employe.options.countRest.2') || '2- Saturday Rest'}</MenuItem>
                    <MenuItem value="3">{t('employe.options.countRest.3') || '3- Sunday Rest'}</MenuItem>
                </Select>
                </FormControl>
            </Grid>
            <Grid item xs={2}>
                  <InputComponent
                    type="date"
                    label={t('employe.documents.hireDate') || 'Hire Date'}
                    value={formData.empemb?.toString().slice(0, 10) || ''}
                    setValue={(value:any)=> handleChange ({target:{ name: 'empemb', value }})} />
            </Grid>
            <Grid item xs={2}>
                  <InputComponent
                    type="date"
                    label={t('employe.documents.exitDate') || 'Exit Date'}
                    value={formData.empsort?.toString().slice(0, 10) || ''}
                    setValue={(value:any)=> handleChange ({target:{ name: 'empsort', value }})} />
            </Grid>


            <Grid item xs={2}>
                <InputComponent type='text' label={t('employe.fields.exitReason') || 'Exit reason'} value={formData.empmotif} setValue={(value:any)=> handleChange ({target:{ name: 'empmotif', value }})} />
            </Grid>
            <Grid item xs={2}>
                  <InputComponent
                    type="date"
                    label={t('employe.fields.retirementDate') || 'Retirement date'}
                    value={formData.empretraite?.toString().slice(0, 10) || ''}
                    setValue={(value:any)=> handleChange ({target:{ name: 'empretraite', value }})} />
            </Grid>
            <Grid item xs={1}>
                <InputComponent type='number' label={t('employe.fields.nbPosts') || 'Nb. Positions'} value={formData.empnbp} setValue={(value:any)=> handleChange ({target:{ name: 'empnbp', value }})} />
            </Grid>
            <Grid item xs={2}>
                <FormControl variant="standard" fullWidth>
                    <InputLabel shrink id="caltype-label">{t('employe.work.calendarType') || 'Type Calendrier'}</InputLabel>
                    <Select
                        size="small"
                        name="caltype"
                        value={formData.caltype || ''}
                        onChange={handleChange}
                    >
                        <MenuItem value=""><em>{t('common.none') || 'Aucun'}</em></MenuItem>
                        {calendrier.map(({ caltype, callib }) => (
                            <MenuItem key={caltype} value={caltype} sx={{ fontSize: '0.85rem' }}>
                                {callib}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </Grid>
        </Grid>
    );
}
