import React, { useContext, useEffect, useState, useMemo } from 'react';
import {
    Box, Typography, Paper, Button, Snackbar, Alert,
    TextField, Select, MenuItem, FormControl, CircularProgress,
    IconButton, Menu, ListItemIcon, ListItemText, Divider, Chip,
    Dialog, DialogTitle, DialogContent, DialogActions, Avatar,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonIcon from '@mui/icons-material/Person';
import WorkIcon from '@mui/icons-material/Work';
import BadgeIcon from '@mui/icons-material/Badge';
import PaymentsIcon from '@mui/icons-material/Payments';
import ScheduleIcon from '@mui/icons-material/Schedule';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import DownloadIcon from '@mui/icons-material/Download';
import DescriptionIcon from '@mui/icons-material/Description';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import VerifiedIcon from '@mui/icons-material/Verified';
import FolderIcon from '@mui/icons-material/Folder';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PhoneIcon from '@mui/icons-material/Phone';
import EmailIcon from '@mui/icons-material/Email';
import AddIcon from '@mui/icons-material/Add';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import GroupsIcon from '@mui/icons-material/Groups';
import SearchIcon from '@mui/icons-material/Search';
import dayjs from 'dayjs';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQueryClient } from 'react-query';
import { EmployeeContext, EmployeeProvider } from '../Pointeuse/EtatPeriodique/EmployeeContext';
import useAddEmploye from '../../hooks/employeHooks/useAddEmploye';
import useUpdateEmploye from '../../hooks/employeHooks/useUpdateEmploye';
import { useAuth } from '../helper/AuthProvider';
import Employe from '../../models/Employe';
import apiInstance from '../API/apiInstance';
import useGetDirectionLibs from '../../hooks/directionHooks/useGetDirectionLibs';
import useGetFonctionsLibs from '../../hooks/fonctionHooks/useGetFonctionsLibs';
import useGetSectionsLibs from '../../hooks/sectionHooks/useGetSectionsLibs';
import useGetQualificationsLibs from '../../hooks/QualificationHooks/useGetQualificationsLibs';
import useGetSiteLibs from '../../hooks/siteHooks/useGetSiteLibs';
import useGetPaysLibs from '../../hooks/paysHooks/useGetPaysLibs';
import DocumentScanEmploye from './DocumentScanEmploye/DocumentScanEmploye';
import RolesService from '../../services/RolesService/RolesService';
import { SxProps, Theme } from '@mui/material';
import { Role } from '../../models/Role';
import './EmployeModern.css';
import { useQuery } from 'react-query';
import useGetVillesLibs from '../../hooks/villeHooks/useGetVillesLibs';

// ── Styles ────────────────────────────────────────────────────────────────────
const fieldStyle = {
    '& .MuiOutlinedInput-root': {
        backgroundColor: '#f5f7fa',
        borderRadius: '8px',
        fontSize: '13px',
        '& fieldset': { border: '1.5px solid #e8ecf0' },
        '&:hover fieldset': { borderColor: '#b8c4d0' },
        '&.Mui-focused fieldset': { borderColor: '#0040a1', borderWidth: '1.5px' },
        '&:hover': { backgroundColor: '#fff' },
        '&.Mui-focused': { backgroundColor: '#fff' },
    },
    '& .MuiInputBase-input': { fontSize: '13px', padding: '9px 12px' },
};

const labelStyle = {
    fontSize: '10px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    fontWeight: 700,
    color: '#8896a8',
    mb: 0.5,
};

const selectStyle = {
    backgroundColor: '#f5f7fa',
    borderRadius: '8px',
    fontSize: '13px',
    '& .MuiOutlinedInput-notchedOutline': { border: '1.5px solid #e8ecf0' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#b8c4d0' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#0040a1' },
    '& .MuiSelect-select': { fontSize: '13px', padding: '9px 12px' },
};

const sectionCard = {
    p: 3,
    borderRadius: '14px',
    boxShadow: '0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)',
    backgroundColor: '#fff',
    border: '1px solid #f1f5f9',
};

const sectionHeader = () => ({
    display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5,
    pb: 2, borderBottom: '1px solid #f1f5f9',
});

const iconBox = (bg = 'rgba(0,64,161,0.08)') => ({
    backgroundColor: bg, p: '7px', borderRadius: '8px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
});

const DOCUMENT_TYPES = [
    { label: 'Contrat de travail', icon: <WorkOutlineIcon fontSize="small" />, key: 'contrat' },
    { label: 'Visite médicale', icon: <MedicalServicesIcon fontSize="small" />, key: 'visite' },
    { label: 'Attestation de travail', icon: <VerifiedIcon fontSize="small" />, key: 'attestation' },
    { label: 'Attestation de salaire', icon: <AccountBalanceWalletIcon fontSize="small" />, key: 'salaire' },
    { label: 'Certificat de travail', icon: <DescriptionIcon fontSize="small" />, key: 'certificat' },
    { label: 'Dossier complet', icon: <FolderIcon fontSize="small" />, key: 'dossier' },
];

const getDefaultEmployeData = (soccod: string, sitcod: string): Employe => ({
    empcod: '', soccod: soccod || '', sitcod: sitcod || '',
    emplib: '', empmat: '', empsexe: '', sercod: '', empfonc: '',
    empelon: '', empreg: '', catcod: '', empnbp: 0, natcod: '',
    vilcod: '', empadr: '', empferepos: '', emptel: '', empmob: '',
    empemb: null, empsort: null, empmotif: '', actif: 'A',
    empdnais: '', emplnais: '', empcin: '', empdcin: null, empacin: '',
    empsbase: '', empsbrut: '', empdir: '', emptype: '', empniv: '',
    emplibar: '', empadrar: '', empfoncar: '', foncod: '', quacod: '',
    empmaxhre: 0, empoptim: null, dircod: '', empretraite: null,
    caltype: '', empmaxjour: 0, empretard: '0', empemail: '',
    empresp: '', empsnet: '', empcontrat: '', empsitfam: '', empech: '',
    empcat: '', empscat: '', empnuit: '', empminhjour: 0, emppanier: '',
    seccod: '', poscod: '', parmois: '',
    utirole: 'Utilisateur Standard',
});

// ── SelectWithAdd: dropdown + quick-add popup ─────────────────────────────────
function SelectWithAdd({ value, onChange, options, onAdd, addTitle }: {
    value: string;
    onChange: (v: string) => void;
    options: Record<string, string>;
    onAdd: (code: string, lib: string) => Promise<void>;
    addTitle: string;
}) {
    const [open, setOpen] = useState(false);
    const [newCode, setNewCode] = useState('');
    const [newLib, setNewLib] = useState('');
    const [saving, setSaving] = useState(false);

    const handleAdd = async () => {
        if (!newCode.trim() || !newLib.trim()) return;
        setSaving(true);
        try {
            await onAdd(newCode.trim(), newLib.trim());
            onChange(newCode.trim());
            setOpen(false); setNewCode(''); setNewLib('');
        } catch (err: any) {
            console.error("Erreur lors de l'ajout:", err);
            // On pourrait lever l'erreur pour que le parent l'affiche via snackbar
            throw err;
        } finally { setSaving(false); }
    };

    const fSx: SxProps<Theme> = { '& .MuiOutlinedInput-root': { borderRadius: '8px', backgroundColor: '#f5f7fa', '& fieldset': { border: '1.5px solid #e8ecf2' } } };

    return (
        <>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <FormControl fullWidth size="small">
                    <Select value={value} onChange={e => onChange(e.target.value)} displayEmpty
                        sx={{ backgroundColor: '#f5f7fa', borderRadius: '8px', fontSize: '13px', '& .MuiOutlinedInput-notchedOutline': { border: '1.5px solid #e8ecf2' }, '& .MuiSelect-select': { fontSize: '13px', padding: '9px 12px' } }}>
                        <MenuItem value=""><em style={{ color: '#aaa' }}>—</em></MenuItem>
                        {Object.entries(options).map(([k, v]) => (
                            <MenuItem key={k} value={k} sx={{ fontSize: '13px' }}>{String(v)}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <IconButton size="small" onClick={() => setOpen(true)}
                    sx={{ background: '#0040a1', color: 'white', borderRadius: '8px', width: 34, height: 34, flexShrink: 0, '&:hover': { background: '#003080' } }}>
                    <AddIcon sx={{ fontSize: 16 }} />
                </IconButton>
            </Box>
            <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '14px' } }}>
                <DialogTitle sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: '16px', pb: 1 }}>
                    {addTitle}
                </DialogTitle>
                <Divider />
                <DialogContent sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box>
                        <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>Code</Typography>
                        <TextField size="small" fullWidth value={newCode} onChange={e => setNewCode(e.target.value)} sx={fSx} />
                    </Box>
                    <Box>
                        <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>Libellé</Typography>
                        <TextField size="small" fullWidth value={newLib} onChange={e => setNewLib(e.target.value)} sx={fSx} />
                    </Box>
                </DialogContent>
                <Divider />
                <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
                    <Button onClick={() => setOpen(false)} sx={{ borderRadius: '8px', textTransform: 'none', color: '#64748b' }}>Annuler</Button>
                    <Button variant="contained" onClick={handleAdd} disabled={saving || !newCode.trim() || !newLib.trim()}
                        startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
                        sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700, background: 'linear-gradient(135deg, #0040a1 0%, #0056d2 100%)' }}>
                        Ajouter
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}

