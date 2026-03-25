mod auth;
mod graph;
mod logger;
mod updater;

use keyring::Entry;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::Mutex;
use tauri::Manager;

/// Shared application state on the backend side.
#[derive(Debug, Default)]
pub struct AppState {
    pub token: Mutex<Option<auth::TokenSet>>,
    pub tenant_id: Mutex<String>,
    pub client_id: Mutex<String>,
    pub client_secret: Mutex<String>,
}

/// IPC structure (exchanged with the frontend). All fields are included during
/// serialization so the frontend can read values loaded from the credential vault.
/// Disk storage does NOT use this struct directly.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub tenant_id: String,
    pub client_id: String,
    pub log_path: Option<String>,
    pub client_secret: Option<String>,
}

/// Minimal structure written to disk (config.json).
/// Contains only non-sensitive settings.
#[derive(Debug, Serialize, Deserialize, Default)]
struct DiskConfig {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub log_path: Option<String>,
}

fn config_path(app: &AppHandle) -> std::path::PathBuf {
    app.path()
        .app_config_dir()
        .expect("app config dir")
        .join("config.json")
}

// ─── Service Keyring ────────────────────────────────────────────────────────

/// Single service used for all secure configuration.
const CFG_SERVICE: &str = "teams-manager-config";
/// Service used for refresh tokens (chunks).
const TOKEN_SERVICE: &str = "teams-license-telephony-manager";
const TOKEN_CHUNK_SIZE: usize = 1000;

fn keyring_save(account: &str, value: &str) -> Result<(), String> {
    let entry = Entry::new(CFG_SERVICE, account)
        .map_err(|e| format!("Credential vault init ({account}): {e}"))?;
    entry
        .set_password(value)
        .map_err(|e| format!("Credential vault write ({account}): {e}"))
}

fn keyring_load(account: &str) -> Option<String> {
    let entry = Entry::new(CFG_SERVICE, account).ok()?;
    match entry.get_password() {
        Ok(s) if !s.is_empty() => Some(s),
        _ => None,
    }
}

fn keyring_delete(account: &str) {
    if let Ok(entry) = Entry::new(CFG_SERVICE, account) {
        let _ = entry.delete_credential();
    }
}

// ─── Secure token (refresh token in multiple chunks) ────────────────────────

fn token_account(tenant_id: &str, client_id: &str) -> String {
    let tenant = if tenant_id.trim().is_empty() { "default-tenant" } else { tenant_id.trim() };
    let client = if client_id.trim().is_empty() { "default-client" } else { client_id.trim() };
    format!("{}::{}", tenant, client)
}

fn split_for_windows_keyring(input: &str, max_utf16_units: usize) -> Vec<String> {
    let mut chunks = Vec::new();
    let mut current = String::new();
    let mut current_units = 0usize;
    for ch in input.chars() {
        let ch_units = ch.len_utf16();
        if current_units + ch_units > max_utf16_units && !current.is_empty() {
            chunks.push(current);
            current = String::new();
            current_units = 0;
        }
        current.push(ch);
        current_units += ch_units;
    }
    if !current.is_empty() {
        chunks.push(current);
    }
    chunks
}

fn save_token_secure(tenant_id: &str, client_id: &str, token: &auth::TokenSet) -> Result<(), String> {
    let refresh = token
        .refresh_token
        .as_ref()
        .ok_or("No refresh token returned by Microsoft.")?;

    let base_account = token_account(tenant_id, client_id);
    let _ = delete_token_secure(tenant_id, client_id);
    let chunks = split_for_windows_keyring(refresh, TOKEN_CHUNK_SIZE);

    let meta_entry = Entry::new(TOKEN_SERVICE, &format!("{}::count", base_account))
        .map_err(|e| format!("Credential vault init (meta token): {e}"))?;
    meta_entry
        .set_password(&chunks.len().to_string())
        .map_err(|e| format!("Credential vault write (meta token): {e}"))?;

    for (idx, chunk) in chunks.iter().enumerate() {
        let entry = Entry::new(TOKEN_SERVICE, &format!("{}::part::{}", base_account, idx))
            .map_err(|e| format!("Credential vault init (token part {idx}): {e}"))?;
        entry
            .set_password(chunk)
            .map_err(|e| format!("Credential vault write (token part {idx}): {e}"))?;
    }

    logger::info("Refresh token stored in system credential vault.");
    Ok(())
}

