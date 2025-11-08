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
    
    const {data:sections = []} = useGetSectionsLibs()
    const {data:qualifications = []} = useGetQualificationsLibs()
    const {data:fonctions = []} = useGetFonctionsLibs()
    useEffect(() => {
        onChange(formData);
    }, [formData, onChange]);

    return (
        <Grid container spacing={2}>
            <Grid item xs={3} mt={2}>
                <RadioGroupComponent value={formData.empniv} setValue={(value)=> handleChange({target:{name:'empniv',value}})}>
                    <FormControlLabelComponent radioValue='2' label='Cadre' />
                    <FormControlLabelComponent radioValue='1' label='Maitrise' />
                    <FormControlLabelComponent radioValue='0' label='Exécutant' />
                </RadioGroupComponent>
            </Grid>
            <Grid item xs={2}>
            <FormControl variant="standard" fullWidth>
                {/* <SelectInputComponent label='Hre Nuit' value={undefined} setValue={undefined} maplist={undefined} /> */}
            <InputLabel shrink id="employe-label">Hre Nuit</InputLabel>
                <Select
                    fullWidth
                    size="small"
                    name="empnuit"
                    value={formData.empnuit}
                    onChange={handleChange}
                    
                >
                    <MenuItem value="0">0-Normal</MenuItem>
                    <MenuItem value="1">1-Spécial</MenuItem>
                </Select>
                </FormControl>
            </Grid>
            <Grid item xs={1.5}>
            <FormControl variant="standard" fullWidth>
            <InputLabel shrink id="employe-label">Panier</InputLabel>
                <Select
                    fullWidth
                    size="small"
                    name="emppanier"
                    value={formData.emppanier}
                    onChange={handleChange}
                    
                >
                    <MenuItem value="1">1-Panier 7H</MenuItem>
                    <MenuItem value="2">2-Panier 8H</MenuItem>
                </Select>
                </FormControl>
            </Grid>
            <Grid item xs={1.5} mt={2}>
                <CheckboxComponent 
                label='Actif' 
                value={formData.actif=='A'} 
                setValue={(value)=> handleChange({target:{name:'actif',value: value ? 'A' : 'N'}})} 
                />
            </Grid>
            <Grid item xs={2.5}>
                <SelectInputComponent label='Fonction' value={formData.foncod} setValue={(value)=>handleChange({target:{ name: 'foncod', value }})} maplist={fonctions} />
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
                <SelectInputComponent label='Qualification' value={formData.quacod} 
                setValue={(value)=>handleChange({target:{ name: 'quacod', value }})} maplist={qualifications} />
            </Grid>
            <Grid item xs={2}>
                <SelectInputComponent label='Section' value={formData.seccod}
                setValue={(value)=>handleChange({target:{ name: 'seccod', value }})}
                maplist={sections} />
            </Grid>
            <Grid item xs={2.5}>
                <FormControl variant="standard" fullWidth>
            <InputLabel shrink id="employe-label">Poste</InputLabel>
                <Select
                    fullWidth
                    size="small"
                    name="poste"
                    value={formData.poscod}
                    onChange={handleChange}
                    
                >
                    <MenuItem value="Finance">Finance</MenuItem>
                    <MenuItem value="Gestionnaire">Gestionnaire</MenuItem>
                </Select>
                </FormControl>
            </Grid>
            <Grid item xs={2}>
                  <InputComponent
                    type="date"
                    label="Date Embauche"
                    value={formData.empemb?.toString().slice(0, 10) || ''}
                    setValue={(value:any)=> handleChange ({target:{ name: 'empemb', value }})} />
            </Grid>
            <Grid item xs={2}>
                  <InputComponent
                    type="date"
                    label="Date Sortie"
                    value={formData.empsort?.toString().slice(0, 10) || ''}
                    setValue={(value:any)=> handleChange ({target:{ name: 'empsort', value }})} />
            </Grid>


            <Grid item xs={2}>
                <InputComponent type='text' label='Motif Sortie' value={formData.empmotif} setValue={(value:any)=> handleChange ({target:{ name: 'empmotif', value }})} />
            </Grid>
            <Grid item xs={2}>
                  <InputComponent
                    type="date"
                    label="Date Retraite"
                    value={formData.empretraite?.toString().slice(0, 10) || ''}
                    setValue={(value:any)=> handleChange ({target:{ name: 'empretraite', value }})} />
            </Grid>
            <Grid item xs={1}>
                <InputComponent type='number' label='Nb.Postes' value={formData.empnbp} setValue={(value:any)=> handleChange ({target:{ name: 'empnbp', value }})} />
            </Grid>
        </Grid>
    );
}
