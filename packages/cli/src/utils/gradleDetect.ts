/**
 * Gradle 构建文件解析
 *
 * 从 build.gradle.kts / build.gradle 中提取依赖和插件信息，
 * 用于检测 Kotlin 框架（Spring Boot、Ktor、Exposed、Room）。
 */

import * as fs from 'fs'
import * as path from 'path'

export interface GradleInfo {
  /** 检测到的后端框架 */
  backendFramework: 'spring' | 'ktor' | 'unknown'
  /** 检测到的数据库 ORM */
  databaseType: 'exposed' | 'room' | 'unknown'
  /** 构建文件路径 */
  buildFile: string | null
}

/**
 * 查找 Gradle 构建文件
 */
export function findBuildFile(root: string): string | null {
  const candidates = [
    'build.gradle.kts',
    'build.gradle',
    'app/build.gradle.kts',
    'app/build.gradle',
    'src/build.gradle.kts',
    'src/build.gradle',
  ]

  for (const candidate of candidates) {
    const fullPath = path.join(root, candidate)
    if (fs.existsSync(fullPath)) {
      return fullPath
    }
  }

  return null
}

/**
 * 解析 Gradle 构建文件，提取框架信息
 */
export function detectGradleFrameworks(root: string): GradleInfo {
  const buildFile = findBuildFile(root)
  if (!buildFile) {
    return { backendFramework: 'unknown', databaseType: 'unknown', buildFile: null }
  }

  try {
    const content = fs.readFileSync(buildFile, 'utf-8')

    const backendFramework = detectKotlinBackendFramework(content)
    const databaseType = detectKotlinDatabaseType(content)

    return { backendFramework, databaseType, buildFile }
  } catch {
    return { backendFramework: 'unknown', databaseType: 'unknown', buildFile }
  }
}

/**
 * 从构建文件内容检测后端框架
 */
function detectKotlinBackendFramework(content: string): 'spring' | 'ktor' | 'unknown' {
  // Spring Boot 检测
  if (
    content.includes('org.springframework.boot') ||
    content.includes('spring-boot-starter') ||
    content.includes('implementation("org.springframework')
  ) {
    return 'spring'
  }

  // Ktor 检测
  if (
    content.includes('io.ktor') ||
    content.includes('ktor-server') ||
    content.includes('implementation("io.ktor')
  ) {
    return 'ktor'
  }

  return 'unknown'
}

/**
 * 从构建文件内容检测数据库类型
 */
function detectKotlinDatabaseType(content: string): 'exposed' | 'room' | 'unknown' {
  // Exposed 检测
  if (
    content.includes('org.jetbrains:exposed') ||
    content.includes('exposed-core') ||
    content.includes('exposed-dao') ||
    content.includes('exposed-jdbc')
  ) {
    return 'exposed'
  }

  // Room 检测
  if (
    content.includes('androidx.room') ||
    content.includes('room-runtime') ||
    content.includes('room-ktx') ||
    content.includes('room-compiler')
  ) {
    return 'room'
  }

  return 'unknown'
}
