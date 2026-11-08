// Mede quanto o agente acerta nos contratos fictícios.
// Uso: npm run avaliar            (mínimo padrão: 95% de acerto)
//      ACURACIA_MINIMA=0.9 npm run avaliar
// Sai com código 1 se ficar abaixo do mínimo, para falhar o CI.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { criarAgente } from '../src/agente/index.js'
import { calcularAcuracia, compararComGabarito } from '../src/agente/avaliacao.js'
import { lerTextoDoPdf } from '../src/pdf/lerPdf.js'

const PASTA = join(dirname(fileURLToPath(import.meta.url)), '..', 'contratos')
const MINIMO = Number(process.env.ACURACIA_MINIMA ?? 0.95)

let gabarito
try {
  gabarito = JSON.parse(readFileSync(join(PASTA, 'gabarito.json'), 'utf8'))
} catch {
  console.error('contratos/gabarito.json não encontrado. Rode antes: npm run contratos')
  process.exit(1)
}

const agente = criarAgente()
const resultados = []
for (const [arquivo, { caso, esperado }] of Object.entries(gabarito)) {
  const extraido = await agente.extrair(await lerTextoDoPdf(readFileSync(join(PASTA, arquivo))))
  const comparacao = compararComGabarito(extraido, esperado)
  resultados.push({ arquivo, comparacao })
  const erros = comparacao.filter((c) => !c.acertou)
  console.log(`${erros.length ? '✗' : '✓'} ${arquivo}  ${caso}`)
  for (const e of erros) console.log(`    ${e.campo}: esperado ${JSON.stringify(e.esperado)}, obtido ${JSON.stringify(e.obtido)}`)
}

const { acuracia, acertos, total, porCampo } = calcularAcuracia(resultados)
console.log(`\nAgente: ${agente.nome}`)
for (const [campo, r] of Object.entries(porCampo)) console.log(`  ${campo.padEnd(14)} ${r.acertos}/${r.total}`)
console.log(`\nAcerto geral: ${(acuracia * 100).toFixed(1)}% (${acertos}/${total}), mínimo ${(MINIMO * 100).toFixed(0)}%`)
if (acuracia < MINIMO) {
  console.error('Abaixo do mínimo.')
  process.exit(1)
}
