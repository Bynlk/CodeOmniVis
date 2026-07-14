import io.kotest.core.spec.style.FunSpec

class CheckoutSpec : FunSpec({
    beforeEach { }
    test("accepts valid card") { }
    context("expired cards") {
        test("rejects expired card") { }
    }
})
