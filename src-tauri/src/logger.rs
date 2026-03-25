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

/// Enables or disables log output. Disabled by default.
static DEBUG_ENABLED: AtomicBool = AtomicBool::new(false);

/// Log file path. Initialized once, then optionally
/// replaced by a custom path via `set_custom_path`.
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
            .map_err(|e| format!("Failed to create custom log directory: {e}"))?;
        dir.join("teams-manager.log")
    } else {
        let log_dir = app
            .path()
            .app_log_dir()
            .map_err(|e| format!("Failed to locate log directory: {e}"))?;
        std::fs::create_dir_all(&log_dir)
            .map_err(|e| format!("Failed to create log directory: {e}"))?;
        log_dir.join("teams-manager.log")
    };

    let _ = LOG_FILE_PATH.set(RwLock::new(path.clone()));
    // Do not call info() here — debug may be disabled at startup
    Ok(path)
}

/// Updates the log file path at runtime (without restart).
pub fn set_custom_path(dir: &str) -> Result<PathBuf, String> {
    let dir_path = PathBuf::from(dir.trim());
    std::fs::create_dir_all(&dir_path)
        .map_err(|e| format!("Failed to create log directory: {e}"))?;
    let path = dir_path.join("teams-manager.log");
    if let Some(lock) = LOG_FILE_PATH.get() {
        if let Ok(mut w) = lock.write() {
            *w = path.clone();
        }
    }
    Ok(path)
}

/// Returns the current log file path.
pub fn current_path() -> Option<PathBuf> {
    LOG_FILE_PATH.get()?.read().ok().map(|g| g.clone())
}

fn append(level: &str, message: &str) {
    // If debug mode is disabled, no log is written
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
