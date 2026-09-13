import { describe, expect, it } from 'vitest'
import { entkernen, sqlPruefen } from './sql-wache'

const erlaubt = (sql: string) => sqlPruefen(sql).erlaubt
const grund = (sql: string) => sqlPruefen(sql).grund ?? ''

describe('entkernen', () => {
  it('loescht Zeilenkommentare', () => {
    expect(entkernen('select 1 -- ; drop table t').trim()).toBe('select 1')
  })

  it('loescht Blockkommentare', () => {
    expect(entkernen('select /* ; drop */ 1').replace(/\s+/g, ' ').trim())
      .toBe('select 1')
  })

  it('loescht geschachtelte Blockkommentare, wie PostgreSQL sie kennt', () => {
    // Ein naiver Ersetzer wuerde beim ersten */ aufhoeren und den Rest
    // als Anweisung durchlassen.
    const k = entkernen('select /* aussen /* innen */ noch aussen */ 1')
    expect(k.replace(/\s+/g, ' ').trim()).toBe('select 1')
  })

  it('laesst ein Semikolon in einer Zeichenkette in Ruhe', () => {
    expect(entkernen("select 'a;b'")).not.toContain('a;b')
    expect(entkernen("select 'a;b'").includes(';')).toBe(false)
  })

  it('kommt mit verdoppelten Anfuehrungszeichen zurecht', () => {
    const k = entkernen("select 'es''geht'; ")
    expect(k.split(';').length).toBe(2)
  })

  it('loescht Dollar-Anfuehrung samt Inhalt', () => {
    expect(entkernen('select $$ ; drop table t $$').includes(';')).toBe(false)
    expect(entkernen('select $tag$ ; drop $tag$').includes(';')).toBe(false)
  })

  it('behaelt Bezeichner in doppelten Anfuehrungszeichen', () => {
    expect(entkernen('select "meine spalte" from t')).toContain('"meine spalte"')
  })
})

describe('sqlPruefen — was durchgehen soll', () => {
  it('nimmt ein einfaches SELECT', () => {
    expect(erlaubt('select * from aktivitaeten limit 10')).toBe(true)
  })

  it('nimmt ein abschliessendes Semikolon', () => {
    expect(erlaubt('select 1;')).toBe(true)
    expect(erlaubt('select 1;   ')).toBe(true)
  })

  it('nimmt ein lesendes CTE', () => {
    expect(
      erlaubt('with w as (select tag, belastung from tagesbelastung) select * from w'),
    ).toBe(true)
  })

  it('nimmt einen Spaltennamen, der ein verbotenes Wort enthaelt', () => {
    // 'deleted_at' darf nicht an \bdelete\b haengenbleiben.
    expect(erlaubt('select deleted_at, update_zaehler from aktivitaeten')).toBe(true)
  })

  it('nimmt ein verbotenes Wort als Textinhalt', () => {
    expect(erlaubt("select * from wellness where notizen = 'drop table'")).toBe(true)
  })
})

describe('sqlPruefen — mehrere Anweisungen', () => {
  it('weist zwei Anweisungen ab', () => {
    expect(erlaubt('select 1; select 2')).toBe(false)
    expect(grund('select 1; select 2')).toContain('Nur eine Anweisung')
  })

  it('weist das Aufheben der Zeitschranke ab', () => {
    // Genau der Weg, den die Rolle selbst offen laesst: sie DARF
    // statement_timeout auf 0 setzen. Siehe DECISIONS.md E5.2.
    expect(erlaubt('select 1; set statement_timeout = 0')).toBe(false)
  })

  it('weist einen Kommentar als Trennung ab', () => {
    expect(erlaubt('select 1 --\n; drop table aktivitaeten')).toBe(false)
    expect(erlaubt('select 1 /* x */ ; drop table aktivitaeten')).toBe(false)
  })

  it('weist ein Semikolon ab, das hinter einem Zeilenkommentar versteckt ist', () => {
    expect(erlaubt("select 1 where 'a' = 'a' -- harmlos\n; delete from t")).toBe(false)
  })

  it('weist die Trennung ueber geschachtelte Kommentare ab', () => {
    expect(erlaubt('select 1 /* a /* b */ c */ ; drop table t')).toBe(false)
  })
})

describe('sqlPruefen — schreibende CTEs', () => {
  it('weist WITH … AS (DELETE …) ab', () => {
    expect(
      erlaubt('with weg as (delete from aktivitaeten returning id) select * from weg'),
    ).toBe(false)
    expect(
      grund('with weg as (delete from aktivitaeten returning id) select * from weg'),
    ).toContain('DELETE')
  })

  it('weist WITH … AS (INSERT …) ab', () => {
    expect(
      erlaubt("with neu as (insert into plan(id) values ('x') returning id) select * from neu"),
    ).toBe(false)
  })

  it('weist WITH … AS (UPDATE …) ab', () => {
    expect(
      erlaubt('with u as (update wellness set hrv = 0 returning tag) select * from u'),
    ).toBe(false)
  })

  it('weist ein schreibendes CTE ab, das hinter Kommentaren steht', () => {
    expect(
      erlaubt('with /* nur ein CTE */ w as (\n-- nichts zu sehen\ndelete from plan returning id) select * from w'),
    ).toBe(false)
  })

  it('weist MERGE ab', () => {
    expect(erlaubt('with m as (merge into plan using plan on true when matched then delete returning id) select * from m'))
      .toBe(false)
  })
})

describe('sqlPruefen — Ausbruch aus der Datenbank', () => {
  it('weist das Lesen von Dateien ab', () => {
    expect(erlaubt("select pg_read_file('.env')")).toBe(false)
    expect(erlaubt("select pg_ls_dir('.')")).toBe(false)
  })

  it('weist pg_sleep ab, das die Zeitschranke ausreizen wuerde', () => {
    expect(erlaubt('select pg_sleep(300)')).toBe(false)
  })

  it('weist current_setting ab, das an Verbindungsdaten heranfuehrt', () => {
    expect(erlaubt("select current_setting('data_directory')")).toBe(false)
  })

  it('weist COPY ab', () => {
    expect(erlaubt("copy aktivitaeten to '/tmp/x'")).toBe(false)
  })
})

describe('sqlPruefen — was gar nicht erst anfaengt', () => {
  it('weist alles ab, was nicht mit SELECT, WITH oder TABLE beginnt', () => {
    for (const s of ['insert into t values (1)', 'update t set x=1', 'drop table t',
                     'set statement_timeout = 0', 'begin', 'grant all on t to public']) {
      expect(erlaubt(s), s).toBe(false)
    }
  })

  it('weist leere und uebergrosse Abfragen ab', () => {
    expect(erlaubt('')).toBe(false)
    expect(erlaubt('   ')).toBe(false)
    expect(erlaubt('select ' + 'x'.repeat(4100))).toBe(false)
  })

  it('weist eine Abfrage ab, die nur aus einem Semikolon besteht', () => {
    expect(erlaubt(';')).toBe(false)
  })
})
