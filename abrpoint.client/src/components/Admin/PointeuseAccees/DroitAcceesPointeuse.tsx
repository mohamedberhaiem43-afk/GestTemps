import { QueryClientProvider, QueryClient } from "react-query";
import UserProvider from "../../helper/UserProvider";

import ListeUtilisateurRoles from "../../DonneeDeBase/Utilisteur/ListeUtilisateur.";
import DroitAcceesRoles from "../../DonneeDeBase/Utilisteur/DroitAccees";
import RolePointeuseAccess from "../../DonneeDeBase/Utilisteur/RolePointeuseAccess";

import { Shield, People, Fingerprint } from "@mui/icons-material";
import "../PointeuseAccees/DroitAccees.css";

const queryClient = new QueryClient();

function DroitAccessContent() {
  return (
    <div className="da-page">
      {/* Page Header */}
      <div className="da-page-header">
        <div className="da-header-left">
          <Shield sx={{ fontSize: 28, color: '#0040a1' }} />
          <div>
            <h1 className="da-page-title">Gestion des Droits d'Accès</h1>
            <p className="da-page-subtitle">Gérez les autorisations par rôle et les accès aux pointeuses</p>
          </div>
        </div>
      </div>

      {/* ── Section 1: Autorisations par Rôle ─────────────────────── */}
      <div className="da-section">
        <div className="da-section-header">
          <div className="da-section-title-group">
            <People sx={{ fontSize: 20, color: '#0056d2' }} />
            <h2 className="da-section-title">Autorisations par Rôle</h2>
          </div>
          <p className="da-section-desc">Définissez les permissions de chaque rôle pour les modules de l'application</p>
        </div>
        <div className="da-section-body">
          <div className="da-roles-grid">
            <ListeUtilisateurRoles />
            <DroitAcceesRoles />
          </div>
        </div>
      </div>

      {/* ── Section 2: Droit d'accès Pointeuses (par Rôle) ─────────── */}
      <div className="da-section">
        <div className="da-section-header">
          <div className="da-section-title-group">
            <Fingerprint sx={{ fontSize: 20, color: '#005236' }} />
            <h2 className="da-section-title">Droit d'Accès Pointeuses</h2>
          </div>
          <p className="da-section-desc">Attribuez les accès de lecture, configuration et purge pour chaque pointeuse par rôle</p>
        </div>
        <div className="da-section-body">
          <div className="da-roles-grid">
            <ListeUtilisateurRoles />
            <RolePointeuseAccess />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DroitAccessPointeuse() {
  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <DroitAccessContent />
      </UserProvider>
    </QueryClientProvider>
  );
}