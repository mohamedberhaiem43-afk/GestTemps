import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Box, Grid, Snackbar, Alert } from '@mui/material';
import "./Societe.css";
import InputComponent from '../../Inputs/Input';
import { Save, Cancel } from '@mui/icons-material';
import useAddSociete from '../../../hooks/societeHooks/useAddSociete';
import useUpdateSociete from '../../../hooks/societeHooks/useUpdateSociete';
import useGetSocietes from '../../../hooks/societeHooks/useGetSocietes';
import { Societe } from '../../../models/Societe';

const emptyForm: Societe = {
    soccod: '', soclib: '', socresp: '', socadr: '', socville: '', soctel: '', socfax: '',
    socemail: '', socccb: '', soctva: '', soctva1: '', soctva2: '', soctva3: '',
    soctva000: '000', socreg: 0, socmois: 0.0, soctype: '', socpresence: '',
    sochsup: '', socmere: '', socsmig: '', soclibar: '', socadrar: '', socrespar: ''
};

interface SaisieSocieteProps {
    societeToEdit?: Societe | null;
    onEditComplete?: () => void;
}

export function SaisieSociete({ societeToEdit, onEditComplete }: SaisieSocieteProps) {
    const [societeData, setSocieteData] = useState<Societe>(emptyForm);
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('error');

    const { mutate: addSociete, isLoading: isAdding } = useAddSociete();
    const { mutate: updateSociete, isLoading: isUpdating } = useUpdateSociete();
    const { refetch } = useGetSocietes();
    const { t } = useTranslation();

    const isEditMode = !!societeToEdit;
    const isLoading = isAdding || isUpdating;

    // Populate form when a société is selected for editing
    useEffect(() => {
        if (societeToEdit) {
            setSocieteData(societeToEdit);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [societeToEdit]);

    const handleSnackbarClose = () => setSnackbarOpen(false);

    const handleCancel = () => {
        setSocieteData(emptyForm);
        onEditComplete?.();
    };

    const handleSubmit = () => {
        if (!societeData.soccod || !societeData.soclib) {
            setSnackbarMessage(t('donneeSociete.requiredFields'));
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
            return;
        }

        const onSuccess = () => {
            refetch();
            setSnackbarMessage(isEditMode ? t('donneeSociete.updated') : t('donneeSociete.added'));
            setSnackbarSeverity('success');
            setSnackbarOpen(true);
            setSocieteData(emptyForm);
            onEditComplete?.();
        };

        const onError = () => {
            setSnackbarMessage(isEditMode ? t('donneeSociete.updateError') : t('donneeSociete.addError'));
            setSnackbarSeverity('error');
            setSnackbarOpen(true);
        };

        if (isEditMode) {
            updateSociete(societeData, { onSuccess, onError });
        } else {
            addSociete(societeData, { onSuccess, onError });
        }
    };

    return (
        <>
            <Box>
                <Box component={'form'}>
                    <Grid container spacing={2}>
                        <Grid item xs={0.7} md={6}>
                            <InputComponent label={t('common.code')} type="text" value={societeData.soccod}
                                setValue={(value: any) => setSocieteData({ ...societeData, soccod: value })}
                                readOnly={isEditMode} // Code should not be editable in update mode
                            />
                        </Grid>
                        <Grid item xs={1.5} md={6}>
                            <InputComponent label="Société Mére" type="text" value={societeData.socmere}
                                setValue={(value: any) => setSocieteData({ ...societeData, socmere: value })} />
                        </Grid>
                        <Grid item xs={1.5} md={6}>
                            <InputComponent label={t('common.label')} type="text" value={societeData.soclib}
                                setValue={(value: any) => setSocieteData({ ...societeData, soclib: value })} />
                        </Grid>
                        <Grid item xs={1.5} md={6}>
                            <InputComponent label="Adresse" type="text" value={societeData.socadr}
                                setValue={(value: any) => setSocieteData({ ...societeData, socadr: value })} />
                        </Grid>
                        <Grid item xs={1.5} md={6}>
                            <InputComponent label="Tél" type="text" value={societeData.soctel}
                                setValue={(value: any) => setSocieteData({ ...societeData, soctel: value })} />
                        </Grid>
                        <Grid item xs={1.5} md={6}>
                            <InputComponent label="Fax" type="text" value={societeData.socfax}
                                setValue={(value: any) => setSocieteData({ ...societeData, socfax: value })} />
                        </Grid>
                        <Grid item xs={1.5} md={6}>
                            <InputComponent label="E-Mail" type="email" value={societeData.socemail}
                                setValue={(value: any) => setSocieteData({ ...societeData, socemail: value })} />
                        </Grid>
                        <Grid item xs={1.5} md={6}>
                            <InputComponent label="Responsable" type="text" value={societeData.socresp}
                                setValue={(value: any) => setSocieteData({ ...societeData, socresp: value })} />
                        </Grid>
                        <Grid item xs={1} md={6}>
                            <InputComponent label="Régime" type="number" value={societeData.socreg.toString()}
                                setValue={(value: any) => setSocieteData({ ...societeData, socreg: parseInt(value, 10) || 0 })} />
                        </Grid>
                        <Grid item xs={1.5} md={6}>
                            <InputComponent label="Valeur SMIG" type="text" value={societeData.socsmig}
                                setValue={(value: any) => setSocieteData({ ...societeData, socsmig: value })} />
                        </Grid>
                        <Grid item xs={2} md={6}>
                            <InputComponent label="Nb. Heures par Mois" type="number" value={societeData.socmois}
                                setValue={(value: any) => setSocieteData({ ...societeData, socmois: value })} />
                        </Grid>
                        <Grid item xs={1} md={6}>
                            <InputComponent label="N.CCB" type="text" value={societeData.socccb}
                                setValue={(value: any) => setSocieteData({ ...societeData, socccb: value })} />
                        </Grid>
                        <Grid item xs={1} md={6}>
                            <InputComponent label="Code TVA" type="text" value={societeData.soctva}
                                setValue={(value: any) => setSocieteData({ ...societeData, soctva: value })} />
                        </Grid>
                        <Grid item xs={1} md={6}>
                            <InputComponent label="Code TVA 1" type="text" value={societeData.soctva1}
                                setValue={(value: any) => setSocieteData({ ...societeData, soctva1: value })} />
                        </Grid>
                        <Grid item xs={1} md={6}>
                            <InputComponent label="Code TVA 2" type="text" value={societeData.soctva2}
                                setValue={(value: any) => setSocieteData({ ...societeData, soctva2: value })} />
                        </Grid>
                        <Grid item xs={1} md={6}>
                            <InputComponent label="Code TVA 3" type="text" value={societeData.soctva3}
                                setValue={(value: any) => setSocieteData({ ...societeData, soctva3: value })} />
                        </Grid>
                        <Grid item xs={1.3} md={6}>
                            <InputComponent label="Code TVA 000" type="text" value={societeData.soctva000}
                                setValue={(value: any) => setSocieteData({ ...societeData, soctva000: value })} readOnly />
                        </Grid>
                    </Grid>
                    <Box mt={4} display="flex" gap={2}>
                        <Button
                            variant="outlined"
                            startIcon={<Save />}
                            onClick={handleSubmit}
                            disabled={isLoading}
                        >
                            {isLoading
                                ? t('common.saving')
                                : isEditMode ? t('common.update') : t('common.save')}
                        </Button>
                        {isEditMode && (
                            <Button
                                variant="outlined"
                                color="error"
                                startIcon={<Cancel />}
                                onClick={handleCancel}
                                disabled={isLoading}
                            >
                                {t('common.cancel')}
                            </Button>
                        )}
                    </Box>
                </Box>
                <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={handleSnackbarClose}>
                    <Alert onClose={handleSnackbarClose} severity={snackbarSeverity}>
                        {snackbarMessage}
                    </Alert>
                </Snackbar>
            </Box>
        </>
    );
}