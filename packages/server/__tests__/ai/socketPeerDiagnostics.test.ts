import { once } from 'node:events'
import { connect as connectSocket, createServer, type Socket } from 'node:net'
import { buildConnector } from 'undici'
import { describe, expect, it } from 'vitest'

interface PeerSnapshot {
  connecting: boolean
  destroyed: boolean
  readyState: string
  remoteAddress?: string
  remoteFamily?: string
  remotePort?: number
}

function capturePeer(socket: Socket): PeerSnapshot {
  return {
    connecting: socket.connecting,
    destroyed: socket.destroyed,
    readyState: socket.readyState,
    remoteAddress: socket.remoteAddress,
    remoteFamily: socket.remoteFamily,
    remotePort: socket.remotePort,
  }
}

async function connectDirectly(port: number): Promise<Socket> {
  const socket = connectSocket({ host: '127.0.0.1', port })
  await once(socket, 'connect')
  return socket
}

async function connectWithPinnedLookup(port: number, asynchronous: boolean): Promise<Socket> {
  const connector = buildConnector({
    autoSelectFamily: false,
    lookup: (_hostname, _options, callback) => {
      const complete = () => callback(null, '127.0.0.1', 4)
      if (asynchronous) {
        queueMicrotask(complete)
      } else {
        complete()
      }
    },
  })

  return new Promise<Socket>((resolve, reject) => {
    connector(
      { hostname: 'provider.example', port: String(port), protocol: 'http:' },
      (error, socket) => {
        if (error) {
          reject(error)
        } else {
          resolve(socket)
        }
      },
    )
  })
}

describe('socket peer diagnostics', () => {
  it('exposes the connected peer across direct and pinned lookup paths', async () => {
    const server = createServer({ pauseOnConnect: true })
    const sockets: Socket[] = []
    const acceptedSockets = new Set<Socket>()
    server.on('connection', (socket) => {
      acceptedSockets.add(socket)
      socket.once('close', () => acceptedSockets.delete(socket))
    })
    server.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Expected TCP server address')

    try {
      sockets.push(await connectDirectly(address.port))
      sockets.push(await connectWithPinnedLookup(address.port, false))
      sockets.push(await connectWithPinnedLookup(address.port, true))
      await new Promise<void>((resolve) => setImmediate(resolve))

      const snapshots = {
        direct: capturePeer(sockets[0]),
        synchronousLookup: capturePeer(sockets[1]),
        asynchronousLookup: capturePeer(sockets[2]),
      }

      expect(snapshots).toEqual({
        direct: expect.objectContaining({ remoteAddress: '127.0.0.1' }),
        synchronousLookup: expect.objectContaining({ remoteAddress: '127.0.0.1' }),
        asynchronousLookup: expect.objectContaining({ remoteAddress: '127.0.0.1' }),
      })
    } finally {
      for (const socket of sockets) socket.destroy()
      for (const socket of acceptedSockets) socket.destroy()
      server.close()
      await once(server, 'close')
    }
  })
})
