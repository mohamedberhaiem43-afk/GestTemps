import { Box, Grid, Typography } from "@mui/material";
import SaisieRepos from "./SaisieRepos/SaisieRepos";
import FerierList from "./ReposList";
import { QueryClient, QueryClientProvider } from "react-query";
import { FerierProvider } from "../../helper/ReposContext";
import { Item } from "../../helper/Item/Item";

const queryClient = new QueryClient()
export default function Repos()
{
    return(
        <>
        <QueryClientProvider client={queryClient}>
         <Box sx={{ flexGrow: 1 }} height={'83vh'} mt={-2}>
            <Typography fontWeight={'bold'} variant="h6" component="div" gutterBottom color={'primary'} mb={2}>
                Jours Fériés et Repos
            </Typography>
                <Grid container>
                    <FerierProvider>
                        <Grid item xs={12}>
                            <Item>
                                <SaisieRepos />
                            </Item>
                        </Grid>
                        <Grid item xs={12} mt={3}>
                            <FerierList />
                        </Grid>
                    </FerierProvider>
            
                </Grid>
            </Box>
        </QueryClientProvider>
        </>
    )
}