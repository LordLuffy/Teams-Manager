<<<<<<< HEAD
# TeamsAnalysis
=======
# Teams License & Telephony Manager

Application desktop **Tauri 2 + React + TypeScript + Rust** pour auditer les licences Microsoft 365, les numéros Teams et les ressources de téléphonie.

---

## 1. Prérequis

| Outil | Version | Installation |
|-------|---------|--------------|
| Rust  | stable  | `rustup.rs`  |
| Node.js | LTS 20+ | `nodejs.org` |
| Tauri CLI | v2 | `cargo install tauri-cli` |

Dépendances système Windows : WebView2 (préinstallé sur Windows 11) et Visual C++ Build Tools.

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
│       └── tabs/               # 8 onglets métier
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
    │   └── graph.rs            # Appels Microsoft Graph API
    └── Cargo.toml
```

### Frontend

- `src/App.tsx` : orchestration setup / auth / dashboard
- `src/components/Dashboard.tsx` : navigation et synthèse des alertes
- `src/components/DataTable.tsx` : recherche, tri, pagination, export CSV
- `src/components/tabs/*` : vues métier

### Backend

- `src-tauri/src/lib.rs` : commandes Tauri, persistance locale, sécurité token
- `src-tauri/src/auth.rs` : device code flow Microsoft
- `src-tauri/src/graph.rs` : collecte et consolidation des données Graph
- `src-tauri/src/logger.rs` : logs applicatifs fichier

### Fichier de configuration

Stocké dans le répertoire de config de l'application :
- Windows : `%APPDATA%\com.teams-manager.app\config.json`
- macOS : `~/Library/Application Support/com.teams-manager.app/config.json`
- Linux : `~/.config/com.teams-manager.app/config.json`

## Endpoints Graph utilisés

| Endpoint | Description |
|----------|-------------|
| `GET /v1.0/subscribedSkus` | Abonnements tenant |
| `GET /v1.0/users?$select=...&$top=999` | Utilisateurs + licences (paginé) |
| `GET /beta/communications/phoneNumbers` | Inventaire numéros PSTN |
| `GET /beta/solutions/businessApplications/callQueues` | Files d'attente Teams |
| `GET /beta/solutions/businessApplications/autoAttendants` | Attendants automatiques |

> **Note** : Les endpoints `/beta` (Call Queues, Auto Attendants, numéros) nécessitent des permissions spécifiques et peuvent ne pas être disponibles selon votre plan Microsoft 365. En cas d'erreur 404, l'application utilise un fallback basé sur les comptes ressources (MCOEV_VIRTUALUSER).

---

## 3. Journalisation

Les logs sont écrits dans le dossier standard de l'application :

- **Windows** : dossier de logs applicatif Tauri de l'utilisateur
- **macOS** : dossier `Library/Logs` de l'application

Nom du fichier : `teams-manager.log`

---

## 4. Azure AD

### Permissions Microsoft Graph attendues

- `User.Read.All`
- `Directory.Read.All`
- `Organization.Read.All`
- permissions complémentaires nécessaires selon les endpoints beta utilisés pour la téléphonie Teams

### Paramétrage dans l'appliction

1. Allez sur **portal.azure.com** → Microsoft Entra ID → App registrations → **New registration**
2. Nom : `Teams Manager`, type de compte : *Accounts in this organizational directory only*
3. Plateforme : **Public client/native** (mobile & desktop), URI de redirection : `https://login.microsoftonline.com/common/oauth2/nativeclient`
4. Dans **Authentication** → activez **Allow public client flows** (device code flow)
5. Dans **API permissions** → Add a permission → Microsoft Graph → **Delegated** :
   - `User.Read.All`
   - `Directory.Read.All`
   - `Organization.Read.All`
   - `LicenseAssignment.ReadWrite.All` *(optionnel)*
   - `NumberAssignment.ReadWrite.All` *(pour les numéros libres — endpoint beta)*
6. Cliquez **Grant admin consent**
7. Notez le **Tenant ID** et le **Application (client) ID**

---

## 5. Build

### Développement

```bash
# Installer les dépendances Node
npm install

# Lancer en mode dev (hot-reload)
cargo tauri dev
```

La fenêtre s'ouvre sur `http://localhost:1420`. Modifiez les fichiers `src/` et le rechargement est instantané.

---

### Build production
```bash
npm install
cd src-tauri
cargo tauri dev

## 4. Build production

```bash
# Compiler le frontend + l'exécutable Tauri
cargo tauri build
```

L'installateur et l'exécutable se trouvent dans `src-tauri/target/release/bundle/`.

---

## 6. Utilisation

1. Au premier lancement : saisir le **Tenant ID** et le **Client ID** Azure AD
2. Cliquer **Se connecter avec Microsoft** → suivre les instructions du code appareil sur `aka.ms/devicelogin`
3. Après authentification, l'application charge automatiquement les données
4. Naviguer entre les onglets via la sidebar
5. **Actualiser** pour rafraîchir les données
6. **Exporter CSV** dans chaque onglet pour exporter les données filtrées

---

>>>>>>> 8d831b6 (Initial commit)
