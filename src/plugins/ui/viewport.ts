import {
  DEFAULT_CELL_HEIGHT,
  DEFAULT_CELL_WIDTH,
  HEADER_HEIGHT,
  HEADER_WIDTH,
} from "../../constants";
import { Mode } from "../../model";
import { Command, Sheet, UID, Viewport, ZoneDimension } from "../../types/index";
import { UIPlugin } from "../ui_plugin";

interface ViewportPluginState {
  readonly viewports: Record<UID, Viewport>;
}

/**
 * Viewport plugin.
 *
 * This plugin manages all things related to all viewport states.
 *
 * There are two types of viewports :
 *  1. The viewport related to the scrollbar absolute position
 *  2. The snappedViewport which represents the previous one but but 'snapped' to
 *     the col/row structure, so, the offsets are correct for computations necessary
 *     to align elements to the grid.
 */
export class ViewportPlugin extends UIPlugin {
  static getters = [
    "getActiveViewport",
    "getSnappedViewport",
    "getActiveSnappedViewport",
    "getViewportDimension",
    "getGridDimension",
  ];
  static modes: Mode[] = ["normal", "readonly"];

  readonly viewports: ViewportPluginState["viewports"] = {};
  readonly snappedViewports: ViewportPluginState["viewports"] = {};
  private clientWidth: number = 0;
  private clientHeight: number = 0;
  private updateSnap: boolean = false;

  // ---------------------------------------------------------------------------
  // Command Handling
  // ---------------------------------------------------------------------------

