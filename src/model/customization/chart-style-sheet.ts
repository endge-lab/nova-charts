import type {
  NovaChartMarkStyle,
  NovaChartResolvedMarkStyle,
  NovaChartStyleContext,
  NovaChartVisualState,
} from '@/model/types/chart-components.types'

interface ChartStyleRule {
  selector: ChartStyleSelector
  style: NovaChartResolvedMarkStyle
  specificity: number
  order: number
}

interface ChartStyleSelector {
  component?: string
  part?: string
  state?: NovaChartVisualState
  id?: string
  classes: Array<string>
  attrs: Record<string, string | true>
}

const STATE_ALIASES: Record<string, NovaChartVisualState> = {
  hover: 'hovered',
  hovered: 'hovered',
  selected: 'selected',
  muted: 'muted',
  focused: 'focused',
  focus: 'focused',
  disabled: 'disabled',
}

const STYLE_PROPERTY_MAP: Record<string, keyof NovaChartResolvedMarkStyle> = {
  'background': 'background',
  'fill': 'fill',
  'color': 'color',
  'stroke': 'stroke',
  'stroke-color': 'strokeColor',
  'strokecolor': 'strokeColor',
  'stroke-width': 'strokeWidth',
  'strokewidth': 'strokeWidth',
  'line-width': 'lineWidth',
  'linewidth': 'lineWidth',
  'width': 'width',
  'opacity': 'opacity',
  'radius': 'radius',
  'border-radius': 'borderRadius',
  'borderradius': 'borderRadius',
  'dash-pattern': 'dashPattern',
  'dashpattern': 'dashPattern',
  'font-family': 'fontFamily',
  'fontfamily': 'fontFamily',
  'font-size': 'fontSize',
  'fontsize': 'fontSize',
  'font-weight': 'fontWeight',
  'fontweight': 'fontWeight',
  'line-height': 'lineHeight',
  'lineheight': 'lineHeight',
}

const PART_ALIASES: Record<string, Record<string, string>> = {
  BarSeries: { label: 'barLabel' },
  LineSeries: { segment: 'lineSegment', marker: 'lineMarker' },
  AreaSeries: {
    fill: 'areaFill',
    outline: 'areaOutline',
    marker: 'areaMarker',
  },
  ScatterSeries: { point: 'scatterPoint' },
  Axis: { tick: 'axisTick', label: 'axisLabel' },
  Grid: { line: 'gridLine' },
  Legend: { item: 'legendItem', swatch: 'legendSwatch', label: 'legendLabel' },
  Tooltip: { surface: 'tooltipSurface', content: 'tooltipContent' },
  Viewport: { track: 'viewportTrack', thumb: 'viewportThumb' },
}

export class NovaChartStyleSheet {
  private readonly _rules: Array<ChartStyleRule>
  private readonly _cache = new Map<string, NovaChartResolvedMarkStyle>()

  constructor(source?: string) {
    this._rules = parseStyleSheet(source ?? '')
  }

  resolve<TData>(
    context: NovaChartStyleContext<TData>,
  ): NovaChartResolvedMarkStyle {
    if (this._rules.length === 0) {
      return {}
    }

    const key = createCacheKey(context)
    const cached = this._cache.get(key)
    if (cached) {
      return cached
    }

    const matched = this._rules
      .filter(rule => matchesSelector(rule.selector, context))
      .sort((a, b) => a.specificity - b.specificity || a.order - b.order)
    const style: NovaChartResolvedMarkStyle = {}
    for (const rule of matched) {
      Object.assign(style, resolveTokenValues(rule.style, context))
    }

    this._cache.set(key, style)
    return style
  }
}

export function parseNovaChartStyleSheet(source?: string): NovaChartStyleSheet {
  return new NovaChartStyleSheet(source)
}

