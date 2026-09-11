# Cómo usar esta configuración de Claude Code en SADIM

## 1. Instalar en el repositorio
Copia el contenido de este paquete en la RAÍZ del repositorio (donde está la carpeta del backend y la del frontend):

```
tu-repo/
├── CLAUDE.md                ← instrucciones que Claude Code lee en cada sesión
├── .claude/
│   ├── settings.json        ← permisos (qué puede hacer sin preguntar, qué nunca)
│   ├── rules/               ← reglas que se cargan solas al tocar modelos, API o frontend
│   ├── skills/              ← comandos /auditar-sprint2, /implementar-hu, /verificar-consistencia
│   └── agents/              ← subagente revisor-consistencia
└── docs/
    ├── referencia/          ← ADR, ERD, CU, Contrato, Backlog, Anteproyecto (en Markdown)
    ├── INCONSISTENCIAS.md   ← problemas conocidos con ID (INC-XX, VAC-XX)
    └── TRAZABILIDAD.md      ← matriz HU ↔ CU
```

`.claude` es una carpeta oculta: en macOS usa Cmd+Shift+. en Finder para verla; en Windows, "Mostrar elementos ocultos".

Si ya tienes un `CLAUDE.md` o una carpeta `docs/` con otro contenido, fusiona a mano en lugar de sobrescribir.

Agrega a `.gitignore`:
```
CLAUDE.local.md
.claude/settings.local.json
.claude/agent-memory-local/
```

## 2. Ajustar comandos si tu entorno es distinto
`settings.json` asume `python manage.py ...` desde la carpeta del backend. Si usas `python3`, `uv run`, `poetry run` o Docker, cambia esos patrones; si no coinciden, Claude Code simplemente te pedirá permiso cada vez.

## 3. Primera sesión
```bash
cd tu-repo
claude
```
Dentro de Claude Code:
1. `/memory` para confirmar que cargó CLAUDE.md.
2. `/auditar-sprint2` — revisa HU-001..HU-012 sin tocar código y genera `docs/auditorias/auditoria-sprint2-<fecha>.md`.
3. Lee el informe, decide las entradas de `docs/INCONSISTENCIAS.md` y registra la decisión en su fila.
4. Pide a Claude Code que complete la sección "Comandos del proyecto" de CLAUDE.md con lo que propuso la auditoría.

## 4. Día a día
- `/implementar-hu HU-013` — flujo guiado: trazabilidad → plan → código → pruebas → revisión.
- `/verificar-consistencia` — revisa tu diff actual contra la documentación.
- Tecla Shift+Tab para alternar a "plan mode" cuando quieras que solo analice sin editar.

## 5. Cuando cambie un documento aprobado
Actualiza el .docx, vuelve a exportarlo a Markdown en `docs/referencia/` y, si resuelve una inconsistencia, marca la entrada como "Resuelta" con la decisión. Claude Code tiene prohibido editar `docs/referencia/`: esos cambios los haces tú.
