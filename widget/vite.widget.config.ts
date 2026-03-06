import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// Widget build config – outputs IIFE bundle for script-tag injection
export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: 'src/widget-entry.tsx',
      name: 'AiWebsiteChatbot',
      fileName: () => 'chatbot-widget.iife.js',
      formats: ['iife'],
    },
    rollupOptions: {
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
  },
});

