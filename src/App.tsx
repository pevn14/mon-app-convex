import { useState } from 'react'
import { SignInButton, SignOutButton, SignedIn, SignedOut, useUser } from '@clerk/clerk-react'
import { useAction, useMutation, useQuery } from 'convex/react'
import { api } from '../convex/_generated/api'
import './App.css'

function App() {
  const { user } = useUser()
  const tasks = useQuery(api.tasks.list)
  const cronCounter = useQuery(api.crons.getCronCounter)
  const createTask = useMutation(api.tasks.createTask)
  const toggleTask = useMutation(api.tasks.toggleTask)
  const deleteTask = useMutation(api.tasks.deleteTask)
  const fetchPost = useAction(api.actions.fetchPost)
  const importTodo = useAction(api.actions.importTodo)
  const [text, setText] = useState('')
  const [post, setPost] = useState<Record<string, unknown> | null>(null)
  const [postId, setPostId] = useState(1)
  const [todoId, setTodoId] = useState(1)

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    if (!text.trim()) return
    await createTask({ text })
    setText('')
  }

  return (
    <main>
      <h1>Mon app Convex</h1>
      <p>Cron : {cronCounter ?? 0} exécution(s)</p>
      <SignedOut>
        <SignInButton />
      </SignedOut>
      <SignedIn>
        <p>{user?.emailAddresses[0]?.emailAddress}</p>
        <SignOutButton />
        <form onSubmit={handleSubmit}>
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Nouvelle tâche"
          />
          <button type="submit">Ajouter</button>
        </form>
        <div>
          <button type="button" onClick={async () => {
            await importTodo({ id: todoId })
            setTodoId(id => id < 100 ? id + 1 : 1)
          }}>
            Importer todo {todoId}
          </button>
        </div>
        <ul>
          {tasks?.map(task => (
            <li key={task._id}>
              <input
                type="checkbox"
                checked={task.completed}
                onChange={() => toggleTask({ id: task._id, completed: !task.completed })}
              />
              {task.text}
              <button type="button" onClick={() => deleteTask({ id: task._id })}>
                Supprimer
              </button>
            </li>
          ))}
        </ul>
        <div>
          <button type="button" onClick={async () => {
            const result = await fetchPost({ id: postId })
            setPost(result)
            setPostId(id => id < 10 ? id + 1 : 1)
          }}>
            Appeler API externe (post {postId})
          </button>
          {post && <pre>{JSON.stringify(post, null, 2)}</pre>}
        </div>
      </SignedIn>
    </main>
  )
}

export default App
