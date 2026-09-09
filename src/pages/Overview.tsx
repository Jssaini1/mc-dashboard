import { useCallback, useEffect, useRef, useState } from "react";
import LineChart from "../components/LineChart";
import { useServerState } from "../hooks/useServerState";
import {
  getSystemInfo,
  getServerMetrics,
  getServerInfo,
  getOverviewInfo,
  listPlayers,
  loadServerSettings,
  type SystemInfo,
  type MetricSample,
  type OverviewInfo,
} from "../lib/server";

interface Point {
  value: number;
  time: Date;
}

const MAX_POINTS = 60;

function pad(n: number, len = 2) {
  return String(n).padStart(len, "0");
}

function fmtRuntime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-surface-2 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
        {title}
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-neutral-800/60 py-1.5 text-sm last:border-0">
      <span className="text-neutral-500">{label}</span>
      <span className="max-w-[60%] truncate font-mono text-neutral-100">{value || "—"}</span>
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
  const [overviewInfo, setOverviewInfo] = useState<OverviewInfo | null>(null);
  const [playersResp, setPlayersResp] = useState<{ count: number; max: number }>({
    count: 0,
    max: 0,
  });

  const [mem, setMem] = useState<Point[]>([]);
  const [cpu, setCpu] = useState<Point[]>([]);
  const [playerHist, setPlayerHist] = useState<Point[]>([]);

  const memRef = useRef<Point[]>([]);
  const cpuRef = useRef<Point[]>([]);
  const playerRef = useRef<Point[]>([]);
  const serverDirRef = useRef<string>("");

  useEffect(() => {
    loadServerSettings()
      .then((s) => (serverDirRef.current = s.serverDir))
      .catch(() => {});
    getSystemInfo().then(setSysInfo).catch(() => {});
  }, []);

  const push = useCallback((arr: Point[], value: number, time: Date) => {
    const next = [...arr, { value, time }];
    const over = next.length - MAX_POINTS;
    return over > 0 ? next.slice(over) : next;
  }, []);

  const tick = useCallback(async () => {
    const time = new Date();
    let memMb = 0;
    let cpuPct = 0;
    if (state === "online") {
      try {
        const s: MetricSample = await getServerMetrics();
        memMb = s.memory_mb;
        cpuPct = s.cpu_percent;
      } catch {
        /* process briefly unavailable */
      }
    }

    memRef.current = push(memRef.current, memMb, time);
    cpuRef.current = push(cpuRef.current, cpuPct, time);
    setMem([...memRef.current]);
    setCpu([...cpuRef.current]);

    const nextPlayers = memRef.current.length > 0 && state === "online" ? playersResp.count : 0;
    playerRef.current = push(playerRef.current, nextPlayers, time);
    setPlayerHist([...playerRef.current]);
  }, [state, playersResp.count, push]);

  const refreshStatic = useCallback(async () => {
    try {
      const info = await getServerInfo();
      setServerInfo(info);
    } catch {
      /* not running */
    }
    try {
      const resp = await listPlayers();
      setPlayersResp({ count: resp.count, max: resp.max });
    } catch {
      /* not running */
    }
    if (serverDirRef.current) {
      try {
        setOverviewInfo(await getOverviewInfo(serverDirRef.current));
      } catch {
        /* ignored */
      }
    }
  }, []);

  useEffect(() => {
    tick();
    refreshStatic();
    const id = window.setInterval(() => {
      tick();
      refreshStatic();
    }, 2000);
    return () => window.clearInterval(id);
  }, [tick, refreshStatic]);

  const lastMem = mem[mem.length - 1]?.value ?? 0;
  const lastCpu = cpu[cpu.length - 1]?.value ?? 0;

  const memData = mem.map((p) => p.value / 1024);
  const cpuData = cpu.map((p) => p.value);
  const playerData = playerHist.map((p) => p.value);
  const memTimes = mem.map((p) => p.time);
  const timesCommon = cpu.map((p) => p.time);

  const maxMemGb = Math.max(
    (serverInfo?.max_memory_mb ?? 2048) / 1024,
    ...mem.map((p) => p.value / 1024),
    1,
  );

  const runtime = serverInfo?.uptime_secs ?? 0;

  const statusColor =
    state === "online"
      ? "text-emerald-400"
      : state === "starting" || state === "stopping"
        ? "text-amber-400"
        : "text-red-400";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Overview</h1>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-neutral-800 bg-surface-2 px-3 py-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-current" style={{ color: statusColor }} />
          <span className={`text-xs font-medium ${statusColor}`}>{state.toUpperCase()}</span>
        </div>
      </div>

      {state !== "online" && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Server is not running — data below updates when the server is online.
        </div>
      )}

      {/* Row 1 */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Panel title="Memory Usage">
          <LineChart
            data={memData}
            max={maxMemGb}
            times={memTimes}
            color="#3b82f6"
            currentValue={`${lastMem >= 1024 ? (lastMem / 1024).toFixed(2) : lastMem.toFixed(0)} ${lastMem >= 1024 ? "GB" : "MB"}`}
            yTickFormat={(v) => v.toFixed(1) + "G"}
          />
        </Panel>
        <Panel title="CPU Usage">
          <LineChart
            data={cpuData}
            max={100}
            times={timesCommon}
            color="#a855f7"
            currentValue={`${lastCpu.toFixed(0)}%`}
            yTickFormat={(v) => `${v.toFixed(0)}%`}
          />
        </Panel>
        <Panel title="System Info">
          <div className="flex h-full flex-col justify-center">
            <InfoRow label="Java" value={sysInfo?.java_version ?? ""} />
            <InfoRow
              label="OS"
              value={`${sysInfo?.os ?? ""} ${sysInfo?.os_arch ?? ""}`}
            />
            <InfoRow label="Processors" value={sysInfo ? String(sysInfo.processors) : ""} />
          </div>
        </Panel>
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Panel title="Player History">
          <LineChart
            data={playerData}
            max={Math.max(playersResp.max, 1)}
            times={timesCommon}
            color="#6d5df6"
            currentValue={`${playersResp.count} players`}
            yTickFormat={(v) => String(Math.round(v))}
          />
        </Panel>
        <Panel title="Players Online">
          <div className="flex h-full flex-col items-center justify-center">
            <div className="font-mono text-2xl font-semibold text-white">
              {playersResp.count}
              <span className="text-neutral-500">/{playersResp.max || "?"}</span>
            </div>
            <div className="mt-1 text-xs text-neutral-500">players</div>
          </div>
        </Panel>
        <Panel title="World Info">
          <div className="flex h-full flex-col justify-center">
            <InfoRow label="Player count" value={String(playersResp.count)} />
            <InfoRow label="Runtime" value={fmtRuntime(runtime)} />
            <InfoRow label="Difficulty" value={overviewInfo?.difficulty ?? ""} />
          </div>
        </Panel>
      </div>

      {/* Row 3 */}
      <Panel title="Server Info">
        <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-3">
          <InfoRow label="Software" value={overviewInfo?.software ?? ""} />
          <InfoRow label="Minecraft version" value={overviewInfo?.version ?? ""} />
          <InfoRow label="Server IP" value={overviewInfo?.ip ?? ""} />
        </div>
      </Panel>
    </div>
  );
}