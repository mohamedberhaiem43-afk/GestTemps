import { Checkbox, FormControlLabel, Grid, IconButton, Typography } from "@mui/material";
import InputComponent from "../../Inputs/Input";
import SaveIcon from '@mui/icons-material/Save';
import EditIcon from '@mui/icons-material/Edit';
import { useState } from "react";
export default function FonctionForm() {
    const [fonctionData, setFonctionData] = useState({
        foncod: '',
        soccod: '',
        fonlib: '',
        fontype: '',
        fonpqual: '',
        fonpchoix: '',
    });

   
    const [selectedSection] = useState<any>(null);



  return (
    <>
    
    <Grid container spacing={1} className="fonction-form-container">
                    <Grid item xs={6} sm={3} md={2}>
                        <InputComponent type='text' label='Code' value={fonctionData.foncod} setValue={(val: string) => setFonctionData({ ...fonctionData, foncod: val })} />
                    </Grid>
                    <Grid item xs={6} sm={6} md={2}>
                        <InputComponent type='text' label='Fonction' value={fonctionData.fonlib} setValue={(val: string) => setFonctionData({ ...fonctionData, fonlib: val })} />
                    </Grid>

                    {/* <Grid item xs={12} sm={6} md={2}>
                        <SelectInputComponent label="Type" value={fonctionData.fontype} setValue={(value: string) => handleTypeChange(value)} maplist={fonctype} />
                    </Grid> */}
                    <Grid item xs={12} sm={2.2}>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={fonctionData.fonpqual === 'Y'}
                                    onChange={() => setFonctionData({ ...fonctionData, fonpqual: fonctionData.fonpqual === 'Y' ? 'N' : 'Y' })}
                                />
                            }
                            label={<Typography fontSize="small">Prime de Qualité</Typography>}
                        />
                    </Grid>
                    <Grid item xs={12} sm={2}>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={fonctionData.fonpchoix === 'Y'}
                                    onChange={() => setFonctionData({ ...fonctionData, fonpchoix: fonctionData.fonpchoix === 'Y' ? 'N' : 'Y' })}
                                />
                            }
                            label={<Typography fontSize="small">Prime de Choix</Typography>}
                        />
                    </Grid>
                    <Grid item xs={12}>
                        <Grid container spacing={2} justifyContent="flex-start">
                            <Grid item>
                                <IconButton color="primary" >
                                    <SaveIcon />
                                </IconButton>
                            </Grid>
                            {selectedSection && (
                                <>
                                    <Grid item>
                                    <IconButton color="warning" >
                                            <EditIcon />
                                        </IconButton>
                                    </Grid>
                                </>
                            )}
                        </Grid>
                    </Grid>
                </Grid>

    </>
  )
}
