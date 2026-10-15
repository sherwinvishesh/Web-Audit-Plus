import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../ui/styles.css';
import { ReportApp } from '../../ui/report/ReportApp';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <ReportApp />
    </StrictMode>,
  );
}
