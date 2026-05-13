import { Box, Grid } from "@mui/material";
import SaisieRepos from "./SaisieRepos/SaisieRepos";
import FerierList from "./ReposList";
import { FerierProvider } from "../../helper/ReposContext";
import { Item } from "../../helper/Item/Item";
import BreadcrumbNavigation from "../../helper/BreadcrumbNavigation";
export default function Repos()
{
    return(
        <>
        <Box sx={{ flexGrow: 1 }} height={'90vh'} >
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
        </>
    )
}