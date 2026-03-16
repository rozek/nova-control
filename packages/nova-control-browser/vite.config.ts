import { resolve } from 'path'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/nova-control-browser.ts'),
      formats: ['es'],
      fileName: 'nova-control-browser',
    },
    outDir: 'dist',
    emptyOutDir: false,
  },
  plugins: [
    dts({ rollupTypes:true, declarationMap:false }),
  ],
})
