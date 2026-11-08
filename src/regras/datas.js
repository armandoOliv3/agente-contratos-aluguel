// Datas no formato AAAA-MM-DD, tratadas sempre em UTC para o fuso horário
// do computador nunca mudar o resultado.

const DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/

export function partes(data) {
  const m = DATA_ISO.exec(data ?? '')
  if (!m) throw new Error(`Data inválida: ${data}`)
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (mes < 1 || mes > 12 || dia < 1 || dia > diasNoMes(ano, mes)) throw new Error(`Data inválida: ${data}`)
  return { ano, mes, dia }
}

export const dataValida = (data) => {
  try {
    partes(data)
    return true
  } catch {
    return false
  }
}

export const diasNoMes = (ano, mes) => new Date(Date.UTC(ano, mes, 0)).getUTCDate()

export const formatar = (ano, mes, dia) =>
  `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`

// Dia pedido dentro do mês; se o mês não tem esse dia (31 em abril, 29 em fevereiro), usa o último dia
export function diaNoMes(ano, mes, dia) {
  return formatar(ano, mes, Math.min(dia, diasNoMes(ano, mes)))
}

// Soma meses mantendo o dia original quando possível (31/01 + 1 mês = 28 ou 29/02)
export function somarMeses(data, meses, diaOriginal) {
  const { ano, mes, dia } = partes(data)
  const total = ano * 12 + (mes - 1) + meses
  const novoAno = Math.floor(total / 12)
  const novoMes = (total % 12) + 1
  return diaNoMes(novoAno, novoMes, diaOriginal ?? dia)
}

// Mês anterior no formato AAAA-MM (usado para achar o índice de referência do reajuste)
export function mesAnterior(data) {
  const { ano, mes } = partes(data)
  return mes === 1 ? `${ano - 1}-12` : `${ano}-${String(mes - 1).padStart(2, '0')}`
}

export function diasEntre(inicio, fim) {
  const a = partes(inicio)
  const b = partes(fim)
  return Math.round((Date.UTC(b.ano, b.mes - 1, b.dia) - Date.UTC(a.ano, a.mes - 1, a.dia)) / 86_400_000)
}

// Data de hoje (AAAA-MM-DD) no fuso informado
export function hoje(fuso = 'America/Sao_Paulo', agora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora)
}

// 2026-11-08 -> 08/11/2026
export function paraBR(data) {
  if (!data) return '—'
  const { ano, mes, dia } = partes(data)
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`
}