export function styleSheetToPartStyles(
  source?: string,
): Record<string, NovaChartMarkStyle> {
  const rules = parseStyleSheet(source ?? '')
  const styles: Record<string, NovaChartMarkStyle> = {}
  for (const rule of rules) {
    if (!rule.selector.part) {
      continue
    }
    styles[`${rule.selector.component ?? '*'}::${rule.selector.part}`] = {
      ...(styles[`${rule.selector.component ?? '*'}::${rule.selector.part}`]
        ?? {}),
      ...rule.style,
    }
  }
  return styles
}

function parseStyleSheet(source: string): Array<ChartStyleRule> {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '')
  const rules: Array<ChartStyleRule> = []
  let order = 0
  const blockPattern = /([^{}]+)\{([^{}]+)\}/g
  for (
    let match = blockPattern.exec(withoutComments);
    match !== null;
    match = blockPattern.exec(withoutComments)
  ) {
    const selectors = (match[1] ?? '')
      .split(',')
      .map(selector => selector.trim())
      .filter(Boolean)
    const style = parseDeclarations(match[2] ?? '')
    for (const selectorSource of selectors) {
      const selector = parseSelector(selectorSource)
      if (!selector) {
        continue
      }
      rules.push({
        selector,
        style,
        specificity: calculateSpecificity(selector),
        order: order++,
      })
    }
  }
  return rules
}

