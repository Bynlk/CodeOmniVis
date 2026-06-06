package com.example.demo.controller

import org.springframework.web.bind.annotation.*
import org.springframework.stereotype.Service

@RestController
@RequestMapping("/api/users")
class UserController(private val userService: UserService) {

    @GetMapping
    fun getAllUsers(): List<User> {
        return userService.findAll()
    }

    @GetMapping("/{id}")
    fun getUserById(@PathVariable id: Long): User? {
        return userService.findById(id)
    }

    @PostMapping
    fun createUser(@RequestBody user: User): User {
        return userService.save(user)
    }

    @DeleteMapping("/{id}")
    fun deleteUser(@PathVariable id: Long) {
        userService.delete(id)
    }
}

@Service
class UserService(private val userRepository: UserRepository) {
    fun findAll(): List<User> = userRepository.findAll()
    fun findById(id: Long): User? = userRepository.findById(id)
    fun save(user: User): User = userRepository.save(user)
    fun delete(id: Long) = userRepository.deleteById(id)
}

data class User(
    val id: Long? = null,
    val name: String,
    val email: String
)
