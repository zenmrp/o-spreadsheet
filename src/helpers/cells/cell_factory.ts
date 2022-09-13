import { isDateTimeFormat } from "..";
import { DEFAULT_ERROR_MESSAGE } from "../../constants";
import { compile } from "../../formulas";
import { cellRegistry } from "../../registries/cell_types";
import { Cell, CellDisplayProperties, CoreGetters, UID } from "../../types";
import { BadExpressionError, EvaluationError } from "../../types/errors";
import { parseDateTime } from "../dates";
import {
  isBoolean,
  isDateTime,
  isMarkdownLink,
  isMarkdownSheetLink,
  isWebLink,
  markdownLink,
} from "../misc";
import { isNumber, parseNumber } from "../numbers";
import {
  BooleanCell,
  DateTimeCell,
  EmptyCell,
  ErrorCell,
  FormulaCell,
  NumberCell,
  SheetLinkCell,
  TextCell,
  WebLinkCell,
} from "./cell_types";

cellRegistry
  .add("Formula", {
    sequence: 10,
    match: (content) => content.startsWith("="),
    createCell: (id, content, properties, sheetId, getters) => {
      const compiledFormula = compile(content);
      const dependencies = compiledFormula.dependencies.map((xc) =>
        getters.getRangeFromSheetXC(sheetId, xc)
      );
      return new FormulaCell(
        (cell: FormulaCell) => getters.buildFormulaContent(sheetId, cell),
        id,
        compiledFormula,
        dependencies,
        properties
      );
    },
  })
  .add("Empty", {
    sequence: 20,
    match: (content) => content === "",
    createCell: (id, content, properties) => new EmptyCell(id, properties),
  })
  .add("NumberWithDateTimeFormat", {
    sequence: 25,
    match: (content, format) => !!format && isNumber(content) && isDateTimeFormat(format),
    createCell: (id, content, properties) => {
      const format = properties.format!;
      return new DateTimeCell(id, parseNumber(content), { ...properties, format });
    },
  })
  .add("Number", {
    sequence: 30,
    match: (content) => isNumber(content),
    createCell: (id, content, properties) => {
      if (!properties.format) {
        properties.format = detectNumberFormat(content);
      }
      return new NumberCell(id, parseNumber(content), properties);
    },
  })
  .add("Boolean", {
    sequence: 40,
    match: (content) => isBoolean(content),
    createCell: (id, content, properties) => {
      return new BooleanCell(id, content.toUpperCase() === "TRUE" ? true : false, properties);
    },
  })
  .add("DateTime", {
    sequence: 50,
    match: (content) => isDateTime(content),
    createCell: (id, content, properties) => {
      const internalDate = parseDateTime(content)!;
      const format = properties.format || internalDate.format;
      return new DateTimeCell(id, internalDate.value, { ...properties, format });
    },
  })
  .add("MarkdownSheetLink", {
    sequence: 60,
    match: (content) => isMarkdownSheetLink(content),
    createCell: (id, content, properties, sheetId, getters) => {
      return new SheetLinkCell(id, content, properties, (sheetId) =>
        getters.tryGetSheetName(sheetId)
      );
    },
  })
  .add("MarkdownLink", {
    sequence: 70,
    match: (content) => isMarkdownLink(content),
    createCell: (id, content, properties) => {
      return new WebLinkCell(id, content, properties);
    },
  })
  .add("WebLink", {
    sequence: 80,
    match: (content) => isWebLink(content),
    createCell: (id, content, properties) => {
      return new WebLinkCell(id, markdownLink(content, content), properties);
    },
  });

/**
 * Return a factory function which can instantiate cells of
 * different types, based on a raw content.
 *
 * ```
 * // the createCell function can be used to instantiate new cells
 * const createCell = cellFactory(getters);
 * const cell = createCell(id, cellContent, cellProperties, sheetId)
 * ```
 */
export function cellFactory(getters: CoreGetters) {
  const builders = cellRegistry.getAll().sort((a, b) => a.sequence - b.sequence);
  return function createCell(
    id: UID,
    content: string,
    properties: CellDisplayProperties,
    sheetId: UID
  ): Cell {
    const builder = builders.find((factory) => factory.match(content, properties.format));
    if (!builder) {
      return new TextCell(id, content, properties);
    }
    try {
      return builder.createCell(id, content, properties, sheetId, getters);
    } catch (error) {
      return new ErrorCell(
        id,
        content,
        error instanceof EvaluationError
          ? error
          : new BadExpressionError(error.message || DEFAULT_ERROR_MESSAGE),
        properties
      );
    }
  };
}

function detectNumberFormat(content: string): string | undefined {
  const digitBase = content.includes(".") ? "0.00" : "0";
  const matchedCurrencies = content.match(/[\$€]/);
  if (matchedCurrencies) {
    const matchedFirstDigit = content.match(/[\d]/);
    const currency = "[$" + matchedCurrencies.values().next().value + "]";
    if (matchedFirstDigit!.index! < matchedCurrencies.index!) {
      return "#,##" + digitBase + currency;
    }
    return currency + "#,##" + digitBase;
  }
  if (content.includes("%")) {
    return digitBase + "%";
  }
  return undefined;
}
