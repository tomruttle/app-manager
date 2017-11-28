// @flow

import { expect } from 'chai';

import getManagedSlotScripts from '../lib/utils/get-managed-slot-scripts';

describe('getManagedSlotScripts', () => {
  it('returns null if no app sent', () => {
    // $FlowFixMe
    const managedSlotScripts = getManagedSlotScripts({}, {});

    expect(managedSlotScripts).to.be.null;
  });

  it('returns null if app has no display prop', () => {
    // $FlowFixMe
    const managedSlotScripts = getManagedSlotScripts({}, {}, { name: 'INVALID', appPath: '/' });

    expect(managedSlotScripts).to.be.null;
  });

  it('returns empty slots if no matching scripts are found', () => {
    const app = { name: 'INVALID', appPath: '/', display: ['NONEXISTENT'] };

    const slots = {
      LEFT: { name: 'LEFT', elementClass: '.left' },
      RIGHT: { name: 'RIGHT', elementClass: '.right' },
    };

    const managedSlotScripts = getManagedSlotScripts(slots, {}, app);

    expect(managedSlotScripts).to.deep.equals({ LEFT: null, RIGHT: null });
  });

  it('returns empty slots if no matching slots for scripts are found', () => {
    const app = { name: 'APP', appPath: '/', display: ['INVALID'] };

    const slots = {
      LEFT: { name: 'LEFT', elementClass: '.left' },
      RIGHT: { name: 'RIGHT', elementClass: '.right' },
    };

    const scripts = {
      INVALID: { name: 'INVALID', slots: ['NONEXISTENT'], managed: true },
    };

    const managedSlotScripts = getManagedSlotScripts(slots, scripts, app);

    expect(managedSlotScripts).to.deep.equals({ LEFT: null, RIGHT: null });
  });

  it('returns empty slots if scripts is not managed by app-manager', () => {
    const app = { name: 'APP', appPath: '/', display: ['UNMANAGED'] };

    const slots = {
      LEFT: { name: 'LEFT', elementClass: '.left' },
      RIGHT: { name: 'RIGHT', elementClass: '.right' },
    };

    const scripts = {
      UNMANAGED: { name: 'UNMANAGED', slots: ['LEFT'], managed: false },
    };

    const managedSlotScripts = getManagedSlotScripts(slots, scripts, app);

    expect(managedSlotScripts).to.deep.equals({ LEFT: null, RIGHT: null });
  });

  it('returns managed scripts in slots', () => {
    const app = { name: 'APP', appPath: '/', display: ['FIRST'] };

    const slots = {
      LEFT: { name: 'LEFT', elementClass: '.left' },
      RIGHT: { name: 'RIGHT', elementClass: '.right' },
    };

    const scripts = {
      FIRST: { name: 'FIRST', slots: ['LEFT'], managed: true },
    };

    const managedSlotScripts = getManagedSlotScripts(slots, scripts, app);

    expect(managedSlotScripts).to.deep.equals({ LEFT: 'FIRST', RIGHT: null });
  });

  it('does not duplicate a script on a page', () => {
    const app = { name: 'APP', appPath: '/', display: ['FIRST'] };

    const slots = {
      LEFT: { name: 'LEFT', elementClass: '.left' },
      RIGHT: { name: 'RIGHT', elementClass: '.right' },
    };

    const scripts = {
      FIRST: { name: 'FIRST', slots: ['LEFT', 'RIGHT'], managed: true },
    };

    const managedSlotScripts = getManagedSlotScripts(slots, scripts, app);

    expect(managedSlotScripts).to.deep.equals({ LEFT: 'FIRST', RIGHT: null });
  });

  it('maximises the number of scripts shown on a page', () => {
    const app = { name: 'APP', appPath: '/', display: ['FIRST', 'SECOND'] };

    const slots = {
      LEFT: { name: 'LEFT', elementClass: '.left' },
      RIGHT: { name: 'RIGHT', elementClass: '.right' },
    };

    const scripts = {
      FIRST: { name: 'FIRST', slots: ['LEFT', 'RIGHT'], managed: true },
      SECOND: { name: 'SECOND', slots: ['LEFT'], managed: true },
    };

    const managedSlotScripts = getManagedSlotScripts(slots, scripts, app);

    expect(managedSlotScripts).to.deep.equals({ LEFT: 'SECOND', RIGHT: 'FIRST' });
  });

  it('gurarantees the presence of the first script', () => {
    const app = { name: 'APP', appPath: '/', display: ['FIRST', 'SECOND'] };

    const slots = {
      LEFT: { name: 'LEFT', elementClass: '.left' },
      RIGHT: { name: 'RIGHT', elementClass: '.right' },
    };

    const scripts = {
      FIRST: { name: 'FIRST', slots: ['RIGHT', 'LEFT'], managed: true },
      SECOND: { name: 'SECOND', slots: ['LEFT', 'RIGHT'], managed: true },
    };

    const managedSlotScripts = getManagedSlotScripts(slots, scripts, app);

    expect(managedSlotScripts).to.deep.equals({ LEFT: 'SECOND', RIGHT: 'FIRST' });
  });

  it('highest priority scripts take the slots', () => {
    const app = { name: 'APP', appPath: '/', display: ['FIRST', 'SECOND', 'THIRD'] };

    const slots = {
      LEFT: { name: 'LEFT', elementClass: '.left' },
      RIGHT: { name: 'RIGHT', elementClass: '.right' },
    };

    const scripts = {
      FIRST: { name: 'FIRST', slots: ['RIGHT', 'LEFT'], managed: true },
      SECOND: { name: 'SECOND', slots: ['RIGHT'], managed: true },
      THIRD: { name: 'THIRD', slots: ['LEFT', 'RIGHT'], managed: true },
    };

    const managedSlotScripts = getManagedSlotScripts(slots, scripts, app);

    expect(managedSlotScripts).to.deep.equals({ LEFT: 'FIRST', RIGHT: 'SECOND' });
  });

  it('Aims for the best preferences', () => {
    const app = { name: 'APP', appPath: '/', display: ['FIRST', 'SECOND', 'THIRD'] };

    const slots = {
      LEFT: { name: 'LEFT', elementClass: '.left' },
      RIGHT: { name: 'RIGHT', elementClass: '.right' },
      CENTER: { name: 'CENTER', elementClass: '.center' },
    };

    const scripts = {
      FIRST: { name: 'FIRST', slots: ['LEFT', 'RIGHT', 'CENTER'], managed: true },
      SECOND: { name: 'SECOND', slots: ['LEFT', 'RIGHT', 'CENTER'], managed: true },
      THIRD: { name: 'THIRD', slots: ['LEFT', 'RIGHT', 'CENTER'], managed: true },
    };

    const managedSlotScripts = getManagedSlotScripts(slots, scripts, app);

    expect(managedSlotScripts).to.deep.equals({ LEFT: 'FIRST', RIGHT: 'SECOND', CENTER: 'THIRD' });
  });
});
