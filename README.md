<p align="center">
  <img src="src-tauri/icons/icon.ico" width="128" alt="Teams Manager" />
</p>

<h1 align="center">Teams Manager</h1>

<p align="center">
  <em>Microsoft 365 telephony &amp; license audit — Windows desktop app</em>
</p>

<p align="center">
<!-- BADGES:START -->
<img alt="Release" src="https://img.shields.io/github/v/release/Xenovyrion/Teams-Manager?style=for-the-badge" />
<img alt="License" src="https://img.shields.io/badge/License-GPL--3.0-F4C430?style=for-the-badge" />
<img alt="Platform" src="https://img.shields.io/badge/Platform-Windows-0078D4?style=for-the-badge&logo=windows11&logoColor=white" />
<!-- BADGES:END -->
</p>

<p align="center">
<!-- STACK:START -->
<img alt="Tauri" src="https://img.shields.io/badge/Tauri-2-24C8DB?style=for-the-badge&logo=tauri&logoColor=white" />
<img alt="Rust" src="https://img.shields.io/badge/Rust-stable-000000?style=for-the-badge&logo=rust" />
<img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.5.3-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
<img alt="React" src="https://img.shields.io/badge/React-18.3.1-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" />
<img alt="Node.js" src="https://img.shields.io/badge/Node.js-%3E%3D24-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" />
<img alt="CSS" src="https://img.shields.io/badge/CSS-3-1572B6?style=for-the-badge&logo=css3&logoColor=white" />
<!-- STACK:END -->
</p>

---

Windows desktop app built with **Tauri 2 + React + TypeScript + Rust** to audit Microsoft 365 licenses, Teams phone numbers and telephony resources.

---

## 1. Prerequisites

### Development tools

| Tool | Version | Install |
|------|---------|---------|
| Rust | stable | `rustup.rs` |
| Node.js | 24+ | `nodejs.org` |
| Tauri CLI | v2 | `cargo install tauri-cli` |

System dependencies: WebView2 (pre-installed on Windows 11) and Visual C++ Build Tools.

### Runtime prerequisites (Call Queues & Auto Attendants tabs)

