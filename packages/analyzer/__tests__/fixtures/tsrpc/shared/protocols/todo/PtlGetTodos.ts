export interface ReqGetTodos { userId: string }
export interface ResGetTodos { todos: Array<{ id: string; content: string }> }
