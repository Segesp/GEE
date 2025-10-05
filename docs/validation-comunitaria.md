# Sistema de Validación Comunitaria - EcoPlan MVP

## 📋 Resumen Ejecutivo

Sistema robusto de validación **peer-to-peer** que permite a la comunidad ayudar a validar, priorizar y detectar duplicados en reportes ciudadanos. Implementa:

✅ **Confirmaciones y rechazos** comunitarios  
✅ **Actualización colaborativa de severidad**  
✅ **Detección automática de duplicados** (espaciotemporal + similitud de texto)  
✅ **Historial de cambios público** (auditoría completa)  
✅ **Sistema de moderación** con permisos especiales  
✅ **Métricas de calidad** y tiempos de validación  

---

## 🎯 Objetivos del Reto

| Objetivo | Implementación |
|----------|----------------|
| **Validación comunitaria** | Sistema de confirmaciones "Confirmo" / "No es así" con umbral de 3 votos |
| **Detección de duplicados** | Algoritmo espaciotemporal con similitud de texto (radio 100m, 48h) |
| **Historial público** | Tabla `report_change_history` con todos los cambios auditables |
| **Métricas de éxito** | Dashboard con % validados, tiempo promedio a validación, severidad por categoría |

---

## 🏗️ Arquitectura

### Componentes

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (public/index.html)              │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │  Botones de │  │  Detección   │  │  Historial de    │   │
│  │  Validación │  │  Duplicados  │  │  Cambios         │   │
│  └─────────────┘  └──────────────┘  └──────────────────┘   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                    REST API Calls
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    BACKEND (server.js)                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  POST /api/citizen-reports/:id/validate                │ │
│  │  POST /api/citizen-reports/:id/moderate                │ │
│  │  GET  /api/citizen-reports/:id/duplicates              │ │
│  │  GET  /api/citizen-reports/:id/history                 │ │
│  │  GET  /api/citizen-reports/:id/stats                   │ │
│  │  GET  /api/validation/metrics                          │ │
│  │  GET  /api/validation/moderators                       │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │
┌──────────────────────────▼──────────────────────────────────┐
│        SERVICIO (reportValidationService.js)                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  • applyValidation()                                   │ │
│  │  • moderatorValidate()                                 │ │
│  │  • detectDuplicates() - Haversine + similitud texto   │ │
│  │  • getValidationMetrics()                             │ │
│  │  • getChangeHistory()                                  │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │
┌──────────────────────────▼──────────────────────────────────┐
│         BASE DE DATOS (PostgreSQL + PostGIS)                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  citizen_reports (campos validación agregados)         │ │
│  │  report_validations (votos individuales)              │ │
│  │  report_change_history (auditoría completa)           │ │
│  │  report_moderators (permisos especiales)              │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Esquema de Base de Datos

### 1. `citizen_reports` (tabla extendida)

```sql
-- Nuevos campos agregados
ALTER TABLE citizen_reports ADD COLUMN
  validation_status TEXT DEFAULT 'pending' 
    CHECK (validation_status IN ('pending', 'community_validated', 
                                   'moderator_validated', 'rejected', 'duplicate')),
  severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  validation_score INTEGER DEFAULT 0,
  confirmed_count INTEGER DEFAULT 0,
  rejected_count INTEGER DEFAULT 0,
  duplicate_count INTEGER DEFAULT 0,
  validated_at TIMESTAMP,
  validated_by TEXT,
  is_duplicate_of INTEGER REFERENCES citizen_reports(id);
```

**Estados de validación:**
- `pending`: Recién creado, pendiente de validación
- `community_validated`: ≥3 confirmaciones comunitarias
- `moderator_validated`: Validado por moderador
- `rejected`: ≥3 rechazos comunitarios
- `duplicate`: Marcado como duplicado

### 2. `report_validations` (votos individuales)

```sql
CREATE TABLE report_validations (
  id SERIAL PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES citizen_reports(id) ON DELETE CASCADE,
  user_identifier TEXT NOT NULL, -- Hash de IP/session
  validation_type TEXT NOT NULL 
    CHECK (validation_type IN ('confirm', 'reject', 'duplicate', 'update_severity')),
  comment TEXT,
  new_severity TEXT CHECK (new_severity IN ('low', 'medium', 'high')),
  duplicate_of_report_id INTEGER REFERENCES citizen_reports(id),
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(report_id, user_identifier, validation_type)
);
```

**Tipos de validación:**
- `confirm`: "Confirmo que este reporte es válido"
- `reject`: "No es así / Reporte inválido"
- `duplicate`: "Es duplicado del reporte #X"
- `update_severity`: "La severidad debería ser {low|medium|high}"

