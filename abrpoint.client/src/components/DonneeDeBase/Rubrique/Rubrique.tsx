import { Box, Container } from "@mui/material"
import RubriqueForm from "./RubriqueForm"
import { RubriqueList } from "./RubriqueList"
import { QueryClient, QueryClientProvider } from "react-query"
import { useState } from "react"
import { Rubrique as RubriqueModel } from "../../../models/Rubrique"
import BreadcrumbNavigation from "../../helper/BreadcrumbNavigation"

function Rubrique() {
    const queryClient = new QueryClient();
    const [editingRubrique, setEditingRubrique] = useState<RubriqueModel | null>(null);

    return (
        <QueryClientProvider client={queryClient}>
            <Container style={{minWidth:'90vw',height:'90vh',marginTop:'-50px'}} >
                <BreadcrumbNavigation />
                <Box>
                    <RubriqueForm 
                        editingRubrique={editingRubrique} 
                        setEditingRubrique={setEditingRubrique}
                    />
                </Box>
                <Box mt={5}>
                    <RubriqueList setEditingRubrique={setEditingRubrique} />
                </Box>
            </Container>
        </QueryClientProvider>
    )
}

export default Rubrique