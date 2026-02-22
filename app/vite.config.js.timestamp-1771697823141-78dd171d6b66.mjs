// vite.config.js
import { defineConfig } from "file:///F:/MyRestoredProjects/xheni-gymnastic/app/node_modules/vite/dist/node/index.js";
import react from "file:///F:/MyRestoredProjects/xheni-gymnastic/app/node_modules/@vitejs/plugin-react/dist/index.js";
import tailwindcss from "file:///F:/MyRestoredProjects/xheni-gymnastic/app/node_modules/@tailwindcss/vite/dist/index.mjs";
import path from "path";
var __vite_injected_original_dirname = "F:\\MyRestoredProjects\\xheni-gymnastic\\app";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  },
  server: {
    port: 3e3,
    strictPort: true,
    // Force port 3000, error if busy
    host: true,
    // Listen on all local IPs
    cors: true,
    allowedHosts: [".loca.lt"],
    hmr: {
      overlay: false
      // Disable the error overlay if it's annoying
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJGOlxcXFxNeVJlc3RvcmVkUHJvamVjdHNcXFxceGhlbmktZ3ltbmFzdGljXFxcXGFwcFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiRjpcXFxcTXlSZXN0b3JlZFByb2plY3RzXFxcXHhoZW5pLWd5bW5hc3RpY1xcXFxhcHBcXFxcdml0ZS5jb25maWcuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0Y6L015UmVzdG9yZWRQcm9qZWN0cy94aGVuaS1neW1uYXN0aWMvYXBwL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnO1xuaW1wb3J0IHRhaWx3aW5kY3NzIGZyb20gJ0B0YWlsd2luZGNzcy92aXRlJztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gICAgcGx1Z2luczogW1xuICAgICAgICByZWFjdCgpLFxuICAgICAgICB0YWlsd2luZGNzcygpLFxuICAgIF0sXG4gICAgcmVzb2x2ZToge1xuICAgICAgICBhbGlhczoge1xuICAgICAgICAgICAgJ0AnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnLi9zcmMnKSxcbiAgICAgICAgfSxcbiAgICB9LFxuICAgIHNlcnZlcjoge1xuICAgICAgICBwb3J0OiAzMDAwLFxuICAgICAgICBzdHJpY3RQb3J0OiB0cnVlLCAvLyBGb3JjZSBwb3J0IDMwMDAsIGVycm9yIGlmIGJ1c3lcbiAgICAgICAgaG9zdDogdHJ1ZSwgLy8gTGlzdGVuIG9uIGFsbCBsb2NhbCBJUHNcbiAgICAgICAgY29yczogdHJ1ZSxcbiAgICAgICAgYWxsb3dlZEhvc3RzOiBbJy5sb2NhLmx0J10sXG4gICAgICAgIGhtcjoge1xuICAgICAgICAgICAgb3ZlcmxheTogZmFsc2UsIC8vIERpc2FibGUgdGhlIGVycm9yIG92ZXJsYXkgaWYgaXQncyBhbm5veWluZ1xuICAgICAgICB9LFxuICAgIH0sXG59KTtcbi8vIFRyaWdnZXIgZGV2IHNlcnZlciByZXN0YXJ0IDFcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBcVQsU0FBUyxvQkFBb0I7QUFDbFYsT0FBTyxXQUFXO0FBQ2xCLE9BQU8saUJBQWlCO0FBQ3hCLE9BQU8sVUFBVTtBQUhqQixJQUFNLG1DQUFtQztBQUt6QyxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUN4QixTQUFTO0FBQUEsSUFDTCxNQUFNO0FBQUEsSUFDTixZQUFZO0FBQUEsRUFDaEI7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNMLE9BQU87QUFBQSxNQUNILEtBQUssS0FBSyxRQUFRLGtDQUFXLE9BQU87QUFBQSxJQUN4QztBQUFBLEVBQ0o7QUFBQSxFQUNBLFFBQVE7QUFBQSxJQUNKLE1BQU07QUFBQSxJQUNOLFlBQVk7QUFBQTtBQUFBLElBQ1osTUFBTTtBQUFBO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixjQUFjLENBQUMsVUFBVTtBQUFBLElBQ3pCLEtBQUs7QUFBQSxNQUNELFNBQVM7QUFBQTtBQUFBLElBQ2I7QUFBQSxFQUNKO0FBQ0osQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
