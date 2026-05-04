import React, { useContext, useEffect, useState, useMemo } from 'react';
import {
    Box, Typography, Paper, Button, Snackbar, Alert,
    TextField, Select, MenuItem, FormControl, CircularProgress,
    IconButton, Menu, ListItemIcon, ListItemText, Divider, Chip,
    Dialog, DialogTitle, DialogContent, DialogActions, Avatar,
    InputAdornment, Tooltip,
} from '@mui/material';
import AutorenewIcon from '@mui/icons-material/Autorenew';
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
import { useTranslation } from 'react-i18next';
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
import { ROLE_LABELS } from '../../models/Utilisateur';
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
    // Rôle système "Employee" par défaut (libellé UI : "Employé"). On stocke le nom
    // officiel pour que la jointure RolePermissions retrouve les droits associés ;
    // un libellé libre comme "Utilisateur Standard" n'a aucun mapping de permissions.
    utirole: 'Employee',
});

// ── SelectWithAdd: dropdown + quick-add popup ─────────────────────────────────
function SelectWithAdd({ value, onChange, options, onAdd, addTitle }: {
    value: string;
    onChange: (v: string) => void;
    options: Record<string, string>;
    onAdd: (code: string, lib: string) => Promise<void>;
    addTitle: string;
}) {
    const { t } = useTranslation();
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
                        <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>{t('common.code')}</Typography>
                        <TextField size="small" fullWidth value={newCode} onChange={e => setNewCode(e.target.value)} sx={fSx} />
                    </Box>
                    <Box>
                        <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>{t('common.label')}</Typography>
                        <TextField size="small" fullWidth value={newLib} onChange={e => setNewLib(e.target.value)} sx={fSx} />
                    </Box>
                </DialogContent>
                <Divider />
                <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
                    <Button onClick={() => setOpen(false)} sx={{ borderRadius: '8px', textTransform: 'none', color: '#64748b' }}>{t('common.cancel')}</Button>
                    <Button variant="contained" onClick={handleAdd} disabled={saving || !newCode.trim() || !newLib.trim()}
                        startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
                        sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 700, background: 'linear-gradient(135deg, #0040a1 0%, #0056d2 100%)' }}>
                        {t('common.add')}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}

