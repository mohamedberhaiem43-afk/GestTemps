import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import useGetPostesData from '../../hooks/posteHooks/useGetPostesData';
import { useClasseHoraireContext } from '../helper/ClasseHoraireContext';
import { PosteHoraire } from '../../models/PosteHoraire';
import { useEffect } from 'react';

const PosteHoraireList = () => {
  const theme = useTheme();

  const { selectedPoste,selectedClasseHoraire } = useClasseHoraireContext();
  const {data:poste = {} as PosteHoraire, refetch} = useGetPostesData(selectedPoste?? '',selectedClasseHoraire?.catcod);
  useEffect(()=>{
    if(selectedPoste){
      refetch();
    }
  },[selectedPoste])
  let scheduleData: any[]=[]
    scheduleData = [
      { jour: 'Lundi', DebEntree: poste?.lunhdematin,Entrée: poste?.lunhdmat,FinEntree: poste?.lunhfematin, Sortie: poste?.lunhfmat, repasBonus: poste?.lunrepas, repos: poste?.lunrepos,DebEntree2: poste?.lunhdeamidi,Entree2:poste?.lunhdam,Sortie2:poste?.lunhfam,FinEntree2: poste?.lunhfeamidi,maxhre:poste?.maxhrelun,minhjour:poste?.minhjourlun,minhdemijour:poste?.minhdemijourlun,Douche:poste?.lundouche },
      { jour: 'Mardi', DebEntree: poste?.marhdematin,Entrée: poste?.marhdmat,FinEntree: poste?.marhfematin, Sortie: poste?.marhfmat, repasBonus: poste?.marrepas, repos: poste?.marrepos,DebEntree2: poste?.marhdeamidi,Entree2:poste?.marhdam,Sortie2:poste?.marhfam,FinEntree2: poste?.marhfeamidi,maxhre:poste?.maxhremar,minhjour:poste?.minhjourmar,minhdemijour:poste?.minhdemijourmar,Douche:poste?.mardouche },
      { jour: 'Mercredi', DebEntree: poste?.merhdematin,Entrée: poste?.merhdmat,FinEntree: poste?.merhfematin, Sortie: poste?.merhfmat, repasBonus: poste?.merrepas, repos: poste?.merrepos,DebEntree2: poste?.merhdeamidi,Entree2:poste?.merhdam,Sortie2:poste?.merhfam,FinEntree2: poste?.merhfeamidi,maxhre:poste?.maxhremer,minhjour:poste?.minhjourmer,minhdemijour:poste?.minhdemijourmer,Douche:poste?.merdouche },
      { jour: 'Jeudi', DebEntree: poste?.jeuhdematin,Entrée: poste?.jeuhdmat,FinEntree: poste?.jeuhfematin, Sortie: poste?.jeuhfmat, repasBonus: poste?.jeurepas, repos: poste?.jeurepos,DebEntree2: poste?.jeuhdeamidi,Entree2:poste?.jeuhdam,Sortie2:poste?.jeuhfam,FinEntree2: poste?.jeuhfeamidi,maxhre:poste?.maxhrejeu,minhjour:poste?.minhjourjeu,minhdemijour:poste?.minhdemijourjeu,Douche:poste?.jeudouche },
      { jour: 'Vendredi', DebEntree: poste?.venhdematin,Entrée: poste?.venhdmat,FinEntree: poste?.venhfematin, Sortie: poste?.venhfmat, repasBonus: poste?.venrepas, repos: poste?.venrepos,DebEntree2: poste?.venhdeamidi,Entree2:poste?.venhdam,Sortie2:poste?.venhfam,FinEntree2: poste?.venhfeamidi,maxhre:poste?.maxhreven,minhjour:poste?.minhjourven,minhdemijour:poste?.minhdemijourven,Douche:poste?.vendouche },
      { jour: 'Samedi', DebEntree: poste?.samhdematin,Entrée: poste?.samhdmat,FinEntree: poste?.samhfematin, Sortie: poste?.samhfmat, repasBonus: poste?.samrepas, repos: poste?.samrepos,DebEntree2: poste?.samhdeamidi,Entree2:poste?.samhdam,Sortie2:poste?.samhfam,FinEntree2: poste?.samhfeamidi,maxhre:poste?.maxhresam,minhjour:poste?.minhjoursam,minhdemijour:poste?.minhdemijoursam,Douche:poste?.samdouche },
      { jour: 'Dimanche', DebEntree: poste?.dimhdematin,Entrée: poste?.dimhdmat,FinEntree: poste?.dimhfematin, Sortie: poste?.dimhfmat, repasBonus: poste?.dimrepas, repos: poste?.dimrepos,DebEntree2: poste?.dimhdeamidi,Entree2:poste?.dimhdam,Sortie2:poste?.dimhfam,FinEntree2: poste?.dimhfeamidi,maxhre:poste?.maxhredim,minhjour:poste?.minhjourdim,minhdemijour:poste?.minhdemijourdim,Douche:poste?.dimdouche },
    ];

  return (
    <TableContainer component={Paper}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell 
              size='small'
              sx={{ 
                backgroundColor: theme.palette.primary.main, 
                color: theme.palette.primary.contrastText, 
                fontWeight: 'bold' 
              }}
            >
              Journée
            </TableCell>
            <TableCell 
              size='small' 
              sx={{ 
                backgroundColor: theme.palette.primary.main, 
                color: theme.palette.primary.contrastText, 
                fontWeight: 'bold' 
              }}
            >
              Début Entrée
            </TableCell>
            <TableCell 
              size='small' 
              sx={{ 
                backgroundColor: theme.palette.primary.main, 
                color: theme.palette.primary.contrastText, 
                fontWeight: 'bold' 
              }}
            >
              Entrée
            </TableCell>
            <TableCell 
              size='small' 
              sx={{ 
                backgroundColor: theme.palette.primary.main, 
                color: theme.palette.primary.contrastText, 
                fontWeight: 'bold' 
              }}
            >
              Fin Entrée
            </TableCell>
            <TableCell 
              size='small' 
              sx={{ 
                backgroundColor: theme.palette.primary.main, 
                color: theme.palette.primary.contrastText, 
                fontWeight: 'bold' 
              }}
            >
              Sortie
            </TableCell>
            <TableCell 
              size='small' 
              sx={{ 
                backgroundColor: theme.palette.primary.main, 
                color: theme.palette.primary.contrastText, 
                fontWeight: 'bold' 
              }}
            >
              Repas Bonus
            </TableCell>
             <TableCell 
              size='small' 
              sx={{ 
                backgroundColor: theme.palette.primary.main, 
                color: theme.palette.primary.contrastText, 
                fontWeight: 'bold' 
              }}
            >
              Début Entrée
            </TableCell>
             <TableCell 
              size='small' 
              sx={{ 
                backgroundColor: theme.palette.primary.main, 
                color: theme.palette.primary.contrastText, 
                fontWeight: 'bold' 
              }}
            >
              Entrée
            </TableCell>
             <TableCell 
              size='small' 
              sx={{ 
                backgroundColor: theme.palette.primary.main, 
                color: theme.palette.primary.contrastText, 
                fontWeight: 'bold' 
              }}
            >
              Fin Entrée
            </TableCell>
             <TableCell 
              size='small' 
              sx={{ 
                backgroundColor: theme.palette.primary.main, 
                color: theme.palette.primary.contrastText, 
                fontWeight: 'bold' 
              }}
            >
              Sortie
            </TableCell>
            <TableCell 
              size='small' 
              sx={{ 
                backgroundColor: theme.palette.primary.main, 
                color: theme.palette.primary.contrastText, 
                fontWeight: 'bold' 
              }}
            >
              Repos
            </TableCell>
            <TableCell 
              size='small' 
              sx={{ 
                backgroundColor: theme.palette.primary.main, 
                color: theme.palette.primary.contrastText, 
                fontWeight: 'bold' 
              }}
            >
              Max Hre
            </TableCell>
            <TableCell 
              size='small' 
              sx={{ 
                backgroundColor: theme.palette.primary.main, 
                color: theme.palette.primary.contrastText, 
                fontWeight: 'bold' 
              }}
            >
              Min Hre/Jour
            </TableCell>
            <TableCell 
              size='small' 
              sx={{ 
                backgroundColor: theme.palette.primary.main, 
                color: theme.palette.primary.contrastText, 
                fontWeight: 'bold' 
              }}
            >
              Min Hre 1/2J
            </TableCell>
            <TableCell 
              size='small' 
              sx={{ 
                backgroundColor: theme.palette.primary.main, 
                color: theme.palette.primary.contrastText, 
                fontWeight: 'bold' 
              }}
            >
              Douche
            </TableCell>
           
          </TableRow>
        </TableHead>
        <TableBody>
          {scheduleData.map((row, index) => (
            <TableRow key={index}>
              <TableCell size='small'>{row.jour}</TableCell>
              <TableCell size='small'>{row.DebEntree}</TableCell>
              <TableCell size='small'>{row.Entrée}</TableCell>
              <TableCell size='small'>{row.FinEntree}</TableCell>
              <TableCell size='small'>{row.Sortie}</TableCell>
              <TableCell size='small'>{row.repasBonus}</TableCell>
              <TableCell size='small'>{row.DebEntree2}</TableCell>
              <TableCell size='small'>{row.Entree2}</TableCell>
              <TableCell size='small'>{row.FinEntree2}</TableCell>
              <TableCell size='small'>{row.Sortie2}</TableCell>
              <TableCell size='small'>
                {row.repos === '1' ? 'Oui' : 'Non'}
              </TableCell>
              <TableCell size='small'>{row.maxhre}</TableCell>
              <TableCell size='small'>{row.minhjour}</TableCell>
              <TableCell size='small'>{row.minhdemijour}</TableCell>
              <TableCell size='small'>{row.Douche}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default PosteHoraireList;
