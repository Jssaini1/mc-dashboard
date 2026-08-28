import { useCallback, useEffect, useState } from "react";
import { getServerState, type ServerState } from "../lib/server";

export function useServerState(pollMs = 2000) {
  const [state, setState] = useState<ServerState>("stopped");

  const refresh = useCallback(async () => {
    try {
      setState(await getServerState());
    } catch {
      // backend not reachable (e.g. plain browser dev)
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, pollMs);
    return () => window.clearInterval(id);
  }, [refresh, pollMs]);

  return { state, refresh };
}
