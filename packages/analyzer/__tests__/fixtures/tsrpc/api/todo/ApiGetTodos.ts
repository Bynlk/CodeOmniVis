import { ApiCall } from 'tsrpc'
import { ReqGetTodos, ResGetTodos } from '../../shared/protocols/todo/PtlGetTodos'

export async function ApiGetTodos(call: ApiCall<ReqGetTodos, ResGetTodos>) {
  call.succ({ todos: [] })
}
