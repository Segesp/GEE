# 🚀 INICIO RÁPIDO - ÍNDICES AMBIENTALES COMPUESTOS

## ⚡ Prueba en 60 Segundos

### 1. Iniciar servidor (si no está corriendo)
```bash
cd /workspaces/GEE
node server.js
```

### 2. Probar endpoint principal
```bash
curl -s "http://localhost:3000/api/composite-indices/miraflores" | jq '.totalIndex, .indices.heatVulnerability.value'
```

**Salida esperada**:
```
0.314
0.569
```

### 3. Abrir en navegador
```
http://localhost:3000
```

Hacer scroll hasta la sección **"Índices Ambientales Compuestos"** (icono 🎯)

---

## 🎮 DEMO RÁPIDA

### Ejemplo 1: Ver índices de un barrio
```bash
curl -s "http://localhost:3000/api/composite-indices/barranco" | jq '{
  barrio: .neighborhoodName,
  indice_total: .totalIndex,
  calor: .indices.heatVulnerability.value,
  verde: .indices.greenSpaceDeficit.value,
  contaminacion: .indices.airPollution.value,
  agua: .indices.waterRisk.value
}'
```

### Ejemplo 2: Comparar 3 barrios
```bash
curl -s -X POST "http://localhost:3000/api/composite-indices/compare" \
  -H "Content-Type: application/json" \
  -d '{"neighborhoodIds": ["miraflores", "san-isidro", "barranco"]}' \
  | jq 'map({barrio: .neighborhoodName, total: .totalIndex})'
```

### Ejemplo 3: Simular escenario de mejora
```bash
curl -s -X POST "http://localhost:3000/api/composite-indices/scenario" \
  -H "Content-Type: application/json" \
  -d '{
    "neighborhoodId": "miraflores",
    "changes": {
      "vegetationIncrease": 0.3,
      "pollutionReduction": 0.2,
      "greenSpaceIncrease": 3
    }
  }' | jq '{
    antes: .before.totalIndex,
    despues: .after.totalIndex,
    mejora_porcentual: (.improvements.total * 100 | floor)
  }'
```

### Ejemplo 4: Pesos personalizados
```bash
curl -s -X POST "http://localhost:3000/api/composite-indices/custom-weights" \
  -H "Content-Type: application/json" \
  -d '{
    "neighborhoodId": "miraflores",
    "weights": {
      "heat": 0.5,
      "green": 0.2,
      "pollution": 0.2,
      "water": 0.1
    }
  }' | jq '.totalIndex'
```

---

## 🖥️ DEMO FRONTEND

### Paso a paso:

1. **Abrir**: http://localhost:3000
2. **Buscar sección**: "Índices Ambientales Compuestos" (🎯)
3. **Seleccionar barrio**: "Miraflores" en el dropdown
4. **Esperar cálculo**: ~9 segundos (Earth Engine procesando)
5. **Ver resultados**:
   - Tarjeta principal muestra índice total: **0.31**
   - 4 tarjetas coloreadas con cada índice
   - Gráfico radar visualizando los 4 valores

6. **Probar pesos personalizados**:
   - Mover slider "Calor" a 0.40
   - Mover slider "Verde" a 0.30
   - Mover slider "Contaminación" a 0.20
   - Mover slider "Agua" a 0.10
   - Verificar que suma = 1.00 (indicador verde)
   - Clicar "Aplicar pesos personalizados"
   - Ver nuevo índice total recalculado

7. **Simular escenario**:
   - Mover slider "Aumento vegetación" a 25%
   - Mover slider "Reducción contaminación" a 15%
   - Mover slider "Áreas verdes adicionales" a 2 m²/hab
   - Clicar "🎬 Simular escenario"
   - Ver mejoras proyectadas en cada índice

8. **Ver detalles**:
   - Clicar "Ver componentes" en tarjeta "Vulnerabilidad Calor"
   - Ver popup con componentes: LST, NDVI, densidad, vulnerabilidad
   - Ver fórmula y pesos aplicados

9. **Descargar datos**:
   - Clicar "📥 Descargar datos completos"
   - Se descarga JSON con toda la información

---

## 🧪 EJECUTAR TESTS

```bash
cd /workspaces/GEE
bash tests/test-indices-compuestos.sh
```

**Duración**: ~10 minutos (incluye múltiples llamadas a Earth Engine)

**Tests clave**:
- ✅ Test 3-12: Estructura de datos y componentes
- ✅ Test 13-17: Validación de rangos (0-1)
- ✅ Test 21-25: Simulador de escenarios
- ✅ Test 27-28: Pesos personalizados y validación

---

## 📊 DATOS DE EJEMPLO

### Miraflores
```json
{
  "totalIndex": 0.314,
  "interpretation": "Buena calidad ambiental",
  "indices": {
    "heat": 0.569,          // Alta vulnerabilidad al calor
    "green": 0.053,         // Áreas verdes adecuadas
    "pollution": 0.237,     // Aire de buena calidad
    "water": 0.355          // Riesgo hídrico moderado
  }
}
```

