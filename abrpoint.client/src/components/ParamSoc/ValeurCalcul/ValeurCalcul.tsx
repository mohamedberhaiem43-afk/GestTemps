import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import Part1_Calcul from './part1/Part1_Calcul';
import Part2_Calcul from './part2/Part2_Calcul';
import Part3_Calcul from './part3/Part3_Calcul';
import { Parametre } from '../../../models/Parametre';

const Item = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.mode === 'dark' ? '#1A2027' : '#fff',
  ...theme.typography.body2,
  padding: theme.spacing(1),
  textAlign: 'center',
  color: theme.palette.text.secondary,
}));


interface AffichageProps {
  parametre?: Parametre;
  onChange?: (data: Partial<Parametre>) => void;
}

const ValeurCalcul: React.FC<AffichageProps> = ({ parametre, onChange }) => {
  return (
    <Box sx={{ flexGrow: 1 }}>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Item>
            <Part1_Calcul parametre={parametre} onChange={onChange} />
          </Item>
        </Grid>
        <Grid item xs={5}>
          <Item>
            <Part2_Calcul parametre={parametre} onChange={onChange} />
          </Item>
        </Grid>
        <Grid item xs={7}>
          <Item>
            <Part3_Calcul parametre={parametre} onChange={onChange} />
          </Item>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ValeurCalcul;