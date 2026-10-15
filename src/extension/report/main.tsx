import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../ui/styles.css';
import { initTheme } from '../../ui/lib/theme';
import { ReportApp } from '../../ui/report/ReportApp';

initTheme();
const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <ReportApp />
    </StrictMode>,
  );
}
