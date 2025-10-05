# Flujo de Validación Comunitaria - Diagrama Visual

## 🔄 Ciclo de Vida de un Reporte

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CREACIÓN DE REPORTE                                   │
│  Usuario envía: categoría + ubicación + descripción + foto              │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │  Estado: PENDING│
                    │  Score: 0       │
                    │  Severidad: ?   │
                    └────────┬────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    DETECCIÓN AUTOMÁTICA                                 │
│  Sistema busca duplicados en radio 100m + ventana 48h                  │
└────────────────────────────┬───────────────────────────────────────────┘
                             │
                    ┌────────┴────────┐
                    │ ¿Duplicados?    │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
                    ▼                 ▼
              ┌─────────┐       ┌─────────┐
              │  SÍ     │       │  NO     │
              │ Mostrar │       │ Continúa│
              │ alerta  │       │ normal  │
              └─────────┘       └────┬────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    VALIDACIÓN COMUNITARIA                               │
│  Cualquier usuario puede votar (identificado por hash IP/session)      │
└────────────────────────────┬───────────────────────────────────────────┘
                             │
                    ┌────────┴────────┐
                    │ Tipos de Voto:  │
                    │ • Confirmar     │
                    │ • Rechazar      │
                    │ • Duplicado     │
                    │ • Severidad     │
                    └────────┬────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    CONTEO DE VOTOS                                      │
│  Sistema actualiza contadores en tiempo real                           │
└────────────────────────────┬───────────────────────────────────────────┘
                             │
                    ┌────────┴────────┐
                    │  Confirmaciones │◄─── ≥3 → COMMUNITY_VALIDATED
                    │  Rechazos       │◄─── ≥3 → REJECTED
                    │  Duplicados     │◄─── ≥2 → DUPLICATE
                    └────────┬────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │ ¿Umbral        │
                    │  alcanzado?    │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
                    ▼                 ▼
              ┌─────────┐       ┌─────────┐
              │  SÍ     │       │  NO     │
              │ Cambiar │       │ Esperar │
              │ estado  │       │ más votos│
              └────┬────┘       └─────────┘
                   │
                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    CAMBIO DE ESTADO                                     │
│  • Actualizar validation_status                                        │
│  • Registrar en change_history                                         │
│  • Calcular validation_score                                           │
└────────────────────────────┬───────────────────────────────────────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │ Estado Final:  │
                    │ • Validado ✅  │
                    │ • Rechazado ❌ │
                    │ • Duplicado 🔄 │
                    └────────┬────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    MODERACIÓN (Opcional)                                │
│  Moderador puede validar/rechazar directamente (bypass)                │
└────────────────────────────┬───────────────────────────────────────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │ MODERATOR_     │
                    │ VALIDATED      │
                    └────────┬────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    MÉTRICAS Y REPORTES                                  │
│  • % validados por comunidad                                           │
│  • Tiempo promedio a validación                                        │
│  • Distribución por severidad                                          │
│  • Tasa de duplicados/rechazos                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Flujo de Votación Individual

```
Usuario ve reporte
       │
       ▼
┌──────────────┐
│ ¿Qué hacer?  │
└──────┬───────┘
       │
       ├────► "Confirmo" ────► confirmations++
       │                       validation_score++
       │
       ├────► "No es así" ──► rejections++
       │                      validation_score--
       │
       ├────► "Duplicado" ──► duplicates++
       │                      is_duplicate_of = X
       │
       └────► "Severidad" ──► severity_votes[nivel]++
                               (si 2+ votos → actualizar)
```

---

## 🔍 Algoritmo de Detección de Duplicados

```
Entrada: reportId

1. Obtener reporte base (R1)
   ├─ categoría
   ├─ ubicación (lat, lon)
   ├─ fecha
   └─ descripción

2. Filtrar candidatos:
   ┌─────────────────────────────────┐
   │ FOR EACH reporte R2:            │
   │   IF R2.id == R1.id → SKIP      │
   │   IF R2.categoría != R1.categoría → SKIP │
   │   IF R2.status == 'duplicate' → SKIP     │
   │                                 │
   │   distancia = Haversine(R1, R2) │
   │   IF distancia > 100m → SKIP    │
   │                                 │
   │   diff_tiempo = |R1.fecha - R2.fecha| │
   │   IF diff_tiempo > 48h → SKIP   │
   │                                 │
   │   similitud = Dice(R1.desc, R2.desc) │
   │   IF similitud < 0.3 → SKIP     │
   │                                 │
   │   → CANDIDATO VÁLIDO            │
   └─────────────────────────────────┘

3. Calcular score compuesto:
   ┌─────────────────────────────────┐
   │ score = (1 - dist/100m) * 0.4 + │
   │         (1 - tiempo/48h) * 0.3 + │
   │         similitud * 0.3          │
   └─────────────────────────────────┘

4. Ordenar por score DESC

5. Retornar top 5 candidatos
```

