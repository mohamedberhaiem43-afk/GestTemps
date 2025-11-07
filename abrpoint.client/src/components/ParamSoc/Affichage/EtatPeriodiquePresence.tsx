import { Parametre } from "../../../models/Parametre";
import CheckboxComponent from "../../CheckboxComponent/CheckboxComponent";
import { useEffect, useState } from "react";
import InputComponent from "../../Inputs/Input";
import { Grid } from "@mui/material";

interface AffichageProps {
  parmetres?: Parametre | undefined;
    onChange?: (data: Partial<Parametre>) => void;

}

const EtatPeriodiquePresence: React.FC<AffichageProps> = ({ parmetres,onChange }) => {
        const [tauxtr1,setTauxtr1] = useState(parmetres?.tauxtr1 == 1?true:false)
        const [nbhtr2,setNbhtr2] = useState(parmetres?.nbhtr2 == 1?true:false)
        const [tauxtr2,setTauxtr2] = useState(parmetres?.tauxtr2 == 1?true:false)
        const [nbhtr3,setNbhtr3] = useState(parmetres?.nbhtr3 == 1?true:false)
        const [separe,setSepare] = useState(parmetres?.separe);
        useEffect(() => {
            if (onChange) {
            onChange({
                tauxtr1: tauxtr1 ? 1 : 0,
                nbhtr2:nbhtr2 ? 1: 0,
                tauxtr2: tauxtr2 ? 1:0,
                nbhtr3: nbhtr3 ? 1:0,
                separe,
            });
            }
        }, [tauxtr1, nbhtr2, tauxtr2,nbhtr3, separe]);
    return(
        <>
            <CheckboxComponent label={"Afficher Taux 25%"} value={tauxtr1} setValue={setTauxtr1} />
            <CheckboxComponent label={"Afficher Taux 50%"} value={nbhtr2} setValue={setNbhtr2} />
            <CheckboxComponent label={"Afficher Taux 75%"} value={tauxtr2} setValue={setTauxtr2} />
            <CheckboxComponent label={"Afficher Taux 100%"} value={nbhtr3} setValue={setNbhtr3} />
            <Grid item xs={3}>
                <InputComponent type="text" label="Séparation décimal" value={separe} setValue={setSepare} />
            </Grid>
        </>

    )
}
export default EtatPeriodiquePresence;