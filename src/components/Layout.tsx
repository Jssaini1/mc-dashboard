import type { ReactNode } from "react";

export type PageId = "status" | "console" | "players" | "metrics" | "settings";

const NAV: { id: PageId; label: string }[] = [
  { id: "status", label: "Status" },
  { id: "console", label: "Console" },
  { id: "players", label: "Players" },
  { id: "metrics", label: "Metrics" },
  { id: "settings", label: "Settings" },
];

interface LayoutProps {
  page: PageId;
  label: string;
  onNavigate: (page: PageId) => void;
  children: ReactNode;
}

function Layout({ page, label, onNavigate, children }: LayoutProps) {
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
          <span className="rounded-full border border-neutral-800 px-3 py-1 text-xs text-neutral-500">
            Offline
          </span>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}

export default Layout;
