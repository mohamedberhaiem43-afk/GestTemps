import { Checkbox, FormControlLabel, FormLabel,Input,MenuItem, Select } from "@mui/material";
import './Repos.css'
import { useTranslation } from "react-i18next";


interface ReposProps {
  jourRepos: string;
  moinsRepas?: number;
  setMoinsRepas?: (value: number) => void;
  parsom?: number;
  setParsom?: (value: number) => void;
  setJourRepos: (value: string) => void;
}

const Repos:React.FC<ReposProps> = ({ jourRepos,setJourRepos,parsom,setParsom,moinsRepas,setMoinsRepas }) =>
{
    const { t } = useTranslation();
    return(
        <>
            <FormLabel>{t('paramSoc.sansClasse.jourRepos')} </FormLabel>
            <Select value={jourRepos} onChange={(e) => setJourRepos(e.target.value as string)} className="select-repos">
                <MenuItem value={""} >{t('paramSoc.sansClasse.selectionnerJour')}</MenuItem>
                <MenuItem value={"Dimanche"} >{t('paramSoc.calendrier.days.dimanche')}</MenuItem>
                <MenuItem  value={"Lundi"}>{t('paramSoc.calendrier.days.lundi')}</MenuItem>
                <MenuItem  value={"Mardi"}>{t('paramSoc.calendrier.days.mardi')}</MenuItem>
                <MenuItem  value={"Mercredi"}>{t('paramSoc.calendrier.days.mercredi')}</MenuItem>
                <MenuItem  value={"Jeudi"}>{t('paramSoc.calendrier.days.jeudi')}</MenuItem>
                <MenuItem  value={"Vendredi"}>{t('paramSoc.calendrier.days.vendredi')}</MenuItem>
                <MenuItem  value={"Samedi"}>{t('paramSoc.calendrier.days.samedi')}</MenuItem>
            </Select>
            <FormControlLabel control={<Checkbox defaultChecked />} label={t('common.periodicRest')} />
            <FormControlLabel control={<Input value={parsom} onChange={(e)=>setParsom && setParsom(Number(e.target.value))} />} label={t('common.mealsPerDay')} />
            <FormControlLabel control={<Input value={moinsRepas} onChange={(e)=>setMoinsRepas && setMoinsRepas(Number(e.target.value))} />} label={t('common.decreaseMealsFrom')} />

        </>
    );
}

export default Repos;