import { Model } from "../../src";
import { CommandResult } from "../../src/types";
import { setInputValueAndTrigger, simulateClick, triggerMouseEvent } from "../dom_helper";
import { GridParent, makeTestFixture, nextTick } from "../helpers";

const mockChart = () => {
  const mockChartData = {
    data: undefined,
    config: {
      options: {
        title: undefined,
      },
      type: undefined,
    },
  };
  class ChartMock {
    set data(value) {
      mockChartData.data = value;
    }
    get data() {
      return mockChartData.data;
    }
    destroy = () => {};
    update = () => {};
    options = mockChartData.config.options;
    config = mockChartData.config;
  }
  //@ts-ignore
  window.Chart = ChartMock;
  return mockChartData;
};

jest.spyOn(HTMLDivElement.prototype, "clientWidth", "get").mockImplementation(() => 1000);
jest.spyOn(HTMLDivElement.prototype, "clientHeight", "get").mockImplementation(() => 1000);

let fixture: HTMLElement;
let model;
let mockChartData = mockChart();

let parent: GridParent;
describe("figures", () => {
  beforeEach(async () => {
    fixture = makeTestFixture();
    mockChartData = mockChart();
    model = new Model({
      sheets: [
        {
          name: "Sheet1",
          colNumber: 10,
          rowNumber: 10,
          rows: {},
          cells: {
            B1: { content: "first column dataset" },
            C1: { content: "second column dataset" },
            B2: { content: "10" },
            B3: { content: "11" },
            B4: { content: "12" },
            B5: { content: "13" },
            C2: { content: "20" },
            C3: { content: "19" },
            C4: { content: "18" },
            A2: { content: "P1" },
            A3: { content: "P2" },
            A4: { content: "P3" },
            A5: { content: "P4" },
          },
        },
      ],
    });
    parent = new GridParent(model);
    await parent.mount(fixture);
    await nextTick();
    model.dispatch("CREATE_CHART", {
      sheetId: model.getters.getActiveSheetId(),
      id: "someuuid",
      definition: {
        dataSets: ["B1:B4"],
        labelRange: "A2:A4",
        dataSetsHaveTitle: true,
        title: "hello",
        type: "bar",
      },
    });
    await nextTick();
  });
  afterEach(() => {
    fixture.remove();
  });
  test("can export a chart", () => {
    const data = model.exportData();
    const activeSheetId = model.getters.getActiveSheetId();
    const sheet = data.sheets.find((s) => s.id === activeSheetId)!;
    expect(sheet.figures).toEqual([
      {
        data: {
          dataSets: ["B1:B4"],
          labelRange: "A2:A4",
          dataSetsHaveTitle: true,
          title: "hello",
          type: "bar",
        },
        id: "someuuid",
        height: 500,
        tag: "chart",
        width: 800,
        x: 0,
        y: 0,
      },
    ]);
  });
  test("charts have a menu button", () => {
    expect(fixture.querySelector(".o-figure")).toBeDefined();
    expect(fixture.querySelector(".o-chart-menu")).toBeDefined();
  });

  test("Click on Menu button open context menu", async () => {
    expect(fixture.querySelector(".o-figure")).toBeDefined();
    await simulateClick(".o-figure");
    expect(document.activeElement).toBe(fixture.querySelector(".o-figure"));
    expect(fixture.querySelector(".o-chart-menu")).toBeDefined();
    await simulateClick(".o-chart-menu");
    expect(fixture.querySelector(".o-menu")).toBeDefined();
  });

  test("Click on Delete button will delete the chart", async () => {
    expect(model.getters.getChartDefinition("someuuid")).toMatchObject({
      dataSets: [
        {
          dataRange: {
            prefixSheet: false,
            zone: {
              bottom: 3,
              left: 1,
              right: 1,
              top: 0,
            },
          },
          labelCell: {
            prefixSheet: false,
            zone: {
              bottom: 0,
              left: 1,
              right: 1,
              top: 0,
            },
          },
        },
      ],
      labelRange: {
        prefixSheet: false,
        zone: {
          bottom: 3,
          left: 0,
          right: 0,
          top: 1,
        },
      },
      title: "hello",
      type: "bar",
    });
    expect(fixture.querySelector(".o-figure")).toBeDefined();
    await simulateClick(".o-figure");
    expect(document.activeElement).toBe(fixture.querySelector(".o-figure"));
    expect(fixture.querySelector(".o-chart-menu")).toBeDefined();
    await simulateClick(".o-chart-menu");
    expect(fixture.querySelector(".o-menu")).toBeDefined();
    const deleteButton = fixture.querySelectorAll(".o-menu-item")[1];
    expect(deleteButton.textContent).toBe("Delete");
    await simulateClick(".o-menu div[data-name='delete']");
    expect(model.getters.getChartRuntime("someuuid")).toBeUndefined();
  });

  test("Click on Edit button will prefill sidepanel", async () => {
    await simulateClick(".o-figure");
    await simulateClick(".o-chart-menu");
    const editButton = fixture.querySelectorAll(".o-menu-item")[0];
    expect(editButton.textContent).toBe("Edit");
    await simulateClick(".o-menu div[data-name='edit']");
    expect(fixture.querySelector(".o-sidePanel .o-sidePanelBody .o-chart")).toBeTruthy();
    const chartType = fixture.querySelectorAll(".o-input")[0];
    const title = fixture.querySelectorAll(".o-input")[1];
    const dataSeries = fixture.querySelectorAll(
      ".o-sidePanel .o-sidePanelBody .o-chart .o-data-series"
    )[0];
    const hasTitle = (dataSeries.querySelector("input[type=checkbox]") as HTMLInputElement).checked;
    const labels = fixture.querySelector(".o-data-labels");
    expect((chartType as HTMLSelectElement).value).toBe("bar");
    expect((title as HTMLInputElement).value).toBe("hello");
    expect((dataSeries.querySelector(" .o-selection input") as HTMLInputElement).value).toBe(
      "B1:B4"
    );
    expect(hasTitle).toBe(true);
    expect((labels!.querySelector(".o-selection input") as HTMLInputElement).value).toBe("A2:A4");
  });

  test("can edit charts", async () => {
    await simulateClick(".o-figure");
    await simulateClick(".o-chart-menu");
    const editButton = fixture.querySelectorAll(".o-menu-item")[0];
    expect(editButton.textContent).toBe("Edit");
    await simulateClick(".o-menu div[data-name='edit']");
    expect(fixture.querySelector(".o-sidePanel .o-sidePanelBody .o-chart")).toBeTruthy();
    const chartType = fixture.querySelectorAll(".o-input")[0] as HTMLSelectElement;
    const title = fixture.querySelectorAll(".o-input")[1] as HTMLInputElement;
    const dataSeries = fixture.querySelectorAll(
      ".o-sidePanel .o-sidePanelBody .o-chart .o-data-series"
    )[0] as HTMLInputElement;
    const dataSeriesValues = dataSeries.querySelector("input");
    const hasTitle = dataSeries.querySelector("input[type=checkbox]") as HTMLInputElement;
    setInputValueAndTrigger(chartType, "pie", "change");
    setInputValueAndTrigger(title, "piechart", "input");
    setInputValueAndTrigger(dataSeriesValues, "B2:B4", "change");
    triggerMouseEvent(hasTitle, "click");
    parent.env.dispatch = jest.fn((command) => ({ status: "SUCCESS" } as CommandResult));
    await simulateClick(".o-sidePanelButtons .o-sidePanelButton");
    expect(parent.env.dispatch).toHaveBeenCalledWith("UPDATE_CHART", {
      id: "someuuid",
      definition: {
        dataSets: ["B2:B4"],
        labelRange: "A2:A4",
        dataSetsHaveTitle: false,
        title: "piechart",
        type: "pie",
      },
      sheetId: model.getters.getActiveSheetId(),
    });
  });

  test("drawing of chart will receive new data after update", async () => {
    await simulateClick(".o-figure");
    await simulateClick(".o-chart-menu");
    const editButton = fixture.querySelectorAll(".o-menu-item")[0];
    expect(editButton.textContent).toBe("Edit");
    await simulateClick(".o-menu div[data-name='edit']");
    expect(fixture.querySelector(".o-sidePanel .o-sidePanelBody .o-chart")).toBeTruthy();
    const chartType = fixture.querySelectorAll(".o-input")[0] as HTMLSelectElement;
    const title = fixture.querySelectorAll(".o-input")[1] as HTMLInputElement;
    const dataSeries = fixture.querySelectorAll(
      ".o-sidePanel .o-sidePanelBody .o-chart .o-data-series"
    )[0] as HTMLInputElement;
    const dataSeriesValues = dataSeries.querySelector("input");
    const hasTitle = dataSeries.querySelector("input[type=checkbox]") as HTMLInputElement;
    const labels = fixture.querySelector(".o-data-labels input");
    setInputValueAndTrigger(chartType, "pie", "change");
    setInputValueAndTrigger(title, "piechart", "input");
    setInputValueAndTrigger(dataSeriesValues, "B2:B5", "change");
    setInputValueAndTrigger(labels, "A2:A5", "change");
    triggerMouseEvent(hasTitle, "click");
    await simulateClick(".o-sidePanelButtons .o-sidePanelButton");
    await nextTick();
    expect((mockChartData.data! as any).labels).toEqual(["P1", "P2", "P3", "P4"]);
    expect((mockChartData.data! as any).datasets[0].data).toEqual([10, 11, 12, 13]);
    expect(mockChartData.config.type).toBe("pie");
    expect((mockChartData.config.options.title as any).text).toBe("piechart");
  });

  test("chart is focused after creation", async () => {
    model.dispatch("CREATE_CHART", {
      sheetId: model.getters.getActiveSheetId(),
      id: "someuuid2",
      definition: {
        dataSets: ["B1:B4"],
        labelRange: "A2:A4",
        dataSetsHaveTitle: true,
        title: "newchart",
        type: "line",
      },
    });
    await nextTick();
    expect(model.getters.getSelectedFigureId()).toBe("someuuid2");
  });

  test("chart is focused after update", async () => {
    model.dispatch("UPDATE_CHART", {
      sheetId: model.getters.getActiveSheetId(),
      id: "someuuid",
      definition: {
        dataSets: ["B1:B4"],
        labelRange: "A2:A4",
        dataSetsHaveTitle: true,
        title: "updated chart",
        type: "bar",
      },
    });
    await nextTick();
    expect(model.getters.getSelectedFigureId()).toBe("someuuid");
  });

  test("deleting chart will close sidePanel", async () => {
    expect(fixture.querySelector(".o-sidePanel .o-sidePanelBody .o-chart")).toBeFalsy();
    await simulateClick(".o-figure");
    await simulateClick(".o-chart-menu");
    await simulateClick(".o-menu div[data-name='edit']");
    await nextTick();
    expect(fixture.querySelector(".o-sidePanel .o-sidePanelBody .o-chart")).toBeTruthy();
    await simulateClick(".o-figure");
    await simulateClick(".o-chart-menu");
    await simulateClick(".o-menu div[data-name='delete']");
    expect(model.getters.getChartRuntime("someuuid")).toBeUndefined();
    await nextTick();
    expect(fixture.querySelector(".o-sidePanel .o-sidePanelBody .o-chart")).toBeFalsy();
  });

  test("selecting other chart will adapt sidepanel", async () => {
    model.dispatch("CREATE_CHART", {
      sheetId: model.getters.getActiveSheetId(),
      id: "someuuid2",
      definition: {
        dataSets: ["C1:C4"],
        labelRange: "A2:A4",
        dataSetsHaveTitle: true,
        title: "second",
        type: "line",
      },
    });
    await nextTick();
    const figures = fixture.querySelectorAll(".o-figure");
    await simulateClick(figures[0] as HTMLElement);
    await simulateClick(".o-chart-menu");
    await simulateClick(".o-menu div[data-name='edit']");
    await nextTick();
    expect(fixture.querySelector(".o-sidePanel .o-sidePanelBody .o-chart")).toBeTruthy();
    await simulateClick(figures[1] as HTMLElement);
    await nextTick();
    const chartType = fixture.querySelectorAll(".o-input")[0];
    const title = fixture.querySelectorAll(".o-input")[1];
    const dataSeries = fixture.querySelectorAll(
      ".o-sidePanel .o-sidePanelBody .o-chart .o-data-series"
    )[0];
    const hasTitle = (dataSeries.querySelector("input[type=checkbox]") as HTMLInputElement).checked;
    const labels = fixture.querySelector(".o-data-labels");
    expect((chartType as HTMLSelectElement).value).toBe("line");
    expect((title as HTMLInputElement).value).toBe("second");
    expect((dataSeries.querySelector(" .o-selection input") as HTMLInputElement).value).toBe(
      "C1:C4"
    );
    expect(hasTitle).toBe(true);
    expect((labels!.querySelector(".o-selection input") as HTMLInputElement).value).toBe("A2:A4");
  });
});
