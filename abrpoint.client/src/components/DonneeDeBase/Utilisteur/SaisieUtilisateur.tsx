import { Snackbar, Alert } from "@mui/material";
import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import useGetSocLibs from "../../../hooks/societeHooks/useGetSocLibs";
import useGetSiteLibs from "../../../hooks/siteHooks/useGetSiteLibs";
import useAddUser from "../../../hooks/userHooks/useAddUser";
import Utilisateur from "../../../models/Utilisateur";
import { ROLE_OPTIONS } from "../../../models/Utilisateur";
import { useQuery } from "react-query";
import { useUserContext } from "../../helper/UserProvider";
import UtilisateurService from "../../../services/UtilisateurService/UtilisateurService";
import "./Utilisateur.css";
import useUpdateUser from "../../../hooks/userHooks/useUpdateUser";

interface SaisieUtilisateurProps {
    onDataChange: (data: any) => void;
    profil: boolean;
}

interface ApiError {
    response?: {
        data?: {
            message?: string;
        };
    };
    message?: string;
}

export interface SaisieUtilisateurHandle {

    handleSave: () => Promise<boolean>;
}

const SaisieUtilisateur = forwardRef<SaisieUtilisateurHandle, SaisieUtilisateurProps>(
    ({ onDataChange, profil }, ref) => {
        const [uticod, setCode] = useState("");
        const [utiprn, setPrenom] = useState("");
        const [utinom, setNom] = useState("");
        const [utimail, setUtimail] = useState("");
        const [utimps, setMotPasse] = useState("");
        const [utiadm, setIsAdmin] = useState(false);
        const [utirole, setRole] = useState("standard");
        const [societe, setSociete] = useState("");
        const [site, setSite] = useState("");
        const { data: socLibs = [] } = useGetSocLibs();
        const { data: sitLibs = [] } = useGetSiteLibs();
        const { selectedUser } = useUserContext();

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
                setRole(result.utirole || (result.utiadm === "1" ? "admin" : "standard"));
                setSociete(result.soccod || "");
                setSite(result.sitcod || "");
                return Array.isArray(result) ? result : [result];
            },
            enabled: !!selectedUser,
        });

        const [snackbarOpen, setSnackbarOpen] = useState(false);
        const [snackbarMessage, setSnackbarMessage] = useState('');
        const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

        const handleSnackbarOpen = (message: string, severity: 'success' | 'error') => {
            setSnackbarMessage(message);
            setSnackbarSeverity(severity);
            setSnackbarOpen(true);
        };

        const handleSnackbarClose = () => {
            setSnackbarOpen(false);
        };

        // Sync role with admin checkbox
        useEffect(() => {
            if (utiadm && utirole !== 'admin') {
                setRole('admin');
            }
        }, [utiadm]);

        const handleRoleChange = (newRole: string) => {
            setRole(newRole);
            if (newRole === 'admin') {
                setIsAdmin(true);
            } else if (utiadm) {
                setIsAdmin(false);
            }
        };

        const handleSave = async () => {
            if (!uticod || !utiprn || !utinom || !societe || !site) {
                handleSnackbarOpen("Veuillez remplir tous les champs obligatoires.", 'error');
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
                const apiError = error as ApiError;
                const errorMessage =
                    apiError.response?.data?.message ||
                    apiError.message ||
                    "Erreur lors de l'ajout de l'utilisateur.";
                handleSnackbarOpen(errorMessage, 'error');
            }
        }, [error]);

        return (
            <>
                <div className="aut-user-form">
                    <div className="aut-form-grid">
                        <div className="aut-form-field">
                            <label>Code</label>
                            <input
                                type="text"
                                placeholder="Code utilisateur"
                                value={uticod}
                                onChange={(e) => setCode(e.target.value)}
                                readOnly={!!selectedUser}
                                className={selectedUser ? 'bg-slate-50 cursor-not-allowed' : ''}
                            />
                        </div>
                        <div className="aut-form-field">
                            <label>Nom</label>
                            <input
                                type="text"
                                placeholder="Nom"
                                value={utinom}
                                onChange={(e) => setNom(e.target.value)}
                            />
                        </div>
                        <div className="aut-form-field">
                            <label>Prénom</label>
                            <input
                                type="text"
                                placeholder="Prénom"
                                value={utiprn}
                                onChange={(e) => setPrenom(e.target.value)}
                            />
                        </div>
                        <div className="aut-form-field">
                            <label>Email</label>
                            <input
                                type="email"
                                placeholder="email@exemple.com"
                                value={utimail}
                                onChange={(e) => setUtimail(e.target.value)}
                            />
                        </div>
                        <div className="aut-form-field">
                            <label>Mot de passe</label>
                            <input
                                type="password"
                                placeholder="••••••••"
                                value={utimps}
                                onChange={(e) => setMotPasse(e.target.value)}
                            />
                        </div>
                        <div className="aut-form-field">
                            <label>Société</label>
                            <select value={societe} onChange={(e) => setSociete(e.target.value)}>
                                <option value="">Sélectionner...</option>
                                {Object.entries(socLibs || {}).map(([k, v]) => (
                                    <option key={k} value={k}>
                                        {String(v)}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="aut-form-field">
                            <label>Site / Filiale</label>
                            <select value={site} onChange={(e) => setSite(e.target.value)}>
                                <option value="">Sélectionner...</option>
                                {Object.entries(sitLibs || {}).map(([k, v]) => (
                                    <option key={k} value={k}>
                                        {String(v)}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {profil === false && (
                            <div className="aut-form-field">
                                <label>Rôle</label>
                                <select value={utirole} onChange={(e) => handleRoleChange(e.target.value)}>
                                    {ROLE_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                <Snackbar open={snackbarOpen} autoHideDuration={6000} onClose={handleSnackbarClose}>
                    <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} sx={{ width: '100%' }}>
                        {snackbarMessage}
                    </Alert>
                </Snackbar>
            </>
        );
    });

export default SaisieUtilisateur;