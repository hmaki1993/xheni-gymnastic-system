import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 3001,
        strictPort: true, // Force port 3001, error if busy
        host: true, // Listen on all local IPs
        cors: true,
        allowedHosts: ['.loca.lt'],
        hmr: {
            overlay: false, // Disable the error overlay if it's annoying
        },
    },
});
// Trigger dev server restart 1
