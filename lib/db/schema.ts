import {
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * Grundgerüst. Phase 3 erweitert das um die Felder, die der erste echte
 * Abruf bei intervals.icu tatsächlich liefert — welche das sind, steht dann
 * in DECISIONS.md.
 */

export const aktivitaeten = pgTable(
  'aktivitaeten',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    beginn: timestamp('beginn', { withTimezone: true }).notNull(),
    name: text('name'),
    typ: varchar('typ', { length: 32 }).notNull(),
    dauerSekunden: integer('dauer_sekunden'),
    streckeMeter: doublePrecision('strecke_meter'),
    hoehenmeter: doublePrecision('hoehenmeter'),
    pulsSchnitt: integer('puls_schnitt'),
    pulsMax: integer('puls_max'),
    belastung: integer('belastung'),
    rohdaten: jsonb('rohdaten'),
    geholtAm: timestamp('geholt_am', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('aktivitaeten_beginn_idx').on(t.beginn)],
)

/** Verläufe sind groß und werden erst beim ersten Öffnen einer Aktivität geholt. */
export const verlaeufe = pgTable('verlaeufe', {
  aktivitaetId: varchar('aktivitaet_id', { length: 64 })
    .primaryKey()
    .references(() => aktivitaeten.id, { onDelete: 'cascade' }),
  daten: jsonb('daten').notNull(),
  /**
   * Womit der Verlauf geholt wurde. Wird die Art des Abrufs geändert — etwa
   * weil eine Reihe fehlte —, steigt die Zahl, und alte Zwischenspeicher
   * werden beim nächsten Öffnen einmal erneuert statt für immer falsch zu
   * bleiben. Siehe lib/daten/verlauf.ts.
   */
  fassung: integer('fassung').notNull().default(1),
  geholtAm: timestamp('geholt_am', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * CTL, ATL und Form kommen fertig von intervals.icu und werden nicht selbst
 * gerechnet. Beschwerden, Verletzung, Befinden und Notizen werden vollständig
 * übernommen — das Wochenbriefing stützt sich darauf.
 */
export const wellness = pgTable('wellness', {
  tag: date('tag').primaryKey(),
  ctl: doublePrecision('ctl'),
  atl: doublePrecision('atl'),
  form: doublePrecision('form'),
  ruhepuls: integer('ruhepuls'),
  hrv: doublePrecision('hrv'),
  gewicht: doublePrecision('gewicht'),
  schlafSekunden: integer('schlaf_sekunden'),
  befinden: integer('befinden'),
  beschwerden: text('beschwerden'),
  verletzung: text('verletzung'),
  notizen: text('notizen'),
  rohdaten: jsonb('rohdaten'),
  geholtAm: timestamp('geholt_am', { withTimezone: true }).notNull().defaultNow(),
})

/** Stand des Abgleichs je Quelle, damit inkrementell geholt werden kann. */
export const abgleich = pgTable('abgleich', {
  quelle: varchar('quelle', { length: 32 }).primaryKey(),
  bisEinschliesslich: timestamp('bis_einschliesslich', { withTimezone: true }),
  zuletztAm: timestamp('zuletzt_am', { withTimezone: true }),
  zuletztFehler: text('zuletzt_fehler'),
})

/** Geplante Einheiten. Wird gelesen und auch nach intervals.icu geschrieben. */
export const plan = pgTable(
  'plan',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    tag: date('tag').notNull(),
    name: text('name'),
    typ: varchar('typ', { length: 32 }),
    beschreibung: text('beschreibung'),
    zielBelastung: integer('ziel_belastung'),
    zielDauerSekunden: integer('ziel_dauer_sekunden'),
    zielStreckeMeter: doublePrecision('ziel_strecke_meter'),
    rohdaten: jsonb('rohdaten'),
    geholtAm: timestamp('geholt_am', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('plan_tag_idx').on(t.tag)],
)

export const ausruestung = pgTable('ausruestung', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: text('name').notNull(),
  art: varchar('art', { length: 32 }),
  inBenutzung: integer('in_benutzung'),
  laufleistungMeter: doublePrecision('laufleistung_meter'),
  rohdaten: jsonb('rohdaten'),
  geholtAm: timestamp('geholt_am', { withTimezone: true }).notNull().defaultNow(),
})

/** Schwellen und Grenzen der Herzfrequenzzonen aus den Sport-Settings. */
export const zonen = pgTable('zonen', {
  sportart: varchar('sportart', { length: 32 }).primaryKey(),
  schwellenPuls: integer('schwellen_puls'),
  maxPuls: integer('max_puls'),
  schwellenPaceSekundenJeKm: doublePrecision('schwellen_pace_sekunden_je_km'),
  pulsGrenzen: jsonb('puls_grenzen'),
  rohdaten: jsonb('rohdaten'),
  geholtAm: timestamp('geholt_am', { withTimezone: true }).notNull().defaultNow(),
})

/** Wiederkehrende Strecken, selbst erkannt. Kommt nicht von intervals.icu. */
export const strecken = pgTable('strecken', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: text('name'),
  laengeMeter: doublePrecision('laenge_meter').notNull(),
  /** Stützpunkte der Signatur, siehe lib/analyse/strecken.ts. */
  signatur: jsonb('signatur').notNull(),
  erstMal: timestamp('erst_mal', { withTimezone: true }).notNull(),
  letztMal: timestamp('letzt_mal', { withTimezone: true }).notNull(),
  anzahl: integer('anzahl').notNull().default(1),
})

export const streckenZuordnung = pgTable(
  'strecken_zuordnung',
  {
    aktivitaetId: varchar('aktivitaet_id', { length: 64 })
      .primaryKey()
      .references(() => aktivitaeten.id, { onDelete: 'cascade' }),
    streckeId: varchar('strecke_id', { length: 64 })
      .notNull()
      .references(() => strecken.id, { onDelete: 'cascade' }),
    mittlererAbstandMeter: doublePrecision('mittlerer_abstand_meter'),
  },
  (t) => [index('strecken_zuordnung_strecke_idx').on(t.streckeId)],
)

/**
 * Wie oft ein Wellness-Feld über den Erstbestand befüllt war. Grundlage für
 * E0.8: dauerhaft leere Felder werden in der Oberfläche ausgeblendet.
 */
export const feldbefuellung = pgTable('feldbefuellung', {
  quelle: varchar('quelle', { length: 32 }).notNull(),
  feld: varchar('feld', { length: 64 }).notNull(),
  befuellt: integer('befuellt').notNull(),
  gesamt: integer('gesamt').notNull(),
  geprueftAm: timestamp('geprueft_am', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Ergebnisse der festen Analysen. Das Wochenbriefing entsteht einmal
 * wöchentlich, nicht bei jedem Seitenaufruf.
 */
export const analysen = pgTable(
  'analysen',
  {
    id: varchar('id', { length: 96 }).primaryKey(),
    art: varchar('art', { length: 32 }).notNull(),
    /** Worauf sie sich bezieht: Kalenderwoche, Aktivitätskennung, Tag. */
    bezug: varchar('bezug', { length: 64 }).notNull(),
    text: text('text').notNull(),
    modell: varchar('modell', { length: 64 }).notNull(),
    erstelltAm: timestamp('erstellt_am', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('analysen_art_bezug_idx').on(t.art, t.bezug)],
)
