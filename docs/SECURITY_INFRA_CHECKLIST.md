# Sécurité infrastructure — Checklist de déploiement

Ce document liste les vérifications à effectuer **côté hébergeur / OS / cloud
provider** pour atteindre la conformité totale de la section II du contrat
client (Article 32 RGPD). Les mesures ci-dessous ne sont **pas implémentables
dans le code applicatif** et doivent être validées au moment du provisionnement
de chaque environnement (dev / pre-prod / prod).

Convention : `[ ]` = à vérifier ; `[x]` = validé ; chaque case doit être datée
et signée par l'ingénieur ops responsable dans le runbook interne.

---

## 1. Chiffrement au repos de PostgreSQL

PostgreSQL n'a pas de TDE natif (à la différence de SQL Server ou Oracle). La
conformité « chiffrement au repos de la base contenant des données sensibles »
s'obtient au **niveau du volume** sur lequel `/var/lib/postgresql/data` est
monté. Trois approches acceptées :

### 1.a. Chiffrement de volume managé (cloud)

Le plus simple et le plus courant. Quand le cluster est hébergé sur :

- **AWS RDS PostgreSQL** : activer `StorageEncrypted = true` à la création (KMS
  `aws/rds` ou CMK dédiée). Non modifiable a posteriori — il faut re-créer
  l'instance + restaurer depuis snapshot chiffré.
  - [ ] Snapshot final non chiffré supprimé après bascule.
  - [ ] KMS Key Policy restreinte au role IAM de l'instance + ops.
- **Azure Database for PostgreSQL** : Transparent Data Encryption (TDE) activé
  par défaut depuis 2022. Vérifier `Data encryption = Customer-managed key` si
  Azure Key Vault est utilisé.
- **GCP Cloud SQL PostgreSQL** : chiffrement Google-managed key activé par
  défaut (AES-256). Pour CMEK, configurer la clé Cloud KMS européenne.
- **OVH / Scaleway / Clever Cloud** : confirmer par écrit avec le fournisseur
  que les volumes Postgres sont chiffrés (LUKS sous-jacent).

### 1.b. Chiffrement de disque OS (auto-hébergé)

Quand Postgres tourne en conteneur Docker sur un VPS bare-metal — c'est notre
configuration actuelle (cf. `docker-compose.yml`). Utiliser **LUKS** :

```bash
# Création d'un volume LUKS sur /dev/sdb destiné aux données Postgres
sudo cryptsetup luksFormat /dev/sdb
sudo cryptsetup luksOpen /dev/sdb postgres_data
sudo mkfs.ext4 /dev/mapper/postgres_data
sudo mkdir -p /var/lib/abrpoint/postgres
sudo mount /dev/mapper/postgres_data /var/lib/abrpoint/postgres

# Ouverture automatique au boot via /etc/crypttab + clé en /root/.luks-key
# (mode 0400, sauvegardée hors site dans le coffre Bitwarden de l'équipe ops).
echo "postgres_data /dev/sdb /root/.luks-key luks" | sudo tee -a /etc/crypttab
echo "/dev/mapper/postgres_data /var/lib/abrpoint/postgres ext4 defaults 0 2" \
  | sudo tee -a /etc/fstab
```

Puis ajuster le `docker-compose.yml` :

```yaml
services:
  abrpoint.database:
    volumes:
      - /var/lib/abrpoint/postgres:/var/lib/postgresql/data
```

- [ ] Volume LUKS activé, clé conservée hors-machine (Bitwarden / 1Password).
- [ ] `lsblk` confirme `crypt` sur le volume Postgres.
- [ ] Test de redémarrage : le service Postgres remonte automatiquement.
- [ ] Procédure de récupération de clé documentée + testée annuellement.

### 1.c. Chiffrement applicatif des colonnes ultra-sensibles

Complémentaire (defense in depth). Déjà utilisé pour certaines PII via
`EncryptionService` (AES-256-GCM, clé `Encryption:AesKey`). À étendre
progressivement aux colonnes :

- [ ] `utilisateur.utimps` (déjà BCrypt, ne pas double-chiffrer).
- [x] `refresh_tokens.token` (hash SHA-256, cf. `RefreshTokenHasher`).
- [x] `employe.empcin`, `employe.emptel`, `employe.empsbase/brut/net` — pseudonymisation automatique AES-256-GCM via EF Core value converter (cf. `Data/EncryptedStringConverter.cs`). Aucun nouveau code applicatif ne peut écrire ces champs en clair.
- [ ] `signatures.private_key` — déjà chiffré.

---

## 2. Sauvegardes hors site (S3 EU)

Les scripts `scripts/backup.sh` et `scripts/restore-test.sh` gèrent
l'application — l'infrastructure doit fournir :

