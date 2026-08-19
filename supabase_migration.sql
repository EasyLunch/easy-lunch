-- ============================================================
-- Easy Lunch — Migración a tablas relacionales
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- INSUMOS
CREATE TABLE IF NOT EXISTS insumos (
  id               TEXT PRIMARY KEY,
  nombre           TEXT NOT NULL,
  categoria        TEXT NOT NULL DEFAULT 'otros',
  precio           NUMERIC NOT NULL DEFAULT 0,
  unidad           TEXT NOT NULL DEFAULT 'kg',
  proveedor        TEXT,
  gramaje          NUMERIC,
  merma_crudo      NUMERIC NOT NULL DEFAULT 0,
  variacion_coccion NUMERIC NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SUBRECETAS
CREATE TABLE IF NOT EXISTS subrecetas (
  id                  TEXT PRIMARY KEY,
  nombre              TEXT NOT NULL,
  familia             TEXT NOT NULL DEFAULT 'otro',
  rendimiento         NUMERIC NOT NULL DEFAULT 1,
  unidad_rendimiento  TEXT NOT NULL DEFAULT 'kg',
  gramaje_unidad      NUMERIC,
  descripcion         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SUBRECETA_INGREDIENTES
CREATE TABLE IF NOT EXISTS subreceta_ingredientes (
  id             TEXT PRIMARY KEY,
  subreceta_id   TEXT NOT NULL REFERENCES subrecetas(id) ON DELETE CASCADE,
  insumo_id      TEXT NOT NULL,
  cantidad       NUMERIC NOT NULL DEFAULT 0,
  unidad         TEXT NOT NULL DEFAULT 'kg',
  crudo          BOOLEAN
);

-- PLATOS
CREATE TABLE IF NOT EXISTS platos (
  id          TEXT PRIMARY KEY,
  nombre      TEXT NOT NULL,
  tipo        TEXT NOT NULL DEFAULT 'clasico',
  porciones   INTEGER NOT NULL DEFAULT 1,
  descripcion TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PLATO_INGREDIENTES
CREATE TABLE IF NOT EXISTS plato_ingredientes (
  id        TEXT PRIMARY KEY,
  plato_id  TEXT NOT NULL REFERENCES platos(id) ON DELETE CASCADE,
  tipo      TEXT NOT NULL,
  ref_id    TEXT NOT NULL,
  cantidad  NUMERIC NOT NULL DEFAULT 0,
  unidad    TEXT NOT NULL DEFAULT 'kg',
  crudo     BOOLEAN
);

-- CLIENTES
CREATE TABLE IF NOT EXISTS clientes (
  id               TEXT PRIMARY KEY,
  nombre           TEXT NOT NULL,
  precio_vianda    NUMERIC NOT NULL DEFAULT 0,
  precio_vianda_xl NUMERIC,
  contacto         TEXT,
  email            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── RLS (Row Level Security) ──────────────────────────────────
ALTER TABLE insumos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE subrecetas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE subreceta_ingredientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE platos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE plato_ingredientes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes             ENABLE ROW LEVEL SECURITY;

-- Política: acceso completo para anon (herramienta interna)
DO $$ BEGIN
  CREATE POLICY "anon_all" ON insumos              FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "anon_all" ON subrecetas           FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "anon_all" ON subreceta_ingredientes FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "anon_all" ON platos               FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "anon_all" ON plato_ingredientes   FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "anon_all" ON clientes             FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Verificar tablas creadas
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
