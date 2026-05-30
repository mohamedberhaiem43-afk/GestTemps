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

        // Chargement de l'utilisateur à éditer. On NE peuple PAS le formulaire depuis
        // le queryFn (anti-pattern : les setState ne se rejouent pas quand React Query
        // sert la donnée depuis le cache → champs vides ou rôle/statut périmés, d'où
        // l'obligation de rafraîchir la page). On retourne la donnée et on peuple via
        // un useEffect. staleTime/gcTime=0 garantit une lecture fraîche à chaque
        // ouverture (sinon la modale rouvrait avec l'ancien rôle après changement).
        const { data: loadedUser } = useQuery({
            queryKey: ['utilisateur', selectedUser],
            queryFn: () => UtilisateurService.getWithParams(`get-user/${selectedUser}`),
            enabled: !!selectedUser,
            staleTime: 0,
            gcTime: 0,
        });

        useEffect(() => {
            if (!selectedUser || !loadedUser) return;
            setUtimail(loadedUser.utimail || "");
            setCode(loadedUser.uticod || "");
            setNom(loadedUser.utinom || "");
            setPrenom(loadedUser.utiprn || "");
            setIsAdmin(loadedUser.utiadm === "1");
            setRole(loadedUser.utirole || (loadedUser.utiadm === "1" ? "Administrator" : "Employee"));
            setSociete(loadedUser.soccod || "");
            setSite(loadedUser.sitcod || "");
            // Jamais de pré-remplissage du mot de passe (le DTO renvoie le hash) : on
            // le laisse vide pour que la sauvegarde ne ré-encode pas un hash existant.
            setMotPasse("");
        }, [loadedUser, selectedUser]);

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
                                autoComplete="new-password"
                                name="new-user-password"
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