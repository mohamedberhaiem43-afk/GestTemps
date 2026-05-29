import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Button, Box, Grid, InputLabel, Input, Stack, CircularProgress,
    Paper, Typography, Chip, Alert,
} from '@mui/material';
import "./Societe.css";
import InputComponent from '../../Inputs/Input';
import PhoneInput from '../../Inputs/PhoneInput';
import { Save, Cancel, TravelExplore } from '@mui/icons-material';
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

// ──────────────────────────────────────────────────────────────────────────
// Récupération des informations légales/fiscales via le SIRET.
// Source : API publique recherche-entreprises.api.gouv.fr (Annuaire des
// Entreprises, INSEE/SIRENE) — sans authentification ni clé, CORS ouvert.
// ──────────────────────────────────────────────────────────────────────────

interface SiretInfo {
    siren: string;
    siret: string;
    raisonSociale: string;
    adresse: string;
    ville: string;
    /** N° TVA intracommunautaire calculé depuis le SIREN (clé mod 97). */
    tvaIntra: string;
    /** Code activité principale (APE/NAF), ex. « 62.01Z ». */
    ape: string;
    formeJuridique: string;
    trancheEffectif: string;
    /** Régime de TVA estimé (réel normal / simplifié / franchise) à titre indicatif. */
    regimeFiscal: string;
}

/** Numéro de TVA intracommunautaire français : « FR » + clé(2) + SIREN(9). */
function computeTvaIntra(siren: string): string {
    const n = parseInt(siren, 10);
    if (!Number.isFinite(n)) return '';
    const key = (12 + 3 * (n % 97)) % 97;
    return `FR${key.toString().padStart(2, '0')}${siren}`;
}

/** Estime un régime de TVA d'après la tranche d'effectif (indicatif uniquement). */
function estimateRegime(trancheCode: string | null | undefined): string {
    // Sans CA déclaré, on ne peut qu'indiquer le régime le plus courant : réel normal
    // pour une entreprise avec salariés, franchise/micro pour 0 salarié.
    if (!trancheCode || trancheCode === 'NN' || trancheCode === '00') return 'Franchise en base / micro (à vérifier)';
    return 'Réel normal (à vérifier)';
}

