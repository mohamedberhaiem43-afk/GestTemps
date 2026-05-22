# Guide capture screenshots — App Store + Google Play

Ce document liste les **trois méthodes** disponibles pour produire les screenshots
attendus par les deux stores, classées par fidélité et complexité.

| Méthode | Fidélité visuelle | Effort | Quand l'utiliser |
|---|---|---|---|
| 1. Web responsive via Playwright | Bonne | Minimal | Avant la 1ère soumission, screenshots "convaincants" sans simulateur |
| 2. Simulateur iOS / Émulateur Android | Excellente | Moyen | Soumission finale, marketing screens montrant la vraie chrome OS |
| 3. Appareil physique | Parfaite | Élevé | Vidéos / GIFs / preview |

---

## Méthode 1 — Web responsive via Playwright (recommandée pour démarrer)

Script déjà fourni : `store/capture-screenshots.mjs`.

### Pré-requis

```bash
# Installer Playwright + le navigateur Chromium
cd abrpoint.mobile
npm install -D playwright
npx playwright install chromium

# Variables d'environnement (toutes obligatoires)
export BASE_URL="http://localhost:5173"          # ou staging.concorde-work-force.com
export REVIEWER_EMAIL="reviewer@concorde-work-force.com"
export REVIEWER_PASSWORD="<mot-de-passe-réel-du-tenant-de-démo>"
```

### Lancer la capture

```bash
node store/capture-screenshots.mjs
```

### Résultat

```
store/screenshots/
├── iphone-6.7/
│   ├── 01-login.png         (1290×2796)
│   ├── 02-dashboard.png
│   ├── 03-pointage.png
│   └── ...
├── ipad-13/
│   └── 01-login.png         (2048×2732)
└── android-phone/
    └── 01-login.png         (1080×2400)
```

Ces PNG peuvent être uploadés **tels quels** dans App Store Connect / Google Play
Console — les dimensions correspondent exactement aux specs stores.

### Limites

- Pas de status bar iOS (heure, batterie, etc.) — Apple ne l'exige pas mais c'est
  moins immersif
- Pas d'encoche iPhone — idem
- Le rendu reflète le web responsive : tu n'auras pas le menu burger natif que
  les utilisateurs voient en vrai dans l'app React Native

Pour le 1er launch c'est suffisant. Pour une v1.1 polish, passer en méthode 2.

---

## Méthode 2 — Simulateur iOS (Xcode) + Émulateur Android (Android Studio)

### 2.1 iOS Simulator (macOS uniquement)

```bash
# Si tu n'as pas de Mac — utilise un Mac loué (MacStadium, MacInCloud)
# ou un Mac d'un collègue.

# Sur le Mac :
xcode-select --install              # outils CLI si pas déjà
# Installer Xcode depuis l'App Store

# Lancer le simulateur
open -a Simulator
# → Hardware → Device → iOS 17 → iPhone 15 Pro Max
# → Hardware → Device → iOS 17 → iPad Pro 13-inch (M4)
```

#### Lancer ton app Expo dans le simulateur

```bash
cd abrpoint.mobile

# Option A : Expo Go (rapide)
npx expo start --ios

# Option B : Build natif local (recommandé pour screenshots — sans bannière Expo Go)
npx expo prebuild --platform ios
npx expo run:ios --device "iPhone 15 Pro Max"
```

#### Capturer

- ⌘ + S dans le simulateur → `~/Desktop/Simulator Screen Shot - ...` (PNG)
- OU `xcrun simctl io booted screenshot ~/Desktop/screen.png`

Les dimensions sont **exactement** celles attendues par App Store Connect :
- iPhone 15 Pro Max → 1290×2796
- iPad Pro 13" M4 → 2064×2752

#### Scénario de captures recommandé (8 screenshots iPhone, 4 iPad)

