import { Model } from "../../src";
import { functionCache } from "../../src/formulas/compiler";
import { compile } from "../../src/formulas/index";
import { functionRegistry } from "../../src/functions";
import { createValidRange } from "../../src/helpers";
import { ArgType, CompiledFormula } from "../../src/types";
import { getCellError, setCellContent } from "../test_helpers";
import { evaluateCell, evaluateCellFormat, restoreDefaultFunctions } from "../test_helpers/helpers";

function compiledBaseFunction(formula: string): CompiledFormula {
  for (let f in functionCache) {
    delete functionCache[f];
  }
  return compileFromCompleteFormula(formula);
}

function compileFromCompleteFormula(formula: string) {
  return compile(formula);
}

describe("expression compiler", () => {
  test.each(["=1", "=true", `="abc"`])("some arithmetic expressions", (formula) => {
    const compiledFormula = compiledBaseFunction(formula);
    expect(compiledFormula.execute.toString()).toMatchSnapshot();
  });

  test("simple values that throw error", () => {
    expect(() => compiledBaseFunction(`='abc'`)).toThrowError();
  });

  test.each(["=1 + 3", "=2 * 3", "=2 - 3", "=2 / 3", "=-3", "=(3 + 1) * (-1 + 4)"])(
    "some arithmetic expressions",
    (formula) => {
      const compiledFormula = compiledBaseFunction(formula);
      expect(compiledFormula.execute.toString()).toMatchSnapshot();
    }
  );

  test.each(["=sum(1,2)", '=sum(true, "")', "=sum(1,,2)"])(
    "some arithmetic expressions",
    (formula) => {
      const compiledFormula = compiledBaseFunction(formula);
      expect(compiledFormula.execute.toString()).toMatchSnapshot();
    }
  );

  test.each(["=1%", "=(2+5)%", "=A1%"])("some arithmetic expressions", (formula) => {
    const compiledFormula = compiledBaseFunction(formula);
    expect(compiledFormula.execute.toString()).toMatchSnapshot();
  });

  test("read some values and functions", () => {
    const compiledFormula = compiledBaseFunction("=A1 + sum(A2:C3)");
    expect(compiledFormula.execute.toString()).toMatchSnapshot();
  });

  test("with the same reference multiple times", () => {
    const compiledFormula = compiledBaseFunction("=SUM(A1, A1, A2)");
    expect(compiledFormula.execute.toString()).toMatchSnapshot();
  });

  test("expression with $ref", () => {
    const compiledFormula = compiledBaseFunction("=$A1+$A$2+A$3");
    expect(compiledFormula.execute.toString()).toMatchSnapshot();
  });

  test("expression with references with a sheet", () => {
    const compiledFormula = compiledBaseFunction("=Sheet34!B3");
    expect(compiledFormula.execute.toString()).toMatchSnapshot();
  });

  test("expressions with a debugger", () => {
    const compiledFormula = compiledBaseFunction("=? A1 / 2");
    expect(compiledFormula.execute.toString()).toMatchSnapshot();
  });

  test("cells are converted to ranges if function require a range", () => {
    const compiledFormula = compiledBaseFunction("=sum(A1)");
    expect(compiledFormula.execute.toString()).toMatchSnapshot();
  });

  test("cannot compile some invalid formulas", () => {
    expect(() => compiledBaseFunction("=qsdf")).toThrow();
  });
});

