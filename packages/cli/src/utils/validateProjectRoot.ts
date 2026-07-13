import * as fs from 'fs'
import * as path from 'path'

/** Resolve and validate the project directory before starting any long-lived process. */
export function validateProjectRoot(project: string): string {
  const projectRoot = path.resolve(project)
  if (!fs.existsSync(projectRoot) || !fs.statSync(projectRoot).isDirectory()) {
    throw new Error(`Project root is not an existing directory: ${projectRoot}`)
  }
  return projectRoot
}
