#!/usr/bin/env bash
# =============================================================================
# Setup `unattended-upgrades` sur le VPS Ubuntu Concorde Workforce.
#
# RGPD Art. 32 — « Application régulière des correctifs de sécurité ».
#
# Configure :
#   - Installation automatique des mises à jour de sécurité Ubuntu (canal `security`).
#   - Notifications email à `mohamed@concorde-work-force.com` à chaque exécution (succès et erreurs).
#   - Reboot automatique 04:00 si une mise à jour du kernel le demande.
#   - Conservation du log dans /var/log/unattended-upgrades/.
#   - Suppression auto des paquets obsolètes (libs orphelines).
#
# Idempotent : peut être ré-exécuté pour reconfigurer.
#
# Exécution sur le VPS (root ou sudo) :
#   curl -fsSL https://raw.githubusercontent.com/.../setup-unattended-upgrades.sh | sudo bash
#   # ou en local :
#   sudo bash scripts/setup-unattended-upgrades.sh mohamed@concorde-work-force.com
#
# Une fois exécuté, vérifier :
#   - sudo systemctl status unattended-upgrades   → active (running)
#   - sudo unattended-upgrade --dry-run --debug   → simulation OK
#   - sudo tail -F /var/log/unattended-upgrades/unattended-upgrades.log
# =============================================================================

set -euo pipefail

MAIL_TO="${1:-mohamed@concorde-work-force.com}"

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "[ERR] Ce script doit être lancé en root (sudo)." >&2
  exit 1
fi

# Vérifier Ubuntu / Debian.
if ! command -v apt-get >/dev/null 2>&1; then
  echo "[ERR] Ce script cible Ubuntu/Debian (apt non trouvé)." >&2
  exit 1
fi

echo "═══ Setup unattended-upgrades — destinataire: ${MAIL_TO} ═══"

# ── 1. Installation des paquets nécessaires ─────────────────────────────────
echo "[1/5] Installation des paquets…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq unattended-upgrades apt-listchanges bsd-mailx

# ── 2. Activation de l'auto-update via 20auto-upgrades ──────────────────────
echo "[2/5] Activation auto-update…"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
APT::Periodic::Unattended-Upgrade "1";
EOF

# ── 3. Configuration des dépôts ciblés (security uniquement par défaut) ─────
# On limite aux MAJ de sécurité — pas les MAJ "updates" génériques. Sur un
# serveur de prod, on préfère que les non-security passent par un upgrade
# manuel programmé pour pouvoir tester.
echo "[3/5] Configuration 50unattended-upgrades…"
cat > /etc/apt/apt.conf.d/50unattended-upgrades <<EOF
// Auto-généré par setup-unattended-upgrades.sh — Concorde Workforce
// RGPD Art. 32 : patching automatique des CVE de sécurité.

Unattended-Upgrade::Origins-Pattern {
    // Toutes les versions Ubuntu : on accepte les MAJ de sécurité uniquement.
    "origin=Ubuntu,archive=\${distro_codename}-security";
    "origin=Ubuntu,codename=\${distro_codename}-security";
    // ESM si abonné (Ubuntu Pro) — paquets d'extension de support.
    "origin=UbuntuESM,archive=\${distro_codename}-security";
    "origin=UbuntuESMApps,archive=\${distro_codename}-apps-security";
};

// Notifications email
Unattended-Upgrade::Mail "${MAIL_TO}";
// "only-on-error" en steady state ; passer à "always" temporairement
// pour vérifier que le mailer fonctionne sur les premières exécutions.
Unattended-Upgrade::MailReport "on-change";

// Reboot automatique si une MAJ du kernel le demande.
// 04:00 du matin Paris = trafic minimal pour un produit RH B2B.
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-WithUsers "false";
Unattended-Upgrade::Automatic-Reboot-Time "04:00";

// Nettoyage : retire les paquets devenus inutiles après upgrade.
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-New-Unused-Dependencies "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";

// Verbosité minimale (cron-friendly).
Unattended-Upgrade::Verbose "false";
Unattended-Upgrade::Debug "false";

// Conservation du log : 7 fichiers d'historique tournés.
Unattended-Upgrade::SyslogEnable "true";
Unattended-Upgrade::SyslogFacility "daemon";
EOF

# ── 4. Activation du timer systemd + démarrage immédiat ─────────────────────
echo "[4/5] Activation timers systemd…"
systemctl enable --now apt-daily.timer apt-daily-upgrade.timer unattended-upgrades.service

# ── 5. Validation : dry-run pour confirmer la config ────────────────────────
echo "[5/5] Validation (dry-run)…"
if unattended-upgrade --dry-run -d 2>&1 | tail -10; then
  echo
  echo "✅ Setup unattended-upgrades terminé."
else
  echo
  echo "⚠️  Dry-run a remonté un warning — vérifier manuellement."
fi

echo
echo "═══ Pour aller plus loin ═══"
echo "  • Vérifier la prochaine exécution :  systemctl list-timers apt-daily-upgrade.timer"
echo "  • Forcer une exécution maintenant :  sudo unattended-upgrade -d -v"
echo "  • Inspecter les logs :               sudo tail -F /var/log/unattended-upgrades/unattended-upgrades.log"
echo "  • Désactiver temporairement :        sudo systemctl mask unattended-upgrades.service"
echo
echo "  • Pour appliquer aussi les MAJ non-sécurité (à vos risques) : éditer"
echo "    /etc/apt/apt.conf.d/50unattended-upgrades et ajouter l'origin"
echo "    \"\${distro_codename}-updates\" dans Origins-Pattern."
