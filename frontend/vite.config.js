import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
<<<<<<< HEAD
    // 👇 新增：允许cpolar域名访问
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:17077', // 确保你的 FastAPI 后端跑在 17077 端口
        changeOrigin: true
        // 🚨 已经删除了 rewrite: (path) => path.replace(/^\/api/, '')
=======
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:17077', 
        changeOrigin: true
>>>>>>> 4885cf3 (第三次前端更改提交)
      }
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  esbuild: {
    loader: 'tsx',
    include: ['src/**/*.js', 'src/**/*.jsx'],
  },
})