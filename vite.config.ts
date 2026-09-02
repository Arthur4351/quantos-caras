import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * `base: './'` — O JOGO TEM DOIS ENDERECOS.
 *
 * O GitHub Pages serve em `arthur4351.github.io/quantos-caras/` (subpasta) e a
 * Netlify na raiz do dominio. Com o `base` padrao (`/`) o `index.html` construido
 * pede `/assets/index-xxx.js`, que na subpasta do Pages aponta para fora do
 * projeto: tela preta e 404 em todos os modulos. Caminho relativo funciona nos
 * dois, sem build separado por destino.
 *
 * O manifesto do PWA segue a mesma regra: `start_url` e icone absolutos fariam o
 * app instalado abrir na raiz do dominio, fora do jogo.
 */
export default defineConfig({
  base: './',
  plugins: [VitePWA({
    registerType: 'autoUpdate',
    includeAssets: ['assets/**/*'],
    manifest: {
      name: 'Quantos Caras - How Many Dudes',
      short_name: 'QuantosCaras',
      start_url: '.',
      scope: './',
      display: 'standalone',
      background_color: '#1a1a2e',
      theme_color: '#1a1a2e',
      icons: [{ src: 'assets/sprites/missing.png', sizes: '192x192', type: 'image/png' }]
    }
  })],
  server: { port: 3000 }
});