  handle(cmd: Command) {
    switch (cmd.type) {
      case "UNDO":
      case "REDO":
        this.cleanViewports();
        this.resetViewports();
        break;
      case "RESIZE_VIEWPORT":
        this.cleanViewports();
        this.resizeViewport(cmd.height, cmd.width);
        break;
      case "SET_VIEWPORT_OFFSET":
        this.setViewportOffset(cmd.offsetX, cmd.offsetY);
        break;
      case "REMOVE_COLUMNS_ROWS":
      case "RESIZE_COLUMNS_ROWS":
        if (cmd.dimension === "COL") {
          this.adjustViewportOffsetX(cmd.sheetId);
        } else {
          this.adjustViewportOffsetY(cmd.sheetId);
        }
        break;
      case "ADD_COLUMNS_ROWS":
        if (cmd.dimension === "COL") {
          this.adjustViewportZoneX(cmd.sheetId, this.getViewport(cmd.sheetId));
        } else {
          this.adjustViewportZoneY(cmd.sheetId, this.getViewport(cmd.sheetId));
        }
        break;
      case "ACTIVATE_SHEET":
        this.refreshViewport(cmd.sheetIdTo);
        break;
      case "SELECT_CELL":
      case "MOVE_POSITION":
        this.refreshViewport(this.getters.getActiveSheetId());
        break;
      case "SELECT_ROW":
      case "SELECT_COLUMN":
        if (!cmd.updateRange) {
          this.refreshViewport(this.getters.getActiveSheetId());
        }
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  getViewportDimension(): ZoneDimension {
    return { width: this.clientWidth, height: this.clientHeight };
  }

  getActiveViewport(): Viewport {
    const sheetId = this.getters.getActiveSheetId();
    return this.getViewport(sheetId);
  }

  getActiveSnappedViewport(): Viewport {
    const sheetId = this.getters.getActiveSheetId();
    return this.getSnappedViewport(sheetId);
  }

  private getSnappedViewport(sheetId: UID) {
    this.snapViewportToCell(sheetId);
    return this.snappedViewports[sheetId];
  }

  getGridDimension(sheet: Sheet): ZoneDimension {
    const lastCol = sheet.cols[sheet.cols.length - 1]; // to change with hide
    const effectiveWidth = this.clientWidth - HEADER_WIDTH;
    const lastRow = sheet.rows[sheet.rows.length - 1]; // to change with hide
    const effectiveHeight = this.clientHeight - HEADER_HEIGHT;

    const leftCol =
      sheet.cols.find((col) => col.end > lastCol.end - effectiveWidth) ||
      sheet.cols[sheet.cols.length - 1];
    const topRow =
      sheet.rows.find((row) => row.end > lastRow.end - effectiveHeight) ||
      sheet.rows[sheet.rows.length - 1];

    const width =
      lastCol.end +
      Math.max(DEFAULT_CELL_WIDTH, Math.min(leftCol.size, effectiveWidth - lastCol.size));
    const height =
      lastRow.end +
      Math.max(DEFAULT_CELL_HEIGHT + 5, Math.min(topRow.size, effectiveHeight - lastRow.size));

    return { width, height };
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private getViewport(sheetId: UID): Viewport {
    if (!this.viewports[sheetId]) {
      return this.generateViewportState(sheetId);
    }
    return this.viewports[sheetId];
  }

  private cleanViewports() {
    const sheets = this.getters.getVisibleSheets();
    for (let sheetId of Object.keys(this.viewports)) {
      if (!sheets.includes(sheetId)) {
        delete this.viewports[sheetId];
      }
    }
  }

  private resetViewports() {
    for (let sheetId of Object.keys(this.viewports)) {
      this.adjustViewportOffsetX(sheetId);
      this.adjustViewportOffsetY(sheetId);
      this.adjustViewportsPosition(sheetId);
    }
  }

  private adjustViewportOffsetX(sheetId: UID) {
    const { offsetX } = this.getViewport(sheetId);
    const { width: sheetWidth } = this.getGridDimension(this.getters.getSheet(sheetId));
    if (this.clientWidth - HEADER_WIDTH + offsetX > sheetWidth) {
      const diff = this.clientWidth - HEADER_WIDTH + offsetX - sheetWidth;
      this.viewports[sheetId].offsetX = Math.max(0, offsetX - diff);
    }
    this.adjustViewportZoneX(sheetId, this.viewports[sheetId]);
  }

  private adjustViewportOffsetY(sheetId: UID) {
    const { offsetY } = this.getViewport(sheetId);
    const { height: sheetHeight } = this.getGridDimension(this.getters.getSheet(sheetId));
    if (this.clientHeight - HEADER_HEIGHT + offsetY > sheetHeight) {
      const diff = this.clientHeight - HEADER_HEIGHT + offsetY - sheetHeight;
      this.viewports[sheetId].offsetY = Math.max(0, offsetY - diff);
    }
    this.adjustViewportZoneY(sheetId, this.viewports[sheetId]);
  }

  private resizeViewport(height: number, width: number) {
    this.clientHeight = height;
    this.clientWidth = width;
    this.recomputeViewports();
  }

  private recomputeViewports() {
    for (let sheetId of Object.keys(this.viewports)) {
      this.adjustViewportZone(sheetId, this.viewports[sheetId]);
    }
  }

  private setViewportOffset(offsetX: number, offsetY: number) {
    const sheetId = this.getters.getActiveSheetId();
    this.getActiveViewport();
    this.viewports[sheetId].offsetX = offsetX;
    this.viewports[sheetId].offsetY = offsetY;
    this.adjustViewportZone(sheetId, this.viewports[sheetId]);
  }

  private generateViewportState(sheetId: UID): Viewport {
    this.viewports[sheetId] = {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      offsetX: 0,
      offsetY: 0,
    };
    return this.viewports[sheetId];
  }

  private refreshViewport(sheetId: UID) {
    const viewport = this.getViewport(sheetId);
    this.adjustViewportZone(sheetId, viewport);
    this.adjustViewportsPosition(sheetId);
  }

  private adjustViewportZone(sheetId: UID, viewport: Viewport) {
    this.adjustViewportZoneX(sheetId, viewport);
    this.adjustViewportZoneY(sheetId, viewport);
  }

  private adjustViewportZoneX(sheetId: UID, viewport: Viewport) {
    const sheet = this.getters.getSheet(sheetId);
    const cols = sheet.cols;
    viewport.left = this.getters.getColIndex(viewport.offsetX + HEADER_WIDTH, 0, sheet);
    const x = this.clientWidth + viewport.offsetX - HEADER_WIDTH;
    viewport.right = cols.length - 1;
    for (let i = viewport.left; i < cols.length; i++) {
      if (x < cols[i].end) {
        viewport.right = i;
        break;
      }
    }
    this.updateSnap = true;
  }

  private adjustViewportZoneY(sheetId: UID, viewport: Viewport) {
    const sheet = this.getters.getSheet(sheetId);
    const rows = sheet.rows;
    viewport.top = this.getters.getRowIndex(viewport.offsetY + HEADER_HEIGHT, 0, sheet);
    const y = this.clientHeight + viewport.offsetY - HEADER_HEIGHT;
    viewport.bottom = rows.length - 1;
    for (let i = viewport.top; i < rows.length; i++) {
      if (y < rows[i].end) {
        viewport.bottom = i;
        break;
      }
    }
    this.updateSnap = true;
  }

  /**
   * This function will make sure that the current cell is part of the viewport that is actually
   * displayed on the client, that is, the snapped one. We therefore adjust the offset of the snapped viewport
   * until it contains the current cell completely.
   * In order to keep the coherence of both viewports, it is also necessary to update the standard viewport
   * if the zones of both viewports don't match.
   */
  private adjustViewportsPosition(sheetId: UID) {
    const sheet = this.getters.getSheet(sheetId);
    const { cols, rows } = sheet;
    const adjustedViewport = this.getSnappedViewport(sheetId);
    const [col, row] = this.getters.getMainCell(sheetId, ...this.getters.getSheetPosition(sheetId));
    while (
      cols[col].end > adjustedViewport.offsetX + this.clientWidth - HEADER_WIDTH &&
      adjustedViewport.offsetX < cols[col].start
    ) {
      adjustedViewport.offsetX = cols[adjustedViewport.left].end;
      this.adjustViewportZoneX(sheetId, adjustedViewport);
    }
    while (col < adjustedViewport.left) {
      adjustedViewport.offsetX = cols[adjustedViewport.left - 1].start;
      this.adjustViewportZoneX(sheetId, adjustedViewport);
    }
    while (
      rows[row].end > adjustedViewport.offsetY + this.clientHeight - HEADER_HEIGHT &&
      adjustedViewport.offsetY < rows[row].start
    ) {
      adjustedViewport.offsetY = rows[adjustedViewport.top].end;
      this.adjustViewportZoneY(sheetId, adjustedViewport);
    }
    while (row < adjustedViewport.top) {
      adjustedViewport.offsetY = rows[adjustedViewport.top - 1].start;
      this.adjustViewportZoneY(sheetId, adjustedViewport);
    }
    // cast the new snappedViewport in the standard viewport
    const { top, left } = this.viewports[sheetId];
    if (top !== adjustedViewport.top || left !== adjustedViewport.left)
      this.viewports[sheetId] = adjustedViewport;
    this.updateSnap = false;
  }

  private snapViewportToCell(sheetId: UID) {
    const { cols, rows } = this.getters.getSheet(sheetId);
    const viewport = this.getViewport(sheetId);
    const adjustedViewport = Object.assign({}, viewport);
    adjustedViewport.offsetX = cols[viewport.left].start;
    adjustedViewport.offsetY = rows[viewport.top].start;
    this.adjustViewportZone(sheetId, adjustedViewport);
    this.snappedViewports[sheetId] = adjustedViewport;
  }

  finalize() {
    if (this.updateSnap) {
      this.snapViewportToCell(this.getters.getActiveSheetId());
      this.updateSnap = false;
    }
  }
}