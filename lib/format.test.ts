import { describe, expect, it } from 'vitest'
import { datum, datumZeit, dauer, mitVorzeichen, pace, strecke, uhrzeit, wann, zahl } from './format'

describe('zahl', () => {
  it('nutzt das Dezimalkomma', () => {
    expect(zahl(218.4, 1)).toBe('218,4')
  })

  it('setzt den Tausenderpunkt', () => {
    expect(zahl(1240)).toBe('1.240')
  })

  it('erzwingt die Zahl der Nachkommastellen', () => {
    expect(zahl(5, 2)).toBe('5,00')
  })

  it('faengt Unendlich und NaN ab', () => {
    expect(zahl(Number.NaN)).toBe('–')
    expect(zahl(Number.POSITIVE_INFINITY)).toBe('–')
  })
})

describe('strecke', () => {
  it('rechnet ab einem Kilometer in km mit einer Nachkommastelle', () => {
    expect(strecke(218_400)).toBe('218,4 km')
  })

  it('bleibt unterhalb eines Kilometers bei Metern', () => {
    expect(strecke(850)).toBe('850 m')
  })

  it('rundet Meter auf ganze Zahlen', () => {
    expect(strecke(849.6)).toBe('850 m')
  })

  it('rundet vor der Grenze, nicht danach', () => {
    // 999,6 m sind gerundet 1000 m. Frueher kam hier '1.000 m' heraus.
    expect(strecke(999.6)).toBe('1,0 km')
    expect(strecke(999.4)).toBe('999 m')
  })

  it('weist negative Werte ab', () => {
    expect(strecke(-1)).toBe('–')
  })
})

describe('pace', () => {
  it('schreibt 5:25/km', () => {
    expect(pace(325)).toBe('5:25/km')
  })

  it('fuellt die Sekunden auf zwei Stellen', () => {
    expect(pace(305)).toBe('5:05/km')
  })

  it('rundet auf die naechste Sekunde und traegt den Uebertrag', () => {
    expect(pace(359.6)).toBe('6:00/km')
  })

  it('weist null und negative Werte ab', () => {
    expect(pace(0)).toBe('–')
    expect(pace(-10)).toBe('–')
  })
})

describe('dauer', () => {
  it('laesst die Stunde weg, solange es keine gibt', () => {
    expect(dauer(2531)).toBe('42:11')
  })

  it('schreibt Stunden aus', () => {
    expect(dauer(3757)).toBe('1:02:37')
  })

  it('haelt null aus', () => {
    expect(dauer(0)).toBe('0:00')
  })
})

describe('datum und Zeit', () => {
  const d = new Date(2026, 8, 13, 6, 45)

  it('schreibt TT.MM.JJJJ mit fuehrenden Nullen', () => {
    expect(datum(d)).toBe('13.09.2026')
  })

  it('nutzt 24 Stunden', () => {
    expect(uhrzeit(new Date(2026, 8, 13, 18, 5))).toBe('18:05')
  })

  it('setzt Datum und Zeit zusammen', () => {
    expect(datumZeit(d)).toBe('13.09.2026, 06:45')
  })

  it('liest ein Datum ohne Zeitanteil ortszeitlich', () => {
    // Die Spalte wellness.tag kommt als '2026-09-13' zurueck. Ueber
    // new Date() waere das Mitternacht UTC und westlich von Greenwich
    // der Vortag.
    expect(datum('2026-09-13')).toBe('13.09.2026')
    expect(datum('2026-01-01')).toBe('01.01.2026')
  })

  it('faengt ungueltige Angaben ab', () => {
    expect(datum('kein Datum')).toBe('–')
    expect(uhrzeit('kein Datum')).toBe('–')
  })
})

describe('mitVorzeichen', () => {
  it('setzt ein Plus', () => {
    expect(mitVorzeichen(3.2)).toBe('+3,2')
  })

  it('nutzt das echte Minuszeichen, nicht den Bindestrich', () => {
    expect(mitVorzeichen(-1.4)).toBe('−1,4')
    expect(mitVorzeichen(-1.4)).not.toContain('-')
  })

  it('laesst die Null ohne Vorzeichen', () => {
    expect(mitVorzeichen(0)).toBe('0,0')
    expect(mitVorzeichen(-0.04)).toBe('0,0')
  })
})

describe('wann', () => {
  const jetzt = new Date(2026, 8, 13, 19, 14)

  it('schreibt den heutigen Tag aus', () => {
    expect(wann(new Date(2026, 8, 13, 8, 3), jetzt)).toBe('heute, 08:03')
  })

  it('schreibt den gestrigen Tag aus', () => {
    expect(wann(new Date(2026, 8, 12, 23, 59), jetzt)).toBe('gestern, 23:59')
  })

  it('nimmt fuer aeltere Tage das Datum', () => {
    expect(wann(new Date(2026, 8, 11, 9, 0), jetzt)).toBe('11.09.2026')
  })

  it('zaehlt Kalendertage, nicht 24-Stunden-Schritte', () => {
    // Zwei Minuten alt, aber schon gestern: um Mitternacht darf aus «heute»
    // nicht «vor 0 Tagen» werden.
    expect(wann(new Date(2026, 8, 12, 23, 59), new Date(2026, 8, 13, 0, 1))).toBe(
      'gestern, 23:59',
    )
  })

  it('faellt bei Unsinn auf den Strich zurueck', () => {
    expect(wann('kein Datum', jetzt)).toBe('–')
  })
})