### Barranco
```json
{
  "totalIndex": 0.285,
  "interpretation": "Buena calidad ambiental",
  "indices": {
    "heat": 0.512,          // Vulnerabilidad moderada
    "green": 0.089,         // Áreas verdes cerca del estándar
    "pollution": 0.198,     // Aire limpio
    "water": 0.287          // Riesgo hídrico bajo
  }
}
```

---

## 🔍 VERIFICACIÓN RÁPIDA

### ¿El servidor está corriendo?
```bash
curl -s "http://localhost:3000/" | head -5
```
Debe mostrar HTML.

### ¿El endpoint funciona?
```bash
curl -s "http://localhost:3000/api/composite-indices/miraflores" | jq keys
```
Debe mostrar: `["indices", "metadata", "neighborhoodId", ...]`

### ¿Swagger está accesible?
```bash
curl -s "http://localhost:3000/api-docs" | grep composite-indices
```
Debe mostrar referencias al endpoint.

---

## 🐛 SOLUCIÓN DE PROBLEMAS

### Problema: "Cannot GET /api/composite-indices/..."
**Solución**: Reiniciar servidor
```bash
pkill -f "node server.js"
cd /workspaces/GEE
node server.js
```

### Problema: "Error calculating indices"
**Causas posibles**:
1. Credenciales Earth Engine no válidas
2. Geometría del barrio inválida
3. Timeout de Earth Engine (>30s)

**Solución**:
```bash
# Verificar credenciales
cat service-account.json | jq '.project_id'

# Ver logs del servidor
tail -50 /tmp/server_nuevo.log
```

### Problema: Tests fallan
**Causa**: Servidor no está corriendo o responde lento

**Solución**:
```bash
# Verificar que servidor responde
curl -s "http://localhost:3000/" > /dev/null && echo "OK" || echo "FAIL"

# Aumentar timeout en test script (línea 21)
# TIMEOUT=60  # en lugar de 30
```

---

## 📚 RECURSOS ADICIONALES

- **Documentación completa**: `/workspaces/GEE/IMPLEMENTACION-INDICES-COMPUESTOS.md`
- **Guía de completitud**: `/workspaces/GEE/COMPLETADO-INDICES-COMPUESTOS.md`
- **Swagger UI**: http://localhost:3000/api-docs
- **Tests**: `/workspaces/GEE/tests/test-indices-compuestos.sh`
- **Servicio backend**: `/workspaces/GEE/services/compositeIndicesService.js`
- **Frontend JS**: `/workspaces/GEE/public/js/compositeIndices.js`

---

## 🎯 CASOS DE USO RÁPIDOS

### Caso 1: Identificar barrio más vulnerable al calor
```bash
for barrio in miraflores san-isidro surquillo barranco surco san-borja; do
  echo -n "$barrio: "
  curl -s "http://localhost:3000/api/composite-indices/$barrio" \
    | jq -r '.indices.heatVulnerability.value'
done | sort -t: -k2 -nr
```

### Caso 2: Ranking de calidad ambiental
```bash
for barrio in miraflores san-isidro surquillo barranco surco san-borja; do
  echo -n "$barrio: "
  curl -s "http://localhost:3000/api/composite-indices/$barrio" \
    | jq -r '.totalIndex'
done | sort -t: -k2 -n
```

### Caso 3: Evaluar impacto de intervención
```bash
# Simular agregar 5 m²/hab de áreas verdes en Surquillo
curl -s -X POST "http://localhost:3000/api/composite-indices/scenario" \
  -H "Content-Type: application/json" \
  -d '{
    "neighborhoodId": "surquillo",
    "changes": {
      "vegetationIncrease": 0,
      "pollutionReduction": 0,
      "greenSpaceIncrease": 5
    }
  }' | jq '{
    verde_antes: .before.indices.greenSpaceDeficit.value,
    verde_despues: .after.indices.greenSpaceDeficit.value,
    mejora_puntos: ((.before.indices.greenSpaceDeficit.value - .after.indices.greenSpaceDeficit.value) * 100 | round / 100)
  }'
```

---

## ✅ CHECKLIST DE VERIFICACIÓN

- [ ] Servidor corriendo en puerto 3000
- [ ] Endpoint `/api/composite-indices/miraflores` responde
- [ ] Frontend muestra sección "Índices Ambientales Compuestos"
- [ ] Gráfico radar se renderiza correctamente
- [ ] Pesos personalizados suman 1.0 y se aplican
- [ ] Simulador de escenarios funciona
- [ ] Botón de descarga genera JSON
- [ ] Tests pasan (al menos los primeros 20)

---

**¿Listo?** ¡Abre http://localhost:3000 y explora los índices ambientales! 🚀
