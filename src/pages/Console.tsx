import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useServerLog } from "../hooks/useServerLog";
import { useServerState } from "../hooks/useServerState";
import {
  DEFAULT_SETTINGS,
  loadServerSettings,
  restartServer,
  sendConsoleCommand,
  startServer,
  stopServer,
  stripAnsi,
  toServerConfig,
} from "../lib/server";

const QUICK_COMMANDS = ["list", "save-all", "whitelist list"];

const STATE_STYLES: Record<string, string> = {
  stopped: "text-neutral-400",
  starting: "text-amber-400",
  online: "text-green-400",
  stopping: "text-red-400",
};

const buttonClass =
  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40";

function Console() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [command, setCommand] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const { state, refresh } = useServerState();
  const { lines, append, clear } = useServerLog();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadServerSettings()
      .then(setSettings)
      .catch(() => {});
  }, []);

  const settingsReady =
    settings.serverDir.trim() !== "" &&
    settings.javaPath.trim() !== "" &&
    settings.serverJar.trim().toLowerCase().endsWith(".jar");

  const running = state === "starting" || state === "online" || state === "stopping";

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [lines]);

  async function run(label: string, action: () => Promise<unknown>) {
    setBusy(label);
    try {
      await action();
      await refresh();
    } catch (err) {
      append(`[error] ${err instanceof Error ? err.message : String(err)}`);
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

  function handleSend(e: FormEvent) {
    e.preventDefault();
    const cmd = command.trim();
    if (!cmd || !running) return;
    setCommand("");
    append(`> ${cmd}`);
    run("send", () => sendConsoleCommand(cmd));
  }

  function handleQuick(cmd: string) {
    if (!running) return;
    append(`> ${cmd}`);
    run("send", () => sendConsoleCommand(cmd));
  }

  return (
    <section className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full border border-neutral-800 px-3 py-1 text-xs uppercase tracking-wide">
          <span className={STATE_STYLES[state]}>{state}</span>
        </span>
        <div className="flex gap-2">
          <button
            onClick={handleStart}
            disabled={busy !== null || state !== "stopped" || !settingsReady}
            title={settingsReady ? "Start the server" : "Configure valid settings first"}
            className={`${buttonClass} bg-green-600/90 text-white hover:bg-green-500`}
          >
            Start
          </button>
          <button
            onClick={handleStop}
            disabled={busy !== null || !running}
            className={`${buttonClass} bg-red-600/90 text-white hover:bg-red-500`}
          >
            Stop
          </button>
          <button
            onClick={handleRestart}
            disabled={busy !== null || !running || !settingsReady}
            className={`${buttonClass} bg-neutral-800 text-neutral-200 hover:bg-neutral-700`}
          >
            Restart
          </button>
          <button
            onClick={clear}
            disabled={lines.length === 0}
            className={`${buttonClass} bg-neutral-800 text-neutral-200 hover:bg-neutral-700`}
          >
            Clear
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-neutral-800 bg-black p-3 font-mono text-xs leading-relaxed text-neutral-300"
      >
        {lines.length === 0 ? (
          <p className="text-neutral-600">
            Console is idle. Start the server to see its output here.
          </p>
        ) : (
          lines.map((line, i) => (
            <div key={i} className="whitespace-pre-wrap break-words">
              {stripAnsi(line)}
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSend} className="flex items-center gap-2">
        <span className="font-mono text-sm text-neutral-500">&gt;</span>
        <input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          disabled={!running}
          placeholder={running ? "Type a console command and press Enter" : "Start the server to send commands"}
          autoComplete="off"
          autoFocus
          className="min-w-0 flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 font-mono text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-neutral-500 focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!running || command.trim() === ""}
          className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Send
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        {QUICK_COMMANDS.map((cmd) => (
          <button
            key={cmd}
            onClick={() => handleQuick(cmd)}
            disabled={!running}
            className="rounded-full border border-neutral-700 px-3 py-1 font-mono text-xs text-neutral-300 transition-colors hover:border-neutral-500 hover:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {cmd}
          </button>
        ))}
      </div>
    </section>
  );
}

export default Console;
