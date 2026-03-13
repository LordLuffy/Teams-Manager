import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AppScreen, AppConfig, DashboardData } from "./types";
import SetupScreen from "./components/SetupScreen";
import AuthScreen from "./components/AuthScreen";
import Dashboard from "./components/Dashboard";

export default function App() {
  const [screen, setScreen]           = useState<AppScreen>("setup");
  const [data, setData]               = useState<DashboardData | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [loading, setLoading]         = useState(false);

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await invoke<DashboardData>("fetch_data");
      setData(result);
      setLastRefresh(new Date());
    } catch (e) {
      console.error("fetch_data:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // On mount: load config, check auth status
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
    } catch (e) {
      console.error("init:", e);
      setScreen("auth");
    }
  })();
}, [handleRefresh]);

  async function handleDisconnect() {
    try { await invoke("disconnect"); } catch { /* ignore */ }
    setData(null);
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
      onRefresh={handleRefresh}
      onDisconnect={handleDisconnect}
    />
  );
}
