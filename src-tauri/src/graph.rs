use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::process::{Command, Stdio};
use std::sync::OnceLock;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

// One-time detection of the optimal PowerShell executable.
// PS7 (pwsh) is required for .NET 8+ DLLs used by the recent MicrosoftTeams module.
// Tested in order: "pwsh" via PATH, then known installation paths.
static PS_EXE: OnceLock<String> = OnceLock::new();

fn ps_exe() -> &'static str {
    PS_EXE.get_or_init(|| {
        // Paths to test in order — PATH may not be inherited if Tauri
        // is launched from a context where the PS7 PATH is not yet updated.
        let candidates = [
            "pwsh",
            r"C:\Program Files\PowerShell\7\pwsh.exe",
            r"C:\Program Files\PowerShell\pwsh.exe",
        ];
        for exe in candidates {
            let mut cmd = Command::new(exe);
            cmd.args(["-NonInteractive", "-NoProfile", "-Command", "exit 0"]);
            #[cfg(windows)]
            cmd.creation_flags(0x0800_0000);
            if cmd.output().map(|o| o.status.success()).unwrap_or(false) {
                return exe.to_string();
            }
        }
        "powershell".to_string()
    })
}

/// Returns the selected PowerShell executable (for UI diagnostics).
pub fn ps_exe_name() -> &'static str {
    ps_exe()
}

const V1: &str = "https://graph.microsoft.com/v1.0";
const BETA: &str = "https://graph.microsoft.com/beta";

