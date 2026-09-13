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

/**
 * Einstellungen als Schlüssel-Wert-Paare.
 *
 * Ein Nutzer, eine Handvoll Werte — eine Tabelle mit einer Spalte je
 * Einstellung müsste bei jeder neuen Einstellung wandern.
 */
export const einstellungen = pgTable('einstellungen', {
  schluessel: varchar('schluessel', { length: 64 }).primaryKey(),
  wert: text('wert').notNull(),
  geaendertAm: timestamp('geaendert_am', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Gesprächsfäden mit dem Coach.
 *
 * Der Verlauf lag bisher nur im Browser und überlebte kein Neuladen. Er
 * gehört in die Datenbank — auch damit er einen Neubau des Behälters
 * übersteht. Siehe DECISIONS.md, E11.1.
 */
export const unterhaltungen = pgTable(
  'unterhaltungen',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    /** Aus der ersten Frage gebildet, gekürzt. */
    titel: text('titel').notNull(),
    begonnenAm: timestamp('begonnen_am', { withTimezone: true }).notNull().defaultNow(),
    zuletztAm: timestamp('zuletzt_am', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('unterhaltungen_zuletzt_idx').on(t.zuletztAm)],
)

export const nachrichten = pgTable(
  'nachrichten',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    unterhaltungId: varchar('unterhaltung_id', { length: 64 })
      .notNull()
      .references(() => unterhaltungen.id, { onDelete: 'cascade' }),
    /** `du` oder `coach`. */
    rolle: varchar('rolle', { length: 8 }).notNull(),
    text: text('text').notNull(),
    /** Die Werkzeugzeilen, damit der Faden beim Wiederöffnen aussieht wie zuvor. */
    werkzeuge: jsonb('werkzeuge').notNull().default([]),
    /** Abgelaufener Zugang — eigener Zustand, kein gewöhnlicher Fehler. */
    zugang: text('zugang'),
    fehler: text('fehler'),
    reihenfolge: integer('reihenfolge').notNull(),
    erstelltAm: timestamp('erstellt_am', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('nachrichten_faden_idx').on(t.unterhaltungId, t.reihenfolge)],
)

/** Ein Satz Vorschläge, den der Coach auf eine Anfrage hin erzeugt hat. */
export const planvorschlaege = pgTable(
  'planvorschlaege',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    /** Das Ziel, das der Anfrage zugrunde lag — im Wortlaut. */
    ziel: text('ziel'),
    vonTag: date('von_tag').notNull(),
    bisTag: date('bis_tag').notNull(),
    wochen: integer('wochen').notNull(),
    /** Begründung des Coach für den Aufbau, einmal je Satz. */
    begruendung: text('begruendung'),
    erstelltAm: timestamp('erstellt_am', { withTimezone: true }).notNull().defaultNow(),
    /**
     * Gesetzt, sobald der Satz verworfen wurde. Sichtbar bleibt er danach
     * sieben Tage — eingeklappt, nicht im Wochenraster —, dann räumt
     * `verworfeneAufraeumen` ihn weg.
     */
    verworfenAm: timestamp('verworfen_am', { withTimezone: true }),
  },
  (t) => [
    index('planvorschlaege_erstellt_idx').on(t.erstelltAm),
    index('planvorschlaege_verworfen_idx').on(t.verworfenAm),
  ],
)

/**
 * Zustände einer vorgeschlagenen Einheit.
 *
 *   vorschlag     erzeugt, nichts ist verbindlich
 *   uebertragen   als Event in intervals.icu, geht auf die Uhr
 *   freigegeben   freigegeben, aber die Übertragung ist gescheitert —
 *                 der Grund steht in `fehler`, Wiederholen ist möglich
 *   verworfen     abgelehnt; bleibt sieben Tage sichtbar, dann weg
 *
 * Es gibt **keinen** stillen Nachlauf von freigegeben nach übertragen: die
 * Freigabe überträgt sofort, und was dabei schiefgeht, ist zu sehen.
 */
export const planeinheiten = pgTable(
  'planeinheiten',
  {
    id: varchar('id', { length: 64 }).primaryKey(),
    vorschlagId: varchar('vorschlag_id', { length: 64 })
      .notNull()
      .references(() => planvorschlaege.id, { onDelete: 'cascade' }),
    tag: date('tag').notNull(),
    name: text('name').notNull(),
    typ: varchar('typ', { length: 32 }).notNull().default('Run'),
    beschreibung: text('beschreibung'),
    dauerSekunden: integer('dauer_sekunden'),
    streckeMeter: doublePrecision('strecke_meter'),
    zielBelastung: integer('ziel_belastung'),
    /** Kennung einer bestehenden Einheit, die ersetzt werden soll. */
    ersetztPlanId: varchar('ersetzt_plan_id', { length: 64 }),
    /**
     * Gesetzt, sobald die alte Einheit in intervals.icu gelöscht ist.
     *
     * Ohne diese Marke würde ein zweiter Versuch nach einem gescheiterten
     * Anlegen noch einmal löschen wollen — der Eintrag ist dann aber schon
     * weg, das Löschen endet mit 404, und die neue Einheit käme nie zustande.
     * Die alte wäre verloren.
     */
    ersetztGeloeschtAm: timestamp('ersetzt_geloescht_am', { withTimezone: true }),
    zustand: varchar('zustand', { length: 16 }).notNull().default('vorschlag'),
    /** Kennung des Events in intervals.icu, sobald übertragen. */
    icuEventId: varchar('icu_event_id', { length: 64 }),
    fehler: text('fehler'),
    verworfenAm: timestamp('verworfen_am', { withTimezone: true }),
    uebertragenAm: timestamp('uebertragen_am', { withTimezone: true }),
    reihenfolge: integer('reihenfolge').notNull().default(0),
  },
  (t) => [
    index('planeinheiten_vorschlag_idx').on(t.vorschlagId, t.reihenfolge),
    index('planeinheiten_tag_idx').on(t.tag),
    index('planeinheiten_zustand_idx').on(t.zustand),
  ],
)
