import React from 'react';
import { Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import useGetEmpDepassMax from '../../hooks/employeHooks/useGetEmpDepassMax';
import EmpDepassMax from '../../models/EmpDepassMax';

const DepassMaxTable: React.FC = () => {
  const { t } = useTranslation();
  const { data: empdepass = [] } = useGetEmpDepassMax() as unknown as { data: EmpDepassMax[] };

  return (
    <Grid item xs={12}>
      <Typography fontWeight={'bold'} color={'primary'}>{t('dashboardWidgets.depassMax.title')}</Typography>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell><strong>{t('dashboardWidgets.depassMax.matricule')}</strong></TableCell>
              <TableCell><strong>{t('dashboardWidgets.depassMax.name')}</strong></TableCell>
              <TableCell><strong>{t('dashboardWidgets.depassMax.date')}</strong></TableCell>
              <TableCell><strong>{t('dashboardWidgets.depassMax.hours')}</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {empdepass.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ color: '#94a3b8', fontStyle: 'italic' }}>
                  {t('dashboardWidgets.depassMax.noData')}
                </TableCell>
              </TableRow>
            ) : (
              empdepass.map((emp: EmpDepassMax) => (
                <TableRow key={`${emp.empcod}-${emp.date}`}>
                  <TableCell>{emp.empmat}</TableCell>
                  <TableCell>{emp.emplib}</TableCell>
                  <TableCell>{new Date(emp.date).toLocaleDateString()}</TableCell>
                  <TableCell>{emp.heure.toFixed(2)} h</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Grid>
  );
};

export default DepassMaxTable;
