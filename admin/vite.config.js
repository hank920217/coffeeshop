import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        order: resolve(__dirname, 'order_page.html'),
        ai: resolve(__dirname, 'ai_generator.html'),
        product_list: resolve(__dirname, 'product_list.html'),
        product_upload: resolve(__dirname, 'product_upload.html'),
      }
    }
  }
});