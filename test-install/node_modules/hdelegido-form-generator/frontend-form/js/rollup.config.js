import { terser } from 'rollup-plugin-terser';

export default {
  input: 'frontend-form/js/index.js',
  output: [
    {
      file: 'dist/form-generator.js',
      format: 'es',
      sourcemap: true
    },
    {
      file: 'dist/form-generator.min.js',
      format: 'es',
      plugins: [terser()],
      sourcemap: true
    }
  ]
};