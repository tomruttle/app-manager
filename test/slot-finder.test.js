// @flow

import { expect } from 'chai';

import slotFinder from '../lib/utils/slot-finder';

describe('slotFinder', () => {
  it('returns null if nothing sent', () => {
    // $FlowFixMe
    const foundSlots = slotFinder();

    expect(foundSlots).to.be.empty;
  });

  it('returns empty slots if no matching things are found', () => {
    const slots = { LEFT: null, RIGHT: null };

    const foundSlots = slotFinder(slots, []);

    expect(foundSlots).to.deep.equals({ LEFT: null, RIGHT: null });
  });

  it('returns empty slots if no matching slots for things are found', () => {
    const slots = { LEFT: null, RIGHT: null };
    const things = [{ name: 'INVALID', slots: ['NONEXISTENT'] }];

    const foundSlots = slotFinder(slots, things);

    expect(foundSlots).to.deep.equals({ LEFT: null, RIGHT: null });
  });

  it('returns managed things in slots', () => {
    const slots = { LEFT: null, RIGHT: null };
    const things = [{ name: 'FIRST', slots: ['LEFT'] }];

    const foundSlots = slotFinder(slots, things);

    expect(foundSlots).to.deep.equals({ LEFT: 'FIRST', RIGHT: null });
  });

  it('does not duplicate a thing on a page', () => {
    const slots = { LEFT: null, RIGHT: null };
    const things = [{ name: 'FIRST', slots: ['LEFT', 'RIGHT'] }];

    const foundSlots = slotFinder(slots, things);

    expect(foundSlots).to.deep.equals({ LEFT: 'FIRST', RIGHT: null });
  });

  it('maximises the number of things shown on a page', () => {
    const slots = { LEFT: null, RIGHT: null };
    const things = [
      { name: 'FIRST', slots: ['LEFT', 'RIGHT'] },
      { name: 'SECOND', slots: ['LEFT'] },
    ];

    const foundSlots = slotFinder(slots, things);

    expect(foundSlots).to.deep.equals({ LEFT: 'SECOND', RIGHT: 'FIRST' });
  });

  it('gurarantees the presence of the first thing', () => {
    const slots = { LEFT: null, RIGHT: null };
    const things = [
      { name: 'FIRST', slots: ['RIGHT', 'LEFT'] },
      { name: 'SECOND', slots: ['LEFT', 'RIGHT'] },
    ];

    const foundSlots = slotFinder(slots, things);

    expect(foundSlots).to.deep.equals({ LEFT: 'SECOND', RIGHT: 'FIRST' });
  });

  it('highest priority things take the slots', () => {
    const slots = { LEFT: null, RIGHT: null };
    const things = [
      { name: 'FIRST', slots: ['RIGHT', 'LEFT'] },
      { name: 'SECOND', slots: ['RIGHT'] },
      { name: 'THIRD', slots: ['LEFT', 'RIGHT'] },
    ];

    const foundSlots = slotFinder(slots, things);

    expect(foundSlots).to.deep.equals({ LEFT: 'FIRST', RIGHT: 'SECOND' });
  });

  it('Aims for the best preferences', () => {
    const slots = { LEFT: null, RIGHT: null, CENTER: null };
    const things = [
      { name: 'FIRST', slots: ['LEFT', 'RIGHT', 'CENTER'] },
      { name: 'SECOND', slots: ['LEFT', 'RIGHT', 'CENTER'] },
      { name: 'THIRD', slots: ['LEFT', 'RIGHT', 'CENTER'] },
    ];

    const foundSlots = slotFinder(slots, things);

    expect(foundSlots).to.deep.equals({ LEFT: 'FIRST', RIGHT: 'SECOND', CENTER: 'THIRD' });
  });
});
