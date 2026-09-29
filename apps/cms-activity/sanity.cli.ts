import { defineCliConfig } from 'sanity/cli';

export default defineCliConfig({
  app: {
    organizationId: 'o5BEPFjvf',
    entry: './src/App.tsx',
    icon: './app-icon.svg',
    title: 'Raport pracy CMS',
    visibility: 'unlisted',
  },
  // TODO: add `deployment: { appId: '<id>' }` after the first `bun run deploy`
  // (the CLI prints the app id). Not deployed yet; the owner deploys manually.
  vite: (config) => ({
    ...config,
    server: {
      ...config.server,
      hmr: false,
    },
  }),
});
