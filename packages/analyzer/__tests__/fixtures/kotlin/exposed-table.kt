package com.example.exposed

import org.jetbrains.exposed.dao.id.IntIdTable
import org.jetbrains.exposed.dao.IntEntity
import org.jetbrains.exposed.dao.IntEntityClass
import org.jetbrains.exposed.sql.transactions.transaction

object Users : IntIdTable() {
    val name = varchar("name", 50)
    val email = varchar("email", 100)
}

class User(id: Int) : IntEntity(id) {
    companion object : IntEntityClass<User>(Users)
    var name by Users.name
    var email by Users.email
}

object Posts : IntIdTable() {
    val title = varchar("title", 200)
    val userId = reference("user_id", Users)
}

class Post(id: Int) : IntEntity(id) {
    companion object : IntEntityClass<Post>(Posts)
    var title by Posts.title
    var user by User referencedOn Posts.userId
}

fun main() {
    transaction {
        val user = User.new {
            name = "Alice"
            email = "alice@example.com"
        }
        val post = Post.new {
            title = "Hello World"
            this.user = user
        }
        val allUsers = User.all().toList()
    }
}
