# TinyPlanvas - PocketBase Backend

Dieses Verzeichnis enthält das PocketBase-Backend für TinyPlanvas.

## Quick Start

### 1. PocketBase starten

```bash
# Vom Projekt-Root:
npm run pocketbase:start

# Oder direkt:
docker compose up -d pocketbase
```

### 2. Admin-Account erstellen

1. Öffne http://127.0.0.1:8090/_/
2. Erstelle einen Admin-Account beim ersten Besuch
3. Die Collections werden automatisch durch Migrations angelegt!

### 3. Frontend starten

```bash
npm run dev
```

Die App ist unter http://localhost:3000 erreichbar.

## Collections

Die folgenden Collections werden automatisch erstellt:

| Collection | Beschreibung |
|------------|--------------|
| `projects` | Haupt-Projekte |
| `tasks` | Aufgaben innerhalb eines Projekts |
| `resources` | Ressourcen, die Aufgaben zugeordnet sind |
| `allocations` | Zeit-basierte Ressourcen-Zuweisungen |

## API-Regeln

Standardmäßig sind alle Collections für alle Benutzer les- und schreibbar (für Entwicklung).

**Für Produktion sollten die Regeln angepasst werden!**

Beispiel für projektbasierte Zugriffskontrolle:
```
listRule: @request.auth.id != ""
createRule: @request.auth.id != ""
updateRule: @request.auth.id = user_id
deleteRule: @request.auth.id = user_id
```

## Realtime

PocketBase bietet automatisch Realtime-Updates über WebSockets.
Die App nutzt diese für Live-Synchronisierung zwischen Benutzern.

## Befehle

```bash
# PocketBase starten
npm run pocketbase:start

# PocketBase stoppen
npm run pocketbase:stop

# Logs anzeigen
npm run pocketbase:logs

# Container komplett entfernen (inkl. Daten)
docker compose down -v
```

## Daten-Persistenz

Daten werden im Docker Volume `tinyplanvas_pocketbase_data` gespeichert.

Um Daten zu sichern:
```bash
docker cp tinyplanvas-pocketbase:/pb/pb_data ./backup_pb_data
```

## Ports

| Service | Port |
|---------|------|
| PocketBase API | 8090 |
| PocketBase Admin | 8090/_/ |
