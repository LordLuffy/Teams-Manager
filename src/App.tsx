import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AppScreen, AppConfig, DashboardData } from "./types";
import { useI18n } from "./i18n";
import SetupScreen from "./components/SetupScreen";
import AuthScreen from "./components/AuthScreen";
import Dashboard from "./components/Dashboard";
import SettingsModal from "./components/SettingsModal";

async function logFrontendError(context: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  await invoke("log_frontend_error", { context, message }).catch(() => undefined);
}

/** Applique le thème sauvegardé au démarrage */
function initTheme() {
  const saved = localStorage.getItem("tm-theme") ?? "sombre";
  document.documentElement.setAttribute("data-theme", saved);
}
initTheme();

export default function App() {
  const { setLang } = useI18n();
  const [screen, setScreen] = useState<AppScreen>("setup");
  const [showSettings, setShowSettings] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  // Initialize debug mode and language from saved localStorage on startup
  useEffect(() => {
    const savedDebug = localStorage.getItem("tm-debug") === "true";
    invoke("set_debug_mode", { enabled: savedDebug }).catch(() => undefined);

    const savedLang = localStorage.getItem("tm-language");
    if (savedLang) setLang(savedLang as import("./i18n").Lang);
  }, []);

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    setRuntimeError(null);
    try {
      const result = await invoke<DashboardData>("fetch_data");
      setData(result);
      setLastRefresh(new Date());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRuntimeError(message);
      await logFrontendError("actualisation des données", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const cfg = await invoke<AppConfig | null>("load_config");
        if (!cfg) return;

        const authed = await invoke<boolean>("get_auth_status");
        if (authed) {
          setScreen("dashboard");
          await handleRefresh();
        } else {
          setScreen("auth");
        }
      } catch (error) {
        await logFrontendError("initialisation de l'application", error);
        setRuntimeError("Impossible de charger la configuration locale.");
        setScreen("auth");
      }
    })();
  }, [handleRefresh]);

  async function handleDisconnect() {
    try {
      await invoke("disconnect");
    } catch (error) {
      await logFrontendError("déconnexion", error);
    }
    setData(null);
    setRuntimeError(null);
    setScreen("auth");
  }

  // First-time setup
  if (screen === "setup") {
    return <SetupScreen onConnect={() => setScreen("auth")} />;
  }

  if (screen === "auth") {
    return (
      <AuthScreen
        onSetup={() => setScreen("setup")}
        onConnected={async () => {
          setScreen("dashboard");
          await handleRefresh();
        }}
      />
    );
  }

  return (
    <>
      <Dashboard
        data={data}
        lastRefresh={lastRefresh}
        loading={loading}
        runtimeError={runtimeError}
        onRefresh={handleRefresh}
        onDisconnect={handleDisconnect}
        onSetup={() => setShowSettings(true)}
      />
      {showSettings && (
        <SettingsModal
          onConnect={() => { setShowSettings(false); setScreen("auth"); }}
          onClose={() => setShowSettings(false)}
        />
      )}
    </>
  );
}
