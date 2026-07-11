import { describe, expect, it } from "bun:test";

import vercelConfig from "../vercel.json";

describe("Vercel routing config", () => {
  it("serves direct app routes through the SPA entrypoint", () => {
    expect(vercelConfig.rewrites).toContainEqual({
      source: "/(.*)",
      destination: "/index.html",
    });
  });
});
