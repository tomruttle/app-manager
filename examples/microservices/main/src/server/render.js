// @flow

import AppManagerServer from '../../../../../es5/server';

import config from '../common/config';

const appManagerServer = new AppManagerServer(config);

export default async function thing(path: string) {
  const appName = appManagerServer.getAppNameFromPath(path);
  const appFragments = appManagerServer.getAppFragments(appName);

  const getMarkupPromises = Object.keys(appFragments).map(async (slotName) => {
    const fragmentName = appFragments[slotName];
    const fragment = config.fragments[fragmentName];
    const markup = await fragment.getMarkup();
    return { slotName, markup };
  });

  const resolvedMarkup = await Promise.all(getMarkupPromises);

  return resolvedMarkup.reduce((acc, { slotName, markup }) => Object.assign({}, acc, { [slotName]: markup }), {});
}
