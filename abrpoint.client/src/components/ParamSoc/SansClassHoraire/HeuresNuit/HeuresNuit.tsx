import { FormControlLabel, Checkbox, FormLabel, TextField } from "@mui/material";
import './HeuresNuit.css'
import { useTranslation } from "react-i18next";


interface HeuresNuitProps {
  nuitdeb: string;
  nuitfin: string;
  nuitsdeb: string;
  nuitsfin: string;
  repasNuit?: string;
  nbhtr4M?: number;
  nbhtr4?: number;
  parjhsfixe?: number;
  dtepres?: string;
  parNuit?: string;

  setParNuit?: (value: string) => void;
  setDtepres?: (value: string) => void;
  setParjhsfixe?: (value: number) => void;
  setNbhtr4?: (value: number) => void;
  setNbhtr4M?: (value: number) => void;
  setRepasNuit?: (value: string) => void;
  setNuitDebNormal: (value: string) => void;
  setNuitFinNormal: (value: string) => void;
  setNuitDebSpecial: (value: string) => void;
  setNuitFinSpecial: (value: string) => void;
}

 const HeuresNuit: React.FC<HeuresNuitProps> = ({ nuitdeb, nuitfin, nuitsdeb, nuitsfin,
  setNuitDebNormal,setNuitDebSpecial,setNuitFinNormal,setNuitFinSpecial,nbhtr4M,setNbhtr4M,repasNuit,setRepasNuit,
    nbhtr4,setNbhtr4,parjhsfixe,setParjhsfixe,dtepres,setDtepres,parNuit,setParNuit
}) => {
    const { t } = useTranslation();

    return (
      <>
        <h3>{t('paramSoc.sansClasse.heuresNuitTitle')}</h3>
        <FormControlLabel control={<Checkbox checked={parNuit === '1'} onChange={(e) => setParNuit && setParNuit(e.target.checked ? '1' : '0')} />}
        label={t('common.countNightHours')} />
        <div className="heuredeb">
            <FormLabel>{t('paramSoc.sansClasse.heureDebut')}</FormLabel>
            <TextField
                label={t('paramSoc.sansClasse.normal')}
                variant="standard"
                value={nuitdeb}
                onChange={(e) => setNuitDebNormal(e.target.value)}
            />
            <TextField
                label={t('paramSoc.sansClasse.speciale')}
                variant="standard"
                value={nuitsdeb}
                onChange={(e) => setNuitDebSpecial(e.target.value)}
            />
        </div>
        <div className="heurefin">
            <FormLabel>{t('paramSoc.sansClasse.heureFin')}</FormLabel>
            <TextField
                label={t('paramSoc.sansClasse.normal')}
                variant="standard"
                value={nuitfin}
                onChange={(e) => setNuitFinNormal(e.target.value)}
            />
            <TextField
                label={t('paramSoc.sansClasse.speciale')}
                variant="standard"
                value={nuitsfin}
                onChange={(e) => setNuitFinSpecial(e.target.value)}
            />
        </div>
        <TextField label={t('common.minNightHoursPerDay')} variant="standard"
        value={nbhtr4M} onChange={(e)=>setNbhtr4M && setNbhtr4M(Number(e.target.value))} />

        <div className="checkboxes">
            <FormControlLabel control={<Checkbox checked={repasNuit === '1'} onChange={(e) => setRepasNuit && setRepasNuit(e.target.checked ? '1' : '0')} />}
             label={t('common.decreaseNightMeals')} />

            <FormControlLabel control={<Checkbox checked={dtepres === '1'} onChange={(e) => setDtepres && setDtepres(e.target.checked ? '1' : '0')} />}
            label={t('paramSoc.sansClasse.compterSortie')} />
            <FormControlLabel control={<Checkbox checked={parjhsfixe === 1} onChange={(e) => setParjhsfixe && setParjhsfixe(e.target.checked ? 1 : 0)} />}
             label={t('paramSoc.sansClasse.neCompterPas')} />
            <FormControlLabel control={<Checkbox checked={nbhtr4 === 1} onChange={(e) => setNbhtr4 && setNbhtr4(e.target.checked ? 1 : 0)} />}
            label={t('paramSoc.sansClasse.majoreHnuit')} />
        </div>
      </>
    );
}
export default HeuresNuit;