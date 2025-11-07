import React, { useState } from 'react';
import { FormControl, InputLabel, Input, Button, Checkbox, FormControlLabel, Grid, Typography, Box} from '@mui/material';
import './Filiale.css'
import { FilialeList } from './FilialeList';
import { QueryClient, QueryClientProvider } from 'react-query';
import useAddSite from '../../../hooks/siteHooks/useAddSite';

export function Filiale() {
    const [filialData, setFilialeData] = useState({
        sitcod: '',
        soccod: sessionStorage.getItem('soccod')||'',
        sitlib: '',
        sitadr: '',
        sittel: '',
        sitfax: '',
        sitemail: '',
        sitmois: 0,
        sitconge: 0,
        sitcongem: 0,
        sitsoc: '',
        sitpaie: '',
        sitsanch: '0',
        sitsancm: '0',
    });

    const [selectedsection] = useState<any>(null);
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;

        setFilialeData((prevData) => ({
            ...prevData,
            [id]: value,
        }));
    };
    const {mutate} = useAddSite();
    const refreshForm = () => {
        setFilialeData({
            sitcod: '',
            soccod: sessionStorage.getItem('soccod') || '',
            sitlib: '',
            sitadr: '',
            sittel: '',
            sitfax: '',
            sitemail: '',
            sitmois: 0,
            sitconge: 0,
            sitcongem: 0,
            sitsoc: '',
            sitpaie: '',
            sitsanch: '0',
            sitsancm: '0',
        })
    }
    const saveSite = () => {
    mutate(filialData, {
        onSuccess: () => {
            alert("Filiale enregistrée avec succès !");
            setFilialeData({
                sitcod: '',
                soccod: '',
                sitlib: '',
                sitadr: '',
                sittel: '',
                sitfax: '',
                sitemail: '',
                sitmois: 0,
                sitconge: 0,
                sitcongem: 0,
                sitsoc: '',
                sitpaie: '',
                sitsanch: '0',
                sitsancm: '0',
            });
        },
        onError: (error: any) => {
            console.log(filialData);
            console.error("Erreur lors de l'enregistrement :", error);
            alert("Erreur lors de l'enregistrement !");
        },
    });
};

    const queryClient = new QueryClient();
    return (
        <>
        <QueryClientProvider client={queryClient}>
            <Box height={'90vh'} width={'95vw'}>
            <Typography gutterBottom variant='h6' color={'primary'} fontWeight={'bold'}>Gestion des Filiales</Typography>
                <Box mb={2}>
                    <Grid container item >
                        <Grid item xs={2}>
                            <FormControl >
                                <InputLabel htmlFor="sitcod">Code Filiale</InputLabel>
                                <Input id="sitcod" value={filialData.sitcod} onChange={handleInputChange} aria-describedby="my-helper-text" />
                            </FormControl>
                        </Grid>
                            
                        {/* <Grid item xs={2}>
                            <FormControl >
                                <InputLabel htmlFor="">Code Grh</InputLabel>
                                <Input id="" value={filialData.sitlib} onChange={handleInputChange} aria-describedby="my-helper-text" />
                            </FormControl>
                            
                        </Grid> */}

                        <Grid item xs={2}>
                            <FormControl >
                                <InputLabel htmlFor="sitlib">Nom Filiale</InputLabel>
                                <Input id="sitlib" value={filialData.sitlib} onChange={handleInputChange} aria-describedby="my-helper-text" />
                            </FormControl>
                        </Grid>

                        <Grid item xs={2}>
                            <FormControl >
                                <InputLabel htmlFor="sittel" >Tél</InputLabel>
                                <Input id="sittel" value={filialData.sittel} onChange={handleInputChange} aria-describedby="my-helper-text" />
                            </FormControl>
                        </Grid>
                        <Grid item xs={2}>
                        <FormControl >
                            <InputLabel htmlFor="chem">Chemin Export</InputLabel>
                            <Input onChange={handleInputChange} aria-describedby="my-helper-text" />
                        </FormControl>
                        </Grid>
                        
                        {/* <Grid item xs={2}>
                        <FormControl >
                            <InputLabel htmlFor="nbfiches">Nb.fiches</InputLabel>
                            <Input   onChange={handleInputChange} aria-describedby="my-helper-text" />
                        </FormControl>
                        </Grid> */}
                        <Grid item xs={2}>
                        <FormControl >
                            <InputLabel htmlFor="sitadr">Adresse</InputLabel>
                            <Input id="sitadr" value={filialData.sitadr} onChange={handleInputChange} aria-describedby="my-helper-text" />
                        </FormControl>
                        </Grid>
                        <Grid item xs={1} mt={2} >
                            <FormControlLabel control={<Checkbox  size='small' />} label="Site Principale"  />                            
                        </Grid>
                        <Grid item xs={2} mt={2} >
                            <FormControlLabel control={<Checkbox size='small' />} label="Exonoré de TFP-FOP" />
                        </Grid>
                        <Button variant="outlined" onClick={saveSite}  style={{marginTop:'1%'}}>Enregistrer</Button>
                        {selectedsection && (
                            <>
                                <Button variant="outlined" color="warning">Editer</Button>
                                <Button variant="outlined" color="error">Supprimer</Button>
                            </>
                        )}
                    </Grid>
                    <Grid item>
                        <Button onClick={refreshForm} variant="outlined" >Nouveau</Button>
                    </Grid>
                </Box>
                <Grid  mt={5}>
                    <FilialeList />
                </Grid>
            </Box>
        </QueryClientProvider>
        </>
    );
}
