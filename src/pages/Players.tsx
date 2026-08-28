import { useCallback, useEffect, useState } from "react";
import { useServerState } from "../hooks/useServerState";
import { listPlayers, type PlayersResponse } from "../lib/server";

const POLL_MS = 10000;

function Players() {
  const { state } = useServerState();
  const [players, setPlayers] = useState<PlayersResponse>({ count: 0, max: 0, names: [] });
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(0);

  const refresh = useCallback(async () => {
    if (state !== "online") {
      setPlayers({ count: 0, max: 0, names: [] });
      setError(null);
      return;
    }
    try {
      const res = await listPlayers();
      setPlayers(res);
      setError(null);
      setLastRefresh(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [state]);

  useEffect(() => {
    refresh();
    if (state !== "online") return;
    const id = window.setInterval(refresh, POLL_MS);
    return () => window.clearInterval(id);
  }, [refresh, state]);

  const running = state === "online";

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Online Players
          </h2>
          {running && (
            <button
              onClick={refresh}
              className="rounded-md border border-neutral-700 px-3 py-1 text-xs text-neutral-400 transition-colors hover:border-neutral-500 hover:text-neutral-200"
            >
              Refresh
            </button>
          )}
        </div>

        {!running ? (
          <p className="text-sm text-neutral-500">
            Start the server to see online players.
          </p>
        ) : error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : players.count === 0 ? (
          <p className="text-sm text-neutral-500">No players online.</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-neutral-300">
              <span className="font-semibold text-neutral-100">{players.count}</span>
              {players.max > 0 && (
                <span className="text-neutral-500"> / {players.max}</span>
              )}
              {" "}players online
            </p>
            <ul className="flex flex-wrap gap-2">
              {players.names.map((name) => (
                <li
                  key={name}
                  className="rounded-md bg-neutral-800 px-3 py-1.5 text-sm text-neutral-200"
                >
                  {name}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {running && lastRefresh > 0 && (
        <p className="text-xs text-neutral-600">
          Last updated: {new Date(lastRefresh).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}

export default Players;
