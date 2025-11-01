import { Box } from '@mui/material'
import { EmployeeProvider } from '../Pointeuse/EtatPeriodique/EmployeeContext'
import BasicGrid from './ajoutEmploye/AjoutEmploye'
import ListEmploye from './ListeEmploye/ListeEmploye'

function Employe() {

  return (
    <Box  overflow={'hidden'}>
      <EmployeeProvider>
          <BasicGrid />
          <ListEmploye />
      </EmployeeProvider>
    </Box>
  )
}

export default Employe