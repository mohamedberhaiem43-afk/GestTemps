import React, { useState, useEffect } from 'react';
import {
    Button, Checkbox, FormControlLabel, Grid, Box,
    Paper, Typography, Divider, TextField, Snackbar, Alert
} from '@mui/material';
import { Save, Refresh, Cancel } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { FilialeList } from './FilialeList';
import useAddSite from '../../../hooks/siteHooks/useAddSite';
import useUpdateSite from '../../../hooks/siteHooks/useUpdateSite';
import useGetSites from '../../../hooks/siteHooks/useGetSites';
import BreadcrumbNavigation from '../../helper/BreadcrumbNavigation';
import { Filiale as FilialeModel } from '../../../models/Filiale';
import { useAuth } from '../../helper/AuthProvider';

interface FilialeFormProps {
    filialeToEdit?: FilialeModel | null;
    onEditComplete?: () => void;
}

function FilialeForm({ filialeToEdit, onEditComplete }: FilialeFormProps) {
    const { soccod } = useAuth(); // âœ… HERE
    const { t } = useTranslation();

    const emptyForm: FilialeModel = {
        sitcod: '',
        soccod: soccod || '',
        sitlib: '',
        sitadr: '',
        sittel: '',
        sitfax: '',
        sitemail: '',
        sitmois: 0,
        sitconge: 0,
        sitcongem: 0,
        sitsoc: '',
        sitpaie: '',
        sitsanch: '0',
        sitsancm: '0',
    };
    const [formData, setFormData] = useState<FilialeModel>(emptyForm);
    const [sitPrincipale, setSitPrincipale] = useState(false);
    const [exonere, setExonere] = useState(false);
    const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
        open: false, message: '', severity: 'success'
    });

    const { mutate: addSite, isPending: isAdding } = useAddSite();
    const { mutate: updateSite, isPending: isUpdating } = useUpdateSite();
    const { refetch } = useGetSites();

    const isEditMode = !!filialeToEdit;
    const isLoading = isAdding || isUpdating;

    useEffect(() => {
        if (filialeToEdit) {
            setFormData(filialeToEdit);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [filialeToEdit]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleReset = () => {
        setFormData({ ...emptyForm, soccod: soccod || '' });
        setSitPrincipale(false);
        setExonere(false);
        onEditComplete?.();
    };

    const handleSubmit = () => {
        if (!formData.sitcod || !formData.sitlib) {
            setSnackbar({ open: true, message: t('donneeDeBase.filiale.requiredFields'), severity: 'error' });
            return;
        }

        const onSuccess = () => {
            refetch();
            setSnackbar({ open: true, message: isEditMode ? t('donneeDeBase.filiale.updateSuccess') : t('donneeDeBase.filiale.saveSuccess'), severity: 'success' });
            handleReset();
        };
        const onError = () => {
            setSnackbar({ open: true, message: isEditMode ? t('donneeDeBase.filiale.updateError') : t('donneeDeBase.filiale.saveError'), severity: 'error' });
        };

        if (isEditMode) {
            updateSite(formData, { onSuccess, onError });
        } else {
            addSite(formData, { onSuccess, onError });
        }
    };

    return (
        <Paper elevation={2} sx={{ p: 3, mb: 3, borderRadius: 2 }}>
            <Typography variant="h6" fontWeight={600} mb={1} color="primary">
                {isEditMode ? t('donneeDeBase.filiale.editTitle') : t('donneeDeBase.filiale.newTitle')}
            </Typography>
            <Divider sx={{ mb: 3 }} />

            <Grid container spacing={2}>
                <Grid item xs={2} sm={6} md={3}>
                    <TextField
                        fullWidth size="small" label={t('donneeDeBase.filiale.code')} id="sitcod"
                        value={formData.sitcod} onChange={handleChange}
                        disabled={isEditMode}
                        required
                    />
                </Grid>
                <Grid item xs={3} sm={6} md={3}>
                    <TextField
                        fullWidth size="small" label={t('donneeDeBase.filiale.name')} id="sitlib"
                        value={formData.sitlib} onChange={handleChange}
                        required
                    />
                </Grid>
                <Grid item xs={3} sm={6} md={3}>
                    <TextField
                        fullWidth size="small" label={t('donneeDeBase.filiale.phone')} id="sittel"
                        value={formData.sittel} onChange={handleChange}
                    />
                </Grid>
                <Grid item xs={3} sm={6} md={3}>
                    <TextField
                        fullWidth size="small" label={t('donneeDeBase.filiale.fax')} id="sitfax"
                        value={formData.sitfax} onChange={handleChange}
                    />
                </Grid>
                <Grid item xs={3} sm={6} md={4}>
                    <TextField
                        fullWidth size="small" label={t('donneeDeBase.filiale.address')} id="sitadr"
                        value={formData.sitadr} onChange={handleChange}
                    />
                </Grid>
                <Grid item xs={3} sm={6} md={4}>
                    <TextField
                        fullWidth size="small" label={t('donneeDeBase.filiale.email')} id="sitemail"
                        type="email" value={formData.sitemail} onChange={handleChange}
                    />
                </Grid>
                <Grid item xs={1} sm={6} md={2}>
                    <TextField
                        fullWidth size="small" label={t('donneeDeBase.filiale.monthlyHours')} id="sitmois"
                        type="number" value={formData.sitmois} onChange={handleChange}
                    />
                </Grid>
                <Grid item xs={2} sm={6} md={2}>
                    <TextField
                        fullWidth size="small" label={t('donneeDeBase.filiale.leaveDays')} id="sitconge"
                        type="number" value={formData.sitconge} onChange={handleChange}
                    />
                </Grid>

                {/* Checkboxes */}
                <Grid item xs={1} sm={6} md={3}>
                    <FormControlLabel
                        control={<Checkbox size="small" checked={sitPrincipale} onChange={e => setSitPrincipale(e.target.checked)} />}
                        label={t('donneeDeBase.filiale.mainSite')}
                    />
                </Grid>
                <Grid item xs={1} sm={6} md={3}>
                    <FormControlLabel
                        control={<Checkbox size="small" checked={exonere} onChange={e => setExonere(e.target.checked)} />}
                        label={t('donneeDeBase.filiale.exempt')}
                    />
                </Grid>
            </Grid>

            {/* Actions */}
            <Box mt={3} display="flex" gap={1.5} flexWrap="wrap">
                <Button
                    variant="contained" startIcon={<Save />}
                    onClick={handleSubmit} disabled={isLoading}
                    size="small"
                >
                    {isLoading ? t('donneeDeBase.filiale.saving') : isEditMode ? t('donneeDeBase.filiale.update') : t('donneeDeBase.filiale.save')}
                </Button>
                <Button
                    variant="outlined" startIcon={<Refresh />}
                    onClick={handleReset} disabled={isLoading}
                    size="small"
                >
                    {t('donneeDeBase.filiale.newBtn')}
                </Button>
                {isEditMode && (
                    <Button
                        variant="outlined" color="error" startIcon={<Cancel />}
                        onClick={handleReset} disabled={isLoading}
                        size="small"
                    >
                        {t('donneeDeBase.filiale.cancel')}
                    </Button>
                )}
            </Box>

            <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
                <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
                    {snackbar.message}
                </Alert>
            </Snackbar>
        </Paper>
    );
}

export function Filiale() {
    const [selectedFiliale, setSelectedFiliale] = useState<FilialeModel | null>(null);
    return (
        <Box sx={{ minWidth: '90vw', px: 2, mt: -25 }}>
                <BreadcrumbNavigation />
                <FilialeForm
                    filialeToEdit={selectedFiliale}
                    onEditComplete={() => setSelectedFiliale(null)}
                />
                <FilialeList onEdit={(filiale) => setSelectedFiliale(filiale)} />
            </Box>
    );
}