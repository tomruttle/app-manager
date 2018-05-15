// @flow

import { expect } from 'chai';
import sinon from 'sinon';

import type { ScriptType } from '../index';

import { wrapScript } from '../lib/script';

describe('Script Functions', () => {
  const slotElement = null;

  const statusDetails = {
    status: 'default',
    level: 'info',
  };

  const state = {
    event: 'am-replaceState',
    prevRoute: { paths: ['/route2'], fragments: ['FRAGMENT2'] },
    route: { path: '/route1', fragment: 'FRAGMENT1' },
    resource: '/path',
  };

  it('Returns a wrapped script for version 4', async () => {
    const script = {
      version: 4,
      hydrate: sinon.spy(),
      mount: sinon.spy(),
      unmount: sinon.spy(),
      onUpdateStatus: sinon.spy(),
      onStateChange: sinon.spy(),
    };

    const wrappedScript: ScriptType = wrapScript(script);

    expect(wrappedScript).to.have.keys('render', 'hydrate', 'unmount', 'onStateChange', 'onUpdateStatus');

    expect(await wrappedScript.render(slotElement, state)).to.be.undefined;
    expect(await wrappedScript.hydrate(slotElement, state)).to.be.undefined;
    expect(await wrappedScript.unmount(slotElement, state)).to.be.undefined;
    expect(await wrappedScript.onStateChange(state)).to.be.undefined;
    expect(await wrappedScript.onUpdateStatus(statusDetails, state)).to.be.undefined;

    expect(script.hydrate.callCount).to.equal(1);
    expect(script.hydrate.args[0][1]).to.deep.equals({ appPath: '/route1', fragment: 'FRAGMENT1' });

    expect(script.mount.callCount).to.equal(1);
    expect(script.mount.args[0][1]).to.deep.equals('am-replaceState');
    expect(script.mount.args[0][2]).to.deep.equals({ appPath: '/route1', fragment: 'FRAGMENT1' });

    expect(script.unmount.callCount).to.equal(1);
    expect(script.unmount.args[0][1]).to.deep.equals('am-replaceState');
    expect(script.unmount.args[0][2]).to.deep.equals({ appPaths: ['/route2'], fragments: ['FRAGMENT2'] });

    expect(script.onStateChange.callCount).to.equal(1);
    expect(script.onStateChange.args[0][0]).to.deep.equals('am-replaceState');
    expect(script.onStateChange.args[0][1]).to.deep.equals({ appPath: '/route1', fragment: 'FRAGMENT1' });

    expect(script.onUpdateStatus.callCount).to.equal(1);
    expect(script.onUpdateStatus.args[0][0]).to.deep.equals('default');
    expect(script.onUpdateStatus.args[0][1]).to.deep.equals({ appPath: '/route1', fragment: 'FRAGMENT1' });
  });

  it('Returns a wrapped script for version 5', async () => {
    const script = {
      version: 5,
      hydrate: sinon.spy(),
      render: sinon.spy(),
      unmount: sinon.spy(),
      onUpdateStatus: sinon.spy(),
      onStateChange: sinon.spy(),
    };

    const wrappedScript: ScriptType = wrapScript(script);

    expect(wrappedScript).to.have.keys('render', 'hydrate', 'unmount', 'onStateChange', 'onUpdateStatus');

    expect(await wrappedScript.render(slotElement, state)).to.be.undefined;
    expect(await wrappedScript.hydrate(slotElement, state)).to.be.undefined;
    expect(await wrappedScript.unmount(slotElement, state)).to.be.undefined;
    expect(await wrappedScript.onStateChange(state)).to.be.undefined;
    expect(await wrappedScript.onUpdateStatus(statusDetails, state)).to.be.undefined;

    const v5State = {
      app: { appPath: '/route1', fragment: 'FRAGMENT1' },
      prevApp: { appPaths: ['/route2'], fragments: ['FRAGMENT2'] },
      resource: '/path',
      event: 'am-replaceState',
    };

    expect(script.hydrate.callCount).to.equal(1);
    expect(script.hydrate.args[0][1]).to.deep.equals(v5State);

    expect(script.render.callCount).to.equal(1);
    expect(script.render.args[0][1]).to.deep.equals(v5State);

    expect(script.unmount.callCount).to.equal(1);
    expect(script.unmount.args[0][1]).to.deep.equals(v5State);

    expect(script.onStateChange.callCount).to.equal(1);
    expect(script.onStateChange.args[0][0]).to.deep.equals(v5State);

    expect(script.onUpdateStatus.callCount).to.equal(1);
    expect(script.onUpdateStatus.args[0][0]).to.deep.equals(statusDetails);
    expect(script.onUpdateStatus.args[0][1]).to.deep.equals(v5State);
  });

  it('Returns a wrapped script for version 6', async () => {
    const script = {
      version: 6,
      hydrate: sinon.spy(),
      render: sinon.spy(),
      unmount: sinon.spy(),
      onUpdateStatus: sinon.spy(),
      onStateChange: sinon.spy(),
    };

    const wrappedScript: ScriptType = wrapScript(script);

    expect(wrappedScript).to.have.keys('render', 'hydrate', 'unmount', 'onStateChange', 'onUpdateStatus');

    expect(await wrappedScript.render(slotElement, state)).to.be.undefined;
    expect(await wrappedScript.hydrate(slotElement, state)).to.be.undefined;
    expect(await wrappedScript.unmount(slotElement, state)).to.be.undefined;
    expect(await wrappedScript.onStateChange(state)).to.be.undefined;
    expect(await wrappedScript.onUpdateStatus(statusDetails, state)).to.be.undefined;

    expect(script.hydrate.callCount).to.equal(1);
    expect(script.hydrate.args[0][1]).to.deep.equals(state);

    expect(script.render.callCount).to.equal(1);
    expect(script.render.args[0][1]).to.deep.equals(state);

    expect(script.unmount.callCount).to.equal(1);
    expect(script.unmount.args[0][1]).to.deep.equals(state);

    expect(script.onStateChange.callCount).to.equal(1);
    expect(script.onStateChange.args[0][0]).to.deep.equals(state);

    expect(script.onUpdateStatus.callCount).to.equal(1);
    expect(script.onUpdateStatus.args[0][0]).to.deep.equals(statusDetails);
    expect(script.onUpdateStatus.args[0][1]).to.deep.equals(state);
  });
});
