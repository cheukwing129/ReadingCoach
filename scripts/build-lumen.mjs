import {build} from 'esbuild';
import {mkdir,rm} from 'node:fs/promises';
await mkdir('dist/vendor',{recursive:true});
await build({entryPoints:['ui/lumen-entry.js'],bundle:true,minify:true,format:'iife',outfile:'dist/vendor/lumen-elements.js',legalComments:'eof'});
await build({entryPoints:['ui/lumen-styles.js'],bundle:true,minify:true,outfile:'dist/vendor/lumen.js',legalComments:'eof'});
await rm('dist/vendor/lumen.js');
