-- ============================================================================
-- ESQUEMA DE VALIDACIÓN COMUNITARIA PARA REPORTES CIUDADANOS
-- ============================================================================
-- Implementa un sistema robusto de validación peer-to-peer con:
-- - Confirmaciones y rechazos comunitarios
-- - Detección de duplicados espaciotemporales
-- - Historial de cambios auditable
-- - Sistema de moderación
-- - Métricas de calidad y tiempo de validación
-- ============================================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- Para similitud de texto

-- ============================================================================
-- 1. TABLA: report_validations
-- Almacena las validaciones individuales de cada usuario sobre un reporte
-- ============================================================================
CREATE TABLE IF NOT EXISTS report_validations (
  id SERIAL PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES citizen_reports(id) ON DELETE CASCADE,
  user_identifier TEXT NOT NULL, -- IP hash, session ID, o user_id si hay auth
  validation_type TEXT NOT NULL CHECK (validation_type IN ('confirm', 'reject', 'duplicate', 'update_severity')),
  comment TEXT,
  new_severity TEXT CHECK (new_severity IN ('low', 'medium', 'high') OR new_severity IS NULL),
  duplicate_of_report_id INTEGER REFERENCES citizen_reports(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Un usuario solo puede validar una vez cada tipo por reporte
  UNIQUE(report_id, user_identifier, validation_type)
);

CREATE INDEX idx_validations_report ON report_validations(report_id);
CREATE INDEX idx_validations_user ON report_validations(user_identifier);
CREATE INDEX idx_validations_type ON report_validations(validation_type);
CREATE INDEX idx_validations_created ON report_validations(created_at);

-- ============================================================================
-- 2. TABLA: report_change_history
-- Historial público de todos los cambios en un reporte (auditoría completa)
-- ============================================================================
CREATE TABLE IF NOT EXISTS report_change_history (
  id SERIAL PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES citizen_reports(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL, -- 'created', 'status_change', 'severity_change', 'duplicate_marked', 'validated', 'moderated'
  old_value TEXT,
  new_value TEXT,
  changed_by TEXT, -- 'system', 'community', 'moderator', user_identifier
  reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_history_report ON report_change_history(report_id);
CREATE INDEX idx_history_change_type ON report_change_history(change_type);
CREATE INDEX idx_history_created ON report_change_history(created_at DESC);

-- ============================================================================
-- 3. TABLA: report_moderators
-- Lista de moderadores verificados con permisos especiales
-- ============================================================================
CREATE TABLE IF NOT EXISTS report_moderators (
  id SERIAL PRIMARY KEY,
  user_identifier TEXT UNIQUE NOT NULL,
  name TEXT,
  email TEXT,
  role TEXT DEFAULT 'moderator' CHECK (role IN ('moderator', 'admin')),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  last_activity TIMESTAMP
);

CREATE INDEX idx_moderators_active ON report_moderators(active) WHERE active = true;

-- ============================================================================
-- 4. ACTUALIZAR TABLA: citizen_reports
-- Agregar campos necesarios para validación
-- ============================================================================
ALTER TABLE citizen_reports 
  ADD COLUMN IF NOT EXISTS validation_status TEXT DEFAULT 'pending' 
    CHECK (validation_status IN ('pending', 'community_validated', 'moderator_validated', 'rejected', 'duplicate')),
  ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'medium' 
    CHECK (severity IN ('low', 'medium', 'high')),
  ADD COLUMN IF NOT EXISTS validation_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS confirmed_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rejected_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duplicate_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS validated_by TEXT, -- 'community' o moderator identifier
  ADD COLUMN IF NOT EXISTS is_duplicate_of INTEGER REFERENCES citizen_reports(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reports_validation_status ON citizen_reports(validation_status);
CREATE INDEX IF NOT EXISTS idx_reports_severity ON citizen_reports(severity);
CREATE INDEX IF NOT EXISTS idx_reports_validation_score ON citizen_reports(validation_score DESC);
CREATE INDEX IF NOT EXISTS idx_reports_validated_at ON citizen_reports(validated_at);

-- ============================================================================
-- 5. FUNCIÓN: detect_duplicate_reports
-- Detecta reportes duplicados basados en proximidad espacial, temporal y texto
-- ============================================================================
CREATE OR REPLACE FUNCTION detect_duplicate_reports(
  p_report_id INTEGER,
  p_distance_meters NUMERIC DEFAULT 100, -- Radio de búsqueda
  p_time_window_hours INTEGER DEFAULT 48, -- Ventana temporal
  p_similarity_threshold NUMERIC DEFAULT 0.3 -- Umbral de similitud de texto
)
RETURNS TABLE(
  duplicate_id INTEGER,
  distance_meters NUMERIC,
  hours_apart NUMERIC,
  text_similarity NUMERIC,
  duplicate_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cr2.id AS duplicate_id,
    ST_Distance(cr1.geom::geography, cr2.geom::geography) AS distance_meters,
    EXTRACT(EPOCH FROM (cr2.reported_at - cr1.reported_at)) / 3600.0 AS hours_apart,
    similarity(
      COALESCE(cr1.description, ''),
      COALESCE(cr2.description, '')
    ) AS text_similarity,
    -- Score compuesto: más cercano en espacio+tiempo+texto = mayor score
    (
      (1.0 - (ST_Distance(cr1.geom::geography, cr2.geom::geography) / p_distance_meters)) * 0.4 +
      (1.0 - (ABS(EXTRACT(EPOCH FROM (cr2.reported_at - cr1.reported_at)) / 3600.0) / p_time_window_hours)) * 0.3 +
      similarity(COALESCE(cr1.description, ''), COALESCE(cr2.description, '')) * 0.3
    ) AS duplicate_score
  FROM citizen_reports cr1
  CROSS JOIN citizen_reports cr2
  WHERE cr1.id = p_report_id
    AND cr2.id != p_report_id
    AND cr2.validation_status != 'duplicate' -- No considerar reportes ya marcados como duplicados
    AND cr1.report_type = cr2.report_type -- Misma categoría
    AND ST_DWithin(cr1.geom::geography, cr2.geom::geography, p_distance_meters)
    AND ABS(EXTRACT(EPOCH FROM (cr2.reported_at - cr1.reported_at))) / 3600.0 <= p_time_window_hours
    AND similarity(COALESCE(cr1.description, ''), COALESCE(cr2.description, '')) >= p_similarity_threshold
  ORDER BY duplicate_score DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. FUNCIÓN: apply_validation
-- Aplica una validación y actualiza contadores/estado del reporte
-- ============================================================================
CREATE OR REPLACE FUNCTION apply_validation(
  p_report_id INTEGER,
  p_user_identifier TEXT,
  p_validation_type TEXT,
  p_comment TEXT DEFAULT NULL,
  p_new_severity TEXT DEFAULT NULL,
  p_duplicate_of INTEGER DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_current_status TEXT;
  v_confirmations INTEGER;
  v_rejections INTEGER;
  v_duplicates INTEGER;
  v_threshold_confirmations INTEGER := 3; -- Umbral para validación comunitaria
  v_result JSONB;
BEGIN
  -- Insertar la validación (o actualizar si ya existe)
  INSERT INTO report_validations (
    report_id, user_identifier, validation_type, 
    comment, new_severity, duplicate_of_report_id
  ) VALUES (
    p_report_id, p_user_identifier, p_validation_type,
    p_comment, p_new_severity, p_duplicate_of
  )
  ON CONFLICT (report_id, user_identifier, validation_type) 
  DO UPDATE SET
    comment = EXCLUDED.comment,
    new_severity = EXCLUDED.new_severity,
    duplicate_of_report_id = EXCLUDED.duplicate_of_report_id,
    created_at = NOW();

  -- Contar validaciones
  SELECT 
    COUNT(*) FILTER (WHERE validation_type = 'confirm'),
    COUNT(*) FILTER (WHERE validation_type = 'reject'),
    COUNT(*) FILTER (WHERE validation_type = 'duplicate')
  INTO v_confirmations, v_rejections, v_duplicates
  FROM report_validations
  WHERE report_id = p_report_id;

  -- Obtener estado actual
  SELECT validation_status INTO v_current_status
  FROM citizen_reports
  WHERE id = p_report_id;

  -- Calcular nuevo estado
  IF v_duplicates >= 2 THEN
    -- Marcar como duplicado si 2+ usuarios lo reportan
    UPDATE citizen_reports SET
      validation_status = 'duplicate',
      is_duplicate_of = p_duplicate_of,
      confirmed_count = v_confirmations,
      rejected_count = v_rejections,
      duplicate_count = v_duplicates,
      validation_score = v_confirmations - v_rejections
    WHERE id = p_report_id;
    
    INSERT INTO report_change_history (report_id, change_type, old_value, new_value, changed_by, reason)
    VALUES (p_report_id, 'duplicate_marked', v_current_status, 'duplicate', 'community', 'Múltiples usuarios reportaron como duplicado');
    
  ELSIF v_rejections >= v_threshold_confirmations THEN
    -- Rechazar si hay suficientes rechazos
    UPDATE citizen_reports SET
      validation_status = 'rejected',
      confirmed_count = v_confirmations,
      rejected_count = v_rejections,
      duplicate_count = v_duplicates,
      validation_score = v_confirmations - v_rejections
    WHERE id = p_report_id;
    
    INSERT INTO report_change_history (report_id, change_type, old_value, new_value, changed_by, reason)
    VALUES (p_report_id, 'status_change', v_current_status, 'rejected', 'community', 'Rechazado por la comunidad');
    
  ELSIF v_confirmations >= v_threshold_confirmations AND v_current_status = 'pending' THEN
    -- Validar si hay suficientes confirmaciones
    UPDATE citizen_reports SET
      validation_status = 'community_validated',
      confirmed_count = v_confirmations,
      rejected_count = v_rejections,
      duplicate_count = v_duplicates,
      validation_score = v_confirmations - v_rejections,
      validated_at = NOW(),
      validated_by = 'community'
    WHERE id = p_report_id;
    
    INSERT INTO report_change_history (report_id, change_type, old_value, new_value, changed_by, reason)
    VALUES (p_report_id, 'validated', v_current_status, 'community_validated', 'community', 'Validado por la comunidad');
    
  ELSE
    -- Actualizar solo contadores
    UPDATE citizen_reports SET
      confirmed_count = v_confirmations,
      rejected_count = v_rejections,
      duplicate_count = v_duplicates,
      validation_score = v_confirmations - v_rejections
    WHERE id = p_report_id;
  END IF;

  -- Actualizar severidad si se propuso
  IF p_validation_type = 'update_severity' AND p_new_severity IS NOT NULL THEN
    DECLARE
      v_old_severity TEXT;
      v_severity_votes JSONB;
    BEGIN
      SELECT severity INTO v_old_severity FROM citizen_reports WHERE id = p_report_id;
      
      -- Calcular severidad más votada
      SELECT jsonb_object_agg(new_severity, cnt) INTO v_severity_votes
      FROM (
        SELECT new_severity, COUNT(*) as cnt
        FROM report_validations
        WHERE report_id = p_report_id AND validation_type = 'update_severity'
        GROUP BY new_severity
      ) sub;
      
      -- Si hay consenso (mayoría), actualizar
      IF (v_severity_votes->p_new_severity)::INTEGER >= 2 THEN
        UPDATE citizen_reports SET severity = p_new_severity WHERE id = p_report_id;
        
        INSERT INTO report_change_history (report_id, change_type, old_value, new_value, changed_by, metadata)
        VALUES (p_report_id, 'severity_change', v_old_severity, p_new_severity, 'community', v_severity_votes);
      END IF;
    END;
  END IF;

  -- Retornar resultado
  SELECT jsonb_build_object(
    'success', true,
    'report_id', p_report_id,
    'validation_type', p_validation_type,
    'confirmations', v_confirmations,
    'rejections', v_rejections,
    'duplicates', v_duplicates,
    'current_status', (SELECT validation_status FROM citizen_reports WHERE id = p_report_id)
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. FUNCIÓN: moderator_validate
-- Validación directa por moderador (bypass validación comunitaria)
-- ============================================================================
CREATE OR REPLACE FUNCTION moderator_validate(
  p_report_id INTEGER,
  p_moderator_identifier TEXT,
  p_new_status TEXT, -- 'moderator_validated', 'rejected', 'duplicate'
  p_reason TEXT DEFAULT NULL,
  p_new_severity TEXT DEFAULT NULL,
  p_duplicate_of INTEGER DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_is_moderator BOOLEAN;
  v_old_status TEXT;
  v_old_severity TEXT;
BEGIN
  -- Verificar que sea moderador activo
  SELECT EXISTS(
    SELECT 1 FROM report_moderators 
    WHERE user_identifier = p_moderator_identifier AND active = true
  ) INTO v_is_moderator;

  IF NOT v_is_moderator THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuario no es moderador activo');
  END IF;

  -- Obtener valores actuales
  SELECT validation_status, severity INTO v_old_status, v_old_severity
  FROM citizen_reports WHERE id = p_report_id;

  -- Actualizar reporte
  UPDATE citizen_reports SET
    validation_status = p_new_status,
    severity = COALESCE(p_new_severity, severity),
    validated_at = NOW(),
    validated_by = p_moderator_identifier,
    is_duplicate_of = p_duplicate_of
  WHERE id = p_report_id;

  -- Registrar en historial
  INSERT INTO report_change_history (report_id, change_type, old_value, new_value, changed_by, reason)
  VALUES (p_report_id, 'moderated', v_old_status, p_new_status, p_moderator_identifier, p_reason);

  IF p_new_severity IS NOT NULL AND p_new_severity != v_old_severity THEN
    INSERT INTO report_change_history (report_id, change_type, old_value, new_value, changed_by, reason)
    VALUES (p_report_id, 'severity_change', v_old_severity, p_new_severity, p_moderator_identifier, 'Moderador ajustó severidad');
  END IF;

  -- Actualizar última actividad del moderador
  UPDATE report_moderators SET last_activity = NOW() WHERE user_identifier = p_moderator_identifier;

  RETURN jsonb_build_object(
    'success', true,
    'report_id', p_report_id,
    'old_status', v_old_status,
    'new_status', p_new_status,
    'moderated_by', p_moderator_identifier
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. VISTA: validation_metrics
-- Métricas de calidad y tiempos de validación
-- ============================================================================
CREATE OR REPLACE VIEW validation_metrics AS
SELECT
  COUNT(*) AS total_reports,
  COUNT(*) FILTER (WHERE validation_status = 'community_validated') AS community_validated,
  COUNT(*) FILTER (WHERE validation_status = 'moderator_validated') AS moderator_validated,
  COUNT(*) FILTER (WHERE validation_status = 'rejected') AS rejected,
  COUNT(*) FILTER (WHERE validation_status = 'duplicate') AS duplicates,
  COUNT(*) FILTER (WHERE validation_status = 'pending') AS pending,
  
  -- Porcentajes
  ROUND(100.0 * COUNT(*) FILTER (WHERE validation_status IN ('community_validated', 'moderator_validated')) / NULLIF(COUNT(*), 0), 2) AS pct_validated,
  ROUND(100.0 * COUNT(*) FILTER (WHERE validation_status = 'community_validated') / NULLIF(COUNT(*), 0), 2) AS pct_community_validated,
  
  -- Tiempos promedio
  AVG(EXTRACT(EPOCH FROM (validated_at - reported_at)) / 3600.0) FILTER (WHERE validated_at IS NOT NULL) AS avg_hours_to_validation,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (validated_at - reported_at)) / 3600.0) FILTER (WHERE validated_at IS NOT NULL) AS median_hours_to_validation,
  
  -- Por severidad
  jsonb_object_agg(
    severity,
    COUNT(*)
  ) FILTER (WHERE validation_status IN ('community_validated', 'moderator_validated')) AS validated_by_severity
FROM citizen_reports;

-- ============================================================================
-- 9. VISTA: report_with_validations
-- Vista completa de reportes con sus validaciones y métricas
-- ============================================================================
CREATE OR REPLACE VIEW report_with_validations AS
SELECT
  cr.*,
  ST_X(cr.geom) AS longitude,
  ST_Y(cr.geom) AS latitude,
  
  -- Estadísticas de validación
  COALESCE(v.total_validations, 0) AS total_validations,
  COALESCE(v.unique_validators, 0) AS unique_validators,
  
  -- Duplicados detectados
  COALESCE(d.potential_duplicates, 0) AS potential_duplicates,
  
  -- Historial de cambios
  COALESCE(h.change_count, 0) AS change_count,
  h.last_change_at,
  
  -- Tiempo desde reporte
  EXTRACT(EPOCH FROM (NOW() - cr.reported_at)) / 3600.0 AS hours_since_report,
  
  -- Tiempo a validación
  CASE 
    WHEN cr.validated_at IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (cr.validated_at - cr.reported_at)) / 3600.0 
  END AS hours_to_validation

FROM citizen_reports cr

LEFT JOIN (
  SELECT 
    report_id,
    COUNT(*) AS total_validations,
    COUNT(DISTINCT user_identifier) AS unique_validators
  FROM report_validations
  GROUP BY report_id
) v ON v.report_id = cr.id

LEFT JOIN (
  SELECT 
    report_id,
    COUNT(*) AS potential_duplicates
  FROM report_validations
  WHERE validation_type = 'duplicate'
  GROUP BY report_id
) d ON d.report_id = cr.id

LEFT JOIN (
  SELECT
    report_id,
    COUNT(*) AS change_count,
    MAX(created_at) AS last_change_at
  FROM report_change_history
  GROUP BY report_id
) h ON h.report_id = cr.id;

-- ============================================================================
-- 10. ÍNDICES ADICIONALES PARA PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_reports_type_status ON citizen_reports(report_type, validation_status);
CREATE INDEX IF NOT EXISTS idx_reports_reported_at_desc ON citizen_reports(reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_validations_report_type ON report_validations(report_id, validation_type);

-- Índice para búsqueda de similitud de texto
CREATE INDEX IF NOT EXISTS idx_reports_description_trgm ON citizen_reports USING gin(description gin_trgm_ops);

-- ============================================================================
-- 11. DATOS DE EJEMPLO: Crear moderador inicial
-- ============================================================================
INSERT INTO report_moderators (user_identifier, name, email, role)
VALUES ('admin@ecoplan.pe', 'Admin EcoPlan', 'admin@ecoplan.pe', 'admin')
ON CONFLICT (user_identifier) DO NOTHING;

-- ============================================================================
-- FIN DEL ESQUEMA DE VALIDACIÓN COMUNITARIA
-- ============================================================================
