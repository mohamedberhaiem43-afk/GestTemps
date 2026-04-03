import { FormControl, FormControlLabel, InputLabel, MenuItem, Radio, RadioGroup, Select } from "@mui/material";
import './ValeurDefautSelection.css';
import React, { useEffect } from "react";
import { Parametre } from "../../../../models/Parametre";



interface AffichageProps {
  parmetres?: Parametre | undefined;
  onChange?: (data: Partial<Parametre>) => void;
}

const ValeurDefautSelection: React.FC<AffichageProps> = ({ parmetres, onChange }) => {
    const [nbhtr1M, setNbhtr1M] = React.useState(parmetres?.nbhtr1M);
    const [tauxtr1M, setTauxtr1M] = React.useState(parmetres?.tauxtr1M);
    const [tauxtr4, setTauxtr4] = React.useState(parmetres?.tauxtr4);
    const [nbhtr2M, setNbhtr2M] = React.useState(parmetres?.nbhtr2M);
        useEffect(() => {
            if (onChange) {
            onChange({
                nbhtr1M,
                tauxtr1M,
                tauxtr4,
                nbhtr2M,
            });
            }
        }, [nbhtr1M, tauxtr1M, tauxtr4, nbhtr2M]);
    return (
        <>
            <div className="selects">
                <div className="select">
                    <InputLabel shrink={true}>Régime</InputLabel>
                    <Select
                        variant="standard"
                        size='small'
                        labelId="intpaie-label"
                        label="Régime"
                        sx={{ width: '200px' }}  // Adjust width here
                        value={nbhtr1M}
                        onChange={(e)=>setNbhtr1M(Number(e.target.value))}
                    >
                        <MenuItem value={0}> Tous</MenuItem>
                        <MenuItem value={1}> Mensuel</MenuItem>
                        <MenuItem value={2}> Horaire</MenuItem>
                    </Select>
                </div>
                <div className="select">
                    <InputLabel shrink={true}>Présence</InputLabel>
                    <Select
                        variant="standard"
                        size='small'
                        label="Présence"
                        sx={{ width: '200px' }}
                        value={tauxtr1M}
                        onChange={(e)=>setTauxtr1M(Number(e.target.value))}
                    >
                        <MenuItem value={0}> Tous</MenuItem>
                        <MenuItem value={1}> Valide</MenuItem>
                        <MenuItem value={2}> Invalide</MenuItem>
                        <MenuItem value={3}> Manquant</MenuItem>
                        <MenuItem value={4}> Absence</MenuItem>
                    </Select>
                </div>
                <FormControl component="fieldset">
                    <RadioGroup aria-label="gender" name="gender1" value={nbhtr2M} onChange={(e)=>setNbhtr2M(Number(e.target.value))}>
                        <FormControlLabel value={0} control={<Radio size="small" />} label="Directe" />
                        <FormControlLabel value={1} control={<Radio size="small" />} label="Indirecte" />
                        <FormControlLabel value={2} control={<Radio size="small" />} label="Tous" />
                    </RadioGroup>
                </FormControl>
                <div className="select">
                    <InputLabel shrink={true}>Modéle Etat Présence</InputLabel>
                    <Select
                        variant="standard"
                        size='small'
                        label="Modéle Etat Présence"
                        sx={{ width: '200px' }}
                        value={tauxtr4}
                        onChange={(e)=>setTauxtr4(Number(e.target.value))}
                    >
                        <MenuItem value={0}> Normal</MenuItem>
                        <MenuItem value={1}> Hebdomadaire</MenuItem>
                        <MenuItem value={2}> 7 Jour/Semaine</MenuItem>
                    </Select>
                </div>
            </div>
        </>
    );
}
export default ValeurDefautSelection;