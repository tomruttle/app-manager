// @flow

import { expect } from 'chai';
import sinon from 'sinon';
import WindowStub from 'window-stub';

import Context from '../lib/utils/context';
import initCreateLifecycle from '../lib/lifecycle';

describe('Create lifecycle', () => {
  const defaultState = {
    eventTitle: 'hc-initialise',
    resource: '/path',
    prevRoute: null,
    route: { name: 'ROUTE_A' },
  };

  const slotName = 'SLOT_A';
  const fragmentName = 'FRAGMENT_A';
  const errorMarkup = '<div>ERROR</div>';
  const loadingMarkup = '<div>LOADING</div>';

  const windowStub = new WindowStub();
  const context = new Context(defaultState);
  const element = ({}: any);

  const script = {
    hydrate: sinon.stub().resolves(null),
    render: sinon.stub().resolves(null),
    unmount: sinon.stub().resolves(null),
    onUpdateStatus: sinon.stub().resolves(null),
    onStateChange: sinon.stub().resolves(null),
  };

  const getFragmentScript = sinon.stub().resolves(script);
  const getSlotElement = sinon.stub().resolves(element);
  const getErrorMarkup = sinon.stub().returns(errorMarkup);
  const getLoadingMarkup = sinon.stub().returns(loadingMarkup);
  const onError = sinon.spy();

  const slots = {
    [slotName]: {
      name: slotName,
      querySelector: '.slot',
      getErrorMarkup,
      getLoadingMarkup,
    },
  };

  afterEach(() => {
    getFragmentScript.resetHistory();
    getSlotElement.resetHistory();
    getErrorMarkup.resetHistory();
    getLoadingMarkup.resetHistory();
    onError.resetHistory();
    script.hydrate.resetHistory();
    script.render.resetHistory();
    script.unmount.resetHistory();
    script.onUpdateStatus.resetHistory();
    script.onStateChange.resetHistory();
  });

  it('calls getErrorMarkup and returns false if getFragmentScript fails.', async () => {
    const failFragmentScript = sinon.stub().rejects();
    const createLifecycle = initCreateLifecycle(slots, failFragmentScript, getSlotElement, context, onError);
    const lifecycle = createLifecycle(windowStub.document, slotName, fragmentName);

    try {
      await lifecycle.next();
      throw new Error('Should not get here.');
    } catch (err) {
      expect(err.message).to.not.include('Should not get here.');
      expect(element.innerHTML).to.equals(errorMarkup);
      expect(onError.callCount).to.equal(1);
    }
  });

  it('continues through the lifecycle of a script.', async () => {
    const createLifecycle = initCreateLifecycle(slots, getFragmentScript, getSlotElement, context, onError);
    const lifecycle = createLifecycle(windowStub.document, slotName, fragmentName);

    await lifecycle.next();
    await lifecycle.next();

    expect(script.hydrate.callCount).to.equal(1);
    expect(script.onUpdateStatus.callCount).to.equal(2);
    expect(script.onStateChange.callCount).to.equal(0);

    await lifecycle.next();
    await lifecycle.next();
    await lifecycle.next();

    expect(script.onUpdateStatus.callCount).to.equal(4);
    expect(script.onStateChange.callCount).to.equal(1);

    await lifecycle.next();
    await lifecycle.next();
    await lifecycle.next();

    expect(script.onUpdateStatus.callCount).to.equal(6);
    expect(script.onStateChange.callCount).to.equal(2);

    await lifecycle.next();
    const result = await lifecycle.next(true);

    expect(result.done).to.be.true;
    expect(script.onUpdateStatus.callCount).to.equal(8);
    expect(script.onStateChange.callCount).to.equal(2);
    expect(script.unmount.callCount).to.equal(1);
    expect(getLoadingMarkup.callCount).to.equal(1);
    expect(element.innerHTML).to.equals(loadingMarkup);
  });

  it('handles errors coming from other scripts.', async () => {
    const createLifecycle = initCreateLifecycle(slots, getFragmentScript, getSlotElement, context, onError);
    const lifecycle = createLifecycle(windowStub.document, slotName, fragmentName);

    await lifecycle.next();
    await lifecycle.next();

    expect(script.hydrate.callCount).to.equal(1);
    expect(script.onUpdateStatus.callCount).to.equal(2);
    expect(script.onStateChange.callCount).to.equal(0);

    await lifecycle.next();
    await lifecycle.next();
    await lifecycle.throw(new Error());
    await lifecycle.next();

    expect(script.onUpdateStatus.callCount).to.equal(5);
    expect(script.onStateChange.callCount).to.equal(1);

    await lifecycle.next();
    const result = await lifecycle.next(true);

    expect(result.done).to.be.true;
    expect(script.onUpdateStatus.callCount).to.equal(7);
    expect(script.onStateChange.callCount).to.equal(1);
    expect(script.unmount.callCount).to.equal(1);
    expect(getLoadingMarkup.callCount).to.equal(1);
    expect(element.innerHTML).to.equals(loadingMarkup);
  });

  it('handles onStateChange errors.', async () => {
    const errorScript = {
      hydrate: sinon.stub().resolves(null),
      render: sinon.stub().resolves(null),
      unmount: sinon.stub().resolves(null),
      onUpdateStatus: sinon.stub().resolves(null),
      onStateChange: sinon.stub().rejects('test'),
    };

    const getErrorScript = sinon.stub().resolves(errorScript);

    const createLifecycle = initCreateLifecycle(slots, getErrorScript, getSlotElement, context, onError);
    const lifecycle = createLifecycle(windowStub.document, slotName, fragmentName);

    await lifecycle.next();
    await lifecycle.next();

    expect(errorScript.hydrate.callCount).to.equal(1);
    expect(errorScript.onUpdateStatus.callCount).to.equal(2);
    expect(errorScript.onStateChange.callCount).to.equal(0);

    await lifecycle.next();

    try {
      await lifecycle.next();
      throw new Error('Should not get here.');
    } catch (err) {
      expect(err.message).to.not.include('Should not get here.');

      expect(errorScript.onUpdateStatus.callCount).to.equal(4);
      expect(errorScript.onStateChange.callCount).to.equal(1);
      expect(errorScript.onUpdateStatus.callCount).to.equal(4);
      expect(errorScript.onStateChange.callCount).to.equal(1);
      expect(errorScript.unmount.callCount).to.equal(1);
      expect(getErrorMarkup.callCount).to.equal(1);
      expect(element.innerHTML).to.equals(errorMarkup);
    }
  });
});
