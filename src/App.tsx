import { useState } from 'react'
import { SignInButton, SignOutButton, SignedIn, SignedOut, useUser } from '@clerk/clerk-react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../convex/_generated/api'
import './App.css'

function App() {
  const { user } = useUser()
  const tasks = useQuery(api.tasks.list)
  const createTask = useMutation(api.tasks.createTask)
  const toggleTask = useMutation(api.tasks.toggleTask)
  const deleteTask = useMutation(api.tasks.deleteTask)
  const [text, setText] = useState('')

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    if (!text.trim()) return
    await createTask({ text })
    setText('')
  }

  return (
    <main>
      <h1>Mon app Convex</h1>
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
      </SignedIn>
    </main>
  )
}

export default App
