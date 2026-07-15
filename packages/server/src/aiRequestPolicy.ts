import { isIP } from 'node:net'
import { Agent, buildConnector, request as undiciRequest } from 'undici'
import {
  isIpLiteral,
  isLoopbackUpstreamHost,
  normalizeUpstreamIpAddress,
  validateResolvedAddresses,
  validateUpstreamBaseUrl,
} from '@codeomnivis/shared'

export interface AiRequestLimits {
  timeoutMs: number
  maxRequestBytes: number
  maxResponseBytes: number
  maxConcurrentPerIdentity: number
  requestsPerMinute: number
}

export const DEFAULT_AI_LIMITS: AiRequestLimits = {
  timeoutMs: 10_000,
  maxRequestBytes: 256 * 1024,
  maxResponseBytes: 1024 * 1024,
  maxConcurrentPerIdentity: 2,
  requestsPerMinute: 20,
}

export type HostnameResolver = (hostname: string) => Promise<string[]>

export interface UpstreamDestination {
  url: URL
  hostname: string
  address?: string
  family?: 4 | 6
}

export interface AiHttpRequest {
  destination: UpstreamDestination
  headers: Record<string, string>
  body: string
  signal: AbortSignal
}

export interface AiHttpResponse {
  status: number
  body: AsyncIterable<Uint8Array>
  peerAddress?: string
  close: () => Promise<void>
}

export type AiHttpClient = (request: AiHttpRequest) => Promise<AiHttpResponse>

export type AiErrorCode =
  | 'AI_CONCURRENCY_LIMIT'
  | 'AI_DESTINATION_REJECTED'
  | 'AI_RATE_LIMIT'
  | 'AI_REQUEST_INVALID'
  | 'AI_REQUEST_TOO_LARGE'
  | 'AI_RESPONSE_INVALID'
  | 'AI_RESPONSE_TOO_LARGE'
  | 'AI_UPSTREAM_FAILED'
  | 'AI_UPSTREAM_PEER_MISMATCH'
  | 'AI_UPSTREAM_REDIRECT'
  | 'AI_UPSTREAM_TIMEOUT'

export class AiPolicyError extends Error {
  constructor(
    readonly code: AiErrorCode,
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'AiPolicyError'
  }
}

export async function resolveUpstreamDestination(
  baseUrl: string,
  resolver: HostnameResolver,
  allowLoopback = true,
): Promise<UpstreamDestination> {
  const literalCheck = validateUpstreamBaseUrl(baseUrl)
  if (!literalCheck.ok) {
    throw new AiPolicyError('AI_DESTINATION_REJECTED', 400, 'AI base URL is not allowed')
  }
  const url = new URL(baseUrl.replace(/\/+$/u, '') + '/chat/completions')
  const hostname = url.hostname
  if (isLoopbackUpstreamHost(hostname) && !allowLoopback) {
    throw new AiPolicyError('AI_DESTINATION_REJECTED', 400, 'Loopback AI providers are disabled')
  }
  if (hostname === 'localhost') return { url, hostname }
  if (isIpLiteral(hostname)) {
    const family = isIP(hostname.replace(/^\[|\]$/gu, ''))
    return {
      url,
      hostname,
      address: hostname.replace(/^\[|\]$/gu, ''),
      family: family === 6 ? 6 : 4,
    }
  }

  let addresses: string[]
  try {
    addresses = await resolver(hostname)
  } catch {
    throw new AiPolicyError('AI_DESTINATION_REJECTED', 400, 'AI hostname could not be resolved')
  }
  const resolvedCheck = validateResolvedAddresses(addresses)
  if (!resolvedCheck.ok) {
    throw new AiPolicyError(
      'AI_DESTINATION_REJECTED',
      400,
      'AI hostname resolved to a blocked address',
    )
  }
  const address = addresses[0]
  const family = isIP(address)
  if (family !== 4 && family !== 6) {
    throw new AiPolicyError('AI_DESTINATION_REJECTED', 400, 'AI hostname resolution was invalid')
  }
  return { url, hostname, address, family }
}

