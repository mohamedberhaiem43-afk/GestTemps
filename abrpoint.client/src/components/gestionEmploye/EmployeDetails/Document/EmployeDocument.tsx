import { Grid, TextField } from "@mui/material";

export default function EmployeDocument()
{
    return(
        <>
                    <Grid item xs={4}>
                        <TextField
                            fullWidth
                            size="small"
                            label="Type Contrat"
                            variant="outlined"
                            name="typecontrat"
                            // value={formData.nomPrenom}
                            // onChange={handleChange}
                            required
                        />
                    </Grid>
                    <Grid item xs={4}>
                        <TextField
                            fullWidth
                            size="small"
                            label="Modèle Contrat"
                            variant="outlined"
                            name="modelecontrat"
                            // value={formData.nomPrenom}
                            // onChange={handleChange}
                            required
                        />
                    </Grid>
                  
        </>
    )
}