// Formato que todo agente (simulado ou com IA) precisa devolver.
// A resposta de um modelo de IA pode vir errada ou incompleta, então nada
// passa daqui sem conferir o tipo de cada campo. Campo duvidoso vira null
// e entra em camposAusentes, para aparecer como alerta no relatório.

import { dataValida } from '../regras/datas.js'
import { INDICES_SUPORTADOS } from '../regras/indices.js'

export const CAMPOS = ['codigo', 'locatario', 'imovel', 'valorAluguel', 'dataInicio', 'prazoMeses', 'diaVencimento', 'indice']

const texto = (v) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : null)
const inteiro = (min, max) => (v) => (Number.isInteger(v) && v >= min && v <= max ? v : null)

const VALIDADORES = {
  codigo: texto,
  locatario: texto,
  imovel: texto,
  valorAluguel: (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 10_000_000 ? Math.round(v * 100) / 100 : null),
  dataInicio: (v) => (typeof v === 'string' && dataValida(v) ? v : null),
  prazoMeses: inteiro(1, 600),
  diaVencimento: inteiro(1, 31),
  indice: (v) => (INDICES_SUPORTADOS.includes(v) ? v : null),
}

export function validarExtracao(bruto) {
  const entrada = bruto && typeof bruto === 'object' && !Array.isArray(bruto) ? bruto : {}
  const dados = {}
  for (const campo of CAMPOS) dados[campo] = VALIDADORES[campo](entrada[campo])
  dados.camposAusentes = CAMPOS.filter((c) => dados[c] === null)
  return dados
}
