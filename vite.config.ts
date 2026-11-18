import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base relativa: a pasta dist/ abre em qualquer servidor local, sem publicação na internet
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5180 },
})
