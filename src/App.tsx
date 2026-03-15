import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AppScreen, AppConfig, DashboardData } from "./types";
import SetupScreen from "./components/SetupScreen";
import AuthScreen from "./components/AuthScreen";
import Dashboard from "./components/Dashboard";

async function logFrontendError(context: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  await invoke("log_frontend_error", { context, message }).catch(() => undefined);
}

export default function App() {
  const [screen, setScreen] = useState<AppScreen>("setup");
  const [data, setData] = useState<DashboardData | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

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

  if (screen === "setup") {
    return <SetupScreen onSaved={() => setScreen("auth")} />;
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
    <Dashboard
      data={data}
      lastRefresh={lastRefresh}
      loading={loading}
      runtimeError={runtimeError}
      onRefresh={handleRefresh}
      onDisconnect={handleDisconnect}
      onSetup={() => setScreen("setup")}
    />
  );
}