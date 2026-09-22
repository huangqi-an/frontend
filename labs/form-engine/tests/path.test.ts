import { describe, expect, it } from "vitest";

import {
  getByPath,
  isPathRelated,
  normalizePath,
  parseArrayContext,
  setByPath,
  splitPath,
} from "../src/form-engine/utils/path";

describe("path utils", () => {
  it("normalizes bracket indexes", () => {
    expect(normalizePath("contacts[0].phones[12]")).toBe("contacts.0.phones.12");
    expect(splitPath("contacts[0].name")).toEqual(["contacts", "0", "name"]);
  });

  it("reads nested values, including array items", () => {
    const model = { contact: { phone: "138" }, contacts: [{ name: "Tom" }] };

    expect(getByPath(model, "contact.phone")).toBe("138");
    expect(getByPath(model, "contacts[0].name")).toBe("Tom");
    expect(getByPath(model, "contacts[3].name")).toBeUndefined();
  });

  it("creates missing containers while writing", () => {
    const model: Record<string, any> = {};

    setByPath(model, "contacts[0].name", "Tom");
    expect(model).toEqual({ contacts: [{ name: "Tom" }] });

    setByPath(model, "contact.phone", "138");
    expect(model.contact).toEqual({ phone: "138" });
  });

  it("matches only parent/child and identical paths", () => {
    expect(isPathRelated("contacts", "contacts[0].name")).toBe(true);
    expect(isPathRelated("contacts[0].name", "contacts")).toBe(true);
    expect(isPathRelated("contacts[0].name", "contacts[0].name")).toBe(true);
    expect(isPathRelated("contacts[0].name", "contacts[1].name")).toBe(false);
    expect(isPathRelated("contactName", "contact")).toBe(false);
  });

  it("parses the last array context of a path", () => {
    expect(parseArrayContext("emergencyContacts[1].phone")).toEqual({
      arrayPath: "emergencyContacts",
      index: 1,
    });
    expect(parseArrayContext("contact.phone")).toBeNull();
  });
});
