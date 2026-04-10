import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import wasm from 'vite-plugin-wasm'

// Set base to '/StarForge/' for GitHub Pages project deployment.
// Update the repo name here if it changes.
const base = process.env.NODE_ENV === 'production' ? '/starforge/' : '/'

export default defineConfig({
  plugins: [react(), tailwindcss(), wasm()],
  base,
})
