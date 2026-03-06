import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// Standard dev/build config for local development
export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: true,
  },
});

