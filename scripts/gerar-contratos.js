// Grava os PDFs dos contratos fictícios e o gabarito em contratos/.
// Uso: npm run contratos
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CONTRATOS } from './contratos-ficticios.js'
import { gerarPdfContrato } from './pdf-contrato.js'

const PASTA = join(dirname(fileURLToPath(import.meta.url)), '..', 'contratos')

mkdirSync(PASTA, { recursive: true })
const gabarito = {}
for (const c of CONTRATOS) {
  writeFileSync(join(PASTA, c.arquivo), await gerarPdfContrato(c))
  gabarito[c.arquivo] = { caso: c.caso, esperado: c.esperado }
}
writeFileSync(join(PASTA, 'gabarito.json'), JSON.stringify(gabarito, null, 2) + '\n')
console.log(`${CONTRATOS.length} contratos gerados em contratos/`)
