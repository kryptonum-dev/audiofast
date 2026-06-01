import { describe, expect, it } from "vitest";

import { buildSanityImageAssetUrl, buildSanityImageUrl } from "./image.js";

describe("buildSanityImageUrl", () => {
  it("builds deterministic white-backed WebP Sanity thumbnail URLs", () => {
    expect(
      buildSanityImageUrl({
        id: "image-72d4bbc915d73c0fa465b48209d12a64e0bb441b-1154x960-webp",
      }),
    ).toBe(
      "https://cdn.sanity.io/images/fsw3likv/production/72d4bbc915d73c0fa465b48209d12a64e0bb441b-1154x960.webp?w=96&h=96&fit=fill&bg=ffffff&fm=webp&q=85",
    );
  });

  it("returns null for missing or malformed image references", () => {
    expect(buildSanityImageUrl(null)).toBeNull();
    expect(buildSanityImageUrl({ id: "" })).toBeNull();
    expect(buildSanityImageUrl({ id: "not-a-sanity-image-ref" })).toBeNull();
  });

  it("builds high-density thumbnail URLs for small admin images", () => {
    expect(
      buildSanityImageUrl(
        {
          id: "image-72d4bbc915d73c0fa465b48209d12a64e0bb441b-1154x960-webp",
        },
        {
          height: 44,
          quality: 95,
          scale: 3,
          width: 44,
        },
      ),
    ).toBe(
      "https://cdn.sanity.io/images/fsw3likv/production/72d4bbc915d73c0fa465b48209d12a64e0bb441b-1154x960.webp?w=132&h=132&fit=fill&bg=ffffff&fm=webp&q=95",
    );
  });

  it("builds raw asset URLs as non-blurry runtime fallbacks", () => {
    expect(
      buildSanityImageAssetUrl({
        id: "image-72d4bbc915d73c0fa465b48209d12a64e0bb441b-1154x960-webp",
      }),
    ).toBe(
      "https://cdn.sanity.io/images/fsw3likv/production/72d4bbc915d73c0fa465b48209d12a64e0bb441b-1154x960.webp",
    );
  });
});
