mod auth;
mod graph;

use std::sync::Arc;
use tokio::sync::Mutex;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};
use keyring::Entry;

// ---------------------------------------------------------------------------
//  App state
// ---------------------------------------------------------------------------
#[derive(Debug, Default)]
pub struct AppState {
    pub token:     Mutex<Option<auth::TokenSet>>,
    pub tenant_id: Mutex<String>,
    pub client_id: Mutex<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub tenant_id: String,
    pub client_id: String,
}

// ---------------------------------------------------------------------------
//  Config persistence (app config dir)
// ---------------------------------------------------------------------------
fn config_path(app: &AppHandle) -> std::path::PathBuf {
    app.path()
        .app_config_dir()
        .expect("app config dir")
        .join("config.json")
}

const TOKEN_SERVICE: &str = "teams-license-telephony-manager";

fn token_account(tenant_id: &str, client_id: &str) -> String {
    // macOS n'accepte pas service/user vides
    let tenant = if tenant_id.trim().is_empty() { "default-tenant" } else { tenant_id.trim() };
    let client = if client_id.trim().is_empty() { "default-client" } else { client_id.trim() };
    format!("{}::{}", tenant, client)
}

fn save_token_secure(tenant_id: &str, client_id: &str, token: &auth::TokenSet) -> Result<(), String> {
    let account = token_account(tenant_id, client_id);
    let entry = Entry::new(TOKEN_SERVICE, &account).map_err(|e| format!("Keyring init: {}", e))?;
    let payload = serde_json::to_string(token).map_err(|e| format!("Serialize token: {}", e))?;
    entry.set_password(&payload).map_err(|e| format!("Keyring save: {}", e))?;
    Ok(())
}

fn load_token_secure(tenant_id: &str, client_id: &str) -> Result<Option<auth::TokenSet>, String> {
    let account = token_account(tenant_id, client_id);
    let entry = Entry::new(TOKEN_SERVICE, &account).map_err(|e| format!("Keyring init: {}", e))?;

    match entry.get_password() {
        Ok(raw) => {
            let token: auth::TokenSet =
                serde_json::from_str(&raw).map_err(|e| format!("Parse secure token: {}", e))?;
            Ok(Some(token))
        }
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Keyring load: {}", e)),
    }
}

fn delete_token_secure(tenant_id: &str, client_id: &str) -> Result<(), String> {
    let account = token_account(tenant_id, client_id);
    let entry = Entry::new(TOKEN_SERVICE, &account).map_err(|e| format!("Keyring init: {}", e))?;

    match entry.delete_credential() {
        Ok(_) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("Keyring delete: {}", e)),
    }
}

#[tauri::command]
async fn load_config(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
) -> Result<Option<AppConfig>, String> {
    let path = config_path(&app);
    if !path.exists() {
        return Ok(None);
    }

    let text = std::fs::read_to_string(&path)
        .map_err(|e| format!("Read config: {}", e))?;
    let cfg: AppConfig = serde_json::from_str(&text)
        .map_err(|e| format!("Parse config: {}", e))?;

    *state.tenant_id.lock().await = cfg.tenant_id.clone();
    *state.client_id.lock().await = cfg.client_id.clone();

    if let Some(token) = load_token_secure(&cfg.tenant_id, &cfg.client_id)? {
        *state.token.lock().await = Some(token);
    }

    Ok(Some(cfg))
}

#[tauri::command]
async fn save_config(
    app:    AppHandle,
    config: AppConfig,
    state:  State<'_, Arc<AppState>>,
) -> Result<(), String> {
    let path = config_path(&app);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Create dir: {}", e))?;
    }
    let text = serde_json::to_string_pretty(&config)
        .map_err(|e| e.to_string())?;
    std::fs::write(&path, text)
        .map_err(|e| format!("Write config: {}", e))?;

    let old_tenant = state.tenant_id.lock().await.clone();
    let old_client = state.client_id.lock().await.clone();

    if !old_tenant.is_empty() && !old_client.is_empty()
        && (old_tenant != config.tenant_id || old_client != config.client_id)
    {
        let _ = delete_token_secure(&old_tenant, &old_client);
        *state.token.lock().await = None;
    }

    *state.tenant_id.lock().await = config.tenant_id;
    *state.client_id.lock().await = config.client_id;
    Ok(())
}

// ---------------------------------------------------------------------------
//  Auth - device code flow
// ---------------------------------------------------------------------------
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DeviceCodeResult {
    pub user_code:        String,
    pub verification_uri: String,
    pub message:          String,
    pub interval:         u64,
    pub device_code:      String,
}

