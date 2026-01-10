import { Box, Grid } from "@mui/material";
import SaisieRepos from "./SaisieRepos/SaisieRepos";
import FerierList from "./ReposList";
import { QueryClient, QueryClientProvider } from "react-query";
import { FerierProvider } from "../../helper/ReposContext";
import { Item } from "../../helper/Item/Item";
import BreadcrumbNavigation from "../../helper/BreadcrumbNavigation";

const queryClient = new QueryClient()
export default function Repos()
{
    return(
        <>
        <QueryClientProvider client={queryClient}>
         <Box sx={{ flexGrow: 1 }} height={'83vh'} mt={-2}>
            <BreadcrumbNavigation />
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