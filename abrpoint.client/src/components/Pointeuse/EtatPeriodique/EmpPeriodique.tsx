import React, { useContext, useEffect, useState, useMemo } from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import { useTheme } from '@mui/material/styles';
import axios from 'axios';
import { EmployeeContext } from './EmployeeContext';
import './EmpPeriodique.css';
import { useDateRange } from './FilterContext';
import { useAuth } from '../../helper/AuthProvider';

type EmpRow = {
  empcod: string;
  emplib: string;
  nbJours: number;
  totalMinutes: number;
  totalRetards: number;
};
  // Memoized TableRow component to avoid re-renders unless row data changes
  type MemoizedTableRowProps = {
    row: EmpRow & { formattedTotalMinutes: string, formattedTotalRetards: string };
    handleRowClick: (empcod: string) => void;
    selectedRow: string;
    theme: any;
  };

export default function EmpPeriodique() {
  const theme = useTheme();
  const [rows, setRows] = useState<EmpRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRow, setSelectedRow] = useState('');
  const { setSelectedEmpMat } = useContext(EmployeeContext);
  const { dateRange } = useDateRange() as { dateRange: { dateDebut: Date; dateFin: Date; selectedFiliale: string; selectedRegime: string; selectedService: string } };


  const { soccod } = useAuth();
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const uticod = localStorage.getItem('Uticod');
    setLoading(true);
      const formatDate = (date: Date) => date.toISOString().split('T')[0]; // yyyy-MM-dd
      const formattedDebut = formatDate(dateRange.dateDebut)+"T00:00:00";
      const formattedFin = formatDate(dateRange.dateFin)+"T00:00:00";
    axios
      .get(`${import.meta.env.VITE_REACT_APP_API_URL}/Employes/get-emps/${soccod}/${dateRange.selectedFiliale}/${uticod}?empreg=${dateRange.selectedRegime}&service=${dateRange.selectedService}&debut=${formattedDebut}&fin=${formattedFin}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setRows(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [dateRange.selectedFiliale,dateRange.selectedRegime,dateRange.selectedService,dateRange.dateDebut,dateRange.dateFin]);

  const handleRowClick = (empmat:string) => {
    setSelectedRow(empmat);
    setSelectedEmpMat(empmat);
  };

  // Function to convert total minutes to hh:mm format
  const formatTotalMinutes = (totalMinutes: number) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const integerMinutes = Math.floor(minutes);
  const secondsFraction = ((minutes - integerMinutes) * 60).toFixed(0).padStart(2, '0');

  return `${String(hours).padStart(2, '0')}:${String(integerMinutes).padStart(2, '0')}.${secondsFraction}`;
};


  const formattedRows = useMemo(
    () =>
      Array.isArray(rows)
        ? rows
            .filter((row) => row && typeof row === 'object')
            .map((row) => ({
              ...row,
              formattedTotalMinutes: formatTotalMinutes(row.totalMinutes),
              formattedTotalRetards: formatTotalMinutes(row.totalRetards)
            }))
        : [],
    [rows]
  );
  


  const MemoizedTableRow: React.FC<MemoizedTableRowProps> = React.memo(({ row, handleRowClick, selectedRow, theme }) => (
    <TableRow
      key={row.empcod}
      onClick={() => handleRowClick(row.empcod)}
      sx={{
        cursor: 'pointer',
        backgroundColor: row.empcod === selectedRow ? theme.palette.action.selected : 'inherit',
        '&:last-child td, &:last-child th': { border: 0 },
      }}
    >
      <TableCell component="th" scope="row" sx={{ width: '80px' }}>
        {row.empcod}
      </TableCell>
      <TableCell>{row.emplib}</TableCell>
      <TableCell>{row.nbJours}</TableCell>
      <TableCell>{row.formattedTotalMinutes}</TableCell>
      <TableCell>{row.formattedTotalRetards}</TableCell>
    </TableRow>
  ));

  return (
    <>
      {loading ? (
        <div>Loading...</div> // Display a loading message or spinner here
      ) : (
        <TableContainer
          component={Paper}
          className="thin-scrollbar" // Apply the custom class here
          sx={{ maxHeight: 380 }}
        >
          <Table stickyHeader sx={{ minWidth: 400 }} size="small" aria-label="a dense table">
            <TableHead>
              <TableRow>
                <TableCell sx={{ maxWidth: '90px', 
                  fontSize: '16px', 
                  fontWeight: 400, 
                  fontFamily: "'San Francisco', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif",
                  color: '#6e6e73' }}>Matricule</TableCell>
                              <TableCell sx={{ maxWidth: '90px', 
                  fontSize: '16px', 
                  fontWeight: 400, 
                  fontFamily: "'San Francisco', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif",
                  color: '#6e6e73'}}>Employé</TableCell>
                              <TableCell sx={{ maxWidth: '80px', 
                  fontSize: '16px', 
                  fontWeight: 400, 
                  fontFamily: "'San Francisco', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif",
                  color: '#6e6e73', }}>Nb. Jours</TableCell>
                              <TableCell sx={{ maxWidth: '80px', 
                  fontSize: '16px', 
                  fontWeight: 400, 
                  fontFamily: "'San Francisco', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif",
                  color: '#6e6e73', }}>Total heures</TableCell>
                              <TableCell sx={{ maxWidth: '80px', 
                  fontSize: '16px', 
                  fontWeight: 400, 
                  fontFamily: "'San Francisco', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif",
                  color: '#6e6e73' }}>Total Retards</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {formattedRows.map((row) => (
                <MemoizedTableRow
                  key={row.empcod}
                  row={row}
                  handleRowClick={handleRowClick}
                  selectedRow={selectedRow}
                  theme={theme}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </>
  );
}
