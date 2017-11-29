// @flow

type StateEntry = { data: Object, title: ?string, hash: string };

const WINDOW_UID = 'window';

export class WindowStub {
  document: Object
  location: Object

  constructor(initialPath: string = '/') {
    this.location = {
      href: `http://address/${initialPath}`,
      pathname: initialPath,
      search: '',
    };

    this.document = {
      referrer: 'http://referrer1',

      querySelector() { return true; },
    };
  }
}

export class HistoryStub {
  state: Array<StateEntry>
  position: number

  constructor(state: Array<StateEntry> = [{ data: {}, title: null, hash: 'url' }]) {
    this.position = state.length === 0 ? 0 : state.length - 1;
    this.state = [...state];
  }

  getState = () => this.state[this.position];

  replaceState = (data: ?Object, title: ?string, href: string) => {
    const { data: currentData, title: currentTitle, hash: currentUrl } = this.state[this.position];

    const newState = {
      data: data || currentData,
      title: title || currentTitle,
      hash: href || currentUrl,
    };

    this.state = [...this.state.slice(0, this.position), newState];

    this.Adapter.trigger(null, 'statechange');
  };

  pushState = (data: ?Object, title: ?string, href: string) => {
    const { data: currentData, title: currentTitle, hash: currentUrl } = this.state[this.position];

    const newState = {
      data: data || currentData,
      title: title || currentTitle,
      hash: href || currentUrl,
    };

    this.state = [...this.state.slice(0, this.position + 1), newState];

    this.position = this.position + 1;
    this.Adapter.trigger(null, 'statechange');
  };

  Adapter = {
    handlers: { [WINDOW_UID]: {} },

    uid: () => WINDOW_UID,

    bind: (scope: ?WindowStub, event: string, callback: () => void) => {
      const handler = this.Adapter.handlers[WINDOW_UID];

      Object.assign(handler, { [event]: [...(handler[event] || []), callback] });
    },

    trigger: (scope: ?WindowStub, event: string, data: any) => {
      (this.Adapter.handlers[WINDOW_UID][event] || []).forEach((callback) => callback(data));
    },
  }

  back = () => {
    this.position = this.position - 1;
    this.Adapter.trigger(null, 'statechange');
  };

  forward = () => {
    if (this.state[this.position + 1]) {
      this.position = this.position + 1;
      this.Adapter.trigger(null, 'statechange');
    }
  };
}
