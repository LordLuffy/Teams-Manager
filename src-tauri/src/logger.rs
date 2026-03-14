use std::{fs::OpenOptions, io::Write, path::PathBuf, sync::{Mutex, OnceLock}, time::{SystemTime, UNIX_EPOCH}};
use tauri::AppHandle;
use tauri::Manager;

static LOG_FILE_PATH: OnceLock<PathBuf> = OnceLock::new();
static WRITE_LOCK: Mutex<()> = Mutex::new(());

fn timestamp() -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("{}", now)
}

pub fn init(app: &AppHandle) -> Result<PathBuf, String> {
    let log_dir = app
        .path()
        .app_log_dir()
        .map_err(|e| format!("Impossible de localiser le dossier de logs : {e}"))?;

    std::fs::create_dir_all(&log_dir)
        .map_err(|e| format!("Impossible de créer le dossier de logs : {e}"))?;

    let path = log_dir.join("teams-manager.log");
    let _ = LOG_FILE_PATH.set(path.clone());
    info("Journalisation initialisée.");
    Ok(path)
}

fn append(level: &str, message: &str) {
    let Some(path) = LOG_FILE_PATH.get() else {
        return;
    };

    let _guard = WRITE_LOCK.lock().ok();
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(file, "[{}] [{}] {}", timestamp(), level, message);
    }
}

pub fn info(message: &str) {
    append("INFO", message);
}

pub fn warn(message: &str) {
    append("WARN", message);
}

pub fn error(message: &str) {
    append("ERROR", message);
}