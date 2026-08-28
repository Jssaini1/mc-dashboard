import type { ReactNode } from "react";
import type { ServerState } from "../lib/server";

export type PageId = "status" | "console" | "players" | "metrics" | "settings";

const NAV: { id: PageId; label: string }[] = [
  { id: "status", label: "Status" },
  { id: "console", label: "Console" },
  { id: "players", label: "Players" },
  { id: "metrics", label: "Metrics" },
  { id: "settings", label: "Settings" },
];

const STATE_COLORS: Record<ServerState, string> = {
  stopped: "border-neutral-800 text-neutral-500",
  starting: "border-amber-700/50 text-amber-400",
  online: "border-green-700/50 text-green-400",
  stopping: "border-red-700/50 text-red-400",
};

const STATE_LABELS: Record<ServerState, string> = {
  stopped: "Offline",
  starting: "Starting...",
  online: "Online",
  stopping: "Stopping...",
};

interface LayoutProps {
  page: PageId;
  label: string;
  serverState: ServerState;
  onNavigate: (page: PageId) => void;
  children: ReactNode;
}

function Layout({ page, label, serverState, onNavigate, children }: LayoutProps) {
  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-200">
      <aside className="flex w-52 flex-col border-r border-neutral-800 bg-neutral-900">
        <div className="border-b border-neutral-800 px-4 py-4 text-sm font-semibold tracking-wide text-neutral-100">
          MC Dashboard
        </div>
        <nav className="flex flex-col gap-1 p-2">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`rounded-md px-3 py-2 text-left text-sm transition-colors ${
                page === item.id
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
          <h1 className="text-lg font-semibold text-neutral-100">{label}</h1>
          <span
            className={`rounded-full border px-3 py-1 text-xs ${STATE_COLORS[serverState]}`}
          >
            {STATE_LABELS[serverState]}
          </span>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}

export default Layout;
