-- Esquema inicial PostGIS para EcoPlan Urbano

CREATE EXTENSION IF NOT EXISTS postgis;

-- Tabla de unidades espaciales (barrios / distritos)
CREATE TABLE IF NOT EXISTS spatial_units (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  level TEXT NOT NULL, -- distrito, barrio, cuadrícula
  population INTEGER,
  geom GEOMETRY(MultiPolygon, 4326) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_spatial_units_geom ON spatial_units USING GIST (geom);

-- Tabla de indicadores por temática
CREATE TABLE IF NOT EXISTS indicators (
  id SERIAL PRIMARY KEY,
  spatial_unit_id INTEGER REFERENCES spatial_units(id) ON DELETE CASCADE,
  indicator_type TEXT NOT NULL, -- ndvi_mean, lst_max, pm25_mean, etc.
  value NUMERIC,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_indicators_spatial_unit ON indicators (spatial_unit_id);
CREATE INDEX IF NOT EXISTS idx_indicators_type ON indicators (indicator_type);
CREATE INDEX IF NOT EXISTS idx_indicators_period ON indicators (period_start, period_end);

-- Tabla de reportes ciudadanos
CREATE TABLE IF NOT EXISTS citizen_reports (
  id SERIAL PRIMARY KEY,
  report_type TEXT NOT NULL, -- falta_arboles, inundacion, basura, humo, etc.
  description TEXT,
  status TEXT DEFAULT 'pendiente',
  reported_at TIMESTAMP DEFAULT NOW(),
  geom GEOMETRY(Point, 4326) NOT NULL,
  media_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_citizen_reports_geom ON citizen_reports USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_citizen_reports_status ON citizen_reports (status);

-- Tabla de capas externas (SEDAC, NASA, etc.) para controlar versiones
CREATE TABLE IF NOT EXISTS external_datasets (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  dataset_name TEXT NOT NULL,
  version TEXT,
  acquisition_date DATE,
  metadata JSONB DEFAULT '{}'::jsonb,
  imported_at TIMESTAMP DEFAULT NOW()
);

-- Vista ejemplo: índice de vulnerabilidad al calor combinado
CREATE OR REPLACE VIEW vw_heat_vulnerability AS
SELECT
  su.id,
  su.name,
  SUM(CASE WHEN indicator_type = 'heat_index' THEN value ELSE 0 END) AS heat_index,
  SUM(CASE WHEN indicator_type = 'ndvi_mean' THEN value ELSE 0 END) AS ndvi_mean,
  SUM(CASE WHEN indicator_type = 'population_density' THEN value ELSE 0 END) AS population_density
FROM indicators i
JOIN spatial_units su ON su.id = i.spatial_unit_id
GROUP BY su.id, su.name;
