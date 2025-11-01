import  { useState } from 'react';
import { Button, Box, Grid, Snackbar, Alert } from '@mui/material';
import "./Societe.css";
import InputComponent from '../../Inputs/Input';
import { Save } from '@mui/icons-material';
import useAddSociete from '../../../hooks/societeHooks/useAddSociete';
import useGetSocietes from '../../../hooks/societeHooks/useGetSocietes';
import { Societe } from '../../../models/Societe';

export function SaisieSociete() {
    const [societeData, setSocieteData] = useState<Societe>({
        soccod: '',
        soclib: '',
        socresp: '',
        socadr: '',
        soctel: '',
        socfax: '',
        socemail: '',
        socccb: '',
        soctva: '',
        soctva1: '',
        soctva2: '',
        soctva3: '',
        soctva000: '000',
        socreg: 0,
        socmois: 0.0,
        soctype: '',
        socpresence: '',
        sochsup: '',
        socmere: '',
        socsmig: '',
        soclibar: '',
        socadrar: '',
        socrespar: ''
    });
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('error');
    const { mutate: addSociete, isLoading } = useAddSociete();
    const{refetch} = useGetSocietes();
    
    
    const handleSnackbarClose = () => {
        setSnackbarOpen(false);
      };
    const handleAddSociete = () => {
        setSnackbarOpen(true);
        // Basic Validation
        if (!societeData.soccod || !societeData.soclib) {
            setSnackbarMessage('Code and Libellé are required!');
            setSnackbarSeverity('error')
            return;
        }

      
        // Call addSociete mutation
        addSociete(societeData, {
            onSuccess: () => {
                refetch();
                setSnackbarMessage('Societe added successfully!');
                setSnackbarSeverity('success');
                setSocieteData({
                    soccod: '',
                    soclib: '',
                    socresp: '',
                    socadr: '',
                    soctel: '',
                    socfax: '',
                    socemail: '',
                    socccb: '',
                    soctva: '',
                    soctva1: '',
                    soctva2: '',
                    soctva3: '',
                    soctva000: '000',
                    socreg: 0,
                    socmois: 0,
                    soctype: '',
                    socpresence: '',
                    sochsup: '',
                    socmere: '',
                    socsmig: '',
                    soclibar: '',
                    socadrar: '',
                    socrespar: ''
                });
            },
            onError: () => {
                setSnackbarMessage( 'Failed to add Societe. Please try again.');
                setSnackbarSeverity('error')
            },
        });
    };
    return (
        <>
                <Box>
                    <Box component={'form'}>
                        <Grid container spacing={2}>
                            <Grid item xs={0.7} md={6}>
                                <InputComponent label="Code" type="text" value={societeData.soccod} setValue={(value:any) => setSocieteData({ ...societeData, soccod: value })} />
                            </Grid>
                            <Grid item xs={1.5} md={6}>
                                <InputComponent label="Société Mére" type="text" value={societeData.socmere} setValue={(value:any) => setSocieteData({ ...societeData, socmere: value })} />
                            </Grid>
                            <Grid item xs={1.5} md={6}>
                                <InputComponent label="Libellé" type="text" value={societeData.soclib} setValue={(value:any) => setSocieteData({ ...societeData, soclib: value })} />
                            </Grid>
                            <Grid item xs={1.5} md={6}>
                                <InputComponent label="Adresse" type="text" value={societeData.socadr} setValue={(value:any) => setSocieteData({ ...societeData, socadr: value })} />
                            </Grid>
                            <Grid item xs={1.5} md={6}>
                                <InputComponent label="Tél" type="text" value={societeData.soctel} setValue={(value:any) => setSocieteData({ ...societeData, soctel: value })} />
                            </Grid>
                            <Grid item xs={1.5} md={6}>
                                <InputComponent label="Fax" type="text" value={societeData.socfax} setValue={(value:any) => setSocieteData({ ...societeData, socfax: value })} />
                            </Grid>
                            <Grid item xs={1.5} md={6}>
                                <InputComponent label="E-Mail" type="email" value={societeData.socemail} setValue={(value:any) => setSocieteData({ ...societeData, socemail: value })} />
                            </Grid>
                            <Grid item xs={1.5} md={6}>
                                <InputComponent label="Responsable" type="text" value={societeData.socresp} setValue={(value:any) => setSocieteData({ ...societeData, socresp: value })} />
                            </Grid>
                            <Grid item xs={1} md={6}>
                                <InputComponent label="Régime" type="number" value={societeData.socreg.toString()} setValue={(value:any) => setSocieteData({ ...societeData, socreg: parseInt(value, 10) || 0 })} />
                            </Grid>
                            <Grid item xs={1.5} md={6}>
                                <InputComponent label="Valeur SMIG" type="text" value={societeData.socsmig} setValue={(value:any) => setSocieteData({ ...societeData, socsmig: value })} />
                            </Grid>
                            <Grid item xs={2} md={6}>
                                <InputComponent label="Nb. Heures par Mois" type="number" value={societeData.socmois}  setValue={(value:any) => setSocieteData({ ...societeData, socmois: value })} />
                            </Grid>
                            <Grid item xs={1} md={6}>
                                <InputComponent label="N.CCB" type="text" value={societeData.socccb} setValue={(value:any) => setSocieteData({ ...societeData, socccb: value })} />
                            </Grid>
                            <Grid item xs={1} md={6}>
                                <InputComponent label="Code TVA" type="text" value={societeData.soctva} setValue={(value:any) => setSocieteData({ ...societeData, soctva: value })} />
                            </Grid>
                            <Grid item xs={1} md={6}>
                                <InputComponent label="Code TVA 1" type="text" value={societeData.soctva1} setValue={(value:any) => setSocieteData({ ...societeData, soctva1: value })} />
                            </Grid>
                            <Grid item xs={1} md={6}>
                                <InputComponent label="Code TVA 2" type="text" value={societeData.soctva2} setValue={(value:any) => setSocieteData({ ...societeData, soctva2: value })} />
                            </Grid>
                            <Grid item xs={1} md={6}>
                                <InputComponent label="Code TVA 3" type="text" value={societeData.soctva3} setValue={(value:any) => setSocieteData({ ...societeData, soctva3: value })} />
                            </Grid>
                            <Grid item xs={1.3} md={6}>
                                <InputComponent label="Code TVA 000" type="text" value={societeData.soctva000} setValue={(value:any) => setSocieteData({ ...societeData, soctva000: value })} readOnly />
                            </Grid>
                        </Grid>
                        <Box mt={4}>
                        <Button 
                                variant="outlined" 
                                startIcon={<Save />} 
                                onClick={handleAddSociete}
                                disabled={isLoading}
                            >
                                {isLoading ? "Saving..." : "Save"}
                        </Button>
                        </Box>
                    </Box>
                     <Snackbar
                            open={snackbarOpen}
                            autoHideDuration={6000}
                            onClose={handleSnackbarClose}
                          >
                            <Alert onClose={handleSnackbarClose} severity={snackbarSeverity}>
                              {snackbarMessage}
                            </Alert>
                          </Snackbar>
                </Box>
        </>
    );
}