### 3. `report_change_history` (auditoría completa)

```sql
CREATE TABLE report_change_history (
  id SERIAL PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES citizen_reports(id),
  change_type TEXT NOT NULL, 
    -- 'created', 'status_change', 'severity_change', 'duplicate_marked', 'validated', 'moderated'
  old_value TEXT,
  new_value TEXT,
  changed_by TEXT, -- 'system', 'community', 'moderator', user_identifier
  reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 4. `report_moderators` (permisos especiales)

```sql
CREATE TABLE report_moderators (
  id SERIAL PRIMARY KEY,
  user_identifier TEXT UNIQUE NOT NULL,
  name TEXT,
  email TEXT,
  role TEXT DEFAULT 'moderator' CHECK (role IN ('moderator', 'admin')),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  last_activity TIMESTAMP
);
```

---

## 🔧 API Endpoints

### 1. Validar Reporte (Comunitario)

```bash
POST /api/citizen-reports/:id/validate
```

**Body:**
```json
{
  "validationType": "confirm",  // confirm | reject | duplicate | update_severity
  "comment": "Confirmo, yo también vi la basura acumulada",
  "newSeverity": "high",  // Opcional, solo para update_severity
  "duplicateOf": 123      // Opcional, solo para duplicate
}
```

**Response:**
```json
{
  "success": true,
  "reportId": 42,
  "validationType": "confirm",
  "confirmations": 3,
  "rejections": 0,
  "duplicates": 0,
  "currentStatus": "community_validated",
  "statusChanged": true,
  "validationScore": 3
}
```

**Lógica:**
- Umbral de **3 confirmaciones** → `community_validated`
- Umbral de **3 rechazos** → `rejected`
- Umbral de **2 marcas de duplicado** → `duplicate`
- **Score:** confirmations - rejections

### 2. Validar como Moderador

```bash
POST /api/citizen-reports/:id/moderate
```

**Body:**
```json
{
  "moderatorIdentifier": "admin@ecoplan.pe",
  "newStatus": "moderator_validated",  // moderator_validated | rejected | duplicate
  "reason": "Verificado en campo, severidad confirmada",
  "newSeverity": "high",  // Opcional
  "duplicateOf": 123      // Opcional
}
```

**Response:**
```json
{
  "success": true,
  "reportId": 42,
  "oldStatus": "pending",
  "newStatus": "moderator_validated",
  "moderatedBy": "admin@ecoplan.pe",
  "moderatorName": "Admin EcoPlan"
}
```

**Nota:** Bypass completo de validación comunitaria. Requiere permisos de moderador.

### 3. Detectar Duplicados

```bash
GET /api/citizen-reports/:id/duplicates
```

**Response:**
```json
{
  "reportId": 42,
  "duplicatesFound": 2,
  "duplicates": [
    {
      "duplicateId": 41,
      "distanceMeters": 45,
      "hoursApart": 12.5,
      "textSimilarity": 0.87,
      "duplicateScore": 0.91,
      "report": { ... }
    }
  ]
}
```

**Algoritmo de detección:**
```javascript
// Criterios de filtrado:
- Misma categoría (reportType)
- Distancia ≤ 100 metros (Haversine)
- Diferencia temporal ≤ 48 horas
- Similitud de texto ≥ 0.3 (coeficiente de Dice con bigramas)

// Score compuesto:
score = (1 - distancia/100m) * 0.4 +
        (1 - tiempo/48h) * 0.3 +
        similitud_texto * 0.3
