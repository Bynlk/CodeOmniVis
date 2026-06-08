import { client } from './client'

async function loadTodos() {
  const ret = await client.callApi('todo/GetTodos', { userId: '123' })
  client.listenMsg('TodoUpdate', msg => console.log(msg))
  client.sendMsg('Chat', { content: 'hello' })
}
