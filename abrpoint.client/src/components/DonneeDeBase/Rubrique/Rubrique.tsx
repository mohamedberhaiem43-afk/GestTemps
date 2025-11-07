import { Box, Container } from "@mui/material"
import RubriqueForm from "./RubriqueForm"
import { RubriqueList } from "./RubriqueList"
import { QueryClient, QueryClientProvider } from "react-query"

function Rubrique() {
    const queryClient = new QueryClient();
  return (
    <QueryClientProvider client={queryClient}>
        <Container style={{minWidth:'90vw',marginLeft:'5%',minHeight:'80vh'}}>
            <Box >
                <RubriqueForm />
            </Box>
            <Box mt={5}>
                <RubriqueList />
            </Box>
        </Container>
    </QueryClientProvider>
  )
}

export default Rubrique