/**
 * E-10 / F8 回归测试 — 默认分析入口必须可达 Kotlin 解析路径。
 *
 * 缺陷:Kotlin 解析器未注册进默认工厂、scanDir 排除 .kt、入口项目探测
 * 从不识别 spring/ktor/room/exposed,导致 Kotlin 项目走默认分析时
 * 全程产不出任何 Kotlin 节点(死代码路径)。
 *
 * 本测试用一个最小 Spring + Kotlin 项目跑 runFullAnalysis,锁定:
 *   1. 项目探测通过 Gradle 构建文件识别出 backendFramework === 'spring'
 *   2. .kt 文件被扫描并解析,产出 kotlin_class 节点并落库
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { runFullAnalysis } from '../../src/graph/runFullAnalysis'
import { OmniDatabase } from '../../src/storage/db'

const SPRING_CONTROLLER = `package com.example.demo.controller

import org.springframework.web.bind.annotation.*
import org.springframework.stereotype.Service

@RestController
@RequestMapping("/api/users")
class UserController(private val userService: UserService) {

    @GetMapping
    fun getAllUsers(): List<User> {
        return userService.findAll()
    }
}

@Service
class UserService {
    fun findAll(): List<User> = emptyList()
}

data class User(
    val id: Long? = null,
    val name: String
)
`

const BUILD_GRADLE_KTS = `plugins {
    kotlin("jvm") version "1.9.0"
    id("org.springframework.boot") version "3.1.0"
}

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
}
`

describe('runFullAnalysis Kotlin 默认路径可达性 (E-10/F8)', () => {
  let projectRoot: string
  let dbPath: string

  beforeAll(() => {
    projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codeomnivis-kotlin-'))
    fs.writeFileSync(path.join(projectRoot, 'build.gradle.kts'), BUILD_GRADLE_KTS)
    const ktDir = path.join(projectRoot, 'src', 'main', 'kotlin')
    fs.mkdirSync(ktDir, { recursive: true })
    fs.writeFileSync(path.join(ktDir, 'UserController.kt'), SPRING_CONTROLLER)
    dbPath = path.join(projectRoot, 'graph.db')
  })

  afterAll(() => {
    fs.rmSync(projectRoot, { recursive: true, force: true })
  })

  it('通过 Gradle 构建文件识别出 Spring 后端框架', async () => {
    const result = await runFullAnalysis({ projectRoot, dbPath })
    expect(result.projectMeta.backendFramework).toBe('spring')
  })

  it('扫描并解析 .kt 文件,产出已落库的 Kotlin 节点', async () => {
    await runFullAnalysis({ projectRoot, dbPath })

    const db = new OmniDatabase(dbPath)
    await db.ready()
    try {
      const kotlinNodes = db.getNodesByType('kotlin_class')
      expect(kotlinNodes.length).toBeGreaterThan(0)
      expect(kotlinNodes.some(n => n.name === 'UserController')).toBe(true)
    } finally {
      db.close()
    }
  })
})