| Prerequisite | Why | Install |
|---|---|---|
| **PowerShell 7** (`pwsh`) | The MicrosoftTeams module v5+ ships .NET 8 DLLs incompatible with the built-in PowerShell 5.1 | [aka.ms/powershell](https://aka.ms/powershell) |
| **PowerShell MicrosoftTeams module** | Required to fetch Call Queues and Auto Attendants via `Get-CsCallQueue` / `Get-CsAutoAttendant` | Installed automatically by the app on first use |

> The app detects `pwsh.exe` at startup. If PowerShell 7 is missing, a **Download PowerShell 7** button is shown in the Call Queues and Auto Attendants tabs.

---

## 2. Architecture

### Project structure

```
TeamsAnalysis/
├── src/                        # React frontend
│   ├── main.tsx                # React entry point
│   ├── App.tsx                 # Screen routing: setup → auth → dashboard
│   ├── types.ts                # TypeScript interfaces
│   ├── index.css               # CSS variables + utility classes
│   └── components/
│       ├── SetupScreen.tsx     # Tenant/Client ID configuration
│       ├── AuthScreen.tsx      # Device code flow UI
│       ├── Dashboard.tsx       # Sidebar + topbar + tab routing
│       ├── UpdateBanner.tsx    # Auto-update notification banner
│       ├── DataTable.tsx       # Generic table (sort, search, CSV export)
│       └── tabs/               # 10 business tabs
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
└── src-tauri/                  # Rust backend
    ├── src/
    │   ├── main.rs             # Tauri entry point
    │   ├── lib.rs              # Tauri commands + AppState
    │   ├── auth.rs             # Microsoft device code flow
    │   ├── graph.rs            # Graph API calls + PowerShell scripts
    │   ├── updater.rs          # Auto-update via GitHub Releases
    │   └── logger.rs           # File-based application logger
    ├── Cargo.toml
    └── deny.toml               # Rust license & vulnerability audit
```

### Data storage

| Data | Location |
|------|----------|
| Custom log path | `%APPDATA%\com.teams-manager.desktop\config.json` |
| Application logs | `%LOCALAPPDATA%\com.teams-manager.desktop\logs\teams-manager.log` |
| **Tenant ID, Client ID, Client Secret** | **Windows Credential Manager** (encrypted, never written to disk in plain text) |
| Microsoft refresh token | **Windows Credential Manager** (encrypted, split into segments) |

> **Security**: `config.json` contains **no sensitive credentials**. Tenant ID, Client ID and Client Secret are stored in the Windows Credential Manager vault. `config.json` can be committed safely — it only holds the optional custom log path.

---

## 3. Data sources

### Microsoft Graph API

| Endpoint | Description |
|----------|-------------|
| `GET /v1.0/subscribedSkus` | Tenant subscriptions |
| `GET /v1.0/users?$select=...` | Users + licenses (paginated) |
| `GET /beta/communications/phoneNumbers` | PSTN number inventory |
| `GET /v1.0/applications` + `GET /v1.0/servicesPrincipals` | Resource accounts (MCOEV_VIRTUALUSER) |

### PowerShell MicrosoftTeams (Windows only)

The **Call Queues** and **Auto Attendants** tabs use the `MicrosoftTeams` PowerShell module because the corresponding Graph endpoints are not available on all tenants.

| Cmdlet | Description |
|--------|-------------|
| `Get-CsCallQueue` | Teams Call Queues |
| `Get-CsAutoAttendant` | Auto Attendants |

**Authentication**: the MicrosoftTeams PowerShell module v7.x uses the `client_credentials` flow (app-only), which requires an Azure AD **Client Secret**. See section 4 — Advanced setup.

---

## 4. Azure AD

### Required Microsoft Graph permissions

| Permission | Type | Usage |
|-----------|------|-------|
| `User.Read.All` | Delegated | Users and licenses |
| `Directory.Read.All` | Delegated | Azure AD directory |
| `Organization.Read.All` | Delegated + **Application** | Tenant info |
| `LicenseAssignment.Read.All` | Delegated | License assignments |
| `NumberAssignment.Read.All` | Delegated | PSTN numbers (beta endpoint) |

### Basic setup (user authentication — Graph API)

1. **portal.azure.com** → Microsoft Entra ID → App registrations → **New registration**
2. Name: `Teams Manager`, type: *Accounts in this organizational directory only*
3. Platform: **Public client/native**, redirect URI: `https://login.microsoftonline.com/common/oauth2/nativeclient`
4. **Authentication** → enable **Allow public client flows** (device code flow)
5. **API permissions** → Microsoft Graph → **Delegated**: `User.Read.All`, `Directory.Read.All`, `Organization.Read.All`, `LicenseAssignment.Read.All`, `NumberAssignment.Read.All`
6. Click **Grant admin consent**
7. Copy the **Tenant ID** and **Application (client) ID**

### Advanced setup (Call Queues & Auto Attendants tabs)

The `Get-CsCallQueue` / `Get-CsAutoAttendant` PowerShell cmdlets require app-only authentication with a **Client Secret**.

1. In your App Registration → **Certificates & secrets** → New client secret → copy the value
2. **API permissions** → Microsoft Graph → **Application** → add `Organization.Read.All` → Grant admin consent
3. **Microsoft Entra ID** (tenant level) → **Roles and administrators** → search **Teams Administrator** → **Add assignments** → add your application
4. In Teams Manager → **Settings** button (sidebar) → **Call Queues & Auto Attendants** section → paste the Client Secret → click **Save**

> **Important**: The Teams Administrator role assignment is done in **Microsoft Entra ID → Roles and administrators** (tenant level), not in the App Registration roles. No Entra ID Premium license is required to assign a built-in administrator role.

---

## 5. Build

### Development

```bash
# Install Node dependencies
npm install

# Start in dev mode (hot-reload)
npm run tauri dev
```

The window opens at `http://localhost:1420`. Edit files under `src/` for instant hot-reload.

### Production build

```bash
npm install
npm run tauri build
```

The installer and executable are output to `src-tauri/target/release/bundle/`.

### Rust dependency audit

```bash
cd src-tauri
cargo deny check
```

---

## 6. Usage

### First launch

1. The **Configuration** screen opens automatically
2. Expand **Azure AD Connection** → enter your **Tenant ID** and **Client ID**
3. Click **Sign in with Microsoft** → follow the device code instructions at `aka.ms/devicelogin`
4. After authentication, the app loads all data automatically

### Navigation

- Switch between tabs using the left **sidebar**
- **Refresh** button (topbar) to reload all data
- **Export CSV** button in each tab to export the filtered view
- **View logs** button (sidebar) to open the log file in Notepad
- **Settings** button (sidebar) to update configuration without signing out:
  - Edit Azure AD credentials and **reconnect**
  - Add / update the **Client Secret** (stored securely)
  - Change the **log folder** path

### Automatic updates

The app silently checks for new versions at startup (after a 5-second delay). If an update is available, a banner appears in the sidebar with an **Install** button. The app restarts automatically after installation.

Updates are cryptographically signed and distributed via [GitHub Releases](https://github.com/Xenovyrion/Teams-Manager/releases). A **Check for updates** button in the sidebar triggers a manual check, and the **Release notes** link shows the full version history.

### Troubleshooting — Call Queues / Auto Attendants tabs

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| "PowerShell 7 required" | `pwsh.exe` not found | Install [PowerShell 7](https://aka.ms/powershell) |
| "Client Secret required" | No secret configured | See section 4 — Advanced setup |
| `Authorization_RequestDenied` | Application permission `Organization.Read.All` missing | Add Application permission in Azure + Grant consent |
| `Authorization_RequestDenied` | Teams Administrator role not assigned to the app | Assign the role in **Microsoft Entra ID → Roles and administrators** |
| 0 results with no error | `Get-CsCallQueue` returns empty | Verify the app has Teams admin rights |
| Orange banner persists after setup | Incorrect secret or permissions not consented | Check permissions and admin consent in Azure |

Logs are accessible via **View logs** in the sidebar, or directly at:
`%LOCALAPPDATA%\com.teams-manager.desktop\logs\teams-manager.log`
