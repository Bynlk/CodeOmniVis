import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Disabled
import org.junit.jupiter.api.Nested
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.MethodSource

class CheckoutTest {
    @BeforeEach fun setUp() {}
    @ParameterizedTest
    @MethodSource("expiredCards")
    fun rejectsExpiredCard() {}

    @Nested
    inner class Cards {
        @Disabled @Test fun skipsBlockedCard() {}
    }
}
