import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['assets/**/*'],
    manifest: {
      name: 'Quantos Caras - How Many Dudes',
      short_name: 'QuantosCaras',
      start_url: '/',
      display: 'standalone',
      background_color: '#1a1a2e',
      theme_color: '#1a1a2e',
      icons: [{ src: '/assets/sprites/missing.png', sizes: '192x192', type: 'image/png' }]
    }
  })],
  server: { port: 3000 }
});