// ── Inner component ───────────────────────────────────────────────────────────
const EmployeModernInner = () => {
    const { soccod, sitcod, uticod, hasPermission } = useAuth();

    const canAdd = hasPermission('Gestion Employés', 'add');
    const canModify = hasPermission('Gestion Employés', 'modify');
    const canConsult = hasPermission('Gestion Employés', 'consult');
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { selectedEmp } = useContext(EmployeeContext);

    const empIdFromUrl = searchParams.get('id');
    const isNewEmployee = searchParams.get('new') === 'true';

    const [isSnackbarOpen, setIsSnackbarOpen] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [severity, setSeverity] = useState<'success' | 'error'>('success');
    const [isSaving, setIsSaving] = useState(false);
    const [isFetching, setIsFetching] = useState(false);
    const [mode, setMode] = useState<'save' | 'update'>('save');
    const [docAnchorEl, setDocAnchorEl] = useState<null | HTMLElement>(null);
    const [formData, setFormData] = useState<Employe>(getDefaultEmployeData(soccod || '', sitcod || ''));
    const [scanOpen, setScanOpen] = useState(false);
    const [empHoraires, setEmpHoraires] = useState<any[]>([]);

    // Master-Detail support
    const [employeesList, setEmployeesList] = useState<Employe[]>([]);
    const [empSearchQuery, setEmpSearchQuery] = useState("");
    const [isListLoading, setIsListLoading] = useState(false);

    const { mutate: addEmploye } = useAddEmploye();
    const { mutate: updateEmploye } = useUpdateEmploye();
    const queryClient = useQueryClient();

    // Reference data hooks
    const { data: directionLibsRaw } = useGetDirectionLibs();
    const { data: fonctionLibsRaw } = useGetFonctionsLibs();
    const { data: sectionLibsRaw } = useGetSectionsLibs();
    const { data: qualifLibsRaw } = useGetQualificationsLibs();
    const { data: siteLibsRaw = {} } = useGetSiteLibs();
    const { data: villeLibsRaw } = useGetVillesLibs();
    const { data: paysLibsRaw } = useGetPaysLibs();
    const { data: roles = [] } = useQuery<Role[]>({ queryKey: ['roles'], queryFn: RolesService.getAll });

    const [classeHoraireLibs, setClasseHoraireLibs] = useState<Record<string, string>>({});
    const [serviceLibs, setServiceLibs] = useState<Record<string, string>>({});
    const [calendrierLibs, setCalendrierLibs] = useState<any[]>([]);

    useEffect(() => {
        if (!soccod) return;
        apiInstance.get(`/Lcategories/get-horlibs/${soccod}`)
            .then(r => setClasseHoraireLibs(r.data ?? {})).catch(() => { });
        apiInstance.get(`/Services/get-servlibs/${soccod}`)
            .then(r => setServiceLibs(r.data ?? {})).catch(() => { });
        apiInstance.get(`/Calendriers`)
            .then(r => setCalendrierLibs(r.data ?? [])).catch(() => { });
    }, [soccod]);

    const toMap = (raw: any): Record<string, string> => {
        if (!raw || typeof raw !== 'object') return {};
        if (Array.isArray(raw)) {
            const m: Record<string, string> = {};
            raw.forEach((item: any) => { if (item?.code || item?.dircod || item?.foncod || item?.seccod) { const k = item.code || item.dircod || item.foncod || item.seccod; m[k] = item.lib || item.dirlib || item.fonlib || item.seclib || k; } });
            return m;
        }
        return raw as Record<string, string>;
    };

    const dirMap = useMemo(() => toMap(directionLibsRaw), [directionLibsRaw]);
    const fonMap = useMemo(() => toMap(fonctionLibsRaw), [fonctionLibsRaw]);
    const secMap = useMemo(() => toMap(sectionLibsRaw), [sectionLibsRaw]);
    const quaMap = useMemo(() => toMap(qualifLibsRaw), [qualifLibsRaw]);
    const sitMap = useMemo(() => toMap(siteLibsRaw), [siteLibsRaw]);
    const vilMap = useMemo(() => toMap(villeLibsRaw), [villeLibsRaw]);
    const payMap = useMemo(() => toMap(paysLibsRaw), [paysLibsRaw]);

    // Quick-add handlers
    const handleAddDirection = async (code: string, lib: string) => {
        try {
            await apiInstance.post('/Directions', { soccod, dircod: code, dirlib: lib });
            queryClient.invalidateQueries('directions');
            showSnackbar("Direction ajoutée avec succès", 'success');
        } catch (err) {
            showSnackbar("Erreur lors de l'ajout de la direction", 'error');
            throw err;
        }
    };
    const handleAddFonction = async (code: string, lib: string) => {
        try {
            await apiInstance.post('/Fonctions', { soccod, foncod: code, fonlib: lib });
            queryClient.invalidateQueries('fonlibs');
            showSnackbar("Fonction ajoutée avec succès", 'success');
        } catch (err) {
            showSnackbar("Erreur lors de l'ajout de la fonction", 'error');
            throw err;
        }
    };
    const handleAddSection = async (code: string, lib: string) => {
        try {
            await apiInstance.post('/Sections', { soccod, seccod: code, seclib: lib });
            queryClient.invalidateQueries('sec-libs');
            showSnackbar("Section ajoutée avec succès", 'success');
        } catch (err) {
            showSnackbar("Erreur lors de l'ajout de la section", 'error');
            throw err;
        }
    };
    const handleAddQualification = async (code: string, lib: string) => {
        try {
            await apiInstance.post('/Qualifs', { soccod, quacod: code, qualib: lib });
            queryClient.invalidateQueries('qualifs');
            showSnackbar("Qualification ajoutée avec succès", 'success');
        } catch (err) {
            showSnackbar("Erreur lors de l'ajout de la qualification", 'error');
            throw err;
        }
    };
    const handleAddService = async (code: string, lib: string) => {
        try {
            await apiInstance.post('/Services', { soccod, sercod: code, serlib: lib });
            setServiceLibs(prev => ({ ...prev, [code]: lib }));
            showSnackbar("Service ajouté avec succès", 'success');
        } catch (err) {
            showSnackbar("Erreur lors de l'ajout du service", 'error');
            throw err;
        }
    };
    const handleAddClasseHoraire = async (code: string, lib: string) => {
        try {
            await apiInstance.post('/Lcategories', { soccod, catcod: code, catlib: lib, catperiode: 'N', catfixe: '0' });
            setClasseHoraireLibs(prev => ({ ...prev, [code]: lib }));
            showSnackbar("Classe horaire ajoutée avec succès", 'success');
        } catch (err) {
            showSnackbar("Erreur lors de l'ajout de la classe horaire", 'error');
            throw err;
        }
    };
    const handleAddSite = async (code: string, lib: string) => {
        try {
            await apiInstance.post('/Sites', { soccod, sitcod: code, sitlib: lib });
            queryClient.invalidateQueries('sitlibs');
            showSnackbar("Filiale ajoutée avec succès", 'success');
        } catch (err) {
            showSnackbar("Erreur lors de l'ajout de la filiale", 'error');
            throw err;
        }
    };
    const handleAddVille = async (code: string, lib: string) => {
        try {
            await apiInstance.post('/Villes', { soccod, vilcod: code, villib: lib });
            queryClient.invalidateQueries('villibs');
            showSnackbar("Ville ajoutée avec succès", 'success');
        } catch (err) {
            showSnackbar("Erreur lors de l'ajout de la ville", 'error');
            throw err;
        }
    };
    const handleAddPays = async (code: string, lib: string) => {
        try {
            await apiInstance.post('/Pays', { natcod: code, natlib: lib });
            queryClient.invalidateQueries('pays-libs');
            showSnackbar("Pays ajouté avec succès", 'success');
        } catch (err) {
            showSnackbar("Erreur lors de l'ajout du pays. Vérifiez si le code existe déjà.", 'error');
            throw err;
        }
    };

    useEffect(() => {
        if (isNewEmployee) {
            setFormData(getDefaultEmployeData(soccod || '', sitcod || ''));
            setMode('save');
            return;
        }
        if (empIdFromUrl && soccod) {
            setIsFetching(true);
            apiInstance.get(`/Employes/get-employe/${soccod}/${empIdFromUrl}`)
                .then(res => { if (res.data) { setFormData(res.data); setMode('update'); } })
                .catch(() => showSnackbar("Erreur lors du chargement de l'employé", 'error'))
                .finally(() => setIsFetching(false));
            return;
        }
        if (selectedEmp?.empcod) { setFormData(selectedEmp); setMode('update'); }
    }, [empIdFromUrl, isNewEmployee, soccod, sitcod]);

    useEffect(() => {
        if (!soccod) return;
        setIsListLoading(true);
        apiInstance.get(`/Employes/${soccod}/${uticod || 'admin'}`)
            .then(res => setEmployeesList(res.data ?? []))
            .finally(() => setIsListLoading(false));
    }, [soccod, uticod]);

    const filteredEmployees = useMemo(() => {
        if (!empSearchQuery) return employeesList;
        const q = empSearchQuery.toLowerCase();
        return employeesList.filter(e =>
            e.emplib?.toLowerCase().includes(q) ||
            e.empmat?.toLowerCase().includes(q) ||
            e.empcod?.toLowerCase().includes(q) ||
            e.empfonc?.toLowerCase().includes(q)
        );
    }, [employeesList, empSearchQuery]);

    useEffect(() => {
        if (formData.empcod && soccod && mode === 'update') {
            apiInstance.get(`/Employes/get-emp-horaires/${soccod}/${formData.empcod}`)
                .then(res => {
                    const data = res.data?.[0]; // On prend le premier poste assigné
                    if (data) {
                        const days = [
                            { label: 'Lundi', prefix: 'lun' },
                            { label: 'Mardi', prefix: 'mar' },
                            { label: 'Mercredi', prefix: 'mer' },
                            { label: 'Jeudi', prefix: 'jeu' },
                            { label: 'Vendredi', prefix: 'ven' },
                            { label: 'Samedi', prefix: 'sam' },
                            { label: 'Dimanche', prefix: 'dim' },
                        ];
                        const rows = days.map(d => ({
                            poste: data.libposte || data.codposte || 'Poste',
                            jour: d.label,
                            entreeM: data[`${d.prefix}hdmat`] || '—',
                            sortieM: data[`${d.prefix}hfmat`] || '—',
                            entreeAM: data[`${d.prefix}hdam`] || '—',
                            sortieAM: data[`${d.prefix}hfam`] || '—',
                            statut: (data[`${d.prefix}repos`] === '1' || data[`${d.prefix}repos`] === 'O') ? 'repos' : 'valide',
                        }));
                        setEmpHoraires(rows);
                    } else {
                        setEmpHoraires([]);
                    }
                })
                .catch(() => setEmpHoraires([]));
        } else {
            setEmpHoraires([]);
        }
    }, [formData.empcod, soccod, mode]);

    const showSnackbar = (msg: string, sev: 'success' | 'error') => {
        setMessage(msg); setSeverity(sev); setIsSnackbarOpen(true);
    };

    const handleField = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelect = (name: string) => (event: any) =>
        setFormData(prev => ({ ...prev, [name]: event.target.value }));

    const formatDate = (date: any): Date | null => {
        if (!date) return null;
        if (date instanceof Date && !isNaN(date.getTime())) return date;
        if (typeof date === 'string') { const d = dayjs(date); if (d.isValid()) return d.toDate(); }
        return null;
    };

    const handleApplyScanData = (data: Partial<Employe>) => {
        setFormData(prev => ({ ...prev, ...data }));
        showSnackbar(`Données importées avec succès depuis le document`, 'success');
    };

    const handleSave = () => {
        setIsSaving(true);
        const payload: Employe = {
            ...formData, soccod: soccod || '', sitcod: sitcod || '',
            empemb: formatDate(formData.empemb), empretraite: formatDate(formData.empretraite),
            empsort: formatDate(formData.empsort), empdcin: formatDate(formData.empdcin) || new Date(),
            empoptim: formatDate(formData.empoptim),
        };
        const onSuccess = async (res: any) => {
            showSnackbar(res?.message || 'Employé créé avec succès', 'success');
            queryClient.invalidateQueries('employe');
            setIsSaving(false);
            if (mode === 'save') {
                setMode('update');
                navigate(`/dashboard/gestion-employe?id=${formData.empcod}&new=false`);
            }
        };
        const onError = (err: any) => { showSnackbar(err?.response?.data?.message || 'Erreur lors de la sauvegarde', 'error'); setIsSaving(false); };
        mode === 'save' ? addEmploye(payload, { onSuccess, onError }) : updateEmploye(payload, { onSuccess, onError });
    };

    const handleDownload = (docKey: string, docLabel: string) => {
        setDocAnchorEl(null);
        if (!formData.empcod || !soccod) { showSnackbar("Veuillez sélectionner un employé d'abord", 'error'); return; }

        // Map each document type to its real backend endpoint
        const endpointMap: Record<string, string> = {
            contrat: `/Contrats/get-contrat-report/${soccod}/${formData.empcod}`,
            visite: `/Employes/get-report/${soccod}/${formData.empcod}`,
            attestation: `/Employes/get-attestation-travail/${soccod}/${formData.empcod}`,
            salaire: `/Employes/get-attestation-salaire/${soccod}/${formData.empcod}`,
            certificat: `/Employes/get-certificat-travail/${soccod}/${formData.empcod}`,
            dossier: `/Employes/get-report/${soccod}/${formData.empcod}`,
        };

        const endpoint = endpointMap[docKey];
        if (!endpoint) { showSnackbar(`Document "${docLabel}" non disponible`, 'error'); return; }

        apiInstance.get(endpoint, { responseType: 'blob' })
            .then(res => {
                const url = window.URL.createObjectURL(new Blob([res.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `${docLabel}_${formData.emplib || formData.empcod}.pdf`);
                document.body.appendChild(link); link.click(); link.remove();
                window.URL.revokeObjectURL(url);
            })
            .catch(() => showSnackbar(`Téléchargement de "${docLabel}" non disponible`, 'error'));
    };

    if (isFetching) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <CircularProgress size={48} sx={{ color: '#0040a1' }} />
            </Box>
        );
    }

    return (
        // Pas de `overflowX: hidden` ici : ça crée un contexte de scroll qui casse `position: sticky`
        // sur le Top bar. On garde le scroll au niveau du body pour que le header reste collé en haut.
        <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f0f3f8', fontFamily: 'Manrope, sans-serif', width: '100%', maxWidth: '100vw' }}>

            {/* ── Main content area ── */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

                {/* Top bar — sticky en haut du viewport, reste visible pendant le scroll */}
                <Box sx={{
                    display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' },
                    px: { xs: 2, sm: 4 }, py: 2, backgroundColor: '#fff',
                    borderBottom: '1px solid #edf0f5',
                    boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
                    position: 'sticky', top: 0, zIndex: 100,
                    flexDirection: { xs: 'column', sm: 'row' },
                    gap: { xs: 2, sm: 0 }
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <IconButton
                            onClick={() => navigate('/dashboard/gestion-employe')}
                            sx={{ backgroundColor: '#f5f7fa', borderRadius: '8px', width: 36, height: 36, '&:hover': { backgroundColor: '#e8ecf2' } }}
                        >
                            <ArrowBackIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                        <Box>
                            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: '#0040a1', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                                {mode === 'save' ? 'Nouveau Collaborateur' : 'Profil Employé'}
                            </Typography>
                            <Typography sx={{ fontSize: '18px', fontWeight: 800, fontFamily: 'Manrope, sans-serif', color: '#0d1f3c', lineHeight: 1.2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                {formData.emplib || 'Fiche Collaborateur'}
                                {mode === 'update' && formData.actif === 'N' && (
                                    <Chip size="small" icon={<WarningAmberIcon sx={{ fontSize: '12px !important', color: '#d97706 !important' }} />} label="Inactif"
                                        sx={{ backgroundColor: '#fef3c7', color: '#92400e', fontWeight: 700, fontSize: '10px', height: 20 }} />
                                )}
                            </Typography>
                            <Typography sx={{ fontSize: '11px', color: '#8896a8', mt: 0.2 }}>
                                Gestion détaillée de la fiche collaborateur
                            </Typography>
                        </Box>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', width: { xs: '100%', sm: 'auto' }, justifyContent: { xs: 'center', sm: 'flex-end' } }}>
                        {mode === 'update' && (
                            <>
                                <Button
                                    variant="outlined"
                                    startIcon={<DownloadIcon sx={{ fontSize: '16px !important' }} />}
                                    onClick={e => setDocAnchorEl(e.currentTarget)}
                                    sx={{
                                        borderRadius: '9px', textTransform: 'none', fontWeight: 600, fontSize: '13px',
                                        borderColor: '#dde3ea', color: '#4a5568',
                                        '&:hover': { borderColor: '#0040a1', color: '#0040a1', backgroundColor: '#f0f5ff' },
                                    }}
                                >
                                    Exporter
                                </Button>
                                <Menu
                                    anchorEl={docAnchorEl} open={Boolean(docAnchorEl)} onClose={() => setDocAnchorEl(null)}
                                    PaperProps={{ sx: { borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', minWidth: 240, mt: 1, border: '1px solid #edf0f5' } }}
                                >
                                    <Box sx={{ px: 2, py: 1.5 }}>
                                        <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#8896a8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                            Documents disponibles
                                        </Typography>
                                    </Box>
                                    <Divider sx={{ borderColor: '#f1f5f9' }} />
                                    {DOCUMENT_TYPES.map(doc => (
                                        <MenuItem key={doc.key} onClick={() => handleDownload(doc.key, doc.label)}
                                            sx={{ py: 1.5, px: 2, gap: 1.5, '&:hover': { backgroundColor: '#f0f5ff' } }}>
                                            <ListItemIcon sx={{ color: '#0040a1', minWidth: 32 }}>{doc.icon}</ListItemIcon>
                                            <ListItemText primary={doc.label} primaryTypographyProps={{ fontSize: '13px', fontWeight: 500 }} />
                                        </MenuItem>
                                    ))}
                                </Menu>
                            </>
                        )}
                        {/* AI Scan Button */}
                        {(canAdd || canModify) && (
                            <Button
                                variant="outlined"
                                startIcon={<AutoAwesomeIcon sx={{ fontSize: '16px !important' }} />}
                                onClick={() => setScanOpen(true)}
                                sx={{
                                    borderRadius: '9px', textTransform: 'none', fontWeight: 600, fontSize: '13px',
                                    borderColor: '#0040a1', color: '#0040a1',
                                    background: 'linear-gradient(135deg, rgba(0,64,161,0.04) 0%, rgba(26,110,255,0.04) 100%)',
                                    '&:hover': { borderColor: '#0040a1', backgroundColor: 'rgba(0,64,161,0.08)', boxShadow: '0 2px 8px rgba(0,64,161,0.15)' },
                                }}
                            >
                                Scanner un document
                            </Button>
                        )}
                        {((mode === 'save' && canAdd) || (mode === 'update' && canModify)) && (
                            <Button
                                variant="contained"
                                startIcon={isSaving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon sx={{ fontSize: '16px !important' }} />}
                                onClick={handleSave}
                                disabled={isSaving}
                                sx={{
                                    borderRadius: '9px', textTransform: 'none', fontWeight: 700, fontSize: '13px',
                                    background: 'linear-gradient(135deg, #0040a1 0%, #1a6eff 100%)',
                                    boxShadow: '0 4px 14px rgba(0,64,161,0.3)',
                                    px: 2.5,
                                    '&:hover': { background: 'linear-gradient(135deg, #003080 0%, #0040a1 100%)', boxShadow: '0 4px 18px rgba(0,64,161,0.4)' },
                                }}
                            >
                                {mode === 'save' ? "Créer l'employé" : 'Enregistrer les modifications'}
                            </Button>
                        )}
                    </Box>
                </Box>

                {/* ── Body ── */}
                {!canConsult ? (
                    <Box sx={{ p: 4, textAlign: 'center', backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', m: 3 }}>
                        <PersonIcon sx={{ fontSize: 64, color: '#ba1a1a', opacity: 0.2, mb: 2 }} />
                        <Typography variant="h6" color="error">Accès Refusé</Typography>
                        <Typography sx={{ color: '#64748b' }}>Vous n'avez pas les droits nécessaires pour consulter cette fiche collaborateur.</Typography>
                    </Box>
                ) : (
                    <>
                        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: { xs: 1.5, sm: 3 }, maxWidth: 1200, mx: 'auto', width: '100%' }}>

                            {/* ── Main column ── */}
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, minWidth: 0, width: '100%' }}>

                                {/* Informations de base */}
                                <Paper elevation={0} sx={sectionCard}>
                                    <Box sx={sectionHeader()}>
                                        <Box sx={iconBox()}>
                                            <PersonIcon sx={{ color: '#0040a1', fontSize: 18 }} />
                                        </Box>
                                        <Typography sx={{ fontSize: '14px', fontWeight: 700, fontFamily: 'Manrope, sans-serif', color: '#0d1f3c' }}>
                                            Informations de base
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 2fr' }, gap: 2 }}>
                                        <Box>
                                            <Typography sx={labelStyle}>Matricule</Typography>
                                            <TextField name="empcod" value={formData.empcod} onChange={handleField} size="small" fullWidth
                                                InputProps={{ readOnly: mode === 'update' }} sx={fieldStyle} placeholder="EMP-2024-000" />
                                        </Box>
                                        <Box>
                                            <Typography sx={labelStyle}>Nom complet</Typography>
                                            <TextField name="emplib" value={formData.emplib} onChange={handleField} size="small" fullWidth sx={fieldStyle} placeholder="Jean-Christophe Roussel" />
                                        </Box>
                                        <Box>
                                            <Typography sx={labelStyle}>Sexe</Typography>
                                            <FormControl fullWidth size="small">
                                                <Select value={formData.empsexe || ''} onChange={handleSelect('empsexe')} sx={selectStyle} displayEmpty>
                                                    <MenuItem value=""><em style={{ color: '#aaa' }}>—</em></MenuItem>
                                                    <MenuItem value="M">Masculin</MenuItem>
                                                    <MenuItem value="F">Féminin</MenuItem>
                                                </Select>
                                            </FormControl>
                                        </Box>
                                        <Box>
                                            <Typography sx={labelStyle}>CIN / ID</Typography>
                                            <TextField name="empcin" value={formData.empcin} onChange={handleField} size="small" fullWidth sx={fieldStyle} placeholder="SJB88920" />
                                        </Box>
                                        <Box>
                                            <Typography sx={labelStyle}>Date de naissance</Typography>
                                            <TextField name="empdnais" type="date" value={formData.empdnais || ''} onChange={handleField} size="small" fullWidth sx={fieldStyle} InputLabelProps={{ shrink: true }} />
                                        </Box>
                                        <Box>
                                            <Typography sx={labelStyle}>Lieu de naissance</Typography>
                                            <TextField name="emplnais" value={formData.emplnais || ''} onChange={handleField} size="small" fullWidth sx={fieldStyle} />
                                        </Box>
                                        <Box>
                                            <Typography sx={labelStyle}>Situation familiale</Typography>
                                            <FormControl fullWidth size="small">
                                                <Select value={formData.empsitfam || ''} onChange={handleSelect('empsitfam')} sx={selectStyle} displayEmpty>
                                                    <MenuItem value=""><em style={{ color: '#aaa' }}>—</em></MenuItem>
                                                    <MenuItem value="C">Célibataire</MenuItem>
                                                    <MenuItem value="M">Marié(e)</MenuItem>
                                                    <MenuItem value="D">Divorcé(e)</MenuItem>
                                                    <MenuItem value="V">Veuf/Veuve</MenuItem>
                                                </Select>
                                            </FormControl>
                                        </Box>
                                        <Box>
                                            <Typography sx={labelStyle}>Nb. personnes à charge</Typography>
                                            <TextField name="empnbp" type="number" value={formData.empnbp ?? 0} onChange={handleField} size="small" fullWidth sx={fieldStyle} />
                                        </Box>
                                        <Box>
                                            <Typography sx={labelStyle}>Email</Typography>
                                            <TextField name="empemail" type="email" value={formData.empemail || ''} onChange={handleField} size="small" fullWidth sx={fieldStyle}
                                                InputProps={{ startAdornment: <EmailIcon sx={{ fontSize: 16, color: '#94a3b8', mr: 1 }} /> }}
                                                placeholder="jean.dupont@entreprise.com" />
                                        </Box>
                                        <Box>
                                            <Typography sx={labelStyle}>Niveau employé</Typography>
                                            <FormControl fullWidth size="small">
                                                <Select value={formData.empniv || ''} onChange={handleSelect('empniv')} sx={selectStyle} displayEmpty>
                                                    <MenuItem value=""><em style={{ color: '#aaa' }}>—</em></MenuItem>
                                                    <MenuItem value="0">Exécutant</MenuItem>
                                                    <MenuItem value="1">Maitrise</MenuItem>
                                                    <MenuItem value="2">Cadre</MenuItem>
                                                </Select>
                                            </FormControl>
                                        </Box>
                                        <Box>
                                            <Typography sx={labelStyle}>Ville</Typography>
                                            <SelectWithAdd value={formData.vilcod || ''}
                                                onChange={v => setFormData(p => ({ ...p, vilcod: v }))}
                                                options={vilMap} onAdd={handleAddVille} addTitle="Nouvelle Ville" />
                                        </Box>
                                        <Box>
                                            <Typography sx={labelStyle}>Pays</Typography>
                                            <SelectWithAdd value={formData.natcod || ''}
                                                onChange={v => setFormData(p => ({ ...p, natcod: v }))}
                                                options={payMap} onAdd={handleAddPays} addTitle="Nouveau Pays" />
                                        </Box>
                                    </Box>
                                </Paper>

                                {/* Coordonnées */}
                                <Paper elevation={0} sx={sectionCard}>
                                    <Box sx={sectionHeader()}>
                                        <Box sx={iconBox('rgba(16,185,129,0.08)')}>
                                            <PhoneIcon sx={{ color: '#10b981', fontSize: 18 }} />
                                        </Box>
                                        <Typography sx={{ fontSize: '14px', fontWeight: 700, fontFamily: 'Manrope, sans-serif', color: '#0d1f3c' }}>
                                            Coordonnées
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2 }}>
                                        <Box>
                                            <Typography sx={labelStyle}>Adresse</Typography>
                                            <TextField name="empadr" value={formData.empadr || ''} onChange={handleField} size="small" fullWidth sx={fieldStyle}
                                                InputProps={{ startAdornment: <LocationOnIcon sx={{ fontSize: 16, color: '#94a3b8', mr: 1 }} /> }}
                                                placeholder="123 Rue Example" />
                                        </Box>
                                        <Box>
                                            <Typography sx={labelStyle}>Téléphone</Typography>
                                            <TextField name="emptel" value={formData.emptel || ''} onChange={handleField} size="small" fullWidth sx={fieldStyle}
                                                InputProps={{ startAdornment: <PhoneIcon sx={{ fontSize: 16, color: '#94a3b8', mr: 1 }} /> }}
                                                placeholder="+213 555 000 000" />
                                        </Box>
                                        <Box>
                                            <Typography sx={labelStyle}>Mobile</Typography>
                                            <TextField name="empmob" value={formData.empmob || ''} onChange={handleField} size="small" fullWidth sx={fieldStyle}
                                                InputProps={{ startAdornment: <PhoneIcon sx={{ fontSize: 16, color: '#94a3b8', mr: 1 }} /> }}
                                                placeholder="+213 555 000 000" />
                                        </Box>
                                    </Box>
                                </Paper>

                                {/* Informations de travail + Détails Employé */}
                                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2.5 }}>

                                    {/* Travail */}
                                    <Paper elevation={0} sx={sectionCard}>
                                        <Box sx={sectionHeader()}>
                                            <Box sx={iconBox()}>
                                                <WorkIcon sx={{ color: '#0040a1', fontSize: 18 }} />
                                            </Box>
                                            <Typography sx={{ fontSize: '14px', fontWeight: 700, fontFamily: 'Manrope, sans-serif', color: '#0d1f3c' }}>
                                                Informations de travail
                                            </Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.8 }}>
                                            {[{ lbl: "Date d'embauche", type: 'date', name: 'empemb', val: formData.empemb ? dayjs(formData.empemb).format('YYYY-MM-DD') : '' }].map(f => (
                                                <Box key={f.name}>
                                                    <Typography sx={labelStyle}>{f.lbl}</Typography>
                                                    <TextField name={f.name} type={f.type} value={f.val} onChange={handleField} size="small" fullWidth sx={fieldStyle} InputLabelProps={{ shrink: true }}
                                                        InputProps={{ startAdornment: <CalendarTodayIcon sx={{ fontSize: 16, color: '#94a3b8', mr: 1 }} /> }} />
                                                </Box>
                                            ))}
                                            <Box>
                                                <Typography sx={labelStyle}>Type de contrat</Typography>
                                                <FormControl fullWidth size="small">
                                                    <Select value={formData.empcontrat || ''} onChange={handleSelect('empcontrat')} sx={selectStyle} displayEmpty>
                                                        <MenuItem value=""><em style={{ color: '#aaa' }}>—</em></MenuItem>
                                                        <MenuItem value="CDI">CDI</MenuItem>
                                                        <MenuItem value="CDD">CDD</MenuItem>
                                                        <MenuItem value="STAGE">Stage</MenuItem>
                                                        <MenuItem value="FREELANCE">Freelance</MenuItem>
                                                    </Select>
                                                </FormControl>
                                            </Box>
                                            <Box>
                                                <Typography sx={labelStyle}>Régime</Typography>
                                                <FormControl fullWidth size="small">
                                                    <Select value={formData.empreg || ''} onChange={handleSelect('empreg')} sx={selectStyle} displayEmpty>
                                                        <MenuItem value=""><em style={{ color: '#aaa' }}>—</em></MenuItem>
                                                        <MenuItem value="M">Mensuelle</MenuItem>
                                                        <MenuItem value="H">Horaire</MenuItem>
                                                    </Select>
                                                </FormControl>
                                            </Box>
                                            <Box>
                                                <Typography sx={labelStyle}>Filiale (Site)</Typography>
                                                <SelectWithAdd value={formData.sitcod || ''}
                                                    onChange={v => setFormData(p => ({ ...p, sitcod: v }))}
                                                    options={sitMap} onAdd={handleAddSite} addTitle="Nouvelle Filiale" />
                                            </Box>
                                            <Box>
                                                <Typography sx={labelStyle}>Service</Typography>
                                                <SelectWithAdd value={formData.sercod || ''}
                                                    onChange={v => setFormData(p => ({ ...p, sercod: v }))}
                                                    options={serviceLibs} onAdd={handleAddService} addTitle="Nouveau Service" />
                                            </Box>
                                            <Box>
                                                <Typography sx={labelStyle}>Classe Horaire</Typography>
                                                <SelectWithAdd value={formData.catcod || ''}
                                                    onChange={v => setFormData(p => ({ ...p, catcod: v }))}
                                                    options={classeHoraireLibs} onAdd={handleAddClasseHoraire} addTitle="Nouvelle Classe Horaire" />
                                            </Box>
                                            <Box>
                                                <Typography sx={labelStyle}>Calendrier</Typography>
                                                <FormControl fullWidth size="small">
                                                    <Select value={formData.caltype || ''} onChange={handleSelect('caltype')} sx={selectStyle} displayEmpty>
                                                        <MenuItem value=""><em style={{ color: '#aaa' }}>—</em></MenuItem>
                                                        {calendrierLibs.map((cal: any) => (
                                                            <MenuItem key={cal.caltype} value={cal.caltype} sx={{ fontSize: '13px' }}>
                                                                {cal.callib}
                                                            </MenuItem>
                                                        ))}
                                                    </Select>
                                                </FormControl>
                                            </Box>
                                        </Box>
                                    </Paper>

                                    {/* Détails Employé */}
                                    <Paper elevation={0} sx={sectionCard}>
                                        <Box sx={sectionHeader()}>
                                            <Box sx={iconBox()}>
                                                <BadgeIcon sx={{ color: '#0040a1', fontSize: 18 }} />
                                            </Box>
                                            <Typography sx={{ fontSize: '14px', fontWeight: 700, fontFamily: 'Manrope, sans-serif', color: '#0d1f3c' }}>
                                                Détails Employé
                                            </Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.8 }}>

                                            <Box>
                                                <Typography sx={labelStyle}>Fonction</Typography>
                                                <SelectWithAdd value={formData.foncod || ''}
                                                    onChange={v => setFormData(p => ({ ...p, foncod: v }))}
                                                    options={fonMap} onAdd={handleAddFonction} addTitle="Nouvelle Fonction" />
                                            </Box>
                                            <Box>
                                                <Typography sx={labelStyle}>Qualification</Typography>
                                                <SelectWithAdd value={formData.quacod || ''}
                                                    onChange={v => setFormData(p => ({ ...p, quacod: v }))}
                                                    options={quaMap} onAdd={handleAddQualification} addTitle="Nouvelle Qualification" />
                                            </Box>
                                            <Box>
                                                <Typography sx={labelStyle}>Direction</Typography>
                                                <SelectWithAdd value={formData.dircod || ''}
                                                    onChange={v => setFormData(p => ({ ...p, dircod: v }))}
                                                    options={dirMap} onAdd={handleAddDirection} addTitle="Nouvelle Direction" />
                                            </Box>
                                            <Box>
                                                <Typography sx={labelStyle}>Section</Typography>
                                                <SelectWithAdd value={formData.seccod || ''}
                                                    onChange={v => setFormData(p => ({ ...p, seccod: v }))}
                                                    options={secMap} onAdd={handleAddSection} addTitle="Nouvelle Section" />
                                            </Box>
                                            <Box>
                                                <Typography sx={labelStyle}>Date d'embauche</Typography>
                                                <TextField name="empemb2" type="date" value={formData.empemb ? dayjs(formData.empemb).format('YYYY-MM-DD') : ''} onChange={handleField} size="small" fullWidth sx={fieldStyle} InputLabelProps={{ shrink: true }} />
                                            </Box>
                                            <Box>
                                                <Typography sx={labelStyle}>Statut</Typography>
                                                <FormControl fullWidth size="small">
                                                    <Select value={formData.actif || 'A'} onChange={handleSelect('actif')} sx={selectStyle}>
                                                        <MenuItem value="A">Actif</MenuItem>
                                                        <MenuItem value="N">Inactif</MenuItem>
                                                    </Select>
                                                </FormControl>
                                            </Box>
                                            <Box>
                                                <Typography sx={labelStyle}>Rôle Utilisateur</Typography>
                                                <FormControl fullWidth size="small">
                                                    <Select value={formData.utirole || 'Utilisateur Standard'} onChange={handleSelect('utirole')} sx={selectStyle}>
                                                        {roles.length > 0 ? (
                                                            roles.map(r => (
                                                                <MenuItem key={r.roleId} value={r.roleName}>{r.roleName}</MenuItem>
                                                            ))
                                                        ) : (
                                                            <MenuItem value="Utilisateur Standard">Utilisateur Standard</MenuItem>
                                                        )}
                                                    </Select>
                                                </FormControl>
                                            </Box>
                                            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2, mt: 0.5 }}>
                                                <Box>
                                                    <Typography sx={labelStyle}>Jour Max / Mois</Typography>
                                                    <TextField name="empmaxjour" type="number" value={formData.empmaxjour ?? 0} onChange={handleField} size="small" fullWidth sx={fieldStyle} placeholder="0 = illimité" />
                                                </Box>
                                                <Box>
                                                    <Typography sx={labelStyle}>Max Heure / Jour</Typography>
                                                    <TextField name="empmaxhre" type="number" value={formData.empmaxhre ?? 0} onChange={handleField} size="small" fullWidth sx={fieldStyle} placeholder="0 = illimité" />
                                                </Box>
                                                <Box>
                                                    <Typography sx={labelStyle}>Min Heure / Jour</Typography>
                                                    <TextField name="empminhjour" type="number" value={formData.empminhjour ?? 0} onChange={handleField} size="small" fullWidth sx={fieldStyle} placeholder="0" />
                                                </Box>
                                            </Box>
                                            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                                                <Box>
                                                    <Typography sx={labelStyle}>Compter Repos</Typography>
                                                    <FormControl fullWidth size="small">
                                                        <Select value={formData.empferepos || '0'} onChange={handleSelect('empferepos')} sx={selectStyle}>
                                                            <MenuItem value="0">0- Ne pas compter</MenuItem>
                                                            <MenuItem value="1">1- Tous les repos</MenuItem>
                                                            <MenuItem value="2">2- Repos Samedi</MenuItem>
                                                            <MenuItem value="3">3- Repos Dimanche</MenuItem>
                                                        </Select>
                                                    </FormControl>
                                                </Box>
                                                <Box>
                                                    <Typography sx={labelStyle}>Panier</Typography>
                                                    <FormControl fullWidth size="small">
                                                        <Select value={formData.emppanier || '0'} onChange={handleSelect('emppanier')} sx={selectStyle}>
                                                            <MenuItem value="0">0- Pas de panier</MenuItem>
                                                            <MenuItem value="1">1- Panier 7H</MenuItem>
                                                            <MenuItem value="2">2- Panier 6H</MenuItem>
                                                        </Select>
                                                    </FormControl>
                                                </Box>
                                            </Box>
                                            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                                                <Box>
                                                    <Typography sx={labelStyle}>Heures Nuit</Typography>
                                                    <FormControl fullWidth size="small">
                                                        <Select value={formData.empnuit || '0'} onChange={handleSelect('empnuit')} sx={selectStyle}>
                                                            <MenuItem value="0">0- Normal</MenuItem>
                                                            <MenuItem value="1">1- Spécial</MenuItem>
                                                        </Select>
                                                    </FormControl>
                                                </Box>
                                                <Box>
                                                    <Typography sx={labelStyle}>Éliminer Retard</Typography>
                                                    <FormControl fullWidth size="small">
                                                        <Select value={formData.empretard || '0'} onChange={handleSelect('empretard')} sx={selectStyle}>
                                                            <MenuItem value="0">Non</MenuItem>
                                                            <MenuItem value="1">Oui</MenuItem>
                                                        </Select>
                                                    </FormControl>
                                                </Box>
                                            </Box>
                                        </Box>
                                    </Paper>
                                </Box>

                                {/* Rémunération */}
                                <Paper elevation={0} sx={{
                                    borderRadius: '16px', overflow: 'hidden',
                                    background: 'linear-gradient(135deg, #0a1631 0%, #0d2137 40%, #112240 100%)',
                                    border: '1px solid rgba(100,150,255,0.12)',
                                    boxShadow: '0 8px 32px rgba(10,22,49,0.4)',
                                }}>
                                    <Box sx={{ px: 3, pt: 2.5, pb: 2, display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                        <Box sx={{ backgroundColor: 'rgba(96,165,250,0.15)', p: '7px', borderRadius: '8px', display: 'flex' }}>
                                            <PaymentsIcon sx={{ color: '#93c5fd', fontSize: 18 }} />
                                        </Box>
                                        <Typography sx={{ fontSize: '14px', fontWeight: 700, fontFamily: 'Manrope, sans-serif', color: '#e2e8f0' }}>
                                            Rémunération
                                        </Typography>
                                        <Chip label="Confidentiel" size="small" sx={{ ml: 'auto', backgroundColor: 'rgba(251,191,36,0.12)', color: '#fbbf24', fontWeight: 700, fontSize: '9px', height: 22, letterSpacing: '0.04em' }} />
                                    </Box>
                                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2.5, px: 3, py: 3 }}>
                                        {[
                                            { label: 'Salaire de Base', name: 'empsbase', value: formData.empsbase, icon: <TrendingUpIcon sx={{ fontSize: 14, color: '#60a5fa' }} /> },
                                            { label: 'Salaire Brut', name: 'empsbrut', value: formData.empsbrut, icon: <AccountBalanceWalletIcon sx={{ fontSize: 14, color: '#34d399' }} /> },
                                            { label: 'Salaire Net', name: 'empsnet', value: formData.empsnet, icon: <PaymentsIcon sx={{ fontSize: 14, color: '#a78bfa' }} /> },
                                        ].map(field => (
                                            <Box key={field.name}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 1 }}>
                                                    {field.icon}
                                                    <Typography sx={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8' }}>
                                                        {field.label}
                                                    </Typography>
                                                </Box>
                                                <TextField
                                                    name={field.name}
                                                    value={field.value || ''}
                                                    onChange={handleField}
                                                    size="small"
                                                    fullWidth
                                                    placeholder="—"
                                                    sx={{
                                                        '& .MuiOutlinedInput-root': {
                                                            backgroundColor: 'rgba(255,255,255,0.06)',
                                                            borderRadius: '10px',
                                                            '& fieldset': { border: '1px solid rgba(255,255,255,0.1)' },
                                                            '&:hover fieldset': { borderColor: 'rgba(147,197,253,0.3)' },
                                                            '&.Mui-focused fieldset': { borderColor: 'rgba(147,197,253,0.5)' },
                                                            '& input': { color: '#f1f5f9', fontWeight: 700, fontSize: '15px', fontFamily: 'Manrope, sans-serif', padding: '10px 14px' },
                                                        },
                                                    }}
                                                />
                                            </Box>
                                        ))}
                                    </Box>
                                    <Box sx={{ height: 3, background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #06b6d4)', mt: 'auto' }} />
                                </Paper>

                                {/* Horaires de l'employé sélectionné */}
                                <Paper elevation={0} sx={sectionCard}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, pb: 2, borderBottom: '1px solid #f1f5f9' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                            <Box sx={iconBox()}>
                                                <ScheduleIcon sx={{ color: '#0040a1', fontSize: 18 }} />
                                            </Box>
                                            <Typography sx={{ fontSize: '14px', fontWeight: 700, fontFamily: 'Manrope, sans-serif', color: '#0d1f3c' }}>
                                                Horaires de l'employé sélectionné
                                            </Typography>
                                        </Box>
                                        <Chip
                                            label="Semaine en cours"
                                            size="small"
                                            sx={{ backgroundColor: '#dbeafe', color: '#1d4ed8', fontWeight: 700, fontSize: '10px', letterSpacing: '0.04em' }}
                                        />
                                    </Box>

                                    {/* Table header */}
                                    <Box sx={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr 1fr 1fr 100px', gap: 0, mb: 1 }}>
                                        {['POSTE', 'ENTRÉE MATIN', 'SORTIE MATIN', 'ENTRÉE AM', 'SORTIE AM', 'STATUT'].map(h => (
                                            <Typography key={h} sx={{ fontSize: '9px', fontWeight: 700, color: '#8896a8', textTransform: 'uppercase', letterSpacing: '0.1em', px: 1.5, py: 1 }}>
                                                {h}
                                            </Typography>
                                        ))}
                                    </Box>
                                    <Divider sx={{ borderColor: '#f1f5f9', mb: 1 }} />

                                    {/* Rows */}
                                    {empHoraires.length > 0 ? empHoraires.map((h, i) => (
                                        <Box key={i} sx={{
                                            display: 'grid', gridTemplateColumns: '160px 1fr 1fr 1fr 1fr 100px',
                                            alignItems: 'center',
                                            backgroundColor: i % 2 === 0 ? '#fafbfc' : '#fff',
                                            borderRadius: '8px', mb: 0.5,
                                            '&:hover': { backgroundColor: '#f0f5ff' },
                                        }}>
                                            <Box sx={{ px: 1.5, py: 1.5 }}>
                                                <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#0d1f3c' }}>{h.poste}</Typography>
                                                <Typography sx={{ fontSize: '11px', color: '#8896a8' }}>{h.jour}</Typography>
                                            </Box>
                                            {[h.entreeM, h.sortieM, h.entreeAM, h.sortieAM].map((val, vi) => (
                                                <Box key={vi} sx={{ px: 1.5, py: 1.5 }}>
                                                    <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#334155', fontFamily: 'monospace' }}>{val}</Typography>
                                                </Box>
                                            ))}
                                            <Box sx={{ px: 1.5, py: 1.5 }}>
                                                {h.statut === 'valide' ? (
                                                    <Chip
                                                        label="Travail"
                                                        size="small"
                                                        icon={<CheckCircleIcon sx={{ fontSize: '12px !important', color: '#16a34a !important' }} />}
                                                        sx={{ backgroundColor: '#dcfce7', color: '#166534', fontWeight: 700, fontSize: '10px', height: 22 }}
                                                    />
                                                ) : h.statut === 'repos' ? (
                                                    <Chip
                                                        label="Repos"
                                                        size="small"
                                                        sx={{ backgroundColor: '#f1f5f9', color: '#64748b', fontWeight: 700, fontSize: '10px', height: 22 }}
                                                    />
                                                ) : (
                                                    <Chip
                                                        label="—"
                                                        size="small"
                                                        sx={{ backgroundColor: '#f4f4f4', color: '#aaa', fontWeight: 700, fontSize: '10px', height: 22 }}
                                                    />
                                                )}
                                            </Box>
                                        </Box>
                                    )) : (
                                        <Box sx={{ py: 4, textAlign: 'center', color: '#94a3b8' }}>
                                            <Typography sx={{ fontSize: '13px' }}>Aucun horaire défini pour cet employé</Typography>
                                        </Box>
                                    )}
                                </Paper>
                            </Box>
                        </Box>

                        {/* ── Right Sidebar (Employees List) ── */}
                        <Box sx={{
                            width: 320,
                            backgroundColor: '#fff',
                            borderLeft: '1px solid #edf0f5',
                            display: { xs: 'none', lg: 'flex' },
                            flexDirection: 'column',
                            height: 'calc(100vh - 64px)',
                            position: 'sticky',
                            top: 64,
                        }}>
                            <Box sx={{ p: 2, borderBottom: '1px solid #f1f5f9' }}>
                                <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#0d1f3c', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <GroupsIcon sx={{ fontSize: 18, color: '#0040a1' }} />
                                    Annuaire Collaborateurs
                                </Typography>
                                <TextField
                                    size="small"
                                    fullWidth
                                    placeholder="Rechercher nom, matricule, position..."
                                    value={empSearchQuery}
                                    onChange={e => setEmpSearchQuery(e.target.value)}
                                    sx={{
                                        '& .MuiOutlinedInput-root': { borderRadius: '10px', backgroundColor: '#f8fafc' },
                                        '& .MuiInputBase-input': { fontSize: '13px' }
                                    }}
                                    InputProps={{
                                        startAdornment: <SearchIcon sx={{ fontSize: 18, color: '#94a3b8', mr: 1 }} />
                                    }}
                                />
                            </Box>
                            <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
                                {isListLoading ? (
                                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress size={24} /></Box>
                                ) : filteredEmployees.map(emp => (
                                    <Box
                                        key={emp.empcod}
                                        onClick={() => navigate(`/dashboard/profil-employe?id=${emp.empcod}`)}
                                        sx={{
                                            p: 1.5,
                                            borderRadius: '12px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            backgroundColor: formData.empcod === emp.empcod ? '#f0f5ff' : 'transparent',
                                            border: formData.empcod === emp.empcod ? '1px solid #cce0ff' : '1px solid transparent',
                                            '&:hover': { backgroundColor: formData.empcod === emp.empcod ? '#f0f5ff' : '#f8fafc' }
                                        }}
                                    >
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                            <Avatar sx={{ width: 32, height: 32, fontSize: '14px', bgcolor: formData.empcod === emp.empcod ? '#0040a1' : '#e2e8f0', color: formData.empcod === emp.empcod ? '#fff' : '#475569' }}>
                                                {emp.emplib?.charAt(0)}
                                            </Avatar>
                                            <Box sx={{ minWidth: 0 }}>
                                                <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                    {emp.emplib}
                                                </Typography>
                                                <Typography sx={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                    <BadgeIcon sx={{ fontSize: 12 }} /> {emp.empcod} • {fonMap[emp.foncod || ''] || fonMap[emp.empfonc || ''] || emp.empfonc || 'Sans poste'}
                                                    {(() => {
                                                      const c = (emp.empcontrat || '').toUpperCase();
                                                      if (!c) return null;
                                                      const colors: Record<string, { bg: string; color: string }> = {
                                                        CDI: { bg: '#d1fae5', color: '#047857' },
                                                        CDD: { bg: '#dbeafe', color: '#1d4ed8' },
                                                        STAGE: { bg: '#fef3c7', color: '#b45309' },
                                                        FREELANCE: { bg: '#ede9fe', color: '#6d28d9' },
                                                      };
                                                      const col = colors[c] || { bg: '#f1f5f9', color: '#475569' };
                                                      const label = c === 'STAGE' ? 'Stage' : c === 'FREELANCE' ? 'Freelance' : emp.empcontrat;
                                                      return <Chip label={label} size="small" sx={{ ml: 0.5, height: 16, fontSize: '9px', fontWeight: 700, backgroundColor: col.bg, color: col.color, borderRadius: '4px' }} />;
                                                    })()}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                    </>
                )}
            </Box>

            {/* AI Document Scan Modal */}
            {(canAdd || canModify) && (
                <DocumentScanEmploye
                    open={scanOpen}
                    onClose={() => setScanOpen(false)}
                    onApplyData={handleApplyScanData}
                />
            )}

            <Snackbar open={isSnackbarOpen} autoHideDuration={4000} onClose={() => setIsSnackbarOpen(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
                <Alert onClose={() => setIsSnackbarOpen(false)} severity={severity} sx={{ borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.12)' }}>
                    {message}
                </Alert>
            </Snackbar>
        </Box>
);
};

const queryClient = new QueryClient();

const EmployeModern = () => (
    <QueryClientProvider client={queryClient}>
        <EmployeeProvider>
            <EmployeModernInner />
        </EmployeeProvider>
    </QueryClientProvider>
);

export default EmployeModern;