fn load_token_secure(tenant_id: &str, client_id: &str) -> Result<Option<String>, String> {
    let base_account = token_account(tenant_id, client_id);
    let meta_entry = Entry::new(TOKEN_SERVICE, &format!("{}::count", base_account))
        .map_err(|e| format!("Credential vault init (meta token): {e}"))?;

    let count_raw = match meta_entry.get_password() {
        Ok(v) => v,
        Err(keyring::Error::NoEntry) => return Ok(None),
        Err(e) => return Err(format!("Credential vault read (meta token): {e}")),
    };

    let count: usize = count_raw
        .parse()
        .map_err(|e| format!("Invalid token segment count: {e}"))?;

    let mut refresh = String::new();
    for idx in 0..count {
        let entry = Entry::new(TOKEN_SERVICE, &format!("{}::part::{}", base_account, idx))
            .map_err(|e| format!("Credential vault init (token part {idx}): {e}"))?;

        let chunk = match entry.get_password() {
            Ok(v) => v,
            Err(keyring::Error::NoEntry) => return Err(format!("Missing token segment: {idx}")),
            Err(e) => return Err(format!("Credential vault read (token part {idx}): {e}")),
        };
        refresh.push_str(&chunk);
    }

    Ok(Some(refresh))
}

fn delete_token_secure(tenant_id: &str, client_id: &str) -> Result<(), String> {
    let base_account = token_account(tenant_id, client_id);
    let meta_entry = Entry::new(TOKEN_SERVICE, &format!("{}::count", base_account))
        .map_err(|e| format!("Credential vault init (meta token delete): {e}"))?;

    let count = match meta_entry.get_password() {
        Ok(v) => v.parse::<usize>().unwrap_or(0),
        Err(keyring::Error::NoEntry) => 0,
        Err(e) => return Err(format!("Credential vault read (before delete): {e}")),
    };

    for idx in 0..count {
        let entry = Entry::new(TOKEN_SERVICE, &format!("{}::part::{}", base_account, idx))
            .map_err(|e| format!("Credential vault init (delete part {idx}): {e}"))?;
        match entry.delete_credential() {
            Ok(_) | Err(keyring::Error::NoEntry) => {}
            Err(e) => return Err(format!("Credential vault delete (part {idx}): {e}")),
        }
    }

    match meta_entry.delete_credential() {
        Ok(_) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("Credential vault delete (meta token): {e}")),
    }
}

// ─── Configuration loading / saving ─────────────────────────────────────────

