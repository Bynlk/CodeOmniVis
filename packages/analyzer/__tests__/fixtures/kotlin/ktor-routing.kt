package com.example.ktor

import io.ktor.server.application.*
import io.ktor.server.routing.*
import io.ktor.server.response.*
import io.ktor.server.request.*

fun Application.configureRouting() {
    routing {
        get("/api/users") {
            call.respond(listOf(User(1, "Alice", "alice@example.com")))
        }

        post("/api/users") {
            val user = call.receive<User>()
            call.respond(user)
        }

        get("/api/users/{id}") {
            val id = call.parameters["id"]
            call.respond(User(id?.toLongOrNull(), "Test", "test@example.com"))
        }

        delete("/api/users/{id}") {
            call.respondText("Deleted")
        }
    }
}

data class User(
    val id: Long? = null,
    val name: String,
    val email: String
)
