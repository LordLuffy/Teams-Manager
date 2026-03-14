# Teams License & Telephony Manager

Application desktop **Tauri 2 + React + TypeScript + Rust** pour auditer les licences Microsoft 365, les numéros Teams et les ressources de téléphonie.

---

## 1. Prérequis

### Outils de développement

| Outil | Version | Installation |
|-------|---------|--------------|
| Rust  | stable  | `rustup.rs`  |
| Node.js | LTS 20+ | `nodejs.org` |
| Tauri CLI | v2 | `cargo install tauri-cli` |

Dépendances système Windows : WebView2 (préinstallé sur Windows 11) et Visual C++ Build Tools.

### Prérequis runtime (utilisateur final — Windows uniquement)

| Prérequis | Pourquoi | Installation |
|-----------|----------|--------------|
| **PowerShell 7** (`pwsh`) | Le module MicrosoftTeams v5+ embarque des DLL .NET 8 incompatibles avec PowerShell 5.1 (Windows built-in) | [aka.ms/powershell](https://aka.ms/powershell) |
| **Module PowerShell MicrosoftTeams** | Récupération des Files d'attente et Auto Attendants via `Get-CsCallQueue` / `Get-CsAutoAttendant` | Installé automatiquement par l'application au démarrage |

> **Note OneDrive** : Si votre dossier `Documents` est synchronisé par OneDrive, le module Teams PS peut être installé sous `OneDrive\Documents\PowerShell\Modules`. En cas d'erreur "Accès refusé", installez manuellement depuis une session PowerShell 7 admin :
> ```powershell
> Install-Module MicrosoftTeams -Scope AllUsers
> ```

> **Détection automatique** : L'application détecte `pwsh.exe` au démarrage. Si PowerShell 7 est absent, un bouton "Télécharger PowerShell 7" s'affiche dans les onglets Files d'attente et Auto Attendants.

---

## 2. Architecture

### Structure du projet

```
TeamsAnalysis/
├── src/                        # Frontend React
│   ├── App.tsx                 # Routing setup/auth/dashboard
│   ├── types.ts                # Interfaces TypeScript
│   ├── index.css               # CSS variables + utility classes
│   └── components/
│       ├── SetupScreen.tsx     # Configuration Tenant/Client ID
│       ├── AuthScreen.tsx      # Device code flow UI
│       ├── Dashboard.tsx       # Sidebar + topbar + onglets
│       ├── DataTable.tsx       # Table générique (tri, recherche, export)
│       └── tabs/               # 9 onglets métier
│           ├── DirectoryUsersTab.tsx
│           ├── PhoneUsersTab.tsx
│           ├── FreeNumbersTab.tsx
│           ├── OrphanLicensesTab.tsx
│           ├── UserLicensesTab.tsx
│           ├── SubscriptionsTab.tsx
│           ├── CallQueuesTab.tsx
│           ├── AutoAttendantsTab.tsx
│           └── ResourceAccountsTab.tsx
└── src-tauri/                  # Backend Rust
    ├── src/
    │   ├── main.rs             # Point d'entrée Tauri
    │   ├── lib.rs              # Commandes Tauri + AppState
    │   ├── auth.rs             # Device code flow Microsoft
    │   ├── graph.rs            # Appels Graph API + scripts PowerShell
    │   └── logger.rs           # Logs applicatifs fichier
    └── Cargo.toml
```

### Frontend

- `src/App.tsx` : orchestration setup / auth / dashboard
- `src/components/Dashboard.tsx` : navigation, bannière module PS, synthèse alertes
- `src/components/DataTable.tsx` : recherche, tri, pagination, export CSV
- `src/components/tabs/*` : vues métier

### Backend

- `src-tauri/src/lib.rs` : commandes Tauri, persistance locale, sécurité token
- `src-tauri/src/auth.rs` : device code flow Microsoft + tentative token Teams service
- `src-tauri/src/graph.rs` : collecte Graph API + scripts PowerShell embarqués (CQ/AA)
- `src-tauri/src/logger.rs` : logs applicatifs fichier

### Fichier de configuration

Stocké dans le répertoire de config de l'application :
- Windows : `%APPDATA%\com.teams-manager.app\config.json`

### Fichier de log

- Windows : `%LOCALAPPDATA%\com.teams-manager.app\logs\teams-manager.log`
  (`C:\Users\<nom>\AppData\**Local**\com.teams-manager.app\logs\teams-manager.log`)

---

## 3. Sources de données

### Microsoft Graph API

| Endpoint | Description |
|----------|-------------|
| `GET /v1.0/subscribedSkus` | Abonnements tenant |
| `GET /v1.0/users?$select=...` | Utilisateurs + licences (paginé) |
| `GET /beta/communications/phoneNumbers` | Inventaire numéros PSTN |
| `GET /v1.0/applications` + `GET /v1.0/servicesPrincipals` | Comptes ressources (MCOEV_VIRTUALUSER) |

### PowerShell MicrosoftTeams (Windows uniquement)

Les onglets **Files d'attente** et **Auto Attendants** utilisent le module PowerShell `MicrosoftTeams` car les endpoints Graph correspondants ne sont pas disponibles sur tous les tenants.

| Cmdlet | Description |
|--------|-------------|
| `Get-CsCallQueue` | Files d'attente Teams |
| `Get-CsAutoAttendant` | Standards automatiques |

L'authentification réutilise le token Graph déjà obtenu (`Connect-MicrosoftTeams -AccessTokens`). Si un token de service Teams est disponible (permission `48ac35b8-9aa8-4d74-927d-1f4a14a0b239`), il est passé en second argument pour un accès complet.

---

## 4. Journalisation

Les logs sont écrits dans le dossier standard de l'application :

- **Windows** : `%LOCALAPPDATA%\com.teams-manager.app\logs\teams-manager.log`

Nom du fichier : `teams-manager.log`

---

## 5. Azure AD

### Permissions Microsoft Graph attendues

- `User.Read.All`
- `Directory.Read.All`
- `Organization.Read.All`
- `LicenseAssignment.Read.All`
- `NumberAssignment.Read.All` *(pour les numéros libres — endpoint beta)*

### Paramétrage dans l'application

1. Allez sur **portal.azure.com** → Microsoft Entra ID → App registrations → **New registration**
2. Nom : `Teams Manager`, type de compte : *Accounts in this organizational directory only*
3. Plateforme : **Public client/native** (mobile & desktop), URI de redirection : `https://login.microsoftonline.com/common/oauth2/nativeclient`
4. Dans **Authentication** → activez **Allow public client flows** (device code flow)
5. Dans **API permissions** → Add a permission → Microsoft Graph → **Delegated** :
   - `User.Read.All`
   - `Directory.Read.All`
   - `Organization.Read.All`
   - `LicenseAssignment.Read.All`
   - `NumberAssignment.Read.All`
6. Cliquez **Grant admin consent**
7. Notez le **Tenant ID** et le **Application (client) ID**

---

## 6. Build

### Développement

```bash
# Installer les dépendances Node
npm install

# Lancer en mode dev (hot-reload)
cargo tauri dev
```

La fenêtre s'ouvre sur `http://localhost:1420`. Modifiez les fichiers `src/` et le rechargement est instantané.

### Build production

```bash
npm install
cargo tauri build
```

L'installateur et l'exécutable se trouvent dans `src-tauri/target/release/bundle/`.

---

## 7. Utilisation

1. Au premier lancement : saisir le **Tenant ID** et le **Client ID** Azure AD
2. Cliquer **Se connecter avec Microsoft** → suivre les instructions du code appareil sur `aka.ms/devicelogin`
3. Après authentification, l'application charge automatiquement les données
4. Naviguer entre les onglets via la sidebar
5. **Actualiser** pour rafraîchir les données
6. **Exporter CSV** dans chaque onglet pour exporter les données filtrées

### Résolution des problèmes — onglets Files d'attente / Auto Attendants

| Symptôme | Cause probable | Solution |
|----------|----------------|----------|
| "PowerShell 7 requis" | `pwsh.exe` absent | Installer [PowerShell 7](https://aka.ms/powershell) |
| "Accès refusé (OneDrive)" | OneDrive verrouille les fichiers du module | `Install-Module MicrosoftTeams -Scope AllUsers` (admin PS7) |
| 0 résultats sans erreur | `Get-CsCallQueue` retourne vide | Vérifier permissions Teams admin du compte |
| Warning `Get-CsCallQueue : Insufficient privileges` | Token sans accès Teams service | Ajouter permission `48ac35b8-9aa8-4d74-927d-1f4a14a0b239` à l'app Azure |
