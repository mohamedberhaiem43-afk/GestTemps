import { useTranslation } from "react-i18next";
import UserProvider from "../../helper/UserProvider";

import ListeUtilisateurRoles from "../../DonneeDeBase/Utilisteur/ListeUtilisateur.";
import DroitAcceesRoles from "../../DonneeDeBase/Utilisteur/DroitAccees";
import RolePointeuseAccess from "../../DonneeDeBase/Utilisteur/RolePointeuseAccess";

import { Shield, People, Fingerprint } from "@mui/icons-material";
import "../PointeuseAccees/DroitAccees.css";
// Les composants enfants (ListeUtilisateurRoles, DroitAcceesRoles, RolePointeuseAccess)
// utilisent les classes `.aut-*` et `.list-utilisateur-*` définies dans Utilisateur.css.
// Sans cet import, la page apparaît dénudée si l'utilisateur arrive directement sur
// /dashboard/droit-accees (refresh, deep-link) sans avoir d'abord visité
// /dashboard/gestion-utilisateur (qui charge ce CSS en premier).
import "../../DonneeDeBase/Utilisteur/Utilisateur.css";
function DroitAccessContent() {
  const { t } = useTranslation();
  return (
    <div className="da-page">
      {/* Page Header */}
      <div className="da-page-header">
        <div className="da-header-left">
          <Shield sx={{ fontSize: 28, color: '#0040a1' }} />
          <div>
            <h1 className="da-page-title">{t('pointeuseAccees.page.title')}</h1>
            <p className="da-page-subtitle">{t('pointeuseAccees.page.subtitle')}</p>
          </div>
        </div>
      </div>

      {/* ── Section 1: Autorisations par Rôle ─────────────────────── */}
      <div className="da-section">
        <div className="da-section-header">
          <div className="da-section-title-group">
            <People sx={{ fontSize: 20, color: '#0056d2' }} />
            <h2 className="da-section-title">{t('pointeuseAccees.page.rolesSection')}</h2>
          </div>
          <p className="da-section-desc">{t('pointeuseAccees.page.rolesDesc')}</p>
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
            <h2 className="da-section-title">{t('pointeuseAccees.page.punchSection')}</h2>
          </div>
          <p className="da-section-desc">{t('pointeuseAccees.page.punchDesc')}</p>
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
    <UserProvider>
        <DroitAccessContent />
      </UserProvider>
  );
}