import React, { useContext, useEffect, useMemo, useState } from 'react';
import {
  type MRT_ColumnDef,
} from 'material-react-table';
import {
  Box,
  Button,
  CircularProgress,
  Grid,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  IconButton,
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
import useDeleteEmploye from '../../../hooks/employeHooks/useDeleteEmploye';
import { useAuth } from '../../helper/AuthProvider';
import ForbiddenMessage from '../../AlertModal/ForbiddenMessage';
import DescriptionIcon from '@mui/icons-material/Description';
import DeleteIcon from '@mui/icons-material/Delete';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import * as mammoth from 'mammoth';
import ContratReportService from '../../../services/ContratService/ContratReportService';

const ListEmploye = () => {
  const uticod = localStorage.getItem("Uticod");
  const { selectedEmpMat, setSelectedEmpMat, setSelectedEmp } = useContext(EmployeeContext);
  const { data = [], isLoading, refetch } = useGetAllEmployees(uticod);
  const [empHoraires, setEmpHoraires] = useState<EmpHoraire[] | undefined>([]);
  const { soccod } = useAuth();
  
  // State for snackbar messages
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
  
  // State for forbidden message
  const [showForbidden, setShowForbidden] = useState(false);
  const [forbiddenMessage, setForbiddenMessage] = useState<string>('');

  // State for contrat dialog
  const [contratDialogOpen, setContratDialogOpen] = useState(false);
  const [selectedEmployeForContrat, setSelectedEmployeForContrat] = useState<Employe | null>(null);
  const [contratTemplates, setContratTemplates] = useState<Array<{name: string, file: File}>>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<File | null>(null);

  // Use the delete hook
  const { mutate: deleteEmployeMutation } = useDeleteEmploye();
  const getContratPdf = async (employe: Employe) => {
    try {
      const response = await ContratReportService.getReport(
        `get-contrat-report/${employe.soccod}/${employe.empcod}`
      );

      const blob = new Blob([response], { type: 'application/pdf' });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Contrat-${employe.empcod}.pdf`;

      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erreur téléchargement contrat :', error);
      setSnackbarMessage("Erreur lors du téléchargement du contrat");
      setSnackbarSeverity("error");
      setSnackbarOpen(true);
    }
  };

  // Load saved templates from localStorage on component mount
  useEffect(() => {
    const savedTemplates = localStorage.getItem('contratTemplates');
    if (savedTemplates) {
      try {
        const templates = JSON.parse(savedTemplates);
        // Convert base64 strings back to File objects
        const templateFiles = templates.map((template: any) => {
          const byteCharacters = atob(template.base64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          return new File([byteArray], template.name, { type: template.type });
        });
        setContratTemplates(templateFiles.map((file: File, index: number) => ({
          name: templates[index].name,
          file
        })));
      } catch (error) {
        console.error('Error loading templates:', error);
      }
    }
  }, []);

  // Save templates to localStorage
  const saveTemplatesToLocalStorage = (templates: Array<{name: string, file: File}>) => {
    const templatesForStorage = templates.map(async template => ({
      name: template.name,
      type: template.file.type,
      base64: btoa(new Uint8Array(await template.file.arrayBuffer()).reduce((data, byte) => data + String.fromCharCode(byte), ''))
    }));
    localStorage.setItem('contratTemplates', JSON.stringify(templatesForStorage));
  };

  const deleteEmploye = (data: any) => {
    deleteEmployeMutation(
      { empcod: data.empcod },
      {
        onSuccess: (response: any) => {
          const message = response?.message || 'Employé supprimé avec succès';
          setSnackbarMessage(message);
          setSnackbarSeverity('success');
          setSnackbarOpen(true);
          refetch();
        },
        onError: (error: any) => {
          console.error('Error deleting employee:', error);
          
          const status = error?.response?.status;
          const errorMessage = error?.response?.data?.message || 'Erreur lors de la suppression';
          
          // Check if it's a 403 Forbidden error
          if (status === 403) {
            setForbiddenMessage(errorMessage);
            setShowForbidden(true);
          } else {
            setSnackbarMessage(errorMessage);
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
          }
        },
      }
    );
  };

  useEffect(() => {
    if (selectedEmpMat) {
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
        })
        .catch((error) => {
          console.error('Error fetching employee details:', error);
        });
    }
  }, [selectedEmpMat]);

  // Open contrat dialog
  const openContratDialog = (employe: Employe) => {
    setSelectedEmployeForContrat(employe);
    setContratDialogOpen(true);
  };

  // Handle template file selection
  const handleTemplateFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && (file.name.endsWith('.doc') || file.name.endsWith('.docx'))) {
      const newTemplate = {
        name: file.name,
        file: file
      };
      const updatedTemplates = [...contratTemplates, newTemplate];
      setContratTemplates(updatedTemplates);
      saveTemplatesToLocalStorage(updatedTemplates);
    } else {
      setSnackbarMessage('Veuillez sélectionner un fichier Word (.doc ou .docx)');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  // Delete a template
  const deleteTemplate = (index: number) => {
    const updatedTemplates = contratTemplates.filter((_, i) => i !== index);
    setContratTemplates(updatedTemplates);
    saveTemplatesToLocalStorage(updatedTemplates);
    if (selectedTemplate === contratTemplates[index].file) {
      setSelectedTemplate(null);
    }
  };

  // Generate contract from template
  const generateContratFromTemplate = async () => {
  if (!selectedEmployeForContrat) return;
  
  if (!selectedTemplate) {
    setSnackbarMessage('Veuillez sélectionner un modèle de contrat');
    setSnackbarSeverity('error');
    setSnackbarOpen(true);
    return;
  }

  try {
    // Read the Word file and extract text with formatting
    const arrayBuffer = await selectedTemplate.arrayBuffer();
    
    // Use mammoth to extract text from Word document
    const result = await mammoth.extractRawText({ arrayBuffer });
    let templateContent = result.value;
    
    // Replace placeholders with employee data
    const replacements: { [key: string]: string } = {
      '{{NOM}}': selectedEmployeForContrat.emplib || '',
      '{{PRENOM}}': selectedEmployeForContrat.emplib || '',
      '{{CIN}}': selectedEmployeForContrat.empcin || '',
      '{{DATE_CIN}}': selectedEmployeForContrat.empdcin 
        ? dayjs(selectedEmployeForContrat.empdcin).format('DD/MM/YYYY') 
        : '',
      '{{DATE_EMBAUCHE}}': selectedEmployeForContrat.empemb 
        ? dayjs(selectedEmployeForContrat.empemb).format('DD/MM/YYYY') 
        : '',
      '{{FONCTION}}': selectedEmployeForContrat.empfonc || '',
      '{{SALAIRE}}': selectedEmployeForContrat.empsbase 
        ? selectedEmployeForContrat.empsbase.toString() 
        : '0',
      '{{DATE_JOUR}}': dayjs().format('DD/MM/YYYY'),
      '{{MATRICULE}}': selectedEmployeForContrat.empcod || '',
      '{{LIEU_CIN}}': selectedEmployeForContrat.empacin || '',
      '{{ADRESSE}}': selectedEmployeForContrat.empadr || '',
      '{{TELEPHONE}}': selectedEmployeForContrat.emptel || '',
      '{{EMAIL}}': selectedEmployeForContrat.empemail || '',
      '{{SITE}}': selectedEmployeForContrat.sitcod || '',
      '{{REGIME}}': selectedEmployeForContrat.empreg || '',
    };

    // Replace all placeholders in the template
    let contratContent = templateContent;
    Object.keys(replacements).forEach(placeholder => {
      const regex = new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g');
      contratContent = contratContent.replace(regex, replacements[placeholder]);
    });

    // Create PDF
    const doc = new jsPDF();
    
    // Set margins
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const maxLineWidth = pageWidth - (margin * 2);
    
    // Split content into lines that fit the page width
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    
    const lines = doc.splitTextToSize(contratContent, maxLineWidth);
    
    let y = margin;
    const lineHeight = 7;
    
    // Add content to PDF, handling page breaks
    lines.forEach((line: string) => {
      if (y + lineHeight > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      
      // Check if line is a title/header (you can customize this logic)
      if (line.match(/^(ARTICLE|CHAPITRE|CONTRAT|TITRE)/i)) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
      } else {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
      }
      
      doc.text(line, margin, y);
      y += lineHeight;
    });
    
    // Save the PDF
    doc.save(`contrat-${selectedEmployeForContrat.empcod}.pdf`);
    
    // Close dialog and show success message
    setContratDialogOpen(false);
    setSelectedTemplate(null);
    
    setSnackbarMessage('Contrat généré avec succès');
    setSnackbarSeverity('success');
    setSnackbarOpen(true);
    
  } catch (error) {
    console.error('Error generating contract:', error);
    setSnackbarMessage('Erreur lors de la génération du contrat');
    setSnackbarSeverity('error');
    setSnackbarOpen(true);
  }
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
    doc.setFont("helvetica", "bold");
    doc.text("SOCIETE MEUNIERE TUNISIE,", 70, y);
    doc.setFont("helvetica", "normal");
    doc.text("attestons par la présente que", 20, (y += 10));
  
    doc.text("Mr/Mme/Mlle", 20, (y += 10));
    doc.setFont("helvetica", "bold");
    doc.text(employe.emplib, 50, y);
    doc.setFont("helvetica", "normal");
    doc.text("Titulaire de la CIN :", 20, (y += 10));
    doc.setFont("helvetica", "bold");
    doc.text(employe.empcin, 60, y);
    doc.setFont("helvetica", "normal");
    doc.text("délivrée à", 20, (y += 10));
    doc.setFont("helvetica", "bold");
    doc.text(employe.empacin, 45, y);
    doc.setFont("helvetica", "normal");
    doc.text("le :", 80, y);
    doc.setFont("helvetica", "bold");
    doc.text(dayjs(employe.empdcin).format('DD/MM/YYYY'), 90, y);
    doc.setFont("helvetica", "normal");
    doc.text("a travaillé au sein de notre société en qualité de :", 20, (y += 10));
    doc.setFont("helvetica", "bold");
    doc.text(employe.empfonc.toUpperCase(), 120, y);
    doc.setFont("helvetica", "normal");
    doc.text("et ce à partir du :", 20, (y += 10));
    doc.setFont("helvetica", "bold");
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
      const response = await EmployeReportService.getReport(
        `get-report/${original.soccod}/${original.empcod}`,
        'blob'
      );
  
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

      try {
        await EmployeService.putWithoutParamsList(normalizedData);
        refetch();
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
                  deleteMethod={deleteEmploye}
                  idKey="empcod"
                  refetchMethod={refetch}
                  reportGeneration1={handleGenerateAttestation}
                  reportGeneration2={getContratPdf} // Changé ici pour ouvrir la popup
                  reportGeneration3={handleGenerateIndividualSheet}
                  reportGeneration4={getVisiteMedicaleReport}
                  empHoraires={fetchHoraires}
                  setData={setSelectedEmpMat}
                  actions={true}
                  pageSize={5}
                  purge={undefined}
                />
              </Grid>
            </Grid>
          </Box>

          {/* Dialog pour sélectionner le modèle de contrat */}
          <Dialog open={contratDialogOpen} onClose={() => setContratDialogOpen(false)} maxWidth="md" fullWidth
            sx={{
        '& .MuiDialog-container': {
          alignItems: 'center',
        },
        '& .MuiDialog-paper': {
          margin: { xs: 0, sm: '32px' },
          width: { xs: '30%', sm: 'auto' },
          maxWidth: { xs: '50%', sm: '500px' },
        },
      }}>
            <DialogTitle>
              <Box display="flex" alignItems="center" gap={1}>
                <DescriptionIcon />
                Sélectionner un modèle de contrat pour {selectedEmployeForContrat?.emplib}
              </Box>
            </DialogTitle>
            <DialogContent>
              <Box mb={2}>
                <input
                  accept=".doc,.docx"
                  id="contrat-template-upload"
                  type="file"
                  style={{ display: 'none' }}
                  onChange={handleTemplateFileSelect}
                />
                <label htmlFor="contrat-template-upload">
                  <Button
                    variant="outlined"
                    component="span"
                    startIcon={<InsertDriveFileIcon />}
                    fullWidth
                  >
                    Ajouter un nouveau modèle (.doc/.docx)
                  </Button>
                </label>
              </Box>
              
              {contratTemplates.length > 0 ? (
                <List>
                  {contratTemplates.map((template, index) => (
                    <ListItem
                      key={index}
                      secondaryAction={
                        <IconButton edge="end" onClick={() => deleteTemplate(index)}>
                          <DeleteIcon />
                        </IconButton>
                      }
                      sx={{
                        backgroundColor: selectedTemplate === template.file ? '#e3f2fd' : 'inherit',
                        borderRadius: 1,
                        mb: 1,
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor: '#f5f5f5',
                        },
                      }}
                      onClick={() => setSelectedTemplate(template.file)}
                    >
                      <ListItemText 
                        primary={template.name}
                        secondary={`Sélectionné: ${selectedTemplate === template.file ? 'Oui' : 'Non'}`}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Box textAlign="center" py={4}>
                  <InsertDriveFileIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                  <p>Aucun modèle de contrat disponible. Ajoutez un fichier Word (.doc/.docx).</p>
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setContratDialogOpen(false)}>Annuler</Button>
              <Button 
                onClick={generateContratFromTemplate}
                variant="contained" 
                disabled={!selectedTemplate}
                startIcon={<DescriptionIcon />}
              >
                Générer le contrat PDF
              </Button>
            </DialogActions>
          </Dialog>

          {/* Regular Snackbar for success/error messages */}
          <Snackbar 
            open={snackbarOpen} 
            autoHideDuration={6000} 
            onClose={() => setSnackbarOpen(false)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert 
              onClose={() => setSnackbarOpen(false)} 
              severity={snackbarSeverity}
              sx={{ width: '100%' }}
            >
              {snackbarMessage}
            </Alert>
          </Snackbar>

          {/* Forbidden Message Component for 403 errors */}
          {showForbidden && (
            <ForbiddenMessage 
              message={forbiddenMessage}
              autoHideDuration={6000}
            />
          )}
        </>
      )}
    </Box>
  );
};

export default ListEmploye;