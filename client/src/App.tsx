import RateLimitBanner from "./components/RateLimitBanner";
import EntriesPanel from "./features/entries/EntriesPanel";
import TreePanel from "./features/tree/TreePanel";

export default function App() {
  return (
    <div className="app-root">
      <RateLimitBanner />
      <h1 className="sr-only">Time Tracker</h1>

      <div className="app-shell">
        <TreePanel />

        <main className="content-panel">
          <EntriesPanel />
        </main>
      </div>
    </div>
  );
}
