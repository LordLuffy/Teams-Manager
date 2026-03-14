mod auth;
mod graph;
mod logger;

use keyring::Entry;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::Mutex;
use tauri::Manager;

/// Etat partagé de l'application côté backend.
#[derive(Debug, Default)]
pub struct AppState {
    pub token: Mutex<Option<auth::TokenSet>>,
    pub tenant_id: Mutex<String>,
    pub client_id: Mutex<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppConfig {
    pub tenant_id: String,
    pub client_id: String,
}

fn config_path(app: &AppHandle) -> std::path::PathBuf {
    app.path()
        .app_config_dir()
        .expect("app config dir")
        .join("config.json")
}

const TOKEN_SERVICE: &str = "teams-license-telephony-manager";
const TOKEN_CHUNK_SIZE: usize = 1000;

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

fn token_account(tenant_id: &str, client_id: &str) -> String {
    let tenant = if tenant_id.trim().is_empty() { "default-tenant" } else { tenant_id.trim() };
    let client = if client_id.trim().is_empty() { "default-client" } else { client_id.trim() };
    format!("{}::{}", tenant, client)
}

fn save_token_secure(tenant_id: &str, client_id: &str, token: &auth::TokenSet) -> Result<(), String> {
    let refresh = token
        .refresh_token
        .as_ref()
        .ok_or("Aucun refresh token retourné par Microsoft.")?;

    let base_account = token_account(tenant_id, client_id);
    let _ = delete_token_secure(tenant_id, client_id);
    let chunks = split_for_windows_keyring(refresh, TOKEN_CHUNK_SIZE);

    let meta_entry = Entry::new(TOKEN_SERVICE, &format!("{}::count", base_account))
        .map_err(|e| format!("Initialisation keyring (meta) : {e}"))?;
    meta_entry
        .set_password(&chunks.len().to_string())
        .map_err(|e| format!("Ecriture keyring (meta) : {e}"))?;

    for (idx, chunk) in chunks.iter().enumerate() {
        let entry = Entry::new(TOKEN_SERVICE, &format!("{}::part::{}", base_account, idx))
            .map_err(|e| format!("Initialisation keyring (partie {idx}) : {e}"))?;
        entry
            .set_password(chunk)
            .map_err(|e| format!("Ecriture keyring (partie {idx}) : {e}"))?;
    }

    logger::info("Refresh token stocké dans le coffre-fort système.");
    Ok(())
}

fn load_token_secure(tenant_id: &str, client_id: &str) -> Result<Option<String>, String> {
    let base_account = token_account(tenant_id, client_id);
    let meta_entry = Entry::new(TOKEN_SERVICE, &format!("{}::count", base_account))
        .map_err(|e| format!("Initialisation keyring (meta) : {e}"))?;

    let count_raw = match meta_entry.get_password() {
        Ok(v) => v,
        Err(keyring::Error::NoEntry) => return Ok(None),
        Err(e) => return Err(format!("Lecture keyring (meta) : {e}")),
    };

    let count: usize = count_raw
        .parse()
        .map_err(|e| format!("Nombre de segments invalide dans le keyring : {e}"))?;

    let mut refresh = String::new();
    for idx in 0..count {
        let entry = Entry::new(TOKEN_SERVICE, &format!("{}::part::{}", base_account, idx))
            .map_err(|e| format!("Initialisation keyring (partie {idx}) : {e}"))?;

        let chunk = match entry.get_password() {
            Ok(v) => v,
            Err(keyring::Error::NoEntry) => return Err(format!("Segment keyring manquant : {idx}")),
            Err(e) => return Err(format!("Lecture keyring (partie {idx}) : {e}")),
        };
        refresh.push_str(&chunk);
    }

    Ok(Some(refresh))
}

fn delete_token_secure(tenant_id: &str, client_id: &str) -> Result<(), String> {
    let base_account = token_account(tenant_id, client_id);
    let meta_entry = Entry::new(TOKEN_SERVICE, &format!("{}::count", base_account))
        .map_err(|e| format!("Initialisation keyring (meta) : {e}"))?;

    let count = match meta_entry.get_password() {
        Ok(v) => v.parse::<usize>().unwrap_or(0),
        Err(keyring::Error::NoEntry) => 0,
        Err(e) => return Err(format!("Lecture keyring avant suppression : {e}")),
    };

    for idx in 0..count {
        let entry = Entry::new(TOKEN_SERVICE, &format!("{}::part::{}", base_account, idx))
            .map_err(|e| format!("Initialisation keyring (partie {idx}) : {e}"))?;
        match entry.delete_credential() {
            Ok(_) | Err(keyring::Error::NoEntry) => {}
            Err(e) => return Err(format!("Suppression keyring (partie {idx}) : {e}")),
        }
    }

    match meta_entry.delete_credential() {
        Ok(_) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("Suppression keyring (meta) : {e}")),
    }
}

