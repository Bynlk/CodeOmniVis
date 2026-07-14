package fixture.orders

import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/kotlin/orders")
class OrderController {
    @GetMapping
    fun listOrders(): List<String> = emptyList()
}
