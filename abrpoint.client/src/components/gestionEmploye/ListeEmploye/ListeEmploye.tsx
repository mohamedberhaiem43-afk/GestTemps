import React, { useContext, useEffect, useMemo, useState} from 'react';
import {
  type MRT_ColumnDef,
} from 'material-react-table';
import {
  Box,
  Button,
  CircularProgress,
  Grid,
} from '@mui/material';
import { jsPDF } from 'jspdf';
import './ListeEmploye.css';
import useGetAllEmployees from '../../../hooks/employeHooks/useGetAllEmployees';
import getDatePart from '../../helper/TimeConverter/ExtractDateOnly';
import DataList from '../../lists/list';
import TableEtat from '../../lists/TableEtat';
import * as XLSX from 'xlsx';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import EmployeService from '../../../services/EmployeService/EmployeService';
import Employe from '../../../models/Employe';
import dayjs from 'dayjs';
import { EmployeeContext } from '../../Pointeuse/EtatPeriodique/EmployeeContext';
import EmpHoraire from '../../../models/EmpHoraire';
import EmpHoraireService from '../../../services/EmployeService/EmpHoraireService';
import EmployeReportService from '../../../services/EmployeService/EmployeReportService';

const ListEmploye = () => {
  const soccod = sessionStorage.getItem("soccod");
  const uticod = localStorage.getItem("Uticod");
  const{ selectedEmpMat, setSelectedEmpMat,setSelectedEmp } = useContext(EmployeeContext);
  const {data = [],isLoading,refetch} = useGetAllEmployees(soccod,uticod);
  const [empHoraires, setEmpHoraires] = useState<EmpHoraire[]|undefined>([]);
  useEffect(() => {
      EmployeService.getWithParams(`get-employe/${soccod}/${selectedEmpMat}`)
        .then((res) => {
          const formatted = {
            ...res,
            empemb: res.empemb,
            empsort: res.empsort,
            empretraite: res.empretraite,
            empdcin: res.empdcin,
            empoptim: res.empoptim,
            empdnais: res.empdnais,
          };

          setSelectedEmp(formatted);
        });
    }, [selectedEmpMat]);
  const handleGenerateContract = (employe: Employe) => {
    const doc = new jsPDF();
  
    // Define contract content
    doc.setFontSize(12);
    doc.text('Contrat de Travail', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Nom et Prénom: ${employe.emplib}`, 20, 40);
    doc.text(`Code: ${employe.empcod}`, 20, 50);
    doc.text(`Site: ${employe.sitcod}`, 20, 60);
    doc.text(`Fonction: ${employe.empfonc}`, 20, 70);
    doc.text(`Actif: ${employe.actif ? 'Oui' : 'Non'}`, 20, 80);
  
    doc.text(
      `Nous confirmons par le présent document que ${employe.emplib} est employé(e) à la fonction de ${employe.empfonc} au sein de notre entreprise.`,
      20,
      100,
      { maxWidth: 170 },
    );
  
    // Add a signature area or additional content as needed
    doc.text('Signature: ____________________________', 20, 140);
  
    // Save the PDF
    doc.save(`contrat-${employe.empcod}.pdf`);
  };
  const handleGenerateAttestation = (employe: Employe) => {
    const doc = new jsPDF();
  
    // Add header
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("SOCIETE MEUNIERE TUNISIE", 105, 20, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("RUE AHMED CHAOUKI Z.I BIR KASSAA BEN AROUS", 105, 26, { align: "center" });
    doc.text("71 382 333", 105, 32, { align: "center" });
  
    // Title
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("ATTESTATION DE TRAVAIL", 170, 45, { align: "right" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Le : ${new Date().toLocaleDateString()}`, 170, 52, { align: "right" });
  
    // Main content
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
  
    // Content text with bold values
    const yStart = 70;
    let y = yStart;
  
    doc.text("Nous Soussignés Société", 20, y);
    doc.setFont("helvetica", "bold"); // Bold for company name
    doc.text("SOCIETE MEUNIERE TUNISIE,", 70, y);
    doc.setFont("helvetica", "normal"); // Back to normal
    doc.text("attestons par la présente que", 20, (y += 10));
  
    doc.text("Mr/Mme/Mlle", 20, (y += 10));
    doc.setFont("helvetica", "bold"); // Bold for employee name
    doc.text(employe.emplib, 50, y);
    doc.setFont("helvetica", "normal"); // Back to normal
    doc.text("Titulaire de la CIN :", 20, (y += 10));
    doc.setFont("helvetica", "bold"); // Bold for CIN
    doc.text(employe.empcin, 60, y);
    doc.setFont("helvetica", "normal");
    doc.text("délivrée à", 20, (y += 10));
    doc.setFont("helvetica", "bold"); // Bold for city
    doc.text(employe.empacin, 45, y);
    doc.setFont("helvetica", "normal");
    doc.text("le :", 80, y);
    doc.setFont("helvetica", "bold"); // Bold for CIN date
    doc.text(dayjs(employe.empdcin).format('DD/MM/YYYY'), 90, y);
    doc.setFont("helvetica", "normal");
    doc.text("a travaillé au sein de notre société en qualité de :", 20, (y += 10));
    doc.setFont("helvetica", "bold"); // Bold for job title
    doc.text(employe.empfonc.toUpperCase(), 120, y);
    doc.setFont("helvetica", "normal");
    doc.text("et ce à partir du :", 20, (y += 10));
    doc.setFont("helvetica", "bold"); // Bold for employment start date
    doc.text(dayjs(employe.empemb).format('DD/MM/YYYY'), 90, y);
  
    // Footer
    doc.setFont("helvetica", "italic");
    doc.text(
      "Cette attestation est délivrée à l'intéressé(e) pour servir et faire valoir ce que de droit.",
      20,
      (y += 20),
      { maxWidth: 170 }
    );
  
    // Save the PDF
    doc.save(`attestation-${employe.empcod}.pdf`);
  };
  
  const handleGenerateIndividualSheet = (employe: Employe) => {
    const doc = new jsPDF();
  
    // Add header
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("FICHE INDIVIDUELLE", 105, 20, { align: "center" });
  
    // Personal details
    let y = 40;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
  
    doc.text(`Nom et Prénom: ${employe.emplib}`, 20, y);
    doc.text(`Code: ${employe.empcod}`, 20, (y += 10));
    doc.text(`CIN: ${employe.empcin}`, 20, (y += 10));
    doc.text(`Délivrée à: ${employe.empacin}`, 20, (y += 10));
    doc.text(`Date de CIN: ${employe.empdcin}`, 20, (y += 10));
    doc.text(`Fonction: ${employe.empfonc}`, 20, (y += 10));
    doc.text(`Site: ${employe.sitcod}`, 20, (y += 10));
    doc.text(`Actif: ${employe.actif ? 'Oui' : 'Non'}`, 20, (y += 10));
  
    // Employment details
    doc.text(`Date d'embauche: ${employe.empemb}`, 20, (y += 10));
    doc.text(`Statut: ${employe.actif ? 'Employé Actif' : 'Employé Non Actif'}`, 20, (y += 10));
  
    // Footer
    doc.setFont("helvetica", "italic");
    doc.text(
      "Cette fiche est générée automatiquement à partir des données de l'employé.",
      20,
      (y += 20),
      { maxWidth: 170 }
    );
  
    // Save the PDF
    doc.save(`fiche-individuelle-${employe.empcod}.pdf`);
  };
  const getVisiteMedicaleReport = async (original: Employe) => {
    
      try {
          // Fetch the report as a Blob
          const response = await EmployeReportService.getReport(`get-report/${original.soccod}/${original.empcod}`,'blob');
  
          // Create a Blob from the response
          const blob = new Blob([response], { type: 'application/pdf' });
  
          // Create a temporary download link
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = 'Visite Médicale.pdf';
  
          // Trigger the download
          link.click();
  
          // Clean up the temporary URL
          window.URL.revokeObjectURL(url);
      } catch (error) {
          console.error('Error downloading the report:', error);
      }
  };
  const getEmpHoraires = async (original: Employe) => {
    try {
        const response = await EmpHoraireService.getAllWithParams(
            `get-emp-horaires/${soccod}/${original.empcod}`
        );

        return response;
    } catch (error) {
        console.error("Error fetching employee schedules:", error);
    }
};

  const fetchHoraires = async (employe: Employe) => {
    const horaires = await getEmpHoraires(employe);
    setEmpHoraires(horaires);
};
  

  const columns = useMemo<MRT_ColumnDef<Employe>[]>(
    () => [
      {
        id: 'employeeDetails',
        header: '',
        columns: [
          {
            accessorKey: 'empcod',
            header: 'Code',
            size: 60,
          },
          {
            accessorFn: (row) => row.emplib,
            id: 'emplib',
            header: 'Nom et Prénom',
            size: 160,
          },
          {
            accessorKey: 'empreg',
            header: 'Régime',
            size: 50,
          },
          {
            accessorKey: 'sitcod',
            header: 'Site',
            size: 50,
          },
          {
            accessorKey: 'empfonc',
            header: 'Fonction',
            size: 180
          },
          {
            accessorKey: 'empemb',
            header: 'Embauche',
            size: 90,
            Cell({ cell }) {
              const dateValue = cell.getValue();
              const formattedDate = getDatePart(String(dateValue ?? ""));
              
              return formattedDate;
            },
          },
          {
            accessorKey: 'empsort',
            header: 'Sortie',
            size: 90,
            Cell({ cell }) {
              const dateValue = cell.getValue();
              const formattedDate = getDatePart(String(dateValue ?? ""));
              
              return formattedDate;
            },
          },
          
          {
            accessorKey: 'actif',
            header: 'Active',
            size: 10,
            Cell: ({ cell }) => (
              <Box
                component="span"
                sx={(theme) => ({
                  backgroundColor: cell.getValue<boolean>() ? theme.palette.success.dark : theme.palette.error.dark,
                  borderRadius: '0.25rem',
                  color: '#fff',
                  p: '0.25rem',
                  fontSize: '0.75rem',
                })}
              >
                {cell.getValue<boolean>() ? 'Actif' : 'Non actif'}
              </Box>
            ),
          },
          
        ],
      },
    ],
    [],
  );


  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    let data = new Uint8Array(e.target?.result as ArrayBuffer);
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    let jsonData: Employe[] = XLSX.utils.sheet_to_json(sheet);
  // Normalize data
    const normalizedData: Employe[] = jsonData.map((emp) => ({
      empcod: String(emp.empcod ?? '').trim(),
      soccod: String(emp.soccod ?? '').trim(),
      sitcod: String(emp.sitcod ?? '').trim(),
      emplib: emp.emplib ?? null,
      empmat: emp.empmat ?? null,
      empsexe: emp.empsexe ?? null,
      sercod: emp.sercod ?? null,
      empfonc: emp.empfonc ?? null,
      empreg: emp.empreg ?? null,
      catcod: emp.catcod ?? null,
      empnbp: emp.empnbp != null ? Number(emp.empnbp) : null,
      natcod: emp.natcod ?? null,
      vilcod: emp.vilcod ?? null,
      empadr: emp.empadr ?? null,
      emptel: emp.emptel ?? null,
      empmob: emp.empmob ?? null,
      empemb: emp.empemb ? new Date(emp.empemb) : null,
      empsort: emp.empsort ? new Date(emp.empsort) : null,
      empmotif: emp.empmotif ?? null,
      actif: emp.actif ?? null,
      empdnais: emp.empdnais ?? null,
      emplnais: emp.emplnais ?? null,
      empcin: emp.empcin ?? null,
      empdcin: emp.empdcin ? new Date(emp.empdcin) : null,
      empacin: emp.empacin ?? null,
      empsbase: emp.empsbase != null ? Number(emp.empsbase) : null,
      empsbrut: emp.empsbrut != null ? Number(emp.empsbrut) : null,
      empdir: emp.empdir ?? null,
      emptype: emp.emptype ?? null,
      empniv: emp.empniv != null ? String(emp.empniv) : null,
      emplibar: emp.emplibar ?? null,
      empadrar: emp.empadrar ?? null,
      empfoncar: emp.empfoncar ?? null,
      foncod: emp.foncod ?? null,
      quacod: emp.quacod ?? null,
      empmaxhre: emp.empmaxhre != null ? Number(emp.empmaxhre) : null,
      empoptim: emp.empoptim ? new Date(emp.empoptim) : null,
      dircod: emp.dircod ?? null,
      empretraite: emp.empretraite ? new Date(emp.empretraite) : null,
      caltype: emp.caltype ?? null,
      empmaxjour: emp.empmaxjour != null ? Number(emp.empmaxjour) : null,
      empretard: emp.empretard ?? null,
      empemail: emp.empemail ?? null,
      empresp: emp.empresp ?? null,
      empsnet: emp.empsnet != null ? Number(emp.empsnet) : null,
      empcontrat: emp.empcontrat ?? null,
      empsitfam: emp.empsitfam ?? null,
      empech: emp.empech ?? null,
      empelon: emp.empelon ?? null,
      empcat: emp.empcat ?? null,
      empscat: emp.empscat ?? null,
      empnuit: emp.empnuit ?? null,
      empminhjour: emp.empminhjour != null ? Number(emp.empminhjour) : null,
      emppanier: emp.emppanier ?? null,
      seccod: emp.soccod ?? null,
      poscod: emp.poscod ?? null,
      parmois: emp.parmois ?? null,
    }));


    // Appelle un service d'importation si besoin :
    try {
      await EmployeService.putWithoutParamsList(normalizedData); // à implémenter dans EmployeService
      refetch(); // recharge les données
    } catch (error) {
      console.error('Erreur importation :', error);
    }
  };

  reader.readAsArrayBuffer(file);
};


