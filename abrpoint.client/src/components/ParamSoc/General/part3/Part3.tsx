import { Box, Grid } from "@mui/material";
import './Part3.css'
import React, { useEffect, useState } from "react";
import AffichageProps from "../../../../models/AffichageProps";
import InputComponent from "../../../Inputs/Input";

const Part3:React.FC<AffichageProps>=({parametre,onChange})=>{
    const [arrondi, setArrondi] = useState(parametre?.arrondi);
    const [arrhsup, setArrhsup] = useState(parametre?.arrhsup);
    const [arrhentree, setArrhentree] = useState(parametre?.arrhentree);
    const [arrhsortie, setArrhsortie] = useState(parametre?.arrhsortie);
    const [arrhemajore, setArrhemajore] = useState(parametre?.arrhemajore);
    const [arrhsmajore, setArrhsmajore] = useState(parametre?.arrhsmajore);
    useEffect(() => {
        if (onChange) {
            onChange({  
                arrondi: arrondi,
                arrhsup: arrhsup,
                arrhentree: arrhentree,
                arrhsortie: arrhsortie,
                arrhemajore: arrhemajore,
                arrhsmajore: arrhsmajore
            });
        }
    }, [arrondi, arrhsup, arrhentree, arrhsortie, arrhemajore, arrhsmajore, onChange]);
    return(
        <>
        <Box>
            <Grid container item xs={12} spacing={1}>
                <Grid item xs={3.5}>
                    <InputComponent type={"number"} label={"Arrondi de pointage"} value={arrondi} setValue={setArrondi} />
                </Grid>
                <Grid item xs={4.5}>
                    <InputComponent type={"number"} label={"Arrondi chaque heure d'entrée"} value={arrhentree} setValue={setArrhentree} />
                </Grid>
                <Grid item xs={3.5}>
                    <InputComponent type={"number"} label={"Majorée à partir de"} value={arrhemajore} setValue={setArrhemajore} />
                </Grid>
                <Grid item xs={4}>
                    <InputComponent type={"number"} label={"Arrondi heures supp."} value={arrhsup} setValue={setArrhsup} />
                </Grid>
                <Grid item xs={4.5}>
                    <InputComponent type={"number"} label={"Arrondi chaque heure de sortie"} value={arrhsortie} setValue={setArrhsortie} />
                </Grid>
                <Grid item xs={3.5}>
                    <InputComponent type={"number"} label={"Majorée à partir de"} value={arrhsmajore} setValue={setArrhsmajore} />
                </Grid>
            </Grid>
        </Box>        
        </>
    )
}
export default Part3;