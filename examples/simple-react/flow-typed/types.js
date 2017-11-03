// @flow

type GuestPropsType = {|
  name: string,
  appPath: string,
  display: Array<string>,
|};

interface GuestAppVersion3Type {
  version: 3;
  hydrate(container: HTMLDivElement, history: History, currentApp: GuestPropsType): Promise<?void>;
  mount(container: HTMLDivElement, history: History, currentApp: GuestPropsType): Promise<?void>;
  unmount(container: HTMLDivElement, history: History, currentApp: GuestPropsType): boolean;
  onStateChange(history: History, currentApp: GuestPropsType): Promise<?void>;
}
