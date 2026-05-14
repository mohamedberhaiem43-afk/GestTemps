import { Box, Grid, Button } from "@mui/material";
import SaveIcon from '@mui/icons-material/Save';
import InputComponent from "../../Inputs/Input";
import { useTranslation } from 'react-i18next';
import { useState, useEffect } from "react";
import CheckboxComponent from "../../CheckboxComponent/CheckboxComponent";
import SelectInputComponent from "../../SelectInputComponent/SelectInputComponent";
import useGetSocLibs from "../../../hooks/societeHooks/useGetSocLibs";
import useGetSiteLibs from "../../../hooks/siteHooks/useGetSiteLibs";
import useAddUser from "../../../hooks/userHooks/useAddUser";
import Utilisateur from "../../../models/Utilisateur";
import { useQuery } from "@tanstack/react-query";
import { useUserContext } from "../../helper/UserProvider";
import UtilisateurService from "../../../services/UtilisateurService/UtilisateurService";
import { useFeedbackSnackbar, extractErrorMessage } from "../../helper/FeedbackSnackbar";

interface SaisieUtilisateurProps {
    state:boolean,
    onDataChange: (data: any) => void;
    onSave: () => void;
}

function SaisieUtilisateur({ onDataChange,state, onSave }: SaisieUtilisateurProps) {
    const [uticod, setCode] = useState("");
    const { t } = useTranslation();
    const [utiprn, setPrenom] = useState("");
    const [utinom, setNom] = useState("");
    const [utimail, setUtimail] = useState("");
    const [utiadm, setIsAdmin] = useState(false);
    const [societe, setSociete] = useState("");
    const [site, setSite] = useState("");
    const { data: socLibs = [] } = useGetSocLibs();
    const { data: sitLibs = [] } = useGetSiteLibs();
    const { selectedUser } = useUserContext();

    const { error, isPending: isLoading } = useAddUser();

    // Call onDataChange whenever form data changes
    useEffect(() => {
        onDataChange({
            uticod,
            utinom,
            utiprn,
            utimail,
            utiadm: utiadm ? "1" : "0",
            soccod: societe,
            sitcod: site
        });
    }, [uticod, utinom, utiprn, utimail, utiadm, societe, site]);


    useQuery<Utilisateur[]>({
    queryKey: ['utilisateur', selectedUser],
    queryFn: async () => {
        if (!selectedUser) return [];
        const result = await UtilisateurService.getWithParams(`get-user/${selectedUser}`);
        setUtimail(result.utimail || "");
        setCode(result.uticod || "");
        setNom(result.utinom || "");
        setPrenom(result.utiprn || "");
        setIsAdmin(result.utiadm === "1");
        setSociete(result.soccod || "");
        setSite(result.sitcod || "");
        return Array.isArray(result) ? result : [result];
    },
    enabled: !!selectedUser,
    });

    const feedback = useFeedbackSnackbar();

    const handleSave = async () => {
        if (!uticod || !utiprn || !utinom || !societe || !site) {
            feedback.showError(t('common.requiredFields'));
            return;
        }
        onSave();
        try {
            feedback.showSuccess(t('user.updateSuccess'));
        } catch (err) {
            feedback.showError(err, t('user.updateError'));
        }
    };


    useEffect(() => {
        if (error) {
            // Fallback i18n si la réponse API n'a pas de message structuré.
            feedback.showError(extractErrorMessage(error, t('pointeuseAccees.form.addError')));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [error]);

    return (
        <Box sx={{ flexGrow: 1 }}>
            <Grid container spacing={2}>
                <Grid item xs={1}>
                    <InputComponent type="text" label={t('common.code')} readOnly={state} value={uticod} setValue={setCode} />
                </Grid>
                <Grid item xs={2}>
                    <InputComponent type="text" label={t('pointeuseAccees.form.email')} readOnly={state} value={utimail} setValue={setUtimail} />
                </Grid>
                <Grid item xs={1.5}>
                    <InputComponent type="text" label={t('pointeuseAccees.form.name')} readOnly={state} value={utinom} setValue={setNom} />
                </Grid>
                <Grid item xs={1.5}>
                    <InputComponent type="text" label={t('pointeuseAccees.form.firstName')} readOnly={state} value={utiprn} setValue={setPrenom} />
                </Grid>
                <Grid item xs={1.5} mt={1}>
                    <SelectInputComponent
                        label={t('pointeuseAccees.form.company')}
                        value={societe}
                        setValue={setSociete}
                        maplist={socLibs || []}
                    />
                </Grid>
                <Grid item xs={1.5} mt={1}>
                    <SelectInputComponent
                        label={t('pointeuseAccees.form.site')}
                        value={site}
                        setValue={setSite}
                        maplist={sitLibs || []}
                    />
                </Grid>
                <Grid item xs={1} mt={3}>
                    <CheckboxComponent label={t('pointeuseAccees.form.administrator')} value={utiadm} setValue={setIsAdmin} />
                </Grid>

                <Grid item xs={12}>
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<SaveIcon />}
                        onClick={handleSave}
                        disabled={isLoading}
                    >
                    </Button>
                </Grid>
            </Grid>

            {feedback.element}
        </Box>
    );
}

export default SaisieUtilisateur;