```

### 4. Historial de Cambios

```bash
GET /api/citizen-reports/:id/history
```

**Response:**
```json
{
  "reportId": 42,
  "history": [
    {
      "id": 1001,
      "changeType": "created",
      "newValue": "pending",
      "changedBy": "system",
      "createdAt": "2025-10-05T10:00:00Z"
    },
    {
      "id": 1002,
      "changeType": "validated",
      "oldValue": "pending",
      "newValue": "community_validated",
      "changedBy": "community",
      "reason": "Validado por la comunidad",
      "createdAt": "2025-10-05T12:30:00Z"
    }
  ],
  "validations": [
    {
      "userIdentifier": "a3f7b9c2...",  // Hash ofuscado
      "validationType": "confirm",
      "comment": "Confirmo",
      "createdAt": "2025-10-05T11:00:00Z"
    }
  ]
}
```

### 5. Estadísticas de Reporte

```bash
GET /api/citizen-reports/:id/stats
```

**Response:**
```json
{
  "id": 42,
  "description": "Basura acumulada...",
  "validationStatus": "community_validated",
  "severity": "high",
  "totalValidations": 5,
  "uniqueValidators": 4,
  "potentialDuplicates": 1,
  "changeCount": 3,
  "lastChangeAt": "2025-10-05T12:30:00Z",
  "hoursSinceReport": 48.5,
  "hoursToValidation": 2.5,
  "duplicateCandidates": [ ... ]
}
```

### 6. Métricas Globales

```bash
GET /api/validation/metrics
```

**Response:**
```json
{
  "totalReports": 150,
  "communityValidated": 85,
  "moderatorValidated": 20,
  "rejected": 15,
  "duplicates": 10,
  "pending": 20,
  "pctValidated": 70.0,
  "pctCommunityValidated": 56.67,
  "avgHoursToValidation": 18.5,
  "medianHoursToValidation": 12.0,
  "validatedBySeverity": {
    "low": 30,
    "medium": 50,
    "high": 25
  }
}
```

**Métricas clave:**
- **% reportes validados:** (community + moderator) / total
- **% validados por comunidad:** Solo comunitarios / total
- **Tiempo promedio:** Desde `reported_at` hasta `validated_at`
- **Tiempo mediano:** Percentil 50

---

## 🎨 Interfaz de Usuario

### Panel de Validación en Modal/Card de Reporte

```html
<!-- Sección de validación comunitaria -->
<div class="validation-panel">
  <h4>🤝 Ayuda a Validar</h4>
  <div class="validation-stats">
    <span class="stat-badge success">✅ 3 Confirmaciones</span>
    <span class="stat-badge error">❌ 0 Rechazos</span>
    <span class="stat-badge warning">🔄 1 Duplicado</span>
  </div>
  
  <div class="validation-buttons">
    <button class="btn-validate confirm" data-type="confirm">
      ✅ Confirmo
    </button>
    <button class="btn-validate reject" data-type="reject">
      ❌ No es así
    </button>
    <button class="btn-validate duplicate" data-type="duplicate">
      🔄 Es duplicado
    </button>
  </div>
  
  <div class="severity-selector">
    <label>Severidad sugerida:</label>
    <select id="suggestedSeverity">
      <option value="low">✅ Baja</option>
      <option value="medium" selected>⚠️ Media</option>
      <option value="high">🚨 Alta</option>
    </select>
    <button class="btn-validate update-severity" data-type="update_severity">
      Actualizar Severidad
    </button>
  </div>
  
  <textarea id="validationComment" placeholder="Comentario opcional..."></textarea>
  
  <!-- Duplicados detectados -->
  <div class="duplicates-alert" id="duplicatesAlert" hidden>
    <h5>⚠️ Posibles Duplicados Detectados</h5>
    <div id="duplicatesList"></div>
  </div>
  
  <!-- Historial de cambios -->
  <details class="change-history">
    <summary>📜 Ver Historial de Cambios</summary>
    <div id="changeHistoryList"></div>
  </details>
