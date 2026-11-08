// Formatação usada nos dois relatórios (PDF e planilha)
import { paraBR } from '../regras/datas.js'

export const moeda = (valor) =>
  valor === null || valor === undefined
    ? '—'
    : `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const SITUACOES = { ativo: 'Ativo', encerrado: 'Encerrado', revisar: 'Revisar' }

export const textoAlertas = (linha) => linha.alertas.map((a) => a.mensagem).join('; ')

export const data = paraBR

export const nomeDoArquivo = (dataBase, extensao) => `relatorio-contratos-${dataBase}.${extensao}`

// Linhas mais urgentes primeiro: revisar, depois com alertas, depois o resto (e por código)
const PESO = { revisar: 0, ativo: 1, encerrado: 2 }
export function ordenarParaRelatorio(contratos) {
  return [...contratos].sort(
    (a, b) =>
      PESO[a.situacao] - PESO[b.situacao] ||
      (b.alertas.length > 0) - (a.alertas.length > 0) ||
      String(a.codigo ?? a.arquivo).localeCompare(String(b.codigo ?? b.arquivo)),
  )
}
