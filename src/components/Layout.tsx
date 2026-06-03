import { ReactNode } from 'react'
import { Tab } from '../App'
import {
  Package2, BookOpen, UtensilsCrossed, CalendarDays, BarChart3, Building2
} from 'lucide-react'

interface NavItem {
  id: Tab
  label: string
  icon: React.FC<{ className?: string }>
}

const NAV_ITEMS: NavItem[] = [
  { id: 'insumos',       label: 'Insumos',       icon: Package2 },
  { id: 'subrecetas',    label: 'Sub-recetas',    icon: BookOpen },
  { id: 'platos',        label: 'Recetas',        icon: UtensilsCrossed },
  { id: 'planificacion', label: 'Planificación',  icon: CalendarDays },
  { id: 'clientes',      label: 'Clientes',       icon: Building2 },
  { id: 'dashboard',     label: 'Dashboard',      icon: BarChart3 },
]

interface Props {
  activeTab: Tab
  setActiveTab: (tab: Tab) => void
  children: ReactNode
}

export default function Layout({ activeTab, setActiveTab, children }: Props) {
  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside
        className="w-56 flex flex-col fixed h-screen"
        style={{ backgroundColor: '#2C3B4B' }}
      >
        {/* Logo area */}
        <div className="px-4 py-5 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)', backgroundColor: '#ffffff' }}>
          <img src="/logo.png" alt="Easy Lunch" style={{ width: '100%', maxWidth: '186px', display: 'block' }} />
        </div>

        {/* Section label */}
        <div className="px-5 pt-5 pb-2">
          <p style={{ fontSize: '10px', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>
            PRODUCCIÓN
          </p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
                style={active ? {
                  backgroundColor: '#D2EA8E',
                  color: '#2C3B4B',
                } : {
                  color: 'rgba(255,255,255,0.65)',
                  backgroundColor: 'transparent',
                }}
                onMouseEnter={e => {
                  if (!active) {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.07)'
                    ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.95)'
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
                    ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.65)'
                  }
                }}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>v0.1.0 — 2026</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-56 flex-1 p-8 min-h-screen bg-gray-50">
        {children}
      </main>
    </div>
  )
}
