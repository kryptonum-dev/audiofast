import { defineCliConfig } from 'sanity/cli';

export default defineCliConfig({
  app: {
    organizationId: 'o5BEPFjvf',
    entry: './src/App.tsx',
    icon: './app-icon.svg',
    title: 'Raport pracy CMS',
    // Listed for the whole org; the in-app allowlist decides who sees data.
    visibility: 'default',
  },
  deployment: {
    appId: 'vkz2ft2v1wlv5824qsg10qmh',
  },
  vite: (config) => ({
    ...config,
    server: {
      ...config.server,
      hmr: false,
    },
  }),
});
