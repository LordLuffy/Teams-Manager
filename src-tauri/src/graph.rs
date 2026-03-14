use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::process::{Command, Stdio};
use std::sync::OnceLock;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

// Détection unique de l'exécutable PowerShell optimal.
// PS7 (pwsh) est requis pour les DLL .NET 8+ du module MicrosoftTeams récent.
// On teste dans l'ordre : "pwsh" via PATH, puis les chemins d'installation connus.
static PS_EXE: OnceLock<String> = OnceLock::new();

fn ps_exe() -> &'static str {
    PS_EXE.get_or_init(|| {
        // Chemins à tester dans l'ordre — le PATH peut ne pas être hérité si Tauri
        // est lancé depuis un contexte qui n'a pas encore le PS7 PATH à jour.
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

/// Retourne l'exécutable PowerShell choisi (pour diagnostics UI).
pub fn ps_exe_name() -> &'static str {
    ps_exe()
}

const V1: &str = "https://graph.microsoft.com/v1.0";
const BETA: &str = "https://graph.microsoft.com/beta";

pub fn friendly_sku(sku: &str) -> &str {
    match sku {
        // Teams Phone
        "MCOEV"                      => "Microsoft Teams Phone Standard",
        "MCOEV_VIRTUALUSER"          => "Compte de ressources téléphoniques Microsoft Teams",
        "PHONESYSTEM_VIRTUALUSER"    => "Compte de ressources téléphoniques Microsoft Teams",
        "MCOPSTN1"                   => "Forfait d'appels nationaux Teams",
        "MCOPSTN2"                   => "Forfait d'appels internationaux Teams",
        "MCOPSTN_5"                  => "Forfait d'appels à la minute Teams",
        "MCOPSTNC"                   => "Crédits de communication Teams",
        "MCOCAP"                     => "Teams Shared Devices",
        "MCOMEETADV"                 => "Microsoft 365 Audioconférence",
        "MCOSTANDARD"                => "Skype Entreprise Online (plan 2)",
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
        "POWER_BI_PREMIUM_PER_USER"  => "Power BI Premium par utilisateur",
        "POWER_BI_STANDARD"          => "Power BI (gratuit)",
        "FLOW_FREE"                  => "Microsoft Power Automate Free",
        "POWERAPPS_DEV"              => "Microsoft Power Apps for Developer",
        "POWERAPPS_VIRAL"            => "Microsoft Power Apps Plan 2 (essai)",
        "MICROSOFT_FABRIC_FREE"      => "Microsoft Fabric (gratuit)",
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
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct Subscription {
    pub friendly_name: String,
    pub sku: String,
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
    pub timeout_action: String,
    pub overflow_action: String,
    pub phone_number: String,
    pub can_be_deleted: String,
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
            return Err(format!("HTTP {st} depuis {u}: {body}"));
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

fn compute_subscription_status(available: i64, is_free: bool) -> String {
    if available < 0 {
        "DEPASSEMENT".into()
    } else if is_free {
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
    for ra in data.resource_accounts.iter().filter(|r| r.account_type == "Call Queue") {
        if !existing.contains(&lower(&ra.display_name)) {
            data.call_queues.push(CallQueue {
                name: ra.display_name.clone(),
                language: "N/A".into(),
                routing_method: "N/A".into(),
                agent_count: 0,
                timeout_action: "N/A".into(),
                overflow_action: "N/A".into(),
                phone_number: ra.phone_number.clone(),
                can_be_deleted: String::new(),
            });
        }
    }
}

fn merge_resource_based_attendants(data: &mut DashboardData) {
    let existing: std::collections::HashSet<String> = data.auto_attendants.iter().map(|q| lower(&q.name)).collect();
    for ra in data.resource_accounts.iter().filter(|r| r.account_type == "Auto Attendant") {
        if !existing.contains(&lower(&ra.display_name)) {
            data.auto_attendants.push(AutoAttendant {
                name: ra.display_name.clone(),
                language: "N/A".into(),
                time_zone: "N/A".into(),
                phone_number: ra.phone_number.clone(),
                status: "Actif".into(),
                can_be_deleted: String::new(),
            });
        }
    }
}

/// Complète les numéros de téléphone manquants pour les CQ/AA
/// en croisant avec les comptes ressources déjà récupérés via Graph.
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

/// Calcule le champ can_be_deleted pour toutes les files d'attente et standards automatiques.
/// File d'attente : supprimable si aucun agent ET aucun numéro attribué.
/// Standard automatique : supprimable si aucun numéro attribué.
fn compute_deletability(data: &mut DashboardData) {
    for cq in data.call_queues.iter_mut() {
        let no_phone = cq.phone_number.is_empty() || cq.phone_number == "-";
        cq.can_be_deleted = if no_phone && cq.agent_count == 0 {
            "Oui".into()
        } else {
            "Non".into()
        };
    }
    for aa in data.auto_attendants.iter_mut() {
        let no_phone = aa.phone_number.is_empty() || aa.phone_number == "-";
        aa.can_be_deleted = if no_phone { "Oui".into() } else { "Non".into() };
    }
}

// Script PowerShell de vérification/installation du module MicrosoftTeams.
// Sur PS5 : avertit que PS7 est requis.
// Sur PS7 : importe le module (direct path si nécessaire), installe uniquement si absent.
// Évite Install-Module -Force si le module est déjà présent (prévient les conflits OneDrive).
const PS_CHECK_SCRIPT: &str = r#"
$ProgressPreference = 'SilentlyContinue'
$WarningPreference  = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Teams PS module (v5+) embarque des DLL .NET 8 incompatibles avec PS 5.1 (.NET Framework 4.x).
if ($PSVersionTable.PSVersion.Major -lt 7) {
    'ps5: PowerShell 7 (pwsh) est requis pour le module MicrosoftTeams. Installez-le depuis https://aka.ms/powershell'
    exit
}

# Essai d'import standard
$importOk = $false
try {
    Import-Module MicrosoftTeams -ErrorAction Stop -WarningAction SilentlyContinue 3>$null
    $importOk = $true
} catch { }

if ($importOk) { 'ok'; exit }

# Import échoué : chercher le module déjà installé et tenter un import par chemin direct
# (évite de forcer une réinstallation si les fichiers sont verrouillés par OneDrive)
$existing = Get-Module -ListAvailable -Name MicrosoftTeams -ErrorAction SilentlyContinue |
            Sort-Object Version -Descending | Select-Object -First 1
if ($existing) {
    try {
        $psd1 = Join-Path $existing.ModuleBase 'MicrosoftTeams.psd1'
        Import-Module $psd1 -Force -ErrorAction Stop -WarningAction SilentlyContinue 3>$null
        'ok'; exit
    } catch { }
}

# Module absent : installation depuis PSGallery
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
        'error: Accès refusé (OneDrive verrouille les fichiers du module). Installez manuellement : Install-Module MicrosoftTeams -Scope AllUsers'
    } else {
        'error: ' + $errMsg
    }
}
"#;

/// Exécute le script de vérification/installation du module MicrosoftTeams.
/// Retourne "ok" si le module est déjà fonctionnel, "installed" après installation réussie,
/// ou une erreur en cas d'échec.
/// Fonction bloquante — à appeler via spawn_blocking ou std::thread::spawn.
pub fn run_ps_module_install() -> Result<String, String> {
    let temp_path = std::env::temp_dir().join("teams_check_module.ps1");
    std::fs::write(&temp_path, PS_CHECK_SCRIPT.as_bytes())
        .map_err(|e| format!("Impossible d'écrire le script de vérification : {e}"))?;
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
        format!("Lancement PowerShell impossible : {e}")
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

/// Version pour le thread de démarrage : loggue le résultat sans retourner de valeur.
pub fn check_ps_module() {
    crate::logger::info(&format!("Exécutable PowerShell détecté : {}", ps_exe()));
    match run_ps_module_install() {
        Ok(s) if s == "installed" => crate::logger::info("Module PowerShell MicrosoftTeams installé avec succès."),
        Ok(_)  => crate::logger::info("Module PowerShell MicrosoftTeams : OK."),
        Err(e) => crate::logger::warn(&format!("check_ps_module : {e}")),
    }
}

// Script PowerShell embarqué — utilise le module MicrosoftTeams.
// Si TEAMS_TOKEN2 est fourni (token service Teams), il est passé en second pour accès complet.
// Exécuté de façon invisible (CREATE_NO_WINDOW + -WindowStyle Hidden).
const PS_SCRIPT: &str = r#"
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$WarningPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Info de version pour diagnostics — visible dans les warnings de l'UI
$psVer = "$($PSVersionTable.PSVersion.Major).$($PSVersionTable.PSVersion.Minor)"

try {
    # Import standard, avec fallback par chemin direct (cas OneDrive/PSModulePath non configuré)
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
            throw "Module MicrosoftTeams introuvable. Utilisez l'onglet CQ/AA pour l'installer."
        }
    }

    # Version du module pour diagnostic (incluse dans le JSON de sortie)
    $teamsModVer = (Get-Module MicrosoftTeams -ErrorAction SilentlyContinue).Version
    if (-not $teamsModVer) {
        $teamsModVer = (Get-Module -ListAvailable -Name MicrosoftTeams -ErrorAction SilentlyContinue |
                        Sort-Object Version -Descending | Select-Object -First 1).Version
    }
    $teamsModVerStr = if ($teamsModVer) { [string]$teamsModVer } else { 'unknown' }

    $graphToken  = $env:TEAMS_TOKEN
    $teamsToken  = $env:TEAMS_TOKEN2
    $hasTeams    = $teamsToken -and $teamsToken -ne ''

    # Selon la doc Connect-MicrosoftTeams v5+ : format @(TeamsToken, GraphToken).
    # On essaie aussi l'ordre inverse et le token seul en fallback.
    $combos = @()
    if ($hasTeams) {
        $combos += ,@($teamsToken, $graphToken)   # Teams first (doc v5+)
        $combos += ,@($graphToken, $teamsToken)   # Graph first (doc v4)
        $combos += ,@($teamsToken)                # Teams seul
    }
    $combos += ,@($graphToken)                    # Graph seul en dernier recours

    $connectOk  = $false
    $connectErr = ''
    foreach ($toks in $combos) {
        foreach ($envParam in @('Commercial', '')) {
            try {
                if ($envParam -ne '') {
                    Connect-MicrosoftTeams -TenantId $env:TEAMS_TENANT -AccessTokens $toks -Environment $envParam -ErrorAction Stop -WarningAction SilentlyContinue | Out-Null
                } else {
                    Connect-MicrosoftTeams -TenantId $env:TEAMS_TENANT -AccessTokens $toks -ErrorAction Stop -WarningAction SilentlyContinue | Out-Null
                }
                $connectOk = $true
                break
            } catch {
                $connectErr = [string]$_.Exception.Message
            }
        }
        if ($connectOk) { break }
    }
    if (-not $connectOk) {
        throw "Connexion Teams PS échouée (module $teamsModVerStr) : $connectErr"
    }

    $cqError = ''
    $cqs = @()
    try {
        $rawCqs = Get-CsCallQueue -ErrorAction Stop -WarningAction SilentlyContinue 3>$null
        if ($rawCqs) {
            $cqs = @($rawCqs | ForEach-Object {
                $lu = if ($_.LineUri) { $_.LineUri -replace '^tel:', '' } else { '-' }
                @{
                    name           = [string]$_.Name
                    language       = if ($_.Language) { [string]$_.Language } else { 'N/A' }
                    routingMethod  = if ($_.RoutingMethod) { [string]$_.RoutingMethod } else { 'N/A' }
                    agentCount     = [int]($_.Agents | Measure-Object).Count
                    timeoutAction  = if ($_.TimeoutAction) { [string]$_.TimeoutAction } else { 'N/A' }
                    overflowAction = if ($_.OverflowAction) { [string]$_.OverflowAction } else { 'N/A' }
                    phoneNumber    = $lu
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
                @{
                    name       = [string]$_.Name
                    language   = if ($_.LanguageId) { [string]$_.LanguageId } else { 'N/A' }
                    timeZoneId = if ($_.TimeZoneId) { [string]$_.TimeZoneId } else { 'N/A' }
                    phoneNumber = '-'
                    status     = 'Actif'
                }
            })
        }
    } catch { $aaError = [string]$_.Exception.Message }

    # Sérialisation manuelle pour éviter le problème PS5 avec les tableaux à 1 élément
    $cqsJson = if ($cqs.Count -eq 0) { '[]' }
               elseif ($cqs.Count -eq 1) { '[' + ($cqs[0] | ConvertTo-Json -Compress) + ']' }
               else { ConvertTo-Json -InputObject $cqs -Depth 3 -Compress }

    $aasJson = if ($aas.Count -eq 0) { '[]' }
               elseif ($aas.Count -eq 1) { '[' + ($aas[0] | ConvertTo-Json -Compress) + ']' }
               else { ConvertTo-Json -InputObject $aas -Depth 3 -Compress }

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

/// Exécute le module PowerShell MicrosoftTeams en tâche de fond (sans fenêtre)
/// pour récupérer les files d'attente et standards automatiques.
/// graph_token : token Graph (requis)
/// teams_token : token service Teams 48ac35b8-... (optionnel, améliore l'accès aux cmdlets)
/// Retourne (call_queues, auto_attendants, diagnostics) — les diagnostics sont des warnings.
fn run_powershell_for_teams(graph_token: &str, tenant_id: &str, teams_token: Option<&str>) -> Result<(Vec<CallQueue>, Vec<AutoAttendant>, Vec<String>), String> {
    let temp_path = std::env::temp_dir().join("teams_analysis_fetch.ps1");
    std::fs::write(&temp_path, PS_SCRIPT.as_bytes())
        .map_err(|e| format!("Impossible d'écrire le script temporaire : {e}"))?;
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
    .stdout(Stdio::piped())
    .stderr(Stdio::piped());

    #[cfg(windows)]
    cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW

    crate::logger::info(&format!("PS fetch : lancement via {}", ps_exe()));

    let output = cmd.output().map_err(|e| {
        let _ = std::fs::remove_file(&temp_path);
        format!("Lancement PowerShell impossible : {e}")
    })?;
    let _ = std::fs::remove_file(&temp_path);

    crate::logger::info(&format!("PS fetch : exit={} stdout_len={} stderr_len={}",
        output.status, output.stdout.len(), output.stderr.len()));

    let raw = String::from_utf8_lossy(&output.stdout).to_string();

    // Log les 500 premiers caractères de stdout pour diagnostic
    let preview = raw.chars().take(500).collect::<String>().replace('\n', "↵");
    crate::logger::info(&format!("PS fetch stdout (500c) : {preview}"));

    let stderr_raw = String::from_utf8_lossy(&output.stderr).to_string();
    if !stderr_raw.trim().is_empty() {
        let err_preview = stderr_raw.chars().take(300).collect::<String>().replace('\n', "↵");
        crate::logger::warn(&format!("PS fetch stderr : {err_preview}"));
    }

    // On prend la dernière ligne qui ressemble à du JSON
    let json_str = raw
        .lines()
        .rev()
        .find(|l| l.trim_start().starts_with('{'))
        .ok_or_else(|| {
            let hint = stderr_raw.lines().last().unwrap_or("").trim().to_string();
            let err = if hint.is_empty() {
                "Aucun JSON retourné par PowerShell (module MicrosoftTeams non installé ?)".to_string()
            } else {
                format!("Aucun JSON retourné par PowerShell : {hint}")
            };
            crate::logger::warn(&format!("PS fetch : {err}"));
            err
        })?;

    let json: Value = serde_json::from_str(json_str.trim())
        .map_err(|e| format!("JSON PowerShell invalide : {e}"))?;

    let ps_ver = str_val(&json, "psVer");
    let mod_ver = str_val(&json, "modVer");
    let ps_exe_used = ps_exe();

    if !json.get("success").and_then(|v| v.as_bool()).unwrap_or(false) {
        let err = str_val(&json, "error");
        let full = format!("{err} [PS {ps_ver} via {ps_exe_used}, module {mod_ver}]");
        crate::logger::warn(&format!("PS fetch error : {full}"));
        return Err(full);
    }

    let mut diagnostics = Vec::new();
    // Toujours afficher quelle version PS a exécuté le script
    if !ps_ver.is_empty() {
        diagnostics.push(format!("PowerShell {ps_ver} ({ps_exe_used})"));
    }
    let cq_err = str_val(&json, "cqError");
    let aa_err = str_val(&json, "aaError");
    if !cq_err.is_empty() {
        crate::logger::warn(&format!("PS Get-CsCallQueue error : {cq_err}"));
        diagnostics.push(format!("Get-CsCallQueue : {cq_err}"));
    }
    if !aa_err.is_empty() {
        crate::logger::warn(&format!("PS Get-CsAutoAttendant error : {aa_err}"));
        diagnostics.push(format!("Get-CsAutoAttendant : {aa_err}"));
    }

    let mut cqs = Vec::new();
    if let Some(arr) = json.get("callQueues").and_then(|v| v.as_array()) {
        for q in arr {
            cqs.push(CallQueue {
                name:            str_val(q, "name"),
                language:        str_val(q, "language"),
                routing_method:  str_val(q, "routingMethod"),
                agent_count:     q.get("agentCount").and_then(|v| v.as_i64()).unwrap_or(0),
                timeout_action:  str_val(q, "timeoutAction"),
                overflow_action: str_val(q, "overflowAction"),
                phone_number:    str_val(q, "phoneNumber"),
                can_be_deleted:  String::new(),
            });
        }
    }

    let mut aas = Vec::new();
    if let Some(arr) = json.get("autoAttendants").and_then(|v| v.as_array()) {
        for a in arr {
            aas.push(AutoAttendant {
                name:          str_val(a, "name"),
                language:      str_val(a, "language"),
                time_zone:     str_val(a, "timeZoneId"),
                phone_number:  str_val(a, "phoneNumber"),
                status:        str_val(a, "status"),
                can_be_deleted: String::new(),
            });
        }
    }

    Ok((cqs, aas, diagnostics))
}

pub async fn collect_all(client: &Client, token: &str, tenant_id: &str, teams_token: Option<String>) -> DashboardData {
    let mut data = DashboardData::default();
    let mut sku_id_map: std::collections::HashMap<String, String> = Default::default();
    let mut assigned_numbers_by_target: std::collections::HashMap<String, Vec<String>> = Default::default();

    match fetch_pages(client, token, &format!("{V1}/subscribedSkus")).await {
        Err(e) => data.errors.push(format!("Abonnements : {e}")),
        Ok(skus) => {
            for s in &skus {
                let id = str_val(s, "skuId");
                let part = str_val(s, "skuPartNumber");
                if !id.is_empty() {
                    sku_id_map.insert(id, part.clone());
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
                    purchased: enabled,
                    suspended,
                    consumed,
                    available,
                    status: compute_subscription_status(available, is_free),
                    is_free,
                });
            }
        }
    }

    match fetch_pages(client, token, &format!("{BETA}/admin/teams/telephoneNumberManagement/numberAssignments?$top=999")).await {
        Err(e) => {
            data.warnings.push(format!("Inventaire des numéros Teams indisponible via l'API numberAssignments ({e}). Repli partiel sur les données utilisateur."));
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

    let user_url = format!("{V1}/users?$select=id,displayName,userPrincipalName,businessPhones,assignedLicenses,accountEnabled,usageLocation&$top=999");
    match fetch_pages(client, token, &user_url).await {
        Err(e) => data.errors.push(format!("Utilisateurs : {e}")),
        Ok(users) => {
            for u in &users {
                let user_id = str_val(u, "id");
                let upn = str_val(u, "userPrincipalName");
                let name = str_val(u, "displayName");
                let enabled = bool_val(u, "accountEnabled");
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

                for sku in &lic_skus {
                    data.user_licenses.push(UserLicense {
                        display_name: name.clone(),
                        upn: upn.clone(),
                        sku_part_number: sku.clone(),
                        friendly_name: friendly_sku(sku).to_string(),
                        account_enabled: if enabled { "Oui".into() } else { "Non".into() },
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
                        status: "Licence Teams Phone sans numéro Teams affecté".into(),
                    });
                }
            }
        }
    }

    // Récupération des files d'attente et standards automatiques via PowerShell MicrosoftTeams.
    // Utilise le token Graph + token service Teams si disponible (meilleur accès aux cmdlets).
    // L'exécution est invisible (pas de fenêtre PowerShell).
    {
        let tok = token.to_string();
        let tid = tenant_id.to_string();
        let teams_tok = teams_token.clone();
        match tokio::task::spawn_blocking(move || {
            run_powershell_for_teams(&tok, &tid, teams_tok.as_deref())
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
                    "Module PowerShell MicrosoftTeams indisponible ({e}). Affichage à partir des comptes ressources détectés."
                ));
            }
            Err(e) => {
                data.warnings.push(format!("Erreur tâche PowerShell : {e}"));
            }
        }
    }

    merge_resource_based_queues(&mut data);
    merge_resource_based_attendants(&mut data);
    enrich_from_resource_accounts(&mut data);
    compute_deletability(&mut data);

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
