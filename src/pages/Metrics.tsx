import { useCallback, useEffect, useState } from "react";
import { useServerState } from "../hooks/useServerState";
import {
  getServerInfo,
  listPlayers,
  type ServerInfo,
  type PlayersResponse,
} from "../lib/server";

function Metrics() {
  const { state } = useServerState();
  const [info, setInfo] = useState<ServerInfo | null>(null);
  const [players, setPlayers] = useState<PlayersResponse>({ count: 0, max: 0, names: [] });

  const refresh = useCallback(async () => {
    try {
      const [i, p] = await Promise.all([getServerInfo(), listPlayers()]);
      setInfo(i);
      setPlayers(p);
    } catch {
      // server might not be running
    }
  }, []);

  useEffect(() => {
    refresh();
    if (state !== "online") return;
    const id = window.setInterval(refresh, 10000);
    return () => window.clearInterval(id);
  }, [refresh, state]);

  const maxMem = info?.max_memory_mb ?? 2048;
  const minMem = info?.min_memory_mb ?? 1024;
  const memPercent = maxMem > 0 ? Math.round((minMem / maxMem) * 100) : 0;

  const uptime = info?.uptime_secs ?? 0;
  const hours = Math.floor(uptime / 3600);
  const mins = Math.floor((uptime % 3600) / 60);

  const running = state === "online";

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Server Metrics
        </h2>
        {!running ? (
          <p className="text-sm text-neutral-500">
            Start the server to view metrics.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="mb-1 text-xs text-neutral-500">Uptime</p>
              <p className="font-mono text-2xl font-semibold text-neutral-100">
                {hours}h {mins}m
              </p>
            </div>
            <div>
              <p className="mb-1 text-xs text-neutral-500">Players</p>
              <p className="font-mono text-2xl font-semibold text-neutral-100">
                {players.count}
                {players.max > 0 && (
                  <span className="text-sm text-neutral-500"> / {players.max}</span>
                )}
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Memory Configuration
        </h2>
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-neutral-400">
                Allocated: {minMem} MB
              </span>
              <span className="text-neutral-500">{memPercent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-neutral-800">
              <div
                className="h-full rounded-full bg-green-500/70 transition-all"
                style={{ width: `${memPercent}%` }}
              />
            </div>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-neutral-400">
                Max: {maxMem} MB
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-neutral-800">
              <div
                className="h-full rounded-full bg-neutral-600"
                style={{ width: "100%" }}
              />
            </div>
          </div>
        </div>
      </section>

      {running && (
        <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Quick Stats
          </h2>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <dt className="text-neutral-500">Server State</dt>
            <dd className="text-neutral-200">{state}</dd>
            <dt className="text-neutral-500">Server Dir</dt>
            <dd className="break-all font-mono text-xs text-neutral-300">
              {info?.server_dir}
            </dd>
            <dt className="text-neutral-500">Jar</dt>
            <dd className="font-mono text-xs text-neutral-300">
              {info?.server_jar}
            </dd>
          </dl>
        </section>
      )}
    </div>
  );
}

export default Metrics;
