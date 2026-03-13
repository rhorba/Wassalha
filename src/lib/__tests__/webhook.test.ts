import { getPrimaryEmail, getFullName } from "@/lib/utils/clerk-webhook";

describe("getPrimaryEmail", () => {
  it("returns the primary email when id matches", () => {
    const data = {
      email_addresses: [{ email_address: "a@b.com", id: "e_1" }],
      primary_email_address_id: "e_1",
      first_name: null,
      last_name: null,
    };
    expect(getPrimaryEmail(data)).toBe("a@b.com");
  });

  it("falls back to first email when primary_email_address_id doesn't match", () => {
    const data = {
      email_addresses: [
        { email_address: "first@b.com", id: "e_1" },
        { email_address: "second@b.com", id: "e_2" },
      ],
      primary_email_address_id: "e_999",
      first_name: null,
      last_name: null,
    };
    expect(getPrimaryEmail(data)).toBe("first@b.com");
  });

  it("returns empty string when email_addresses is empty", () => {
    const data = {
      email_addresses: [],
      primary_email_address_id: "e_1",
      first_name: null,
      last_name: null,
    };
    expect(getPrimaryEmail(data)).toBe("");
  });
});

describe("getFullName", () => {
  it("combines first and last name", () => {
    expect(
      getFullName({ email_addresses: [], primary_email_address_id: "", first_name: "Youssef", last_name: "Amrani" })
    ).toBe("Youssef Amrani");
  });

  it("returns only first name when last_name is null", () => {
    expect(
      getFullName({ email_addresses: [], primary_email_address_id: "", first_name: "Youssef", last_name: null })
    ).toBe("Youssef");
  });

  it("returns null when both names are null", () => {
    expect(
      getFullName({ email_addresses: [], primary_email_address_id: "", first_name: null, last_name: null })
    ).toBeNull();
  });
});
