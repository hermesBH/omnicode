import { describe, expect, it } from "vitest";

import { encodeOAuthScope, parseAllowedOAuthScope, parseOAuthScope } from "./oauthScope.ts";

describe("OAuth scopes", () => {
  it("parses an RFC 6749 space-delimited scope set without duplicating permissions", () => {
    expect(parseOAuthScope("environment:operate access:manage environment:operate")).toEqual([
      "environment:operate",
      "access:manage",
    ]);
  });

  it("rejects whitespace that is not the SP delimiter or introduces empty tokens", () => {
    expect(parseOAuthScope("environment:operate\taccess:manage")).toBeNull();
    expect(parseOAuthScope("environment:operate  access:manage")).toBeNull();
  });

  it("encodes and restricts requested scopes to the allowed capability set", () => {
    expect(encodeOAuthScope(["environment:operate", "access:manage"])).toBe(
      "environment:operate access:manage",
    );
    expect(
      parseAllowedOAuthScope({
        value: "environment:operate access:manage",
        allowedScopes: new Set(["environment:operate", "access:manage"] as const),
      }),
    ).toEqual(["environment:operate", "access:manage"]);
    expect(
      parseAllowedOAuthScope({
        value: "environment:operate relay:manage",
        allowedScopes: new Set(["environment:operate", "access:manage"] as const),
      }),
    ).toBeNull();
  });
});
