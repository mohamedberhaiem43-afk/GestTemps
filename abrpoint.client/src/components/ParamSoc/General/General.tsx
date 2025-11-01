import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import Part1 from './part1/Part1';
import Part2 from './part2/Part2';
import Part3 from './part3/Part3';
import './General.css'
import AffichageProps from '../../../models/AffichageProps';

const Item = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.mode === 'dark' ? '#1A2027' : '#fff',
  ...theme.typography.body2,
  padding: theme.spacing(1),
  textAlign: 'center',
  color: theme.palette.text.secondary,
}));


const General: React.FC<AffichageProps> = ({ parametre,onChange }) => {

  return (
    <>
    <Box sx={{ flexGrow: 1 }}>
      <Grid container spacing={2}>
        <Grid item xs={7}>
          <Item>
            <Part1  parametre={parametre} onChange={onChange}/>
          </Item>
        </Grid>
        <Grid item xs={5}>
          <Item>
            <Part2 parametre={parametre} onChange={onChange}/>
          </Item>
        </Grid>
        <Grid item xs={5}>
          <Item>
            <Part3 parametre={parametre} onChange={onChange}/>
          </Item>
        </Grid>
        {/* <Grid item xs={7}>
          <Item>
            <Part4 parametre={parametre}/>
          </Item>
        </Grid> */}
      </Grid>
    </Box>
    </>
  );
}
export default General;