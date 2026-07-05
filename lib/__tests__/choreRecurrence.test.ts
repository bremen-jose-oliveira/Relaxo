import { normalizeChoreRecurrence, shouldRemoveChoreOnComplete } from '../choreRecurrence';

describe('choreRecurrence', () => {
  it('normalizes recurrence values', () => {
    expect(normalizeChoreRecurrence('once')).toBe('once');
    expect(normalizeChoreRecurrence('daily')).toBe('daily');
    expect(normalizeChoreRecurrence(null)).toBe('daily');
  });

  it('removes one-time chores only when completed', () => {
    expect(shouldRemoveChoreOnComplete('once', true)).toBe(true);
    expect(shouldRemoveChoreOnComplete('once', false)).toBe(false);
    expect(shouldRemoveChoreOnComplete('daily', true)).toBe(false);
  });
});
