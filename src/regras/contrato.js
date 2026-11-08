// Regras do contrato de aluguel: vencimentos, reajustes e alertas.
// Tudo aqui é código comum (sem IA): recebe os dados que o agente extraiu
// e calcula sempre o mesmo resultado para a mesma entrada.

import { dataValida, diaNoMes, diasEntre, mesAnterior, paraBR, partes, somarMeses } from './datas.js'
import { INDICES, INDICES_SUPORTADOS, variacaoAcumulada } from './indices.js'

export const DIAS_ALERTA_FIM = 60
export const DIAS_ALERTA_REAJUSTE = 30

export const arredondar = (valor) => Math.round(valor * 100) / 100

export const fimDoContrato = (c) => somarMeses(c.dataInicio, c.prazoMeses)

// Vencimentos a partir da data base (inclusive), até o fim do contrato
export function proximosVencimentos(c, dataBase, quantidade = 3) {
  const { ano, mes } = partes(dataBase)
  const fim = fimDoContrato(c)
  const datas = []
  for (let i = 0; datas.length < quantidade && i < quantidade + 2; i++) {
    const total = ano * 12 + (mes - 1) + i
    const data = diaNoMes(Math.floor(total / 12), (total % 12) + 1, c.diaVencimento)
    if (data < dataBase || data < c.dataInicio) continue
    if (data > fim) break
    datas.push(data)
  }
  return datas
}

// Datas de aniversário (reajuste) a cada 12 meses, até o fim do contrato
export function datasDeReajuste(c) {
  const { dia } = partes(c.dataInicio)
  const fim = fimDoContrato(c)
  const datas = []
  for (let n = 1; ; n++) {
    const data = somarMeses(c.dataInicio, 12 * n, dia)
    if (data >= fim) break
    datas.push(data)
  }
  return datas
}

/*
 * Reajuste anual pela variação acumulada em 12 meses do índice, no mês anterior
 * ao aniversário do contrato. Se a variação for negativa, o aluguel é mantido
 * (cláusula comum nos contratos: o reajuste nunca reduz o valor).
 */
export function historicoDeReajustes(c, dataBase, tabela = INDICES) {
  let valor = c.valorAluguel
  const aplicados = []
  for (const data of datasDeReajuste(c)) {
    if (data > dataBase) break
    const referencia = mesAnterior(data)
    const variacao = variacaoAcumulada(c.indice, referencia, tabela)
    if (variacao === null) return { valorAtual: valor, aplicados, indisponivel: referencia }
    const anterior = valor
    valor = variacao > 0 ? arredondar(valor * (1 + variacao / 100)) : valor
    aplicados.push({ data, referencia, variacao, anterior, novo: valor, mantido: variacao <= 0 })
  }
  return { valorAtual: valor, aplicados, indisponivel: null }
}

export const CAMPOS_OBRIGATORIOS = ['codigo', 'locatario', 'valorAluguel', 'dataInicio', 'prazoMeses', 'diaVencimento', 'indice']

export function camposInvalidos(c) {
  const problemas = []
  if (!c?.codigo) problemas.push('codigo')
  if (!c?.locatario) problemas.push('locatario')
  if (!(typeof c?.valorAluguel === 'number' && c.valorAluguel > 0)) problemas.push('valorAluguel')
  if (!dataValida(c?.dataInicio)) problemas.push('dataInicio')
  if (!(Number.isInteger(c?.prazoMeses) && c.prazoMeses > 0)) problemas.push('prazoMeses')
  if (!(Number.isInteger(c?.diaVencimento) && c.diaVencimento >= 1 && c.diaVencimento <= 31)) problemas.push('diaVencimento')
  if (!INDICES_SUPORTADOS.includes(c?.indice)) problemas.push('indice')
  return problemas
}

const NOMES_CAMPOS = {
  codigo: 'número do contrato',
  locatario: 'locatário',
  valorAluguel: 'valor do aluguel',
  dataInicio: 'data de início',
  prazoMeses: 'prazo',
  diaVencimento: 'dia do vencimento',
  indice: 'índice de reajuste',
}

