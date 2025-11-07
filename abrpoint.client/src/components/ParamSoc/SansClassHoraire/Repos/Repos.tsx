import { Checkbox, FormControlLabel, FormLabel,Input,MenuItem, Select } from "@mui/material";
import './Repos.css'


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
    return(
        <>
            <FormLabel>Jour de Repos: </FormLabel>
            <Select value={jourRepos} onChange={(e) => setJourRepos(e.target.value as string)} className="select-repos">
                <MenuItem value={""} >Sélectionner un jour</MenuItem>
                <MenuItem value={"Dimanche"} >Dimanche</MenuItem>
                <MenuItem  value={"Lundi"}>Lundi</MenuItem>
                <MenuItem  value={"Mardi"}>Mardi</MenuItem>
                <MenuItem  value={"Mercredi"}>Mercredi</MenuItem>
                <MenuItem  value={"Jeudi"}>Jeudi</MenuItem>
                <MenuItem  value={"Vendredi"}>Vendredi</MenuItem>
                <MenuItem  value={"Samedi"}>Samedi</MenuItem>
            </Select>
            <FormControlLabel control={<Checkbox defaultChecked />} label="Repos périodique" />
            <FormControlLabel control={<Input value={parsom} onChange={(e)=>setParsom && setParsom(Number(e.target.value))} />} label="Repas / Jour: " />
            <FormControlLabel control={<Input value={moinsRepas} onChange={(e)=>setMoinsRepas && setMoinsRepas(Number(e.target.value))} />} label="Diminuer Repas à partir: " />

        </>
    );
}

export default Repos;