function parseSelector(source: string): ChartStyleSelector | null {
  const selector: ChartStyleSelector = { classes: [], attrs: {} }
  const attrPattern = /\[([^\]=\s]+)(?:=(["']?)([^\]"']+)\2)?\]/g
  let clean = source.trim()
  for (
    let attrMatch = attrPattern.exec(source);
    attrMatch !== null;
    attrMatch = attrPattern.exec(source)
  ) {
    const attrName = attrMatch[1]
    if (attrName) {
      selector.attrs[attrName] = attrMatch[3] ?? true
    }
  }
  clean = clean.replace(attrPattern, '')

  const classPattern = /\.([\w-]+)/g
  for (
    let classMatch = classPattern.exec(clean);
    classMatch !== null;
    classMatch = classPattern.exec(clean)
  ) {
    if (classMatch[1]) {
      selector.classes.push(classMatch[1])
    }
  }
  clean = clean.replace(classPattern, '')

  const idMatch = clean.match(/#([\w:-]+)/)
  if (idMatch) {
    selector.id = idMatch[1]
    clean = clean.replace(idMatch[0], '')
  }

  const pseudoIndex = clean.lastIndexOf(':')
  if (pseudoIndex >= 0 && clean[pseudoIndex - 1] !== ':') {
    const stateName = clean.slice(pseudoIndex + 1)
    if (stateName) {
      selector.state = STATE_ALIASES[stateName]
      clean = clean.slice(0, pseudoIndex)
    }
  }

  const cleanSelector = clean.trim()
  if (cleanSelector.includes('::')) {
    const [componentRaw, partRaw] = cleanSelector.split('::')
    const component = componentRaw?.trim()
    const part = partRaw?.trim()
    if (component) {
      selector.component = normalizeComponentName(component)
    }
    if (part) {
      selector.part = normalizePartName(selector.component, part)
    }
  }
  else if (cleanSelector) {
    selector.component = normalizeComponentName(cleanSelector)
  }

  return selector.component
    || selector.part
    || selector.id
    || selector.classes.length
    || Object.keys(selector.attrs).length
    ? selector
    : null
}

function parseDeclarations(source: string): NovaChartResolvedMarkStyle {
  const style: NovaChartResolvedMarkStyle = {}
  for (const declaration of source.split(';')) {
    const [rawName, ...rawValueParts] = declaration.split(':')
    const valueSource = rawValueParts.join(':').trim()
    if (!rawName || !valueSource) {
      continue
    }
    const property = STYLE_PROPERTY_MAP[rawName.trim().toLowerCase()]
    if (!property) {
      continue
    }
    (style as Record<string, unknown>)[property] = parseStyleValue(
      property,
      valueSource,
    )
  }
  return style
}

function parseStyleValue(
  property: keyof NovaChartResolvedMarkStyle,
  value: string,
): unknown {
  const trimmed = value.trim()
  if (trimmed.startsWith('var(')) {
    return trimmed
  }
  if (property === 'dashPattern') {
    return trimmed
      .split(/[,\s]+/)
      .map(Number)
      .filter(Number.isFinite)
  }
  if (
    property === 'opacity'
    || property === 'radius'
    || property === 'borderRadius'
    || property === 'strokeWidth'
    || property === 'lineWidth'
    || property === 'width'
    || property === 'fontSize'
    || property === 'lineHeight'
  ) {
    const numberValue = Number(trimmed.replace(/px$/, ''))
    return Number.isFinite(numberValue) ? numberValue : undefined
  }
  return trimmed.replace(/^["']|["']$/g, '')
}

function matchesSelector<TData>(
  selector: ChartStyleSelector,
  context: NovaChartStyleContext<TData>,
): boolean {
  if (
    selector.component
    && normalizeComponentName(context.componentName) !== selector.component
  ) {
    return false
  }
  if (selector.part && selector.part !== context.part) {
    return false
  }
  if (selector.state && selector.state !== context.state) {
    return false
  }
  if (selector.id && selector.id !== context.componentId) {
    return false
  }

  const classes = new Set(normalizeClassList(context.className))
  for (const className of selector.classes) {
    if (!classes.has(className)) {
      return false
    }
  }

  for (const [key, expected] of Object.entries(selector.attrs)) {
    const actual = context.attrs?.[key]
    if (expected === true) {
      if (actual === undefined || actual === false || actual === null) {
        return false
      }
      continue
    }
    if (String(actual) !== expected) {
      return false
    }
  }

  return true
}

function resolveTokenValues<TData>(
  style: NovaChartResolvedMarkStyle,
  context: NovaChartStyleContext<TData>,
): NovaChartResolvedMarkStyle {
  const next: NovaChartResolvedMarkStyle = {}
  for (const [key, value] of Object.entries(style)) {
    (next as Record<string, unknown>)[key]
      = typeof value === 'string' ? resolveTokenValue(value, context) : value
  }
  return next
}

function resolveTokenValue<TData>(
  value: string,
  context: NovaChartStyleContext<TData>,
): string {
  const match = value.match(/^var\((--[\w-]+)(?:,\s*(.+))?\)$/)
  if (!match) {
    return value
  }
  const rawTokenName = match[1] ?? ''
  const tokenName = rawTokenName.replace(/^--nova-chart-/, '')
  const normalized = tokenName.replace(/-([a-z])/g, (_, char: string) =>
    char.toUpperCase())
  const fallback = match[2]?.trim().replace(/^["']|["']$/g, '')
  const tokenValue = context.tokens[normalized] ?? context.tokens[rawTokenName]
  return typeof tokenValue === 'string' ? tokenValue : (fallback ?? value)
}

function calculateSpecificity(selector: ChartStyleSelector): number {
  return (
    (selector.id ? 100 : 0)
    + selector.classes.length * 10
    + Object.keys(selector.attrs).length * 10
    + (selector.state ? 10 : 0)
    + (selector.component ? 1 : 0)
    + (selector.part ? 1 : 0)
  )
}

function createCacheKey<TData>(context: NovaChartStyleContext<TData>): string {
  return [
    context.componentName,
    context.componentId,
    context.part,
    context.state,
    normalizeClassList(context.className).join('.'),
    Object.entries(context.attrs ?? {})
      .map(([key, value]) => `${key}=${String(value)}`)
      .sort()
      .join('&'),
    JSON.stringify(context.tokens),
  ].join('|')
}

function normalizeComponentName(value?: string): string | undefined {
  if (!value) {
    return undefined
  }
  return value.replace(/^NovaCharts\./, '')
}

function normalizePartName(
  component: string | undefined,
  part: string,
): string {
  return PART_ALIASES[component ?? '']?.[part] ?? part
}

function normalizeClassList(className?: string | Array<string>): Array<string> {
  if (Array.isArray(className)) {
    return className.flatMap(item => item.split(/\s+/)).filter(Boolean)
  }
  return className?.split(/\s+/).filter(Boolean) ?? []
}
