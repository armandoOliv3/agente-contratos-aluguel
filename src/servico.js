/*
 * O "serviço" do agente: recebe os PDFs e devolve o relatório pronto.
 *   PDF -> texto -> agente extrai os dados -> regras calculam -> relatório
 * Um arquivo com problema não derruba os outros: ele vai para a lista de erros.
 */

import { lerTextoDoPdf } from './pdf/lerPdf.js'
import { analisarContrato, resumir } from './regras/contrato.js'
import { INDICES } from './regras/indices.js'

export async function analisarArquivos(arquivos, { agente, dataBase, tabela = INDICES }) {
  const contratos = []
  const erros = []

  for (const { nome, conteudo } of arquivos) {
    try {
      const texto = await lerTextoDoPdf(conteudo)
      const dados = await agente.extrair(texto)
      contratos.push({ arquivo: nome, ...analisarContrato(dados, dataBase, tabela) })
    } catch (erro) {
      erros.push({ arquivo: nome, codigo: erro.codigo ?? 'erro-agente', mensagem: erro.message })
    }
  }

  return { dataBase, agente: agente.nome, resumo: resumir(contratos), contratos, erros }
}
