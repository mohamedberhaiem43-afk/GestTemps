import { Container, Grid, Button, Typography, Box, Radio, FormControlLabel } from "@mui/material";
import AccompteList from "./AccompteList";
import { useState } from "react";
import InputComponent from "../../Inputs/Input";
import RadioGroupComponent from "../../RadioGroupComponent/RadioGroupComponent";
import { QueryClient, QueryClientProvider } from "react-query";
import { t } from "i18next";

export default function Accompte() {
    const [month, setMonth] = useState("");
    const [year, setYear] = useState("");
    const [niveau, setNiveau] = useState("0");
    const [filters, setFilters] = useState({ month: "", year: "",niveau });

    const handleSearch = () => {
        setFilters({ month, year,niveau });
    };
    const queryClient = new QueryClient();
    return (
        <QueryClientProvider client={queryClient}>
            <Container sx={{ml:3, minWidth: '93vw',height:'80vh' }}>
            <Typography variant="h5" color={'primary'} fontWeight={'bold'} gutterBottom mt={-2} mb={2}>
                Accompte sur salaire
            </Typography>

            <Box display="flex" gap={2} mb={3}>
                <Grid container sx={{ width: '100%' }}>
                    <InputComponent type="text" label={t('common.month')} value={month} setValue={setMonth} />
                </Grid>
                <Grid container sx={{ width: '100%' }}>
                    <InputComponent type="text" label={t('common.year')} value={year} setValue={setYear} />
                </Grid>  
                <Grid container sx={{ width: '100%',mt: 1 }}>
                    <RadioGroupComponent value={niveau} setValue={setNiveau} >
                        <FormControlLabel value="0" control={<Radio size="small" />} label="1er accompte" />
                        <FormControlLabel value="1" control={<Radio size="small" />} label="2éme accompte" />

                    </RadioGroupComponent>
                </Grid>  
                <Button
                    variant="contained"
                    color="primary"
                    onClick={handleSearch}
                    sx={{ whiteSpace: "nowrap", minWidth: '150px' }}
                >
                    Rechercher
                </Button>
            </Box>

            {/* Results Table */}
            <AccompteList month={filters.month} year={filters.year} niveau = {filters.niveau} />
        </Container>
        </QueryClientProvider>
    );
}
