# 🚀 Inicio Rápido: Datos Socioeconómicos

## En 60 segundos

### 1. Iniciar servidor (10 segundos)
```bash
cd /workspaces/GEE
npm start
```

### 2. Abrir navegador (5 segundos)
```
http://localhost:3000
```

### 3. Scroll hasta sección (5 segundos)
Buscar el icono **📊 Datos Socioeconómicos**

### 4. Seleccionar y explorar (40 segundos)
```
Barrio: Miraflores
Año: 2020
[Automático] → Ver resultados
```

## ¡Listo! 🎉

---

## Ejemplo de Resultado

```
🏘️ MIRAFLORES (2020)
═══════════════════════════════════════════

Barrio con densidad de 10,210 hab/km². 
Privación moderada. 
Área verde: 5.3 m²/persona

👥 POBLACIÓN: 197,473 habitantes
   Densidad: 10,210 hab/km²
   Área: 19.34 km²

🏥 SERVICIOS: 1.09 per cápita
   4 hospitales
   39 colegios
   5.3 m²/hab de parques

📉 PRIVACIÓN: 0.374 (Moderada)
   Luminosidad: 59.34 nW·cm⁻²·sr⁻¹
   Acceso verde: 0.065
```

---

## Pruebas Rápidas

### Test API
```bash
curl http://localhost:3000/api/socioeconomic/miraflores?year=2020 | jq
```

### Test Suite Completa
```bash
bash tests/test-datos-socioeconomicos.sh
```

### Ver Documentación
```bash
open http://localhost:3000/api-docs
```

---

## Descargar Datos

1. Click en **📥 Descargar datos**
2. Elegir formato:
   - **1** = JSON (para programadores)
   - **2** = CSV (para Excel)
3. Archivo descargado automáticamente

---

## Casos de Uso Express

### Comparar 2 barrios
```bash
# Miraflores
curl -s http://localhost:3000/api/socioeconomic/miraflores?year=2020 | jq '.population.densityMean'

# San Isidro
curl -s http://localhost:3000/api/socioeconomic/san-isidro?year=2020 | jq '.population.densityMean'
```

### Filtrar barrios densos
```bash
curl -X POST http://localhost:3000/api/socioeconomic/filter \
  -H "Content-Type: application/json" \
  -d '{"densityMin":10000}' | jq '.total'
```

---

## Solución de Problemas

### Error: "Server not running"
```bash
# Verificar puerto
lsof -i :3000

# Reiniciar
pkill -f "node server.js"
npm start
```

### Error: "Earth Engine not initialized"
```bash
# Verificar service-account.json existe
ls -la service-account.json

# Ver logs
tail -f server.log
```

---

## Documentación Completa

- **Implementación**: `IMPLEMENTACION-DATOS-SOCIOECONOMICOS.md`
- **Demo**: `DEMO-DATOS-SOCIOECONOMICOS.md`
- **Resumen**: `RESUMEN-DATOS-SOCIOECONOMICOS.md`
- **Completado**: `COMPLETADO-PUNTO-6.md`

---

**¿Listo en 60 segundos? ¡Adelante! 🚀**
