import { defineConfig } from 'vite';
import uni from '@dcloudio/vite-plugin-uni';

export default defineConfig({
  plugins: [uni()],
  server: {
    port: 5174,
    host: '0.0.0.0',
    proxy: {
      // H5 开发环境下代理 /api 到后端服务，与 client.ts 中 H5 的 BASE_URL='/api' 配合
      '/api': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
    },
  },
});
