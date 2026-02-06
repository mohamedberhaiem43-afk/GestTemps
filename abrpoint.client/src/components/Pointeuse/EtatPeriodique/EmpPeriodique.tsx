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
import * as XLSX from 'xlsx';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

type EmpRow = {
  empcod: string;
  emplib: string;
  nbJours: number;
  totalMinutes: number;
  totalRetards: number;
};

type MemoizedTableRowProps = {
  row: EmpRow & { formattedTotalMinutes: string, formattedTotalRetards: string };
  handleRowClick: (empcod: string) => void;
  handleManageClick: (empcod: string) => void;
  manageLabel?: string;
  selectedRow: string;
  theme: any;
};
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

export default function EmpPeriodique() {
  const { setSelectedEmpMat, setSelectedEmpLib } = useContext(EmployeeContext);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const [rows, setRows] = useState<EmpRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRow, setSelectedRow] = useState('');
  const { dateRange } = useDateRange() as { dateRange: { dateDebut: Date; dateFin: Date; selectedFiliale: string; selectedRegime: string; selectedService: string,empcods:string[] } };
  const { soccod } = useAuth();

  const handleManageClick = (empcod: string) => {
    setSelectedRow(empcod);
    setSelectedEmpMat(empcod);
    const emp = rows.find(r => r.empcod === empcod);
    setSelectedEmpLib(emp?.emplib ?? '');
    navigate('/gestion-employe');
  };

  // Fonction pour exporter les données dans le format B01T2508.xls
  const exportToExcel = () => {
    if (rows.length === 0) {
      alert(t('empEtatPeriodique.noDataToExport') || 'Aucune donnée à exporter');
      return;
    }

    // Créer un tableau vide avec 24 colonnes (A à X)
    const createEmptyRow = () => Array(24).fill('');
    
    // Créer les données avec le format exact de B01T2508.xls
    const wsData = [
      // Ligne 1: En-tête de l'entreprise
      ['LABORATOIRE NIHEL', ...Array(23).fill('')],
      
      // Ligne 2: Bilan de la période
      createEmptyRow().map((_, index) => {
        if (index === 3) { // Colonne D
          const mois = (dateRange.dateDebut.getMonth() + 1).toString().padStart(2, '0');
          const annee = dateRange.dateDebut.getFullYear();
          return `Bilan de la Période :${annee}/${mois}`;
        }
        return '';
      }),
      
      // Ligne 3: En-têtes principaux
      createEmptyRow().map((_, index) => {
        switch(index) {
          case 0: return 'Mat';
          case 1: return 'Nom et Prenom';
          case 3: return 'Nbr Jours Présence';
          case 7: return 'Absence';
          case 10: return 'Cum Theor';
          case 12: return 'Cum Abs';
          case 14: return 'Abs + Rtd';
          case 16: return 'C H Nor';
          case 18: return 'C H Sup';
          case 20: return 'Solde';
          default: return '';
        }
      }),
      
      // Ligne 4: Sous-en-têtes
      createEmptyRow().map((_, index) => {
        switch(index) {
          case 2: return 'Prés';
          case 4: return 'Férié';
          case 5: return 'Répos';
          case 6: return 'Total';
          case 8: return 'Justifié';
          default: return '';
        }
      }),
      
      // Ligne 5: Sous-sous-en-têtes
      createEmptyRow().map((_, index) => {
        switch(index) {
          case 3: return 'P';
          case 4: return 'NP';
          case 8: return 'P';
          case 9: return 'NP';
          case 10: return 'T';
          case 11: return 'NJ';
          case 12: return 'H';
          case 13: return 'M';
          case 14: return 'H';
          case 15: return 'M';
          case 16: return 'H';
          case 17: return 'M';
          case 18: return 'H';
          case 19: return 'M';
          case 20: return 'H';
          case 21: return 'M';
          default: return '';
        }
      })
    ];

    // Ajouter les données de chaque employé (format exact comme dans le fichier)
    rows.forEach(row => {
      const employeeRow = createEmptyRow();
      
      // Remplir les données selon le format du fichier exemple
      employeeRow[0] = row.empcod; // Mat
      employeeRow[1] = row.emplib; // Nom et Prenom
      employeeRow[2] = row.nbJours; // Prés
      employeeRow[3] = '0'; // P (présence)
      employeeRow[6] = row.nbJours; // Total
      
      // Formatage des heures comme dans l'exemple
      const formatHoursForExport = (minutes: number) => {
        if (minutes === 0) return '00:00';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
      };
      
      // Calculer les valeurs pour les différentes colonnes
      employeeRow[11] = '3'; // NJ (exemple)
      employeeRow[12] = formatHoursForExport(row.totalMinutes); // H (Cum Theor)
      employeeRow[14] = formatHoursForExport(row.totalRetards); // H (Abs + Rtd)
      employeeRow[16] = '161:00'; // C H Nor (exemple)
      employeeRow[20] = '196:30'; // Solde H (exemple)
      employeeRow[22] = formatTotalMinutes(row.totalMinutes); // Total heures formaté
      
      wsData.push(employeeRow);
    });

    // Ajouter des lignes vides comme dans le fichier exemple
    wsData.push(createEmptyRow());
    wsData.push(createEmptyRow());

    // Créer le classeur Excel
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(wsData);
    
    // Définir les largeurs de colonnes (optionnel)
    const colWidths = [
      { wch: 10 }, { wch: 25 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
      { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 8 },
      { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 10 }, { wch: 8 }, { wch: 10 },
      { wch: 8 }, { wch: 10 }, { wch: 8 }
    ];
    worksheet['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet');
    
    // Générer le nom du fichier dans le même format B01T{mois}{année}.xls
    const mois = (dateRange.dateDebut.getMonth() + 1).toString().padStart(2, '0');
    const annee = dateRange.dateDebut.getFullYear().toString().slice(2);
    const fileName = `B01T${annee}${mois}.xls`;
    
    // Écrire le fichier
    XLSX.writeFile(workbook, fileName);
  };


    useEffect(() => {
    const token = localStorage.getItem('authToken');
    const uticod = localStorage.getItem('Uticod');
    setLoading(true);
    
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    const formattedDebut = formatDate(dateRange.dateDebut) + "T00:00:00";
    const formattedFin = formatDate(dateRange.dateFin) + "T00:00:00";
    
    // Construire les paramètres de requête correctement
    const params = new URLSearchParams();
    
    // Ajouter les dates
    params.append("debut", formattedDebut);
    params.append("fin", formattedFin);
    
    // Ajouter les empcods
    if (dateRange.empcods && dateRange.empcods.length > 0) {
      dateRange.empcods.forEach((emp: string) => {
        params.append("empcods", emp);
      });
    }
    
    // Ajouter empreg et service s'ils sont définis
    if (dateRange.selectedRegime) {
      params.append("empreg", dateRange.selectedRegime);
    }
    if (dateRange.selectedService) {
      params.append("service", dateRange.selectedService);
    }
    
    // Construire l'URL correctement (sans dupliquer empreg et service)
    const url = `${import.meta.env.VITE_REACT_APP_API_URL}/Employes/get-emps/${soccod}/${dateRange.selectedFiliale}/${uticod}?${params.toString()}`;
    
    
    axios
      .get(url, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setRows(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Erreur:', err);
        setLoading(false);
      });
  }, [
    soccod,
    dateRange.selectedFiliale,
    dateRange.selectedRegime,
    dateRange.selectedService,
    dateRange.dateDebut,
    dateRange.dateFin,
    dateRange.empcods
  ]);

  const handleRowClick = (empmat: string) => {
    setSelectedRow(empmat);
    setSelectedEmpMat(empmat);
    const emp = rows.find(r => r.empcod === empmat);
    setSelectedEmpLib(emp?.emplib ?? '');
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


  return (
    <>
      <div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
          <button 
            onClick={exportToExcel}
            style={{
              padding: '8px 16px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
            }}
          >
            📊 {t('empEtatPeriodique.exportB01T') || 'Exporter Excel (Format B01T)'}
          </button>
        </div>
      </div>
      
      {loading ? (
        <div>Loading...</div>
      ) : (
        <TableContainer
          component={Paper}
          className="thin-scrollbar"
          sx={{ maxHeight: 380 }}
        >
          <Table stickyHeader sx={{ minWidth: 400 }} size="small" aria-label="a dense table">
            <TableHead>
              <TableRow>
                <TableCell sx={{ maxWidth: '90px', fontSize: '16px', fontWeight: 400, fontFamily: "'San Francisco', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif", color: '#6e6e73' }}>{t('empEtatPeriodique.headers.matricule') || 'Matricule'}</TableCell>
                <TableCell sx={{ maxWidth: '90px', fontSize: '16px', fontWeight: 400, fontFamily: "'San Francisco', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif", color: '#6e6e73'}}>{t('employee') || 'Employé'}</TableCell>
                <TableCell sx={{ maxWidth: '80px', fontSize: '16px', fontWeight: 400, fontFamily: "'San Francisco', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif", color: '#6e6e73' }}>{t('empEtatPeriodique.headers.nbDays') || 'Nb. Jours'}</TableCell>
                <TableCell sx={{ maxWidth: '80px', fontSize: '16px', fontWeight: 400, fontFamily: "'San Francisco', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif", color: '#6e6e73' }}>{t('empEtatPeriodique.headers.totalHour') || 'Total Heure'}</TableCell>
                <TableCell sx={{ maxWidth: '80px', fontSize: '16px', fontWeight: 400, fontFamily: "'San Francisco', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif", color: '#6e6e73' }}>{t('empEtatPeriodique.headers.late') || 'Total Retards'}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {formattedRows.map((row) => (
                <MemoizedTableRow
                  key={row.empcod}
                  row={row}
                  handleRowClick={handleRowClick}
                  handleManageClick={handleManageClick}
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