import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Resetea los insumos si la versión de datos cambió
const DATA_VERSION = '2026-06-03-v1'
if (localStorage.getItem('el_data_version') !== DATA_VERSION) {
  localStorage.removeItem('el_insumos')
  localStorage.setItem('el_data_version', DATA_VERSION)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
