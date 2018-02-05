// @flow

export function setNames(map: { [key: string]: Object }) {
  return Object.keys(map || {}).reduce((acc, key) => Object.assign({}, acc, {
    [key]: Object.assign({}, map[key], { name: key }),
  }), {});
}
