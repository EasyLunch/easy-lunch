import { ReactNode, useRef } from 'react'
import { Tab } from '../App'
import {
  Package2, BookOpen, UtensilsCrossed, CalendarDays, BarChart3, Building2,
  Download, Upload, CloudDownload
} from 'lucide-react'
import { supabase } from '../lib/supabase'

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

const BACKUP_KEYS = [
  'el_platos', 'el_insumos', 'el_subrecetas', 'el_pedidos',
  'el_historial', 'el_clientes', 'el_historial_clientes',
  'el_xl_porcentaje', 'el_data_version',
]

function exportBackup() {
  const data: Record<string, unknown> = {}
  for (const key of BACKUP_KEYS) {
    const val = localStorage.getItem(key)
    if (val) data[key] = JSON.parse(val)
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `easylunch-backup-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 100)
}

function importBackup(file: File) {
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string)
      for (const key of BACKUP_KEYS) {
        if (data[key] !== undefined) {
          localStorage.setItem(key, JSON.stringify(data[key]))
        }
      }
      window.location.reload()
    } catch {
      alert('Archivo inválido. Usá un backup generado por Easy Lunch.')
    }
  }
  reader.readAsText(file)
}

async function syncFromCloud() {
  if (!confirm('¿Cargar todos los datos desde la nube?\nEsto reemplazará los datos actuales de esta computadora.')) return
  const keys = BACKUP_KEYS.filter(k => k !== 'el_data_version')
  let loaded = 0
  for (const key of keys) {
    const { data, error } = await supabase
      .from('app_data')
      .select('value')
      .eq('key', key)
      .maybeSingle()
    if (error) { console.error('[Supabase] Error loading', key, error); continue }
    if (data?.value !== undefined) {
      localStorage.setItem(key, JSON.stringify(data.value))
      loaded++
    }
  }
  if (loaded > 0) {
    window.location.reload()
  } else {
    alert('No se encontraron datos en la nube.')
  }
}

interface Props {
  activeTab: Tab
  setActiveTab: (tab: Tab) => void
  children: ReactNode
}

export default function Layout({ activeTab, setActiveTab, children }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)

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

        {/* Backup / Restore / Cloud */}
        <div className="px-3 pb-3 space-y-1">
          <p style={{ fontSize: '10px', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.35)', fontWeight: 500, paddingLeft: '4px', paddingBottom: '4px' }}>
            DATOS
          </p>
          <button
            onClick={exportBackup}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all"
            style={{ color: 'rgba(255,255,255,0.65)', backgroundColor: 'transparent' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.07)'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.95)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.65)'
            }}
          >
            <Download className="w-3.5 h-3.5 flex-shrink-0" />
            Exportar backup
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all"
            style={{ color: 'rgba(255,255,255,0.65)', backgroundColor: 'transparent' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.07)'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.95)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.65)'
            }}
          >
            <Upload className="w-3.5 h-3.5 flex-shrink-0" />
            Restaurar backup
          </button>
          <button
            onClick={syncFromCloud}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all"
            style={{ color: 'rgba(255,255,255,0.65)', backgroundColor: 'transparent' }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.07)'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.95)'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.65)'
            }}
          >
            <CloudDownload className="w-3.5 h-3.5 flex-shrink-0" />
            Sincronizar nube
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) importBackup(file)
              e.target.value = ''
            }}
          />
        </div>

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