#[tauri::command]
async fn start_auth(
    state: State<'_, Arc<AppState>>,
) -> Result<DeviceCodeResult, String> {
    let tenant_id = state.tenant_id.lock().await.clone();
    let client_id = state.client_id.lock().await.clone();
    if tenant_id.is_empty() || client_id.is_empty() {
        return Err("Tenant ID et Client ID requis.".into());
    }
    let http = reqwest::Client::new();
    let dc = auth::start_device_code(&http, &tenant_id, &client_id).await?;
    Ok(DeviceCodeResult {
        user_code:        dc.user_code,
        verification_uri: dc.verification_uri,
        message:          dc.message,
        interval:         dc.interval,
        device_code:      dc.device_code,
    })
}

#[tauri::command]
async fn poll_auth(
    device_code: String,
    interval:    u64,
    app:         AppHandle,
    state:       State<'_, Arc<AppState>>,
) -> Result<bool, String> {
    let tenant_id = state.tenant_id.lock().await.clone();
    let client_id = state.client_id.lock().await.clone();
    let http = reqwest::Client::new();
    let state_arc = state.inner().clone();

    tokio::spawn(async move {
    match auth::poll_token(&http, &tenant_id, &client_id, &device_code, interval).await {
        Ok(token_set) => {
            // Toujours connecter l'utilisateur, même si le keyring échoue
            *state_arc.token.lock().await = Some(token_set.clone());

            if let Err(e) = save_token_secure(&tenant_id, &client_id, &token_set) {
                eprintln!("Keyring save failed: {}", e);
            }

            let _ = app.emit("auth-ok", ());
        }
        Err(e) => {
            eprintln!("poll_token failed: {}", e);
            let _ = app.emit("auth-error", e);
        }
    }
        }
    });
    Ok(true)
}

#[tauri::command]
async fn get_auth_status(
    state: State<'_, Arc<AppState>>,
) -> Result<bool, String> {
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

    Ok(())
}

// ---------------------------------------------------------------------------
//  Data fetching
// ---------------------------------------------------------------------------
#[tauri::command]
async fn fetch_data(
    state: State<'_, Arc<AppState>>,
) -> Result<graph::DashboardData, String> {
    let current = {
        let token_guard = state.token.lock().await;
        token_guard
            .as_ref()
            .cloned()
            .ok_or("Non authentifie. Veuillez vous connecter.")?
    };

    let tenant_id = state.tenant_id.lock().await.clone();
    let client_id = state.client_id.lock().await.clone();

    let usable_access_token = if current.is_expired() {
        let refresh = current.refresh_token
            .clone()
            .ok_or("Session expiree et aucun refresh token disponible.")?;

        let http = reqwest::Client::new();
        let refreshed = auth::refresh_access_token(&http, &tenant_id, &client_id, &refresh).await?;

        save_token_secure(&tenant_id, &client_id, &refreshed)?;

        {
            let mut token_guard = state.token.lock().await;
            *token_guard = Some(refreshed.clone());
        }

        refreshed.access_token
    } else {
        current.access_token
    };

    let http = reqwest::Client::new();
    Ok(graph::collect_all(&http, &usable_access_token).await)
}

// ---------------------------------------------------------------------------
//  CSV export
// ---------------------------------------------------------------------------
#[tauri::command]
async fn export_csv(
    headers:  Vec<String>,
    rows:     Vec<Vec<String>>,
    filename: String,
    app:      AppHandle,
) -> Result<String, String> {
    use tauri_plugin_dialog::DialogExt;

    let path = app.dialog()
        .file()
        .set_file_name(&filename)
        .add_filter("CSV", &["csv"])
        .blocking_save_file()
        .ok_or("Export annule")?;

    let path_str = path.to_string();
    let mut csv = String::new();
    csv.push_str(&headers.join(";"));
    csv.push('\n');
    for row in &rows {
        let escaped: Vec<String> = row.iter().map(|cell| {
            if cell.contains(';') || cell.contains('"') || cell.contains('\n') {
                format!("\"{}\"", cell.replace('"', "\"\""))
            } else {
                cell.clone()
            }
        }).collect();
        csv.push_str(&escaped.join(";"));
        csv.push('\n');
    }

    std::fs::write(&path_str, csv.as_bytes())
        .map_err(|e| format!("Write CSV: {}", e))?;

    Ok(path_str)
}

// ---------------------------------------------------------------------------
//  Entry point
// ---------------------------------------------------------------------------
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let state = Arc::new(AppState::default());

    tauri::Builder::default()
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
            export_csv,
        ])
        .run(tauri::generate_context!())
        .expect("error while running application");
}