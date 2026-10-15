import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../ui/styles.css';
import { initTheme } from '../../ui/lib/theme';
import { SidePanelApp } from '../../ui/sidepanel/SidePanelApp';

initTheme();
const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <SidePanelApp />
    </StrictMode>,
  );
}
