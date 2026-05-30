import { useFeedbackSnackbar, extractErrorMessage } from "../../helper/FeedbackSnackbar";
import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { useTranslation } from "react-i18next";
import useGetSocLibs from "../../../hooks/societeHooks/useGetSocLibs";
import useGetSiteLibs from "../../../hooks/siteHooks/useGetSiteLibs";
import useAddUser from "../../../hooks/userHooks/useAddUser";
import Utilisateur from "../../../models/Utilisateur";
import { ROLE_OPTIONS, ROLE_LABELS } from "../../../models/Utilisateur";
import { useQuery } from "@tanstack/react-query";
import { useUserContext } from "../../helper/UserProvider";
import UtilisateurService from "../../../services/UtilisateurService/UtilisateurService";
import RolesService from "../../../services/RolesService/RolesService";
import { Role } from "../../../models/Role";
import "./Utilisateur.css";
import useUpdateUser from "../../../hooks/userHooks/useUpdateUser";

interface SaisieUtilisateurProps {
    onDataChange: (data: any) => void;
    profil: boolean;
}

export interface SaisieUtilisateurHandle {

    handleSave: () => Promise<boolean>;
}

const SaisieUtilisateur = forwardRef<SaisieUtilisateurHandle, SaisieUtilisateurProps>(
    ({ onDataChange, profil }, ref) => {
        const { t } = useTranslation();
        const [uticod, setCode] = useState("");
        const [utiprn, setPrenom] = useState("");
        const [utinom, setNom] = useState("");
        const [utimail, setUtimail] = useState("");
        const [utimps, setMotPasse] = useState("");
        const [utiadm, setIsAdmin] = useState(false);
        // Rôle par défaut "Employee" (libellé UI : "Employé"). Aligné avec
        // ROLE_OPTIONS et avec le défaut backend (PermissionCatalog.Roles.Employee).
        const [utirole, setRole] = useState("Employee");
        const [societe, setSociete] = useState("");
        const [site, setSite] = useState("");
        const { data: socLibs = [] } = useGetSocLibs();
        const { data: sitLibs = [] } = useGetSiteLibs();
        const { selectedUser } = useUserContext();

        // Rôles créés (page « Droit d'accès ») pour la liste roulante du rôle. Fallback
        // sur les rôles système (ROLE_OPTIONS) tant que la requête n'a pas répondu.
        const { data: rolesData = [] } = useQuery<Role[]>({
            queryKey: ['roles'],
            queryFn: RolesService.getAll,
        });
        const roleChoices = rolesData.length > 0
            ? rolesData.map((r) => ({ value: r.roleName, label: ROLE_LABELS[r.roleName] ?? r.roleName }))
            : ROLE_OPTIONS;

        const { mutateAsync: addUser, error: addError } = useAddUser();
        const { mutateAsync: updateUser, error: updateError } = useUpdateUser();

        const error = addError || updateError;

        useEffect(() => {
            onDataChange({
                uticod,
                utinom,
                utiprn,
                utimail,
                utimps,
                utiadm: utiadm ? "1" : "0",
                utirole,
                soccod: societe,
                sitcod: site
            });
        }, [uticod, utinom, utiprn, utimail, utimps, utiadm, utirole, societe, site]);

        // Pré-sélection du premier élément en mode création : évite à l'utilisateur de devoir
        // ouvrir le dropdown quand une seule (ou une évidente) société/filiale est attendue.
        // En mode édition (selectedUser présent), on laisse la valeur chargée depuis l'API.
        useEffect(() => {
            if (selectedUser) return;
            if (!societe) {
                const firstSoc = Object.keys(socLibs || {})[0];
                if (firstSoc) setSociete(firstSoc);
            }
            if (!site) {
                const firstSite = Object.keys(sitLibs || {})[0];
                if (firstSite) setSite(firstSite);
            }
        }, [socLibs, sitLibs, selectedUser]);

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
                setRole(result.utirole || (result.utiadm === "1" ? "Administrator" : "Employee"));
                setSociete(result.soccod || "");
                setSite(result.sitcod || "");
                return Array.isArray(result) ? result : [result];
            },
            enabled: !!selectedUser,
        });

        const feedback = useFeedbackSnackbar();

        // Sync role with admin checkbox (utilise les noms officiels PermissionCatalog.Roles)
        useEffect(() => {
            if (utiadm && utirole !== 'Administrator') {
                setRole('Administrator');
            }
        }, [utiadm]);

        const handleRoleChange = (newRole: string) => {
            setRole(newRole);
            if (newRole === 'Administrator') {
                setIsAdmin(true);
            } else if (utiadm) {
                setIsAdmin(false);
            }
        };

        const handleSave = async () => {
            if (!uticod || !utiprn || !utinom || !societe || !site) {
                feedback.showError(t('utilisateur.form.requiredFields'));
                return false;
            }

            const payload = {
                user: {
                    uticod,
                    utinom,
                    utiprn,
                    utimail,
                    utimps,
                    utiadm: utiadm ? "1" : "0",
                    utirole,
                },
                soccod: societe,
                sitcod: site
            };

            try {
                if (selectedUser) {
                    await updateUser(payload);
                } else {
                    await addUser(payload);
                }
                return true;
            } catch (err) {
                // Error handling is already done in useEffect [error]
                return false;
            }
        };

        useImperativeHandle(ref, () => ({
            handleSave
        }));

        useEffect(() => {
            if (error) {
                feedback.showError(extractErrorMessage(error, t('utilisateur.form.addError')));
            }
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [error]);

        return (
            <>
                <div className="aut-user-form">
                    <div className="aut-form-grid">
                        <div className="aut-form-field">
                            <label>{t('utilisateur.form.code')}</label>
                            <input
                                type="text"
                                placeholder={t('utilisateur.form.codePlaceholder')}
                                value={uticod}
                                onChange={(e) => setCode(e.target.value)}
                                readOnly={!!selectedUser}
                                className={selectedUser ? 'bg-slate-50 cursor-not-allowed' : ''}
                            />
                        </div>
                        <div className="aut-form-field">
                            <label>{t('utilisateur.form.name')}</label>
                            <input
                                type="text"
                                placeholder={t('utilisateur.form.namePlaceholder')}
                                value={utinom}
                                onChange={(e) => setNom(e.target.value)}
                            />
                        </div>
                        <div className="aut-form-field">
                            <label>{t('utilisateur.form.firstName')}</label>
                            <input
                                type="text"
                                placeholder={t('utilisateur.form.firstNamePlaceholder')}
                                value={utiprn}
                                onChange={(e) => setPrenom(e.target.value)}
                            />
                        </div>
                        <div className="aut-form-field">
                            <label>{t('utilisateur.form.email')}</label>
                            <input
                                type="email"
                                placeholder={t('utilisateur.form.emailPlaceholder')}
                                value={utimail}
                                onChange={(e) => setUtimail(e.target.value)}
                            />
                        </div>
                        <div className="aut-form-field">
                            <label>{t('utilisateur.form.password')}</label>
                            <input
                                type="password"
                                placeholder={t('utilisateur.form.passwordPlaceholder')}
                                value={utimps}
                                onChange={(e) => setMotPasse(e.target.value)}
                            />
                        </div>
                        <div className="aut-form-field">
                            <label>{t('utilisateur.form.company')}</label>
                            <select value={societe} onChange={(e) => setSociete(e.target.value)}>
                                <option value="">{t('utilisateur.form.selectPlaceholder')}</option>
                                {Object.entries(socLibs || {}).map(([k, v]) => (
                                    <option key={k} value={k}>
                                        {String(v)}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="aut-form-field">
                            <label>{t('utilisateur.form.site')}</label>
                            <select value={site} onChange={(e) => setSite(e.target.value)}>
                                <option value="">{t('utilisateur.form.selectPlaceholder')}</option>
                                {Object.entries(sitLibs || {}).map(([k, v]) => (
                                    <option key={k} value={k}>
                                        {String(v)}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {profil === false && (
                            <div className="aut-form-field">
                                <label>{t('utilisateur.form.role')}</label>
                                <select value={utirole} onChange={(e) => handleRoleChange(e.target.value)}>
                                    {roleChoices.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                {feedback.element}
            </>
        );
    });

export default SaisieUtilisateur;