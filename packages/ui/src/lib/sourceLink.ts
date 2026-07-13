const WINDOWS_ABSOLUTE_PATH = /^[A-Za-z]:[\\/]/

function isAbsoluteSourcePath(filePath: string): boolean {
  return filePath.startsWith('/')
    || WINDOWS_ABSOLUTE_PATH.test(filePath)
    || filePath.startsWith('\\\\')
}

function normalizeSlashes(filePath: string): string {
  return filePath.replace(/\\/g, '/')
}

function encodeSourcePath(filePath: string): string {
  return filePath
    .split('/')
    .map(segment => encodeURIComponent(segment).replace(/%3A/gi, ':'))
    .join('/')
}

export function buildVsCodeSourceHref(
  projectRoot: string | undefined,
  filePath: string,
  line: number,
): string | undefined {
  const normalizedFilePath = normalizeSlashes(filePath)
  let absolutePath = normalizedFilePath

  if (!isAbsoluteSourcePath(filePath)) {
    if (!projectRoot || !isAbsoluteSourcePath(projectRoot)) return undefined
    const normalizedRoot = normalizeSlashes(projectRoot).replace(/\/+$/, '')
    absolutePath = `${normalizedRoot}/${normalizedFilePath.replace(/^\/+/, '')}`
  }

  // `file` 是 VS Code URI 的 authority；POSIX 根斜杠由 URI path 的首个 `/` 表达。
  const uriPath = absolutePath.startsWith('/') ? absolutePath.slice(1) : absolutePath
  const sourceLine = Number.isFinite(line) && line > 0 ? Math.trunc(line) : 1
  return `vscode://file/${encodeSourcePath(uriPath)}:${sourceLine}`
}