export async function readBoundedBody(
  body: AsyncIterable<Uint8Array>,
  maxBytes: number,
): Promise<string> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of body) {
    total += chunk.byteLength
    if (total > maxBytes) {
      throw new AiPolicyError('AI_RESPONSE_TOO_LARGE', 502, 'Upstream AI response was too large')
    }
    chunks.push(Buffer.from(chunk))
  }
  return Buffer.concat(chunks, total).toString('utf8')
}

export function matchesValidatedAddress(peerAddress: string, validatedAddress: string): boolean {
  const normalizedPeer = normalizeUpstreamIpAddress(peerAddress)
  const normalizedValidated = normalizeUpstreamIpAddress(validatedAddress)
  return normalizedPeer !== null && normalizedPeer === normalizedValidated
}

export function createPeerMismatchError(
  peerAddress: string | undefined,
  validatedAddress: string,
): Error {
  return new Error(
    `AI upstream peer address did not match validated DNS (peer=${JSON.stringify(peerAddress ?? null)}, validated=${JSON.stringify(validatedAddress)})`,
  )
}

export function schedulePinnedLookup(complete: () => void): void {
  // A synchronous custom lookup leaves peer metadata empty on Windows Node 20.
  queueMicrotask(complete)
}

export async function readConnectedPeerAddress(socket: {
  readonly remoteAddress?: string
}): Promise<string | undefined> {
  // Read only after Node finishes the connector's synchronous `ready` phase.
  await new Promise<void>((resolve) => setImmediate(resolve))
  return socket.remoteAddress || undefined
}

interface PinnedAgent {
  dispatcher: Agent
  getPeerAddress: () => string | undefined
}

function createPinnedAgent(destination: UpstreamDestination): PinnedAgent {
  let peerAddress: string | undefined
  if (!destination.address || !destination.family || isLoopbackUpstreamHost(destination.hostname)) {
    return {
      dispatcher: new Agent({ maxRedirections: 0 }),
      getPeerAddress: () => peerAddress,
    }
  }
  const { address, family } = destination
  const connector = buildConnector({
    // A validated destination contains exactly one pinned address; Node's
    // multi-address family selection would request the incompatible `all` lookup shape.
    autoSelectFamily: false,
    lookup: (_hostname, _options, callback) =>
      schedulePinnedLookup(() => callback(null, address, family)),
  })
  const verifiedConnector: typeof connector = (options, callback) => {
    connector(options, (error, socket) => {
      if (error) {
        callback(error, null)
        return
      }
      void readConnectedPeerAddress(socket).then((resolvedPeerAddress) => {
        peerAddress = resolvedPeerAddress
        if (!peerAddress || !matchesValidatedAddress(peerAddress, address)) {
          socket.destroy()
          callback(createPeerMismatchError(peerAddress, address), null)
          return
        }
        callback(null, socket)
      })
    })
  }
  return {
    dispatcher: new Agent({ connect: verifiedConnector, maxRedirections: 0 }),
    getPeerAddress: () => peerAddress,
  }
}

export const defaultAiHttpClient: AiHttpClient = async (request) => {
  const pinnedAgent = createPinnedAgent(request.destination)
  try {
    const response = await undiciRequest(request.destination.url, {
      method: 'POST',
      headers: request.headers,
      body: request.body,
      dispatcher: pinnedAgent.dispatcher,
      maxRedirections: 0,
      signal: request.signal,
    })
    return {
      status: response.statusCode,
      body: response.body,
      peerAddress: pinnedAgent.getPeerAddress(),
      close: async () => pinnedAgent.dispatcher.close(),
    }
  } catch (err) {
    await pinnedAgent.dispatcher.close().catch(() => {})
    throw err
  }
}
