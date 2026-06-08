export interface MsgTodoUpdate {
  todoId: string
  action: 'create' | 'update' | 'delete'
}
