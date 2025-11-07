import { FormGroup, FormControlLabel, Checkbox, Input } from "@mui/material";
import './Part4.css'
import React from "react";
import AffichageProps from "../../../../models/AffichageProps";

const Part4: React.FC<AffichageProps> = () => {
    return(
        <>
         <FormGroup>
            <FormControlLabel control={<Checkbox defaultChecked />} label="Enregistrement Automatique" />
            <FormControlLabel control={<Checkbox  />} label="Import Auto employé" />
            <FormControlLabel control={<Checkbox  />} label="Modéle Etat de pointage Horaire" />
            <FormControlLabel control={<Input  />} label="Etat du mois" />
            <FormControlLabel control={<Input />} label="Badge unique toutes sociètés" />
            <div className="leftpart">
                <FormControlLabel control={<Checkbox  />} label="Site unique pour toutes les sociétès" />
                <FormControlLabel control={<Checkbox  />} label="Génerer Billet d'Entrée" />
                <FormControlLabel control={<Checkbox  />} label="Séparation Zone" />
                <FormControlLabel control={<Checkbox  />} label="Gérer Par Centre de paie" />
            </div>
        </FormGroup>
        </>
    )
}

export default Part4;