import { Dumbbell, BookOpen, ClipboardList, History } from 'lucide-react'

const tabs = [
  { id: 'workout',   label: 'Workout',   Icon: Dumbbell },
  { id: 'exercises', label: 'Exercises', Icon: BookOpen },
  { id: 'templates', label: 'Templates', Icon: ClipboardList },
  { id: 'history',   label: 'History',   Icon: History },
]

export default function Layout({ activeTab, setActiveTab, children }) {
  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto pb-16">
        {children}
      </div>

      {/* Bottom tab bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 flex">
        {tabs.map(({ id, label, Icon }) => {
          const active = activeTab === id
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-1 text-xs font-medium transition-colors
                ${active ? 'text-blue-400' : 'text-gray-500'}`}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
              <span>{label}</span>
            </button>
          )
        })}
      </div>

    </div>
  )
}