import { useState } from 'react'
import Layout from './components/Layout'
import WorkoutScreen from './screens/WorkoutScreen'
import ExercisesScreen from './screens/ExercisesScreen'
import TemplatesScreen from './screens/TemplatesScreen'
import HistoryScreen from './screens/HistoryScreen'

export default function App() {
  const [activeTab, setActiveTab] = useState('workout')

  const screen = {
    workout:   <WorkoutScreen />,
    exercises: <ExercisesScreen />,
    templates: <TemplatesScreen />,
    history:   <HistoryScreen />,
  }

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {screen[activeTab]}
    </Layout>
  )
}