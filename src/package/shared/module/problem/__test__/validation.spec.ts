import { ValidationError } from "@nestjs/common";
import { DomainError } from "../domain-error";
import { constraintCode, fieldProblems } from "../validation";

describe("problem validation mapping", () => {
  it("derives stable codes from class-validator constraints", () => {
    expect(constraintCode("isNotEmpty")).toBe("IS_NOT_EMPTY");
    expect(constraintCode("isEmail")).toBe("IS_EMAIL");
    expect(constraintCode("maxLength")).toBe("MAX_LENGTH");
    expect(constraintCode("whitelistValidation")).toBe("UNKNOWN_FIELD");
  });

  it("flattens nested and array paths", () => {
    const error = (
      property: string,
      constraints?: Record<string, string>,
      children: ValidationError[] = [],
    ): ValidationError => ({ property, constraints, children });
    expect(
      fieldProblems([
        error("items", undefined, [
          error("0", undefined, [error("name", { isNotEmpty: "x" })]),
        ]),
        error("address", undefined, [error("zip", { length: "x" })]),
      ]),
    ).toEqual([
      { field: "items[0].name", code: "IS_NOT_EMPTY" },
      { field: "address.zip", code: "LENGTH" },
    ]);
  });

  it("rejects codes outside the public format", () => {
    expect(() => new DomainError("rule", "category full")).toThrow(
      "Invalid problem code",
    );
  });
});
