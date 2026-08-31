import { useCallback, useEffect, useRef, useState } from "react";
import LineChart from "../components/LineChart";
import { useServerState } from "../hooks/useServerState";
import {
  getSystemInfo,
  getServerMetrics,
  getServerInfo,
  listPlayers,
  type SystemInfo,
  type MetricSample,
} from "../lib/server";

interface HistoryPoint {
  memory: number;
  cpu: number;
  players: number;
}

const MAX_POINTS = 60;

function formatUptime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-surface-2 p-4">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 font-mono text-sm text-neutral-100">{value || "—"}</div>
    </div>
  );
}

export default function Overview() {
  const { state } = useServerState();
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [serverInfo, setServerInfo] = useState<{
    uptime_secs: number;
    max_memory_mb: number;
  } | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [offline, setOffline] = useState(false);
  const [players, setPlayers] = useState(0);
  const [maxPlayers, setMaxPlayers] = useState(50);
  const historyRef = useRef<HistoryPoint[]>([]);

  useEffect(() => {
    getSystemInfo().then(setSysInfo).catch(() => {});
  }, []);

  const refreshPlayers = useCallback(async () => {
    try {
      const info = await getServerInfo();
      setServerInfo(info);
    } catch {
      /* not running */
    }
    try {
      const resp = await listPlayers();
      setPlayers(resp.count);
      setMaxPlayers(resp.max || 50);
    } catch {
      /* not running */
    }
  }, []);

  useEffect(() => {
    const id = window.setInterval(refreshPlayers, 5000);
    refreshPlayers();
    return () => window.clearInterval(id);
  }, [refreshPlayers]);

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      const online = state === "online";
      let mem = 0;
      let cpu = 0;
      if (online) {
        try {
          const s: MetricSample = await getServerMetrics();
          mem = s.memory_mb;
          cpu = s.cpu_percent;
        } catch {
          /* process briefly unavailable */
        }
      }
      if (cancelled) return;

      if (online) setOffline(false);
      else setOffline(true);

      const next = [...historyRef.current, { memory: mem, cpu, players }];
      if (next.length > MAX_POINTS) next.shift();
      historyRef.current = next;
      setHistory([...next]);
    };

    tick();
    const id = window.setInterval(tick, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [state, players]);

  const memData = history.map((p) => p.memory);
  const cpuData = history.map((p) => p.cpu);
  const playerData = history.map((p) => p.players);

  const lastMem = memData[memData.length - 1] ?? 0;
  const lastCpu = cpuData[cpuData.length - 1] ?? 0;
  const memMax = serverInfo?.max_memory_mb ?? 2048;

  const statusColor =
    state === "online"
      ? "text-emerald-400"
      : state === "starting" || state === "stopping"
        ? "text-amber-400"
        : "text-red-400";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Overview</h1>
          <p className="mt-1 text-sm text-neutral-500">
            At-a-glance system and server performance
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-neutral-800 bg-surface-2 px-4 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-current" style={{ color: statusColor }} />
          <span className={`text-sm font-medium ${statusColor}`}>
            {state.toUpperCase()}
          </span>
        </div>
      </div>

      {offline && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
          Server is not running — start it from the Status page to see live memory,
          CPU and player data.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-neutral-800 bg-surface-2 p-4">
          <LineChart
            data={memData}
            max={memMax}
            color="#3b82f6"
            label="Memory Usage (MB)"
            currentValue={`${lastMem.toFixed(0)} MB`}
          />
        </div>
        <div className="rounded-xl border border-neutral-800 bg-surface-2 p-4">
          <LineChart
            data={cpuData}
            max={100}
            color="#a855f7"
            label="CPU Usage (%)"
            currentValue={`${lastCpu.toFixed(0)}%`}
          />
        </div>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-surface-2 p-4">
        <LineChart
          data={playerData}
          max={maxPlayers}
          color="#6d5df6"
          label="Players Online"
          currentValue={`${players} online`}
        />
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-white">System Info</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <InfoCard label="Java Version" value={sysInfo?.java_version ?? ""} />
          <InfoCard label="Operating System" value={`${sysInfo?.os ?? ""} ${sysInfo?.os_arch ?? ""}`} />
          <InfoCard label="Processors" value={sysInfo ? String(sysInfo.processors) : ""} />
          <InfoCard
            label="Uptime"
            value={serverInfo ? formatUptime(serverInfo.uptime_secs) : "—"}
          />
        </div>
      </div>
    </div>
  );
}
