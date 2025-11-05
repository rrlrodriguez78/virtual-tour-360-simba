import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      devOptions: {
        enabled: true,
        type: 'module'
      },
      includeAssets: ['favicon.ico', 'icons/*.png', 'splash/*.png', 'lion-original.jpg'],
      manifest: {
        name: 'VirtualTour - Tours Virtuales 360°',
        short_name: 'VirtualTour',
        description: 'Plataforma profesional para crear y compartir tours virtuales interactivos con hotspots 360°. Ideal para bienes raíces, eventos y espacios comerciales.',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        id: 'dev.lovable.virtualtour',
        categories: ['business', 'productivity', 'photo'],
        lang: 'es-ES',
        dir: 'ltr',
        prefer_related_applications: false,
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        screenshots: [
          {
            src: '/screenshots/screenshot-wide.png',
            sizes: '1280x720',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Vista de tours en desktop'
          },
          {
            src: '/screenshots/screenshot-narrow.png',
            sizes: '750x1334',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Vista de tour 360° en móvil'
          }
        ],
        shortcuts: [
          {
            name: 'Crear Tour',
            short_name: 'Nuevo',
            description: 'Crear un nuevo tour virtual',
            url: '/app/tours',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }]
          },
          {
            name: 'Mis Tours',
            short_name: 'Tours',
            description: 'Ver mis tours creados',
            url: '/app/tours',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }]
          }
        ],
        related_applications: [],
        display_override: ['window-controls-overlay', 'standalone', 'minimal-ui', 'browser'],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB limit
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg}'],
        skipWaiting: true,
        clientsClaim: true,
      runtimeCaching: [
        // 🚫 EXCLUIR Google OAuth/Drive (DEBE IR PRIMERO)
        {
          urlPattern: /^https:\/\/(accounts\.google\.com|oauth2\.googleapis\.com)\/.*/i,
          handler: 'NetworkOnly',
          options: {
            cacheName: 'google-oauth-no-cache'
          }
        },
        {
          urlPattern: /^https:\/\/www\.googleapis\.com\/(drive|upload)\/.*/i,
          handler: 'NetworkOnly',
          options: {
            cacheName: 'google-drive-no-cache'
          }
        },
        {
          urlPattern: /^https:\/\/.*\.googleusercontent\.com\/.*/i,
          handler: 'NetworkOnly',
          options: {
            cacheName: 'google-usercontent-no-cache'
          }
        },
        {
          urlPattern: /^https:\/\/.*\.supabase\.co\/functions\/.*/i,
          handler: 'NetworkOnly',
          options: {
            cacheName: 'supabase-functions-no-cache'
          }
        },
        // ✅ Google Fonts (CacheFirst para performance)
        {
          urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'google-fonts-cache',
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 60 * 60 * 24 * 365
            },
            cacheableResponse: {
              statuses: [0, 200]
            }
          }
        },
        {
          urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'gstatic-fonts-cache',
            expiration: {
              maxEntries: 10,
              maxAgeSeconds: 60 * 60 * 24 * 365
            },
            cacheableResponse: {
              statuses: [0, 200]
            }
          }
        }
      ]
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
