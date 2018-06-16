const example1Markup = /* @html */`<h3>This is Example 1. <a href="/apps/example2" onclick="handleClick(event)">Switch</a></h3>`;

const example2Markup = /* @html */`<h3>This is Example 2. <a href="/apps/example1" onclick="handleClick(event)">Switch</a></h3>`;

module.exports = {
  slots: {
    APP: {
      querySelector: '.app',
    },
  },

  fragments: {
    EXAMPLE1_FRAGMENT: {
      slots: ['APP'],
      loadScript() {
        return {
          version: 5,
          render(container) { container.innerHTML = example1Markup; },
        };
      },
      ssrGetMarkup() {
        return `<div class="app">${example1Markup}</div>`;
      },
    },

    EXAMPLE2_FRAGMENT: {
      slots: ['APP'],
      loadScript() {
        return {
          version: 5,
          render(container) { container.innerHTML = example2Markup; },
        };
      },
      ssrGetMarkup() {
        return `<div class="app">${example2Markup}</div>`;
      },
    }
  },

  routes: {
    EXAMPLE1_APP: {
      path: '/apps/example1',
      fragments: ['EXAMPLE1_FRAGMENT'],
    },

    EXAMPLE2_APP: {
      path: '/apps/example2',
      fragments: ['EXAMPLE2_FRAGMENT'],
    }
  }
}
