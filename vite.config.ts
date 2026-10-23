import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // The portfolio serves this from /lab/<id>/, not the site root, so every
  // file the page loads must be addressed relative to the page (D14).
  base: './',
})
