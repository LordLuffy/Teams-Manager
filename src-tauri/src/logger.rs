use std::{
    fs::OpenOptions,
    io::Write,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex, OnceLock, RwLock,
    },
};
use tauri::AppHandle;
use tauri::Manager;

/// Active ou désactive la génération de logs. Désactivé par défaut.
static DEBUG_ENABLED: AtomicBool = AtomicBool::new(false);

/// Chemin du fichier de log. Initialisé une seule fois, puis potentiellement
/// remplacé par un chemin personnalisé via `set_custom_path`.
static LOG_FILE_PATH: OnceLock<RwLock<PathBuf>> = OnceLock::new();
static WRITE_LOCK: Mutex<()> = Mutex::new(());

pub fn set_enabled(enabled: bool) {
    DEBUG_ENABLED.store(enabled, Ordering::Relaxed);
}

fn timestamp() -> String {
    chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string()
}

pub fn init(app: &AppHandle, custom_path: Option<&str>) -> Result<PathBuf, String> {
    let path = if let Some(cp) = custom_path.filter(|s| !s.trim().is_empty()) {
        let dir = PathBuf::from(cp.trim());
        std::fs::create_dir_all(&dir)
            .map_err(|e| format!("Impossible de créer le dossier de logs personnalisé : {e}"))?;
        dir.join("teams-manager.log")
    } else {
        let log_dir = app
            .path()
            .app_log_dir()
            .map_err(|e| format!("Impossible de localiser le dossier de logs : {e}"))?;
        std::fs::create_dir_all(&log_dir)
            .map_err(|e| format!("Impossible de créer le dossier de logs : {e}"))?;
        log_dir.join("teams-manager.log")
    };

    let _ = LOG_FILE_PATH.set(RwLock::new(path.clone()));
    // Ne pas appeler info() ici — le debug peut être désactivé au démarrage
    Ok(path)
}

/// Met à jour le chemin du fichier de log à chaud (sans redémarrage).
pub fn set_custom_path(dir: &str) -> Result<PathBuf, String> {
    let dir_path = PathBuf::from(dir.trim());
    std::fs::create_dir_all(&dir_path)
        .map_err(|e| format!("Impossible de créer le dossier de logs : {e}"))?;
    let path = dir_path.join("teams-manager.log");
    if let Some(lock) = LOG_FILE_PATH.get() {
        if let Ok(mut w) = lock.write() {
            *w = path.clone();
        }
    }
    Ok(path)
}

/// Retourne le chemin actuel du fichier de log.
pub fn current_path() -> Option<PathBuf> {
    LOG_FILE_PATH.get()?.read().ok().map(|g| g.clone())
}

fn append(level: &str, message: &str) {
    // Si le mode débogage est désactivé, aucun log n'est écrit
    if !DEBUG_ENABLED.load(Ordering::Relaxed) {
        return;
    }
    let Some(lock) = LOG_FILE_PATH.get() else { return };
    let path = match lock.read() {
        Ok(g) => g.clone(),
        Err(_) => return,
    };
    let _guard = WRITE_LOCK.lock().ok();
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&path) {
        let _ = writeln!(file, "{} [{:<5}] {}", timestamp(), level, message);
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
