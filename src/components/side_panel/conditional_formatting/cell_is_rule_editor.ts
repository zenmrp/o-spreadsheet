import * as owl from "@odoo/owl";
import { CellIsRule, ConditionalFormatRule, SpreadsheetEnv, Style } from "../../../types";
import { ColorPicker } from "../../color_picker";
import * as icons from "../../icons";
import { cellIsOperators, conditionalFormattingTerms } from "../translations_terms";

const { Component, useState, hooks } = owl;
const { useExternalListener } = hooks;
const { xml, css } = owl.tags;

const PREVIEW_TEMPLATE = xml/* xml */ `
    <div class="o-cf-preview-line"
         t-attf-style="font-weight:{{currentStyle.bold ?'bold':'normal'}};
                       text-decoration:{{currentStyle.strikethrough ? 'line-through':'none'}};
                       font-style:{{currentStyle.italic?'italic':'normal'}};
                       color:{{currentStyle.textColor}};
                       border-radius: 4px;
                       background-color:{{currentStyle.fillColor}};"
         t-esc="previewText || env._t('${conditionalFormattingTerms.PREVIEW_TEXT}')" />
`;

const TEMPLATE = xml/* xml */ `
<div>
    <div class="o-cf-title-text" t-esc="env._t('${conditionalFormattingTerms.IS_RULE}')"></div>
    <select t-model="state.condition.operator" class="o-input o-cell-is-operator">
        <t t-foreach="Object.keys(cellIsOperators)" t-as="op" t-key="op_index">
            <option t-att-value="op" t-esc="cellIsOperators[op]"/>
        </t>
    </select>
    <t t-if="state.condition.operator !== 'IsEmpty' and state.condition.operator !== 'IsNotEmpty'">
      <input type="text"
             placeholder="Value"
             t-model="state.condition.value1"
             class="o-input o-cell-is-value"/>
      <t t-if="state.condition.operator === 'Between' || state.condition.operator === 'NotBetween'">
          <input type="text"
                 placeholder="and value"
                 t-model="state.condition.value2"
                 class="o-input o-cell-is-value"/>
      </t>
    </t>
    <div class="o-cf-title-text" t-esc="env._t('${conditionalFormattingTerms.FORMATTING_STYLE}')"></div>

    <t t-call="${PREVIEW_TEMPLATE}">
        <t t-set="currentStyle" t-value="state.style"/>
    </t>
    <div class="o-tools">
        <div class="o-tool" t-att-title="env._t('${conditionalFormattingTerms.BOLD}')" t-att-class="{active:state.style.bold}" t-on-click="toggleTool('bold')">
            ${icons.BOLD_ICON}
        </div>
        <div class="o-tool" t-att-title="env._t('${conditionalFormattingTerms.ITALIC}')" t-att-class="{active:state.style.italic}" t-on-click="toggleTool('italic')">
            ${icons.ITALIC_ICON}
        </div>
        <div class="o-tool" t-att-title="env._t('${conditionalFormattingTerms.STRIKE_THROUGH}')" t-att-class="{active:state.style.strikethrough}"
             t-on-click="toggleTool('strikethrough')">${icons.STRIKE_ICON}
        </div>
        <div class="o-tool o-with-color">
              <span t-att-title="env._t('${conditionalFormattingTerms.TEXT_COLOR}')" t-attf-style="border-color:{{state.style.textColor}}"
                    t-on-click.stop="toggleMenu('textColorTool')">
                    ${icons.TEXT_COLOR_ICON}
              </span>
              <div class="o-colorpicker-container" >
                <ColorPicker t-if="state.textColorTool" dropdownDirection="'left'" t-on-color-picked="setColor('textColor')" t-key="textColor"/>
              </div>
        </div>
        <div class="o-divider"/>
        <div class="o-tool o-with-color">
          <span t-att-title="env._t('${conditionalFormattingTerms.FILL_COLOR}')" t-attf-style="border-color:{{state.style.fillColor}}"
                t-on-click.stop="toggleMenu('fillColorTool')">
                ${icons.FILL_COLOR_ICON}
          </span>
          <div class="o-colorpicker-container" >
            <ColorPicker t-if="state.fillColorTool" dropdownDirection="'left'" t-on-color-picked="setColor('fillColor')" t-key="fillColor"/>
          </div>
        </div>
    </div>
</div>
`;

const CSS = css/* scss */ `
  .o-cf-preview-line {
    border: 1px solid darkgrey;
    padding: 10px;
  }
  .o-cell-is-operator {
    margin-bottom: 5px;
    width: 96%;
  }
  .o-cell-is-value {
    margin-bottom: 5px;
    width: 96%;
  }
  .o-colorpicker-container {
    position: absolute;
    padding-left: 20px;
    padding-bottom: 18px;
    pointer-events: none;

    .o-color-picker {
      pointer-events: all;
    }
  }
`;

interface Props {
  rule: CellIsRule;
}

export class CellIsRuleEditor extends Component<Props, SpreadsheetEnv> {
  static template = TEMPLATE;
  static style = CSS;
  static components = { ColorPicker };

  // @ts-ignore used in XML template
  private cellIsOperators = cellIsOperators;

  state = useState({
    condition: {
      operator:
        this.props.rule && this.props.rule.operator ? this.props.rule.operator : "IsNotEmpty",
      value1: this.props.rule && this.props.rule.values.length > 0 ? this.props.rule.values[0] : "",
      value2: this.props.rule.values.length > 1 ? this.props.rule.values[1] : "",
    },

    textColorTool: false,
    fillColorTool: false,
    style: {
      fillColor: this.props.rule.style.fillColor,
      textColor: this.props.rule.style.textColor,
      bold: this.props.rule.style.bold,
      italic: this.props.rule.style.italic,
      strikethrough: this.props.rule.style.strikethrough,
    },
  });
  constructor() {
    super(...arguments);
    useExternalListener(window as any, "click", this.closeMenus);
  }

  getRule(): CellIsRule {
    const newStyle: Style = {};
    const style = this.state.style;
    if (style.bold !== undefined) {
      newStyle.bold = style.bold;
    }
    if (style.italic !== undefined) {
      newStyle.italic = style.italic;
    }
    if (style.strikethrough !== undefined) {
      newStyle.strikethrough = style.strikethrough;
    }
    if (style.fillColor) {
      newStyle.fillColor = style.fillColor;
    }
    if (style.textColor) {
      newStyle.textColor = style.textColor;
    }
    return {
      type: "CellIsRule",
      operator: this.state.condition.operator,
      values: [this.state.condition.value1, this.state.condition.value2],
      style: newStyle,
    };
  }

  toggleMenu(tool: string) {
    const current = this.state[tool];
    this.closeMenus();
    this.state[tool] = !current;
  }

  toggleTool(tool: string) {
    this.state.style[tool] = !this.state.style[tool];
    this.closeMenus();
  }

  setColor(target: string, ev: CustomEvent) {
    const color = ev.detail.color;
    this.state.style[target] = color;
    this.closeMenus();
  }

  closeMenus() {
    this.state.textColorTool = false;
    this.state.fillColorTool = false;
  }

  /**
   * Get a default rule for "CellIsRule"
   */
  static getDefaultRule(): ConditionalFormatRule {
    return {
      type: "CellIsRule",
      operator: "IsNotEmpty",
      values: [],
      style: { fillColor: "#b6d7a8" },
    };
  }
}