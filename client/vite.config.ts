import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command, mode }) => {
  // a production build that does not know the API address would call /api on its own host and fail
  if (command === 'build' && !loadEnv(mode, process.cwd(), 'VITE_').VITE_API_URL) {
    console.warn('\nWarning: VITE_API_URL is not set. The built app will call /api on its own address. Set it to the API URL where the client is built.\n')
  }
  return {
    plugins: [react(), tailwindcss()],
    // the API has no path prefix, so /api/* is forwarded to it with the prefix removed
    server: {
      proxy: {
        '/api': {
          target: process.env.API_TARGET ?? 'http://localhost:5000',
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  }
})
