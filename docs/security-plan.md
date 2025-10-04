# Plan de seguridad y privacidad – EcoPlan Urbano

## 1. Protección de datos sensibles

- **Clasificación**: datos satelitales (públicos), socioeconómicos agregados (sensibles), reportes ciudadanos (personales).
- **Almacenamiento**: cifrado en reposo (Cloud Storage, PostgreSQL con TDE). Para datos sensibles, aplicar `pgcrypto` o servicios KMS.
- **Transmisión**: HTTPS obligatorio, TLS 1.2+. Configurar certificados gestionados (Let's Encrypt o Google Managed SSL).

## 2. Autenticación y autorización

- **Backend**: plan para JWT con refresco y roles (`admin`, `editor`, `viewer`, `citizen`).
- **Participación ciudadana**: posibilidad de reportes anónimos pero con captcha/token para evitar abuso.
- **Integración institucional**: OAuth2 (Google/Institutional SSO) para dashboards internos.

## 3. Gestión de secretos

- Variables `.env` sólo para desarrollo local.
- En producción utilizar Secret Manager (GCP) o Vault, con rotación cada 90 días.
- Revisar que `service-account.json` no se distribuya públicamente (añadir a `.gitignore` si no se requiere en repo).

## 4. Cumplimiento legal

- Evaluar normativa peruana de protección de datos personales (Ley N°29733) para reportes ciudadanos.
- Elaborar `docs/legal.md` con políticas de privacidad y términos de uso (pendiente).
- Incluir consentimiento informado en formularios de recolección.

## 5. Seguridad operativa

- Auditorías trimestrales de dependencias (npm audit, Snyk).
- Revisión de roles IAM GCP (principio de privilegio mínimo).
- Logs centralizados (Stackdriver) con alertas ante uso anómalo.

## 6. Plan de respuesta a incidentes

1. Detectar: alertas de monitoreo.
2. Contener: revocar credenciales comprometidas.
3. Erradicar: corregir vulnerabilidad, aplicar parches.
4. Recuperar: restaurar servicios y comunicar a actores.
5. Postmortem: documentar causa raíz y acciones preventivas.

## 7. Roadmap de seguridad

- [ ] Implementar autenticación JWT en la API.
- [ ] Añadir rate limiting y monitoreo de IPs.
- [ ] Configurar CSP y seguridad en frontend (headers HTTP).
- [ ] Realizar pruebas de penetración anuales.

Actualizar este plan en la fase 7 y 10 del manual para reflejar nuevas necesidades o regulaciones.
