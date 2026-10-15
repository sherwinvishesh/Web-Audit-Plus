import { HistoryPage } from './HistoryPage';
import { RunReport } from './RunReport';

/** `report.html?run=<id>` shows one run; without a run it shows the history. */
export function ReportApp() {
  const runId = new URLSearchParams(location.search).get('run');
  return runId ? <RunReport runId={runId} /> : <HistoryPage />;
}
