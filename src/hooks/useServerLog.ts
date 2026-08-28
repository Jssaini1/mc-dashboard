import { useEffect, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

const MAX_LINES = 2000;

export function useServerLog() {
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;
    listen<string>("server-log", (event) => {
      setLines((prev) => [...prev, event.payload].slice(-MAX_LINES));
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  return {
    lines,
    append: (line: string) => setLines((prev) => [...prev, line].slice(-MAX_LINES)),
    clear: () => setLines([]),
  };
}