- [ ] Bucket S3 créé en région **eu-west-3 (Paris)** ou **eu-central-1
  (Frankfurt)**. Région explicitement UE. Aucun bucket en us-east-* ou
  ap-southeast-*.
- [ ] **Versioning** activé (rollback en cas de corruption silencieuse).
- [ ] **Object Lock** en mode `governance` ou `compliance` (anti-rançongiciel
  — empêche la suppression même par un compromis du compte AWS).
- [ ] **Lifecycle rule** : transition vers Glacier Instant Retrieval à J+30,
  expiration à J+365 (cohérent avec la rétention des dumps mensuels).
- [ ] **Bucket Policy** : refuse explicitement `s3:PutObject` sans en-tête
  `x-amz-server-side-encryption: AES256`.
- [ ] **IAM role dédié** au runner de backup, scope limité à
  `s3:PutObject`, `s3:GetObject`, `s3:ListBucket` sur ce bucket uniquement.
  Pas de `*` ni de `s3:DeleteObject` (la rotation est faite par lifecycle).
- [ ] Clé `BACKUP_ENC_KEY` (32+ caractères, `openssl rand -base64 48`)
  conservée dans le coffre ops + injectée via Docker secrets / env var.
  **Jamais commitée** dans le repo ni dans le bucket S3.

Cron à planifier sur la VM ops :
```
# Backup quotidien à 03:00 Paris
0 3 * * * /opt/abrpoint/scripts/backup.sh >> /var/log/abrpoint-backup.log 2>&1
# Test de restauration le 1er du mois à 05:00
0 5 1 * * /opt/abrpoint/scripts/restore-test.sh >> /var/log/abrpoint-restore-test.log 2>&1
```

- [ ] Cron actif (`crontab -l` côté `root`).
- [ ] Alerte email si `restore-test.sh` retourne un code ≠ 0 (via
  `MAILTO=mohamed@concorde-work-force.com` dans la crontab).

---

## 3. TLS et reverse proxy

Voir `nginx.conf` pour la configuration applicative. Côté infrastructure :

- [ ] Certificats Let's Encrypt renouvelés automatiquement (Certbot timer
  systemd actif).
- [ ] Test SSL Labs ≥ A : <https://www.ssllabs.com/ssltest/>.
- [ ] HSTS preload soumis : <https://hstspreload.org/>.
- [ ] Headers `Strict-Transport-Security`, `X-Content-Type-Options`,
  `X-Frame-Options`, `Content-Security-Policy` configurés.

---

## 4. Anti-malware / détection d'intrusion

Mesure annoncée dans les CGU comme « obligation de moyens, à l'état de
l'art ». État actuel :

### 4.a. Détection (déployé en code)

- [x] **CrowdSec** intégré au `docker-compose.yml` (service `crowdsec`)
  avec collections : `crowdsecurity/nginx`, `crowdsecurity/http-cve`,
  `crowdsecurity/base-http-scenarios`. Lit les logs nginx (volume partagé
  `nginx_logs`), détecte brute-force auth, scan de CVE, path traversal,
  scrapping massif, OWASP top 10 génériques.
- [x] `DISABLE_ONLINE_API: true` par défaut — aucune donnée HTTP n'est
  partagée avec la community blocklist tant que cette décision n'a pas
  été validée par le DPO (envoi de patterns de logs vers CrowdSec.com
  même anonymisés mérite une revue RGPD).

### 4.b. Blocage effectif (étape ops à faire avant production)

Le service CrowdSec ci-dessus **détecte** mais ne **bloque pas** par défaut.
Pour activer le blocage, ajouter un **bouncer**. Deux options :

**Option recommandée — firewall-bouncer côté host** (zéro modif nginx) :
```bash
# Sur le VPS, en dehors de docker :
sudo curl -s https://install.crowdsec.net | sudo sh
sudo apt install crowdsec-firewall-bouncer-iptables
# Récupérer l'API key du conteneur :
docker exec abrpoint.crowdsec cscli bouncers add fw-bouncer
# Coller la clé dans /etc/crowdsec/bouncers/crowdsec-firewall-bouncer.yaml
sudo systemctl restart crowdsec-firewall-bouncer
```

