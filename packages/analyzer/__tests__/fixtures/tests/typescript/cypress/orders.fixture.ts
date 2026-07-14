describe('orders browser', () => {
  beforeEach(() => cy.visit('/orders'))
  it('creates an order', () => {
    cy.request('/api/orders')
  })
})