/*
 * Junta tudo para uma linha do relatório. Campos que o agente não encontrou
 * não quebram a análise: o que dá para calcular é calculado e o resto vira alerta.
 */
export function analisarContrato(c, dataBase, tabela = INDICES) {
  const invalidos = camposInvalidos(c)
  const alertas = []
  const linha = {
    codigo: c?.codigo ?? null,
    locatario: c?.locatario ?? null,
    imovel: c?.imovel ?? null,
    indice: c?.indice ?? null,
    valorContratado: c?.valorAluguel ?? null,
    valorAtual: null,
    fim: null,
    situacao: 'ativo',
    proximoVencimento: null,
    vencimentos: [],
    proximoReajuste: null,
    reajustes: [],
    alertas,
  }

  if (invalidos.length) {
    alertas.push({ tipo: 'dados-incompletos', mensagem: `Dados não encontrados no contrato: ${invalidos.map((k) => NOMES_CAMPOS[k]).join(', ')}` })
  }

  const temDatas = !['dataInicio', 'prazoMeses'].some((k) => invalidos.includes(k))
  if (!temDatas) {
    linha.situacao = 'revisar'
    return linha
  }

  linha.fim = fimDoContrato(c)
  if (linha.fim <= dataBase) {
    linha.situacao = 'encerrado'
    alertas.push({ tipo: 'encerrado', mensagem: `Contrato encerrado em ${paraBR(linha.fim)}` })
  } else {
    const diasParaFim = diasEntre(dataBase, linha.fim)
    if (diasParaFim <= DIAS_ALERTA_FIM) {
      alertas.push({ tipo: 'fim-proximo', mensagem: `Contrato termina em ${diasParaFim} dias: avaliar renovação` })
    }
  }

  if (!invalidos.includes('diaVencimento') && linha.situacao !== 'encerrado') {
    linha.vencimentos = proximosVencimentos(c, dataBase)
    linha.proximoVencimento = linha.vencimentos[0] ?? null
  }

  const temValorEIndice = !['valorAluguel', 'indice'].some((k) => invalidos.includes(k))
  if (temValorEIndice) {
    const historico = historicoDeReajustes(c, dataBase, tabela)
    linha.valorAtual = historico.valorAtual
    linha.reajustes = historico.aplicados
    if (historico.indisponivel) {
      alertas.push({ tipo: 'indice-indisponivel', mensagem: `Índice ${c.indice} sem dado para ${historico.indisponivel.split('-').reverse().join('/')}` })
    }
    const ultimo = historico.aplicados.at(-1)
    if (ultimo?.mantido) {
      alertas.push({ tipo: 'indice-negativo', mensagem: `Último reajuste (${paraBR(ultimo.data)}) com índice negativo: aluguel mantido` })
    }
  } else if (!invalidos.includes('valorAluguel')) {
    linha.valorAtual = c.valorAluguel
  }

  if (linha.situacao !== 'encerrado') {
    linha.proximoReajuste = datasDeReajuste(c).find((d) => d > dataBase) ?? null
    if (linha.proximoReajuste && diasEntre(dataBase, linha.proximoReajuste) <= DIAS_ALERTA_REAJUSTE) {
      alertas.push({ tipo: 'reajuste-proximo', mensagem: `Reajuste em ${paraBR(linha.proximoReajuste)}` })
    }
  }

  if (invalidos.length) linha.situacao = 'revisar'
  return linha
}

// Totais para o topo do relatório
export function resumir(linhas) {
  const ativos = linhas.filter((l) => l.situacao === 'ativo')
  return {
    total: linhas.length,
    ativos: ativos.length,
    encerrados: linhas.filter((l) => l.situacao === 'encerrado').length,
    paraRevisar: linhas.filter((l) => l.situacao === 'revisar').length,
    comAlertas: linhas.filter((l) => l.alertas.length > 0).length,
    receitaMensal: arredondar(ativos.reduce((soma, l) => soma + (l.valorAtual ?? 0), 0)),
  }
}