#[tauri::command]
async fn load_config(app: AppHandle, state: State<'_, Arc<AppState>>) -> Result<Option<AppConfig>, String> {
    // 1. Read non-sensitive settings from disk (log_path only).
    let config_file = config_path(&app);
    let disk: DiskConfig = if config_file.exists() {
        let text = std::fs::read_to_string(&config_file)
            .map_err(|e| format!("Failed to read config.json: {e}"))?;
        serde_json::from_str(&text).unwrap_or_default()
    } else {
        DiskConfig::default()
    };

    // 2. Read credentials from the Windows Credential Manager.
    let mut tenant_id = keyring_load("tenant_id").unwrap_or_default();
    let mut client_id = keyring_load("client_id").unwrap_or_default();
    let mut client_secret = keyring_load("client_secret");

    // 3. Transparent migration: if the old config.json still contains tenant/client,
    //    move them to the credential vault and rewrite the file without those fields.
    if tenant_id.is_empty() || client_id.is_empty() {
        if config_file.exists() {
            #[derive(Deserialize, Default)]
            struct OldConfig {
                #[serde(default)]
                tenant_id: String,
                #[serde(default)]
                client_id: String,
                #[serde(default)]
                log_path: Option<String>,
            }

            if let Ok(text) = std::fs::read_to_string(&config_file) {
                if let Ok(old) = serde_json::from_str::<OldConfig>(&text) {
                    if !old.tenant_id.is_empty() && !old.client_id.is_empty() {
                        logger::info("Migrating Azure AD credentials to Windows Credential Manager.");
                        let _ = keyring_save("tenant_id", &old.tenant_id);
                        let _ = keyring_save("client_id", &old.client_id);
                        tenant_id = old.tenant_id.clone();
                        client_id = old.client_id.clone();

                        // Migrate the old secret format (account derived from tenant+client).
                        if client_secret.is_none() {
                            const OLD_SECRET_SERVICE: &str = "teams-license-telephony-manager-secret";
                            let old_account = format!("{}::{}::client_secret", old.tenant_id.trim(), old.client_id.trim());
                            if let Ok(entry) = Entry::new(OLD_SECRET_SERVICE, &old_account) {
                                if let Ok(s) = entry.get_password() {
                                    if !s.is_empty() {
                                        let _ = keyring_save("client_secret", &s);
                                        client_secret = Some(s);
                                        let _ = entry.delete_credential();
                                        logger::info("Client secret migrated to new credential vault.");
                                    }
                                }
                            }
                        }

                        // Rewrite config.json without sensitive fields.
                        let new_disk = DiskConfig { log_path: old.log_path };
                        if let Ok(json) = serde_json::to_string_pretty(&new_disk) {
                            let _ = std::fs::write(&config_file, json);
                        }
                    }
                }
            }
        }
    }

    if tenant_id.is_empty() || client_id.is_empty() {
        logger::info("No configuration found in credential vault.");
        return Ok(None);
    }

    // 4. Update the in-memory state.
    *state.tenant_id.lock().await = tenant_id.clone();
    *state.client_id.lock().await = client_id.clone();
    *state.client_secret.lock().await = client_secret.clone().unwrap_or_default();

    // 5. Attempt to restore the session from the refresh token.
    match load_token_secure(&tenant_id, &client_id) {
        Ok(Some(refresh)) => {
            let http = reqwest::Client::new();
            match auth::refresh_access_token(&http, &tenant_id, &client_id, &refresh).await {
                Ok(token) => {
                    *state.token.lock().await = Some(token);
                    logger::info("Session restored from refresh token.");
                }
                Err(e) => {
                    logger::warn(&format!("Failed to restore session at startup: {e}"));
                }
            }
        }
        Ok(None) => logger::info("No secure refresh token available."),
        Err(e) => logger::warn(&format!("Error loading secure token: {e}")),
    }

    Ok(Some(AppConfig {
        tenant_id,
        client_id,
        client_secret,
        log_path: disk.log_path,
    }))
}

#[tauri::command]
async fn save_config(app: AppHandle, config: AppConfig, state: State<'_, Arc<AppState>>) -> Result<(), String> {
    // 1. Store sensitive credentials in the credential vault.
    keyring_save("tenant_id", config.tenant_id.trim())?;
    keyring_save("client_id", config.client_id.trim())?;

    match config.client_secret.as_deref() {
        Some(s) if !s.trim().is_empty() => {
            keyring_save("client_secret", s.trim())?;
            logger::info("Client secret saved to system credential vault.");
        }
        Some(_) => {
            // Empty string = user cleared the secret: delete it.
            keyring_delete("client_secret");
            logger::info("Client secret deleted from system credential vault.");
        }
        None => {
            // None = field absent: keep existing entry (defensive case).
        }
    }

    // 2. Write only log_path to disk (config.json contains nothing sensitive).
    let disk = DiskConfig { log_path: config.log_path.clone() };
    let path = config_path(&app);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create config directory: {e}"))?;
    }
    let text = serde_json::to_string_pretty(&disk)
        .map_err(|e| format!("Failed to serialize config: {e}"))?;
    std::fs::write(&path, text)
        .map_err(|e| format!("Failed to write config.json: {e}"))?;

    // 3. Handle tenant / client change (invalidate existing token).
    let old_tenant = state.tenant_id.lock().await.clone();
    let old_client = state.client_id.lock().await.clone();
    let tenant_changed = !old_tenant.is_empty()
        && !old_client.is_empty()
        && (old_tenant != config.tenant_id.trim() || old_client != config.client_id.trim());
    if tenant_changed {
        let _ = delete_token_secure(&old_tenant, &old_client);
        *state.token.lock().await = None;
    }

    // 4. Update the in-memory state.
    *state.tenant_id.lock().await = config.tenant_id.trim().to_string();
    *state.client_id.lock().await = config.client_id.trim().to_string();
    if let Some(s) = &config.client_secret {
        if !s.trim().is_empty() {
            *state.client_secret.lock().await = s.trim().to_string();
        }
    }

    // 5. Apply a custom log path at runtime if changed.
    if let Some(lp) = &config.log_path {
        if !lp.trim().is_empty() {
            let _ = logger::set_custom_path(lp.trim());
        }
    }

    logger::info("Configuration saved.");
    Ok(())
}