async function lookupSiret(rawSiret: string): Promise<SiretInfo> {
    const siret = rawSiret.replace(/\s/g, '');
    if (!/^\d{9}$|^\d{14}$/.test(siret)) {
        throw new Error('Saisissez un SIREN (9 chiffres) ou un SIRET (14 chiffres).');
    }
    const url = `https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(siret)}&page=1&per_page=1`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Service indisponible (HTTP ${res.status}).`);
    const data = await res.json();
    const r = data?.results?.[0];
    if (!r) throw new Error('Aucune entreprise trouvée pour ce numéro.');

    const siege = r.siege ?? {};
    const siren: string = r.siren ?? siret.slice(0, 9);
    return {
        siren,
        siret: siege.siret ?? siret,
        raisonSociale: r.nom_raison_sociale || r.nom_complet || '',
        adresse: siege.adresse || siege.geo_adresse || '',
        ville: siege.libelle_commune || '',
        tvaIntra: computeTvaIntra(siren),
        ape: r.activite_principale || siege.activite_principale || '',
        formeJuridique: r.nature_juridique || '',
        trancheEffectif: r.tranche_effectif_salarie || siege.tranche_effectif_salarie || '',
        regimeFiscal: estimateRegime(r.tranche_effectif_salarie),
    };
}

interface SaisieSocieteProps {
    societeToEdit?: Societe | null;
    onEditComplete?: () => void;
}

export function SaisieSociete({ societeToEdit, onEditComplete }: SaisieSocieteProps) {
    const [societeData, setSocieteData] = useState<Societe>(emptyForm);
    const feedback = useFeedbackSnackbar();

    // ── Recherche SIRET (champ transient, non persisté) ──
    const [siret, setSiret] = useState('');
    const [siretLoading, setSiretLoading] = useState(false);
    const [siretError, setSiretError] = useState<string | null>(null);
    const [siretInfo, setSiretInfo] = useState<SiretInfo | null>(null);

    const handleSiretLookup = async () => {
        setSiretError(null);
        setSiretLoading(true);
        try {
            const info = await lookupSiret(siret);
            setSiretInfo(info);
            // Auto-remplissage des champs d'identité que l'API fournit de façon fiable.
            // On respecte les longueurs de colonnes (soclib 30, socadr 40, socville 60).
            setSocieteData((prev) => ({
                ...prev,
                soclib: info.raisonSociale ? info.raisonSociale.slice(0, 30) : prev.soclib,
                socadr: info.adresse ? info.adresse.slice(0, 40) : prev.socadr,
                socville: info.ville ? info.ville.slice(0, 60) : prev.socville,
            }));
            feedback.showSuccess('Informations récupérées depuis l’Annuaire des Entreprises.');
        } catch (e: any) {
            setSiretInfo(null);
            setSiretError(e?.message || 'Échec de la récupération.');
        } finally {
            setSiretLoading(false);
        }
    };

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
                    {/* Recherche par SIRET — pré-remplit l'identité + affiche les données fiscales */}
                    <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2, bgcolor: '#f8fafc' }}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'flex-end' }}>
                            <Box sx={{ flex: 1, minWidth: 220 }}>
                                <InputLabel shrink>SIREN / SIRET</InputLabel>
                                <Input
                                    fullWidth
                                    size="small"
                                    placeholder="Ex. 552081317 ou 55208131766522"
                                    value={siret}
                                    onChange={(e) => setSiret(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSiretLookup(); } }}
                                />
                            </Box>
                            <Button
                                variant="contained"
                                startIcon={siretLoading ? <CircularProgress size={18} color="inherit" /> : <TravelExplore />}
                                onClick={handleSiretLookup}
                                disabled={siretLoading || !siret.trim()}
                            >
                                {siretLoading ? 'Recherche…' : 'Récupérer les informations'}
                            </Button>
                        </Stack>

                        {siretError && <Alert severity="warning" sx={{ mt: 1.5 }}>{siretError}</Alert>}

                        {siretInfo && (
                            <Box sx={{ mt: 2 }}>
                                <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '.05em', mb: 1 }}>
                                    Données officielles récupérées
                                </Typography>
                                <Stack direction="row" flexWrap="wrap" gap={1}>
                                    {siretInfo.siren && <Chip size="small" label={`SIREN : ${siretInfo.siren}`} />}
                                    {siretInfo.tvaIntra && <Chip size="small" color="primary" variant="outlined" label={`TVA intracom. : ${siretInfo.tvaIntra}`} />}
                                    {siretInfo.ape && <Chip size="small" label={`APE/NAF : ${siretInfo.ape}`} />}
                                    {siretInfo.formeJuridique && <Chip size="small" label={`Forme juridique : ${siretInfo.formeJuridique}`} />}
                                    {siretInfo.regimeFiscal && <Chip size="small" color="secondary" variant="outlined" label={`Régime fiscal : ${siretInfo.regimeFiscal}`} />}
                                </Stack>
                                <Typography sx={{ fontSize: 11.5, color: '#64748b', mt: 1 }}>
                                    Raison sociale et adresse ont été pré-remplies. Le n° TVA intracommunautaire et le régime
                                    fiscal sont indicatifs — reportez-les manuellement dans les champs comptables adaptés.
                                </Typography>
                            </Box>
                        )}
                    </Paper>

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
                            <PhoneInput label={t('donneeSociete.phone')} value={societeData.soctel || ''}
                                onChange={(value) => setSocieteData({ ...societeData, soctel: value })} />
                        </Grid>
                        <Grid item xs={1.5} md={6}>
                            <PhoneInput label={t('donneeSociete.fax')} value={societeData.socfax || ''}
                                onChange={(value) => setSocieteData({ ...societeData, socfax: value })} />
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