import React from 'react';
import ReactDOM from 'react-dom/client';
import { ChatWidget } from './widget/ChatWidget';

const hostId = 'kaal-chatbot-root';

function getDatasetConfig(script: HTMLScriptElement | null) {
  const brandColor = script?.dataset.brandColor || import.meta.env.VITE_WIDGET_BRAND_COLOR || '#1E3A5F';
  const position = (script?.dataset.position || import.meta.env.VITE_WIDGET_POSITION || 'bottom-right') as
    | 'bottom-right'
    | 'bottom-left';
  const apiBaseUrl = script?.dataset.apiUrl || import.meta.env.VITE_API_BASE_URL;

  return { brandColor, position, apiBaseUrl };
}

function mountWidget() {
  if (document.getElementById(hostId)) {
    return;
  }

  const scriptTag = document.currentScript as HTMLScriptElement | null;
  const config = getDatasetConfig(scriptTag);

  const host = document.createElement('div');
  host.id = hostId;
  const shadow = host.attachShadow({ mode: 'closed' });
  document.body.appendChild(host);

  const widgetRoot = document.createElement('div');
  shadow.appendChild(widgetRoot);

  const root = ReactDOM.createRoot(widgetRoot);
  root.render(
    <React.StrictMode>
      <ChatWidget brandColor={config.brandColor} position={config.position} apiBaseUrl={config.apiBaseUrl} />
    </React.StrictMode>,
  );
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  mountWidget();
} else {
  window.addEventListener('DOMContentLoaded', mountWidget);
}