#[tauri::command]
async fn load_config(app: AppHandle, state: State<'_, Arc<AppState>>) -> Result<Option<AppConfig>, String> {
    let path = config_path(&app);
    if !path.exists() {
        logger::info("Aucun fichier de configuration trouvé.");
        return Ok(None);
    }

    let text = std::fs::read_to_string(&path).map_err(|e| format!("Lecture de la configuration : {e}"))?;
    let cfg: AppConfig = serde_json::from_str(&text).map_err(|e| format!("Configuration invalide : {e}"))?;

    *state.tenant_id.lock().await = cfg.tenant_id.clone();
    *state.client_id.lock().await = cfg.client_id.clone();

    match load_token_secure(&cfg.tenant_id, &cfg.client_id) {
        Ok(Some(refresh)) => {
            let http = reqwest::Client::new();
            match auth::refresh_access_token(&http, &cfg.tenant_id, &cfg.client_id, &refresh).await {
                Ok(token) => {
                    *state.token.lock().await = Some(token);
                    logger::info("Session restaurée depuis le refresh token.");
                }
                Err(e) => {
                    logger::warn(&format!("Impossible de restaurer la session au démarrage : {e}"));
                }
            }
        }
        Ok(None) => logger::info("Aucun refresh token sécurisé disponible."),
        Err(e) => logger::warn(&format!("Erreur lors du chargement du token sécurisé : {e}")),
    }

    Ok(Some(cfg))
}

#[tauri::command]
async fn save_config(app: AppHandle, config: AppConfig, state: State<'_, Arc<AppState>>) -> Result<(), String> {
    let path = config_path(&app);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Création du dossier de configuration : {e}"))?;
    }

    let text = serde_json::to_string_pretty(&config).map_err(|e| format!("Sérialisation de la configuration : {e}"))?;
    std::fs::write(&path, text).map_err(|e| format!("Ecriture de la configuration : {e}"))?;

    let old_tenant = state.tenant_id.lock().await.clone();
    let old_client = state.client_id.lock().await.clone();
    if !old_tenant.is_empty() && !old_client.is_empty() && (old_tenant != config.tenant_id || old_client != config.client_id) {
        let _ = delete_token_secure(&old_tenant, &old_client);
        *state.token.lock().await = None;
    }

    *state.tenant_id.lock().await = config.tenant_id;
    *state.client_id.lock().await = config.client_id;
    logger::info("Configuration enregistrée.");
    Ok(())
}

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
        return Err("Tenant ID et Client ID requis.".into());
    }
    let http = reqwest::Client::new();
    let dc = auth::start_device_code(&http, &tenant_id, &client_id).await?;
    logger::info("Démarrage du flux device code.");
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
                    logger::warn(&format!("Impossible de sauvegarder le refresh token : {e}"));
                }
                logger::info("Authentification Microsoft réussie.");
                let _ = app.emit("auth-ok", ());
            }
            Err(e) => {
                logger::error(&format!("Echec de l'authentification Microsoft : {e}"));
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
    logger::info("Déconnexion utilisateur.");
    Ok(())
}