**Option alternative — bouncer nginx Lua** : nécessite une image nginx
custom (FROM nginx:alpine + module `lua-resty-http` + `crowdsec-nginx-bouncer`).
Plus chirurgical (n'affecte que HTTP) mais introduit une image maintenue
en interne.

- [ ] Choix entre firewall-bouncer (host) et nginx bouncer (Lua) documenté.
- [ ] Bouncer installé et opérationnel : `cscli decisions list` montre des
  IPs bloquées dans les 7 jours suivant le go-live.
- [ ] Alerte email/Slack quand `cscli alerts list -s ip` retourne > 0 nouvelle
  alerte par heure.

### 4.c. Compléments

- [ ] **ClamAV** scanné quotidiennement sur les volumes uploads (uploads
  utilisateur = vecteur d'attaque le plus fréquent).
- [ ] Logs nginx envoyés vers un SIEM (Wazuh, Graylog, ou simplement
  fluentd → fichier rotaté avec alertes sur patterns suspicieux).
- [ ] Décision DPO sur l'activation de la community blocklist CrowdSec
  (`DISABLE_ONLINE_API: false`) — bénéfice : utilisation de la blocklist
  collaborative (millions d'IPs malveillantes connues) ; risque : envoi
  de métadonnées d'incidents à CrowdSec SAS.

---

## 5. Cloisonnement environnements

- [ ] Dev / pre-prod / prod sur des **machines physiques distinctes** (ou au
  moins comptes cloud distincts).
- [ ] Aucun secret de prod présent en dev ou pre-prod.
- [ ] Bases de données dev / pre-prod jamais alimentées depuis des dumps prod
  sans **anonymisation préalable** (script à fournir si jamais le besoin
  apparaît — aujourd'hui non utilisé).
- [ ] Accès SSH prod restreint à 2 ingénieurs maximum, clés publiques
  enregistrées dans `~/.ssh/authorized_keys`, mot de passe désactivé.

---

## 5.bis. Sécurité mobile (à valider à chaque release EAS)

### Certificate pinning (A2)

L'infrastructure est en place — pins en `placeholder-*` par défaut, refusés
par le check pre-build.

- [ ] À chaque release prod, lancer `cd abrpoint.mobile && bash scripts/generate-le-pins.sh` et coller les valeurs Base64 obtenues dans :
  - [`assets/network_security_config.xml`](../abrpoint.mobile/assets/network_security_config.xml) — bloc `<pin-set>`
  - [`app.json`](../abrpoint.mobile/app.json) — `ios.infoPlist.NSAppTransportSecurity.NSPinnedDomains."concorde-work-force.com".NSPinnedCAIdentities`
- [ ] Vérifier que `bash scripts/check-pins-filled.sh` retourne ✅ avant `eas build --profile production`.
- [ ] Brancher le check dans `eas.json` ou le pipeline CI/CD :
  ```json
  { "build": { "production": { "prebuildCommand": "bash scripts/check-pins-filled.sh" } } }
  ```
- [ ] Calendrier ops : rappel **annuel** pour re-générer (LE rotate les intermédiaires environ tous les 5 ans, mais le check annuel est une bonne hygiène).
- [ ] Rappel 30 jours avant `<pin-set expiration="2035-09-15">` — à 60 jours, planifier la révision avec l'évolution de la chaîne LE.

### Détection device avancée (A3)

- [x] Heuristiques JS étendues dans `deviceSecurity.ts` : isPhysicalDevice, signatures émulateurs (Genymotion, BlueStacks, Nox, Memu, Andy, LDPlayer, x86_64 simulator), build tags Android suspects (test-keys, dev-keys, userdebug, eng), OS hors-de-date (iOS < 16, Android < 11), debug build, instrumentation NativeModules (Frida/objection).
- [x] Trust report envoyé au backend après login (`submitDeviceTrustReport` → `POST /api/MobileAuth/device-trust-report`), journalisé dans `audit_log` avec rétention 6 mois.
- [ ] **Roadmap V1.2** : ajouter `jail-monkey` via EAS dev client pour une détection native robuste (résistante au hooking JS). Plan d'action : `npx expo install jail-monkey` + plugin config dans `app.json`, puis brancher dans `deviceSecurity.ts` comme signal additionnel à côté des heuristiques actuelles.

## 6. Patching OS et veille CVE (A5)

### 6.a. Patching automatique Ubuntu (host VPS)

Un script `scripts/setup-unattended-upgrades.sh` configure
`unattended-upgrades` sur le VPS Ubuntu avec :
- MAJ automatiques du canal `security` uniquement (pas les `updates` génériques
  — ceux-ci passent par un upgrade manuel programmé pour pouvoir tester).
- Notifications email à `mohamed@concorde-work-force.com` à chaque changement.
- Reboot auto 04:00 si MAJ kernel nécessaire (trafic min sur produit RH B2B).
- Nettoyage auto des paquets orphelins après upgrade.

À exécuter une fois sur le VPS :
```bash
sudo bash /opt/abrpoint/scripts/setup-unattended-upgrades.sh mohamed@concorde-work-force.com
```

- [ ] Script exécuté sur le VPS de prod.
- [ ] `systemctl list-timers apt-daily-upgrade.timer` montre la prochaine exécution.
- [ ] Premier email d'exécution reçu dans `mohamed@concorde-work-force.com`.
- [ ] `apt list --upgradable 2>/dev/null | grep -i security` vide en steady-state.

### 6.b. Veille CVE des images Docker (PostgreSQL, nginx, .NET, node, alpine)

Trois mécanismes complémentaires :

| Mécanisme | Cible | Fréquence | Fichier |
|---|---|---|---|
| **Dependabot Docker** | Tags des images de base (`postgres:16-alpine`, `nginx:alpine`, `mcr.microsoft.com/dotnet/aspnet:8.0`…) | Hebdomadaire (lundi) | [`.github/dependabot.yml`](../.github/dependabot.yml) |
| **Trivy filesystem scan** | Secrets en clair, misconfigs Dockerfile / docker-compose | À chaque PR + hebdomadaire | [`.github/workflows/security-scan.yml`](../.github/workflows/security-scan.yml) |
| **Trivy image scan** | CVE des paquets OS et libraries de chaque image buildée (abrpoint-server, abrpoint-client) | À chaque PR + hebdomadaire | Idem |

- [x] Dependabot Docker activé (cf. `dependabot.yml:90+`).
- [x] Trivy filesystem scan ajouté à `security-scan.yml` — bloque le PR sur HIGH/CRITICAL.
- [x] Trivy image scan ajouté — informationnel (HIGH/CRITICAL listés, ne bloque pas le PR car beaucoup de CVE images .NET sont transients).
- [ ] Revue mensuelle des sorties Trivy par l'équipe DevOps.

### 6.c. Veille CVE applicative (.NET, npm, Python)

| Outil | Cible | Bloquant ? |
|---|---|---|
| `dotnet list package --vulnerable --include-transitive` | Packages NuGet | ✅ Bloque PR |
| `npm audit --audit-level=high` | Packages npm (client + mobile) | ✅ Bloque PR sur high/critical |
| `pip-audit` | Dépendances Python sidecar RAG | ⚠️ Informationnel |
| Dependabot security updates | Tous écosystèmes | PR auto |

Cf. [`.github/workflows/security-scan.yml`](../.github/workflows/security-scan.yml).

### 6.d. Veille externe

- [ ] Inscription au flux CVE de PostgreSQL : <https://www.postgresql.org/support/security/>
- [ ] Inscription FR-CERT (alertes CVE par secteur) : <https://www.cert.ssi.gouv.fr/>
- [ ] Revue mensuelle de la console Anthropic (advisories LLM)
- [ ] Suivi des advisories nginx via mailing list ou GitHub Security Advisories

---

## Récapitulatif RGPD Art. 32 — État au moment de la publication

| Mesure | Implémentation | Référence |
|---|---|---|
| TLS 1.2+ | ✅ Code + infra | `nginx.conf:67-68` |
| Chiffrement au repos | ⚠️ Infra (cf. §1) | Ce document, §1 |
| BCrypt mots de passe | ✅ Code | `ABRPOINT.Server.csproj` |
| Hash refresh tokens | ✅ Code | `Services/RefreshTokenHasher.cs` |
| Pseudonymisation | ✅ Code | `Data/EncryptedStringConverter.cs` + `EncryptionService.cs` (CIN, téléphone, salaires automatiques) |
| MFA TOTP | ✅ Code | `Otp.NET` + `UtilisateursController` |
| HIBP k-anonymity | ✅ Code | `Services/PasswordBreachCheckService.cs` |
| Verrouillage progressif | ✅ Code | `Models/Utilisateur.cs` + rate limiter |
| Alerte nouvel appareil + HMAC | ✅ Code | `Services/SuspiciousLoginTokenService.cs` |
| Mobile : screenshot block / device check / cert pinning | ✅ Code | `abrpoint.mobile/src/hooks/useSecureScreen.ts` + `network_security_config.xml` + `app.json:NSPinnedDomains` + `src/services/deviceSecurity.ts` |
| Cloisonnement environnements | ✅ Infra | Ce document, §5 |
| Journalisation accès + rétention 6 mois | ✅ Code | `Services/AuditLogRetentionHostedService.cs` |
| Purge données techniques (refresh tokens, devices, push, RAG) | ✅ Code | `Services/DataRetentionHostedService.cs` |
| Patching dépendances + images Docker | ✅ CI | `.github/dependabot.yml` + `.github/workflows/security-scan.yml` (Trivy + dotnet vulnerable + npm audit + pip-audit) |
| Patching OS (Ubuntu) | ⚠️ Code prêt — ops à exécuter | `scripts/setup-unattended-upgrades.sh` |
| Sauvegardes chiffrées S3 EU + tests mensuels | ✅ Code + ⚠️ Infra | `scripts/backup.sh` + `scripts/restore-test.sh` + ce document §2 |
| Anti-malware / IDS | ✅ Détection (Code) + ⚠️ Bouncer (ops, cf. §4.b) | `docker-compose.yml` (service crowdsec) + ce document, §4 |