---

## 🎯 Lógica de Cambio de Estado

```
Estado Actual: PENDING
       │
       ▼
┌──────────────────────────────────┐
│ Verificar contadores:            │
│                                  │
│ IF duplicates >= 2:              │
│    → DUPLICATE                   │
│    → is_duplicate_of = X         │
│    → history: 'duplicate_marked' │
│                                  │
│ ELSE IF rejections >= 3:         │
│    → REJECTED                    │
│    → history: 'status_change'    │
│                                  │
│ ELSE IF confirmations >= 3:      │
│    → COMMUNITY_VALIDATED         │
│    → validated_at = NOW()        │
│    → validated_by = 'community'  │
│    → history: 'validated'        │
│                                  │
│ ELSE:                            │
│    → Mantener PENDING            │
│    → Actualizar contadores       │
└──────────────────────────────────┘
```

---

## 📝 Historial de Cambios (Ejemplo)

```
Reporte #42: "Basura acumulada en esquina"
═══════════════════════════════════════════

┌─────────────────────────────────────────────────────┐
│ [2025-10-05 10:00:00] CREATED                       │
│ Estado: pending                                     │
│ Por: system                                         │
└─────────────────────────────────────────────────────┘
                    ▼
┌─────────────────────────────────────────────────────┐
│ [2025-10-05 10:15:00] VALIDATION                    │
│ Usuario a3f7b9c2... confirmó                        │
│ Score: 0 → 1                                        │
└─────────────────────────────────────────────────────┘
                    ▼
┌─────────────────────────────────────────────────────┐
│ [2025-10-05 10:30:00] VALIDATION                    │
│ Usuario 8f2c4a1d... confirmó                        │
│ Score: 1 → 2                                        │
└─────────────────────────────────────────────────────┘
                    ▼
┌─────────────────────────────────────────────────────┐
│ [2025-10-05 11:00:00] VALIDATION                    │
│ Usuario 5e9b7f3a... confirmó                        │
│ Score: 2 → 3                                        │
└─────────────────────────────────────────────────────┘
                    ▼
┌─────────────────────────────────────────────────────┐
│ [2025-10-05 11:00:01] STATUS_CHANGE                 │
│ pending → community_validated                       │
│ Por: community                                      │
│ Razón: "Validado por la comunidad"                  │
└─────────────────────────────────────────────────────┘
                    ▼
┌─────────────────────────────────────────────────────┐
│ [2025-10-05 11:15:00] SEVERITY_CHANGE              │
│ medium → high                                       │
│ Por: community                                      │
│ Votos: {high: 2, medium: 1}                         │
└─────────────────────────────────────────────────────┘

Total de cambios: 5
Tiempo a validación: 1 hora
Validadores únicos: 3
```

---

## 🎮 Interfaz de Usuario (Wireframe)

