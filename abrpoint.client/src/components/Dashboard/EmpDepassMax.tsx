import React from 'react';
import { Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Typography } from '@mui/material';
import useGetEmpDepassMax from '../../hooks/employeHooks/useGetEmpDepassMax';
import EmpDepassMax from '../../models/EmpDepassMax';

const DepassMaxTable: React.FC = () => {
  const { data:empdepass = [] } = useGetEmpDepassMax() as unknown as { data: EmpDepassMax[] };

  return (
    <Grid item xs={12}>
        <Typography fontWeight={'bold'} color={'primary'}>Employés dépassant 12h dans J-1</Typography>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell><strong>Matricule</strong></TableCell>
              <TableCell><strong>Nom</strong></TableCell>
              <TableCell><strong>Date</strong></TableCell>
              <TableCell><strong>Heures</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {empdepass.map((emp:EmpDepassMax) => (
              <TableRow key={`${emp.empcod}-${emp.date}`}>
                <TableCell>{emp.empmat}</TableCell>
                <TableCell>{emp.emplib}</TableCell>
                <TableCell>{new Date(emp.date).toLocaleDateString()}</TableCell>
                <TableCell>{emp.heure.toFixed(2)} h</TableCell>
            </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Grid>
  );
};

export default DepassMaxTable;
