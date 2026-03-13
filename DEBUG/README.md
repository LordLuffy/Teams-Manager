# Teams License & Telephony Manager

Application de bureau Tauri 2 + React + TypeScript pour auditer et gérer les licences et la téléphonie Microsoft 365 / Teams.

---

## Prérequis

| Outil | Version | Installation |
|-------|---------|--------------|
| Rust  | stable  | `rustup.rs`  |
| Node.js | LTS 20+ | `nodejs.org` |
| Tauri CLI | v2 | `cargo install tauri-cli` |

Dépendances système Windows : WebView2 (préinstallé sur Windows 11) et Visual C++ Build Tools.

---

## 1. Enregistrement Azure AD

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

## 2. Développement

```bash
# Installer les dépendances Node
npm install

# Lancer en mode dev (hot-reload)
cargo tauri dev
```

La fenêtre s'ouvre sur `http://localhost:1420`. Modifiez les fichiers `src/` et le rechargement est instantané.

---

## 3. Build production

```bash
# Compiler le frontend + l'exécutable Tauri
cargo tauri build
```

L'installateur et l'exécutable se trouvent dans `src-tauri/target/release/bundle/`.

---

## 4. Utilisation

1. Au premier lancement : saisir le **Tenant ID** et le **Client ID** Azure AD
2. Cliquer **Se connecter avec Microsoft** → suivre les instructions du code appareil sur `aka.ms/devicelogin`
3. Après authentification, l'application charge automatiquement les données
4. Naviguer entre les onglets via la sidebar
5. **Actualiser** pour rafraîchir les données
6. **Exporter CSV** dans chaque onglet pour exporter les données filtrées

### Fichier de configuration

Stocké dans le répertoire de config de l'application :
- Windows : `%APPDATA%\com.teams-manager.app\config.json`
- macOS : `~/Library/Application Support/com.teams-manager.app/config.json`
- Linux : `~/.config/com.teams-manager.app/config.json`

---

## 5. Structure du projet

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

---

## 6. Endpoints Graph utilisés

| Endpoint | Description |
|----------|-------------|
| `GET /v1.0/subscribedSkus` | Abonnements tenant |
| `GET /v1.0/users?$select=...&$top=999` | Utilisateurs + licences (paginé) |
| `GET /beta/communications/phoneNumbers` | Inventaire numéros PSTN |
| `GET /beta/solutions/businessApplications/callQueues` | Files d'attente Teams |
| `GET /beta/solutions/businessApplications/autoAttendants` | Attendants automatiques |

> **Note** : Les endpoints `/beta` (Call Queues, Auto Attendants, numéros) nécessitent des permissions spécifiques et peuvent ne pas être disponibles selon votre plan Microsoft 365. En cas d'erreur 404, l'application utilise un fallback basé sur les comptes ressources (MCOEV_VIRTUALUSER).

---

## 7. Commandes Tauri exposées au frontend

| Commande | Description |
|----------|-------------|
| `load_config` | Lit la config depuis AppConfigDir |
| `save_config` | Sauvegarde la config + met à jour l'état |
| `start_auth` | Démarre le device code flow |
| `poll_auth` | Lance le polling en background, émet `auth-ok` / `auth-error` |
| `get_auth_status` | Retourne true si token valide en mémoire |
| `disconnect` | Efface le token |
| `fetch_data` | Collecte toutes les données Graph en parallèle |
| `export_csv` | Ouvre un dialog de sauvegarde et écrit le CSV |
