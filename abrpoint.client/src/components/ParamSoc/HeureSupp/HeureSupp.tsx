import {
  Box,
  Grid,
  Paper,
  Typography,
  FormControlLabel,
  Radio,
  RadioGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Select,
  MenuItem,
  Input,
} from "@mui/material";
import CheckboxComponent from "../../CheckboxComponent/CheckboxComponent";
import { useEffect, useState } from "react";
import useGetParametres from "../../../hooks/parametreHooks/useGetParametres";
import { QueryClient, QueryClientProvider } from "react-query";
import useGetParTranche from "../../../hooks/partrancheHooks/useGetParTranche";
import ParTranche from "../../../models/ParTranche";

interface HeureSuppProps {
  onChange?: (value: any) => void;
  onChange1?: (value: any) => void;
}

const HeureSupp: React.FC<HeureSuppProps> = ({ onChange,onChange1 }) => {
    const [hsuphebd, setMethCalcHor] = useState('0');
    const [hsuphebdm, setMethCalcMen] = useState('0');
    const [parcadre, setParcadre] = useState<string>('0');
    const [parmaitrise, setParmaitrise] = useState<string>('0');
    const [parexec, setParexec] = useState<string>('0');
    const [parscomplet, setParscomplet] = useState<string>('0');
    const [parelimftrv, setParelimftrv] = useState('0');
    const [parreptrv, setParreptrv] = useState('0');
    const [tranche1M, setTranche1M] = useState(0);
    const [taux1M, setTaux1M] = useState(0);
    const [tranche2M, setTranche2M] = useState(0);
    const [taux2M, setTaux2M] = useState(0);

    const [partranche1, setTranche1] = useState<number>(0);
    const [partaux1, setTaux1] = useState(0);
    const [partranche2, setTranche2] = useState(0);
    const [partaux2, setTaux2] = useState(0);
    const { data: parametres } = useGetParametres();
    const { data: partranche } = useGetParTranche();

    useEffect(() => {
  const data = {
    hsuphebd,
    hsuphebdm,
    parcadre,
    parmaitrise,
    parexec,
    parscomplet,
    parelimftrv,
    parreptrv,

  };
const trancheDataList: ParTranche[] = [
  {
    partranche1,
    partaux1,
    partranche2,
    partaux2,
    soccod: sessionStorage.getItem("soccod") || '',
    ordre: 0,
    caltype: "",
    empreg: "H",
  },
  {
    partranche1: tranche1M,
    partaux1: taux1M,
    partranche2: tranche2M,
    partaux2: taux2M,
    soccod: sessionStorage.getItem("soccod") || '',
    ordre: 0,
    caltype: "",
    empreg: "M",
  }
];
// Send list to parent or API
onChange1?.(trancheDataList);

// call parent's setter
onChange?.(data); 
}, [
  hsuphebd, hsuphebdm,
  parcadre, parmaitrise, parexec, parscomplet,
  parelimftrv, parreptrv,
  partranche1, partranche2, partaux1, partaux2,
  tranche1M, tranche2M, taux1M, taux2M
]);


     useEffect(() => {
  if (parametres) {
    setMethCalcHor(parametres.hsuphebd || '0');
    setMethCalcMen(parametres.hsuphebdm || '0');
    setParcadre(parametres.parcadre || '0');
    setParmaitrise(parametres.parmaitrise || '0');
    setParexec(parametres.parexec || '0');
    setParscomplet(parametres.parscomplet || '0');
    setParelimftrv(parametres.parelimftrv || '0');
    setParreptrv(parametres.parreptrv || '0');
  }

  if (partranche && Array.isArray(partranche)) {
    const regimeH = partranche.find(p => p.empreg === 'H');
    const regimeM = partranche.find(p => p.empreg === 'M');

    if (regimeH) {
      setTranche1(regimeH.partranche1 || 0);
      setTaux1(regimeH.partaux1 || 0);
      setTranche2(regimeH.partranche2 || 0);
      setTaux2(regimeH.partaux2 || 0);
    }

    if (regimeM) {
      setTranche1M(regimeM.partranche1 || 0);
      setTaux1M(regimeM.partaux1 || 0);
      setTranche2M(regimeM.partranche2 || 0);
      setTaux2M(regimeM.partaux2 || 0);
    }
  }
}, [parametres, partranche]);

  const radioOptions = [
  { value: '0', label: 'Param. Catégorie' },
  { value: '1', label: 'Param. Poste' },
  { value: '4', label: 'Heures sup. Mensuel' },
  { value: '3', label: 'Calcul H.Sup Hebdomadaire' },
  { value: '2', label: 'Tranche heure max trav./jour' },
  { value: '6', label: 'Cumul des heures sup/jour' },
  { value: '5', label: 'H.Sup Hebdomadaire+Mens' }
];
 const Taux = [0,25,50,75,100];
  const queryClient = new QueryClient();

 const renderTableRows = (
  trancheData: any[],
  tranche1Val: string,
  setTranche1Val: any,
  tranche2Val: string,
  setTranche2Val: any,
  taux1Val: number,
  setTaux1Val: any,
  taux2Val: number,
  setTaux2Val: any
) => {
  return trancheData.map((row, index) => (
    <TableRow key={index}>
      <TableCell>
        <Input
          sx={{ width: 80 }}
          value={row.caltype || ''}
        />
      </TableCell>
      <TableCell>
        <Input
          sx={{ width: 80 }}
          type="number"
          value={tranche1Val}
          onChange={(e) => setTranche1Val(e.target.value)}
        />
      </TableCell>
      <TableCell>
        <Select
          fullWidth
          variant="standard"
          value={taux1Val}
          onChange={(e) => setTaux1Val(e.target.value)}
        >
          {Taux.map((taux) => (
            <MenuItem key={taux} value={taux}>{taux}</MenuItem>
          ))}
        </Select>
      </TableCell>
      <TableCell>
        <Input
          sx={{ width: 80 }}
          type="number"
          value={tranche2Val}
          onChange={(e) => setTranche2Val(e.target.value)}
        />
      </TableCell>
      <TableCell>
        <Select
          fullWidth
          variant="standard"
          value={taux2Val}
          onChange={(e) => setTaux2Val(e.target.value)}
        >
          {Taux.map((taux) => (
            <MenuItem key={taux} value={taux}>{taux}</MenuItem>
          ))}
        </Select>
      </TableCell>
    </TableRow>
  ));
};



  return (
    <QueryClientProvider client={queryClient}>
      <Box p={2}>
          <Grid container xs={12} md={6}  mt={-4}>
            
              <Grid  xs={6} md={6} >
                      <Paper elevation={1} sx={{ padding: 2 }} >
                      <Typography variant="h6" color="primary" gutterBottom>Horaire</Typography>
                      <Grid display={"flex"} gap={15}>
                      <RadioGroup name="method-horaire" value={hsuphebd} onChange={(e) => setMethCalcHor(e.target.value)}>
                        {radioOptions.map((option, index) => (
                          <FormControlLabel
                            key={index}
                            value={(option.value).toString()} // Reverse index
                            control={<Radio size="small" />}
                            label={option.label}
                          />
                        ))}
                      </RadioGroup>

                  </Grid>
                      </Paper>
              </Grid>
              <Grid  xs={6} md={6} >
                      <Paper elevation={1} sx={{ padding: 2 }} >
                      <Typography variant="h6" color="primary" >Mensuel</Typography>
                      <Grid ml={5}>
                          <CheckboxComponent label='Cadre' value={parcadre=='1'} setValue={checked => setParcadre(checked ? '1' : '0')} />
                          <CheckboxComponent label='Maitrise' value={parmaitrise=='1'} setValue={checked => setParmaitrise(checked ? '1' : '0')} />
                          <CheckboxComponent label='Exécutant' value={parexec=='1'} setValue={checked => setParexec(checked ? '1' : '0')} />
                      </Grid>
                      <Grid display={"flex"} gap={15} mt={-3.5} >
                      <RadioGroup  name="method-mensuel" value={hsuphebdm} onChange={(e) => setMethCalcMen(e.target.value)}>
                          {radioOptions.map((option, index) => (
                          <FormControlLabel
                              key={index}
                              value={(option.value).toString()}
                              control={<Radio size="small" />}
                              label={option.label}
                          />
                          ))}
                      </RadioGroup>
                          <CheckboxComponent label="Semaine Complète" value={parscomplet=='1'} setValue={checked => setParscomplet(checked ? '1' : '0')} />
                  </Grid>
                      </Paper>
              </Grid>
              <Grid container spacing={3} mt={-2}>
                  {[0, 1].map((tableIndex) => (
                    <Grid item xs={6} md={6} key={tableIndex}>
                      <TableContainer component={Paper}>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell width={1}>Calendrier</TableCell>
                              <TableCell>Tranche 1</TableCell>
                              <TableCell>Taux 1</TableCell>
                              <TableCell width={1}>Tranche 2</TableCell>
                              <TableCell>Taux 2</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {tableIndex === 0
                              ? renderTableRows(
                                  Array.isArray(partranche) ? partranche.filter((p) => p.empreg === 'H') : [],
                                  partranche1.toString(), setTranche1,
                                  partranche2.toString(), setTranche2,
                                  partaux1, setTaux1,
                                  partaux2, setTaux2
                                )
                              : renderTableRows(
                                  Array.isArray(partranche) ? partranche.filter((p) => p.empreg === 'M') : [],
                                  tranche1M.toString(), setTranche1M,
                                  tranche2M.toString(), setTranche2M,
                                  taux1M, setTaux1M,
                                  taux2M, setTaux2M
                                )}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Grid>
                  ))}


              </Grid>
          </Grid>

        <Grid container spacing={3} mt={-2}>
          <Grid item xs={6} md={6}>
            <Select fullWidth variant="standard" value={parelimftrv} defaultValue={parelimftrv}>
              <MenuItem value="0">0- Compter Férié Travaillé</MenuItem>
              <MenuItem value="1">1- Eliminer Férié Travaillé des Hres Sup. et Normale</MenuItem>
              <MenuItem value="2">2- Eliminer Férié Travaillé des Hres Sup. + Ajout H.N</MenuItem>
              <MenuItem value="3">3- Eliminer Férié Trv-Repos des Hres Sup. + Ajout H.N</MenuItem>
            </Select>
          </Grid>
          <Grid item xs={6} md={6}>
            <Select fullWidth variant="standard" value={parreptrv} defaultValue={parreptrv}>
              <MenuItem value="0">0- Ne pas gérer Repos Travaillés avec les heures normales</MenuItem>
              <MenuItem value="1">1- Gérer Repos Travaillés avec les heures normales</MenuItem>
              <MenuItem value="2">2- Ne pas gérer Dimanche Travaillés avec les heures normales</MenuItem>
              <MenuItem value="3">3- Ne pas gérer Samedi-Dimanche Travaillés avec les heures normales</MenuItem>
            </Select>
          </Grid>
        </Grid>
      </Box>
    </QueryClientProvider>
  );
};

export default HeureSupp;