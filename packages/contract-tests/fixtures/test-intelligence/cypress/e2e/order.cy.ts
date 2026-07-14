describe('orders in Cypress', () => {
  beforeEach(() => cy.visit('/'))

  it('loads orders', () => {
    cy.request('/api/orders')
  })
})
