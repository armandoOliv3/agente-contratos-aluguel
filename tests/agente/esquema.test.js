import { describe, expect, it } from 'vitest'
import { CAMPOS, validarExtracao } from '../../src/agente/esquema.js'

const VALIDO = {
  codigo: 'CT-1',
  locatario: 'Fulana de Tal',
  imovel: 'Rua A, 1',
  valorAluguel: 1500.5,
  dataInicio: '2025-01-10',
  prazoMeses: 30,
  diaVencimento: 10,
  indice: 'IPCA',
}

describe('validação da resposta do agente', () => {
  it('resposta correta passa sem campos ausentes', () => {
    expect(validarExtracao(VALIDO)).toEqual({ ...VALIDO, camposAusentes: [] })
  })

  it.each([null, undefined, 'texto', 42, ['a']])('resposta que não é objeto (%j): todos os campos ausentes', (bruto) => {
    expect(validarExtracao(bruto).camposAusentes).toEqual(CAMPOS)
  })

  it.each([
    ['valorAluguel', '1500'],
    ['valorAluguel', -10],
    ['valorAluguel', 0],
    ['valorAluguel', Number.NaN],
    ['valorAluguel', Infinity],
    ['dataInicio', '10/01/2025'],
    ['dataInicio', '2025-02-30'],
    ['prazoMeses', 12.5],
    ['prazoMeses', 0],
    ['diaVencimento', 32],
    ['diaVencimento', '10'],
    ['indice', 'INPC'],
    ['indice', 'igp-m'],
    ['codigo', '   '],
    ['locatario', 123],
  ])('%s = %j vira null e entra em camposAusentes', (campo, valor) => {
    const dados = validarExtracao({ ...VALIDO, [campo]: valor })
    expect(dados[campo]).toBeNull()
    expect(dados.camposAusentes).toEqual([campo])
  })

  it('campos extras da IA são descartados', () => {
    const dados = validarExtracao({ ...VALIDO, senha: 'x', __proto__: { admin: true } })
    expect(Object.keys(dados)).toEqual([...CAMPOS, 'camposAusentes'])
  })

  it('arredonda o valor em centavos e limita textos longos', () => {
    const dados = validarExtracao({ ...VALIDO, valorAluguel: 1000.456, locatario: 'a'.repeat(500) })
    expect(dados.valorAluguel).toBe(1000.46)
    expect(dados.locatario).toHaveLength(200)
  })
})