// ─── Authentication commands ─────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DeviceCodeResult {
    pub user_code: String,
    pub verification_uri: String,
    pub message: String,
    pub interval: u64,
    pub device_code: String,
}

#[tauri::command]
async fn start_auth(state: State<'_, Arc<AppState>>) -> Result<DeviceCodeResult, String> {
    let tenant_id = state.tenant_id.lock().await.clone();
    let client_id = state.client_id.lock().await.clone();
    if tenant_id.is_empty() || client_id.is_empty() {
        return Err("Tenant ID and Client ID are required.".into());
    }
    let http = reqwest::Client::new();
    let dc = auth::start_device_code(&http, &tenant_id, &client_id).await?;
    logger::info("Starting device code flow.");
    Ok(DeviceCodeResult {
        user_code: dc.user_code,
        verification_uri: dc.verification_uri,
        message: dc.message,
        interval: dc.interval,
        device_code: dc.device_code,
    })
}

#[tauri::command]
async fn poll_auth(device_code: String, interval: u64, app: AppHandle, state: State<'_, Arc<AppState>>) -> Result<bool, String> {
    let tenant_id = state.tenant_id.lock().await.clone();
    let client_id = state.client_id.lock().await.clone();
    let http = reqwest::Client::new();
    let state_arc = state.inner().clone();

    tokio::spawn(async move {
        match auth::poll_token(&http, &tenant_id, &client_id, &device_code, interval).await {
            Ok(token_set) => {
                *state_arc.token.lock().await = Some(token_set.clone());
                if let Err(e) = save_token_secure(&tenant_id, &client_id, &token_set) {
                    logger::warn(&format!("Failed to save refresh token: {e}"));
                }
                logger::info("Microsoft authentication successful.");
                let _ = app.emit("auth-ok", ());
            }
            Err(e) => {
                logger::error(&format!("Microsoft authentication failed: {e}"));
                let _ = app.emit("auth-error", e);
            }
        }
    });

    Ok(true)
}

#[tauri::command]
async fn get_auth_status(state: State<'_, Arc<AppState>>) -> Result<bool, String> {
    Ok(state.token.lock().await.is_some())
}

#[tauri::command]
async fn disconnect(state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let tenant_id = state.tenant_id.lock().await.clone();
    let client_id = state.client_id.lock().await.clone();
    *state.token.lock().await = None;
    if !tenant_id.is_empty() && !client_id.is_empty() {
        delete_token_secure(&tenant_id, &client_id)?;
    }
    logger::info("User signed out.");
    Ok(())
}

// ─── Main Graph data collection command ──────────────────────────────────────

#[tauri::command]
async fn fetch_data(state: State<'_, Arc<AppState>>) -> Result<graph::DashboardData, String> {
    let current = {
        let token_guard = state.token.lock().await;
        token_guard.as_ref().cloned().ok_or("Not authenticated. Please sign in.")?
    };

    let tenant_id = state.tenant_id.lock().await.clone();
    let client_id = state.client_id.lock().await.clone();

    let usable_access_token = if current.is_expired() {
        let refresh = current.refresh_token.clone().ok_or("Session expired and no refresh token available.")?;
        let http = reqwest::Client::new();
        let refreshed = auth::refresh_access_token(&http, &tenant_id, &client_id, &refresh).await?;

        if let Err(e) = save_token_secure(&tenant_id, &client_id, &refreshed) {
            logger::warn(&format!("Failed to save refreshed token: {e}"));
        }
        {
            let mut token_guard = state.token.lock().await;
            *token_guard = Some(refreshed.clone());
        }
        logger::info("Access token refreshed.");
        refreshed.access_token
    } else {
        current.access_token
    };

    let http = reqwest::Client::new();

    let client_secret = {
        let s = state.client_secret.lock().await.clone();
        if s.is_empty() { None } else { Some(s) }
    };

    let current_refresh = state.token.lock().await
        .as_ref()
        .and_then(|t| t.refresh_token.clone());

    let teams_token = if let Some(rt) = current_refresh {
        match auth::get_teams_service_token(&http, &tenant_id, &client_id, &rt).await {
            Ok(t) => {
                logger::info("Teams service token obtained successfully.");
                Some(t)
            }
            Err(e) => {
                logger::warn(&format!("Teams service token unavailable: {e}"));
                None
            }
        }
    } else {
        None
    };

    logger::info("Starting Graph data collection.");
    Ok(graph::collect_all(&http, &usable_access_token, &tenant_id, &client_id, teams_token, client_secret).await)
}

