import { describe, expect, it } from 'vitest'
import { dataValida, diaNoMes, diasEntre, diasNoMes, hoje, mesAnterior, paraBR, partes, somarMeses } from '../../src/regras/datas.js'

describe('Datas', () => {
  it('lê uma data AAAA-MM-DD', () => {
    expect(partes('2026-11-08')).toEqual({ ano: 2026, mes: 11, dia: 8 })
  })

  it.each(['2026-02-30', '2026-13-01', '08/11/2026', '', null, '2026-1-8'])('recusa data inválida: %s', (d) => {
    expect(dataValida(d)).toBe(false)
    expect(() => partes(d)).toThrow('Data inválida')
  })

  it('aceita 29 de fevereiro só em ano bissexto', () => {
    expect(dataValida('2024-02-29')).toBe(true)
    expect(dataValida('2025-02-29')).toBe(false)
  })

  it('sabe quantos dias tem cada mês', () => {
    expect([diasNoMes(2026, 1), diasNoMes(2026, 2), diasNoMes(2024, 2), diasNoMes(2026, 4)]).toEqual([31, 28, 29, 30])
  })

  it('dia 31 em mês de 30 dias vira o último dia do mês', () => {
    expect(diaNoMes(2026, 4, 31)).toBe('2026-04-30')
    expect(diaNoMes(2026, 2, 31)).toBe('2026-02-28')
    expect(diaNoMes(2024, 2, 30)).toBe('2024-02-29')
  })

  it('soma meses mantendo o dia original quando o mês permite', () => {
    expect(somarMeses('2025-01-31', 1)).toBe('2025-02-28')
    expect(somarMeses('2025-01-31', 2)).toBe('2025-03-31')
    expect(somarMeses('2024-02-29', 12)).toBe('2025-02-28')
    expect(somarMeses('2024-02-29', 48)).toBe('2028-02-29')
    expect(somarMeses('2025-11-15', 3)).toBe('2026-02-15')
  })

  it('soma meses com dia fixo informado', () => {
    expect(somarMeses('2025-02-28', 1, 31)).toBe('2025-03-31')
  })

  it('mês anterior, inclusive na virada do ano', () => {
    expect(mesAnterior('2026-03-01')).toBe('2026-02')
    expect(mesAnterior('2026-01-15')).toBe('2025-12')
  })

  it('conta dias entre duas datas', () => {
    expect(diasEntre('2026-11-08', '2026-12-08')).toBe(30)
    expect(diasEntre('2024-02-28', '2024-03-01')).toBe(2)
    expect(diasEntre('2026-11-08', '2026-11-01')).toBe(-7)
  })

  it('data de hoje no fuso de São Paulo, mesmo quando em UTC já é outro dia', () => {
    expect(hoje('America/Sao_Paulo', new Date('2026-11-09T01:30:00Z'))).toBe('2026-11-08')
    expect(hoje(undefined, new Date('2026-11-08T15:00:00Z'))).toBe('2026-11-08')
  })

  it('formata no padrão brasileiro', () => {
    expect(paraBR('2026-03-05')).toBe('05/03/2026')
    expect(paraBR(null)).toBe('—')
  })
})
