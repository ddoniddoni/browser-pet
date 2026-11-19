import { resolve } from 'node:path';
import { defineConfig } from 'wxt';

const icons = { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' };

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  hooks: {
    'vite:build:extendConfig'(entries, config) {
      // WXT builds worker, content and UI separately; keep each bundle's notices.
      config.build ??= {};
      config.build.license = { fileName: 'licenses/' + entries.map(e => e.name).sort().join('-') + '.md' };
    },
    'build:publicAssets'(wxt, files) {
      for (const locale of ['ko', 'ja', 'en', 'es']) {
        files.push({ absoluteSrc: resolve(wxt.config.root, 'shared/i18n/locales', locale + '.json'),
          relativeDest: '_locales/' + locale + '/messages.json' });
      }
    },
  },
  manifest: {
    default_locale: 'en',
    description: '__MSG_extensionDescription__',
    name: 'Browser Pet',
    permissions: ['storage'],
    optional_permissions: ['alarms', 'notifications'],
    incognito: 'not_allowed',
    icons,
    action: { default_title: 'Browser Pet', default_icon: icons },
  },
});
