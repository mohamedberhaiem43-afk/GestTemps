import { Box } from '@mui/material'
import { EmployeeProvider } from '../Pointeuse/EtatPeriodique/EmployeeContext'
import BasicGrid from './ajoutEmploye/AjoutEmploye'
import ListEmploye from './ListeEmploye/ListeEmploye'
import BreadcrumbNavigation from '../helper/BreadcrumbNavigation'

function Employe() {

  return (
    <Box  overflow={'hidden'} mt={-5}>
      <BreadcrumbNavigation />
      <EmployeeProvider>
          <BasicGrid />
          <ListEmploye />
      </EmployeeProvider>
    </Box>
  )
}

export default Employe