return (
  <Box justifyContent="center" alignItems="center" height="100%" mt={-15}>
    {isLoading ? (
      <CircularProgress />
    ) : (
      <>
        {/* Upload Button */}
          <Box
            sx={{
              position: 'fixed',
              top: 69,
              right: 100,
            }}
          >
            <input
              accept=".xlsx, .xls"
              id="excel-upload"
              type="file"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            <label htmlFor="excel-upload">
              <Button
                variant="contained"
                color="success"
                component="span"
                startIcon={<UploadFileIcon />}
              >
              </Button>
            </label>
          </Box>
        {/* Side-by-side DataList and TableEtat */}
        <Box display="flex" gap={2}>
          <Grid container spacing={2}>
            <Grid item xs={5}>
              <TableEtat data={empHoraires} />
            </Grid>

            <Grid item xs={7}>
              <DataList
                  data={data}
                  columns={columns}
                  message="Êtes-vous sûr de vouloir supprimer cet employé ?"
                  deleteMethod={undefined}
                  idKey="empcod"
                  refetchMethod={refetch}
                  reportGeneration1={handleGenerateAttestation}
                  reportGeneration2={handleGenerateContract}
                  reportGeneration3={handleGenerateIndividualSheet}
                  reportGeneration4={getVisiteMedicaleReport}
                  empHoraires={fetchHoraires}
                  setData={setSelectedEmpMat}
                  actions={true} pageSize={5}
                  purge={undefined}/>
            </Grid>
          </Grid>
        </Box>
      </>
    )}
  </Box>
);



};

export default ListEmploye;
