import { Box, Grid, Button } from '@mui/material';
import SelectInputComponent from '../../../SelectInputComponent/SelectInputComponent';
import InputComponent from '../../../Inputs/Input';
import useGetSiteLibs from '../../../../hooks/siteHooks/useGetSiteLibs';
import useGetServiceLibs from '../../../../hooks/serviceHooks/useGetServiceLibs';
import { useState } from 'react';
import useRenouvellementContrat from '../../../../hooks/contratHooks/useRenouvellementContrat';

export interface Filters {
  sitcod?: string;
  srvcod?: string;
  echdeb?: string;
  echfin?: string;
}

export interface NewContractData {
  startDate: string;
  endDate: string;
  monthNumber: number;
}

function FiltrageRenouvellement({ filters, setFilters }: { filters: Filters; setFilters: (filters: Filters) => void }) {
  const { sitcod = '', srvcod = '', echdeb = '', echfin = '' } = filters || {};
  const [newContractDate, setNewContractDate] = useState('');
  const [newContractEndDate, setNewContractEndDate] = useState('');
  const [newContractMonthNumber, setNewContractMonthNumber] = useState(0);

  const updateFilters = (key: keyof Filters, value: string) => {
    setFilters({ ...filters, [key]: value });
  };

  const { data: services = [] } = useGetServiceLibs();
  const { data: filiale = [] } = useGetSiteLibs();
  const mutation = useRenouvellementContrat();

  const handleCreateContract = () => {
    if (!newContractDate || !newContractEndDate || newContractMonthNumber <= 0) {
      alert('Veuillez remplir tous les champs du contrat correctement !');
      return;
    }

    const newContract: NewContractData = {
      startDate: newContractDate,
      endDate: newContractEndDate,
      monthNumber: newContractMonthNumber,
    };

    mutation.mutate(newContract, {
      onSuccess: () => {
        alert('Contrat créé avec succès !');
        setNewContractDate('');
        setNewContractEndDate('');
        setNewContractMonthNumber(0);
      },
      onError: () => {
        alert('Échec de la création du contrat. Veuillez réessayer.');
      },
    });
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Grid container spacing={1} width={'98vw'} display={'flex'} justifyContent={'space-between'} flexWrap={'wrap'}>
        <Grid item xs={1}>
          {filiale && (
            <SelectInputComponent
              label="Filiale"
              value={sitcod}
              setValue={(value: string) => updateFilters('sitcod', value)}
              maplist={filiale}
            />
          )}
        </Grid>
        <Grid item xs={2}>
          {services && (
            <SelectInputComponent
              label="Service"
              value={srvcod}
              setValue={(value: string) => updateFilters('srvcod', value)}
              maplist={services}
            />
          )}
        </Grid>
        <Grid item xs={1.5}>
          <InputComponent
            type="date"
            label="Echéance Début"
            value={echdeb}
            setValue={(value: string) => updateFilters('echdeb', value)}
          />
        </Grid>
        <Grid item xs={1.5}>
          <InputComponent
            type="date"
            label="Echéance Fin"
            value={echfin}
            setValue={(value: string) => updateFilters('echfin', value)}
          />
        </Grid>
        <Grid item xs={5}>
          <Box display={'flex'} justifyContent={'space-between'} alignItems={'center'}>
            <Grid item xs={4}>
              <InputComponent
                type="date"
                label="Date Début Contrat"
                value={newContractDate}
                setValue={setNewContractDate}
              />
            </Grid>
            <Grid item xs={3.5}>
              <InputComponent
                type="date"
                label="Date Fin Contrat"
                value={newContractEndDate}
                setValue={setNewContractEndDate}
              />
            </Grid>
            <Grid item xs={2}>
              <InputComponent
                type="number"
                label="Nb.Mois"
                value={newContractMonthNumber}
                setValue={(value: string) => setNewContractMonthNumber(Number(value))}
              />
            </Grid>
            <Grid item xs={2}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleCreateContract}
                fullWidth
              >
                Valider
              </Button>
            </Grid>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}

export default FiltrageRenouvellement;