#[tauri::command]
async fn fetch_data(state: State<'_, Arc<AppState>>) -> Result<graph::DashboardData, String> {
    let current = {
        let token_guard = state.token.lock().await;
        token_guard.as_ref().cloned().ok_or("Non authentifié. Veuillez vous connecter.")?
    };

    let tenant_id = state.tenant_id.lock().await.clone();
    let client_id = state.client_id.lock().await.clone();

    let usable_access_token = if current.is_expired() {
        let refresh = current.refresh_token.clone().ok_or("Session expirée et aucun refresh token disponible.")?;
        let http = reqwest::Client::new();
        let refreshed = auth::refresh_access_token(&http, &tenant_id, &client_id, &refresh).await?;

        if let Err(e) = save_token_secure(&tenant_id, &client_id, &refreshed) {
            logger::warn(&format!("Impossible de sauvegarder le token rafraîchi : {e}"));
        }
        {
            let mut token_guard = state.token.lock().await;
            *token_guard = Some(refreshed.clone());
        }
        logger::info("Token d'accès rafraîchi.");
        refreshed.access_token
    } else {
        current.access_token
    };

    let http = reqwest::Client::new();

    // Lecture du refresh token courant (potentiellement mis à jour si on vient de rafraîchir).
    let current_refresh = state.token.lock().await
        .as_ref()
        .and_then(|t| t.refresh_token.clone());

    // Tentative d'obtention d'un token Teams service (48ac35b8-...) via le refresh token.
    // Nécessite que l'app registration ait la permission Teams service — échoue silencieusement sinon.
    let teams_token = if let Some(rt) = current_refresh {
        match auth::get_teams_service_token(&http, &tenant_id, &client_id, &rt).await {
            Ok(t) => {
                logger::info("Token service Teams obtenu avec succès.");
                Some(t)
            }
            Err(e) => {
                logger::warn(&format!("Token service Teams indisponible (app sans permission Teams ?) : {e}"));
                None
            }
        }
    } else {
        None
    };

    logger::info("Lancement de la collecte des données Graph.");
    Ok(graph::collect_all(&http, &usable_access_token, &tenant_id, teams_token).await)
}

#[tauri::command]
async fn export_csv(headers: Vec<String>, rows: Vec<Vec<String>>, filename: String, app: AppHandle) -> Result<String, String> {
    use tauri_plugin_dialog::DialogExt;

    let path = app
        .dialog()
        .file()
        .set_file_name(&filename)
        .add_filter("CSV", &["csv"])
        .blocking_save_file()
        .ok_or("Export annulé.")?;

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

    std::fs::write(&path_str, csv.as_bytes()).map_err(|e| format!("Ecriture du CSV : {e}"))?;
    logger::info(&format!("Export CSV réalisé : {path_str}"));
    Ok(path_str)
}

#[tauri::command]
async fn install_ps_module() -> Result<String, String> {
    logger::info("Installation du module PowerShell MicrosoftTeams demandée par l'utilisateur.");
    let result = tokio::task::spawn_blocking(graph::run_ps_module_install)
        .await
        .map_err(|e| format!("Erreur tâche : {e}"))??;
    logger::info(&format!("install_ps_module : {result}"));
    Ok(result)
}

#[tauri::command]
fn log_frontend_error(context: String, message: String) {
    logger::error(&format!("Frontend - {context} : {message}"));
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let state = Arc::new(AppState::default());

    tauri::Builder::default()
        .setup(|app| {
            let log_path = logger::init(app.handle())?;
            logger::info(&format!("Fichier de log : {}", log_path.display()));

            // Windows : vérification et installation silencieuse du module PowerShell MicrosoftTeams.
            // Tourne en arrière-plan pour ne pas bloquer le démarrage de l'interface.
            #[cfg(windows)]
            {
                logger::info("Lancement de la vérification du module PowerShell MicrosoftTeams en arrière-plan...");
                std::thread::spawn(|| {
                    graph::check_ps_module();
                });
            }

            Ok(())
        })
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
            install_ps_module,
            log_frontend_error,
        ])
        .run(tauri::generate_context!())
        .expect("Erreur lors du lancement de l'application");
}
