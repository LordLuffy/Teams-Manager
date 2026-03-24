# Teams Manager

<!-- BADGES:START -->
<p align="center">
  ![Release](https://img.shields.io/github/v/release/LordLuffy/Teams-Manager?style=for-the-badge)
  ![License](https://img.shields.io/badge/License-GPL-F4C430?style=for-the-badge)
  ![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?style=for-the-badge&logo=tauri&logoColor=white)
  ![Rust](https://img.shields.io/badge/Rust-stable-000000?style=for-the-badge&logo=rust)
  ![TypeScript](https://img.shields.io/badge/TypeScript-5.5.3-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
  ![React](https://img.shields.io/badge/React-18.3.1-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
  ![Node.js](https://img.shields.io/badge/Node.js-%3E%3D24-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
  ![CSS](https://img.shields.io/badge/CSS-3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
</p>
<!-- BADGES:END -->

Application desktop **Windows** — **Tauri 2 + React + TypeScript + Rust** pour auditer les licences Microsoft 365, les numéros Teams et les ressources de téléphonie.

---

## 1. Prérequis

### Outils de développement

| Outil | Version | Installation |
|-------|---------|--------------|
| Rust  | stable  | `rustup.rs`  |
| Node.js | 24+ | `nodejs.org` |
| Tauri CLI | v2 | `cargo install tauri-cli` |

Dépendances système : WebView2 (préinstallé sur Windows 11) et Visual C++ Build Tools.

### Prérequis runtime (onglets Files d'attente & Standards automatiques)

| Prérequis | Pourquoi | Installation |
|-----------|----------|--------------|
| **PowerShell 7** (`pwsh`) | Le module MicrosoftTeams v5+ embarque des DLL .NET 8 incompatibles avec PowerShell 5.1 (Windows built-in) | [aka.ms/powershell](https://aka.ms/powershell) |
| **Module PowerShell MicrosoftTeams** | Récupération des Files d'attente et Standards automatiques via `Get-CsCallQueue` / `Get-CsAutoAttendant` | Installé automatiquement par l'application au démarrage |

> L'application détecte `pwsh.exe` au démarrage. Si PowerShell 7 est absent, un bouton "Télécharger PowerShell 7" s'affiche dans les onglets Files d'attente et Standards automatiques.

---

## 2. Architecture

### Structure du projet

```
TeamsAnalysis/
├── src/                        # Frontend React
│   ├── main.tsx                # Point d'entrée React
│   ├── App.tsx                 # Routing setup/auth/dashboard
│   ├── types.ts                # Interfaces TypeScript
│   ├── index.css               # CSS variables + utility classes
│   └── components/
│       ├── SetupScreen.tsx     # Configuration Tenant/Client ID
│       ├── AuthScreen.tsx      # Device code flow UI
│       ├── Dashboard.tsx       # Sidebar + topbar + onglets
│       ├── UpdateBanner.tsx    # Bannière mise à jour automatique
│       ├── DataTable.tsx       # Table générique (tri, recherche, export)
│       └── tabs/               # 10 onglets métier
│           ├── DirectoryUsersTab.tsx
│           ├── PhoneUsersTab.tsx
│           ├── FreeNumbersTab.tsx
│           ├── OrphanLicensesTab.tsx
│           ├── UserLicensesTab.tsx
│           ├── SubscriptionsTab.tsx
│           ├── CallQueuesTab.tsx
│           ├── AutoAttendantsTab.tsx
│           ├── ResourceAccountsTab.tsx
│           └── CartographieTab.tsx
└── src-tauri/                  # Backend Rust
    ├── src/
    │   ├── main.rs             # Point d'entrée Tauri
    │   ├── lib.rs              # Commandes Tauri + AppState
    │   ├── auth.rs             # Device code flow Microsoft
    │   ├── graph.rs            # Appels Graph API + scripts PowerShell
    │   ├── updater.rs          # Mise à jour automatique (GitHub Releases)
    │   └── logger.rs           # Logs applicatifs fichier
    ├── Cargo.toml
    └── deny.toml               # Audit licences et vulnérabilités Rust
```

### Fichiers de données

| Donnée | Emplacement |
|--------|-------------|
| Chemin de logs personnalisé | `%APPDATA%\com.teams-manager.desktop\config.json` |
| Logs applicatifs | `%LOCALAPPDATA%\com.teams-manager.desktop\logs\teams-manager.log` |
| **Tenant ID, Client ID, Client Secret** | **Gestionnaire d'informations d'identification Windows** (chiffré, jamais sur disque en clair) |
| Refresh token Microsoft | **Gestionnaire d'informations d'identification Windows** (chiffré, découpé en segments) |

> **Sécurité** : `config.json` ne contient **aucun identifiant sensible**. Le Tenant ID, le Client ID et le Client Secret sont tous stockés dans le coffre-fort Windows (Windows Credential Manager). Le fichier `config.json` peut être commité sans risque — il ne contient que le chemin optionnel des logs.

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

Les onglets **Files d'attente** et **Standards automatiques** utilisent le module PowerShell `MicrosoftTeams` car les endpoints Graph correspondants ne sont pas disponibles sur tous les tenants.

| Cmdlet | Description |
|--------|-------------|
| `Get-CsCallQueue` | Files d'attente Teams |
| `Get-CsAutoAttendant` | Standards automatiques |

**Authentification** : le module PowerShell MicrosoftTeams v7.x utilise le flux `client_credentials` (app-only), qui nécessite un **Client Secret** Azure AD. Voir la section 4 — Paramétrage avancé pour la configuration complète.

---

## 4. Azure AD

### Permissions Microsoft Graph attendues

| Permission | Type | Usage |
|-----------|------|-------|
| `User.Read.All` | Déléguée | Utilisateurs et licences |
| `Directory.Read.All` | Déléguée | Annuaire Azure AD |
| `Organization.Read.All` | Déléguée + **Application** | Infos tenant |
| `LicenseAssignment.Read.All` | Déléguée | Assignations de licences |
| `NumberAssignment.Read.All` | Déléguée | Numéros PSTN (endpoint beta) |

### Paramétrage de base (authentification utilisateur — Graph API)

1. **portal.azure.com** → Microsoft Entra ID → App registrations → **New registration**
2. Nom : `Teams Manager`, type : *Accounts in this organizational directory only*
3. Plateforme : **Public client/native**, URI de redirection : `https://login.microsoftonline.com/common/oauth2/nativeclient`
4. **Authentication** → activez **Allow public client flows** (device code flow)
5. **API permissions** → Microsoft Graph → **Delegated** : `User.Read.All`, `Directory.Read.All`, `Organization.Read.All`, `LicenseAssignment.Read.All`, `NumberAssignment.Read.All`
6. Cliquez **Grant admin consent**
7. Notez le **Tenant ID** et le **Application (client) ID**

### Paramétrage avancé (onglets Files d'attente & Standards automatiques)

Les cmdlets PowerShell `Get-CsCallQueue` / `Get-CsAutoAttendant` nécessitent une authentification application (non-interactive) avec un **Client Secret**.

1. Dans votre App Registration → **Certificates & secrets** → New client secret → copiez la valeur
2. **API permissions** → Microsoft Graph → **Application** → ajoutez `Organization.Read.All` → Grant admin consent
3. **Microsoft Entra ID** (niveau tenant) → **Rôles et administrateurs** → cherchez **Teams Administrator** → **Add assignments** → ajoutez votre application
4. Dans l'application Teams Manager → bouton **Paramètres** (sidebar) → section **Files d'attente & Standards automatiques** → collez le Client Secret → cliquez **Enregistrer**

> **Important** : L'assignation du rôle Teams Administrator se fait dans **Microsoft Entra ID → Rôles et administrateurs** (niveau tenant), et non dans les Rôles de l'App Registration. Aucune licence Entra ID Premium n'est requise pour assigner un rôle administrateur intégré.

---

## 5. Build

### Développement

```bash
# Installer les dépendances Node
npm install

# Lancer en mode dev (hot-reload)
npm run tauri dev
```

La fenêtre s'ouvre sur `http://localhost:1420`. Modifiez les fichiers `src/` et le rechargement est instantané.

### Build production

```bash
npm install
npm run tauri build
```

L'installateur et l'exécutable se trouvent dans `src-tauri/target/release/bundle/`.

### Vérification des dépendances Rust

```bash
cd src-tauri
cargo deny check
```

---

## 6. Utilisation

### Premier lancement

1. L'écran **Configuration** s'ouvre automatiquement
2. Dépliez la section **Connexion Azure AD** → saisir le **Tenant ID** et le **Client ID**
3. Cliquer **Se connecter avec Microsoft** → suivre les instructions du code appareil sur `aka.ms/devicelogin`
4. Après authentification, l'application charge automatiquement les données

### Navigation

- Naviguer entre les onglets via la **sidebar** gauche
- Bouton **Actualiser** (topbar) pour rafraîchir les données
- Bouton **Exporter CSV** dans chaque onglet pour exporter les données filtrées
- Bouton **Voir les logs** (sidebar) pour ouvrir le fichier de log dans le Bloc-notes
- Bouton **Paramètres** (sidebar) pour modifier la configuration sans se déconnecter :
  - Modifier les identifiants Azure AD et se **reconnecter**
  - Ajouter / modifier le **Client Secret** (stocké de façon sécurisée)
  - Changer le **dossier des logs**

### Mises à jour automatiques

L'application vérifie automatiquement les nouvelles versions au démarrage (après 5 secondes). Si une mise à jour est disponible, une bannière s'affiche dans la sidebar avec un bouton **Installer**. L'application redémarre automatiquement après installation.

Les mises à jour sont signées cryptographiquement et distribuées via [GitHub Releases](https://github.com/LordLuffy/Teams-Manager/releases). Un bouton **Vérifier les mises à jour** dans la sidebar permet de lancer une vérification manuelle, et le lien **Notes** affiche l'historique complet des versions.

### Résolution des problèmes — onglets Files d'attente / Standards automatiques

| Symptôme | Cause probable | Solution |
|----------|----------------|----------|
| "PowerShell 7 requis" | `pwsh.exe` absent | Installer [PowerShell 7](https://aka.ms/powershell) |
| "Client Secret requis" | Aucun secret configuré | Voir section 4 — Paramétrage avancé |
| `Authorization_RequestDenied` | Permission Application `Organization.Read.All` manquante | Ajouter la permission Application dans Azure + Grant consent |
| `Authorization_RequestDenied` | Rôle Teams Administrator non assigné à l'application | Assigner le rôle dans **Microsoft Entra ID → Rôles et administrateurs** |
| 0 résultats sans erreur | `Get-CsCallQueue` retourne vide | Vérifier que le compte a des droits Teams admin |
| Bannière orange persistante après configuration | Secret incorrect ou permissions non consenties | Vérifier les permissions et le consentement admin dans Azure |

Les logs sont accessibles via le bouton **Voir les logs** dans la sidebar, ou manuellement dans :
`%LOCALAPPDATA%\com.teams-manager.desktop\logs\teams-manager.log`
