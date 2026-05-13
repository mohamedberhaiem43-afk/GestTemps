import { Box, Container } from "@mui/material"
import RubriqueForm from "./RubriqueForm"
import { RubriqueList } from "./RubriqueList"
import { useState } from "react"
import { Rubrique as RubriqueModel } from "../../../models/Rubrique"
import BreadcrumbNavigation from "../../helper/BreadcrumbNavigation"

function Rubrique() {
    const [editingRubrique, setEditingRubrique] = useState<RubriqueModel | null>(null);

    return (
        <Container style={{minWidth:'90vw',height:'90vh',marginTop:'-20px'}} >
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
    )
}

export default Rubrique