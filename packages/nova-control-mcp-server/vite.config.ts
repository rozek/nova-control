import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/nova-control-mcp-server.ts'),
      formats: ['es'],
      fileName: 'nova-control-mcp-server',
    },
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      external: /^(node:|[^./])/,
      output: {
        banner: '#!/usr/bin/env node',
      },
    },
  },
})
