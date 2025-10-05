-- ============================================================================
-- ESQUEMA DE MICRO-ENCUESTAS DE 1 CLIC PARA REPORTES CIUDADANOS
-- ============================================================================
-- Implementa un sistema ultraligero de recolección de contexto mediante
-- chips de respuesta rápida. Los resultados se agregan por barrio para
-- análisis espacial y correlación con índices GEE.
-- ============================================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================================================
-- 1. TABLA: survey_templates
-- Define las preguntas y opciones de las micro-encuestas
-- ============================================================================
CREATE TABLE IF NOT EXISTS survey_templates (
  id SERIAL PRIMARY KEY,
  question_key TEXT UNIQUE NOT NULL, -- identificador único (ej: 'duration', 'vulnerable_groups')
  question_text TEXT NOT NULL, -- "¿Hace cuánto persiste?"
  question_icon TEXT, -- emoji/icono
  category TEXT, -- categoría de reporte a la que aplica (null = todas)
  options JSONB NOT NULL, -- [{value: '1day', label: '< 1 día', icon: '📅'}, ...]
  display_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_survey_templates_category ON survey_templates(category) WHERE active = true;
CREATE INDEX idx_survey_templates_order ON survey_templates(display_order);

-- ============================================================================
-- 2. TABLA: survey_responses
-- Almacena las respuestas individuales de usuarios
-- ============================================================================
CREATE TABLE IF NOT EXISTS survey_responses (
  id SERIAL PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES citizen_reports(id) ON DELETE CASCADE,
  question_key TEXT NOT NULL,
  selected_option TEXT NOT NULL, -- valor de la opción seleccionada
  user_identifier TEXT NOT NULL, -- hash de IP/session
  neighborhood TEXT, -- barrio (calculado de lat/lon)
  district TEXT, -- distrito
  metadata JSONB DEFAULT '{}'::jsonb, -- contexto adicional
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Un usuario solo puede responder una vez cada pregunta por reporte
  UNIQUE(report_id, question_key, user_identifier)
);

CREATE INDEX idx_responses_report ON survey_responses(report_id);
CREATE INDEX idx_responses_question ON survey_responses(question_key);
CREATE INDEX idx_responses_neighborhood ON survey_responses(neighborhood) WHERE neighborhood IS NOT NULL;
CREATE INDEX idx_responses_district ON survey_responses(district) WHERE district IS NOT NULL;
CREATE INDEX idx_responses_created ON survey_responses(created_at DESC);

-- ============================================================================
-- 3. TABLA: neighborhood_coverage
-- Tracking de cobertura de encuestas por barrio
-- ============================================================================
CREATE TABLE IF NOT EXISTS neighborhood_coverage (
  id SERIAL PRIMARY KEY,
  neighborhood TEXT NOT NULL,
  district TEXT,
  total_reports INTEGER DEFAULT 0,
  total_responses INTEGER DEFAULT 0,
  unique_respondents INTEGER DEFAULT 0,
  response_rate NUMERIC(5,2), -- porcentaje
  last_response_at TIMESTAMP,
  geom GEOMETRY(MultiPolygon, 4326), -- geometría del barrio (opcional)
  metadata JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(neighborhood, district)
);

CREATE INDEX idx_coverage_neighborhood ON neighborhood_coverage(neighborhood);
CREATE INDEX idx_coverage_response_rate ON neighborhood_coverage(response_rate DESC);
CREATE INDEX idx_coverage_geom ON neighborhood_coverage USING GIST(geom) WHERE geom IS NOT NULL;

-- ============================================================================
-- 4. TABLA: survey_aggregations
-- Agregaciones de respuestas por barrio y pregunta
-- ============================================================================
CREATE TABLE IF NOT EXISTS survey_aggregations (
  id SERIAL PRIMARY KEY,
  neighborhood TEXT NOT NULL,
  district TEXT,
  question_key TEXT NOT NULL,
  option_value TEXT NOT NULL,
  response_count INTEGER DEFAULT 0,
  percentage NUMERIC(5,2),
  last_updated TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(neighborhood, question_key, option_value)
);

CREATE INDEX idx_aggregations_neighborhood ON survey_aggregations(neighborhood);
CREATE INDEX idx_aggregations_question ON survey_aggregations(question_key);
CREATE INDEX idx_aggregations_count ON survey_aggregations(response_count DESC);

-- ============================================================================
-- 5. FUNCIÓN: get_neighborhood_from_location
-- Obtiene el barrio a partir de coordenadas (placeholder para integración GIS)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_neighborhood_from_location(
  p_latitude NUMERIC,
  p_longitude NUMERIC
)
RETURNS TABLE(
  neighborhood TEXT,
  district TEXT
) AS $$
BEGIN
  -- TODO: Integrar con tabla spatial_units o servicio de geocodificación
  -- Por ahora retorna un placeholder basado en coordenadas
  
  -- Ejemplo simplificado para Lima
  IF p_latitude BETWEEN -12.1 AND -11.9 AND p_longitude BETWEEN -77.1 AND -76.9 THEN
    RETURN QUERY
    SELECT 
      CASE 
        WHEN p_latitude > -12.0 AND p_longitude > -77.0 THEN 'San Isidro Centro'::TEXT
        WHEN p_latitude > -12.0 THEN 'Miraflores Norte'::TEXT
        WHEN p_longitude > -77.0 THEN 'Surquillo Este'::TEXT
        ELSE 'Barranco Sur'::TEXT
      END AS neighborhood,
      CASE 
        WHEN p_latitude > -12.0 AND p_longitude > -77.0 THEN 'San Isidro'::TEXT
        WHEN p_latitude > -12.0 THEN 'Miraflores'::TEXT
        WHEN p_longitude > -77.0 THEN 'Surquillo'::TEXT
        ELSE 'Barranco'::TEXT
      END AS district;
  ELSE
    RETURN QUERY SELECT 'Desconocido'::TEXT, 'Lima'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. FUNCIÓN: record_survey_response
-- Registra una respuesta y actualiza agregaciones
-- ============================================================================
CREATE OR REPLACE FUNCTION record_survey_response(
  p_report_id INTEGER,
  p_question_key TEXT,
  p_selected_option TEXT,
  p_user_identifier TEXT,
  p_latitude NUMERIC,
  p_longitude NUMERIC
) RETURNS JSONB AS $$
DECLARE
  v_neighborhood TEXT;
  v_district TEXT;
  v_location RECORD;
  v_response_id INTEGER;
  v_is_new_response BOOLEAN;
BEGIN
  -- Obtener barrio/distrito desde ubicación
  SELECT * INTO v_location FROM get_neighborhood_from_location(p_latitude, p_longitude);
  v_neighborhood := v_location.neighborhood;
  v_district := v_location.district;
  
  -- Insertar respuesta (o actualizar si ya existe)
  INSERT INTO survey_responses (
    report_id, question_key, selected_option, 
    user_identifier, neighborhood, district
  ) VALUES (
    p_report_id, p_question_key, p_selected_option,
    p_user_identifier, v_neighborhood, v_district
  )
  ON CONFLICT (report_id, question_key, user_identifier) 
  DO UPDATE SET
    selected_option = EXCLUDED.selected_option,
    created_at = NOW()
  RETURNING id, (xmax = 0) INTO v_response_id, v_is_new_response;
  
  -- Actualizar agregaciones
  INSERT INTO survey_aggregations (
    neighborhood, district, question_key, 
    option_value, response_count, percentage
  ) VALUES (
    v_neighborhood, v_district, p_question_key,
    p_selected_option, 1, 0
  )
  ON CONFLICT (neighborhood, question_key, option_value)
  DO UPDATE SET
    response_count = survey_aggregations.response_count + 1,
    last_updated = NOW();
  
  -- Recalcular porcentajes para esta pregunta en este barrio
  UPDATE survey_aggregations sa
  SET percentage = (
    sa.response_count * 100.0 / (
      SELECT SUM(response_count) 
      FROM survey_aggregations 
      WHERE neighborhood = sa.neighborhood 
        AND question_key = sa.question_key
    )
  )
  WHERE neighborhood = v_neighborhood 
    AND question_key = p_question_key;
  
  -- Actualizar cobertura del barrio
  INSERT INTO neighborhood_coverage (
    neighborhood, district, total_reports, 
    total_responses, unique_respondents, last_response_at
  )
  SELECT 
    v_neighborhood,
    v_district,
    COUNT(DISTINCT cr.id),
    COUNT(sr.id),
    COUNT(DISTINCT sr.user_identifier),
    NOW()
  FROM citizen_reports cr
  LEFT JOIN survey_responses sr ON sr.report_id = cr.id
  WHERE sr.neighborhood = v_neighborhood OR (
    -- Obtener reportes del barrio por ubicación
    EXISTS(
      SELECT 1 FROM get_neighborhood_from_location(
        ST_Y(cr.geom), ST_X(cr.geom)
      ) loc WHERE loc.neighborhood = v_neighborhood
    )
  )
  ON CONFLICT (neighborhood, district)
  DO UPDATE SET
    total_responses = EXCLUDED.total_responses,
    unique_respondents = EXCLUDED.unique_respondents,
    response_rate = (EXCLUDED.total_responses * 100.0 / NULLIF(EXCLUDED.total_reports, 0))::NUMERIC(5,2),
    last_response_at = NOW(),
    updated_at = NOW();
  
  -- Retornar resultado
  RETURN jsonb_build_object(
    'success', true,
    'response_id', v_response_id,
    'is_new', v_is_new_response,
    'neighborhood', v_neighborhood,
    'district', v_district
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. VISTA: neighborhood_survey_summary
-- Resumen de encuestas por barrio
-- ============================================================================
CREATE OR REPLACE VIEW neighborhood_survey_summary AS
SELECT
  nc.neighborhood,
  nc.district,
  nc.total_reports,
  nc.total_responses,
  nc.unique_respondents,
  nc.response_rate,
  nc.last_response_at,
  
  -- Top respuestas por pregunta (JSON)
  (
    SELECT jsonb_object_agg(
      question_key,
      top_answers
    )
    FROM (
      SELECT 
        question_key,
        jsonb_agg(
          jsonb_build_object(
            'option', option_value,
            'count', response_count,
            'percentage', percentage
          ) ORDER BY response_count DESC
        ) FILTER (WHERE rn <= 3) AS top_answers
      FROM (
        SELECT 
          question_key,
          option_value,
          response_count,
          percentage,
          ROW_NUMBER() OVER (PARTITION BY question_key ORDER BY response_count DESC) AS rn
        FROM survey_aggregations
        WHERE neighborhood = nc.neighborhood
      ) ranked
      GROUP BY question_key
    ) aggregated
  ) AS top_responses_by_question,
  
  -- Actividad reciente
  EXTRACT(EPOCH FROM (NOW() - nc.last_response_at)) / 3600 AS hours_since_last_response
  
FROM neighborhood_coverage nc;

-- ============================================================================
-- 8. DATOS INICIALES: Plantillas de micro-encuestas
-- ============================================================================

-- Pregunta 1: Duración del problema
INSERT INTO survey_templates (question_key, question_text, question_icon, category, options, display_order) VALUES
('duration', '¿Hace cuánto persiste?', '⏱️', NULL, 
'[
  {"value": "hours", "label": "Horas", "icon": "🕐"},
  {"value": "days", "label": "Días", "icon": "📅"},
  {"value": "weeks", "label": "Semanas", "icon": "📆"},
  {"value": "months", "label": "Meses+", "icon": "📊"}
]'::jsonb, 1)
ON CONFLICT (question_key) DO NOTHING;

-- Pregunta 2: Grupos vulnerables afectados
INSERT INTO survey_templates (question_key, question_text, question_icon, category, options, display_order) VALUES
('vulnerable_groups', '¿Afecta a grupos vulnerables?', '👥', NULL,
'[
  {"value": "elderly", "label": "Adultos mayores", "icon": "👴"},
  {"value": "children", "label": "Niños", "icon": "👶"},
  {"value": "disabled", "label": "Personas con discapacidad", "icon": "♿"},
  {"value": "none", "label": "No específicamente", "icon": "✅"}
]'::jsonb, 2)
ON CONFLICT (question_key) DO NOTHING;

-- Pregunta 3: Proximidad a lugares sensibles
INSERT INTO survey_templates (question_key, question_text, question_icon, category, options, display_order) VALUES
('nearby_sensitive', '¿Cerca de lugar sensible?', '📍', NULL,
'[
  {"value": "school", "label": "Colegio", "icon": "🏫"},
  {"value": "hospital", "label": "Hospital/Centro de salud", "icon": "🏥"},
  {"value": "market", "label": "Mercado", "icon": "🛒"},
  {"value": "park", "label": "Parque/Área verde", "icon": "🌳"},
  {"value": "none", "label": "Ninguno cercano", "icon": "❌"}
]'::jsonb, 3)
ON CONFLICT (question_key) DO NOTHING;

-- Pregunta 4: Frecuencia del problema
INSERT INTO survey_templates (question_key, question_text, question_icon, category, options, display_order) VALUES
('frequency', '¿Con qué frecuencia ocurre?', '🔄', NULL,
'[
  {"value": "constant", "label": "Constante", "icon": "🔴"},
  {"value": "daily", "label": "Diario", "icon": "📆"},
  {"value": "weekly", "label": "Semanal", "icon": "📅"},
  {"value": "occasional", "label": "Ocasional", "icon": "🟡"}
]'::jsonb, 4)
ON CONFLICT (question_key) DO NOTHING;

-- Pregunta 5: Nivel de impacto
INSERT INTO survey_templates (question_key, question_text, question_icon, category, options, display_order) VALUES
('impact_level', '¿Qué tan grave es el impacto?', '⚠️', NULL,
'[
  {"value": "critical", "label": "Crítico", "icon": "🚨"},
  {"value": "high", "label": "Alto", "icon": "🔴"},
  {"value": "moderate", "label": "Moderado", "icon": "🟡"},
  {"value": "low", "label": "Bajo", "icon": "🟢"}
]'::jsonb, 5)
ON CONFLICT (question_key) DO NOTHING;

-- Pregunta específica para calor
INSERT INTO survey_templates (question_key, question_text, question_icon, category, options, display_order) VALUES
('heat_time', '¿Cuándo es más intenso el calor?', '🌡️', 'heat',
'[
  {"value": "morning", "label": "Mañana", "icon": "🌅"},
  {"value": "midday", "label": "Mediodía", "icon": "☀️"},
  {"value": "afternoon", "label": "Tarde", "icon": "🌇"},
  {"value": "allday", "label": "Todo el día", "icon": "🔥"}
]'::jsonb, 6)
ON CONFLICT (question_key) DO NOTHING;

-- Pregunta específica para áreas verdes
INSERT INTO survey_templates (question_key, question_text, question_icon, category, options, display_order) VALUES
('green_access', '¿Hay acceso público al área verde?', '🌳', 'green',
'[
  {"value": "open", "label": "Sí, abierto", "icon": "✅"},
  {"value": "restricted", "label": "Restringido", "icon": "🚧"},
  {"value": "closed", "label": "Cerrado", "icon": "🔒"},
  {"value": "unknown", "label": "No sé", "icon": "❓"}
]'::jsonb, 7)
ON CONFLICT (question_key) DO NOTHING;

-- ============================================================================
-- 9. ÍNDICES ADICIONALES PARA PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_responses_neighborhood_question 
  ON survey_responses(neighborhood, question_key) 
  WHERE neighborhood IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_aggregations_neighborhood_question 
  ON survey_aggregations(neighborhood, question_key, response_count DESC);

-- Índice para búsquedas espaciales (si se agrega geometría)
CREATE INDEX IF NOT EXISTS idx_coverage_geom_gist 
  ON neighborhood_coverage USING GIST(geom) 
  WHERE geom IS NOT NULL;

-- ============================================================================
-- 10. FUNCIÓN: get_report_survey_progress
-- Obtiene el progreso de encuestas para un reporte
-- ============================================================================
CREATE OR REPLACE FUNCTION get_report_survey_progress(p_report_id INTEGER)
RETURNS JSONB AS $$
DECLARE
  v_category TEXT;
  v_total_questions INTEGER;
  v_answered_questions INTEGER;
  v_progress NUMERIC(5,2);
  v_neighborhood TEXT;
  v_district TEXT;
BEGIN
  -- Obtener categoría del reporte
  SELECT report_type INTO v_category FROM citizen_reports WHERE id = p_report_id;
  
  -- Obtener ubicación del reporte
  SELECT neighborhood, district INTO v_neighborhood, v_district
  FROM survey_responses
  WHERE report_id = p_report_id
  LIMIT 1;
  
  -- Si no hay respuestas aún, calcular desde el reporte
  IF v_neighborhood IS NULL THEN
    SELECT * INTO v_neighborhood, v_district
    FROM get_neighborhood_from_location(
      (SELECT ST_Y(geom) FROM citizen_reports WHERE id = p_report_id),
      (SELECT ST_X(geom) FROM citizen_reports WHERE id = p_report_id)
    );
  END IF;
  
  -- Contar preguntas totales (generales + específicas de categoría)
  SELECT COUNT(*) INTO v_total_questions
  FROM survey_templates
  WHERE active = true AND (category IS NULL OR category = v_category);
  
  -- Contar preguntas respondidas
  SELECT COUNT(DISTINCT question_key) INTO v_answered_questions
  FROM survey_responses
  WHERE report_id = p_report_id;
  
  -- Calcular progreso
  v_progress := (v_answered_questions * 100.0 / NULLIF(v_total_questions, 0))::NUMERIC(5,2);
  
  RETURN jsonb_build_object(
    'report_id', p_report_id,
    'total_questions', v_total_questions,
    'answered_questions', v_answered_questions,
    'progress_percentage', v_progress,
    'neighborhood', v_neighborhood,
    'district', v_district
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FIN DEL ESQUEMA DE MICRO-ENCUESTAS
-- ============================================================================