```
╔═══════════════════════════════════════════════════════════╗
║  Reporte #42: Basura acumulada                            ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  📍 Av. Principal con Jr. Secundaria                      ║
║  📅 Hace 2 horas                                          ║
║  🗑️ Categoría: Basura                                     ║
║  ⚠️ Severidad: Media                                      ║
║                                                           ║
║  "Hay aproximadamente 10 bolsas de basura sin            ║
║   recoger desde hace 3 días..."                           ║
║                                                           ║
╟───────────────────────────────────────────────────────────╢
║  🤝 AYUDA A VALIDAR                                       ║
╟───────────────────────────────────────────────────────────╢
║                                                           ║
║  Estado Actual: PENDIENTE                                 ║
║                                                           ║
║  ┌──────────┐  ┌──────────┐  ┌──────────┐               ║
║  │ ✅ 2     │  │ ❌ 0     │  │ 🔄 0     │               ║
║  │Confirmac.│  │ Rechazos │  │Duplicados│               ║
║  └──────────┘  └──────────┘  └──────────┘               ║
║                                                           ║
║  Score de validación: +2                                  ║
║  Falta 1 confirmación para validar ⏳                     ║
║                                                           ║
╟───────────────────────────────────────────────────────────╢
║  Tu Voto:                                                 ║
║                                                           ║
║  [ ✅ Confirmo ]  [ ❌ No es así ]  [ 🔄 Duplicado ]      ║
║                                                           ║
║  Severidad sugerida: ▼ Alta                               ║
║                                                           ║
║  ┌────────────────────────────────────────────────┐      ║
║  │ Comentario (opcional):                         │      ║
║  │                                                │      ║
║  │ "Confirmo, yo también lo vi ayer..."          │      ║
║  └────────────────────────────────────────────────┘      ║
║                                                           ║
║  [ Enviar Validación ]                                    ║
║                                                           ║
╟───────────────────────────────────────────────────────────╢
║  ⚠️ POSIBLES DUPLICADOS DETECTADOS (1)                    ║
╟───────────────────────────────────────────────────────────╢
║                                                           ║
║  📍 Reporte #41 - 45m de distancia - Hace 12h            ║
║  "Acumulación de basura en esquina..."                    ║
║  📊 Similitud: 87% | Score: 0.91                          ║
║                                                           ║
║  [ Marcar como Duplicado ]                                ║
║                                                           ║
╟───────────────────────────────────────────────────────────╢
║  📜 HISTORIAL DE CAMBIOS (3)         [Ver más ▼]         ║
╟───────────────────────────────────────────────────────────╢
║                                                           ║
║  🕐 Hace 2 horas - CREATED                                ║
║     Estado: pending                                       ║
║                                                           ║
║  🕐 Hace 1 hora - VALIDATION                              ║
║     Usuario a3f7... confirmó                              ║
║                                                           ║
║  🕐 Hace 30 min - VALIDATION                              ║
║     Usuario 8f2c... confirmó                              ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

---

## 📈 Dashboard de Métricas (Vista Moderador)

```
╔═══════════════════════════════════════════════════════════╗
║  📊 MÉTRICAS DE VALIDACIÓN COMUNITARIA                     ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  ┏━━━━━━━━━━━━━┓  ┏━━━━━━━━━━━━━┓  ┏━━━━━━━━━━━━━┓     ║
║  ┃ Total       ┃  ┃ Validados   ┃  ┃ Por Comunidad┃     ║
║  ┃   150       ┃  ┃   105 (70%) ┃  ┃   85 (56.7%) ┃     ║
║  ┗━━━━━━━━━━━━━┛  ┗━━━━━━━━━━━━━┛  ┗━━━━━━━━━━━━━┛     ║
║                                                           ║
║  ┏━━━━━━━━━━━━━┓  ┏━━━━━━━━━━━━━┓  ┏━━━━━━━━━━━━━┓     ║
║  ┃ Tiempo Avg  ┃  ┃ Rechazados  ┃  ┃ Duplicados  ┃     ║
║  ┃  18.5 horas ┃  ┃   15 (10%)  ┃  ┃   10 (6.7%) ┃     ║
║  ┗━━━━━━━━━━━━━┛  ┗━━━━━━━━━━━━━┛  ┗━━━━━━━━━━━━━┛     ║
║                                                           ║
╟───────────────────────────────────────────────────────────╢
║  DISTRIBUCIÓN POR ESTADO                                  ║
╟───────────────────────────────────────────────────────────╢
║                                                           ║
║  ████████████████████████████ Validados: 70%             ║
║  ██████████ Pendientes: 13%                               ║
║  ██████ Rechazados: 10%                                   ║
║  ███ Duplicados: 7%                                       ║
║                                                           ║
╟───────────────────────────────────────────────────────────╢
║  DISTRIBUCIÓN POR SEVERIDAD (Validados)                   ║
╟───────────────────────────────────────────────────────────╢
║                                                           ║
║  🚨 Alta:   ██████████ 25 reportes (23.8%)               ║
║  ⚠️ Media:  ████████████████████ 50 reportes (47.6%)     ║
║  ✅ Baja:   ███████████████ 30 reportes (28.6%)          ║
║                                                           ║
╟───────────────────────────────────────────────────────────╢
║  TOP VALIDADORES                                          ║
╟───────────────────────────────────────────────────────────╢
║                                                           ║
║  🥇 Usuario a3f7... - 45 validaciones                     ║
║  🥈 Usuario 8f2c... - 38 validaciones                     ║
║  🥉 Usuario 5e9b... - 32 validaciones                     ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

---

## 🔄 Estados Posibles

```
┌──────────┐
│ PENDING  │ ◄── Estado inicial
└─────┬────┘
      │
      ├──► 3+ confirmaciones ──► ┌──────────────────────┐
      │                          │ COMMUNITY_VALIDATED  │
      │                          └──────────────────────┘
      │
      ├──► 3+ rechazos ────────► ┌──────────┐
      │                          │ REJECTED │
      │                          └──────────┘
      │
      ├──► 2+ duplicados ──────► ┌───────────┐
      │                          │ DUPLICATE │
      │                          └───────────┘
      │
      └──► Moderador valida ───► ┌──────────────────────┐
                                  │ MODERATOR_VALIDATED  │
                                  └──────────────────────┘
```

---

**Diagrama creado:** 5 de octubre de 2025  
**Sistema:** Validación Comunitaria v1.0.0  
**Estado:** ✅ Production Ready
