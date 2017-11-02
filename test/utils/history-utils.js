// @flow

import EventEmitter from 'event-emitter';

type StateEntry = { data: Object, title: ?string, hash: string };

export class WindowStub {
  document: Object

  constructor(initialPath: string) {
    this.document = {
      location: {
        href: `http://address/${initialPath}`,
        pathname: initialPath,
        search: '',
      },

      referrer: 'http://referrer1',

      querySelector() { return true; },
    };
  }
}

export class HistoryStub {
  state: Array<StateEntry>
  historyEmitter: EventEmitter
  position: number

  constructor(state: Array<StateEntry> = [{ data: {}, title: null, hash: 'url' }]) {
    this.historyEmitter = new EventEmitter();
    this.position = state.length === 0 ? 0 : state.length - 1;
    this.state = [...state];
  }

  getState() {
    return this.state[this.position];
  }

  replaceState(data: Object, title: string, href: string) {
    const { data: currentData, title: currentTitle, hash: currentUrl } = this.state[this.position];
    this.state[this.position] = {
      data: data || currentData,
      title: title || currentTitle,
      hash: href || currentUrl,
    };

    this.historyEmitter.emit('updateState');
  }

  pushState(data: Object, title: ?string, href: string) {
    const { data: currentData, title: currentTitle, hash: currentUrl } = this.state[this.position];
    this.state.push({
      data: data || currentData,
      title: title || currentTitle,
      hash: href || currentUrl,
    });

    this.position = this.position + 1;
    this.historyEmitter.emit('updateState');
  }

  Adapter = {
    bind: (scope: WindowStub, event: string, callback: () => void) => {
      this.historyEmitter.on('updateState', () => callback());
    },
  }

  back() {
    this.position = this.position - 1;
    this.historyEmitter.emit('updateState');
  }

  forward() {
    if (this.state[this.position + 1]) {
      this.position = this.position + 1;
      this.historyEmitter.emit('updateState');
    }
  }
}
