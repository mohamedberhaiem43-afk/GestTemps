import React, { useState, useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useGetNoteDeFraisByEmp, useGetNoteDeFraisBySoc } from '../../../hooks/expenseHooks/useGetNoteDeFrais';
import { useAddNoteDeFrais, useDeleteNoteDeFrais, useUpdateNoteDeFraisStatus } from '../../../hooks/expenseHooks/useAddNoteDeFrais';
import { NoteDeFrais } from '../../../models/NoteDeFrais';
import dayjs from 'dayjs';
import {
    Box, Typography, Snackbar, Alert, CircularProgress,
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Divider, Tooltip,
} from '@mui/material';
import {
    UploadCloud, Info,
    Receipt, Trash2, ChevronLeft, ChevronRight, Download,
    Filter, Send, FileText, ShieldCheck, Ban, Banknote,
} from 'lucide-react';
import './RemboursementModern.css';
import { useAuth } from '../../helper/AuthProvider';

const queryClient = new QueryClient();

const ROWS_PER_PAGE = 10;
const CATEGORIES = ['Transport', 'Repas', 'Equipement', 'Logement', 'Autre'];
const STATUS_FILTERS = ['Tous', 'Pending', 'Approved', 'Reimbursed', 'Rejected'];
const STATUS_LABELS: Record<string, string> = {
    'Tous': 'Tous',
    'Pending': 'En attente',
    'Approved': 'Approuvé',
    'Reimbursed': 'Remboursé',
    'Rejected': 'Refusé',
};

function getCategoryClass(cat: string): string {
    const key = cat?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') || '';
    if (key.includes('transport')) return 'rmb-cat-badge--transport';
    if (key.includes('repas')) return 'rmb-cat-badge--repas';
    if (key.includes('equipement') || key.includes('équipement')) return 'rmb-cat-badge--equipement';
    if (key.includes('logement')) return 'rmb-cat-badge--logement';
    return 'rmb-cat-badge--autre';
}

function getStatusClass(status: string): string {
    switch (status) {
        case 'Approved': return 'rmb-status--approved';
        case 'Reimbursed': return 'rmb-status--reimbursed';
        case 'Rejected': return 'rmb-status--rejected';
        default: return 'rmb-status--pending';
    }
}

function getStatusLabel(status: string): string {
    return STATUS_LABELS[status] || status;
}