// ── Inner component ───────────────────────────────────────────────────────────
const EmployeModernInner = () => {
    const { t } = useTranslation();
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
            showSnackbar(t('employe.addedDirection'), 'success');
        } catch (err) {
            showSnackbar(t('employe.addErrorDirection'), 'error');
            throw err;
        }
    };
    const handleAddFonction = async (code: string, lib: string) => {
        try {
            await apiInstance.post('/Fonctions', { soccod, foncod: code, fonlib: lib });
            queryClient.invalidateQueries('fonlibs');
            showSnackbar(t('employe.addedFunction'), 'success');
        } catch (err) {
            showSnackbar(t('employe.addErrorFunction'), 'error');
            throw err;
        }
    };
    const handleAddSection = async (code: string, lib: string) => {
        try {
            await apiInstance.post('/Sections', { soccod, seccod: code, seclib: lib });
            queryClient.invalidateQueries('sec-libs');
            showSnackbar(t('employe.addedSection'), 'success');
        } catch (err) {
            showSnackbar(t('employe.addErrorSection'), 'error');
            throw err;
        }
    };
    const handleAddQualification = async (code: string, lib: string) => {
        try {
            await apiInstance.post('/Qualifs', { soccod, quacod: code, qualib: lib });
            queryClient.invalidateQueries('qualifs');
            showSnackbar(t('employe.addedQualification'), 'success');
        } catch (err) {
            showSnackbar(t('employe.addErrorQualification'), 'error');
            throw err;
        }
    };
    const handleAddService = async (code: string, lib: string) => {
        try {
            await apiInstance.post('/Services', { soccod, sercod: code, serlib: lib });
            setServiceLibs(prev => ({ ...prev, [code]: lib }));
            showSnackbar(t('employe.addedService'), 'success');
        } catch (err) {
            showSnackbar(t('employe.addErrorService'), 'error');
            throw err;
        }
    };
    const handleAddClasseHoraire = async (code: string, lib: string) => {
        try {
            // catfixe:'1' = classe "toujours active" (sans plage temporelle Catdu/Catau).
            // Sinon `GetHorLibs` la filtre, et après l'enregistrement de l'employé elle ne réapparaît
            // pas dans le dropdown — l'utilisateur croit alors que l'affectation n'a pas été persistée.
            await apiInstance.post('/Lcategories', { soccod, catcod: code, catlib: lib, catperiode: 'N', catfixe: '1' });
            setClasseHoraireLibs(prev => ({ ...prev, [code]: lib }));
            showSnackbar(t('employe.addedSchedule'), 'success');
        } catch (err) {
            showSnackbar(t('employe.addErrorSchedule'), 'error');
            throw err;
        }
    };
    const handleAddSite = async (code: string, lib: string) => {
        try {
            await apiInstance.post('/Sites', { soccod, sitcod: code, sitlib: lib });
            queryClient.invalidateQueries('sitlibs');
            showSnackbar(t('employe.addedBranch'), 'success');
        } catch (err) {
            showSnackbar(t('employe.addErrorBranch'), 'error');
            throw err;
        }
    };
    const handleAddVille = async (code: string, lib: string) => {
        try {
            await apiInstance.post('/Villes', { soccod, vilcod: code, villib: lib });
            queryClient.invalidateQueries('villibs');
            showSnackbar(t('employe.addedCity'), 'success');
        } catch (err) {
            showSnackbar(t('employe.addErrorCity'), 'error');
            throw err;
        }
    };
    const handleAddPays = async (code: string, lib: string) => {
        try {
            await apiInstance.post('/Pays', { natcod: code, natlib: lib });
            queryClient.invalidateQueries('pays-libs');
            showSnackbar(t('employe.addedCountry'), 'success');
        } catch (err) {
            showSnackbar(t('employe.addErrorCountry'), 'error');
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
                .catch(() => showSnackbar(t('employe.loadError'), 'error'))
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

    /**
     * Demande au serveur le prochain code employé selon le mode paramétré (Parametre.Parmodemp).
     * Le nom courant du formulaire est passé en query : utile quand le mode est "N" (préfixe = nom).
     */
    const fetchNextEmpcod = React.useCallback(async () => {
        if (!soccod) return;
        try {
            const params = new URLSearchParams();
            if (sitcod) params.set('sitcod', sitcod);
            if (formData.emplib) params.set('nom', String(formData.emplib));
            const res = await apiInstance.get(`/Employes/get-next-empcod/${soccod}?${params.toString()}`);
            if (res.data?.empcod) setFormData(prev => ({ ...prev, empcod: res.data.empcod }));
        } catch (err) {
            console.error('Auto-génération du matricule échouée', err);
        }
    }, [soccod, sitcod, formData.emplib]);

    // Pré-remplissage à l'ouverture en mode création (si le matricule est encore vide).
    // ⚠ Ne PAS générer si l'URL contient un `id` : on est en mode édition mais `mode`
    // est encore 'save' tant que le GET get-employe n'est pas résolu. Sans cette garde,
    // l'auto-génération race avec le chargement et peut écraser le matricule existant
    // (ex: l'employé 000003 voyait un nouveau matricule apparaître dans le formulaire).
    useEffect(() => {
        if (empIdFromUrl) return;
        if (mode === 'save' && !formData.empcod && soccod) {
            fetchNextEmpcod();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, soccod, empIdFromUrl]);

    const refreshEmpHoraires = React.useCallback(async (empcodArg?: string) => {
        const empcod = empcodArg || formData.empcod;
        if (!empcod || !soccod) { setEmpHoraires([]); return; }
        try {
            const res = await apiInstance.get(`/Employes/get-emp-horaires/${soccod}/${empcod}`);
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
        } catch {
            setEmpHoraires([]);
        }
    }, [formData.empcod, soccod]);

    useEffect(() => {
        if (formData.empcod && soccod && mode === 'update') {
            refreshEmpHoraires();
        } else {
            setEmpHoraires([]);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    // Ancre la date à midi UTC pour empêcher les décalages de jour lors de la
    // sérialisation JSON (Date.toISOString convertit en UTC). Sans ça, en GMT+1
    // une saisie « 2026-05-04 » devient « 2026-05-03T23:00Z » → enregistrée en
    // base comme 2026-05-03 (la veille).
    const formatDate = (date: any): Date | null => {
        if (!date) return null;
        let y: number, m: number, d: number;
        if (date instanceof Date && !isNaN(date.getTime())) {
            y = date.getFullYear(); m = date.getMonth(); d = date.getDate();
        } else if (typeof date === 'string') {
            const dj = dayjs(date);
            if (!dj.isValid()) return null;
            y = dj.year(); m = dj.month(); d = dj.date();
        } else {
            return null;
        }
        return new Date(Date.UTC(y, m, d, 12, 0, 0));
    };

    const handleApplyScanData = (data: Partial<Employe>) => {
        // Le scan IA envoie souvent des chaînes vides ou null pour les champs qu'il n'a pas pu
        // extraire (ex: empcod absent d'un CIN). Si on fusionne tel quel, ces vides écrasent les
        // valeurs déjà calculées (ex: matricule auto-généré) → le POST renvoie 400 "Veuillez
        // remplir les champs obligatoires". On filtre donc les vides / null / undefined avant le merge.
        const cleaned: Partial<Employe> = {};
        Object.entries(data).forEach(([k, v]) => {
            if (v === null || v === undefined) return;
            if (typeof v === 'string' && v.trim() === '') return;
            (cleaned as any)[k] = v;
        });
        setFormData(prev => ({ ...prev, ...cleaned }));
        showSnackbar(t('employe.scanImportedSuccess'), 'success');
    };

    const handleSave = async () => {
        // Sécurité : si le matricule est vide à la création (cas d'un scan qui aurait écrasé
        // l'auto-fetch initial avec une valeur vide), on demande au backend un nouveau code
        // au dernier moment plutôt que d'envoyer un POST qui retournerait 400.
        if (mode === 'save' && !String(formData.empcod || '').trim() && soccod) {
            try {
                const params = new URLSearchParams();
                if (sitcod) params.set('sitcod', sitcod);
                if (formData.emplib) params.set('nom', String(formData.emplib));
                const r = await apiInstance.get(`/Employes/get-next-empcod/${soccod}?${params.toString()}`);
                if (r.data?.empcod) {
                    formData.empcod = r.data.empcod;
                    setFormData(prev => ({ ...prev, empcod: r.data.empcod }));
                }
            } catch { /* on laisse continuer ; la validation suivante affichera l'erreur */ }
        }

        // À la création, l'email est utilisé pour générer le compte Utilisateur. Sans email,
        // l'employé n'aura pas d'accès à l'application — on alerte explicitement avant de
        // laisser passer.
        const isCreating = mode === 'save';
        if (isCreating && !String(formData.empemail || '').trim()) {
            const proceed = window.confirm(
                "Aucun email renseigné.\n\n" +
                "Sans adresse email, cet employé ne pourra pas se connecter à l'application " +
                "(aucun compte utilisateur ne peut être créé).\n\n" +
                "Voulez-vous continuer quand même ?"
            );
            if (!proceed) return;
        }

        setIsSaving(true);
        // sitcod : on prend celui chargé sur la fiche (formData.sitcod), pas celui de l'utilisateur
        // connecté. Sinon un manager dont auth.sitcod ≠ sitcod de l'employé édité provoque un
        // UPDATE sur (Soccod, Sitcod, Empcod) qui ne matche aucune ligne, et toutes les modifs
        // (dont catcod) sont silencieusement perdues alors que le GET (filtré sur Soccod+Empcod)
        // continue de renvoyer la ligne intacte.
        const payload: Employe = {
            ...formData,
            soccod: soccod || '',
            sitcod: formData.sitcod || sitcod || '',
            empemb: formatDate(formData.empemb), empretraite: formatDate(formData.empretraite),
            empsort: formatDate(formData.empsort), empdcin: formatDate(formData.empdcin) || new Date(),
            empoptim: formatDate(formData.empoptim),
        };
        const onSuccess = async (res: any) => {
            queryClient.invalidateQueries('employe');
            queryClient.invalidateQueries(['employee-horaires', soccod, formData.empcod]);
            setIsSaving(false);
            if (mode === 'save') {
                showSnackbar(res?.message || t('employe.createdSuccess'), 'success');
                setMode('update');
                navigate(`/dashboard/gestion-employe?id=${formData.empcod}&new=false`);
                return;
            }
            // Mode update : le backend lève désormais une 404 explicite (KeyNotFoundException
            // côté UpdateEmployeAsync) si la ligne ciblée n'existe pas — donc un succès ici =
            // persistance garantie. On ne refait plus de reload de vérification : ça produisait
            // un 404 parasite dans la console pour rien (le GET a son propre filtre soft-delete
            // qui peut diverger du UPDATE) et un faux snackbar d'erreur.
            await refreshEmpHoraires(formData.empcod);
            showSnackbar(res?.message || t('employe.changesSaved'), 'success');
        };
        const onError = (err: any) => { showSnackbar(err?.response?.data?.message || t('employe.saveError'), 'error'); setIsSaving(false); };
        mode === 'save' ? addEmploye(payload, { onSuccess, onError }) : updateEmploye(payload, { onSuccess, onError });
    };

    const handleDownload = (docKey: string, docLabel: string) => {
        setDocAnchorEl(null);
        if (!formData.empcod || !soccod) { showSnackbar(t('employe.selectFirst'), 'error'); return; }

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
        if (!endpoint) { showSnackbar(t('employe.documentNotAvailable', { doc: docLabel }), 'error'); return; }

        apiInstance.get(endpoint, { responseType: 'blob' })
            .then(res => {
                const url = window.URL.createObjectURL(new Blob([res.data]));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `${docLabel}_${formData.emplib || formData.empcod}.pdf`);
                document.body.appendChild(link); link.click(); link.remove();
                window.URL.revokeObjectURL(url);
            })
            .catch(() => showSnackbar(t('employe.documentDownloadFail', { doc: docLabel }), 'error'));
    };

    if (isFetching) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
                <CircularProgress size={48} sx={{ color: '#0040a1' }} />
            </Box>
        );
    }

    // Rendu de la liste des collaborateurs (annuaire) — extrait pour pouvoir le placer
    // à gauche en mode update et le masquer en mode création.
    const renderAnnuaire = () => (
        <Box sx={{
            width: 320,
            backgroundColor: '#fff',
            borderRight: '1px solid #edf0f5',
            display: { xs: 'none', lg: 'flex' },
            flexDirection: 'column',
            height: '100vh',
            position: 'sticky',
            top: 0,
            flexShrink: 0,
        }}>
            <Box sx={{ p: 2, borderBottom: '1px solid #f1f5f9' }}>
                <Typography sx={{ fontSize: '12px', fontWeight: 700, color: '#0d1f3c', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <GroupsIcon sx={{ fontSize: 18, color: '#0040a1' }} />
                    Annuaire Collaborateurs
                </Typography>
                <TextField
                    size="small"
                    fullWidth
                    placeholder={t('employe.searchPlaceholder')}
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
    );

    return (
        // Pas de `overflowX: hidden` ici : ça crée un contexte de scroll qui casse `position: sticky`
        // sur le Top bar. On garde le scroll au niveau du body pour que le header reste collé en haut.
        <Box sx={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f0f3f8', fontFamily: 'Manrope, sans-serif', width: '100%', maxWidth: '100vw' }}>

            {/* ── Annuaire (sidebar gauche, mode update uniquement) ── */}
            {mode === 'update' && canConsult && renderAnnuaire()}

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
                                {mode === 'save' ? t('employe.newEmployeeBadge') : t('employe.profileBadge')}
                            </Typography>
                            <Typography sx={{ fontSize: '18px', fontWeight: 800, fontFamily: 'Manrope, sans-serif', color: '#0d1f3c', lineHeight: 1.2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                {formData.emplib || t('employe.profileTitle')}
                                {mode === 'update' && formData.actif === 'N' && (
                                    <Chip size="small" icon={<WarningAmberIcon sx={{ fontSize: '12px !important', color: '#d97706 !important' }} />} label={t('employe.inactiveLabel')}
                                        sx={{ backgroundColor: '#fef3c7', color: '#92400e', fontWeight: 700, fontSize: '10px', height: 20 }} />
                                )}
                            </Typography>
                            <Typography sx={{ fontSize: '11px', color: '#8896a8', mt: 0.2 }}>
                                {t('employe.profileSubtitle')}
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
                                    {t('employe.exportBtn')}
                                </Button>
                                <Menu
                                    anchorEl={docAnchorEl} open={Boolean(docAnchorEl)} onClose={() => setDocAnchorEl(null)}
                                    PaperProps={{ sx: { borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', minWidth: 240, mt: 1, border: '1px solid #edf0f5' } }}
                                >
                                    <Box sx={{ px: 2, py: 1.5 }}>
                                        <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#8896a8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                            {t('employe.availableDocuments')}
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
                                {t('employe.scanDocument')}
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
                                {mode === 'save' ? t('employe.createBtn') : t('employe.saveChangesBtn')}
                            </Button>
                        )}
                    </Box>
                </Box>

                {/* ── Body ── */}
                {!canConsult ? (
                    <Box sx={{ p: 4, textAlign: 'center', backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', m: 3 }}>
                        <PersonIcon sx={{ fontSize: 64, color: '#ba1a1a', opacity: 0.2, mb: 2 }} />
                        <Typography variant="h6" color="error">{t('employe.accessDenied')}</Typography>
                        <Typography sx={{ color: '#64748b' }}>{t('employe.noConsultRight')}</Typography>
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
                                            {t('employe.section.basicInfo')}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 2fr' }, gap: 2 }}>
                                        <Box>
                                            <Typography sx={labelStyle}>{t('employe.field.matricule')}</Typography>
                                            <TextField name="empcod" value={formData.empcod} onChange={handleField} size="small" fullWidth
                                                InputProps={{
                                                    readOnly: mode === 'update',
                                                    endAdornment: mode === 'save' ? (
                                                        <InputAdornment position="end">
                                                            <Tooltip title={t('employe.field.regenerateMatricule')}>
                                                                <IconButton size="small" onClick={fetchNextEmpcod}>
                                                                    <AutorenewIcon fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                        </InputAdornment>
                                                    ) : undefined,
                                                }}
                                                sx={fieldStyle} placeholder={t('employe.field.autoPlaceholder')} />
                                        </Box>
                                        <Box>
                                            <Typography sx={labelStyle}>{t('employe.field.fullName')}</Typography>
                                            <TextField name="emplib" value={formData.emplib} onChange={handleField} size="small" fullWidth sx={fieldStyle} placeholder={t('employe.field.fullNamePlaceholder')} />
                                        </Box>
                                        <Box>
                                            <Typography sx={labelStyle}>{t('employe.field.sex')}</Typography>
                                            <FormControl fullWidth size="small">
                                                <Select value={formData.empsexe || ''} onChange={handleSelect('empsexe')} sx={selectStyle} displayEmpty>
                                                    <MenuItem value=""><em style={{ color: '#aaa' }}>—</em></MenuItem>
                                                    <MenuItem value="M">{t('employe.field.male')}</MenuItem>
                                                    <MenuItem value="F">{t('employe.field.female')}</MenuItem>
                                                </Select>
                                            </FormControl>
                                        </Box>
                                        <Box>
                                            <Typography sx={labelStyle}>{t('employe.field.cin')}</Typography>
                                            <TextField name="empcin" value={formData.empcin} onChange={handleField} size="small" fullWidth sx={fieldStyle} placeholder="SJB88920" />
                                        </Box>
                                        <Box>
                                            <Typography sx={labelStyle}>{t('employe.field.birthDate')}</Typography>
                                            <TextField name="empdnais" type="date" value={formData.empdnais || ''} onChange={handleField} size="small" fullWidth sx={fieldStyle} InputLabelProps={{ shrink: true }} />
                                        </Box>
                                        <Box>
                                            <Typography sx={labelStyle}>{t('employe.field.birthPlace')}</Typography>
                                            <TextField name="emplnais" value={formData.emplnais || ''} onChange={handleField} size="small" fullWidth sx={fieldStyle} />
                                        </Box>
                                        <Box>
                                            <Typography sx={labelStyle}>{t('employe.field.civilStatus')}</Typography>
                                            <FormControl fullWidth size="small">
                                                <Select value={formData.empsitfam || ''} onChange={handleSelect('empsitfam')} sx={selectStyle} displayEmpty>
                                                    <MenuItem value=""><em style={{ color: '#aaa' }}>—</em></MenuItem>
                                                    <MenuItem value="C">{t('employe.field.single')}</MenuItem>
                                                    <MenuItem value="M">{t('employe.field.married')}</MenuItem>
                                                    <MenuItem value="D">{t('employe.field.divorced')}</MenuItem>
                                                    <MenuItem value="V">{t('employe.field.widow')}</MenuItem>
                                                </Select>
                                            </FormControl>
                                        </Box>
                                        <Box>
                                            <Typography sx={labelStyle}>{t('employe.nbDependents')}</Typography>
                                            <TextField name="empnbp" type="number" value={formData.empnbp ?? 0} onChange={handleField} size="small" fullWidth sx={fieldStyle} />
                                        </Box>
                                        <Box>
                                            <Typography sx={labelStyle}>{t('employe.field.email')}</Typography>
                                            <TextField name="empemail" type="email" value={formData.empemail || ''} onChange={handleField} size="small" fullWidth sx={fieldStyle}
                                                InputProps={{ startAdornment: <EmailIcon sx={{ fontSize: 16, color: '#94a3b8', mr: 1 }} /> }}
                                                placeholder={t('employe.field.emailPlaceholder')} />
                                        </Box>
                                        <Box>
                                            <Typography sx={labelStyle}>{t('employe.level')}</Typography>
                                            <FormControl fullWidth size="small">
                                                <Select value={formData.empniv || ''} onChange={handleSelect('empniv')} sx={selectStyle} displayEmpty>
                                                    <MenuItem value=""><em style={{ color: '#aaa' }}>—</em></MenuItem>
                                                    <MenuItem value="0">{t('employe.field.executant')}</MenuItem>
                                                    <MenuItem value="1">{t('employe.field.supervisor')}</MenuItem>
                                                    <MenuItem value="2">{t('employe.field.manager')}</MenuItem>
                                                </Select>
                                            </FormControl>
                                        </Box>
                                        <Box>
                                            <Typography sx={labelStyle}>{t('employe.field.city')}</Typography>
                                            <SelectWithAdd value={formData.vilcod || ''}
                                                onChange={v => setFormData(p => ({ ...p, vilcod: v }))}
                                                options={vilMap} onAdd={handleAddVille} addTitle={t('employe.addTitle.ville')} />
                                        </Box>
                                        <Box>
                                            <Typography sx={labelStyle}>{t('employe.field.country')}</Typography>
                                            <SelectWithAdd value={formData.natcod || ''}
                                                onChange={v => setFormData(p => ({ ...p, natcod: v }))}
                                                options={payMap} onAdd={handleAddPays} addTitle={t('employe.addTitle.pays')} />
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
                                            {t('employe.section.contact')}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2 }}>
                                        <Box>
                                            <Typography sx={labelStyle}>{t('employe.field.address')}</Typography>
                                            <TextField name="empadr" value={formData.empadr || ''} onChange={handleField} size="small" fullWidth sx={fieldStyle}
                                                InputProps={{ startAdornment: <LocationOnIcon sx={{ fontSize: 16, color: '#94a3b8', mr: 1 }} /> }}
                                                placeholder={t('employe.field.addressPlaceholder')} />
                                        </Box>
                                        <Box>
                                            <Typography sx={labelStyle}>{t('employe.phone')}</Typography>
                                            <TextField name="emptel" value={formData.emptel || ''} onChange={handleField} size="small" fullWidth sx={fieldStyle}
                                                InputProps={{ startAdornment: <PhoneIcon sx={{ fontSize: 16, color: '#94a3b8', mr: 1 }} /> }}
                                                placeholder={t('employe.field.phonePlaceholder')} />
                                        </Box>
                                        <Box>
                                            <Typography sx={labelStyle}>{t('employe.field.mobile')}</Typography>
                                            <TextField name="empmob" value={formData.empmob || ''} onChange={handleField} size="small" fullWidth sx={fieldStyle}
                                                InputProps={{ startAdornment: <PhoneIcon sx={{ fontSize: 16, color: '#94a3b8', mr: 1 }} /> }}
                                                placeholder={t('employe.field.phonePlaceholder')} />
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
                                                {t('employe.section.work')}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.8 }}>
                                            {[{ lbl: t('employe.field.hireDate'), type: 'date', name: 'empemb', val: formData.empemb ? dayjs(formData.empemb).format('YYYY-MM-DD') : '' }].map(f => (
                                                <Box key={f.name}>
                                                    <Typography sx={labelStyle}>{f.lbl}</Typography>
                                                    <TextField name={f.name} type={f.type} value={f.val} onChange={handleField} size="small" fullWidth sx={fieldStyle} InputLabelProps={{ shrink: true }}
                                                        InputProps={{ startAdornment: <CalendarTodayIcon sx={{ fontSize: 16, color: '#94a3b8', mr: 1 }} /> }} />
                                                </Box>
                                            ))}
                                            <Box>
                                                <Typography sx={labelStyle}>{t('employe.field.contractType')}</Typography>
                                                <FormControl fullWidth size="small">
                                                    <Select value={formData.empcontrat || ''} onChange={handleSelect('empcontrat')} sx={selectStyle} displayEmpty>
                                                        <MenuItem value=""><em style={{ color: '#aaa' }}>—</em></MenuItem>
                                                        <MenuItem value="CDI">CDI</MenuItem>
                                                        <MenuItem value="CDD">CDD</MenuItem>
                                                        <MenuItem value="STAGE">Stage</MenuItem>
                                                        <MenuItem value="FREELANCE">Freelance</MenuItem>
                                                        <MenuItem value="CIVP">CIVP</MenuItem>
                                                        <MenuItem value="OUVRIER">Ouvrier</MenuItem>
                                                        <MenuItem value="ALTERNANCE">Alternance</MenuItem>
                                                    </Select>
                                                </FormControl>
                                            </Box>
                                            <Box>
                                                <Typography sx={labelStyle}>{t('employe.field.regime')}</Typography>
                                                <FormControl fullWidth size="small">
                                                    <Select value={formData.empreg || ''} onChange={handleSelect('empreg')} sx={selectStyle} displayEmpty>
                                                        <MenuItem value=""><em style={{ color: '#aaa' }}>—</em></MenuItem>
                                                        <MenuItem value="M">{t('employe.field.monthly')}</MenuItem>
                                                        <MenuItem value="H">{t('employe.field.hourly')}</MenuItem>
                                                    </Select>
                                                </FormControl>
                                            </Box>
                                            <Box>
                                                <Typography sx={labelStyle}>{t('employe.field.branchSite')}</Typography>
                                                <SelectWithAdd value={formData.sitcod || ''}
                                                    onChange={v => setFormData(p => ({ ...p, sitcod: v }))}
                                                    options={sitMap} onAdd={handleAddSite} addTitle={t('employe.addTitle.filiale')} />
                                            </Box>
                                            <Box>
                                                <Typography sx={labelStyle}>{t('employe.field.service')}</Typography>
                                                <SelectWithAdd value={formData.sercod || ''}
                                                    onChange={v => setFormData(p => ({ ...p, sercod: v }))}
                                                    options={serviceLibs} onAdd={handleAddService} addTitle={t('employe.addTitle.service')} />
                                            </Box>
                                            <Box>
                                                <Typography sx={labelStyle}>{t('employe.field.timeClass')}</Typography>
                                                <SelectWithAdd value={formData.catcod || ''}
                                                    onChange={v => setFormData(p => ({ ...p, catcod: v }))}
                                                    options={(() => {
                                                        // Si l'employé est déjà affecté à une classe qui n'apparaît plus dans
                                                        // `get-horlibs` (ex : Lcategorie hors plage temporelle ou supprimée),
                                                        // on l'injecte en fallback pour que la valeur courante reste visible.
                                                        // Sans ça, le dropdown affiche "—" et l'utilisateur croit qu'aucune
                                                        // classe n'a été assignée — alors qu'elle l'est en base.
                                                        const cur = formData.catcod || '';
                                                        if (cur && !classeHoraireLibs[cur]) {
                                                            return { ...classeHoraireLibs, [cur]: `${cur} ${t('employe.field.outOfRange')}` };
                                                        }
                                                        return classeHoraireLibs;
                                                    })()}
                                                    onAdd={handleAddClasseHoraire} addTitle={t('employe.addTitle.classeHoraire')} />
                                            </Box>
                                            <Box>
                                                <Typography sx={labelStyle}>{t('employe.field.calendar')}</Typography>
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
                                                {t('employe.section.details')}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.8 }}>

                                            <Box>
                                                <Typography sx={labelStyle}>{t('employe.field.function')}</Typography>
                                                <SelectWithAdd value={formData.foncod || ''}
                                                    onChange={v => setFormData(p => ({ ...p, foncod: v }))}
                                                    options={fonMap} onAdd={handleAddFonction} addTitle={t('employe.addTitle.fonction')} />
                                            </Box>
                                            <Box>
                                                <Typography sx={labelStyle}>{t('employe.field.qualification')}</Typography>
                                                <SelectWithAdd value={formData.quacod || ''}
                                                    onChange={v => setFormData(p => ({ ...p, quacod: v }))}
                                                    options={quaMap} onAdd={handleAddQualification} addTitle={t('employe.addTitle.qualification')} />
                                            </Box>
                                            <Box>
                                                <Typography sx={labelStyle}>{t('employe.field.direction')}</Typography>
                                                <SelectWithAdd value={formData.dircod || ''}
                                                    onChange={v => setFormData(p => ({ ...p, dircod: v }))}
                                                    options={dirMap} onAdd={handleAddDirection} addTitle={t('employe.addTitle.direction')} />
                                            </Box>
                                            <Box>
                                                <Typography sx={labelStyle}>{t('employe.field.sectionLbl')}</Typography>
                                                <SelectWithAdd value={formData.seccod || ''}
                                                    onChange={v => setFormData(p => ({ ...p, seccod: v }))}
                                                    options={secMap} onAdd={handleAddSection} addTitle={t('employe.addTitle.section')} />
                                            </Box>
                                            <Box>
                                                <Typography sx={labelStyle}>{t('employe.field.hireDate')}</Typography>
                                                <TextField name="empemb2" type="date" value={formData.empemb ? dayjs(formData.empemb).format('YYYY-MM-DD') : ''} onChange={handleField} size="small" fullWidth sx={fieldStyle} InputLabelProps={{ shrink: true }} />
                                            </Box>
                                            <Box>
                                                <Typography sx={labelStyle}>{t('employe.field.statusLbl')}</Typography>
                                                <FormControl fullWidth size="small">
                                                    <Select value={formData.actif || 'A'} onChange={handleSelect('actif')} sx={selectStyle}>
                                                        <MenuItem value="A">{t('employe.field.active')}</MenuItem>
                                                        <MenuItem value="N">{t('employe.field.inactive')}</MenuItem>
                                                    </Select>
                                                </FormControl>
                                            </Box>
                                            <Box>
                                                <Typography sx={labelStyle}>{t('employe.userRole')}</Typography>
                                                <FormControl fullWidth size="small">
                                                    <Select value={formData.utirole || 'Employee'} onChange={handleSelect('utirole')} sx={selectStyle}>
                                                        {roles.length > 0 ? (
                                                            roles.map(r => (
                                                                <MenuItem key={r.roleId} value={r.roleName}>
                                                                    {/* Affiche le libellé FR mappé (Employee → Employé,
                                                                        Administrator → Administrateur…), fallback sur le
                                                                        roleName brut pour les rôles custom créés en base. */}
                                                                    {ROLE_LABELS[r.roleName] ?? r.roleName}
                                                                </MenuItem>
                                                            ))
                                                        ) : (
                                                            <MenuItem value="Employee">{t('employe.field.employee')}</MenuItem>
                                                        )}
                                                    </Select>
                                                </FormControl>
                                            </Box>
                                            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 2, mt: 0.5 }}>
                                                <Box>
                                                    <Typography sx={labelStyle}>{t('employe.field.maxDaysMonth')}</Typography>
                                                    <TextField name="empmaxjour" type="number" value={formData.empmaxjour ?? 0} onChange={handleField} size="small" fullWidth sx={fieldStyle} placeholder={t('employe.field.unlimited')} />
                                                </Box>
                                                <Box>
                                                    <Typography sx={labelStyle}>{t('employe.field.maxHoursDay')}</Typography>
                                                    <TextField name="empmaxhre" type="number" value={formData.empmaxhre ?? 0} onChange={handleField} size="small" fullWidth sx={fieldStyle} placeholder={t('employe.field.unlimited')} />
                                                </Box>
                                                <Box>
                                                    <Typography sx={labelStyle}>{t('employe.field.minHoursDay')}</Typography>
                                                    <TextField name="empminhjour" type="number" value={formData.empminhjour ?? 0} onChange={handleField} size="small" fullWidth sx={fieldStyle} placeholder="0" />
                                                </Box>
                                            </Box>
                                            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                                                <Box>
                                                    <Typography sx={labelStyle}>{t('employe.field.countRest')}</Typography>
                                                    <FormControl fullWidth size="small">
                                                        <Select value={formData.empferepos || '0'} onChange={handleSelect('empferepos')} sx={selectStyle}>
                                                            <MenuItem value="0">{t('employe.field.countRestNo')}</MenuItem>
                                                            <MenuItem value="1">{t('employe.field.countRestAll')}</MenuItem>
                                                            <MenuItem value="2">{t('employe.field.countRestSat')}</MenuItem>
                                                            <MenuItem value="3">{t('employe.field.countRestSun')}</MenuItem>
                                                        </Select>
                                                    </FormControl>
                                                </Box>
                                                <Box>
                                                    <Typography sx={labelStyle}>{t('employe.field.panier')}</Typography>
                                                    <FormControl fullWidth size="small">
                                                        <Select value={formData.emppanier || '0'} onChange={handleSelect('emppanier')} sx={selectStyle}>
                                                            <MenuItem value="0">{t('employe.field.panierNone')}</MenuItem>
                                                            <MenuItem value="1">{t('employe.field.panier7H')}</MenuItem>
                                                            <MenuItem value="2">{t('employe.field.panier6H')}</MenuItem>
                                                        </Select>
                                                    </FormControl>
                                                </Box>
                                            </Box>
                                            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                                                <Box>
                                                    <Typography sx={labelStyle}>{t('employe.field.nightHours')}</Typography>
                                                    <FormControl fullWidth size="small">
                                                        <Select value={formData.empnuit || '0'} onChange={handleSelect('empnuit')} sx={selectStyle}>
                                                            <MenuItem value="0">{t('employe.field.nightNormal')}</MenuItem>
                                                            <MenuItem value="1">{t('employe.field.nightSpecial')}</MenuItem>
                                                        </Select>
                                                    </FormControl>
                                                </Box>
                                                <Box>
                                                    <Typography sx={labelStyle}>{t('employe.field.eliminateDelay')}</Typography>
                                                    <FormControl fullWidth size="small">
                                                        <Select value={formData.empretard || '0'} onChange={handleSelect('empretard')} sx={selectStyle}>
                                                            <MenuItem value="0">{t('employe.field.no')}</MenuItem>
                                                            <MenuItem value="1">{t('employe.field.yes')}</MenuItem>
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
                                            {t('employe.section.salary')}
                                        </Typography>
                                        <Chip label={t('employe.confidential')} size="small" sx={{ ml: 'auto', backgroundColor: 'rgba(251,191,36,0.12)', color: '#fbbf24', fontWeight: 700, fontSize: '9px', height: 22, letterSpacing: '0.04em' }} />
                                    </Box>
                                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: '1fr 1fr 1fr' }, gap: 2.5, px: { xs: 1.5, md: 3 }, py: 3 }}>
                                        {[
                                            { label: t('employe.field.baseSalary'), name: 'empsbase', value: formData.empsbase, icon: <TrendingUpIcon sx={{ fontSize: 14, color: '#60a5fa' }} /> },
                                            { label: t('employe.field.grossSalary'), name: 'empsbrut', value: formData.empsbrut, icon: <AccountBalanceWalletIcon sx={{ fontSize: 14, color: '#34d399' }} /> },
                                            { label: t('employe.field.netSalary'), name: 'empsnet', value: formData.empsnet, icon: <PaymentsIcon sx={{ fontSize: 14, color: '#a78bfa' }} /> },
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
                                                {t('employe.section.schedules')}
                                            </Typography>
                                        </Box>
                                        <Chip
                                            label={t('employe.currentWeek')}
                                            size="small"
                                            sx={{ backgroundColor: '#dbeafe', color: '#1d4ed8', fontWeight: 700, fontSize: '10px', letterSpacing: '0.04em' }}
                                        />
                                    </Box>

                                    {/* Table header — wrapper scrollable horizontalement
                                        sur mobile pour préserver les 6 colonnes au lieu
                                        d'écraser leur contenu sur 320px de large. */}
                                    <Box sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                                    <Box sx={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr 1fr 1fr 100px', gap: 0, mb: 1, minWidth: { xs: 700, md: 'auto' } }}>
                                        {[t('employe.scheduleHeaders.post'), t('employe.scheduleHeaders.entryMorning'), t('employe.scheduleHeaders.exitMorning'), t('employe.scheduleHeaders.entryAfternoon'), t('employe.scheduleHeaders.exitAfternoon'), t('employe.scheduleHeaders.status')].map(h => (
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
                                            minWidth: { xs: 700, md: 'auto' },
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
                                                        label={t('employe.workLabel')}
                                                        size="small"
                                                        icon={<CheckCircleIcon sx={{ fontSize: '12px !important', color: '#16a34a !important' }} />}
                                                        sx={{ backgroundColor: '#dcfce7', color: '#166534', fontWeight: 700, fontSize: '10px', height: 22 }}
                                                    />
                                                ) : h.statut === 'repos' ? (
                                                    <Chip
                                                        label={t('employe.restLabel')}
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
                                            <Typography sx={{ fontSize: '13px' }}>{t('employe.noSchedule')}</Typography>
                                        </Box>
                                    )}
                                    </Box>
                                </Paper>
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