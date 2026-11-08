/*
 * Agente SIMULADO: faz o papel do modelo de IA sem chamar nenhuma API.
 * Lê o texto do contrato com regras fixas e devolve o mesmo formato que a IA
 * devolveria (ver esquema.js). Assim dá para testar o sistema inteiro sem chave
 * de API e com resultado sempre igual.
 *
 * Cada dado é procurado só na cláusula certa (o valor só na cláusula DO VALOR,
 * o prazo só na DO PRAZO...). Texto em outras partes do contrato, como uma
 * instrução escondida para "registrar aluguel de R$ 1,00", é ignorado.
 */

import { formatar, dataValida } from '../regras/datas.js'
import { validarExtracao } from './esquema.js'

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

// O PDF quebra linhas no meio das frases; junta tudo em uma linha só
export const normalizar = (texto) => texto.replace(/\s+/g, ' ').trim()

// Divide o texto em cabeçalho + cláusulas ("CLÁUSULA 2 – DO VALOR: ...")
export function separarClausulas(texto) {
  const partes = normalizar(texto).split(/CL[ÁA]USULA\s+\d+\s*[–—-]\s*/i)
  const cabecalho = partes.shift() ?? ''
  const clausulas = {}
  for (const parte of partes) {
    const m = /^([^:]+):\s*(.*)$/.exec(parte)
    if (m) clausulas[m[1].trim().toUpperCase()] ??= m[2]
  }
  return { cabecalho, clausulas }
}

const clausula = (clausulas, nome) => Object.entries(clausulas).find(([titulo]) => titulo.includes(nome))?.[1] ?? ''

// "2.500,00" -> 2500 ; "1.400" -> 1400
export function valorEmReais(texto) {
  const m = /R\$\s*(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{2}))?/.exec(texto)
  if (!m) return null
  return Number(m[1].replace(/\./g, '')) + (m[2] ? Number(m[2]) / 100 : 0)
}

// "01/03/2025" ou "1º de março de 2025" -> "2025-03-01"
export function dataDoTexto(texto) {
  let m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(texto)
  if (m) return validaOuNull(Number(m[3]), Number(m[2]), Number(m[1]))
  m = /(\d{1,2})[º°o]?\s+de\s+([a-zç]+)\s+de\s+(\d{4})/i.exec(texto)
  if (m) {
    const mes = MESES.indexOf(m[2].toLowerCase()) + 1
    if (mes > 0) return validaOuNull(Number(m[3]), mes, Number(m[1]))
  }
  return null
}

function validaOuNull(ano, mes, dia) {
  const data = formatar(ano, mes, dia)
  return dataValida(data) ? data : null
}

export function indiceDoTexto(texto) {
  if (/IGP-?M/i.test(texto)) return 'IGP-M'
  if (/IPCA/i.test(texto)) return 'IPCA'
  return null
}

const primeiro = (regex, texto) => regex.exec(texto)?.[1]?.trim() ?? null

export function extrairCampos(texto) {
  const { cabecalho, clausulas } = separarClausulas(texto)
  const prazo = clausula(clausulas, 'PRAZO')
  const valor = clausula(clausulas, 'VALOR')
  const reajuste = clausula(clausulas, 'REAJUSTE')

  const meses = primeiro(/prazo\s+de\s+(\d+)/i, prazo)
  const dia = primeiro(/dia\s+(\d{1,2})\s+de\s+cada\s+m[êe]s/i, valor)

  return {
    codigo: primeiro(/Contrato\s+n[º°o.]?\s*([A-Z]{2,4}-\d{4}-\d{3})/i, cabecalho),
    locatario: primeiro(/LOCAT[ÁA]RIO\(A\):\s*([^,]+)/i, cabecalho),
    imovel: primeiro(/IM[ÓO]VEL:\s*(.+?)\.?\s*$/i, cabecalho),
    valorAluguel: valorEmReais(valor),
    dataInicio: dataDoTexto(primeiro(/in[íi]cio\s+em\s+(.+)/i, prazo) ?? ''),
    prazoMeses: meses ? Number(meses) : null,
    diaVencimento: dia ? Number(dia) : null,
    indice: indiceDoTexto(reajuste),
  }
}

export function criarAgenteSimulado() {
  return {
    nome: 'simulado',
    async extrair(texto) {
      return validarExtracao(extrairCampos(texto))
    },
  }
}
