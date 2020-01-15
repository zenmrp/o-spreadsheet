import { GridModel } from "../../src/grid_model";
import { makeTestFixture, triggerMouseEvent, GridParent, nextTick } from "../helpers";

let fixture: HTMLElement;

beforeEach(() => {
  fixture = makeTestFixture();
});

afterEach(() => {
  fixture.remove();
});

describe("Grid component", () => {
  test("can click on a cell to select it", async () => {
    const model = new GridModel({
      sheets: [
        {
          colNumber: 10,
          rowNumber: 10,
          cells: { B2: { content: "b2" }, B3: { content: "b3" } }
        }
      ]
    });
    const parent = new GridParent(model);
    await parent.mount(fixture);
    // todo: find a way to have actual width/height instead of this
    model.viewport = { left: 0, top: 0, right: 9, bottom: 9 };

    expect(model.activeXc).toBe("A1");
    triggerMouseEvent("canvas", "mousedown", 300, 200);
    expect(model.activeXc).toBe("C8");
  });

  test("can click on resizer, then move selection with keyboard", async () => {
    const model = new GridModel({
      sheets: [
        {
          colNumber: 10,
          rowNumber: 10,
          cells: { B2: { content: "b2" }, B3: { content: "b3" } }
        }
      ]
    });
    const parent = new GridParent(model);
    await parent.mount(fixture);
    // todo: find a way to have actual width/height instead of this
    model.viewport = { left: 0, top: 0, right: 9, bottom: 9 };

    expect(model.activeXc).toBe("A1");
    triggerMouseEvent(".o-resizer", "click", 300, 20);
    document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    expect(model.activeXc).toBe("A2");
  });

  test("can shift-click on a cell to update selection", async () => {
    const model = new GridModel({
      sheets: [
        {
          colNumber: 10,
          rowNumber: 10,
          cells: { B2: { content: "b2" }, B3: { content: "b3" } }
        }
      ]
    });
    const parent = new GridParent(model);
    await parent.mount(fixture);
    // todo: find a way to have actual width/height instead of this
    model.viewport = { left: 0, top: 0, right: 9, bottom: 9 };

    expect(model.activeXc).toBe("A1");
    triggerMouseEvent("canvas", "mousedown", 300, 200, { shiftKey: true });
    expect(model.selections.zones[0]).toEqual({
      top: 0,
      left: 0,
      bottom: 7,
      right: 2
    });
  });

  test("can click on a header to select a column", async () => {
    const model = new GridModel({
      sheets: [
        {
          colNumber: 10,
          rowNumber: 10
        }
      ]
    });
    const parent = new GridParent(model);
    await parent.mount(fixture);
    // todo: find a way to have actual width/height instead of this
    model.viewport = { left: 0, top: 0, right: 9, bottom: 9 };

    expect(model.activeXc).toBe("A1");
    triggerMouseEvent(".o-resizer.horizontal", "mousedown", 300, 10);
    expect(model.selections.zones[0]).toEqual({ left: 2, top: 0, right: 2, bottom: 9 });
    expect(model.activeXc).toBe("C1");
  });

  describe("keybindings", () => {
    test("pressing ENTER put current cell in edit mode", async () => {
      // note: this behavious is not like excel. Maybe someone will want to
      // change this
      const model = new GridModel({
        sheets: [
          {
            colNumber: 10,
            rowNumber: 10
          }
        ]
      });
      const parent = new GridParent(model);
      await parent.mount(fixture);
      // todo: find a way to have actual width/height instead of this
      model.viewport = { left: 0, top: 0, right: 9, bottom: 9 };

      expect(model.activeXc).toBe("A1");
      fixture
        .querySelector("canvas")!
        .dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
      expect(model.activeXc).toBe("A1");
      expect(model.isEditing).toBe(true);
    });

    test("pressing ENTER in edit mode stop editing and move one cell down", async () => {
      const model = new GridModel({
        sheets: [
          {
            colNumber: 10,
            rowNumber: 10
          }
        ]
      });
      const parent = new GridParent(model);
      await parent.mount(fixture);
      // todo: find a way to have actual width/height instead of this
      model.viewport = { left: 0, top: 0, right: 9, bottom: 9 };

      expect(model.activeXc).toBe("A1");
      model.startEditing("a");
      await nextTick();
      await nextTick();
      fixture
        .querySelector("div.o-composer")!
        .dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
      expect(model.activeXc).toBe("A2");
      expect(model.isEditing).toBe(false);
      expect(model.cells["A1"].content).toBe("a");
    });

    test("pressing shift+ENTER in edit mode stop editing and move one cell up", async () => {
      const model = new GridModel({
        sheets: [
          {
            colNumber: 10,
            rowNumber: 10
          }
        ]
      });
      const parent = new GridParent(model);
      await parent.mount(fixture);
      // todo: find a way to have actual width/height instead of this
      model.viewport = { left: 0, top: 0, right: 9, bottom: 9 };

      model.selectCell(0, 1);
      expect(model.activeXc).toBe("A2");
      model.startEditing("a");
      await nextTick();
      await nextTick();
      fixture
        .querySelector("div.o-composer")!
        .dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", shiftKey: true }));
      expect(model.activeXc).toBe("A1");
      expect(model.isEditing).toBe(false);
      expect(model.cells["A2"].content).toBe("a");
    });

    test("pressing shift+ENTER in edit mode in top row stop editing and stay on same cell", async () => {
      const model = new GridModel({
        sheets: [
          {
            colNumber: 10,
            rowNumber: 10
          }
        ]
      });
      const parent = new GridParent(model);
      await parent.mount(fixture);
      // todo: find a way to have actual width/height instead of this
      model.viewport = { left: 0, top: 0, right: 9, bottom: 9 };

      expect(model.activeXc).toBe("A1");
      model.startEditing("a");
      await nextTick();
      await nextTick();
      fixture
        .querySelector("div.o-composer")!
        .dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", shiftKey: true }));
      expect(model.activeXc).toBe("A1");
      expect(model.isEditing).toBe(false);
      expect(model.cells["A1"].content).toBe("a");
    });

    test("pressing TAB move to next cell", async () => {
      const model = new GridModel({
        sheets: [
          {
            colNumber: 10,
            rowNumber: 10
          }
        ]
      });
      const parent = new GridParent(model);
      await parent.mount(fixture);
      // todo: find a way to have actual width/height instead of this
      model.viewport = { left: 0, top: 0, right: 9, bottom: 9 };

      expect(model.activeXc).toBe("A1");
      fixture.querySelector("canvas")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
      expect(model.activeXc).toBe("B1");
    });

    test("pressing shift+TAB move to previous cell", async () => {
      const model = new GridModel({
        sheets: [
          {
            colNumber: 10,
            rowNumber: 10
          }
        ]
      });
      const parent = new GridParent(model);
      await parent.mount(fixture);
      // todo: find a way to have actual width/height instead of this
      model.viewport = { left: 0, top: 0, right: 9, bottom: 9 };

      model.selectCell(1, 0);
      expect(model.activeXc).toBe("B1");
      fixture
        .querySelector("canvas")!
        .dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true }));
      expect(model.activeXc).toBe("A1");
    });
  });
});

describe("composer", () => {
  test("starting the edition of the cell, the composer should have the focus", async () => {
    const model = new GridModel({
      sheets: [
        {
          colNumber: 10,
          rowNumber: 10
        }
      ]
    });
    const parent = new GridParent(model);
    await parent.mount(fixture);
    // todo: find a way to have actual width/height instead of this
    model.viewport = { left: 0, top: 0, right: 9, bottom: 9 };

    expect(model.activeXc).toBe("A1");
    fixture.querySelector("canvas")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await nextTick();
    await nextTick();
    expect(model.isEditing).toBe(true);
    expect(model.activeRow).toBe(0);
    expect(model.activeCol).toBe(0);
    expect(document.activeElement).toBe(fixture.querySelector("div.o-composer")!);
  });
});
