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
  IconButton,
} from "@mui/material";
import AddIcon from '@mui/icons-material/Add';
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

interface TrancheData {
  caltype: string;
  tranche1: number;
  taux1: number;
  tranche2: number;
  taux2: number;
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
    
    // États pour les tranches horaires (H) et mensuelles (M)
    const [tranchesH, setTranchesH] = useState<TrancheData[]>([
      { caltype: '', tranche1: 0, taux1: 0, tranche2: 0, taux2: 0 }
    ]);
    const [tranchesM, setTranchesM] = useState<TrancheData[]>([
      { caltype: '', tranche1: 0, taux1: 0, tranche2: 0, taux2: 0 }
    ]);

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

  // Convertir les tranches en format ParTranche
  const trancheDataList: ParTranche[] = [
    ...tranchesH.map((tranche, index) => ({
      partranche1: tranche.tranche1,
      partaux1: tranche.taux1,
      partranche2: tranche.tranche2,
      partaux2: tranche.taux2,
      soccod: sessionStorage.getItem("soccod") || '',
      ordre: index,
      caltype: tranche.caltype,
      empreg: "H",
    })),
    ...tranchesM.map((tranche, index) => ({
      partranche1: tranche.tranche1,
      partaux1: tranche.taux1,
      partranche2: tranche.tranche2,
      partaux2: tranche.taux2,
      soccod: sessionStorage.getItem("soccod") || '',
      ordre: index,
      caltype: tranche.caltype,
      empreg: "M",
    }))
  ];

  // Send list to parent or API
  onChange1?.(trancheDataList);

  // call parent's setter
  onChange?.(data); 
}, [
  hsuphebd, hsuphebdm,
  parcadre, parmaitrise, parexec, parscomplet,
  parelimftrv, parreptrv,
  tranchesH, tranchesM
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
    const regimeH = partranche.filter(p => p.empreg === 'H');
    const regimeM = partranche.filter(p => p.empreg === 'M');

    if (regimeH.length > 0) {
      const tranchesHData = regimeH.map(p => ({
        caltype: p.caltype || '',
        tranche1: p.partranche1 || 0,
        taux1: p.partaux1 || 0,
        tranche2: p.partranche2 || 0,
        taux2: p.partaux2 || 0,
      }));
      setTranchesH(tranchesHData.length > 0 ? tranchesHData : [{ caltype: '', tranche1: 0, taux1: 0, tranche2: 0, taux2: 0 }]);
    }

    if (regimeM.length > 0) {
      const tranchesMData = regimeM.map(p => ({
        caltype: p.caltype || '',
        tranche1: p.partranche1 || 0,
        taux1: p.partaux1 || 0,
        tranche2: p.partranche2 || 0,
        taux2: p.partaux2 || 0,
      }));
      setTranchesM(tranchesMData.length > 0 ? tranchesMData : [{ caltype: '', tranche1: 0, taux1: 0, tranche2: 0, taux2: 0 }]);
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

  // Fonctions pour ajouter de nouvelles lignes
  const addTrancheH = () => {
    setTranchesH([...tranchesH, { caltype: '', tranche1: 0, taux1: 0, tranche2: 0, taux2: 0 }]);
  };

  const addTrancheM = () => {
    setTranchesM([...tranchesM, { caltype: '', tranche1: 0, taux1: 0, tranche2: 0, taux2: 0 }]);
  };

  // Fonctions pour mettre à jour les tranches
  const updateTrancheH = (index: number, field: keyof TrancheData, value: string | number) => {
    const newTranches = [...tranchesH];
    if (field === 'caltype') {
      newTranches[index] = { ...newTranches[index], [field]: value as string };
    } else {
      newTranches[index] = { ...newTranches[index], [field]: value as number };
    }
    setTranchesH(newTranches);
  };

  const updateTrancheM = (index: number, field: keyof TrancheData, value: string | number) => {
    const newTranches = [...tranchesM];
    if (field === 'caltype') {
      newTranches[index] = { ...newTranches[index], [field]: value as string };
    } else {
      newTranches[index] = { ...newTranches[index], [field]: value as number };
    }
    setTranchesM(newTranches);
  };

 const renderTableRows = (
  trancheData: TrancheData[],
  updateFunction: (index: number, field: keyof TrancheData, value: string | number) => void,
  addFunction: () => void
) => {
  return (
    <>
      {trancheData.map((row, index) => (
        <TableRow key={index}>
          <TableCell>
            <Input
              sx={{ width: 80 }}
              value={row.caltype}
              onChange={(e) => updateFunction(index, 'caltype', e.target.value)}
            />
          </TableCell>
          <TableCell>
            <Input
              sx={{ width: 80 }}
              type="number"
              value={row.tranche1}
              onChange={(e) => updateFunction(index, 'tranche1', parseFloat(e.target.value) || 0)}
            />
          </TableCell>
          <TableCell>
            <Select
              fullWidth
              variant="standard"
              value={row.taux1}
              onChange={(e) => updateFunction(index, 'taux1', parseInt(e.target.value.toString()))}
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
              value={row.tranche2}
              onChange={(e) => updateFunction(index, 'tranche2', parseFloat(e.target.value) || 0)}
            />
          </TableCell>
          <TableCell>
            <Select
              fullWidth
              variant="standard"
              value={row.taux2}
              onChange={(e) => updateFunction(index, 'taux2', parseInt(e.target.value.toString()))}
            >
              {Taux.map((taux) => (
                <MenuItem key={taux} value={taux}>{taux}</MenuItem>
              ))}
            </Select>
          </TableCell>
        </TableRow>
      ))}
      <TableRow>
        <TableCell colSpan={5} align="center">
          <IconButton onClick={addFunction} color="primary">
            <AddIcon />
          </IconButton>
        </TableCell>
      </TableRow>
    </>
  );
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
                              ? renderTableRows(tranchesH, updateTrancheH, addTrancheH)
                              : renderTableRows(tranchesM, updateTrancheM, addTrancheM)
                            }
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