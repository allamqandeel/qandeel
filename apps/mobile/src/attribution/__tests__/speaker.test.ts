/** COSMOS-FINAL-01 E-1 — initials and tones (PO UI-Polish Addendum, 2026-11-20). */
import { QANDEEL_INITIALS, SPEAKER_TONES, otherSpeakerTone, speakerInitials } from '..';

describe('speaker initials', () => {
  it('Arabic initials are separate letters; Latin initials are capitals written together', () => {
    expect(speakerInitials('منى عادل')).toBe('م ع');
    expect(speakerInitials('أحمد علي حسن')).toBe('أ ح');
    expect(speakerInitials('محمد')).toBe('م');
    // The article «ال» is passed over; a word of three letters or fewer keeps its own first letter.
    expect(speakerInitials('محمد الفايد')).toBe('م ف');
    expect(speakerInitials('هدير الاختبار')).toBe('ه ا');
    expect(speakerInitials('الأمل')).toBe('أ');
    expect(speakerInitials('سارة الي')).toBe('س ا');
    expect(speakerInitials('Mona Adel')).toBe('MA');
    expect(speakerInitials('mona b. adel')).toBe('MA');
    expect(speakerInitials('Mona')).toBe('M');
    expect(speakerInitials('  Mona   Adel  ')).toBe('MA');
  });

  it('no Name, or a Name without a letter, gives no letters; nothing is invented', () => {
    expect(speakerInitials(null)).toBe('');
    expect(speakerInitials('   ')).toBe('');
    expect(speakerInitials('123 !!')).toBe('');
  });

  it('QANDEEL is QA', () => {
    expect(QANDEEL_INITIALS).toBe('QA');
  });
});

describe('speaker tones', () => {
  it('the same visible Name always takes the same tone, never QANDEEL’s or the reader’s', () => {
    for (const name of ['Mona Adel', 'منى عادل', 'Sara', null]) {
      const tone = otherSpeakerTone(name);
      expect(otherSpeakerTone(name)).toBe(tone);
      expect(['QANDEEL', 'READER']).not.toContain(tone);
    }
  });

  it('every tone has a fill and an ink in both appearances, and no two speakers’ fills coincide', () => {
    for (const family of [SPEAKER_TONES.DARK, SPEAKER_TONES.LIGHT]) {
      const fills = Object.values(family).map((tone) => tone.fill);
      expect(new Set(fills).size).toBe(fills.length);
      for (const tone of Object.values(family)) expect(tone.ink).toMatch(/^#[0-9a-f]{6}$/u);
    }
  });
});
