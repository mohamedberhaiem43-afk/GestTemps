import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Box, Grid } from '@mui/material';
import "./Societe.css";
import InputComponent from '../../Inputs/Input';
import { Save, Cancel } from '@mui/icons-material';
import useAddSociete from '../../../hooks/societeHooks/useAddSociete';
import useUpdateSociete from '../../../hooks/societeHooks/useUpdateSociete';
import useGetSocietes from '../../../hooks/societeHooks/useGetSocietes';
import { Societe } from '../../../models/Societe';
import { useFeedbackSnackbar } from '../../helper/FeedbackSnackbar';

const emptyForm: Societe = {
    soccod: '', soclib: '', socresp: '', socadr: '', socville: '', soctel: '', socfax: '',
    socemail: '', socccb: '', soctva: '', soctva1: '', soctva2: '', soctva3: '',
    soctva000: '000', socreg: 0, socmois: 0.0, soctype: '', socpresence: '',
    sochsup: '', socmere: '', socsmig: null, soclibar: '', socadrar: '', socrespar: ''
};

// SMIG est saisi en texte côté UI mais doit partir en `double?` côté backend.
// On accepte les virgules et espaces (ex: "1 200,50") et on retourne null pour
// chaîne vide / format invalide afin d'éviter l'erreur de désérialisation.
function parseSmig(raw: string): number | null {
    const cleaned = raw.replace(/\s/g, '').replace(',', '.').trim();
    if (cleaned === '') return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
}

interface SaisieSocieteProps {
    societeToEdit?: Societe | null;
    onEditComplete?: () => void;
}

export function SaisieSociete({ societeToEdit, onEditComplete }: SaisieSocieteProps) {
    const [societeData, setSocieteData] = useState<Societe>(emptyForm);
    const feedback = useFeedbackSnackbar();

    const { mutate: addSociete, isPending: isAdding } = useAddSociete();
    const { mutate: updateSociete, isPending: isUpdating } = useUpdateSociete();
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

    const handleCancel = () => {
        setSocieteData(emptyForm);
        onEditComplete?.();
    };

    const handleSubmit = () => {
        if (!societeData.soccod || !societeData.soclib) {
            feedback.showError(t('donneeSociete.requiredFields'));
            return;
        }

        const onSuccess = () => {
            refetch();
            feedback.showSuccess(isEditMode ? t('donneeSociete.updated') : t('donneeSociete.added'));
            setSocieteData(emptyForm);
            onEditComplete?.();
        };

        const onError = (err: any) => {
            feedback.showError(err, isEditMode ? t('donneeSociete.updateError') : t('donneeSociete.addError'));
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
                            <InputComponent label={t('donneeSociete.parentCompany')} type="text" value={societeData.socmere}
                                setValue={(value: any) => setSocieteData({ ...societeData, socmere: value })} />
                        </Grid>
                        <Grid item xs={1.5} md={6}>
                            <InputComponent label={t('common.label')} type="text" value={societeData.soclib}
                                setValue={(value: any) => setSocieteData({ ...societeData, soclib: value })} />
                        </Grid>
                        <Grid item xs={1.5} md={6}>
                            <InputComponent label={t('donneeSociete.address')} type="text" value={societeData.socadr}
                                setValue={(value: any) => setSocieteData({ ...societeData, socadr: value })} />
                        </Grid>
                        <Grid item xs={1.5} md={6}>
                            <InputComponent label={t('donneeSociete.phone')} type="text" value={societeData.soctel}
                                setValue={(value: any) => setSocieteData({ ...societeData, soctel: value })} />
                        </Grid>
                        <Grid item xs={1.5} md={6}>
                            <InputComponent label={t('donneeSociete.fax')} type="text" value={societeData.socfax}
                                setValue={(value: any) => setSocieteData({ ...societeData, socfax: value })} />
                        </Grid>
                        <Grid item xs={1.5} md={6}>
                            <InputComponent label={t('donneeSociete.email')} type="email" value={societeData.socemail}
                                setValue={(value: any) => setSocieteData({ ...societeData, socemail: value })} />
                        </Grid>
                        <Grid item xs={1.5} md={6}>
                            <InputComponent label={t('donneeSociete.responsible')} type="text" value={societeData.socresp}
                                setValue={(value: any) => setSocieteData({ ...societeData, socresp: value })} />
                        </Grid>
                        <Grid item xs={1} md={6}>
                            <InputComponent label={t('donneeSociete.regime')} type="number" value={societeData.socreg.toString()}
                                setValue={(value: any) => setSocieteData({ ...societeData, socreg: parseInt(value, 10) || 0 })} />
                        </Grid>
                        <Grid item xs={1.5} md={6}>
                            <InputComponent label={t('donneeSociete.smigValue')} type="text" value={societeData.socsmig ?? ''}
                                setValue={(value: any) => setSocieteData({ ...societeData, socsmig: parseSmig(String(value)) })} />
                        </Grid>
                        <Grid item xs={2} md={6}>
                            <InputComponent label={t('donneeSociete.hoursPerMonth')} type="number" value={societeData.socmois}
                                setValue={(value: any) => setSocieteData({ ...societeData, socmois: value })} />
                        </Grid>
                        <Grid item xs={1} md={6}>
                            <InputComponent label={t('donneeSociete.ccb')} type="text" value={societeData.socccb}
                                setValue={(value: any) => setSocieteData({ ...societeData, socccb: value })} />
                        </Grid>
                        <Grid item xs={1} md={6}>
                            <InputComponent label={t('donneeSociete.tvaCode')} type="text" value={societeData.soctva}
                                setValue={(value: any) => setSocieteData({ ...societeData, soctva: value })} />
                        </Grid>
                        <Grid item xs={1} md={6}>
                            <InputComponent label={t('donneeSociete.tvaCode1')} type="text" value={societeData.soctva1}
                                setValue={(value: any) => setSocieteData({ ...societeData, soctva1: value })} />
                        </Grid>
                        <Grid item xs={1} md={6}>
                            <InputComponent label={t('donneeSociete.tvaCode2')} type="text" value={societeData.soctva2}
                                setValue={(value: any) => setSocieteData({ ...societeData, soctva2: value })} />
                        </Grid>
                        <Grid item xs={1} md={6}>
                            <InputComponent label={t('donneeSociete.tvaCode3')} type="text" value={societeData.soctva3}
                                setValue={(value: any) => setSocieteData({ ...societeData, soctva3: value })} />
                        </Grid>
                        <Grid item xs={1.3} md={6}>
                            <InputComponent label={t('donneeSociete.tvaCode000')} type="text" value={societeData.soctva000}
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
                {feedback.element}
            </Box>
        </>
    );
}