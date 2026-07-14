import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { detectProject } from '../../src/project/detectProject'

describe('detectProject', () => {
  const roots: string[] = []

  function project(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'covis-detect-project-'))
    roots.push(root)
    return root
  }

  afterEach(() => {
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
  })

  it('detects a Next.js, tRPC and Prisma project from one canonical entry', async () => {
    const root = project()
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
      dependencies: {
        next: '15.5.20',
        '@trpc/server': '11.0.0',
        '@prisma/client': '6.0.0',
      },
    }))
    fs.mkdirSync(path.join(root, 'prisma'))
    fs.writeFileSync(path.join(root, 'prisma', 'schema.prisma'), 'model User { id Int @id }')

    const meta = await detectProject(root)

    expect(meta).toMatchObject({
      root: fs.realpathSync.native(root),
      frontendFramework: 'next',
      backendFramework: 'trpc',
      databaseType: 'prisma',
    })
    expect(meta.prismaSchemaPath).toBe('prisma/schema.prisma')
  })

  it('detects Spring and Exposed from a Kotlin Gradle build', async () => {
    const root = project()
    fs.writeFileSync(path.join(root, 'build.gradle.kts'), `
      plugins { id("org.springframework.boot") version "3.5.0" }
      dependencies {
        implementation("org.springframework.boot:spring-boot-starter-web")
        implementation("org.jetbrains.exposed:exposed-core:0.61.0")
      }
    `)

    const meta = await detectProject(root)

    expect(meta.backendFramework).toBe('spring')
    expect(meta.databaseType).toBe('exposed')
    expect(meta.buildFile).toBe(path.join(meta.root, 'build.gradle.kts'))
  })

  it('degrades malformed package JSON to a warning instead of throwing', async () => {
    const root = project()
    fs.writeFileSync(path.join(root, 'package.json'), '{ invalid json')
    const warnings: string[] = []

    const meta = await detectProject(root, undefined, warning => warnings.push(warning.code))

    expect(meta.frontendFramework).toBe('unknown')
    expect(meta.backendFramework).toBe('unknown')
    expect(warnings).toContain('PROJECT_MANIFEST_INVALID')
  })

  it('canonicalizes a symlinked project root with realpath', async () => {
    const root = project()
    const link = `${root}-link`
    roots.push(link)
    fs.symlinkSync(root, link, 'dir')

    const meta = await detectProject(link)

    expect(meta.root).toBe(fs.realpathSync.native(root))
  })

  it('rejects a missing project root as a configuration error', async () => {
    const root = project()
    fs.rmSync(root, { recursive: true, force: true })

    await expect(detectProject(root)).rejects.toMatchObject({ code: 'INVALID_PROJECT_ROOT' })
  })
})
