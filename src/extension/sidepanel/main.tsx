import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../../ui/styles.css';
import { SidePanelApp } from '../../ui/sidepanel/SidePanelApp';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <SidePanelApp />
    </StrictMode>,
  );
}