// ─── Teams number assignment / unassignment ──────────────────────────────────

#[tauri::command]
async fn assign_phone_number(
    state: State<'_, Arc<AppState>>,
    upn: String,
    phone_number: String,
    number_type: String,
) -> Result<String, String> {
    let (access_token, tenant_id, client_id, teams_token, client_secret) =
        extract_tokens_for_ps(&state).await?;

    tokio::task::spawn_blocking(move || {
        graph::run_ps_phone_action(
            "assign",
            &upn,
            &phone_number,
            &number_type,
            &access_token,
            &tenant_id,
            &client_id,
            teams_token.as_deref(),
            client_secret.as_deref(),
        )
        .map(|_| "ok".to_string())
    })
    .await
    .map_err(|e| format!("Blocking task failed: {e}"))?
}

#[tauri::command]
async fn unassign_phone_number(
    state: State<'_, Arc<AppState>>,
    upn: String,
) -> Result<String, String> {
    let (access_token, tenant_id, client_id, teams_token, client_secret) =
        extract_tokens_for_ps(&state).await?;

    tokio::task::spawn_blocking(move || {
        graph::run_ps_phone_action(
            "unassign",
            &upn,
            "",
            "",
            &access_token,
            &tenant_id,
            &client_id,
            teams_token.as_deref(),
            client_secret.as_deref(),
        )
        .map(|_| "ok".to_string())
    })
    .await
    .map_err(|e| format!("Blocking task failed: {e}"))?
}

async fn extract_tokens_for_ps(
    state: &State<'_, Arc<AppState>>,
) -> Result<(String, String, String, Option<String>, Option<String>), String> {
    let current = {
        let guard = state.token.lock().await;
        guard.as_ref().cloned().ok_or("Not authenticated. Please sign in.")?
    };
    let tenant_id = state.tenant_id.lock().await.clone();
    let client_id = state.client_id.lock().await.clone();

    let access_token = if current.is_expired() {
        let refresh = current.refresh_token.clone()
            .ok_or("Session expired and no refresh token available.")?;
        let http = reqwest::Client::new();
        let refreshed = auth::refresh_access_token(&http, &tenant_id, &client_id, &refresh).await?;
        {
            let mut guard = state.token.lock().await;
            *guard = Some(refreshed.clone());
        }
        refreshed.access_token
    } else {
        current.access_token
    };

    let client_secret = {
        let s = state.client_secret.lock().await.clone();
        if s.is_empty() { None } else { Some(s) }
    };

    let teams_token = {
        let current2 = state.token.lock().await
            .as_ref()
            .and_then(|t| t.refresh_token.clone());
        if let Some(rt) = current2 {
            let http = reqwest::Client::new();
            match auth::get_teams_service_token(&http, &tenant_id, &client_id, &rt).await {
                Ok(t)  => Some(t),
                Err(_) => None,
            }
        } else {
            None
        }
    };

    Ok((access_token, tenant_id, client_id, teams_token, client_secret))
}

// ─── Export CSV ──────────────────────────────────────────────────────────────

#[tauri::command]
async fn export_csv(headers: Vec<String>, rows: Vec<Vec<String>>, filename: String, app: AppHandle) -> Result<String, String> {
    use tauri_plugin_dialog::DialogExt;

    let path = app
        .dialog()
        .file()
        .set_file_name(&filename)
        .add_filter("CSV", &["csv"])
        .blocking_save_file()
        .ok_or("Export cancelled.")?;

    let path_str = path.to_string();
    let mut csv = String::new();
    csv.push_str(&headers.join(";"));
    csv.push('\n');
    for row in &rows {
        let escaped: Vec<String> = row
            .iter()
            .map(|cell| {
                if cell.contains(';') || cell.contains('"') || cell.contains('\n') {
                    format!("\"{}\"", cell.replace('"', "\"\""))
                } else {
                    cell.clone()
                }
            })
            .collect();
        csv.push_str(&escaped.join(";"));
        csv.push('\n');
    }

    std::fs::write(&path_str, csv.as_bytes()).map_err(|e| format!("Failed to write CSV: {e}"))?;
    logger::info(&format!("CSV exported: {path_str}"));
    Ok(path_str)
}

