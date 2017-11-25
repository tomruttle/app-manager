// @flow

import { expect } from 'chai';

import { WindowStub, HistoryStub } from '../lib/utils/stubs';

import initAppManager from '../lib/app-manager';

describe('_getManagedSlotScripts', () => {
  function getAppManager(config) {
    const windowStub = new WindowStub();
    const historystub = new HistoryStub();

    const AppManager = initAppManager(windowStub, historystub);

    return new AppManager(config);
  }

  it('returns null if invalid app sent', () => {
    const appManager = getAppManager({ apps: {}, slots: {}, scripts: {} });
    const managedSlotScripts = appManager._getManagedSlotScripts('INVALID');

    expect(managedSlotScripts).to.be.null;
  });

  it('returns null if app has no display prop', () => {
    const apps = {
      INVALID: { name: 'INVALID' },
    };

    const appManager = getAppManager({ apps, slots: {}, scripts: {} });
    const managedSlotScripts = appManager._getManagedSlotScripts('INVALID');

    expect(managedSlotScripts).to.be.null;
  });

  it('returns empty slots if no matching scripts are found', () => {
    const apps = {
      INVALID: { name: 'INVALID', display: ['NONEXISTENT'] },
    };

    const slots = {
      LEFT: { name: 'LEFT' },
      RIGHT: { name: 'RIGHT' },
    };

    const appManager = getAppManager({ apps, slots, scripts: {} });
    const managedSlotScripts = appManager._getManagedSlotScripts('INVALID');

    expect(managedSlotScripts).to.deep.equals({ LEFT: null, RIGHT: null });
  });

  it('returns empty slots if no matching slots for scripts are found', () => {
    const apps = {
      APP: { name: 'APP', display: ['INVALID'] },
    };

    const slots = {
      LEFT: { name: 'LEFT' },
      RIGHT: { name: 'RIGHT' },
    };

    const scripts = {
      INVALID: { name: 'INVALID', slots: ['NONEXISTENT'], managed: true },
    };

    const appManager = getAppManager({ apps, slots, scripts });
    const managedSlotScripts = appManager._getManagedSlotScripts('APP');

    expect(managedSlotScripts).to.deep.equals({ LEFT: null, RIGHT: null });
  });

  it('returns empty slots if scripts is not managed by app-manager', () => {
    const apps = {
      APP: { name: 'APP', display: ['UNMANAGED'] },
    };

    const slots = {
      LEFT: { name: 'LEFT' },
      RIGHT: { name: 'RIGHT' },
    };

    const scripts = {
      UNMANAGED: { name: 'UNMANAGED', slots: ['LEFT'], managed: false },
    };

    const appManager = getAppManager({ apps, slots, scripts });
    const managedSlotScripts = appManager._getManagedSlotScripts('APP');

    expect(managedSlotScripts).to.deep.equals({ LEFT: null, RIGHT: null });
  });

  it('returns managed scripts in slots', () => {
    const apps = {
      APP: { name: 'APP', display: ['FIRST'] },
    };

    const slots = {
      LEFT: { name: 'LEFT' },
      RIGHT: { name: 'RIGHT' },
    };

    const scripts = {
      FIRST: { name: 'FIRST', slots: ['LEFT'], managed: true },
    };

    const appManager = getAppManager({ apps, slots, scripts });
    const managedSlotScripts = appManager._getManagedSlotScripts('APP');

    expect(managedSlotScripts).to.deep.equals({ LEFT: 'FIRST', RIGHT: null });
  });

  it('does not duplicate a script on a page', () => {
    const apps = {
      APP: { name: 'APP', display: ['FIRST'] },
    };

    const slots = {
      LEFT: { name: 'LEFT' },
      RIGHT: { name: 'RIGHT' },
    };

    const scripts = {
      FIRST: { name: 'FIRST', slots: ['LEFT', 'RIGHT'], managed: true },
    };

    const appManager = getAppManager({ apps, slots, scripts });
    const managedSlotScripts = appManager._getManagedSlotScripts('APP');

    expect(managedSlotScripts).to.deep.equals({ LEFT: 'FIRST', RIGHT: null });
  });

  it('maximises the number of scripts shown on a page', () => {
    const apps = {
      APP: { name: 'APP', display: ['FIRST', 'SECOND'] },
    };

    const slots = {
      LEFT: { name: 'LEFT' },
      RIGHT: { name: 'RIGHT' },
    };

    const scripts = {
      FIRST: { name: 'FIRST', slots: ['RIGHT', 'LEFT'], managed: true },
      SECOND: { name: 'SECOND', slots: ['LEFT', 'RIGHT'], managed: true },
    };

    const appManager = getAppManager({ apps, slots, scripts });
    const managedSlotScripts = appManager._getManagedSlotScripts('APP');

    expect(managedSlotScripts).to.deep.equals({ LEFT: 'SECOND', RIGHT: 'FIRST' });
  });

  it('does not replace a script if the slot is taken', () => {
    const apps = {
      APP: { name: 'APP', display: ['FIRST', 'SECOND'] },
    };

    const slots = {
      LEFT: { name: 'LEFT' },
      RIGHT: { name: 'RIGHT' },
    };

    const scripts = {
      FIRST: { name: 'FIRST', slots: ['LEFT'], managed: true },
      SECOND: { name: 'SECOND', slots: ['LEFT'], managed: true },
    };

    const appManager = getAppManager({ apps, slots, scripts });
    const managedSlotScripts = appManager._getManagedSlotScripts('APP');

    expect(managedSlotScripts).to.deep.equals({ LEFT: 'FIRST', RIGHT: null });
  });
});
