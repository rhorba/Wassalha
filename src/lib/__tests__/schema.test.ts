import { roleEnum } from "@/lib/db/schema/users";

describe("users schema", () => {
  it("roleEnum contains retailer and admin", () => {
    expect(roleEnum.enumValues).toContain("retailer");
    expect(roleEnum.enumValues).toContain("admin");
  });
});