// ─── Utility commands ────────────────────────────────────────────────────────

/// Returns the current platform ("windows", "macos", "linux").
#[tauri::command]
fn get_platform() -> String {
    if cfg!(target_os = "windows") {
        "windows".into()
    } else if cfg!(target_os = "macos") {
        "macos".into()
    } else {
        "linux".into()
    }
}

/// Returns diagnostic info: PS executable used + log file path.
#[tauri::command]
fn get_ps_info() -> String {
    let exe = graph::ps_exe_name();
    let log_path = logger::current_path()
        .map(|p| p.display().to_string())
        .unwrap_or_else(|| "unknown log path".into());
    format!("PS exe: {exe} | Log: {log_path}")
}

/// Opens the log file in the default application (Notepad, etc.).
#[tauri::command]
fn open_log_file(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let path = logger::current_path().ok_or("Log file path not available.")?;
    if !path.exists() {
        std::fs::write(&path, "").map_err(|e| e.to_string())?;
    }
    app.opener()
        .open_path(path.to_string_lossy().as_ref(), None::<&str>)
        .map_err(|e| e.to_string())
}

/// Opens a folder picker and returns the chosen path.
#[tauri::command]
async fn pick_log_folder(app: AppHandle) -> Result<String, String> {
    use tauri_plugin_dialog::DialogExt;
    let folder = app
        .dialog()
        .file()
        .blocking_pick_folder()
        .ok_or("Folder selection cancelled.")?;
    Ok(folder.to_string())
}

/// Returns the current log file path.
#[tauri::command]
fn get_log_path() -> String {
    logger::current_path()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default()
}

#[tauri::command]
async fn install_ps_module() -> Result<String, String> {
    logger::info("User requested PowerShell MicrosoftTeams module installation.");
    let result = tokio::task::spawn_blocking(graph::run_ps_module_install)
        .await
        .map_err(|e| format!("Task error: {e}"))??;
    logger::info(&format!("install_ps_module : {result}"));
    Ok(result)
}

#[tauri::command]
fn set_debug_mode(enabled: bool) {
    crate::logger::set_enabled(enabled);
    if enabled {
        crate::logger::info("Debug mode enabled.");
    }
}

#[tauri::command]
fn log_frontend_error(context: String, message: String) {
    logger::error(&format!("Frontend - {context} : {message}"));
}

// ─── Entry point ─────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let state = Arc::new(AppState::default());

    tauri::Builder::default()
        .setup(|app| {
            // Load the custom log path from config.json before initializing the logger.
            let custom_log = (|| {
                let cfg_path = app.handle().path().app_config_dir().ok()?.join("config.json");
                let text = std::fs::read_to_string(cfg_path).ok()?;
                let cfg: serde_json::Value = serde_json::from_str(&text).ok()?;
                cfg.get("log_path")?.as_str().map(|s| s.to_string())
            })();
            let log_path = logger::init(app.handle(), custom_log.as_deref())?;
            logger::info(&format!("Log file: {}", log_path.display()));

            #[cfg(windows)]
            {
                logger::info("Starting background PowerShell MicrosoftTeams module check...");
                std::thread::spawn(|| {
                    graph::check_ps_module();
                });
            }

            Ok(())
        })
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            load_config,
            save_config,
            start_auth,
            poll_auth,
            get_auth_status,
            disconnect,
            fetch_data,
            assign_phone_number,
            unassign_phone_number,
            export_csv,
            install_ps_module,
            get_ps_info,
            get_platform,
            open_log_file,
            pick_log_folder,
            get_log_path,
            log_frontend_error,
            set_debug_mode,
            updater::check_update,
            updater::install_update,
        ])
        .run(tauri::generate_context!())
        .expect("Failed to launch application");
}
