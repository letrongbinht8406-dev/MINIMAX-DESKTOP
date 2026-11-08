import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: { watch: { ignored: ['**/release/**', '**/dist-electron/**', '**/output/**'] } },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        // 长期不变的依赖独立成块：应用代码改动不再让 React / 图标 / 第三方库整体缓存失效，
        // 也把首屏 App chunk 从单块 1.1MB+ 拆开（P2-7）。
        manualChunks(id) {
          const normalized = id.replace(/\\/g, '/')
          if (!normalized.includes('/node_modules/')) return
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(normalized)) return 'vendor-react'
          if (normalized.includes('/node_modules/lucide-react/')) return 'vendor-icons'
          return 'vendor'
        },
      },
    },
  },
})
