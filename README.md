# Easy Lunch — Plataforma de Producción

Plataforma web para gestionar la producción de viandas corporativas.

## 🚀 Cómo levantarlo

### Requisitos
- Node.js 18 o superior → [descargar acá](https://nodejs.org)

### Pasos

```bash
# 1. Entrar a la carpeta del proyecto
cd easy-lunch-frontend

# 2. Instalar dependencias (solo la primera vez)
npm install

# 3. Levantar el servidor de desarrollo
npm run dev
```

Luego abrí el navegador en: **http://localhost:5173**

---

## 📁 Estructura del proyecto

```
src/
├── types/index.ts          # Tipos TypeScript (Insumo, Plato, etc.)
├── hooks/useLocalStorage.ts # Persistencia en localStorage
├── data/mockData.ts         # Datos de ejemplo iniciales
├── components/Layout.tsx    # Sidebar y navegación
└── pages/
    ├── Insumos.tsx          # Gestión de insumos
    ├── SubRecetas.tsx       # Sub-recetas
    ├── Platos.tsx           # Recetas de platos
    ├── Planificacion.tsx    # Planificación semanal + compras
    └── Dashboard.tsx        # Estadísticas
```

## 📊 Funcionalidades

| Módulo | Descripción |
|---|---|
| **Insumos** | CRUD completo con categorías, merma en crudo, variación post-cocción, proveedor e historial de precios |
| **Sub-recetas** | Salsas, guarniciones, bases — con cálculo de costo automático |
| **Recetas** | Platos con ingredientes (insumos + sub-recetas), cálculo de costo y peso final por vianda |
| **Planificación** | Upload de Excel con pedidos semanales → lista de compras con cantidades brutas (merma incluida) |
| **Dashboard** | Gráficos de platos por tipo, viandas por semana e historial de precios |

## 📋 Formato del Excel de pedidos

El archivo debe tener dos columnas:

| plato | cantidad |
|---|---|
| Pollo al horno con papas | 50 |
| Ensalada caprese | 30 |

> Los nombres deben coincidir exactamente con los nombres cargados en la solapa Recetas.
> Podés descargar una plantilla desde la solapa Planificación.

## 💾 Persistencia de datos

Los datos se guardan en el `localStorage` del navegador. Para conectar con una base de datos real (PostgreSQL), el siguiente paso es construir el backend con Python + FastAPI.

## 🔧 Próximos pasos

- [ ] Backend Python + FastAPI
- [ ] Base de datos PostgreSQL
- [ ] Autenticación de usuarios
- [ ] Multi-empresa / multi-usuario
- [ ] Exportación de reportes PDF
