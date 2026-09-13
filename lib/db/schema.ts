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
