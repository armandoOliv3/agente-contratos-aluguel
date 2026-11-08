// Escolhe o agente: com ANTHROPIC_API_KEY usa a IA; sem ela, o simulado (padrão do projeto).
import { criarAgenteClaude } from './agenteClaude.js'
import { criarAgenteSimulado } from './agenteSimulado.js'

export function criarAgente(env = process.env, opcoes = {}) {
  if (env.ANTHROPIC_API_KEY) {
    return criarAgenteClaude({ apiKey: env.ANTHROPIC_API_KEY, modelo: env.ANTHROPIC_MODEL || undefined, ...opcoes })
  }
  return criarAgenteSimulado()
}
