const example1Markup = /* @html */`<h3>This is Example 1. <a href="/apps/example2" onclick="handleClick(event)">Switch</a></h3>`;

const example2Markup = /* @html */`<h3>This is Example 2. <a href="/apps/example1" onclick="handleClick(event)">Switch</a></h3>`;

module.exports = {
  slots: {
    APP: {
      name: 'APP',
      querySelector: '.app',
    },
  },

  fragments: {
    EXAMPLE1_FRAGMENT: {
      name: 'EXAMPLE1_FRAGMENT',
      slots: ['APP'],
      managed: true,
      loadScript() {
        return {
          version: 5,
          render(container) { container.innerHTML = example1Markup; },
        };
      },
      getMarkup() {
        return `<div class="app">${example1Markup}</div>`;
      },
    },

    EXAMPLE2_FRAGMENT: {
      name: 'EXAMPLE2_FRAGMENT',
      slots: ['APP'],
      managed: true,
      loadScript() {
        return {
          version: 5,
          render(container) { container.innerHTML = example2Markup; },
        };
      },
      getMarkup() {
        return `<div class="app">${example2Markup}</div>`;
      },
    }
  },

  apps: {
    EXAMPLE1_APP: {
      name: 'EXAMPLE1_APP',
      appPath: '/apps/example1',
      fragments: ['EXAMPLE1_FRAGMENT'],
    },

    EXAMPLE2_APP: {
      name: 'EXAMPLE2_APP',
      appPath: '/apps/example2',
      fragments: ['EXAMPLE2_FRAGMENT'],
    }
  }
}