function formatMontant(value: number): string {
    return value.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

// Helper to normalize API response (handles $values wrapper from .NET)
function normalizeArray(raw: any): NoteDeFrais[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (raw.$values && Array.isArray(raw.$values)) return raw.$values;
    return [];
}

function RemboursementModernContent() {
    const { soccod, uticod, isEmp, hasPermission } = useAuth();
    const currentEmpcod = uticod || '';
    const currentSoccod = soccod || '';

    // Admin sees ALL expenses (by soc), Employee sees only their own
    const { data: rawEmpExpenses, isLoading: loadingEmp } = useGetNoteDeFraisByEmp(currentSoccod, currentEmpcod);
    const { data: rawSocExpenses, isLoading: loadingSoc } = useGetNoteDeFraisBySoc(currentSoccod);

    const isAdmin = !isEmp;
    const isLoading = isAdmin ? loadingSoc : loadingEmp;

    const expenses: NoteDeFrais[] = useMemo(() => {
        return isAdmin ? normalizeArray(rawSocExpenses) : normalizeArray(rawEmpExpenses);
    }, [isAdmin, rawSocExpenses, rawEmpExpenses]);

    // Permissions
    const canAdd = hasPermission('Note de Frais', 'add');
    const canModify = hasPermission('Note de Frais', 'modify');
    const canDelete = hasPermission('Note de Frais', 'delete');

    // Mutations
    const addMutation = useAddNoteDeFrais();
    const deleteMutation = useDeleteNoteDeFrais();
    const updateStatusMutation = useUpdateNoteDeFraisStatus();

    // Form state
    const [titre, setTitre] = useState('');
    const [categorie, setCategorie] = useState('Transport');
    const [montant, setMontant] = useState<number | ''>('');
    const [projet, setProjet] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [dateDepense, setDateDepense] = useState(dayjs().format('YYYY-MM-DD'));
    const [formSuccess, setFormSuccess] = useState(false);

    // Table state
    const [page, setPage] = useState(0);
    const [statusFilter, setStatusFilter] = useState('Tous');
    const [showFilters, setShowFilters] = useState(false);

    // Delete confirmation
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [expenseToDelete, setExpenseToDelete] = useState<NoteDeFrais | null>(null);

    // Status update confirmation
    const [statusDialogOpen, setStatusDialogOpen] = useState(false);
    const [statusAction, setStatusAction] = useState<{ expense: NoteDeFrais; newStatus: string } | null>(null);

    // Form dialog
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [detailDialogOpen, setDetailDialogOpen] = useState(false);
    const [selectedExpense, setSelectedExpense] = useState<NoteDeFrais | null>(null);

    // Snackbar
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
    const showSnack = (message: string, severity: 'success' | 'error') =>
        setSnackbar({ open: true, message, severity });

    // Filtered & paginated data
    const filteredExpenses = useMemo(() => {
        if (statusFilter === 'Tous') return expenses;
        return expenses.filter(e => e.etat === statusFilter);
    }, [expenses, statusFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / ROWS_PER_PAGE));
    const paginatedExpenses = filteredExpenses.slice(page * ROWS_PER_PAGE, (page + 1) * ROWS_PER_PAGE);

    // Stats
    const pendingTotal = expenses.filter(e => e.etat === 'Pending').reduce((acc, curr) => acc + curr.montant, 0);
    const reimbursedTotal = expenses.filter(e => e.etat === 'Reimbursed').reduce((acc, curr) => acc + curr.montant, 0);
    const ytdTotal = expenses.reduce((acc, curr) => acc + curr.montant, 0);
    const pendingCount = expenses.filter(e => e.etat === 'Pending').length;

    // ── Handlers ──

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!titre || !categorie || montant === '') return;

        try {
            await addMutation.mutateAsync({
                soccod: currentSoccod,
                empcod: currentEmpcod,
                titre,
                categorie,
                montant: Number(montant),
                projet,
                dateDepense,
                file: file || undefined
            });
            setTitre('');
            setMontant('');
            setProjet('');
            setFile(null);
            setDateDepense(dayjs().format('YYYY-MM-DD'));
            setFormSuccess(true);
            setTimeout(() => setFormSuccess(false), 600);
            setIsFormOpen(false);
            showSnack('Dépense soumise avec succès !', 'success');
        } catch {
            showSnack('Erreur lors de la soumission.', 'error');
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleDeleteClick = (exp: NoteDeFrais) => {
        setExpenseToDelete(exp);
        setDeleteDialogOpen(true);
    };

    const confirmDelete = async () => {
        if (!expenseToDelete) return;
        try {
            await deleteMutation.mutateAsync(expenseToDelete.id);
            showSnack('Dépense supprimée.', 'success');
        } catch {
            showSnack('Erreur lors de la suppression.', 'error');
        } finally {
            setDeleteDialogOpen(false);
            setExpenseToDelete(null);
        }
    };

    // Admin status update
    const handleStatusChange = (exp: NoteDeFrais, newStatus: string) => {
        setStatusAction({ expense: exp, newStatus });
        setStatusDialogOpen(true);
    };

    const confirmStatusUpdate = async () => {
        if (!statusAction) return;
        try {
            await updateStatusMutation.mutateAsync({
                id: statusAction.expense.id,
                status: statusAction.newStatus
            });
            const label = getStatusLabel(statusAction.newStatus);
            showSnack(`Dépense marquée comme "${label}".`, 'success');
        } catch {
            showSnack('Erreur lors de la mise à jour.', 'error');
        } finally {
            setStatusDialogOpen(false);
            setStatusAction(null);
        }
    };

    const handleDetailClick = (exp: NoteDeFrais) => {
        setSelectedExpense(exp);
        setDetailDialogOpen(true);
    };

    const handleExportCSV = () => {
        if (!filteredExpenses.length) return;
        const headers = isAdmin
            ? ['Employé', 'Titre', 'Catégorie', 'Date', 'Montant', 'Projet', 'État']
            : ['Titre', 'Catégorie', 'Date', 'Montant', 'Projet', 'État'];
        const rows = filteredExpenses.map(e => {
            const base = [
                e.titre,
                e.categorie,
                dayjs(e.dateDepense).format('DD/MM/YYYY'),
                e.montant.toFixed(3),
                e.projet || '',
                getStatusLabel(e.etat),
            ];
            return isAdmin ? [e.empcod, ...base] : base;
        });
        const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `notes-de-frais-${dayjs().format('YYYY-MM-DD')}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showSnack('Export CSV téléchargé.', 'success');
    };

    const handleFilterChange = (filter: string) => {
        setStatusFilter(filter);
        setPage(0);
    };

    // Status action label and color helpers
    const getStatusActionInfo = (status: string) => {
        switch (status) {
            case 'Approved': return { label: 'Approuver', color: '#059669', bg: '#dcfce7', icon: <ShieldCheck size={16} /> };
            case 'Rejected': return { label: 'Refuser', color: '#dc2626', bg: '#fee2e2', icon: <Ban size={16} /> };
            case 'Reimbursed': return { label: 'Marquer Remboursé', color: '#0040a1', bg: '#dbeafe', icon: <Banknote size={16} /> };
            default: return { label: status, color: '#64748b', bg: '#f1f5f9', icon: null };
        }
    };

    return (
        <div className="rmb-container">
            {/* Header */}
            <div className="rmb-header">
                <div>
                    <h1 className="rmb-title">Note de Frais</h1>
                    <p className="rmb-subtitle">
                        {isAdmin
                            ? <>Gestion et validation des notes de frais.
                                {pendingCount > 0 && (
                                    <> <strong style={{ color: '#d97706' }}>{pendingCount} dépense{pendingCount > 1 ? 's' : ''}</strong> en attente de validation.</>
                                )}</>
                            : <>Gérez vos dépenses et frais de mission.
                                {pendingCount > 0 && (
                                    <> Vous avez <strong style={{ color: '#d97706' }}>{pendingCount} dépense{pendingCount > 1 ? 's' : ''}</strong> en attente.</>
                                )}</>
                        }
                    </p>
                </div>
                {(isEmp || canAdd) && (
                    <button className="rmb-new-btn" onClick={() => setIsFormOpen(true)}>
                        <UploadCloud size={18} />
                        Nouvelle Dépense
                    </button>
                )}
            </div>

            <div className="rmb-body rmb-body--no-form">

                {/* ─── Right Column ─── */}
                <div className="rmb-right">
                    {/* Stats */}
                    <div className="rmb-stats-grid">
                        <div className="rmb-stat-card rmb-stat-card--pending">
                            <div className="rmb-stat-label">En attente</div>
                            <div className="rmb-stat-value rmb-stat-value--pending">
                                {formatMontant(pendingTotal)}
                                <span className="rmb-stat-currency">TND</span>
                            </div>
                        </div>
                        <div className="rmb-stat-card rmb-stat-card--reimbursed">
                            <div className="rmb-stat-label">Remboursé</div>
                            <div className="rmb-stat-value rmb-stat-value--reimbursed">
                                {formatMontant(reimbursedTotal)}
                                <span className="rmb-stat-currency">TND</span>
                            </div>
                        </div>
                        <div className="rmb-stat-card rmb-stat-card--total">
                            <div className="rmb-stat-label">Total Année</div>
                            <div className="rmb-stat-value rmb-stat-value--total">
                                {formatMontant(ytdTotal)}
                                <span className="rmb-stat-currency">TND</span>
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="rmb-table-card">
                        <div className="rmb-table-toolbar">
                            <span className="rmb-table-title">
                                {isAdmin ? 'Toutes les Dépenses' : 'Historique des Dépenses'}
                            </span>
                            <div className="rmb-toolbar-actions">
                                <button
                                    className={`rmb-toolbar-btn ${showFilters ? 'active' : ''}`}
                                    onClick={() => setShowFilters(!showFilters)}
                                >
                                    <Filter size={13} /> Filtrer
                                </button>
                                <button className="rmb-toolbar-btn" onClick={handleExportCSV}>
                                    <Download size={13} /> Export CSV
                                </button>
                            </div>
                        </div>

                        {/* Filter chips */}
                        {showFilters && (
                            <div style={{ padding: '12px 24px', borderBottom: '1px solid #f2f4f6', background: '#fafbfc' }}>
                                <div className="rmb-filter-row">
                                    {STATUS_FILTERS.map(f => (
                                        <button
                                            key={f}
                                            className={`rmb-filter-chip ${statusFilter === f ? 'active' : ''}`}
                                            onClick={() => handleFilterChange(f)}
                                        >
                                            {STATUS_LABELS[f]}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div style={{ overflowX: 'auto' }}>
                            <table className="rmb-table">
                                <thead>
                                    <tr>
                                        {isAdmin && <th>Employé</th>}
                                        <th>Description</th>
                                        <th>Catégorie</th>
                                        <th>Date</th>
                                        <th>Montant</th>
                                        <th>État</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={isAdmin ? 7 : 6}>
                                                <div className="rmb-loading">
                                                    <CircularProgress size={32} sx={{ color: '#0040a1' }} />
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredExpenses.length === 0 ? (
                                        <tr>
                                            <td colSpan={isAdmin ? 7 : 6}>
                                                <div className="rmb-empty-state">
                                                    <FileText className="rmb-empty-icon" size={48} strokeWidth={1} />
                                                    <p className="rmb-empty-text">
                                                        {statusFilter !== 'Tous'
                                                            ? `Aucune dépense avec le statut "${getStatusLabel(statusFilter)}".`
                                                            : 'Aucune dépense trouvée.'}
                                                    </p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedExpenses.map(exp => (
                                            <tr key={exp.id}>
                                                {/* Employee column (admin only) */}
                                                {isAdmin && (
                                                    <td>
                                                        <div className="rmb-emp-cell">
                                                            <div className="rmb-emp-avatar">
                                                                {(exp.empcod || '?').charAt(0).toUpperCase()}
                                                            </div>
                                                            <span className="rmb-emp-code">{exp.empcod}</span>
                                                        </div>
                                                    </td>
                                                )}
                                                <td>
                                                    <div className="rmb-desc-title">{exp.titre}</div>
                                                    {exp.projet && <div className="rmb-desc-sub">{exp.projet}</div>}
                                                </td>
                                                <td>
                                                    <span className={`rmb-cat-badge ${getCategoryClass(exp.categorie)}`}>
                                                        {exp.categorie}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className="rmb-date-cell">
                                                        {dayjs(exp.dateDepense).format('DD MMM YYYY')}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className="rmb-amount-cell">
                                                        {formatMontant(exp.montant)}
                                                        <span className="rmb-amount-currency">TND</span>
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`rmb-status-badge ${getStatusClass(exp.etat)}`}>
                                                        <span className="rmb-status-dot"></span>
                                                        {getStatusLabel(exp.etat)}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="rmb-row-actions">
                                                        {/* View details */}
                                                        <Tooltip title="Détails" arrow>
                                                            <button
                                                                className="rmb-action-btn rmb-action-btn--receipt"
                                                                onClick={() => handleDetailClick(exp)}
                                                            >
                                                                <Receipt size={16} />
                                                            </button>
                                                        </Tooltip>

                                                        {/* ── Admin actions on pending expenses ── */}
                                                        {isAdmin && canModify && exp.etat === 'Pending' && (
                                                            <>
                                                                <Tooltip title="Approuver" arrow>
                                                                    <button
                                                                        className="rmb-action-btn rmb-action-btn--approve"
                                                                        onClick={() => handleStatusChange(exp, 'Approved')}
                                                                    >
                                                                        <ShieldCheck size={16} />
                                                                    </button>
                                                                </Tooltip>
                                                                <Tooltip title="Refuser" arrow>
                                                                    <button
                                                                        className="rmb-action-btn rmb-action-btn--reject"
                                                                        onClick={() => handleStatusChange(exp, 'Rejected')}
                                                                    >
                                                                        <Ban size={16} />
                                                                    </button>
                                                                </Tooltip>
                                                            </>
                                                        )}

                                                        {/* Admin can mark approved → reimbursed */}
                                                        {isAdmin && canModify && exp.etat === 'Approved' && (
                                                            <Tooltip title="Marquer Remboursé" arrow>
                                                                <button
                                                                    className="rmb-action-btn rmb-action-btn--reimburse"
                                                                    onClick={() => handleStatusChange(exp, 'Reimbursed')}
                                                                >
                                                                    <Banknote size={16} />
                                                                </button>
                                                            </Tooltip>
                                                        )}

                                                        {/* Employee can delete own pending expenses */}
                                                        {isEmp && exp.etat === 'Pending' && exp.empcod === currentEmpcod && (
                                                            <Tooltip title="Supprimer" arrow>
                                                                <button
                                                                    className="rmb-action-btn rmb-action-btn--delete"
                                                                    onClick={() => handleDeleteClick(exp)}
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </Tooltip>
                                                        )}

                                                        {/* Admin can delete */}
                                                        {isAdmin && canDelete && (
                                                            <Tooltip title="Supprimer" arrow>
                                                                <button
                                                                    className="rmb-action-btn rmb-action-btn--delete"
                                                                    onClick={() => handleDeleteClick(exp)}
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </Tooltip>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {filteredExpenses.length > ROWS_PER_PAGE && (
                            <div className="rmb-pagination">
                                <span className="rmb-pagination-info">
                                    {page * ROWS_PER_PAGE + 1}–{Math.min((page + 1) * ROWS_PER_PAGE, filteredExpenses.length)} sur {filteredExpenses.length}
                                </span>
                                <div className="rmb-pagination-controls">
                                    <button
                                        className="rmb-page-btn"
                                        onClick={() => setPage(p => Math.max(0, p - 1))}
                                        disabled={page === 0}
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    {Array.from({ length: totalPages }, (_, i) => (
                                        <button
                                            key={i}
                                            className={`rmb-page-btn ${page === i ? 'active' : ''}`}
                                            onClick={() => setPage(i)}
                                        >
                                            {i + 1}
                                        </button>
                                    ))}
                                    <button
                                        className="rmb-page-btn"
                                        onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                        disabled={page >= totalPages - 1}
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ─── Delete Confirmation Dialog ─── */}
            <Dialog
                open={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                PaperProps={{ sx: { borderRadius: '16px', minWidth: '380px' } }}
            >
                <DialogTitle sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '18px', color: '#dc2626' }}>
                    Confirmer la suppression
                </DialogTitle>
                <Divider />
                <DialogContent sx={{ pt: 2.5 }}>
                    <Typography sx={{ color: '#475569', fontSize: '14px', mt: 1, lineHeight: 1.6 }}>
                        Êtes-vous sûr de vouloir supprimer la dépense
                        <strong> « {expenseToDelete?.titre} »</strong> d'un montant de{' '}
                        <strong>{expenseToDelete ? formatMontant(expenseToDelete.montant) : '0'} TND</strong> ?
                    </Typography>
                    <Typography sx={{ color: '#94a3b8', fontSize: '12px', mt: 2 }}>
                        Cette action est irréversible.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
                    <Button
                        onClick={() => setDeleteDialogOpen(false)}
                        sx={{ color: '#64748b', textTransform: 'none', borderRadius: '8px' }}
                    >
                        Annuler
                    </Button>
                    <Button
                        onClick={confirmDelete}
                        variant="contained"
                        color="error"
                        disabled={deleteMutation.isPending}
                        startIcon={deleteMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <Trash2 size={16} />}
                        sx={{ textTransform: 'none', borderRadius: '8px', fontWeight: 700 }}
                    >
                        Oui, Supprimer
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ─── Status Update Confirmation Dialog (Admin) ─── */}
            <Dialog
                open={statusDialogOpen}
                onClose={() => setStatusDialogOpen(false)}
                PaperProps={{ sx: { borderRadius: '16px', minWidth: '400px' } }}
            >
                {statusAction && (() => {
                    const info = getStatusActionInfo(statusAction.newStatus);
                    return (
                        <>
                            <DialogTitle sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '18px', color: info.color }}>
                                {info.label} cette dépense ?
                            </DialogTitle>
                            <Divider />
                            <DialogContent sx={{ pt: 2.5 }}>
                                <Box sx={{ background: '#f8fafc', borderRadius: '12px', p: 2.5, mb: 2 }}>
                                    <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
                                        Employé
                                    </Typography>
                                    <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#191c1e', mb: 1.5 }}>
                                        {statusAction.expense.empcod}
                                    </Typography>
                                    <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
                                        Dépense
                                    </Typography>
                                    <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#191c1e' }}>
                                        {statusAction.expense.titre} — <strong>{formatMontant(statusAction.expense.montant)} TND</strong>
                                    </Typography>
                                </Box>
                                <Typography sx={{ color: '#475569', fontSize: '13px', lineHeight: 1.6 }}>
                                    {statusAction.newStatus === 'Approved' &&
                                        'Cette action approuve la dépense et la rend éligible au remboursement.'}
                                    {statusAction.newStatus === 'Rejected' &&
                                        'Cette action refuse la dépense. L\'employé sera informé.'}
                                    {statusAction.newStatus === 'Reimbursed' &&
                                        'Cette action confirme que le remboursement a été effectué.'}
                                </Typography>
                            </DialogContent>
                            <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
                                <Button
                                    onClick={() => setStatusDialogOpen(false)}
                                    sx={{ color: '#64748b', textTransform: 'none', borderRadius: '8px' }}
                                >
                                    Annuler
                                </Button>
                                <Button
                                    onClick={confirmStatusUpdate}
                                    variant="contained"
                                    disabled={updateStatusMutation.isPending}
                                    startIcon={updateStatusMutation.isPending
                                        ? <CircularProgress size={16} color="inherit" />
                                        : info.icon}
                                    sx={{
                                        textTransform: 'none',
                                        borderRadius: '8px',
                                        fontWeight: 700,
                                        background: info.color,
                                        '&:hover': { background: info.color, opacity: 0.9 },
                                    }}
                                >
                                    {info.label}
                                </Button>
                            </DialogActions>
                        </>
                    );
                })()}
            </Dialog>

            {/* ─── Detail Dialog ─── */}
            <Dialog
                open={detailDialogOpen}
                onClose={() => setDetailDialogOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{ sx: { borderRadius: '16px' } }}
            >
                <DialogTitle sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '18px', pb: 1 }}>
                    Détail de la Dépense
                </DialogTitle>
                <Divider />
                {selectedExpense && (
                    <DialogContent sx={{ pt: 2.5 }}>
                        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2.5, mt: 1 }}>
                            {isAdmin && (
                                <Box>
                                    <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
                                        Employé
                                    </Typography>
                                    <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#191c1e' }}>
                                        {selectedExpense.empcod}
                                    </Typography>
                                </Box>
                            )}
                            <Box>
                                <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
                                    Titre
                                </Typography>
                                <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#191c1e' }}>
                                    {selectedExpense.titre}
                                </Typography>
                            </Box>
                            <Box>
                                <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
                                    Catégorie
                                </Typography>
                                <span className={`rmb-cat-badge ${getCategoryClass(selectedExpense.categorie)}`}>
                                    {selectedExpense.categorie}
                                </span>
                            </Box>
                            <Box>
                                <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
                                    Montant
                                </Typography>
                                <Typography sx={{ fontSize: '22px', fontWeight: 800, color: '#0040a1', fontFamily: 'Manrope, sans-serif' }}>
                                    {formatMontant(selectedExpense.montant)} <span style={{ fontSize: '13px', fontWeight: 600, opacity: 0.5 }}>TND</span>
                                </Typography>
                            </Box>
                            <Box>
                                <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
                                    État
                                </Typography>
                                <span className={`rmb-status-badge ${getStatusClass(selectedExpense.etat)}`}>
                                    <span className="rmb-status-dot"></span>
                                    {getStatusLabel(selectedExpense.etat)}
                                </span>
                            </Box>
                            <Box>
                                <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
                                    Date de la dépense
                                </Typography>
                                <Typography sx={{ fontSize: '14px', fontWeight: 500, color: '#475569' }}>
                                    {dayjs(selectedExpense.dateDepense).format('DD MMMM YYYY')}
                                </Typography>
                            </Box>
                            <Box>
                                <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
                                    Date de soumission
                                </Typography>
                                <Typography sx={{ fontSize: '14px', fontWeight: 500, color: '#475569' }}>
                                    {dayjs(selectedExpense.createdAt).format('DD MMMM YYYY')}
                                </Typography>
                            </Box>
                            {selectedExpense.projet && (
                                <Box sx={{ gridColumn: '1 / -1' }}>
                                    <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
                                        Projet / Mission
                                    </Typography>
                                    <Typography sx={{ fontSize: '14px', fontWeight: 500, color: '#475569' }}>
                                        {selectedExpense.projet}
                                    </Typography>
                                </Box>
                            )}
                            {selectedExpense.justificatif && (
                                <Box sx={{ gridColumn: '1 / -1' }}>
                                    <Typography sx={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
                                        Justificatif
                                    </Typography>
                                    <a
                                        href={selectedExpense.justificatif}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '8px 16px',
                                            background: '#f0f5ff',
                                            borderRadius: '8px',
                                            color: '#0040a1',
                                            fontWeight: 600,
                                            fontSize: '13px',
                                            textDecoration: 'none',
                                            border: '1px solid #bfdbfe',
                                        }}
                                    >
                                        <FileText size={16} /> Voir le justificatif
                                    </a>
                                </Box>
                            )}
                        </Box>
                    </DialogContent>
                )}
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button
                        onClick={() => setDetailDialogOpen(false)}
                        sx={{ color: '#64748b', textTransform: 'none', borderRadius: '8px' }}
                    >
                        Fermer
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ─── Form Dialog (Employee) ─── */}
            <Dialog 
                open={isFormOpen} 
                onClose={() => setIsFormOpen(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{ sx: { borderRadius: '20px' } }}
            >
                <DialogTitle sx={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: '20px', pt: 3 }}>
                    Nouvelle Dépense
                </DialogTitle>
                <DialogContent>
                    <div className={`rmb-form-card ${formSuccess ? 'success' : ''}`} style={{ boxShadow: 'none', border: 'none', padding: 0, marginTop: '16px' }}>
                        <form onSubmit={handleSubmit}>
                            <div className="rmb-form-group">
                                <label className="rmb-form-label">Motif / Titre</label>
                                <input
                                    className="rmb-form-input"
                                    placeholder="Ex: Déplacement Client"
                                    type="text"
                                    value={titre}
                                    onChange={e => setTitre(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="rmb-form-group">
                                <label className="rmb-form-label">Date de la dépense</label>
                                <input
                                    className="rmb-form-input"
                                    type="date"
                                    value={dateDepense}
                                    onChange={e => setDateDepense(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="rmb-form-row rmb-form-group">
                                <div>
                                    <label className="rmb-form-label">Catégorie</label>
                                    <select
                                        className="rmb-form-select"
                                        value={categorie}
                                        onChange={e => setCategorie(e.target.value)}
                                    >
                                        {CATEGORIES.map(c => (
                                            <option key={c} value={c}>{c === 'Equipement' ? 'Équipement' : c}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="rmb-form-label">Montant (TND)</label>
                                    <input
                                        className="rmb-form-input"
                                        placeholder="0.000"
                                        type="number"
                                        step="0.001"
                                        value={montant}
                                        onChange={e => setMontant(e.target.value ? Number(e.target.value) : '')}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="rmb-form-group">
                                <label className="rmb-form-label">Projet / Mission</label>
                                <input
                                    className="rmb-form-input"
                                    placeholder="Nom du projet (Optionnel)"
                                    type="text"
                                    value={projet}
                                    onChange={e => setProjet(e.target.value)}
                                />
                            </div>
                            <div className="rmb-form-group">
                                <label className="rmb-form-label">Justificatif</label>
                                <div className={`rmb-upload-zone ${file ? 'has-file' : ''}`}>
                                    <input
                                        type="file"
                                        className="rmb-upload-input"
                                        onChange={handleFileChange}
                                        accept="image/*,.pdf"
                                    />
                                    <UploadCloud className="rmb-upload-icon" size={28} />
                                    <span className="rmb-upload-text">
                                        {file ? '' : 'Cliquez ou glissez le fichier'}
                                    </span>
                                    {file && <span className="rmb-file-name">{file.name}</span>}
                                    <span className="rmb-upload-hint">PDF, PNG, JPG (Max 10MB)</span>
                                </div>
                            </div>
                            <button
                                className="rmb-submit-btn"
                                type="submit"
                                disabled={addMutation.isPending}
                            >
                                {addMutation.isPending ? (
                                    <CircularProgress size={18} style={{ color: 'white' }} />
                                ) : (
                                    <Send size={16} />
                                )}
                                {addMutation.isPending ? 'ENVOI EN COURS...' : 'SOUMETTRE'}
                            </button>
                        </form>
                    </div>

                    <div className="rmb-tip-card" style={{ marginTop: '24px' }}>
                        <Info className="rmb-tip-icon" size={20} />
                        <p className="rmb-tip-text">
                            Les équipements de plus de 500 TND nécessitent une pré-autorisation.
                        </p>
                    </div>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3 }}>
                    <Button onClick={() => setIsFormOpen(false)} sx={{ color: '#64748b', textTransform: 'none' }}>
                        Annuler
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ─── Snackbar ─── */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={4000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    severity={snackbar.severity}
                    onClose={() => setSnackbar({ ...snackbar, open: false })}
                    sx={{ borderRadius: '10px', fontWeight: 600 }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </div>
    );
}

const RemboursementModern = () => (
    <QueryClientProvider client={queryClient}>
        <RemboursementModernContent />
    </QueryClientProvider>
);

export default RemboursementModern;
