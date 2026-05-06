import { defineCliConfig } from "sanity/cli";

export default defineCliConfig({
  app: {
    organizationId: "o5BEPFjvf",
    entry: "./src/App.tsx",
  },
  deployment: {
    appId: "cs9d542z3etx33l37g9nxg1r",
  },
});
