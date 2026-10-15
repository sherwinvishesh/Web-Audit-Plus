import { defineBackground } from 'wxt/utils/define-background';

export default defineBackground(() => {
  // Toolbar click opens the side panel (no popup).
  void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});
