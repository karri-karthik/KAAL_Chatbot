import React from 'react';
import ReactDOM from 'react-dom/client';
import { ChatWidget } from './widget/ChatWidget';
import './style.css';

const container = document.getElementById('app');

if (container) {
  const root = ReactDOM.createRoot(container);
  root.render(
    <React.StrictMode>
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
        }}
      >
        <ChatWidget />
      </div>
    </React.StrictMode>,
  );
}

