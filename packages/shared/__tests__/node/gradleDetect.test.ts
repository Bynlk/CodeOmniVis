import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  clearDbCache,
  detectGradleFrameworks,
  findBuildFile,
  getDbPath,
  hasDbCache,
} from '../../src/node'

const cleanup: string[] = []

function project(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-gradle-'))
  cleanup.push(root)
  return root
}

afterEach(() => {
  for (const root of cleanup.splice(0)) {
    clearDbCache(root)
    fs.rmSync(root, { recursive: true, force: true })
  }
})

describe('Gradle project detection', () => {
  it('prefers a root Kotlin build and detects Spring plus Exposed', () => {
    const root = project()
    fs.mkdirSync(path.join(root, 'app'), { recursive: true })
    fs.writeFileSync(path.join(root, 'app', 'build.gradle'), 'implementation "io.ktor:ktor-server"')
    fs.writeFileSync(path.join(root, 'build.gradle.kts'), `
      plugins { id("org.springframework.boot") }
      implementation("org.jetbrains:exposed-core")
    `)

    expect(findBuildFile(root)).toBe(path.join(root, 'build.gradle.kts'))
    expect(detectGradleFrameworks(root)).toEqual({
      backendFramework: 'spring',
      databaseType: 'exposed',
      buildFile: path.join(root, 'build.gradle.kts'),
    })
  })

  it('detects Ktor and Room from an app build', () => {
    const root = project()
    fs.mkdirSync(path.join(root, 'app'), { recursive: true })
    fs.writeFileSync(path.join(root, 'app', 'build.gradle.kts'), `
      implementation("io.ktor:ktor-server-core")
      implementation("androidx.room:room-runtime")
    `)

    expect(detectGradleFrameworks(root)).toMatchObject({
      backendFramework: 'ktor',
      databaseType: 'room',
    })
  })

  it('returns conservative unknown values for absent, unrelated, or unreadable builds', () => {
    const absent = project()
    expect(detectGradleFrameworks(absent)).toEqual({
      backendFramework: 'unknown', databaseType: 'unknown', buildFile: null,
    })

    const unrelated = project()
    fs.writeFileSync(path.join(unrelated, 'build.gradle'), 'plugins { kotlin("jvm") }')
    expect(detectGradleFrameworks(unrelated)).toMatchObject({
      backendFramework: 'unknown', databaseType: 'unknown',
    })

    const unreadable = project()
    fs.mkdirSync(path.join(unreadable, 'build.gradle.kts'))
    expect(detectGradleFrameworks(unreadable)).toMatchObject({
      backendFramework: 'unknown', databaseType: 'unknown',
      buildFile: path.join(unreadable, 'build.gradle.kts'),
    })
  })
})

describe('Node cache path helpers', () => {
  it('use a stable project hash and remove only the selected cache', () => {
    const root = project()
    const cachePath = getDbPath(root)
    expect(getDbPath(path.join(root, '.'))).toBe(cachePath)
    expect(hasDbCache(root)).toBe(false)
    fs.writeFileSync(cachePath, 'cache')
    expect(hasDbCache(root)).toBe(true)
    clearDbCache(root)
    expect(hasDbCache(root)).toBe(false)
    clearDbCache(root)
  })
})
