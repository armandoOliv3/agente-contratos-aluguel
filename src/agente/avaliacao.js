/*
 * Avaliação do agente: compara o que ele extraiu com o gabarito (a resposta certa
 * de cada contrato) e calcula a taxa de acerto por campo. É o "teste" de um agente:
 * se a taxa cair abaixo do mínimo, alguma mudança piorou a leitura dos contratos.
 */

import { CAMPOS } from './esquema.js'

export function compararComGabarito(extraido, esperado) {
  return CAMPOS.map((campo) => ({
    campo,
    esperado: esperado[campo] ?? null,
    obtido: extraido[campo] ?? null,
    acertou: (esperado[campo] ?? null) === (extraido[campo] ?? null),
  }))
}

export function calcularAcuracia(resultados) {
  const porCampo = {}
  let acertos = 0
  let total = 0
  for (const { comparacao } of resultados) {
    for (const { campo, acertou } of comparacao) {
      porCampo[campo] ??= { acertos: 0, total: 0 }
      porCampo[campo].total++
      total++
      if (acertou) {
        porCampo[campo].acertos++
        acertos++
      }
    }
  }
  return { acuracia: total ? acertos / total : 0, acertos, total, porCampo }
}