describe("compile functions", () => {
  describe("check number of arguments", () => {
    afterAll(() => {
      restoreDefaultFunctions();
    });

    test("with basic arguments", () => {
      functionRegistry.add("ANYFUNCTION", {
        description: "any function",
        compute: () => {
          return true;
        },
        args: [
          { name: "arg1", description: "", type: ["ANY"] },
          { name: "arg2", description: "", type: ["ANY"] },
        ],
        returns: ["ANY"],
      });
      expect(() => compiledBaseFunction("=ANYFUNCTION()")).toThrow();
      expect(() => compiledBaseFunction("=ANYFUNCTION(1)")).toThrow();
      expect(() => compiledBaseFunction("=ANYFUNCTION(1,2)")).not.toThrow();
      expect(() => compiledBaseFunction("=ANYFUNCTION(1,2,3)")).toThrow();
      restoreDefaultFunctions();
    });

    test("with optional argument", () => {
      functionRegistry.add("OPTIONAL", {
        description: "function with optional argument",
        compute: () => {
          return true;
        },
        args: [
          { name: "arg1", description: "", type: ["ANY"] },
          { name: "arg2", description: "", type: ["ANY"], optional: true },
        ],
        returns: ["ANY"],
      });
      expect(() => compiledBaseFunction("=OPTIONAL(1)")).not.toThrow();
      expect(() => compiledBaseFunction("=OPTIONAL(1,2)")).not.toThrow();
      expect(() => compiledBaseFunction("=OPTIONAL(1,2,3)")).toThrow();
      restoreDefaultFunctions();
    });

    test("with default argument", () => {
      functionRegistry.add("USEDEFAULTARG", {
        description: "function with a default argument",
        compute: () => {
          return true;
        },
        args: [
          { name: "arg1", description: "", type: ["ANY"] },
          { name: "arg2", description: "", type: ["ANY"], default: true, defaultValue: 42 },
        ],
        returns: ["ANY"],
      });
      expect(() => compiledBaseFunction("=USEDEFAULTARG(1)")).not.toThrow();
      expect(() => compiledBaseFunction("=USEDEFAULTARG(1,2)")).not.toThrow();
      expect(() => compiledBaseFunction("=USEDEFAULTARG(1,2,3)")).toThrow();
      restoreDefaultFunctions();
    });

    test("with repeatable argument", () => {
      functionRegistry.add("REPEATABLE", {
        description: "function with repeatable argument",
        compute: (arg) => {
          return true;
        },
        args: [
          { name: "arg1", description: "", type: ["ANY"] },
          { name: "arg2", description: "", type: ["ANY"], optional: true, repeating: true },
        ],
        returns: ["ANY"],
      });
      expect(() => compiledBaseFunction("=REPEATABLE(1)")).not.toThrow();
      expect(() => compiledBaseFunction("=REPEATABLE(1,2)")).not.toThrow();
      expect(() => compiledBaseFunction("=REPEATABLE(1,2,3,4,5,6)")).not.toThrow();
      restoreDefaultFunctions();
    });

    test("with more than one repeatable argument", () => {
      functionRegistry.add("REPEATABLES", {
        description: "any function",
        compute: (arg) => {
          return true;
        },
        args: [
          { name: "arg1", description: "", type: ["ANY"] },
          { name: "arg2", description: "", type: ["ANY"], optional: true, repeating: true },
          { name: "arg3", description: "", type: ["ANY"], optional: true, repeating: true },
        ],
        returns: ["ANY"],
      });
      expect(() => compiledBaseFunction("=REPEATABLES(1, 2)")).toThrow();
      expect(() => compiledBaseFunction("=REPEATABLES(1, 2, 3)")).not.toThrow();
      expect(() => compiledBaseFunction("=REPEATABLES(1, 2, 3, 4)")).toThrow();
      expect(() => compiledBaseFunction("=REPEATABLES(1, 2, 3, 4, 5)")).not.toThrow();
      restoreDefaultFunctions();
    });
  });

  describe("interpret arguments", () => {
    beforeAll(() => {
      functionRegistry.add("ISSECONDARGUNDEFINED", {
        description: "any function",
        args: [
          { name: "arg1", description: "", type: ["ANY"] },
          { name: "arg2", description: "", type: ["ANY"] },
        ],
        compute: (arg1, arg2) => {
          return arg2 === undefined;
        },
        computeFormat: (arg1, arg2) => {
          return arg2 === undefined ? "TRUE" : "FALSE";
        },
        returns: ["BOOLEAN"],
      });

      functionRegistry.add("SECONDARGDEFAULTVALUEEQUAL42", {
        description: "function with a default argument",
        args: [
          { name: "arg1", description: "", type: ["ANY"] },
          { name: "arg2", description: "", type: ["ANY"], default: true, defaultValue: 42 },
        ],
        compute: (arg1, arg2 = 42) => {
          return arg2 === 42;
        },
        computeFormat: (arg1, arg2 = { value: 42, format: "42" }) => {
          return !Array.isArray(arg2) &&
            typeof arg2 !== "function" &&
            arg2.value === 42 &&
            arg2.format === "42"
            ? "TRUE"
            : "FALSE";
        },
        returns: ["ANY"],
      });
    });
    afterAll(() => {
      restoreDefaultFunctions();
    });
    test("empty value interpreted as undefined", () => {
      expect(evaluateCell("A1", { A1: "=ISSECONDARGUNDEFINED(1,)" })).toBe(true);
      expect(evaluateCellFormat("A1", { A1: "=ISSECONDARGUNDEFINED(1,)" })).toBe("TRUE");
    });

    test("if default value --> empty value interpreted as default value", () => {
      expect(evaluateCell("A1", { A1: "=SECONDARGDEFAULTVALUEEQUAL42(1,)" })).toBe(true);
      expect(evaluateCellFormat("A1", { A1: "=SECONDARGDEFAULTVALUEEQUAL42(1,)" })).toBe("TRUE");
    });

    test("if default value --> non-value interpreted as default value", () => {
      expect(evaluateCell("A1", { A1: "=SECONDARGDEFAULTVALUEEQUAL42(1)" })).toBe(true);
      expect(evaluateCellFormat("A1", { A1: "=SECONDARGDEFAULTVALUEEQUAL42(1)" })).toBe("TRUE");
    });
  });

  describe("check type of arguments", () => {
    afterAll(() => {
      restoreDefaultFunctions();
    });
    test("reject non-range argument when expecting only range argument", () => {
      functionRegistry.add("RANGEEXPECTED", {
        description: "function expect number in 1st arg",
        compute: (arg) => {
          return true;
        },
        args: [{ name: "arg1", description: "", type: ["RANGE"] }],
        returns: ["ANY"],
      });

      functionRegistry.add("FORMULA_RETURNING_RANGE", {
        description: "function returning range",
        compute: (arg) => {
          return [["cucumber"]];
        },
        args: [],
        returns: ["RANGE"],
      });

      functionRegistry.add("FORMULA_NOT_RETURNING_RANGE", {
        description: "function returning range",
        compute: (arg) => {
          return "cucumber";
        },
        args: [],
        returns: ["STRING"],
      });

      expect(() => compiledBaseFunction("=RANGEEXPECTED(42)")).toThrowError(
        "Function RANGEEXPECTED expects the parameter 1 to be reference to a cell or range, not a number."
      );
      expect(() => compiledBaseFunction('=RANGEEXPECTED("test")')).toThrowError(
        "Function RANGEEXPECTED expects the parameter 1 to be reference to a cell or range, not a string."
      );
      expect(() => compiledBaseFunction("=RANGEEXPECTED(TRUE)")).toThrowError(
        "Function RANGEEXPECTED expects the parameter 1 to be reference to a cell or range, not a boolean."
      );
      expect(() =>
        compiledBaseFunction("=RANGEEXPECTED(FORMULA_NOT_RETURNING_RANGE())")
      ).toThrowError(
        "Function RANGEEXPECTED expects the parameter 1 to be reference to a cell or range, not a funcall."
      );

      expect(() => compiledBaseFunction("=RANGEEXPECTED(A1)")).not.toThrow();
      expect(() => compiledBaseFunction("=RANGEEXPECTED(A1:A1)")).not.toThrow();
      expect(() => compiledBaseFunction("=RANGEEXPECTED(A1:A2)")).not.toThrow();
      expect(() => compiledBaseFunction("=RANGEEXPECTED(A1:A$2)")).not.toThrow();
      expect(() => compiledBaseFunction("=RANGEEXPECTED(sheet2!A1:A$2)")).not.toThrow();
      expect(() => compiledBaseFunction("=RANGEEXPECTED(FORMULA_RETURNING_RANGE())")).not.toThrow();
    });

    test("reject range when expecting only non-range argument", () => {
      for (let typeExpected of ["ANY", "BOOLEAN", "DATE", "NUMBER", "STRING"] as ArgType[]) {
        functionRegistry.add(typeExpected + "EXPECTED", {
          description: "function expect number in 1st arg",
          compute: () => {
            return true;
          },
          args: [{ name: "arg1", description: "", type: [typeExpected] }],
          returns: ["ANY"],
        });
      }

      const m = new Model();

      setCellContent(m, "B1", "=?ANYEXPECTED(A1:A2)");
      setCellContent(m, "B2", "=BOOLEANEXPECTED(A1:A2)");
      setCellContent(m, "B3", "=DATEEXPECTED(A1:A2)");
      setCellContent(m, "B4", "=NUMBEREXPECTED(A1:A2)");
      setCellContent(m, "B5", "=STRINGEXPECTED(A1:A2)");
      setCellContent(m, "B6", "=ANYEXPECTED(A1:A$2)");
      setCellContent(m, "B7", "=ANYEXPECTED(sheet1!A1:A$2)");
      setCellContent(m, "B8", "=A2:A3");
      setCellContent(m, "B9", "=+A2:A3");
      setCellContent(m, "B10", "=A1+A2:A3");
      setCellContent(m, "B11", "=-A2:A3");
      setCellContent(m, "B12", "=A1-A2:A3");
      setCellContent(m, "B13", "=A1+A4*A5:A6-A2");
      setCellContent(m, "B14", "=ANYEXPECTED(A1:A1)");

      expect(getCellError(m, "B1")).toBe(
        "Function ANYEXPECTED expects the parameter 1 to be a single value or a single cell reference, not a range."
      );
      expect(getCellError(m, "B2")).toBe(
        "Function BOOLEANEXPECTED expects the parameter 1 to be a single value or a single cell reference, not a range."
      );
      expect(getCellError(m, "B3")).toBe(
        "Function DATEEXPECTED expects the parameter 1 to be a single value or a single cell reference, not a range."
      );
      expect(getCellError(m, "B4")).toBe(
        "Function NUMBEREXPECTED expects the parameter 1 to be a single value or a single cell reference, not a range."
      );
      expect(getCellError(m, "B5")).toBe(
        "Function STRINGEXPECTED expects the parameter 1 to be a single value or a single cell reference, not a range."
      );
      expect(getCellError(m, "B6")).toBe(
        "Function ANYEXPECTED expects the parameter 1 to be a single value or a single cell reference, not a range."
      );
      expect(getCellError(m, "B7")).toBe(
        "Function ANYEXPECTED expects the parameter 1 to be a single value or a single cell reference, not a range."
      );
      expect(getCellError(m, "B8")).toBe(
        "Function EQ expects its parameters to be single values or single cell references, not ranges."
      );
      expect(getCellError(m, "B9")).toBe(
        "Function UPLUS expects its parameters to be single values or single cell references, not ranges."
      );
      expect(getCellError(m, "B10")).toBe(
        "Function ADD expects its parameters to be single values or single cell references, not ranges."
      );
      expect(getCellError(m, "B11")).toBe(
        "Function UMINUS expects its parameters to be single values or single cell references, not ranges."
      );
      expect(getCellError(m, "B12")).toBe(
        "Function MINUS expects its parameters to be single values or single cell references, not ranges."
      );
      expect(getCellError(m, "B13")).toBe(
        "Function MULTIPLY expects its parameters to be single values or single cell references, not ranges."
      );
      expect(getCellError(m, "B14")).toBeUndefined();
    });
  });

  describe("with lazy arguments", () => {
    // this tests performs controls inside formula functions. For this reason, we
    // don't use mocked functions. Errors would be caught during evaluation of
    // formulas and not during the tests. So here we use a simple counter

    let count = 0;

    beforeAll(() => {
      functionRegistry.add("ANYFUNCTION", {
        description: "any function",
        args: [],
        compute: () => {
          count += 1;
          return true;
        },
        returns: ["ANY"],
      });

      functionRegistry.add("USELAZYARG", {
        description: "function with a lazy argument",
        args: [{ name: "lazyArg", description: "", type: ["ANY"], lazy: true }],
        compute: (arg) => {
          count *= 42;
          (arg as Function)();
          return true;
        },
        returns: ["ANY"],
      });

      functionRegistry.add("NOTUSELAZYARG", {
        description: "any function",
        args: [{ name: "any", description: "", type: ["ANY"] }],
        compute: () => {
          count *= 42;
          return true;
        },
        returns: ["ANY"],
      });
    });

    afterAll(() => {
      restoreDefaultFunctions();
    });

    test("with function as argument --> change the order in which functions are evaluated ", () => {
      count = 0;
      evaluateCell("A1", { A1: "=USELAZYARG(ANYFUNCTION())" });
      expect(count).toBe(1);
      count = 0;
      evaluateCell("A2", { A2: "=NOTUSELAZYARG(ANYFUNCTION())" });
      expect(count).toBe(42);
    });

    test.each([
      "=USELAZYARG(24)",
      "=USELAZYARG(1/0)",
      "=USELAZYARG(1/1/0)",
      "=USELAZYARG(USELAZYARG(24))",
    ])("functions call requesting lazy parameters", (formula) => {
      const compiledFormula = compiledBaseFunction(formula);
      expect(compiledFormula.execute.toString()).toMatchSnapshot();
    });
  });

  describe("with meta arguments", () => {
    beforeAll(() => {
      functionRegistry.add("USEMETAARG", {
        description: "function with a meta argument",
        compute: () => true,
        args: [{ name: "arg", description: "", type: ["META"] }],
        returns: ["STRING"],
      });
      functionRegistry.add("NOTUSEMETAARG", {
        description: "any function",
        compute: () => true,
        args: [{ name: "arg", description: "", type: ["ANY"] }],
        returns: ["ANY"],
      });
    });

    test.each(["=USEMETAARG(A1)", "=USEMETAARG(B2)"])(
      "function call requesting meta parameter",
      (formula) => {
        const compiledFormula = compiledBaseFunction(formula);
        expect(compiledFormula.execute.toString()).toMatchSnapshot();
      }
    );

    test("throw error if parameter isn't cell/range reference", () => {
      expect(() => compiledBaseFunction("=USEMETAARG(X8)")).not.toThrow();
      expect(() => compiledBaseFunction("=USEMETAARG($X$8)")).not.toThrow();
      expect(() => compiledBaseFunction("=USEMETAARG(Sheet42!X8)")).not.toThrow();
      expect(() => compiledBaseFunction("=USEMETAARG('Sheet 42'!X8)")).not.toThrow();

      expect(() => compiledBaseFunction("=USEMETAARG(D3:Z9)")).not.toThrow();
      expect(() => compiledBaseFunction("=USEMETAARG($D$3:$Z$9)")).not.toThrow();
      expect(() => compiledBaseFunction("=USEMETAARG(Sheet42!$D$3:$Z$9)")).not.toThrow();
      expect(() => compiledBaseFunction("=USEMETAARG('Sheet 42'!D3:Z9)")).not.toThrow();

      expect(() => compiledBaseFunction('=USEMETAARG("kikou")')).toThrowError();
      expect(() => compiledBaseFunction('=USEMETAARG("")')).toThrowError();
      expect(() => compiledBaseFunction("=USEMETAARG(TRUE)")).toThrowError();
      expect(() => compiledBaseFunction("=USEMETAARG(SUM(1,2,3))")).toThrowError();
    });

    test("do not care about the value of the cell / range passed as a reference", () => {
      const compiledFormula1 = compileFromCompleteFormula("=USEMETAARG(A1)");
      const compiledFormula2 = compileFromCompleteFormula("=USEMETAARG(A1:B2)");
      const compiledFormula3 = compileFromCompleteFormula("=NOTUSEMETAARG(A1)");
      const compiledFormula4 = compileFromCompleteFormula("=NOTUSEMETAARG(A1:B2)");

      const m = new Model();

      let refFn = jest.fn();
      let ensureRange = jest.fn();

      const ctx = { USEMETAARG: () => {}, NOTUSEMETAARG: () => {} };

      const rangeA1 = createValidRange(m.getters, "ABC", "A1")!;
      const rangeA1ToB2 = createValidRange(m.getters, "ABC", "A1:B2")!;

      compiledFormula1.execute([rangeA1], refFn, ensureRange, ctx);
      expect(refFn).toHaveBeenCalledWith(rangeA1, true, "USEMETAARG", 1);
      expect(ensureRange).toHaveBeenCalledTimes(0);
      refFn.mockReset();

      compiledFormula2.execute([rangeA1ToB2], refFn, ensureRange, ctx);
      expect(refFn).toHaveBeenCalledWith(rangeA1ToB2, true, "USEMETAARG", 1);
      expect(ensureRange).toHaveBeenCalledTimes(0);
      refFn.mockReset();

      compiledFormula3.execute([rangeA1], refFn, ensureRange, ctx);
      expect(refFn).toHaveBeenCalledWith(rangeA1, false, "NOTUSEMETAARG", 1);
      expect(ensureRange).toHaveBeenCalledTimes(0);
      refFn.mockReset();

      compiledFormula4.execute([rangeA1ToB2], refFn, ensureRange, ctx);
      expect(refFn).toHaveBeenCalledWith(rangeA1ToB2, false, "NOTUSEMETAARG", 1);
      expect(ensureRange).toHaveBeenCalledTimes(0);
      refFn.mockReset();
    });
  });

  test("function cache ignore spaces in functions", () => {
    compiledBaseFunction("=SUM(A1)");
    expect(Object.keys(functionCache)).toEqual(["=SUM(|0|)"]);
    compile("= SUM(A1)");
    compile("=SUM( A1)");
    compile("= SUM(A1 )");
    compile("= SUM   (    A1    )");
    expect(Object.keys(functionCache)).toEqual(["=SUM(|0|)"]);
  });
});
