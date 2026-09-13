-- ============================================================================
-- Auswertungsschema und die Rolle, unter der der Coach abfragt.
--
-- Der Coach ist keine vertrauenswürdige Aufruferin. Was er sehen darf, steht
-- hier — und nur hier. Die Schranken liegen in der Datenbank, nicht in der
-- Anwendung: eine Prüfung im TypeScript lässt sich umgehen, ein fehlendes
-- GRANT nicht.
--
-- Einspielen als Eigentümer der Datenbank:
--   psql "$TAKT_DATENBANK_URL" -v coach_passwort="'…'" -f datenbank/01-auswertung-schema.sql
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS auswertung;

-- ---------------------------------------------------------------------------
-- Views. Bewusst ohne die Spalte rohdaten: die trägt die vollständige Antwort
-- von intervals.icu, und was darin steht, wissen wir nicht sicher.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW auswertung.aktivitaeten AS
SELECT
  a.id,
  a.beginn,
  a.name,
  a.typ,
  a.dauer_sekunden,
  a.strecke_meter,
  a.hoehenmeter,
  a.puls_schnitt,
  a.puls_max,
  a.belastung,
  CASE
    WHEN a.dauer_sekunden > 0 AND a.strecke_meter > 0
    THEN (a.dauer_sekunden / a.strecke_meter) * 1000
  END AS pace_sekunden_je_km,
  a.beginn::date AS tag
FROM public.aktivitaeten a;

CREATE OR REPLACE VIEW auswertung.wellness AS
SELECT
  w.tag,
  w.ctl AS fitness,
  w.atl AS ermuedung,
  w.form,
  w.ruhepuls,
  w.hrv,
  w.gewicht,
  w.schlaf_sekunden,
  w.befinden,
  w.beschwerden,
  w.verletzung,
  w.notizen
FROM public.wellness w;

CREATE OR REPLACE VIEW auswertung.plan AS
SELECT
  p.id,
  p.tag,
  p.name,
  p.typ,
  p.beschreibung,
  p.ziel_belastung,
  p.ziel_dauer_sekunden,
  p.ziel_strecke_meter
FROM public.plan p;

CREATE OR REPLACE VIEW auswertung.ausruestung AS
SELECT
  g.id,
  g.name,
  g.art,
  g.in_benutzung,
  g.laufleistung_meter
FROM public.ausruestung g;

CREATE OR REPLACE VIEW auswertung.strecken AS
SELECT
  s.id,
  s.name,
  s.laenge_meter,
  s.erst_mal,
  s.letzt_mal,
  s.anzahl
FROM public.strecken s;

CREATE OR REPLACE VIEW auswertung.strecken_zuordnung AS
SELECT
  z.aktivitaet_id,
  z.strecke_id,
  z.mittlerer_abstand_meter
FROM public.strecken_zuordnung z;

CREATE OR REPLACE VIEW auswertung.zonen AS
SELECT
  z.sportart,
  z.schwellen_puls,
  z.max_puls,
  z.schwellen_pace_sekunden_je_km,
  z.puls_grenzen
FROM public.zonen z;

/*
 * Tagesbelastung als eigene View: der Coach soll Monotonie und Rampe
 * nachrechnen können, ohne über die Aktivitäten zu aggregieren.
 */
CREATE OR REPLACE VIEW auswertung.tagesbelastung AS
SELECT
  a.beginn::date AS tag,
  COALESCE(SUM(a.belastung), 0)::double precision AS belastung,
  COALESCE(SUM(a.strecke_meter), 0)::double precision AS strecke_meter,
  COALESCE(SUM(a.dauer_sekunden), 0)::bigint AS dauer_sekunden,
  COUNT(*)::bigint AS einheiten
FROM public.aktivitaeten a
GROUP BY a.beginn::date;

-- ---------------------------------------------------------------------------
-- Die Rolle.
-- ---------------------------------------------------------------------------

/*
 * Rolle anlegen oder ihr Passwort auffrischen.
 *
 * Nicht in einem DO-Block: psql ersetzt seine Variablen nicht innerhalb von
 * $$-Anführung, dort stünde wörtlich :'coach_passwort'. Über \gexec wird die
 * Anweisung erst gebaut und dann ausgeführt — mit %L, das ordentlich quotiert.
 */
SELECT format('CREATE ROLE takt_coach LOGIN PASSWORD %L', :'coach_passwort')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'takt_coach')
UNION ALL
SELECT format('ALTER ROLE takt_coach PASSWORD %L', :'coach_passwort')
WHERE EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'takt_coach')
\gexec

-- Alles wegnehmen, dann einzeln zurückgeben. Nicht andersherum.
REVOKE ALL ON SCHEMA public FROM takt_coach;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM takt_coach;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM takt_coach;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM takt_coach;

/*
 * In PostgreSQL 15 und später hat PUBLIC ohnehin kein CREATE mehr auf public.
 * Der Vollständigkeit halber trotzdem, damit die Regel auch auf älteren
 * Ständen gilt.
 */
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM PUBLIC;

-- Nur lesen, nur im Auswertungsschema.
GRANT USAGE ON SCHEMA auswertung TO takt_coach;
GRANT SELECT ON ALL TABLES IN SCHEMA auswertung TO takt_coach;

-- Kein Anlegen eigener Gebilde, auch nicht im Auswertungsschema.
REVOKE CREATE ON SCHEMA auswertung FROM takt_coach;
REVOKE CREATE ON SCHEMA auswertung FROM PUBLIC;

-- Künftige Views im Auswertungsschema sollen ebenfalls lesbar sein.
ALTER DEFAULT PRIVILEGES IN SCHEMA auswertung GRANT SELECT ON TABLES TO takt_coach;

/*
 * Der Suchpfad enthält ausschließlich das Auswertungsschema. Ein unqualifiziertes
 * `SELECT * FROM aktivitaeten` landet damit auf der View, nie auf der Tabelle.
 * pg_catalog liegt immer implizit davor, lässt sich nicht entfernen und
 * enthält keine Zugangsdaten: pg_authid und pg_shadow sind
 * Superuser-Angelegenheit.
 */
ALTER ROLE takt_coach SET search_path = auswertung;

-- Harte Schranken, an der Rolle festgemacht statt je Verbindung gesetzt.
ALTER ROLE takt_coach SET statement_timeout = '5s';
ALTER ROLE takt_coach SET idle_in_transaction_session_timeout = '10s';
ALTER ROLE takt_coach SET default_transaction_read_only = on;

-- Keine Nebenläufigkeit, kein Warten auf Sperren.
ALTER ROLE takt_coach SET lock_timeout = '1s';
