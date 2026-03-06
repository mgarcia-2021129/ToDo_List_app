import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: [
      'todo-frontend-65nh.onrender.com',
      'localhost'
    ]
  }
})