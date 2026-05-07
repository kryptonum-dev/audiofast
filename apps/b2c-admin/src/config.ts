const adminApiBaseUrl =
  import.meta.env.VITE_B2C_ADMIN_API_BASE_URL ??
  "https://audiofast-git-b2c-kryptonum.vercel.app/";

export const sanityAppConfig = {
  organizationId: "o5BEPFjvf",
  projectId: "fsw3likv",
  dataset: "production",
  studioUrl:
    "https://www.sanity.io/@o5BEPFjvf/studio/dlwt2zhgkk7rjx6dj8rdyjfz/default",
  adminApiBaseUrl,
} as const;
