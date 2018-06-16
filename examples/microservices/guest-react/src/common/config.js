// @flow

export default {
  slots: {
    APP: {
      querySelector: '.nested-slot',
    },
  },

  fragments: {
    FRAGMENT: {
      slot: 'APP',
      loadScript: null,
      ssrGetMarkup: null,
    },
  },

  routes: {
    MAROON_ROUTE: {
      path: '/apps/guest-react',
      fragment: 'FRAGMENT',
    },

    GREEN_ROUTE: {
      path: '/apps/guest-react/green',
      fragment: 'FRAGMENT',
    },

    BLUE_ROUTE: {
      path: '/apps/guest-react/blue',
      fragment: 'FRAGMENT',
    },
  },
};
