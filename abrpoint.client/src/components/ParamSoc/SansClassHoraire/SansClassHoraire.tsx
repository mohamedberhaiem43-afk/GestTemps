import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import Repos from './Repos/Repos';
import HeuresNuit from './HeuresNuit/HeuresNuit';
import MethodeCalcul from './MethodeCalcul/MethodeCalcul';
import useGetParametres from '../../../hooks/parametreHooks/useGetParametres';
import { useEffect, useState } from 'react';

const Item = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.mode === 'dark' ? '#1A2027' : '#fff',
  ...theme.typography.body2,
  padding: theme.spacing(1),
  textAlign: 'center',
  color: theme.palette.text.secondary,
}));
interface SansClassHoraireProps {
  onChange?: (value: any) => void;
}

const SansClassHoraire: React.FC<SansClassHoraireProps> = ({ onChange }) => {
    const { data: parametres } = useGetParametres();
    const [nuitdeb, setNuitDebNormal] = useState('');
    const [nuitfin, setNuitFinNormal] = useState('');
    const [nuitsdeb, setNuitDebSpecial] = useState('');
    const [nuitsfin, setNuitFinSpecial] = useState('');
    const [jourRepos, setJourRepos] = useState('');
    const [repasNuit, setRepasNuit] = useState('');
    const [nbhtr4M, setNbhtr4M] = useState(0);
    const [moinsRepas, setMoinsRepas] = useState(0);
    const [parsom, setParsom] = useState(0);
    const [dtepres, setDtepres] = useState('');
    const [parjhsfixe, setParjhsfixe] = useState(0);
    const [nbhtr4, setNbhtr4] = useState(0);
    const [parNuit, setParNuit] = useState('');
    useEffect(() => {
      const data = {
        nuitdeb, nuitfin,
        nuitsdeb, nuitsfin,
        jourRepos, repasNuit,
        nbhtr4M, moinsRepas, parsom,
        dtepres, parjhsfixe,
        nbhtr4, parNuit
      };

      onChange?.(data);
    }, [
      nuitdeb, nuitfin,
      nuitsdeb, nuitsfin,
      jourRepos, repasNuit,
      nbhtr4M, moinsRepas, parsom,
      dtepres, parjhsfixe,
      nbhtr4, parNuit
    ]);

    
    useEffect(() => {
        if (parametres) {           
            setNuitDebNormal(parametres.nuitdeb ? parametres.nuitdeb.split(',')[0] : '');
            setNuitFinNormal(parametres.nuitfin ? parametres.nuitfin.split(',')[0] : '');
            setNuitDebSpecial(parametres.nuitsdeb ? parametres.nuitsdeb.split(',')[0] : '');
            setNuitFinSpecial(parametres.nuitsfin ? parametres.nuitsfin.split(',')[0] : '');
            setJourRepos(parametres.jourrepos || '');
            setRepasNuit(parametres.repasnuit || '');
            setNbhtr4M(parametres.nbhtr4M || 0);
            setMoinsRepas(parametres.moinsrepas || 0);
            setParsom(parametres.parsom || 0);
            setDtepres(parametres.dtepres || '');
            setParjhsfixe(parametres.parjhsfixe || 0);
            setNbhtr4(parametres.nbhtr4 || 0);
            setParNuit(parametres.parnuit || '');
          }
    }, [parametres]);

  return (
    <>
    <Box sx={{ flexGrow: 1 }}>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Item>
            <Repos jourRepos = {jourRepos} setJourRepos = {setJourRepos}
                  moinsRepas = {moinsRepas} setMoinsRepas = {setMoinsRepas}
                  parsom = {parsom} setParsom = {setParsom}
                  />
          </Item>
        </Grid>
       
        <Grid item xs={5}>
          <Item>
            <HeuresNuit nuitdeb={nuitdeb} nuitfin = {nuitfin}
             nuitsdeb = {nuitsdeb} nuitsfin = {nuitsfin} 
             setNuitDebNormal = {setNuitDebNormal} setNuitFinSpecial = {setNuitFinSpecial} 
             setNuitDebSpecial = {setNuitDebSpecial} setNuitFinNormal = {setNuitFinNormal} 
              repasNuit = {repasNuit} setRepasNuit = {setRepasNuit}
              nbhtr4M = {nbhtr4M} setNbhtr4M = {setNbhtr4M}
              nbhtr4 = {nbhtr4} setNbhtr4 = {setNbhtr4}
              parjhsfixe = {parjhsfixe} setParjhsfixe = {setParjhsfixe}
              dtepres = {dtepres} setDtepres = {setDtepres}
              parNuit = {parNuit} setParNuit = {setParNuit}

             />
          </Item>
        </Grid>
        {/* <Grid item xs={7}>
          <Item>
            <MethodeCalcul />
          </Item>
        </Grid> */}
      </Grid>
    </Box>
    </>
  );
}
export default SansClassHoraire;