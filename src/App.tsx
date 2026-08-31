import { useState } from "react";
import Layout, { type PageId } from "./components/Layout";
import Overview from "./pages/Overview";
import Status from "./pages/Status";
import Console from "./pages/Console";
import Players from "./pages/Players";
import Metrics from "./pages/Metrics";
import Settings from "./pages/Settings";
import { useServerState } from "./hooks/useServerState";
import type { ComponentType } from "react";

const PAGES: Record<PageId, { label: string; component: ComponentType }> = {
  overview: { label: "Overview", component: Overview },
  status: { label: "Status", component: Status },
  console: { label: "Console", component: Console },
  players: { label: "Players", component: Players },
  metrics: { label: "Metrics", component: Metrics },
  settings: { label: "Settings", component: Settings },
};

function App() {
  const [page, setPage] = useState<PageId>("status");
  const { state } = useServerState();
  const Active = PAGES[page].component;

  return (
    <Layout page={page} label={PAGES[page].label} serverState={state} onNavigate={setPage}>
      <Active />
    </Layout>
  );
}

export default App;