1. **Login redesigné** — premier contact, doit "vendre" l'app
2. **Home** avec carte de pointage du jour
3. **Calendrier coloré** (la feature qu'on a ajoutée) — distinctif
4. **Add Request** (la screen unifiée) — montre la rapidité
5. **Leave Request** rempli avec date picker ouvert
6. **Expense** avec photo de justificatif attachée
7. **Manager Dashboard** — différencie l'app pour la cible RH/manager
8. **Profile** avec biométrie activée — appuie sur l'aspect sécurité

### 2.2 Android Studio AVD

```bash
# Installer Android Studio
# Lancer AVD Manager → Create Virtual Device → Pixel 7 Pro → API 34

# Lancer ton app
cd abrpoint.mobile
npx expo run:android
```

#### Capturer

- Boutons en haut du panneau émulateur → caméra
- OU `adb exec-out screencap -p > screen.png`

Dimensions natives Pixel 7 Pro : 1440×3120 → **redimensionner** à 1080×2400 pour
Google Play (Play accepte 1080×1920 / 1080×2400) :

```bash
# Avec Python + PIL (déjà installé sur la machine)
python -c "
from PIL import Image
img = Image.open('screen.png').resize((1080, 2400), Image.LANCZOS)
img.save('screen-resized.png')
"
```

---

## Méthode 3 — Appareil physique (pour vidéos et hero shots)

Pour une vidéo de **preview** App Store (15-30s, taux de conversion +25% selon
les études) :

```bash
# iOS — depuis QuickTime Player sur Mac
File → New Movie Recording → Source → ton iPhone (branché USB)

# Android
adb shell screenrecord /sdcard/demo.mp4
# OU Vysor / scrcpy + OBS Studio
```

Spec App Store preview :
- Durée : 15-30 secondes
- Format : .mp4 ou .mov, H.264, 30 fps
- Audio optionnel mais recommandé (musique libre de droits — Pixabay, FreePD)

Pas obligatoire pour le launch — peut être ajouté plus tard.

---

## Habillage marketing (augmentation du taux de conversion)

Les screenshots bruts convertissent moins bien que des screenshots **annotés**
avec un caption + un device frame. Outils gratuits :

| Outil | Lien | Pro/Contra |
|---|---|---|
| **Screenshots.pro** | screenshots.pro | UI propre, free tier généreux |
| **Previewed** | previewed.app | Templates animés, 50 free/mo |
| **Figma + community templates** | figma.com/community → "App Store screenshot" | Gratuit, contrôle total, mais à faire à la main |
| **Mockuuups Studio** | mockuuups.studio | Très qualitatif, payant ($15/mo) |

### Captions suggérés (à overlayer sur chaque screenshot)

| # | Screenshot | Caption FR | Caption EN |
|---|---|---|---|
| 1 | Login | "Pointez en 1 clic" | "Clock in with one tap" |
| 2 | Dashboard | "Votre journée, en un coup d'œil" | "Your day, at a glance" |
| 3 | Calendrier | "Visualisez congés et heures sup" | "See leaves and overtime at a glance" |
| 4 | Add Request | "Demandez en quelques secondes" | "Request time off in seconds" |
| 5 | Expense | "Frais en photo, validation rapide" | "Snap a receipt, get approved fast" |
| 6 | Team view | "Managez votre équipe en mobilité" | "Manage your team on the go" |
| 7 | Vault | "Coffre numérique sécurisé" | "Secure digital vault" |
| 8 | Profile | "Verrouillage biométrique" | "Biometric lock for your data" |

---

## Specs récap par store

### App Store Connect

| Device class | Résolution | Min/Max | Obligatoire |
|---|---|---|---|
| iPhone 6.7" (15 Pro Max) | 1290×2796 portrait | 2-10 | **Oui** |
| iPhone 6.5" (XS Max, 11 Pro Max) | 1242×2688 portrait | 2-10 | Optionnel (si 6.7" fourni) |
| iPad 13" (iPad Pro M4) | 2064×2752 portrait | 2-10 | **Oui** (car `supportsTablet: true`) |
| iPad 12.9" gen2-3 | 2048×2732 portrait | 2-10 | Optionnel (si iPad 13" fourni) |

### Google Play

| Device class | Résolution | Min/Max | Obligatoire |
|---|---|---|---|
| Phone | 1080×1920 ou 1080×2400 portrait | 2-8 | **Oui** |
| 7" tablet | 1200×1920 portrait | 1-8 | Optionnel (boost visibilité) |
| 10" tablet | 1600×2560 portrait | 1-8 | Optionnel |
| Feature graphic | 1024×500 | 1 | **Oui** (image affichée en haut de la fiche store) |

---

## Feature graphic Google Play (1024×500)

C'est l'image affichée en haut de la fiche Play Store. Doit contenir :
- Logo Concorde Workly (ou wordmark)
- Tagline courte ("Pointage & RH simplifiés")
- Pas de bouton "Install" — Google interdit
- Pas de prix
- Pas de captures d'écran (Google interdit dans le feature graphic)

Templates : figma.com/community → "Google Play feature graphic" — il y en a 100s gratuits.

---

## Workflow recommandé pour ton launch

1. **Aujourd'hui** — lance la méthode 1 (Playwright web) → 24 screenshots en 5 minutes
2. **Demain** — review visuelle. Si les compositions plaisent, garder. Sinon, passer en méthode 2 (simulateur).
3. **Avant submission** — habiller les 8 meilleurs avec Screenshots.pro / Figma. Bumps significatifs en conversion.
4. **Optionnel post-launch** — produire une video preview (15s) pour App Store.

L'objectif n'est pas la perfection au launch : Apple/Google permettent de
remplacer les screenshots à tout moment, sans resubmission. Itère en production
après avoir analysé les premiers usages.
