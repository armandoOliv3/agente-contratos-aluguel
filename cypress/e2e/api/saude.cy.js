describe('API: saúde do serviço', () => {
  it('GET /api/saude responde 200 com o agente simulado', () => {
    cy.request('/api/saude').then(({ status, body }) => {
      expect(status).to.eq(200)
      expect(body).to.deep.eq({ status: 'ok', agente: 'simulado' })
    })
  })

  it('rota inexistente responde 404 em JSON', () => {
    cy.request({ url: '/api/nao-existe', failOnStatusCode: false }).then(({ status, body }) => {
      expect(status).to.eq(404)
      expect(body.erro).to.eq('Rota não encontrada')
    })
  })

  it('JSON no lugar de multipart responde 415', () => {
    cy.request({ method: 'POST', url: '/api/contratos/analisar', body: { arquivos: [] }, failOnStatusCode: false }).its('status').should('eq', 415)
  })
})
