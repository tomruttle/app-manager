// @flow

import React from 'react';
import ReactDOM from 'react-dom/server';
import { ServerStyleSheet } from 'styled-components';

import appManagerServer from '../../../../../lib/server';

import config from '../common/config';
import GuestReactApp from '../common/app';

config.fragments.FRAGMENT.ssrGetMarkup = (querySelector, state) => {
  const sheet = new ServerStyleSheet();
  const markup = ReactDOM.renderToString(sheet.collectStyles(<GuestReactApp colour={state.colour} />));
  const styles = sheet.getStyleTags();

  return /* @html */`
    ${styles}
    <div class="${state.parentClass}">
      <div class="${querySelector.slice(1)}">${markup}</div>
    </div>
  `;
};

function getSlashColour(resource) {
  const [pathname] = resource.split('?');
  const noTrailingSlash = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  return noTrailingSlash.split('/app')[1];
}

function getAdditionalState(_routeName, resource) {
  const [, query] = resource.split('?');
  const slashColour = getSlashColour(resource);

  return {
    parentClass: query.split('querySelector=')[1].slice(1),
    colour: slashColour.startsWith('/') ? slashColour.slice(1) : slashColour,
  };
}

function getRouteNameFromResource(resource) {
  const colour = getSlashColour(resource);
  const { routes } = config;

  return Object.keys(routes).find((routeName) => {
    const { path: routePath } = routes[routeName];
    return routePath.split('/apps/guest-react')[1] === colour;
  });
}

const { getSlotsMarkup } = appManagerServer(config, { getRouteNameFromResource, getAdditionalState });

export default getSlotsMarkup;
