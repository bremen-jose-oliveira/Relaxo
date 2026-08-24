import {
  deriveOnsetMethodFromSettle,
  deriveSettleFromOnsetMethod,
  resolveSettleFields,
} from '@/lib/sleepSettle';

describe('sleepSettle', () => {
  it('maps legacy onsetMethod into settle fields', () => {
    expect(deriveSettleFromOnsetMethod('crib')).toEqual({
      settleAid: null,
      sleepPlace: 'crib',
    });
    expect(deriveSettleFromOnsetMethod('breast')).toEqual({
      settleAid: 'breast',
      sleepPlace: null,
    });
  });

  it('prefers explicit settle fields over legacy onset', () => {
    expect(
      resolveSettleFields({
        onsetMethod: 'crib',
        settleAid: 'held',
        sleepPlace: 'mom',
        settleMinutes: 12,
        settleQuality: 'calm',
      })
    ).toEqual({
      settleMinutes: 12,
      settleQuality: 'calm',
      settleAid: 'held',
      sleepPlace: 'mom',
    });
  });

  it('derives onsetMethod for older sync clients', () => {
    expect(
      deriveOnsetMethodFromSettle({ settleAid: 'breast', sleepPlace: null })
    ).toBe('breast');
    expect(
      deriveOnsetMethodFromSettle({ settleAid: null, sleepPlace: 'crib' })
    ).toBe('crib');
  });
});
