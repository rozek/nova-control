import { resolve } from 'path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/nova-control-node.ts'),
      formats: ['es'],
      fileName: 'nova-control-node',
    },
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      external: /^(node:|[^./])/,
    },
  },
  plugins: [
    dts({ rollupTypes:true, declarationMap:false }),
  ],
})
