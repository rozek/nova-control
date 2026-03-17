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
      // bundle nova-control-node so the MCP server is self-contained and
      // independent of whatever version of nova-control-node is installed from npm
      external: (id) => id !== 'nova-control-node' && /^(node:|[^./])/.test(id),
      output: {
        banner: '#!/usr/bin/env node',
      },
    },
  },
})