pub fn friendly_sku(sku: &str) -> &str {
    match sku {
        // Teams Phone
        "MCOEV"                      => "Microsoft Teams Phone Standard",
        "MCOEV_VIRTUALUSER"          => "Microsoft Teams Phone Resource Account",
        "PHONESYSTEM_VIRTUALUSER"    => "Microsoft Teams Phone Resource Account",
        "MCOPSTN1"                   => "Microsoft Teams Domestic Calling Plan",
        "MCOPSTN2"                   => "Microsoft Teams International Calling Plan",
        "MCOPSTN_5"                  => "Microsoft Teams Pay As You Go Calling Plan",
        "MCOPSTNC"                   => "Microsoft Teams Communication Credits",
        "MCOCAP"                     => "Teams Shared Devices",
        "MCOMEETADV"                 => "Microsoft 365 Audio Conferencing",
        "MCOSTANDARD"                => "Skype for Business Online (Plan 2)",
        // Teams Rooms
        "MEETING_ROOM"               => "Microsoft Teams Rooms Standard",
        "MEETING_ROOM_PLUS"          => "Microsoft Teams Rooms Premium",
        "TEAMS_ROOMS_FREE"           => "Microsoft Teams Rooms Basic",
        // Exchange
        "EXCHANGESTANDARD"           => "Exchange Online (plan 1)",
        "EXCHANGEENTERPRISE"         => "Exchange Online (plan 2)",
        "EXCHANGEESSENTIALS"         => "Exchange Online Essentials",
        "EXCHANGE_S_ESSENTIALS"      => "Exchange Online Essentials",
        "EXCHANGEDESKLESS"           => "Exchange Online Kiosk",
        // Microsoft 365 / Office 365
        "SPE_E3"                     => "Microsoft 365 E3",
        "SPE_E5"                     => "Microsoft 365 E5",
        "SPE_F1"                     => "Microsoft 365 F3",
        "SPB"                        => "Microsoft 365 Business Premium",
        "O365_BUSINESS_ESSENTIALS"   => "Microsoft 365 Business Basic",
        "O365_BUSINESS_PREMIUM"      => "Microsoft 365 Business Standard",
        "O365_BUSINESS"              => "Microsoft 365 Apps for Business",
        "OFFICESUBSCRIPTION"         => "Microsoft 365 Apps for Enterprise",
        "STANDARDPACK"               => "Office 365 E1",
        "ENTERPRISEPACK"             => "Office 365 E3",
        "ENTERPRISEPREMIUM"          => "Office 365 E5",
        "DESKLESSPACK"               => "Office 365 F3",
        "STANDARDWOFFPACK"           => "Office 365 E2",
        // Power Platform
        "POWER_BI_PRO"               => "Power BI Pro",
        "POWER_BI_PREMIUM_PER_USER"  => "Power BI Premium Per User",
        "POWER_BI_STANDARD"          => "Power BI (free)",
        "FLOW_FREE"                  => "Microsoft Power Automate Free",
        "POWERAPPS_DEV"              => "Microsoft Power Apps for Developer",
        "POWERAPPS_VIRAL"            => "Microsoft Power Apps Plan 2 Trial",
        "MICROSOFT_FABRIC_FREE"      => "Microsoft Fabric (free)",
        // Security / Identity
        "EMS"                        => "Enterprise Mobility + Security E3",
        "EMSPREMIUM"                 => "Enterprise Mobility + Security E5",
        "AAD_PREMIUM"                => "Microsoft Entra ID P1",
        "AAD_PREMIUM_P2"             => "Microsoft Entra ID P2",
        "INTUNE_A"                   => "Microsoft Intune Plan 1",
        "INTUNE_A_VL"                => "Microsoft Intune Plan 1",
        "ATP_ENTERPRISE"             => "Microsoft Defender for Office 365 (plan 1)",
        "THREAT_INTELLIGENCE"        => "Microsoft Defender for Office 365 (plan 2)",
        "RIGHTSMANAGEMENT"           => "Azure Information Protection P1",
        // Project / Visio
        "PROJECTPREMIUM"             => "Project Plan 5",
        "PROJECTPROFESSIONAL"        => "Project Plan 3",
        "PROJECT_PLAN1"              => "Project Plan 1",
        "VISIOCLIENT"                => "Visio Plan 2",
        "VISIOONLINE_PLAN1"          => "Visio Plan 1",
        other => other,
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct PhoneUser {
    pub display_name: String,
    pub upn: String,
    pub phone_number: String,
    pub ev_enabled: String,
    pub account_enabled: String,
    pub usage_location: String,
    pub licenses: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct FreeNumber {
    pub number: String,
    pub number_type: String,
    pub city: String,
    pub country: String,
    pub capability: String,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct UserLicense {
    pub display_name: String,
    pub upn: String,
    pub sku_part_number: String,
    pub friendly_name: String,
    pub account_enabled: String,
    pub user_type: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct Subscription {
    pub friendly_name: String,
    pub sku: String,
    pub sku_id: String,
    pub purchased: i64,
    pub suspended: i64,
    pub consumed: i64,
    pub available: i64,
    pub status: String,
    pub is_free: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct CallQueue {
    pub name: String,
    pub language: String,
    pub routing_method: String,
    pub agent_count: i64,
    /// Display names of individual agents (enriched from the Graph directory).
    pub agents: Vec<String>,
    /// IDs of distribution lists/groups.
    pub distribution_lists: Vec<String>,
    pub timeout_action: String,
    pub overflow_action: String,
    pub phone_number: String,
    pub can_be_deleted: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct DayHours {
    pub day: String,
    pub hours: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct AutoAttendant {
    pub name: String,
    pub language: String,
    pub time_zone: String,
    pub phone_number: String,
    pub status: String,
    pub can_be_deleted: String,
    /// Number of linked resource accounts (from ApplicationInstances PS).
    pub resource_account_count: i64,
    /// Number of linked and licensed resource accounts.
    pub resource_account_licensed_count: i64,
    /// Summary of the default call flow (business hours).
    pub default_call_flow: String,
    /// Summary of the after-hours call flow.
    pub after_hours_call_flow: String,
    /// Weekly business hours (Mon–Sun).
    pub business_hours: Vec<DayHours>,
    /// ObjectIds / UPNs of linked resource accounts — internal use only, not serialized to the frontend.
    #[serde(skip_serializing)]
    pub application_instances: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct ResourceAccount {
    pub display_name: String,
    pub upn: String,
    pub account_type: String,
    pub phone_number: String,
    pub licensed: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct OrphanLicense {
    pub upn: String,
    pub display_name: String,
    pub licenses: String,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct DashboardData {
    pub directory_users: Vec<DirectoryUser>,
    pub phone_users: Vec<PhoneUser>,
    pub free_numbers: Vec<FreeNumber>,
    pub user_licenses: Vec<UserLicense>,
    pub subscriptions: Vec<Subscription>,
    pub call_queues: Vec<CallQueue>,
    pub auto_attendants: Vec<AutoAttendant>,
    pub resource_accounts: Vec<ResourceAccount>,
    pub orphan_licenses: Vec<OrphanLicense>,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryUser {
    pub display_name: String,
    pub upn: String,
    pub account_enabled: String,
    pub usage_location: String,
    pub licenses: String,
    pub phone_number: String,
    pub has_phone_license: String,
    pub user_type: String,
}

/// Lightweight snapshot returned by `fetch_licenses_quick`.
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct LicensesSnapshot {
    pub subscriptions: Vec<Subscription>,
    pub user_licenses: Vec<UserLicense>,
}

/// Fetches only subscriptions and user-license assignments — much faster than `collect_all`.
/// Used for a targeted refresh after the License Manager saves changes.
pub async fn fetch_licenses_quick(client: &Client, token: &str) -> Result<LicensesSnapshot, String> {
    let mut snap = LicensesSnapshot::default();
    let mut sku_id_map: std::collections::HashMap<String, String> = Default::default();

    // ── 1. Subscriptions ─────────────────────────────────────────────────────
    let skus = fetch_pages(client, token, &format!("{V1}/subscribedSkus")).await
        .map_err(|e| format!("Subscriptions: {e}"))?;

    for s in &skus {
        let id = str_val(s, "skuId");
        let part = str_val(s, "skuPartNumber");
        if !id.is_empty() {
            sku_id_map.insert(id.clone(), part.clone());
        }
        let enabled = s.get("prepaidUnits").and_then(|u| u.get("enabled")).and_then(|v| v.as_i64()).unwrap_or(0);
        let suspended = s.get("prepaidUnits").and_then(|u| u.get("suspended")).and_then(|v| v.as_i64()).unwrap_or(0);
        let consumed = i64_val(s, "consumedUnits");
        let available = enabled - consumed;
        let sku = str_val(s, "skuPartNumber");
        let is_free = is_free_subscription_sku(&sku);
        snap.subscriptions.push(Subscription {
            friendly_name: friendly_sku(&sku).to_string(),
            sku,
            sku_id: id,
            purchased: enabled,
            suspended,
            consumed,
            available,
            status: compute_subscription_status(available, consumed, enabled, is_free),
            is_free,
        });
    }

    // ── 2. User licenses ─────────────────────────────────────────────────────
    let user_url = format!(
        "{V1}/users?$select=displayName,userPrincipalName,assignedLicenses,accountEnabled,userType&$top=999"
    );
    let users = fetch_pages(client, token, &user_url).await
        .map_err(|e| format!("Users: {e}"))?;

    for u in &users {
        let upn = str_val(u, "userPrincipalName");
        let name = str_val(u, "displayName");
        let enabled = bool_val(u, "accountEnabled");
        let raw_user_type = str_val(u, "userType");
        let user_type_display: String = if raw_user_type.eq_ignore_ascii_case("Guest") {
            "Externe".into()
        } else {
            "Interne".into()
        };

        let lic_skus: Vec<String> = u
            .get("assignedLicenses")
            .and_then(|l| l.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|l| l.get("skuId")?.as_str())
                    .filter_map(|id| sku_id_map.get(id))
                    .cloned()
                    .collect()
            })
            .unwrap_or_default();

        for sku in &lic_skus {
            snap.user_licenses.push(UserLicense {
                display_name: name.clone(),
                upn: upn.clone(),
                sku_part_number: sku.clone(),
                friendly_name: friendly_sku(sku).to_string(),
                account_enabled: if enabled { "Oui".into() } else { "Non".into() },
                user_type: user_type_display.clone(),
            });
        }
    }

    Ok(snap)
}

async fn fetch_pages(client: &Client, token: &str, url: &str) -> Result<Vec<Value>, String> {
    let mut items = Vec::new();
    let mut next = Some(url.to_string());

    while let Some(u) = next {
        let resp = client
            .get(&u)
            .bearer_auth(token)
            .header("ConsistencyLevel", "eventual")
            .send()
            .await
            .map_err(|e| e.to_string())?;

        if !resp.status().is_success() {
            let st = resp.status().as_u16();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("HTTP {st} from {u}: {body}"));
        }

        let json: Value = resp.json().await.map_err(|e| e.to_string())?;
        if let Some(arr) = json.get("value").and_then(|v| v.as_array()) {
            items.extend(arr.clone());
        }
        next = json.get("@odata.nextLink").and_then(|v| v.as_str()).map(|s| s.to_string());
    }

    Ok(items)
}

fn str_val(v: &Value, key: &str) -> String {
    v.get(key).and_then(|x| x.as_str()).unwrap_or("").to_string()
}

fn bool_val(v: &Value, key: &str) -> bool {
    v.get(key).and_then(|x| x.as_bool()).unwrap_or(false)
}

fn i64_val(v: &Value, key: &str) -> i64 {
    v.get(key).and_then(|x| x.as_i64()).unwrap_or(0)
}

fn str_array(v: &Value, key: &str) -> Vec<String> {
    v.get(key)
        .and_then(|x| x.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|x| x.as_str())
                .map(|s| s.to_string())
                .collect()
        })
        .unwrap_or_default()
}

fn is_phone_related_sku(sku: &str) -> bool {
    matches!(sku, "MCOEV" | "MCOEV_VIRTUALUSER" | "MCOPSTN1" | "MCOPSTN2" | "MCOPSTN_5" | "MCOPSTNC" | "PHONESYSTEM_VIRTUALUSER")
}

fn dedup_keep_order(values: Vec<String>) -> Vec<String> {
    let mut seen = std::collections::HashSet::new();
    let mut out = Vec::new();
    for v in values {
        if !v.is_empty() && seen.insert(v.clone()) {
            out.push(v);
        }
    }
    out
}

fn normalize_phone(value: &str) -> String {
    value.trim().replace(' ', "")
}

fn lower(value: &str) -> String {
    value.to_lowercase()
}

fn is_free_subscription_sku(sku: &str) -> bool {
    let upper = sku.to_uppercase();
    upper.contains("FREE")
        || upper.contains("EXPLORATORY")
        || matches!(upper.as_str(), "MCOEV_VIRTUALUSER" | "PHONESYSTEM_VIRTUALUSER" | "TEAMS_PHONE_RESOURCE_ACCOUNT")
}

fn compute_subscription_status(available: i64, consumed: i64, purchased: i64, is_free: bool) -> String {
    if available < 0 {
        // Real overage (more consumed than purchased)
        "DEPASSEMENT".into()
    } else if is_free || purchased >= 10_000 {
        // Free or near-unlimited license (bundle tied to other offers)
        "OK".into()
    } else if consumed == 0 {
        // No assignments — not a surplus, just unused capacity
        "OK".into()
    } else if available <= 1 {
        "OK".into()
    } else if available <= 4 {
        "SURPLUS".into()
    } else {
        "SURPLUS IMPORTANT".into()
    }
}

fn detect_resource_account_type(display_name: &str, upn: &str, license_skus: &[String]) -> Option<String> {
    let name = lower(display_name);
    let upn_lower = lower(upn);
    let has_virtual_license = license_skus.iter().any(|s| s == "MCOEV_VIRTUALUSER" || s == "PHONESYSTEM_VIRTUALUSER");

    let is_aa = name.contains("auto attendant") || name.starts_with("aa-") || name.starts_with("aa ") || upn_lower.contains("autoattendant");
    if is_aa {
        return Some("Auto Attendant".into());
    }

    let is_cq = name.contains("call queue") || name.starts_with("cq-") || name.starts_with("cq ") || upn_lower.contains("callqueue");
    if is_cq {
        return Some("Call Queue".into());
    }

    if has_virtual_license {
        return Some("Compte ressource".into());
    }

    None
}

fn sort_case_insensitive_by<T, F>(items: &mut [T], key: F)
where
    F: Fn(&T) -> &str,
{
    items.sort_by(|a, b| lower(key(a)).cmp(&lower(key(b))));
}

fn merge_resource_based_queues(data: &mut DashboardData) {
    let existing: std::collections::HashSet<String> = data.call_queues.iter().map(|q| lower(&q.name)).collect();
    let new_cqs: Vec<CallQueue> = data.resource_accounts.iter()
        .filter(|r| r.account_type == "Call Queue" && !existing.contains(&lower(&r.display_name)))
        .map(|ra| CallQueue {
            name: ra.display_name.clone(),
            language: "N/A".into(),
            routing_method: "N/A".into(),
            agent_count: 0,
            agents: Vec::new(),
            distribution_lists: Vec::new(),
            timeout_action: "N/A".into(),
            overflow_action: "N/A".into(),
            phone_number: ra.phone_number.clone(),
            can_be_deleted: String::new(),
        })
        .collect();
    data.call_queues.extend(new_cqs);
}

fn merge_resource_based_attendants(data: &mut DashboardData) {
    let existing: std::collections::HashSet<String> = data.auto_attendants.iter().map(|q| lower(&q.name)).collect();
    let new_aas: Vec<AutoAttendant> = data.resource_accounts.iter()
        .filter(|r| r.account_type == "Auto Attendant" && !existing.contains(&lower(&r.display_name)))
        .map(|ra| AutoAttendant {
            name: ra.display_name.clone(),
            language: "N/A".into(),
            time_zone: "N/A".into(),
            phone_number: ra.phone_number.clone(),
            status: "Actif".into(),
            can_be_deleted: String::new(),
            resource_account_count: 0,
            resource_account_licensed_count: 0,
            default_call_flow: String::new(),
            after_hours_call_flow: String::new(),
            business_hours: Vec::new(),
            // UPN of this resource account — used by compute_resource_account_counts
            application_instances: vec![ra.upn.clone()],
        })
        .collect();
    data.auto_attendants.extend(new_aas);
}

/// Fills in missing phone numbers for CQs/AAs
/// by cross-referencing resource accounts already fetched via Graph.
fn enrich_from_resource_accounts(data: &mut DashboardData) {
    let cq_phones: std::collections::HashMap<String, String> = data
        .resource_accounts
        .iter()
        .filter(|r| r.account_type == "Call Queue" && !r.phone_number.is_empty() && r.phone_number != "-")
        .map(|r| (lower(&r.display_name), r.phone_number.clone()))
        .collect();

    for cq in data.call_queues.iter_mut() {
        if cq.phone_number.is_empty() || cq.phone_number == "-" {
            if let Some(phone) = cq_phones.get(&lower(&cq.name)) {
                cq.phone_number = phone.clone();
            }
        }
    }

    let aa_phones: std::collections::HashMap<String, String> = data
        .resource_accounts
        .iter()
        .filter(|r| r.account_type == "Auto Attendant" && !r.phone_number.is_empty() && r.phone_number != "-")
        .map(|r| (lower(&r.display_name), r.phone_number.clone()))
        .collect();

    for aa in data.auto_attendants.iter_mut() {
        if aa.phone_number.is_empty() || aa.phone_number == "-" {
            if let Some(phone) = aa_phones.get(&lower(&aa.name)) {
                aa.phone_number = phone.clone();
            }
        }
    }
}

/// Computes the can_be_deleted field for all call queues and auto attendants.
/// Call queue: deletable if no agents AND no assigned number.
/// Auto attendant: deletable if no assigned number AND no linked resource account.
fn compute_deletability(data: &mut DashboardData) {
    for cq in data.call_queues.iter_mut() {
        let no_phone = cq.phone_number.is_empty() || cq.phone_number == "-";
        cq.can_be_deleted = if no_phone && cq.agent_count == 0 {
            "Oui".into()
        } else {
            "Non".into()
        };
    }
    // Names of "Auto Attendant" resource accounts (lowercased for comparison)
    let ra_aa_names: std::collections::HashSet<String> = data
        .resource_accounts
        .iter()
        .filter(|r| r.account_type == "Auto Attendant")
        .map(|r| lower(&r.display_name))
        .collect();

    for aa in data.auto_attendants.iter_mut() {
        let no_phone = aa.phone_number.is_empty() || aa.phone_number == "-";
        let has_resource_account = ra_aa_names.contains(&lower(&aa.name));
        aa.can_be_deleted = if no_phone && !has_resource_account {
            "Oui".into()
        } else {
            "Non".into()
        };
    }
}

// PowerShell script for checking/installing the MicrosoftTeams module.
// On PS5: warns that PS7 is required.
// On PS7: imports the module (direct path if needed), installs only if absent.
// Avoids Install-Module -Force if the module is already present (prevents OneDrive conflicts).
const PS_CHECK_SCRIPT: &str = r#"
$ProgressPreference = 'SilentlyContinue'
$WarningPreference  = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Teams PS module (v5+) ships .NET 8 DLLs incompatible with PS 5.1 (.NET Framework 4.x).
if ($PSVersionTable.PSVersion.Major -lt 7) {
    'ps5: PowerShell 7 (pwsh) is required for the MicrosoftTeams module. Install it from https://aka.ms/powershell'
    exit
}

# Standard import attempt
$importOk = $false
try {
    Import-Module MicrosoftTeams -ErrorAction Stop -WarningAction SilentlyContinue 3>$null
    $importOk = $true
} catch { }

if ($importOk) { 'ok'; exit }

# Import failed: look for an already-installed module and attempt a direct-path import
# (avoids forcing reinstall if files are locked by OneDrive)
$existing = Get-Module -ListAvailable -Name MicrosoftTeams -ErrorAction SilentlyContinue |
            Sort-Object Version -Descending | Select-Object -First 1
if ($existing) {
    try {
        $psd1 = Join-Path $existing.ModuleBase 'MicrosoftTeams.psd1'
        Import-Module $psd1 -Force -ErrorAction Stop -WarningAction SilentlyContinue 3>$null
        'ok'; exit
    } catch { }
}

# Module not found: install from PSGallery
try {
    $nuget = Get-PackageProvider -Name NuGet -ErrorAction SilentlyContinue
    if (-not $nuget -or [version]$nuget.Version -lt [version]'2.8.5.201') {
        Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Force -Scope CurrentUser -ErrorAction Stop | Out-Null
    }
    Set-PSRepository -Name PSGallery -InstallationPolicy Trusted -ErrorAction SilentlyContinue | Out-Null
    Install-Module -Name MicrosoftTeams -AllowClobber -Scope CurrentUser -SkipPublisherCheck -ErrorAction Stop | Out-Null
    Import-Module MicrosoftTeams -ErrorAction Stop -WarningAction SilentlyContinue 3>$null
    'installed'
} catch {
    $errMsg = [string]$_.Exception.Message
    if ($errMsg -match 'denied|OneDrive|Access to the path') {
        'error: Access denied (OneDrive is locking module files). Install manually: Install-Module MicrosoftTeams -Scope AllUsers'
    } else {
        'error: ' + $errMsg
    }
}
"#;

/// Runs the MicrosoftTeams module check/install script.
/// Returns "ok" if the module is already working, "installed" after a successful install,
/// or an error on failure.
/// Blocking function — call via spawn_blocking or std::thread::spawn.
pub fn run_ps_module_install() -> Result<String, String> {
    let temp_path = std::env::temp_dir().join("teams_check_module.ps1");
    std::fs::write(&temp_path, PS_CHECK_SCRIPT.as_bytes())
        .map_err(|e| format!("Failed to write check script: {e}"))?;
    let script_path = temp_path.to_string_lossy().to_string();

    let mut cmd = Command::new(ps_exe());
    cmd.args([
        "-NonInteractive", "-NoProfile", "-NoLogo",
        "-WindowStyle", "Hidden",
        "-ExecutionPolicy", "Bypass",
        "-File", &script_path,
    ])
    .stdout(Stdio::piped())
    .stderr(Stdio::piped());

    #[cfg(windows)]
    cmd.creation_flags(0x0800_0000);

    let output = cmd.output().map_err(|e| {
        let _ = std::fs::remove_file(&temp_path);
        format!("Failed to launch PowerShell: {e}")
    })?;
    let _ = std::fs::remove_file(&temp_path);

    let raw = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let line = raw.lines().last().unwrap_or("").trim().to_string();

    match line.as_str() {
        "ok" | "reinstalled" => Ok("ok".into()),
        "installed"          => Ok("installed".into()),
        other if other.starts_with("ps5:") => Err(other.trim_start_matches("ps5:").trim().to_string()),
        other if other.starts_with("error:") => Err(other.trim_start_matches("error:").trim().to_string()),
        other => {
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            let hint = stderr.lines().last().unwrap_or("").trim().to_string();
            Err(if hint.is_empty() { other.to_string() } else { hint })
        }
    }
}

/// Startup-thread version: logs the result without returning a value.
pub fn check_ps_module() {
    crate::logger::info(&format!("PowerShell executable detected: {}", ps_exe()));
    match run_ps_module_install() {
        Ok(s) if s == "installed" => crate::logger::info("PowerShell MicrosoftTeams module installed successfully."),
        Ok(_)  => crate::logger::info("PowerShell MicrosoftTeams module: OK."),
        Err(e) => crate::logger::warn(&format!("check_ps_module : {e}")),
    }
}

// Embedded PowerShell script — uses the MicrosoftTeams module.
// Preferred authentication: client_credentials (app-only) with TEAMS_CLIENT_SECRET.
// Fallback: delegated tokens passed via TEAMS_TOKEN/TEAMS_TOKEN2 (less reliable on module 7.x).
// Runs invisibly (CREATE_NO_WINDOW + -WindowStyle Hidden).
const PS_SCRIPT: &str = r#"
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$WarningPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Version info for diagnostics — visible in UI warnings
$psVer = "$($PSVersionTable.PSVersion.Major).$($PSVersionTable.PSVersion.Minor)"

try {
    # Standard import, with direct-path fallback (OneDrive/PSModulePath not configured)
    $importOk = $false
    try {
        Import-Module MicrosoftTeams -ErrorAction Stop -WarningAction SilentlyContinue 3>$null
        $importOk = $true
    } catch { }
    if (-not $importOk) {
        $m = Get-Module -ListAvailable -Name MicrosoftTeams -ErrorAction SilentlyContinue |
             Sort-Object Version -Descending | Select-Object -First 1
        if ($m) {
            Import-Module (Join-Path $m.ModuleBase 'MicrosoftTeams.psd1') -Force -ErrorAction Stop -WarningAction SilentlyContinue 3>$null
        } else {
            throw "MicrosoftTeams module not found. Use the CQ/AA tab to install it."
        }
    }

    # Module version for diagnostics (included in output JSON)
    $teamsModVer = (Get-Module MicrosoftTeams -ErrorAction SilentlyContinue).Version
    if (-not $teamsModVer) {
        $teamsModVer = (Get-Module -ListAvailable -Name MicrosoftTeams -ErrorAction SilentlyContinue |
                        Sort-Object Version -Descending | Select-Object -First 1).Version
    }
    $teamsModVerStr = if ($teamsModVer) { [string]$teamsModVer } else { 'unknown' }

    $clientSecret = $env:TEAMS_CLIENT_SECRET
    $appId        = $env:TEAMS_APP_ID
    $useAppAuth   = $clientSecret -and $clientSecret -ne '' -and $appId -and $appId -ne ''

    if ($useAppAuth) {
        # Application authentication (client_credentials) — recommended by Microsoft
        # for Connect-MicrosoftTeams in a non-interactive context (module 5.x+).
        # Ref: https://learn.microsoft.com/microsoftteams/teams-powershell-application-authentication
        $uri = "https://login.microsoftonline.com/$($env:TEAMS_TENANT)/oauth2/v2.0/token"

        $graphToken = (Invoke-RestMethod -Uri $uri -Method POST -UseBasicParsing -Body @{
            grant_type    = 'client_credentials'
            scope         = 'https://graph.microsoft.com/.default'
            client_id     = $appId
            client_secret = $clientSecret
        } -ErrorAction Stop).access_token

        $teamsToken = (Invoke-RestMethod -Uri $uri -Method POST -UseBasicParsing -Body @{
            grant_type    = 'client_credentials'
            scope         = '48ac35b8-9aa8-4d74-927d-1f4a14a0b239/.default'
            client_id     = $appId
            client_secret = $clientSecret
        } -ErrorAction Stop).access_token

        Connect-MicrosoftTeams -AccessTokens @($graphToken, $teamsToken) `
            -ErrorAction Stop -WarningAction SilentlyContinue | Out-Null
    } else {
        # Fallback: delegated tokens (less reliable on module 7.x — "Not supported tenant type")
        # Configure a Client Secret in Azure and in app settings to resolve this.
        $graphToken  = $env:TEAMS_TOKEN
        $teamsToken  = $env:TEAMS_TOKEN2
        $hasTeams    = $teamsToken -and $teamsToken -ne ''

        $combos = @()
        if ($hasTeams) {
            $combos += ,@($graphToken, $teamsToken)
            $combos += ,@($teamsToken, $graphToken)
            $combos += ,@($teamsToken)
        }
        $combos += ,@($graphToken)

        $connectOk  = $false
        $connectErr = ''
        foreach ($toks in $combos) {
            try {
                Connect-MicrosoftTeams -TenantId $env:TEAMS_TENANT -AccessTokens $toks `
                    -ErrorAction Stop -WarningAction SilentlyContinue | Out-Null
                $connectOk = $true
                break
            } catch {
                $connectErr = [string]$_.Exception.Message
            }
        }
        if (-not $connectOk) {
            throw "Teams PS connection failed (module $teamsModVerStr). To resolve, add an Azure Client Secret in the application settings. Error: $connectErr"
        }
    }

    $cqError = ''
    $cqs = @()
    try {
        $rawCqs = Get-CsCallQueue -ErrorAction Stop -WarningAction SilentlyContinue 3>$null
        if ($rawCqs) {
            $cqs = @($rawCqs | ForEach-Object {
                $lu         = if ($_.LineUri) { $_.LineUri -replace '^tel:', '' } else { '-' }
                $agentIds   = @($_.Agents | ForEach-Object { [string]$_.ObjectId })
                $distLists  = @($_.DistributionLists | ForEach-Object { [string]$_ })
                @{
                    name              = [string]$_.Name
                    language          = if ($_.Language) { [string]$_.Language } else { 'N/A' }
                    routingMethod     = if ($_.RoutingMethod) { [string]$_.RoutingMethod } else { 'N/A' }
                    agentCount        = [int]($_.Agents | Measure-Object).Count
                    agentIds          = $agentIds
                    distributionLists = $distLists
                    timeoutAction     = if ($_.TimeoutAction) { [string]$_.TimeoutAction } else { 'N/A' }
                    overflowAction    = if ($_.OverflowAction) { [string]$_.OverflowAction } else { 'N/A' }
                    phoneNumber       = $lu
                }
            })
        }
    } catch { $cqError = [string]$_.Exception.Message }

    $aaError = ''
    $aas = @()
    try {
        $rawAas = Get-CsAutoAttendant -ErrorAction Stop -WarningAction SilentlyContinue 3>$null
        if ($rawAas) {
            $aas = @($rawAas | ForEach-Object {
                # --- Default call flow (business hours) ---
                $dfFlow = 'N/A'
                try {
                    $menu = $_.DefaultCallFlow.Menu
                    if ($menu -and $menu.MenuOptions.Count -gt 0) {
                        $opt    = $menu.MenuOptions[0]
                        $action = [string]$opt.Action
                        if ($action -eq 'TransferCallToTarget') {
                            $ttype = if ($opt.CallTarget) { [string]$opt.CallTarget.Type } else { 'Inconnu' }
                            $label = switch ($ttype) {
                                'ApplicationEndpoint'   { 'Compte ressource' }
                                'User'                  { 'Utilisateur' }
                                'ExternalPstn'          { 'PSTN externe' }
                                'ConfigurationEndpoint' { 'Autre standard' }
                                default                 { $ttype }
                            }
                            $dfFlow = "Transferer -> $label"
                        } elseif ($action -eq 'DisconnectCall') {
                            $dfFlow = 'Deconnecter'
                        } else { $dfFlow = $action }
                    }
                } catch { $dfFlow = 'N/A' }

                # --- After-hours call flow ---
                $ahFlow = 'N/A'
                try {
                    $aha = $_.CallHandlingAssociations |
                           Where-Object { [string]$_.Type -eq 'AfterHours' } |
                           Select-Object -First 1
                    if ($aha) {
                        $ahCF = $_.CallFlows |
                                Where-Object { [string]$_.Id -eq [string]$aha.CallFlowId } |
                                Select-Object -First 1
                        if ($ahCF -and $ahCF.Menu -and $ahCF.Menu.MenuOptions.Count -gt 0) {
                            $opt    = $ahCF.Menu.MenuOptions[0]
                            $action = [string]$opt.Action
                            if ($action -eq 'TransferCallToTarget') {
                                $ttype = if ($opt.CallTarget) { [string]$opt.CallTarget.Type } else { 'Inconnu' }
                                $label = switch ($ttype) {
                                    'ApplicationEndpoint'   { 'Compte ressource' }
                                    'User'                  { 'Utilisateur' }
                                    'ExternalPstn'          { 'PSTN externe' }
                                    'ConfigurationEndpoint' { 'Autre standard' }
                                    default                 { $ttype }
                                }
                                $ahFlow = "Transferer -> $label"
                            } elseif ($action -eq 'DisconnectCall') {
                                $ahFlow = 'Deconnecter'
                            } else { $ahFlow = $action }
                        }
                    }
                } catch { $ahFlow = 'N/A' }

                $appInst = @($_.ApplicationInstances | ForEach-Object { [string]$_ })

                # --- Weekly business hours ---
                $bhList = @()
                try {
                    # Method 1: find the schedule via the BusinessHours association
                    $bhSched = $null
                    $bhAssoc = $_.CallHandlingAssociations |
                               Where-Object { [string]$_.Type -eq 'BusinessHours' } |
                               Select-Object -First 1
                    if ($bhAssoc -and $bhAssoc.ScheduleId) {
                        $bhSched = $_.Schedules |
                                   Where-Object { [string]$_.Id -eq [string]$bhAssoc.ScheduleId } |
                                   Select-Object -First 1
                    }
                    # Method 2: fallback — first schedule with WeeklyRecurrentSchedule
                    if (-not $bhSched) {
                        foreach ($sc in $_.Schedules) {
                            if ($sc.WeeklyRecurrentSchedule) { $bhSched = $sc; break }
                        }
                    }
                    if ($bhSched -and $bhSched.WeeklyRecurrentSchedule) {
                        $wrs    = $bhSched.WeeklyRecurrentSchedule
                        $days   = @('Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday')
                        $daysEn = @('Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday')
                        for ($di = 0; $di -lt 7; $di++) {
                            $dayProp = $days[$di] + 'Hours'
                            $ranges  = $wrs.$dayProp
                            if ($ranges -and $ranges.Count -gt 0) {
                                $rangeStrs = @($ranges | ForEach-Object {
                                    $s = '{0:D2}:{1:D2}' -f $_.Start.Hours, $_.Start.Minutes
                                    $e = '{0:D2}:{1:D2}' -f $_.End.Hours, $_.End.Minutes
                                    "$s - $e"
                                })
                                $bhList += @{ day = $daysEn[$di]; hours = ($rangeStrs -join ' / ') }
                            } else {
                                $bhList += @{ day = $daysEn[$di]; hours = 'Closed' }
                            }
                        }
                    }
                } catch {}

                @{
                    name                 = [string]$_.Name
                    language             = if ($_.LanguageId) { [string]$_.LanguageId } else { 'N/A' }
                    timeZoneId           = if ($_.TimeZoneId) { [string]$_.TimeZoneId } else { 'N/A' }
                    phoneNumber          = '-'
                    status               = 'Actif'
                    defaultCallFlow      = $dfFlow
                    afterHoursCallFlow   = $ahFlow
                    applicationInstances = $appInst
                    businessHours        = $bhList
                }
            })
        }
    } catch { $aaError = [string]$_.Exception.Message }

    # Manual serialization to avoid the PS5 issue with single-element arrays
    $cqsJson = if ($cqs.Count -eq 0) { '[]' }
               elseif ($cqs.Count -eq 1) { '[' + ($cqs[0] | ConvertTo-Json -Compress -Depth 5) + ']' }
               else { ConvertTo-Json -InputObject $cqs -Depth 5 -Compress }

    $aasJson = if ($aas.Count -eq 0) { '[]' }
               elseif ($aas.Count -eq 1) { '[' + ($aas[0] | ConvertTo-Json -Compress -Depth 5) + ']' }
               else { ConvertTo-Json -InputObject $aas -Depth 5 -Compress }

    $cqErrJson      = $cqError       | ConvertTo-Json
    $aaErrJson      = $aaError       | ConvertTo-Json
    $psVerJson      = $psVer         | ConvertTo-Json
    $modVerJson     = $teamsModVerStr | ConvertTo-Json
    '{"success":true,"callQueues":' + $cqsJson + ',"autoAttendants":' + $aasJson + ',"cqError":' + $cqErrJson + ',"aaError":' + $aaErrJson + ',"psVer":' + $psVerJson + ',"modVer":' + $modVerJson + '}'
} catch {
    $errMsg    = [string]$_.Exception.Message
    $errJson   = $errMsg | ConvertTo-Json
    $psVerJson = $psVer  | ConvertTo-Json
    $modVerJson = if ($teamsModVerStr) { $teamsModVerStr | ConvertTo-Json } else { '"unknown"' }
    '{"success":false,"error":' + $errJson + ',"psVer":' + $psVerJson + ',"modVer":' + $modVerJson + '}'
}
"#;

/// Runs the PowerShell MicrosoftTeams module in the background (no window)
/// to retrieve call queues and auto attendants.
/// graph_token   : Graph token (required, fallback if no client_secret)
/// tenant_id     : Azure AD tenant ID
/// client_id     : Azure AD app ID (for client_credentials)
/// teams_token   : Teams service token 48ac35b8-... (delegated fallback)
/// client_secret : Azure client secret (enables the recommended app-only auth)
/// Returns (call_queues, auto_attendants, diagnostics) — diagnostics are warnings.
fn run_powershell_for_teams(graph_token: &str, tenant_id: &str, client_id: &str, teams_token: Option<&str>, client_secret: Option<&str>) -> Result<(Vec<CallQueue>, Vec<AutoAttendant>, Vec<String>), String> {
    let temp_path = std::env::temp_dir().join("teams_analysis_fetch.ps1");
    std::fs::write(&temp_path, PS_SCRIPT.as_bytes())
        .map_err(|e| format!("Failed to write temporary script: {e}"))?;
    let script_path = temp_path.to_string_lossy().to_string();

    let mut cmd = Command::new(ps_exe());
    cmd.args([
        "-NonInteractive",
        "-NoProfile",
        "-NoLogo",
        "-WindowStyle", "Hidden",
        "-ExecutionPolicy", "Bypass",
        "-File", &script_path,
    ])
    .env("TEAMS_TOKEN", graph_token)
    .env("TEAMS_TOKEN2", teams_token.unwrap_or(""))
    .env("TEAMS_TENANT", tenant_id)
    .env("TEAMS_APP_ID", client_id)
    .env("TEAMS_CLIENT_SECRET", client_secret.unwrap_or(""))
    .stdout(Stdio::piped())
    .stderr(Stdio::piped());

    #[cfg(windows)]
    cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW

    crate::logger::info(&format!("PS fetch: starting via {}", ps_exe()));

    let output = cmd.output().map_err(|e| {
        let _ = std::fs::remove_file(&temp_path);
        format!("Failed to launch PowerShell: {e}")
    })?;
    let _ = std::fs::remove_file(&temp_path);

    crate::logger::info(&format!("PS fetch: exit={} stdout_len={} stderr_len={}",
        output.status, output.stdout.len(), output.stderr.len()));

    let raw = String::from_utf8_lossy(&output.stdout).to_string();

    // Log the first 500 characters of stdout for diagnostics
    let preview = raw.chars().take(500).collect::<String>().replace('\n', "↵");
    crate::logger::info(&format!("PS fetch stdout (500c): {preview}"));

    let stderr_raw = String::from_utf8_lossy(&output.stderr).to_string();
    if !stderr_raw.trim().is_empty() {
        let err_preview = stderr_raw.chars().take(300).collect::<String>().replace('\n', "↵");
        crate::logger::warn(&format!("PS fetch stderr: {err_preview}"));
    }

    // Take the last line that looks like JSON
    let json_str = raw
        .lines()
        .rev()
        .find(|l| l.trim_start().starts_with('{'))
        .ok_or_else(|| {
            let hint = stderr_raw.lines().last().unwrap_or("").trim().to_string();
            let err = if hint.is_empty() {
                "No JSON returned by PowerShell (MicrosoftTeams module not installed?)".to_string()
            } else {
                format!("No JSON returned by PowerShell: {hint}")
            };
            crate::logger::warn(&format!("PS fetch : {err}"));
            err
        })?;

    let json: Value = serde_json::from_str(json_str.trim())
        .map_err(|e| format!("Invalid PowerShell JSON: {e}"))?;

    let ps_ver = str_val(&json, "psVer");
    let mod_ver = str_val(&json, "modVer");
    let ps_exe_used = ps_exe();

    if !json.get("success").and_then(|v| v.as_bool()).unwrap_or(false) {
        let err = str_val(&json, "error");
        let full = format!("{err} [PS {ps_ver} via {ps_exe_used}, module {mod_ver}]");
        crate::logger::warn(&format!("PS fetch error: {full}"));
        return Err(full);
    }

    let mut diagnostics = Vec::new();
    // Always show which PS version executed the script
    if !ps_ver.is_empty() {
        diagnostics.push(format!("PowerShell {ps_ver} ({ps_exe_used})"));
    }
    let cq_err = str_val(&json, "cqError");
    let aa_err = str_val(&json, "aaError");
    if !cq_err.is_empty() {
        crate::logger::warn(&format!("PS Get-CsCallQueue error: {cq_err}"));
        diagnostics.push(format!("Get-CsCallQueue: {cq_err}"));
    }
    if !aa_err.is_empty() {
        crate::logger::warn(&format!("PS Get-CsAutoAttendant error: {aa_err}"));
        diagnostics.push(format!("Get-CsAutoAttendant: {aa_err}"));
    }

    let mut cqs = Vec::new();
    if let Some(arr) = json.get("callQueues").and_then(|v| v.as_array()) {
        for q in arr {
            let agents: Vec<String> = q.get("agentIds")
                .and_then(|v| v.as_array())
                .map(|a| a.iter().filter_map(|x| x.as_str()).map(|s| s.to_string()).collect())
                .unwrap_or_default();
            let distribution_lists: Vec<String> = q.get("distributionLists")
                .and_then(|v| v.as_array())
                .map(|a| a.iter().filter_map(|x| x.as_str()).map(|s| s.to_string()).collect())
                .unwrap_or_default();
            cqs.push(CallQueue {
                name:               str_val(q, "name"),
                language:           str_val(q, "language"),
                routing_method:     str_val(q, "routingMethod"),
                agent_count:        q.get("agentCount").and_then(|v| v.as_i64()).unwrap_or(0),
                agents,
                distribution_lists,
                timeout_action:     str_val(q, "timeoutAction"),
                overflow_action:    str_val(q, "overflowAction"),
                phone_number:       str_val(q, "phoneNumber"),
                can_be_deleted:     String::new(),
            });
        }
    }

    let mut aas = Vec::new();
    if let Some(arr) = json.get("autoAttendants").and_then(|v| v.as_array()) {
        for a in arr {
            let application_instances: Vec<String> = a.get("applicationInstances")
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter().filter_map(|x| x.as_str()).map(|s| s.to_string()).collect())
                .unwrap_or_default();
            let business_hours: Vec<DayHours> = a.get("businessHours")
                .and_then(|v| v.as_array())
                .map(|arr| arr.iter().filter_map(|item| {
                    let day   = item.get("day").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    let hours = item.get("hours").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    if day.is_empty() { None } else { Some(DayHours { day, hours }) }
                }).collect())
                .unwrap_or_default();
            aas.push(AutoAttendant {
                name:                            str_val(a, "name"),
                language:                        str_val(a, "language"),
                time_zone:                       str_val(a, "timeZoneId"),
                phone_number:                    str_val(a, "phoneNumber"),
                status:                          str_val(a, "status"),
                can_be_deleted:                  String::new(),
                resource_account_count:          0, // computed in compute_resource_account_counts
                resource_account_licensed_count: 0,
                default_call_flow:               str_val(a, "defaultCallFlow"),
                after_hours_call_flow:           str_val(a, "afterHoursCallFlow"),
                business_hours,
                application_instances,
            });
        }
    }

    Ok((cqs, aas, diagnostics))
}

// ─── PS phone action script ──────────────────────────────────────────────────

static PS_PHONE_SCRIPT: &str = r#"
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$WarningPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

try {
    $importOk = $false
    try { Import-Module MicrosoftTeams -ErrorAction Stop -WarningAction SilentlyContinue 3>$null; $importOk = $true } catch { }
    if (-not $importOk) {
        $m = Get-Module -ListAvailable -Name MicrosoftTeams -ErrorAction SilentlyContinue | Sort-Object Version -Descending | Select-Object -First 1
        if ($m) { Import-Module (Join-Path $m.ModuleBase 'MicrosoftTeams.psd1') -Force -ErrorAction Stop -WarningAction SilentlyContinue 3>$null }
        else { throw "MicrosoftTeams module not found. Install it from the Call Queues tab." }
    }

    $clientSecret = $env:TEAMS_CLIENT_SECRET
    $appId        = $env:TEAMS_APP_ID
    $useAppAuth   = $clientSecret -and $clientSecret -ne '' -and $appId -and $appId -ne ''

    if ($useAppAuth) {
        $uri = "https://login.microsoftonline.com/$($env:TEAMS_TENANT)/oauth2/v2.0/token"
        $graphToken = (Invoke-RestMethod -Uri $uri -Method POST -UseBasicParsing -Body @{
            grant_type='client_credentials'; scope='https://graph.microsoft.com/.default'; client_id=$appId; client_secret=$clientSecret
        }).access_token
        $teamsToken = (Invoke-RestMethod -Uri $uri -Method POST -UseBasicParsing -Body @{
            grant_type='client_credentials'; scope='48ac35b8-9aa8-4d74-927d-1f4a14a0b239/.default'; client_id=$appId; client_secret=$clientSecret
        }).access_token
        Connect-MicrosoftTeams -AccessTokens @($graphToken, $teamsToken) -ErrorAction Stop -WarningAction SilentlyContinue | Out-Null
    } else {
        $graphToken = $env:TEAMS_TOKEN
        $teamsToken = $env:TEAMS_TOKEN2
        $toks = if ($teamsToken -and $teamsToken -ne '') { @($graphToken, $teamsToken) } else { @($graphToken) }
        Connect-MicrosoftTeams -TenantId $env:TEAMS_TENANT -AccessTokens $toks -ErrorAction Stop -WarningAction SilentlyContinue | Out-Null
    }

    $action      = $env:ACTION_TYPE
    $upn         = $env:ACTION_UPN
    $phoneNumber = $env:ACTION_PHONE
    $numberType  = $env:ACTION_NUMBER_TYPE

    if ($action -eq 'assign') {
        Set-CsPhoneNumberAssignment -Identity $upn -PhoneNumber $phoneNumber -PhoneNumberType $numberType -ErrorAction Stop
        Set-CsPhoneNumberAssignment -Identity $upn -EnterpriseVoiceEnabled $true -ErrorAction Stop
        if ($numberType -eq 'DirectRouting' -or $numberType -eq 'OperatorConnect') {
            $policy = Get-CsOnlineVoiceRoutingPolicy | Where-Object { $_.Identity -ne 'Global' } | Select-Object -First 1
            if ($policy) { Grant-CsOnlineVoiceRoutingPolicy -Identity $upn -PolicyName $policy.Identity -ErrorAction Stop }
        }
    } elseif ($action -eq 'unassign') {
        Remove-CsPhoneNumberAssignment -Identity $upn -RemoveAll -ErrorAction Stop
        Grant-CsOnlineVoiceRoutingPolicy -Identity $upn -PolicyName $null -ErrorAction Stop
    } else {
        throw "Unknown action: $action"
    }

    Disconnect-MicrosoftTeams -ErrorAction SilentlyContinue | Out-Null
    Write-Output '{"ok":true}'
} catch {
    $msg = [string]$_.Exception.Message
    $escaped = $msg -replace '\\', '\\\\' -replace '"', '\"'
    Write-Output "{`"ok`":false,`"error`":`"$escaped`"}"
}
"#;

pub fn run_ps_phone_action(
    action: &str,
    upn: &str,
    phone_number: &str,
    number_type: &str,
    graph_token: &str,
    tenant_id: &str,
    client_id: &str,
    teams_token: Option<&str>,
    client_secret: Option<&str>,
) -> Result<(), String> {
    let temp_path = std::env::temp_dir().join("teams_phone_action.ps1");
    std::fs::write(&temp_path, PS_PHONE_SCRIPT.as_bytes())
        .map_err(|e| format!("Failed to write PS script: {e}"))?;
    let script_path = temp_path.to_string_lossy().to_string();

    let mut cmd = std::process::Command::new(ps_exe());
    cmd.arg("-NonInteractive")
        .arg("-NoProfile")
        .arg("-ExecutionPolicy").arg("Bypass")
        .arg("-File").arg(&script_path)
        .env("ACTION_TYPE",        action)
        .env("ACTION_UPN",         upn)
        .env("ACTION_PHONE",       phone_number)
        .env("ACTION_NUMBER_TYPE", number_type)
        .env("TEAMS_TOKEN",        graph_token)
        .env("TEAMS_TENANT",       tenant_id)
        .env("TEAMS_APP_ID",       client_id);

    if let Some(t2) = teams_token {
        cmd.env("TEAMS_TOKEN2", t2);
    }
    if let Some(cs) = client_secret {
        cmd.env("TEAMS_CLIENT_SECRET", cs);
    }

    let out = cmd.output().map_err(|e| {
        let _ = std::fs::remove_file(&temp_path);
        format!("Failed to launch PowerShell: {e}")
    })?;
    let _ = std::fs::remove_file(&temp_path);

    let stdout = String::from_utf8_lossy(&out.stdout);
    let trimmed = stdout.trim();

    // Find the last JSON line
    let json_line = trimmed.lines()
        .filter(|l| l.starts_with('{'))
        .last()
        .unwrap_or(trimmed);

    let v: serde_json::Value = serde_json::from_str(json_line)
        .map_err(|_| {
            let stderr = String::from_utf8_lossy(&out.stderr);
            format!("Unexpected PS response: {trimmed}\n{stderr}")
        })?;

    if v.get("ok").and_then(|x| x.as_bool()).unwrap_or(false) {
        Ok(())
    } else {
        let err = v.get("error")
            .and_then(|x| x.as_str())
            .unwrap_or("Unknown error")
            .to_string();
        Err(err)
    }
}

/// Replaces agent ObjectIds (AAD GUIDs) with their corresponding display names.
/// Unresolved IDs are kept in abbreviated form (first 8 characters + "…").
fn enrich_agents(
    call_queues: &mut [CallQueue],
    user_id_to_name: &std::collections::HashMap<String, String>,
) {
    for cq in call_queues.iter_mut() {
        cq.agents = cq.agents.iter().map(|id| {
            user_id_to_name.get(id)
                .cloned()
                .unwrap_or_else(|| {
                    let s: String = id.chars().take(8).collect();
                    if id.len() > 8 { format!("{s}…") } else { s }
                })
        }).collect();
    }
}

fn enrich_distribution_lists(
    call_queues: &mut [CallQueue],
    group_id_to_name: &std::collections::HashMap<String, String>,
) {
    for cq in call_queues.iter_mut() {
        cq.distribution_lists = cq.distribution_lists.iter().map(|id| {
            group_id_to_name.get(id)
                .cloned()
                .unwrap_or_else(|| {
                    // If unresolved, truncate the GUID for display
                    let s: String = id.chars().take(8).collect();
                    if id.len() > 8 { format!("{s}…") } else { s }
                })
        }).collect();
    }
}

/// Computes resource_account_count and resource_account_licensed_count for each AutoAttendant.
/// Uses application_instances (UPN or ObjectId) cross-referenced against known resource accounts.
fn compute_resource_account_counts(
    data: &mut DashboardData,
    user_id_to_upn: &std::collections::HashMap<String, String>,
) {
    // Map UPN (lowercase) → is_licensed for resource accounts
    let ra_by_upn: std::collections::HashMap<String, bool> = data.resource_accounts.iter()
        .map(|r| (lower(&r.upn), r.licensed == "Oui"))
        .collect();

    for aa in data.auto_attendants.iter_mut() {
        if aa.application_instances.is_empty() {
            continue;
        }
        let mut count = 0i64;
        let mut licensed_count = 0i64;
        for inst in &aa.application_instances {
            count += 1;
            let inst_lower = lower(inst);
            // Try as a direct UPN
            let is_licensed = if let Some(&l) = ra_by_upn.get(&inst_lower) {
                Some(l)
            } else {
                // Try as an ObjectId → look up the corresponding UPN
                user_id_to_upn.get(inst).and_then(|upn| ra_by_upn.get(&lower(upn))).copied()
            };
            if let Some(true) = is_licensed {
                licensed_count += 1;
            }
        }
        aa.resource_account_count = count;
        aa.resource_account_licensed_count = licensed_count;
    }
}

pub async fn collect_all(client: &Client, token: &str, tenant_id: &str, client_id: &str, teams_token: Option<String>, client_secret: Option<String>) -> DashboardData {
    let mut data = DashboardData::default();
    let mut sku_id_map: std::collections::HashMap<String, String> = Default::default();
    let mut assigned_numbers_by_target: std::collections::HashMap<String, Vec<String>> = Default::default();
    // Maps built during user collection for CQ/AA enrichment
    let mut user_id_to_name:  std::collections::HashMap<String, String> = Default::default();
    let mut user_id_to_upn:   std::collections::HashMap<String, String> = Default::default();
    let mut group_id_to_name: std::collections::HashMap<String, String> = Default::default();

    match fetch_pages(client, token, &format!("{V1}/subscribedSkus")).await {
        Err(e) => data.errors.push(format!("Subscriptions: {e}")),
        Ok(skus) => {
            for s in &skus {
                let id = str_val(s, "skuId");
                let part = str_val(s, "skuPartNumber");
                if !id.is_empty() {
                    sku_id_map.insert(id.clone(), part.clone());
                }

                let enabled = s.get("prepaidUnits").and_then(|u| u.get("enabled")).and_then(|v| v.as_i64()).unwrap_or(0);
                let suspended = s.get("prepaidUnits").and_then(|u| u.get("suspended")).and_then(|v| v.as_i64()).unwrap_or(0);
                let consumed = i64_val(s, "consumedUnits");
                let available = enabled - consumed;
                let sku = str_val(s, "skuPartNumber");
                let is_free = is_free_subscription_sku(&sku);

                data.subscriptions.push(Subscription {
                    friendly_name: friendly_sku(&sku).to_string(),
                    sku,
                    sku_id: id,
                    purchased: enabled,
                    suspended,
                    consumed,
                    available,
                    status: compute_subscription_status(available, consumed, enabled, is_free),
                    is_free,
                });
            }
        }
    }

    match fetch_pages(client, token, &format!("{BETA}/admin/teams/telephoneNumberManagement/numberAssignments?$top=999")).await {
        Err(e) => {
            data.warnings.push(format!("Teams number inventory unavailable via numberAssignments API ({e}). Partial fallback to user data."));
        }
        Ok(assignments) => {
            for n in assignments {
                let telephone_number = str_val(&n, "telephoneNumber");
                let assignment_target_id = str_val(&n, "assignmentTargetId");
                let assignment_status = str_val(&n, "assignmentStatus");
                let capabilities = str_array(&n, "capabilities");

                if !assignment_target_id.is_empty() && !telephone_number.is_empty() && assignment_status != "unassigned" {
                    assigned_numbers_by_target.entry(assignment_target_id).or_default().push(telephone_number.clone());
                }

                if assignment_status == "unassigned" && capabilities.iter().any(|c| c == "userAssignment") {
                    data.free_numbers.push(FreeNumber {
                        number: telephone_number,
                        number_type: str_val(&n, "numberType"),
                        city: str_val(&n, "city"),
                        country: str_val(&n, "isoCountryCode"),
                        capability: capabilities.join(", "),
                        status: "Libre".into(),
                    });
                }
            }

            for nums in assigned_numbers_by_target.values_mut() {
                *nums = dedup_keep_order(std::mem::take(nums));
            }
        }
    }

    let user_url = format!("{V1}/users?$select=id,displayName,userPrincipalName,businessPhones,assignedLicenses,accountEnabled,usageLocation,userType&$top=999");
    match fetch_pages(client, token, &user_url).await {
        Err(e) => data.errors.push(format!("Users: {e}")),
        Ok(users) => {
            for u in &users {
                let user_id = str_val(u, "id");
                let upn = str_val(u, "userPrincipalName");
                let name = str_val(u, "displayName");
                let enabled = bool_val(u, "accountEnabled");
                // Feed the maps for CQ/AA enrichment
                if !user_id.is_empty() {
                    user_id_to_name.insert(user_id.clone(), name.clone());
                    user_id_to_upn.insert(user_id.clone(), upn.clone());
                }
                let location = str_val(u, "usageLocation");

                let lic_skus: Vec<String> = u
                    .get("assignedLicenses")
                    .and_then(|l| l.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|l| l.get("skuId")?.as_str())
                            .filter_map(|id| sku_id_map.get(id))
                            .cloned()
                            .collect()
                    })
                    .unwrap_or_default();

                let assigned_phones = assigned_numbers_by_target.get(&user_id).cloned().unwrap_or_default();
                let business_phones = str_array(u, "businessPhones");
                let phones = if !assigned_phones.is_empty() { assigned_phones.clone() } else { business_phones };

                let license_names = lic_skus.iter().map(|s| friendly_sku(s).to_string()).collect::<Vec<_>>();
                let phone_license_names = lic_skus.iter().filter(|s| is_phone_related_sku(s)).map(|s| friendly_sku(s).to_string()).collect::<Vec<_>>();
                let phone_number_display = if phones.is_empty() { "-".into() } else { dedup_keep_order(phones.clone()).join(", ") };

                // userType: "Guest" = external, "Member" (or absent) = internal
                let raw_user_type = str_val(u, "userType");
                let user_type_display: String = if raw_user_type.eq_ignore_ascii_case("Guest") {
                    "Externe".into()
                } else {
                    "Interne".into()
                };

                for sku in &lic_skus {
                    data.user_licenses.push(UserLicense {
                        display_name: name.clone(),
                        upn: upn.clone(),
                        sku_part_number: sku.clone(),
                        friendly_name: friendly_sku(sku).to_string(),
                        account_enabled: if enabled { "Oui".into() } else { "Non".into() },
                        user_type: user_type_display.clone(),
                    });
                }

                data.directory_users.push(DirectoryUser {
                    display_name: name.clone(),
                    upn: upn.clone(),
                    account_enabled: if enabled { "Oui".into() } else { "Non".into() },
                    usage_location: location,
                    licenses: license_names.join(", "),
                    phone_number: phone_number_display.clone(),
                    has_phone_license: if phone_license_names.is_empty() { "Non".into() } else { "Oui".into() },
                    user_type: user_type_display,
                });

                if !assigned_phones.is_empty() {
                    let phone_licenses = lic_skus
                        .iter()
                        .filter(|s| is_phone_related_sku(s))
                        .map(|s| friendly_sku(s).to_string())
                        .collect::<Vec<_>>()
                        .join(", ");

                    data.phone_users.push(PhoneUser {
                        display_name: name.clone(),
                        upn: upn.clone(),
                        phone_number: phone_number_display.clone(),
                        ev_enabled: if lic_skus.iter().any(|s| is_phone_related_sku(s)) { "Oui".into() } else { "Non".into() },
                        account_enabled: if enabled { "Oui".into() } else { "Non".into() },
                        usage_location: String::new(),
                        licenses: phone_licenses,
                    });
                }

                if let Some(account_type) = detect_resource_account_type(&name, &upn, &lic_skus) {
                    data.resource_accounts.push(ResourceAccount {
                        display_name: name.clone(),
                        upn: upn.clone(),
                        account_type,
                        phone_number: phone_number_display,
                        licensed: if lic_skus.iter().any(|s| s == "MCOEV_VIRTUALUSER" || s == "PHONESYSTEM_VIRTUALUSER") { "Oui".into() } else { "Non".into() },
                    });
                }

                let has_teams_number = !assigned_phones.is_empty();
                let phone_lics: Vec<String> = lic_skus
                    .iter()
                    .filter(|s| is_phone_related_sku(s) && *s != "MCOEV_VIRTUALUSER")
                    .cloned()
                    .collect();
                if !phone_lics.is_empty() && !has_teams_number && enabled {
                    data.orphan_licenses.push(OrphanLicense {
                        upn: upn.clone(),
                        display_name: name.clone(),
                        licenses: phone_lics.iter().map(|s| friendly_sku(s).to_string()).collect::<Vec<_>>().join(", "),
                        status: "Teams Phone license without assigned Teams number".into(),
                    });
                }
            }
        }
    }

    // Group resolution (distribution lists): GUID → displayName
    match fetch_pages(client, token, &format!("{V1}/groups?$select=id,displayName&$top=999")).await {
        Ok(groups) => {
            for g in &groups {
                if let (Some(id), Some(name)) = (
                    g.get("id").and_then(|v| v.as_str()),
                    g.get("displayName").and_then(|v| v.as_str()),
                ) {
                    group_id_to_name.insert(id.to_string(), name.to_string());
                }
            }
        }
        Err(_) => {} // non-blocking
    }

    // Fetch call queues and auto attendants via the PowerShell MicrosoftTeams module.
    // Preferred method: client_credentials (TEAMS_CLIENT_SECRET configured).
    // Fallback: delegated tokens (TEAMS_TOKEN / TEAMS_TOKEN2).
    // Runs invisibly (no PowerShell window).
    {
        let tok       = token.to_string();
        let tid       = tenant_id.to_string();
        let app_id    = client_id.to_string();
        let teams_tok = teams_token.clone();
        let client_sec = client_secret.clone();

        #[cfg(windows)]
        match tokio::task::spawn_blocking(move || {
            run_powershell_for_teams(&tok, &tid, &app_id, teams_tok.as_deref(), client_sec.as_deref())
        }).await {
            Ok(Ok((cqs, aas, diags))) => {
                data.call_queues = cqs;
                data.auto_attendants = aas;
                for d in diags {
                    data.warnings.push(format!("PowerShell Teams — {d}"));
                }
            }
            Ok(Err(e)) => {
                data.warnings.push(format!(
                    "PowerShell MicrosoftTeams module unavailable ({e}). Displaying from detected resource accounts."
                ));
            }
            Err(e) => {
                data.warnings.push(format!("PowerShell task error: {e}"));
            }
        }

        #[cfg(not(windows))]
        {
            // On macOS/Linux, PowerShell is not available by default.
            // CQ/AA tabs will be populated from resource accounts (fallback).
            let _ = (tok, tid, app_id, teams_tok, client_sec); // suppress unused variable warnings
            data.warnings.push(
                "PowerShell MicrosoftTeams module unavailable (Windows required). Displaying from detected resource accounts.".into()
            );
        }
    }

    merge_resource_based_queues(&mut data);
    merge_resource_based_attendants(&mut data);
    enrich_from_resource_accounts(&mut data);
    compute_deletability(&mut data);
    enrich_agents(&mut data.call_queues, &user_id_to_name);
    enrich_distribution_lists(&mut data.call_queues, &group_id_to_name);
    compute_resource_account_counts(&mut data, &user_id_to_upn);

    let known_resource_numbers: std::collections::HashSet<String> = data
        .resource_accounts
        .iter()
        .flat_map(|r| r.phone_number.split(','))
        .map(normalize_phone)
        .filter(|n| !n.is_empty() && n != "-")
        .collect();
    data.orphan_licenses.retain(|o| {
        let maybe_number = data
            .directory_users
            .iter()
            .find(|u| u.upn == o.upn)
            .map(|u| normalize_phone(&u.phone_number))
            .unwrap_or_default();
        maybe_number.is_empty() || !known_resource_numbers.contains(&maybe_number)
    });

    sort_case_insensitive_by(&mut data.directory_users, |x| &x.display_name);
    sort_case_insensitive_by(&mut data.phone_users, |x| &x.display_name);
    sort_case_insensitive_by(&mut data.free_numbers, |x| &x.number);
    sort_case_insensitive_by(&mut data.user_licenses, |x| &x.display_name);
    sort_case_insensitive_by(&mut data.subscriptions, |x| &x.friendly_name);
    sort_case_insensitive_by(&mut data.call_queues, |x| &x.name);
    sort_case_insensitive_by(&mut data.auto_attendants, |x| &x.name);
    sort_case_insensitive_by(&mut data.resource_accounts, |x| &x.display_name);
    sort_case_insensitive_by(&mut data.orphan_licenses, |x| &x.display_name);

    data
}
