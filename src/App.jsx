import { useEffect, useState } from 'react'
import { db } from './db'

function App() {
  const [count, setCount] = useState(null)

  useEffect(() => {
    db.exercises.count().then(n => setCount(n))
  }, [])

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-4">Strength App</h1>
        {count === null
          ? <p className="text-gray-400">Loading database...</p>
          : <p className="text-green-400">✓ Database ready — {count} exercises loaded</p>
        }
      </div>
    </div>
  )
}

export default App