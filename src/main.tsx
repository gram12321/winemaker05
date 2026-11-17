import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import ConnectedApp from './client/ConnectedApp';
import './styles.css';

const root = document.getElementById('root');

if (!root) throw new Error('Application root element is missing.');

createRoot(root).render(
  <StrictMode>
    <ConnectedApp />
  </StrictMode>,
);
