import { useEffect, useState } from "react";
import { useServerState } from "../hooks/useServerState";
import {
  DEFAULT_SETTINGS,
  getServerInfo,
  loadServerSettings,
  restartServer,
  startServer,
  stopServer,
  toServerConfig,
  type ServerInfo,
  type ServerSettings,
} from "../lib/server";

function formatUptime(secs: number): string {
  if (secs === 0) return "Not running";
  const days = Math.floor(secs / 86400);
  const hours = Math.floor((secs % 86400) / 3600);
  const mins = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0) parts.push(`${mins}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}

const STATE_STYLES: Record<string, string> = {
  stopped: "bg-neutral-800 text-neutral-400",
  starting: "bg-amber-500/10 text-amber-400",
  online: "bg-green-500/10 text-green-400",
  stopping: "bg-red-500/10 text-red-400",
};

function Status() {
  const { state, refresh } = useServerState();
  const [settings, setSettings] = useState<ServerSettings>(DEFAULT_SETTINGS);
  const [info, setInfo] = useState<ServerInfo | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    loadServerSettings().then(setSettings).catch(() => {});
  }, []);

  useEffect(() => {
    getServerInfo().then(setInfo).catch(() => {});
  }, [state]);

  const settingsReady =
    settings.serverDir.trim() !== "" &&
    settings.javaPath.trim() !== "" &&
    settings.serverJar.trim().toLowerCase().endsWith(".jar");

  const running = state === "starting" || state === "online" || state === "stopping";

  async function run(label: string, action: () => Promise<unknown>) {
    setBusy(label);
    try {
      await action();
      await refresh();
      const i = await getServerInfo();
      setInfo(i);
    } catch {
      // errors handled in console log
    } finally {
      setBusy(null);
    }
  }

  function handleStart() {
    run("start", () => startServer(toServerConfig(settings)));
  }

  function handleStop() {
    run("stop", () => stopServer());
  }

  function handleRestart() {
    run("restart", () => restartServer(toServerConfig(settings)));
  }

  const uptime = info?.uptime_secs ?? 0;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Server Control
        </h2>
        <div className="flex items-center gap-4">
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${STATE_STYLES[state]}`}
          >
            {state}
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleStart}
              disabled={busy !== null || state !== "stopped" || !settingsReady}
              title={settingsReady ? "Start the server" : "Configure valid settings first"}
              className="rounded-md bg-green-600/90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Start
            </button>
            <button
              onClick={handleStop}
              disabled={busy !== null || !running}
              className="rounded-md bg-red-600/90 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Stop
            </button>
            <button
              onClick={handleRestart}
              disabled={busy !== null || !running || !settingsReady}
              className="rounded-md bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Restart
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Server Info
        </h2>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <dt className="text-neutral-500">Status</dt>
          <dd className="text-neutral-200">{state}</dd>

          <dt className="text-neutral-500">Uptime</dt>
          <dd className="font-mono text-neutral-200">{formatUptime(uptime)}</dd>

          <dt className="text-neutral-500">Server Directory</dt>
          <dd className="break-all font-mono text-xs text-neutral-300">
            {info?.server_dir || "Not configured"}
          </dd>

          <dt className="text-neutral-500">Server Jar</dt>
          <dd className="font-mono text-xs text-neutral-300">
            {info?.server_jar || "Not configured"}
          </dd>

          <dt className="text-neutral-500">Memory (min)</dt>
          <dd className="font-mono text-neutral-200">
            {info?.min_memory_mb ? `${info.min_memory_mb} MB` : "N/A"}
          </dd>

          <dt className="text-neutral-500">Memory (max)</dt>
          <dd className="font-mono text-neutral-200">
            {info?.max_memory_mb ? `${info.max_memory_mb} MB` : "N/A"}
          </dd>
        </dl>
      </section>
    </div>
  );
}

export default Status;