</div>
```

### JavaScript para Validación

```javascript
// Aplicar validación
async function applyValidation(reportId, validationType) {
  const comment = document.getElementById('validationComment').value;
  const newSeverity = validationType === 'update_severity' 
    ? document.getElementById('suggestedSeverity').value 
    : null;

  const response = await fetch(`/api/citizen-reports/${reportId}/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      validationType,
      comment,
      newSeverity
    })
  });

  const result = await response.json();
  
  if (result.success) {
    showToast(`✅ Validación registrada: ${validationType}`);
    
    if (result.statusChanged) {
      showToast(`🎉 Estado actualizado a: ${result.currentStatus}`);
    }
    
    // Actualizar UI con nuevos contadores
    updateValidationBadges(result);
  }
}

// Detectar duplicados automáticamente al abrir reporte
async function checkDuplicates(reportId) {
  const response = await fetch(`/api/citizen-reports/${reportId}/duplicates`);
  const data = await response.json();
  
  if (data.duplicatesFound > 0) {
    showDuplicatesAlert(data.duplicates);
  }
}

// Cargar historial
async function loadChangeHistory(reportId) {
  const response = await fetch(`/api/citizen-reports/${reportId}/history`);
  const data = await response.json();
  
  renderChangeHistory(data.history);
}
```

---

## 📊 Dashboard de Métricas

### Panel de Administración

```html
<div class="metrics-dashboard">
  <h2>📊 Métricas de Validación Comunitaria</h2>
  
  <div class="metrics-grid">
    <div class="metric-card">
      <h3>Total Reportes</h3>
      <div class="metric-value">150</div>
    </div>
    
    <div class="metric-card success">
      <h3>Validados</h3>
      <div class="metric-value">105</div>
      <div class="metric-percent">70.0%</div>
    </div>
    
    <div class="metric-card primary">
      <h3>Validados por Comunidad</h3>
      <div class="metric-value">85</div>
      <div class="metric-percent">56.67%</div>
    </div>
    
    <div class="metric-card warning">
      <h3>Tiempo Promedio a Validación</h3>
      <div class="metric-value">18.5 horas</div>
    </div>
  </div>
  
  <div class="chart-container">
    <canvas id="validationStatusChart"></canvas>
  </div>
  
  <div class="chart-container">
    <canvas id="severityDistributionChart"></canvas>
  </div>
</div>
```

---

## 🧪 Testing

### Casos de Prueba

#### 1. Validación Comunitaria Básica

```bash
# Confirmar 3 veces → debería pasar a 'community_validated'
for i in {1..3}; do
  curl -X POST http://localhost:3000/api/citizen-reports/1/validate \
    -H "Content-Type: application/json" \
    -d '{"validationType":"confirm","comment":"Confirmo #'$i'"}'
done
```

#### 2. Detección de Duplicados

```bash
# Crear 2 reportes cercanos en espacio/tiempo
curl -X POST http://localhost:3000/api/citizen-reports \
  -d '{"category":"waste","latitude":-12.046373,"longitude":-77.042754,"description":"Basura acumulada"}'

curl -X POST http://localhost:3000/api/citizen-reports \
  -d '{"category":"waste","latitude":-12.046400,"longitude":-77.042800,"description":"Basura en la esquina"}'

# Verificar duplicados del primer reporte
curl http://localhost:3000/api/citizen-reports/1/duplicates
```

#### 3. Moderación

```bash
curl -X POST http://localhost:3000/api/citizen-reports/1/moderate \
  -H "Content-Type: application/json" \
  -d '{
    "moderatorIdentifier":"admin@ecoplan.pe",
    "newStatus":"moderator_validated",
    "reason":"Verificado en campo",
    "newSeverity":"high"
  }'
```

---

## 🚀 Deployment

### 1. Aplicar Esquema SQL

```bash
psql -U postgres -d ecoplan -f docs/validation-schema.sql
```

### 2. Verificar Servicios

```bash
# Verificar que el servicio está cargado
node -e "const s = require('./services/reportValidationService'); console.log(s.getModerators())"
```

### 3. Reiniciar Servidor

```bash
pkill -f "node.*server.js"
node server.js
```

---

## 📈 KPIs de Éxito

| KPI | Target | Fórmula |
|-----|--------|---------|
| **% Reportes Validados** | > 60% | (community_validated + moderator_validated) / total |
| **% Validados por Comunidad** | > 50% | community_validated / total |
| **Tiempo Promedio a Validación** | < 24 horas | AVG(validated_at - reported_at) |
| **Tiempo Mediano** | < 12 horas | PERCENTILE(validated_at - reported_at, 0.5) |
| **Tasa de Duplicados** | < 10% | duplicates / total |
| **Tasa de Rechazo** | < 15% | rejected / total |

---

## 🔐 Consideraciones de Seguridad

### Anonimización de Usuarios

```javascript
// Hash SHA-256 de identificadores
hashUserIdentifier(identifier) {
  return crypto.createHash('sha256').update(identifier).digest('hex').substring(0, 16);
}
```

### Rate Limiting

```javascript
// Limitar validaciones por usuario (en producción con Redis)
const validationLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 50, // 50 validaciones máximo
  message: 'Demasiadas validaciones, intenta más tarde'
});

app.use('/api/citizen-reports/:id/validate', validationLimit);
```

### Anti-Spam

- Limitar validaciones del mismo usuario al mismo reporte
- Constraint UNIQUE en `(report_id, user_identifier, validation_type)`
- Detectar patrones sospechosos de validaciones masivas

---

## 🎯 Próximos Pasos

1. **Gamificación:** Sistema de puntos/badges por validaciones correctas
2. **Notificaciones:** Alertar al creador cuando su reporte es validado
3. **Machine Learning:** Predecir severidad basado en historial
4. **Integración GEE:** Correlación de validaciones con índices satelitales
5. **API Pública:** Exponer métricas para investigadores

---

## 📚 Referencias

- **Esquema SQL:** `docs/validation-schema.sql`
- **Servicio Node.js:** `services/reportValidationService.js`
- **Endpoints API:** `server.js` (líneas 1990-2230)
- **Documentación DB:** `docs/database-schema.sql`

---

**Implementado:** 5 de octubre de 2025  
**Versión:** 1.0.0  
**Estado:** ✅ Producción Ready
