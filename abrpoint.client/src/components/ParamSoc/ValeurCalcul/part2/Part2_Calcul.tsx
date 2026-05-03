import { Box, Grid } from "@mui/material";
import './Part2_Calcul.css'
import { Parametre } from "../../../../models/Parametre";
import InputComponent from "../../../Inputs/Input";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";


interface AffichageProps {
  parametre?: Parametre;
  onChange?: (data: Partial<Parametre>) => void;
}

const Part2_Calcul: React.FC<AffichageProps> = ({ parametre,onChange }) => {
    const { t } = useTranslation();
    const [nbhconge,setNbhconge] = useState(parametre?.nbhconge)
    const [nbhferier,setNbhferier] = useState(parametre?.nbhferier)
    const [nbhrepos,setNbhrepos] = useState(parametre?.nbhrepos)
    const [nbhdemij,setNbhdemij] = useState(parametre?.nbhdemij)
    const [nbhmax1,setNbhmax1] = useState(parametre?.nbhmax1)
    // Notify parent on change
    useEffect(() => {
        if (onChange) {
            onChange({
                nbhconge,
                nbhferier,
                nbhrepos,
                nbhdemij,
                nbhmax1
            });
        }
    }, [nbhconge, nbhferier, nbhrepos, nbhdemij, nbhmax1]);

    return(
        <>
        <Box >
            <Grid container spacing={2}>
                <Grid item xs={3}>
                <InputComponent type={"number"} label={t('paramSoc.valeurCalcul.part2.conge')} value={nbhconge} setValue={setNbhconge} />
                </Grid>
                <Grid item xs={3}>
                <InputComponent type={"number"} label={t('paramSoc.valeurCalcul.part2.ferie')} value={nbhferier} setValue={setNbhferier} />
            </Grid>
            <Grid item xs={3}>
                <InputComponent type={"number"} label={t('paramSoc.valeurCalcul.part2.repos')} value={nbhrepos} setValue={setNbhrepos} />
            </Grid>
            <Grid item xs={3}>
                <InputComponent type={"number"} label={t('paramSoc.valeurCalcul.part2.demiJour')} value={nbhdemij} setValue={setNbhdemij} />
            </Grid>
            <Grid item xs={3}>
                <InputComponent type={"number"} label={t('paramSoc.valeurCalcul.part2.nbHeuresJour')} value={nbhmax1} setValue={setNbhmax1} />
            </Grid>
            </Grid>

        </Box>
        </>
    )
}
export default Part2_Calcul;