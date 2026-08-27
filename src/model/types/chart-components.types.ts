import type {
  NovaExportImageOptions,
  NovaExportImageResult,
  NovaSchema,
  NovaSchemaItem,
  NovaScope,
  NovaSemanticSnapshot,
  NovaSemanticSnapshotOptions,
  NovaTemplateChildSchema,
} from '@endge/nova'
import type {
  NovaScrollbarVisualOptions,
  NovaUiCommonProps,
  NovaUiCommonResolvedProps,
  TooltipAnimationOptions,
  TooltipCollisionOptions,
  TooltipContent,
  TooltipPlacement,
} from '@endge/nova-ui-kit'
import type {
  ChartBandDomain,
  ChartNumericDomain,
  ChartScale,
  ChartScaleDomain,
  ChartScaleRange,
  ChartScaleTickOptions,
  ChartScaleType,
  ChartScaleValue,
  ChartTimeTickOptions,
} from '@/model/types/chart-scale.types'

export type NovaChartFieldAccessor<TData = Record<string, unknown>, TValue = unknown>
  = | keyof TData
    | string
    | ((row: TData, index: number) => TValue)

export type NovaChartRowKey = string | number

export type NovaChartDataListener<TData = Record<string, unknown>> = (
  diagnostics: NovaChartRootDiagnostics<TData>,
) => void

export type NovaChartBarRenderMode = 'direct' | 'windowed' | 'aggregated'

export type NovaChartBarAggregationMode = 'auto' | 'avg' | 'sum' | 'min' | 'max'

export type NovaChartLineRenderMode = 'direct' | 'windowed' | 'sampled'

export type NovaChartInteractionMode = 'datum' | 'bucket'

export type NovaChartHitTestMode = 'exact' | 'nearest'

export type NovaChartSeriesKind = 'bar' | 'line' | 'area' | 'scatter' | 'bubble' | 'custom'

export type NovaChartVisualState = 'normal' | 'hovered' | 'selected' | 'muted' | 'focused' | 'disabled'

export type NovaChartPartName
  = | 'root'
    | 'plot'
    | 'bar'
    | 'barLabel'
    | 'lineSegment'
    | 'lineMarker'
    | 'areaFill'
    | 'areaOutline'
    | 'areaMarker'
    | 'scatterPoint'
    | 'bubble'
    | 'axisTick'
    | 'axisLabel'
    | 'gridLine'
    | 'legendItem'
    | 'legendSwatch'
    | 'legendLabel'
    | 'tooltipSurface'
    | 'tooltipContent'
    | 'viewportTrack'
    | 'viewportThumb'

export type NovaChartVisualPresetName
  = | 'dashboard'
    | 'editorial'
    | 'financial'
    | 'scientific'
    | 'minimal'
    | 'contrast'
    | (string & {})

export type NovaChartStyleValue<TData = Record<string, unknown>, TValue = unknown>
  = | TValue
    | ((context: NovaChartStyleContext<TData>) => TValue)

export interface NovaChartStyleContext<TData = Record<string, unknown>, TGeometry = unknown> {
  componentId: string
  componentName: string
  part: NovaChartPartName | string
  datum?: NovaChartDatumRef<TData>
  row?: TData
  rowIndex?: number
  series?: NovaChartSeriesMetadata
  seriesKind?: NovaChartSeriesKind
  state: NovaChartVisualState
  geometry?: TGeometry
  theme?: Record<string, unknown>
  tokens: NovaChartSemanticTokens
  scaleIds?: NovaChartSeriesScaleIds
  className?: string | Array<string>
  attrs?: Record<string, unknown>
}

export interface NovaChartMarkStyle<TData = Record<string, unknown>> {
  background?: NovaChartStyleValue<TData, string>
  fill?: NovaChartStyleValue<TData, string>
  color?: NovaChartStyleValue<TData, string>
  stroke?: NovaChartStyleValue<TData, string>
  strokeColor?: NovaChartStyleValue<TData, string>
  strokeWidth?: NovaChartStyleValue<TData, number>
  lineWidth?: NovaChartStyleValue<TData, number>
  width?: NovaChartStyleValue<TData, number>
  opacity?: NovaChartStyleValue<TData, number>
  radius?: NovaChartStyleValue<TData, number>
  borderRadius?: NovaChartStyleValue<TData, number>
  dashPattern?: NovaChartStyleValue<TData, Array<number>>
}

export interface NovaChartTextStyle<TData = Record<string, unknown>> {
  color?: NovaChartStyleValue<TData, string>
  fontFamily?: NovaChartStyleValue<TData, string>
  fontSize?: NovaChartStyleValue<TData, number>
  fontWeight?: NovaChartStyleValue<TData, string | number>
  lineHeight?: NovaChartStyleValue<TData, number>
  opacity?: NovaChartStyleValue<TData, number>
}

export interface NovaChartSeriesStyleOptions<TData = Record<string, unknown>>
  extends NovaChartMarkStyle<TData>, NovaChartTextStyle<TData> {
  datum?: (context: NovaChartStyleContext<TData>) => NovaChartMarkStyle<TData> | null | undefined
}

export type NovaChartStateStyleMap<TData = Record<string, unknown>>
  = Partial<Record<NovaChartVisualState, NovaChartMarkStyle<TData> & NovaChartTextStyle<TData>>>

export type NovaChartPartStyleMap<TData = Record<string, unknown>>
  = Partial<Record<NovaChartPartName | string, NovaChartMarkStyle<TData> & NovaChartTextStyle<TData>>>

export interface NovaChartSemanticTokens {
  axisColor?: string
  gridColor?: string
  textColor?: string
  background?: string
  surface?: string
  tooltipBackground?: string
  tooltipText?: string
  legendText?: string
  viewportTrack?: string
  viewportThumb?: string
  selection?: string
  mutedOpacity?: number
  palette?: Array<string>
  [token: string]: string | number | Array<string> | undefined
}

export interface NovaChartPreset<TData = Record<string, unknown>> {
  name: string
  tokens?: NovaChartSemanticTokens
  styles?: Record<string, NovaChartMarkStyle<TData> & NovaChartTextStyle<TData>>
}

export interface NovaChartMotionOptions {
  enter?: boolean | { duration?: number, easing?: string }
  update?: boolean | { duration?: number, easing?: string }
  exit?: boolean | { duration?: number, easing?: string }
  hover?: boolean | { duration?: number, easing?: string }
  selection?: boolean | { duration?: number, easing?: string }
  viewport?: boolean | { duration?: number, easing?: string }
  legend?: boolean | { duration?: number, easing?: string }
  reducedMotion?: boolean
}

export interface NovaChartRendererContext<TData = Record<string, unknown>, TGeometry = unknown>
  extends NovaChartStyleContext<TData, TGeometry> {
  defaultSchema?: NovaSchemaItem
  style: NovaChartResolvedMarkStyle
}

export type NovaChartRenderer<TData = Record<string, unknown>, TGeometry = unknown> = (
  context: NovaChartRendererContext<TData, TGeometry>,
) => NovaSchemaItem | NovaSchema | null | undefined

export interface NovaChartRenderers<TData = Record<string, unknown>> {
  bar?: NovaChartRenderer<TData, NovaChartBarLayoutItem<TData>>
  barLabel?: NovaChartRenderer<TData, NovaChartBarLayoutItem<TData>>
  lineSegment?: NovaChartRenderer<TData, NovaChartLineLayoutSegment>
  lineMarker?: NovaChartRenderer<TData, NovaChartLineLayoutPoint<TData>>
  areaFill?: NovaChartRenderer<TData, NovaChartAreaLayoutArea>
  areaOutline?: NovaChartRenderer<TData, NovaChartLineLayoutSegment>
  areaMarker?: NovaChartRenderer<TData, NovaChartAreaLayoutPoint<TData>>
  scatterPoint?: NovaChartRenderer<TData, NovaChartScatterLayoutPoint<TData>>
  bubble?: NovaChartRenderer<TData, NovaChartBubbleLayoutPoint<TData>>
  axisTick?: NovaChartRenderer<TData>
  axisLabel?: NovaChartRenderer<TData>
  legendItem?: NovaChartRenderer<TData, NovaChartSeriesMetadata>
  tooltipContent?: (context: NovaChartTooltipContext<TData>) => TooltipContent | null | undefined
}

export interface NovaChartResolvedMarkStyle {
  background?: string
  fill?: string
  color?: string
  stroke?: string
  strokeColor?: string
  strokeWidth?: number
  lineWidth?: number
  width?: number
  opacity?: number
  radius?: number
  borderRadius?: number
  dashPattern?: Array<number>
  fontFamily?: string
  fontSize?: number
  fontWeight?: string | number
  lineHeight?: number
}

export interface NovaChartStyleLayers<TData = Record<string, unknown>> {
  defaults?: NovaChartMarkStyle<TData> & NovaChartTextStyle<TData>
  legacy?: NovaChartMarkStyle<TData> & NovaChartTextStyle<TData>
  series?: NovaChartSeriesStyleOptions<TData> | null
  part?: NovaChartMarkStyle<TData> & NovaChartTextStyle<TData> | null
  state?: NovaChartMarkStyle<TData> & NovaChartTextStyle<TData> | null
  datum?: NovaChartMarkStyle<TData> & NovaChartTextStyle<TData> | null
}

export interface NovaChartPluginContext<TData = Record<string, unknown>> {
  runtime: NovaChartRuntimeBridge<TData>
  tokens: NovaChartSemanticTokens
}

export interface NovaChartPlugin<TData = Record<string, unknown>> {
  name: string
  order?: number
  setup?: (context: NovaChartPluginContext<TData>) => void | (() => void)
  resolveMarkStyle?: (
    context: NovaChartStyleContext<TData>,
    style: NovaChartResolvedMarkStyle,
  ) => NovaChartMarkStyle<TData> | null | undefined
  renderUnderlay?: (context: NovaChartPluginRenderContext<TData>) => NovaSchema | NovaSchemaItem | null | undefined
  renderOverlay?: (context: NovaChartPluginRenderContext<TData>) => NovaSchema | NovaSchemaItem | null | undefined
  decorateTooltip?: (context: NovaChartTooltipContext<TData>, content: TooltipContent | null) => TooltipContent | null
  decorateLegend?: (series: Array<NovaChartSeriesMetadata>) => Array<NovaChartSeriesMetadata>
  onInteractionState?: (state: NovaChartInteractionState<TData>) => void
}

export interface NovaChartPluginRenderContext<TData = Record<string, unknown>> {
  componentId: string
  componentName: string
  width: number
  height: number
  runtime: NovaChartRuntimeBridge<TData>
  tokens: NovaChartSemanticTokens
}

export interface NovaChartRuntimeBridge<TData = Record<string, unknown>> {
  id: string
  getData: () => ReadonlyArray<TData>
  getScale: <TValue extends ChartScaleValue = ChartScaleValue>(id: string) => ChartScale<TValue> | undefined
  getSeriesMetadata: () => Array<NovaChartSeriesMetadata>
  getInteractionState: () => NovaChartInteractionState<TData>
}

export interface NovaChartCustomizationProps<TData = Record<string, unknown>> {
  styleSheet?: string
  visualPreset?: NovaChartVisualPresetName
  plugins?: Array<NovaChartPlugin<TData>>
}

export interface NovaChartAccessibilityOptions<TData = Record<string, unknown>> {
  label?: string
  description?: string
  dataSummary?: string | ((data: ReadonlyArray<TData>) => string)
  includeVisibleMarks?: boolean
  maxMarks?: number
  keyboardNavigation?: boolean
  exposeTooltip?: boolean
  exposeLegend?: boolean
}

export interface NovaChartResolvedAccessibilityOptions<TData = Record<string, unknown>> extends NovaChartAccessibilityOptions<TData> {
  includeVisibleMarks: boolean
  maxMarks: number
  keyboardNavigation: boolean
  exposeTooltip: boolean
  exposeLegend: boolean
}

export interface NovaChartSeriesCustomizationProps<TData = Record<string, unknown>> {
  style?: NovaChartSeriesStyleOptions<TData>
  states?: NovaChartStateStyleMap<TData>
  parts?: NovaChartPartStyleMap<TData>
  renderers?: NovaChartRenderers<TData>
  motion?: any
}

export interface NovaChartSeriesCommonProps<TData = Record<string, unknown>>
  extends Omit<NovaUiCommonProps, 'style' | 'motion'>, NovaChartSeriesCustomizationProps<TData> {}

export interface NovaChartSeriesCommonResolvedProps<TData = Record<string, unknown>>
  extends Omit<NovaUiCommonResolvedProps, 'style' | 'motion'>, NovaChartSeriesCustomizationProps<TData> {
  className?: string | Array<string>
  attrs?: Record<string, unknown>
}

export type NovaChartBarOrientation = 'vertical' | 'horizontal'

export type NovaChartBarMode = 'single' | 'grouped' | 'stacked'

export type NovaChartBarLabelPosition = 'inside' | 'outside' | 'center' | 'start' | 'end'

export type NovaChartLineCurve = 'linear' | 'step'

export type NovaChartPointRenderMode = 'direct' | 'windowed' | 'sampled'

export type NovaChartAreaMode = 'single' | 'stacked'

export type NovaChartBubbleSizeScale = 'sqrt' | 'linear'

export interface NovaChartPointerState {
  x: number
  y: number
  plotX: number
  plotY: number
}

export interface NovaChartHitTestInput {
  x: number
  y: number
  mode?: NovaChartHitTestMode
  maxDistancePx?: number
}

export interface NovaChartDatumRef<TData = Record<string, unknown>> {
  seriesId: string
  seriesKind?: NovaChartSeriesKind
  key: string
  mode: NovaChartInteractionMode
  row?: TData
  value: number
  rawValue?: number
  xValue?: ChartScaleValue
  yValue?: ChartScaleValue
  label?: string
  category?: string
  seriesKey?: string
  seriesLabel?: string
  color?: string
  point?: {
    x: number
    y: number
  }
  bounds?: {
    x: number
    y: number
    width: number
    height: number
  }
  distancePx: number
}

export type NovaChartHitTestResult<TData = Record<string, unknown>> = NovaChartDatumRef<TData>

export interface NovaChartInteractionState<TData = Record<string, unknown>> {
  pointer: NovaChartPointerState | null
  hovered: NovaChartDatumRef<TData> | null
  tooltipVisible: boolean
  revision: number
}

export type NovaChartInteractionListener<TData = Record<string, unknown>> = (
  state: NovaChartInteractionState<TData>,
) => void

export interface NovaChartRootProps<TData = Record<string, unknown>> extends NovaUiCommonProps, NovaChartCustomizationProps<TData> {
  data?: Array<TData>
  keyField?: NovaChartFieldAccessor<TData, NovaChartRowKey>
  refScope?: NovaScope
  accessibility?: false | NovaChartAccessibilityOptions<TData>
}

export interface NovaChartRootResolvedProps<TData = Record<string, unknown>> extends NovaUiCommonResolvedProps, NovaChartCustomizationProps<TData> {
  data: Array<TData>
  keyField?: NovaChartFieldAccessor<TData, NovaChartRowKey>
  refScope?: NovaScope
  accessibility: false | NovaChartResolvedAccessibilityOptions<TData>
}

export interface NovaChartRootDiagnostics<TData = Record<string, unknown>> {
  rowCount: number
  scaleCount: number
  componentCount: number
  dataRevision: number
  scalesRevision: number
  lastEvent: string
  series: Record<string, NovaChartSeriesDiagnostics>
  data?: TData
}

export interface NovaChartRootApi<TData = Record<string, unknown>> {
  setData: (data: Array<TData>) => void
  getData: () => ReadonlyArray<TData>
  updateRows: (rows: Array<Partial<TData> & Record<string, unknown>>) => void
  removeRows: (keys: Array<NovaChartRowKey>) => void
  getScale: <TValue extends ChartScaleValue = ChartScaleValue>(id: string) => ChartScale<TValue> | undefined
  requireScale: <TValue extends ChartScaleValue = ChartScaleValue>(id: string) => ChartScale<TValue>
  setScaleDomain: (id: string, domain: ChartScaleDomain) => void
  setScaleRange: (id: string, range: ChartScaleRange) => void
  getScaleSourceDomain: (id: string) => ChartScaleDomain | undefined
  setScaleDomainContribution: (contribution: NovaChartScaleDomainContribution) => void
  removeScaleDomainContribution: (id: string) => void
  getScaleDomainContributions: (scaleId?: string) => Array<NovaChartScaleDomainContribution>
  refresh: () => void
  getDiagnostics: () => NovaChartRootDiagnostics<TData>
  getInteractionState: () => NovaChartInteractionState<TData>
  setInteractionState: (patch: Partial<Omit<NovaChartInteractionState<TData>, 'revision'>>) => void
  setChildren: (children: Array<NovaTemplateChildSchema>) => void
  exportChart: (options?: NovaExportImageOptions) => Promise<NovaExportImageResult>
  getSemanticSnapshot: (options?: NovaSemanticSnapshotOptions) => NovaSemanticSnapshot
  subscribe: (listener: NovaChartDataListener<TData>) => () => void
  subscribeInteraction: (listener: NovaChartInteractionListener<TData>) => () => void
}

export interface NovaChartScaleProps<TData = Record<string, unknown>> extends NovaUiCommonProps {
  scaleId?: string
  scaleType: ChartScaleType
  field?: NovaChartFieldAccessor<TData>
  domain?: ChartScaleDomain
  zero?: boolean
  nice?: boolean
  clamp?: boolean
  paddingInner?: number
  paddingOuter?: number
  locale?: string
  timezone?: string
}

export interface NovaChartScaleResolvedProps<TData = Record<string, unknown>> extends NovaUiCommonResolvedProps {
  scaleId?: string
  scaleType: ChartScaleType
  field?: NovaChartFieldAccessor<TData>
  domain?: ChartScaleDomain
  zero: boolean
  nice: boolean
  clamp: boolean
  paddingInner: number
  paddingOuter: number
  locale: string
  timezone: string
}

export interface NovaChartScaleApi {
  getScaleId: () => string
  getScale: () => ChartScale | null
  refresh: () => void
}

export interface NovaChartPlotProps extends NovaUiCommonProps {
  chartRef?: string
  xScaleId?: string
  yScaleId?: string
}

export interface NovaChartPlotResolvedProps extends NovaUiCommonResolvedProps {
  chartRef?: string
  xScaleId?: string
  yScaleId?: string
}

export interface NovaChartPlotApi {
  refresh: () => void
  setChildren: (children: Array<NovaTemplateChildSchema>) => void
  getRect: () => { x: number, y: number, width: number, height: number }
}

export interface NovaChartAxisProps extends NovaUiCommonProps {
  chartRef?: string
  scaleId: string
  orientation: 'horizontal' | 'vertical'
  tickSide?: 'start' | 'end'
  labelSide?: 'start' | 'end'
  labelRotation?: number | 'auto'
  tickSize?: number
  labelPadding?: number
  ticks?: ChartScaleTickOptions | ChartTimeTickOptions
  lineColor?: string
  tickColor?: string
  labelColor?: string
}

export interface NovaChartAxisResolvedProps extends NovaUiCommonResolvedProps {
  className?: string | Array<string>
  attrs?: Record<string, unknown>
  chartRef?: string
  scaleId: string
  orientation: 'horizontal' | 'vertical'
  tickSide: 'start' | 'end'
  labelSide: 'start' | 'end'
  labelRotation: number | 'auto'
  tickSize: number
  labelPadding: number
  ticks?: ChartScaleTickOptions | ChartTimeTickOptions
  lineColor: string
  tickColor: string
  labelColor: string
}

export interface NovaChartAxisApi {
  refresh: () => void
  getTickCount: () => number
}

export interface NovaChartGridProps extends NovaUiCommonProps {
  chartRef?: string
  xScaleId?: string
  yScaleId?: string
  xTicks?: ChartScaleTickOptions | ChartTimeTickOptions
  yTicks?: ChartScaleTickOptions | ChartTimeTickOptions
  lineColor?: string
}

export interface NovaChartGridResolvedProps extends NovaUiCommonResolvedProps {
  className?: string | Array<string>
  attrs?: Record<string, unknown>
  chartRef?: string
  xScaleId?: string
  yScaleId?: string
  xTicks?: ChartScaleTickOptions | ChartTimeTickOptions
  yTicks?: ChartScaleTickOptions | ChartTimeTickOptions
  lineColor: string
}

export interface NovaChartGridApi {
  refresh: () => void
  getLineCount: () => number
}

export interface NovaChartBarVirtualizationOptions {
  enabled?: boolean
  overscanPx?: number
  minBarWidthPx?: number
  maxRenderedBars?: number
  aggregation?: NovaChartBarAggregationMode
}

export interface NovaChartBarHighlightOptions {
  enabled?: boolean
  fill?: string
  strokeColor?: string
  strokeWidth?: number
  opacity?: number
}

export interface NovaChartBarLabelContext<TData = Record<string, unknown>> {
  row?: TData
  key: string
  value: number
  category: string
  seriesKey?: string
  seriesLabel?: string
}

export interface NovaChartBarLabelOptions<TData = Record<string, unknown>> {
  visible?: boolean
  position?: NovaChartBarLabelPosition
  color?: string
  fontSize?: number
  fontWeight?: string | number
  formatter?: (context: NovaChartBarLabelContext<TData>) => string
}

export interface NovaChartBarColorContext<TData = Record<string, unknown>> {
  row?: TData
  key: string
  value: number
  category: string
  seriesKey?: string
}

export interface NovaChartBarColorOptions<TData = Record<string, unknown>> {
  palette?: Array<string>
  colorField?: NovaChartFieldAccessor<TData>
  fill?: string | ((context: NovaChartBarColorContext<TData>) => string)
  highlight?: NovaChartBarHighlightOptions
}

export interface NovaChartBarSeriesProps<TData = Record<string, unknown>> extends NovaChartSeriesCommonProps<TData> {
  chartRef?: string
  xScaleId: string
  yScaleId: string
  xField?: NovaChartFieldAccessor<TData>
  yField?: NovaChartFieldAccessor<TData, number>
  categoryField?: NovaChartFieldAccessor<TData>
  valueField?: NovaChartFieldAccessor<TData, number>
  seriesField?: NovaChartFieldAccessor<TData>
  labelField?: NovaChartFieldAccessor<TData>
  orientation?: NovaChartBarOrientation
  mode?: NovaChartBarMode
  fill?: string
  radius?: number
  minBarSize?: number
  virtualization?: NovaChartBarVirtualizationOptions
  highlight?: NovaChartBarHighlightOptions
  labels?: NovaChartBarLabelOptions<TData>
  colors?: NovaChartBarColorOptions<TData>
}

export interface NovaChartBarSeriesResolvedProps<TData = Record<string, unknown>> extends NovaChartSeriesCommonResolvedProps<TData> {
  chartRef?: string
  xScaleId: string
  yScaleId: string
  xField?: NovaChartFieldAccessor<TData>
  yField?: NovaChartFieldAccessor<TData, number>
  categoryField: NovaChartFieldAccessor<TData>
  valueField: NovaChartFieldAccessor<TData, number>
  seriesField?: NovaChartFieldAccessor<TData>
  labelField?: NovaChartFieldAccessor<TData>
  orientation: NovaChartBarOrientation
  mode: NovaChartBarMode
  fill: string
  radius: number
  minBarSize: number
  virtualization: Required<NovaChartBarVirtualizationOptions>
  highlight: Required<NovaChartBarHighlightOptions>
  labels: Required<Omit<NovaChartBarLabelOptions<TData>, 'formatter'>> & Pick<NovaChartBarLabelOptions<TData>, 'formatter'>
  colors: Required<Omit<NovaChartBarColorOptions<TData>, 'fill' | 'colorField' | 'highlight'>>
    & Pick<NovaChartBarColorOptions<TData>, 'fill' | 'colorField' | 'highlight'>
}

export interface NovaChartBarLayoutItem<TData = Record<string, unknown>> {
  key: string
  row?: TData
  value: number
  rawValue?: number
  category: string
  seriesKey?: string
  seriesLabel?: string
  color?: string
  labelText?: string
  x: number
  y: number
  width: number
  height: number
  label?: string
}

export interface NovaChartSeriesDiagnostics {
  kind: NovaChartSeriesKind
  domainMs: number
  layoutMs: number
  schemaMs: number
  totalMs: number
}

export interface NovaChartBarSeriesDiagnostics extends NovaChartSeriesDiagnostics {
  kind: 'bar'
  inputRows: number
  visibleRows: number
  renderedBars: number
  aggregatedBuckets: number
  mode: NovaChartBarRenderMode
}

export interface NovaChartBarLayoutPlan<TData = Record<string, unknown>> {
  items: Array<NovaChartBarLayoutItem<TData>>
  orientation: NovaChartBarOrientation
  mode: NovaChartBarMode
  categories: Array<string>
  series: Array<NovaChartSeriesMetadata>
  diagnostics: NovaChartBarSeriesDiagnostics
}

export interface NovaChartBarSeriesApi<TData = Record<string, unknown>> {
  getLayoutPlan: () => NovaChartBarLayoutPlan<TData>
  getDiagnostics: () => NovaChartBarSeriesDiagnostics
  hitTest: (input: NovaChartHitTestInput) => NovaChartHitTestResult<TData> | null
  refresh: () => void
  setVirtualization: (options: NovaChartBarVirtualizationOptions) => void
}

export interface NovaChartLineVirtualizationOptions {
  enabled?: boolean
  overscanPx?: number
  maxRenderedPoints?: number
}

export interface NovaChartLineMarkerOptions<TData = Record<string, unknown>> {
  visible?: boolean
  radius?: number | ((context: NovaChartLinePointContext<TData>) => number)
  fill?: string | ((context: NovaChartLinePointContext<TData>) => string)
  strokeColor?: string | ((context: NovaChartLinePointContext<TData>) => string)
  strokeWidth?: number
}

export interface NovaChartLinePointContext<TData = Record<string, unknown>> {
  row?: TData
  rowIndex?: number
  key: string
  xValue: ChartScaleValue
  yValue: number
  seriesKey: string
  seriesLabel: string
}

export interface NovaChartLineColorContext<TData = Record<string, unknown>> extends NovaChartLinePointContext<TData> {}

export interface NovaChartLineColorOptions<TData = Record<string, unknown>> {
  palette?: Array<string>
  colorField?: NovaChartFieldAccessor<TData>
  stroke?: string | ((context: NovaChartLineColorContext<TData>) => string)
}

export interface NovaChartLineSeriesProps<TData = Record<string, unknown>> extends NovaChartSeriesCommonProps<TData> {
  chartRef?: string
  xScaleId: string
  yScaleId: string
  xField: NovaChartFieldAccessor<TData>
  yField: NovaChartFieldAccessor<TData, number>
  seriesField?: NovaChartFieldAccessor<TData>
  labelField?: NovaChartFieldAccessor<TData>
  curve?: NovaChartLineCurve
  stroke?: string
  strokeWidth?: number
  opacity?: number
  dashPattern?: Array<number>
  markers?: NovaChartLineMarkerOptions<TData>
  colors?: NovaChartLineColorOptions<TData>
  defined?: (context: NovaChartLinePointContext<TData>) => boolean
  connectNulls?: boolean
  hitRadiusPx?: number
  virtualization?: NovaChartLineVirtualizationOptions
}

export interface NovaChartLineSeriesResolvedProps<TData = Record<string, unknown>> extends NovaChartSeriesCommonResolvedProps<TData> {
  chartRef?: string
  xScaleId: string
  yScaleId: string
  xField: NovaChartFieldAccessor<TData>
  yField: NovaChartFieldAccessor<TData, number>
  seriesField?: NovaChartFieldAccessor<TData>
  labelField?: NovaChartFieldAccessor<TData>
  curve: NovaChartLineCurve
  stroke: string
  strokeWidth: number
  opacity: number
  dashPattern?: Array<number>
  markers: Required<Omit<NovaChartLineMarkerOptions<TData>, 'radius' | 'fill' | 'strokeColor'>>
    & Pick<NovaChartLineMarkerOptions<TData>, 'radius' | 'fill' | 'strokeColor'>
  colors: Required<Omit<NovaChartLineColorOptions<TData>, 'stroke' | 'colorField'>>
    & Pick<NovaChartLineColorOptions<TData>, 'stroke' | 'colorField'>
  defined?: (context: NovaChartLinePointContext<TData>) => boolean
  connectNulls: boolean
  hitRadiusPx: number
  virtualization: Required<NovaChartLineVirtualizationOptions>
}

export interface NovaChartLineLayoutPoint<TData = Record<string, unknown>> {
  key: string
  row?: TData
  rowIndex: number
  xValue: ChartScaleValue
  yValue: number
  rawValue?: number
  seriesKey: string
  seriesLabel: string
  color: string
  x: number
  y: number
}

export interface NovaChartLineLayoutSegment {
  key: string
  seriesKey: string
  color: string
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface NovaChartLineSeriesDiagnostics extends NovaChartSeriesDiagnostics {
  kind: 'line'
  inputRows: number
  visibleRows: number
  renderedPoints: number
  renderedSegments: number
  skippedRows: number
  seriesCount: number
  mode: NovaChartLineRenderMode
}

export interface NovaChartLineLayoutPlan<TData = Record<string, unknown>> {
  points: Array<NovaChartLineLayoutPoint<TData>>
  segments: Array<NovaChartLineLayoutSegment>
  series: Array<NovaChartSeriesMetadata>
  diagnostics: NovaChartLineSeriesDiagnostics
}

export interface NovaChartLineSeriesApi<TData = Record<string, unknown>> {
  getLayoutPlan: () => NovaChartLineLayoutPlan<TData>
  getDiagnostics: () => NovaChartLineSeriesDiagnostics
  hitTest: (input: NovaChartHitTestInput) => NovaChartHitTestResult<TData> | null
  refresh: () => void
  setVirtualization: (options: NovaChartLineVirtualizationOptions) => void
}

export interface NovaChartPointSeriesVirtualizationOptions {
  enabled?: boolean
  overscanPx?: number
  maxRenderedPoints?: number
}

export interface NovaChartPointSeriesResolvedVirtualizationOptions {
  enabled: boolean
  overscanPx: number
  maxRenderedPoints: number
}

export interface NovaChartPointContext<TData = Record<string, unknown>> {
  row?: TData
  rowIndex?: number
  key: string
  xValue: ChartScaleValue
  yValue: number
  seriesKey: string
  seriesLabel: string
}

export interface NovaChartScatterColorOptions<TData = Record<string, unknown>> {
  palette?: Array<string>
  colorField?: NovaChartFieldAccessor<TData>
  fill?: string | ((context: NovaChartPointContext<TData>) => string)
}

export interface NovaChartScatterHighlightOptions {
  enabled?: boolean
  fill?: string
  strokeColor?: string
  strokeWidth?: number
  opacity?: number
  radiusDelta?: number
}

export interface NovaChartScatterSeriesProps<TData = Record<string, unknown>> extends NovaChartSeriesCommonProps<TData> {
  chartRef?: string
  xScaleId: string
  yScaleId: string
  xField: NovaChartFieldAccessor<TData>
  yField: NovaChartFieldAccessor<TData, number>
  seriesField?: NovaChartFieldAccessor<TData>
  labelField?: NovaChartFieldAccessor<TData>
  radius?: number | ((context: NovaChartPointContext<TData>) => number)
  fill?: string | ((context: NovaChartPointContext<TData>) => string)
  strokeColor?: string | ((context: NovaChartPointContext<TData>) => string)
  strokeWidth?: number
  opacity?: number
  colors?: NovaChartScatterColorOptions<TData>
  highlight?: NovaChartScatterHighlightOptions
  hitRadiusPx?: number
  virtualization?: NovaChartPointSeriesVirtualizationOptions
}

export interface NovaChartScatterSeriesResolvedProps<TData = Record<string, unknown>> extends NovaChartSeriesCommonResolvedProps<TData> {
  chartRef?: string
  xScaleId: string
  yScaleId: string
  xField: NovaChartFieldAccessor<TData>
  yField: NovaChartFieldAccessor<TData, number>
  seriesField?: NovaChartFieldAccessor<TData>
  labelField?: NovaChartFieldAccessor<TData>
  radius: number | ((context: NovaChartPointContext<TData>) => number)
  fill?: string | ((context: NovaChartPointContext<TData>) => string)
  strokeColor?: string | ((context: NovaChartPointContext<TData>) => string)
  strokeWidth: number
  opacity: number
  colors: Required<Omit<NovaChartScatterColorOptions<TData>, 'fill' | 'colorField'>>
    & Pick<NovaChartScatterColorOptions<TData>, 'fill' | 'colorField'>
  highlight: Required<NovaChartScatterHighlightOptions>
  hitRadiusPx: number
  virtualization: NovaChartPointSeriesResolvedVirtualizationOptions
}

export interface NovaChartScatterLayoutPoint<TData = Record<string, unknown>> {
  key: string
  row?: TData
  rowIndex: number
  xValue: ChartScaleValue
  yValue: number
  rawValue?: number
  seriesKey: string
  seriesLabel: string
  color: string
  strokeColor?: string
  strokeWidth: number
  opacity: number
  x: number
  y: number
  radius: number
}

export interface NovaChartScatterSeriesDiagnostics extends NovaChartSeriesDiagnostics {
  kind: 'scatter'
  inputRows: number
  visibleRows: number
  renderedPoints: number
  skippedRows: number
  seriesCount: number
  mode: NovaChartPointRenderMode
}

export interface NovaChartScatterLayoutPlan<TData = Record<string, unknown>> {
  points: Array<NovaChartScatterLayoutPoint<TData>>
  series: Array<NovaChartSeriesMetadata>
  diagnostics: NovaChartScatterSeriesDiagnostics
}

export interface NovaChartScatterSeriesApi<TData = Record<string, unknown>> {
  getLayoutPlan: () => NovaChartScatterLayoutPlan<TData>
  getDiagnostics: () => NovaChartScatterSeriesDiagnostics
  hitTest: (input: NovaChartHitTestInput) => NovaChartHitTestResult<TData> | null
  refresh: () => void
  setVirtualization: (options: NovaChartPointSeriesVirtualizationOptions) => void
}

export interface NovaChartAreaMarkerOptions<TData = Record<string, unknown>> extends NovaChartLineMarkerOptions<TData> {}

export interface NovaChartAreaColorOptions<TData = Record<string, unknown>> {
  palette?: Array<string>
  colorField?: NovaChartFieldAccessor<TData>
  fill?: string | ((context: NovaChartPointContext<TData>) => string)
  stroke?: string | ((context: NovaChartPointContext<TData>) => string)
}

export interface NovaChartAreaSeriesProps<TData = Record<string, unknown>> extends NovaChartSeriesCommonProps<TData> {
  chartRef?: string
  xScaleId: string
  yScaleId: string
  xField: NovaChartFieldAccessor<TData>
  yField: NovaChartFieldAccessor<TData, number>
  seriesField?: NovaChartFieldAccessor<TData>
  labelField?: NovaChartFieldAccessor<TData>
  curve?: NovaChartLineCurve
  baselineValue?: number
  baselineField?: NovaChartFieldAccessor<TData, number>
  mode?: NovaChartAreaMode
  fill?: string
  stroke?: string
  strokeWidth?: number
  opacity?: number
  colors?: NovaChartAreaColorOptions<TData>
  markers?: NovaChartAreaMarkerOptions<TData>
  defined?: (context: NovaChartPointContext<TData>) => boolean
  connectNulls?: boolean
  hitRadiusPx?: number
  virtualization?: NovaChartPointSeriesVirtualizationOptions
}

export interface NovaChartAreaSeriesResolvedProps<TData = Record<string, unknown>> extends NovaChartSeriesCommonResolvedProps<TData> {
  chartRef?: string
  xScaleId: string
  yScaleId: string
  xField: NovaChartFieldAccessor<TData>
  yField: NovaChartFieldAccessor<TData, number>
  seriesField?: NovaChartFieldAccessor<TData>
  labelField?: NovaChartFieldAccessor<TData>
  curve: NovaChartLineCurve
  baselineValue: number
  baselineField?: NovaChartFieldAccessor<TData, number>
  mode: NovaChartAreaMode
  fill: string
  stroke: string
  strokeWidth: number
  opacity: number
  colors: Required<Omit<NovaChartAreaColorOptions<TData>, 'fill' | 'stroke' | 'colorField'>>
    & Pick<NovaChartAreaColorOptions<TData>, 'fill' | 'stroke' | 'colorField'>
  markers: Required<Omit<NovaChartAreaMarkerOptions<TData>, 'radius' | 'fill' | 'strokeColor'>>
    & Pick<NovaChartAreaMarkerOptions<TData>, 'radius' | 'fill' | 'strokeColor'>
  defined?: (context: NovaChartPointContext<TData>) => boolean
  connectNulls: boolean
  hitRadiusPx: number
  virtualization: NovaChartPointSeriesResolvedVirtualizationOptions
}

export interface NovaChartAreaLayoutPoint<TData = Record<string, unknown>> extends NovaChartLineLayoutPoint<TData> {
  baselineValue: number
  baselineY: number
  stackedBaseValue?: number
  stackedEndValue?: number
  order: number
  visible: boolean
  segmentGroup: number
}

export interface NovaChartAreaLayoutArea {
  key: string
  seriesKey: string
  color: string
  strokeColor: string
  points: Array<{ x: number, y: number }>
}

export interface NovaChartAreaSeriesDiagnostics extends NovaChartSeriesDiagnostics {
  kind: 'area'
  inputRows: number
  visibleRows: number
  renderedPoints: number
  renderedSegments: number
  renderedAreas: number
  skippedRows: number
  seriesCount: number
  mode: NovaChartPointRenderMode
  areaMode: NovaChartAreaMode
}

export interface NovaChartAreaLayoutPlan<TData = Record<string, unknown>> {
  points: Array<NovaChartAreaLayoutPoint<TData>>
  segments: Array<NovaChartLineLayoutSegment>
  areas: Array<NovaChartAreaLayoutArea>
  series: Array<NovaChartSeriesMetadata>
  diagnostics: NovaChartAreaSeriesDiagnostics
}

export interface NovaChartAreaSeriesApi<TData = Record<string, unknown>> {
  getLayoutPlan: () => NovaChartAreaLayoutPlan<TData>
  getDiagnostics: () => NovaChartAreaSeriesDiagnostics
  hitTest: (input: NovaChartHitTestInput) => NovaChartHitTestResult<TData> | null
  refresh: () => void
  setVirtualization: (options: NovaChartPointSeriesVirtualizationOptions) => void
}

export interface NovaChartBubbleColorOptions<TData = Record<string, unknown>> extends NovaChartScatterColorOptions<TData> {}

export interface NovaChartBubbleSeriesProps<TData = Record<string, unknown>> extends NovaChartSeriesCommonProps<TData> {
  chartRef?: string
  xScaleId: string
  yScaleId: string
  xField: NovaChartFieldAccessor<TData>
  yField: NovaChartFieldAccessor<TData, number>
  sizeField: NovaChartFieldAccessor<TData, number>
  seriesField?: NovaChartFieldAccessor<TData>
  labelField?: NovaChartFieldAccessor<TData>
  radiusRange?: [number, number]
  sizeScale?: NovaChartBubbleSizeScale
  minRadius?: number
  maxRadius?: number
  fill?: string | ((context: NovaChartPointContext<TData>) => string)
  strokeColor?: string | ((context: NovaChartPointContext<TData>) => string)
  strokeWidth?: number
  opacity?: number
  colors?: NovaChartBubbleColorOptions<TData>
  highlight?: NovaChartScatterHighlightOptions
  hitRadiusPx?: number
  virtualization?: NovaChartPointSeriesVirtualizationOptions
}

export interface NovaChartBubbleSeriesResolvedProps<TData = Record<string, unknown>> extends NovaChartSeriesCommonResolvedProps<TData> {
  chartRef?: string
  xScaleId: string
  yScaleId: string
  xField: NovaChartFieldAccessor<TData>
  yField: NovaChartFieldAccessor<TData, number>
  sizeField: NovaChartFieldAccessor<TData, number>
  seriesField?: NovaChartFieldAccessor<TData>
  labelField?: NovaChartFieldAccessor<TData>
  radiusRange: [number, number]
  sizeScale: NovaChartBubbleSizeScale
  minRadius: number
  maxRadius: number
  fill?: string | ((context: NovaChartPointContext<TData>) => string)
  strokeColor?: string | ((context: NovaChartPointContext<TData>) => string)
  strokeWidth: number
  opacity: number
  colors: Required<Omit<NovaChartBubbleColorOptions<TData>, 'fill' | 'colorField'>>
    & Pick<NovaChartBubbleColorOptions<TData>, 'fill' | 'colorField'>
  highlight: Required<NovaChartScatterHighlightOptions>
  hitRadiusPx: number
  virtualization: NovaChartPointSeriesResolvedVirtualizationOptions
}

export interface NovaChartBubbleLayoutPoint<TData = Record<string, unknown>> extends NovaChartScatterLayoutPoint<TData> {
  sizeValue: number
}

export interface NovaChartBubbleSeriesDiagnostics extends NovaChartSeriesDiagnostics {
  kind: 'bubble'
  inputRows: number
  visibleRows: number
  renderedBubbles: number
  skippedRows: number
  seriesCount: number
  mode: NovaChartPointRenderMode
}

export interface NovaChartBubbleLayoutPlan<TData = Record<string, unknown>> {
  points: Array<NovaChartBubbleLayoutPoint<TData>>
  series: Array<NovaChartSeriesMetadata>
  sizeDomain: [number, number]
  diagnostics: NovaChartBubbleSeriesDiagnostics
}

export interface NovaChartBubbleSeriesApi<TData = Record<string, unknown>> {
  getLayoutPlan: () => NovaChartBubbleLayoutPlan<TData>
  getDiagnostics: () => NovaChartBubbleSeriesDiagnostics
  hitTest: (input: NovaChartHitTestInput) => NovaChartHitTestResult<TData> | null
  refresh: () => void
  setVirtualization: (options: NovaChartPointSeriesVirtualizationOptions) => void
}

export interface NovaChartInteractiveSeriesApi<TData = Record<string, unknown>> {
  hitTest: (input: NovaChartHitTestInput) => NovaChartHitTestResult<TData> | null
}

export interface NovaChartInteractiveSeriesRegistration<TData = Record<string, unknown>> {
  id: string
  api: NovaChartInteractiveSeriesApi<TData>
  dirty: () => void
}

export interface NovaChartSeriesScaleIds {
  x: string
  y: string
}

export interface NovaChartSeriesMetadata {
  id: string
  kind?: NovaChartSeriesKind
  scaleIds?: NovaChartSeriesScaleIds
  sourceSeriesId?: string
  label: string
  color: string
  visible: boolean
}

export interface NovaChartScaleDomainContribution {
  id: string
  scaleId: string
  domain: ChartScaleDomain
}

export interface NovaChartInteractionProps extends NovaUiCommonProps {
  chartRef?: string
  enabled?: boolean
  hover?: boolean
  tooltip?: boolean
  mode?: NovaChartHitTestMode
  maxDistancePx?: number
  seriesIds?: Array<string>
}

export interface NovaChartInteractionResolvedProps extends NovaUiCommonResolvedProps {
  chartRef?: string
  enabled: boolean
  hover: boolean
  tooltip: boolean
  mode: NovaChartHitTestMode
  maxDistancePx: number
  seriesIds: Array<string>
}

export interface NovaChartInteractionApi {
  refresh: () => void
}

export interface NovaChartTooltipProps extends NovaUiCommonProps {
  chartRef?: string
  enabled?: boolean
  offsetX?: number
  offsetY?: number
  maxWidth?: number
  background?: string
  color?: string
  borderColor?: string
  content?: TooltipContent | null
  contentFormatter?: NovaChartTooltipContentFormatter
  labelFormatter?: (context: NovaChartTooltipContext) => string
  valueFormatter?: (context: NovaChartTooltipContext) => string
  placement?: TooltipPlacement
  collision?: TooltipCollisionOptions
  followCursor?: boolean
  animation?: false | TooltipAnimationOptions
  renderers?: Pick<NovaChartRenderers, 'tooltipContent'>
}

export interface NovaChartTooltipResolvedProps extends NovaUiCommonResolvedProps {
  className?: string | Array<string>
  attrs?: Record<string, unknown>
  chartRef?: string
  enabled: boolean
  offsetX: number
  offsetY: number
  maxWidth: number
  background: string
  color: string
  borderColor: string
  content: TooltipContent | null
  contentFormatter?: NovaChartTooltipContentFormatter
  labelFormatter?: (context: NovaChartTooltipContext) => string
  valueFormatter?: (context: NovaChartTooltipContext) => string
  placement: TooltipPlacement
  collision: Required<TooltipCollisionOptions>
  followCursor: boolean
  animation: false | Required<TooltipAnimationOptions>
  renderers?: Pick<NovaChartRenderers, 'tooltipContent'>
}

export interface NovaChartTooltipApi {
  refresh: () => void
}

export interface NovaChartTooltipContext<TData = Record<string, unknown>> {
  state: NovaChartInteractionState<TData>
  datum: NovaChartDatumRef<TData>
  label: string
  value: number
  formattedValue: string
}

export type NovaChartTooltipContentFormatter<TData = Record<string, unknown>> = (
  context: NovaChartTooltipContext<TData>,
) => TooltipContent | null

export type NovaChartViewportControllerAxis = 'auto' | 'horizontal' | 'vertical'
export type NovaChartViewportControllerPreventDefault = 'never' | 'always' | 'when-scrollable'
export type NovaChartViewportControllerEdgeBehavior = 'clamp' | 'pass-through'
export type NovaChartViewportControllerDeltaMode = 'pixel' | 'line' | 'domain'
export type NovaChartViewportControllerSource = 'wheel' | 'trackpad' | 'pointer-pan' | 'keyboard' | 'custom'
export type NovaChartViewportControllerPointerButton = 'primary' | 'middle' | 'secondary'

export interface NovaChartViewportControllerWheelOptions {
  enabled?: boolean
  axis?: NovaChartViewportControllerAxis
  useDeltaX?: boolean
  shiftYToX?: boolean
  speed?: number
  thresholdPx?: number
  preventDefault?: NovaChartViewportControllerPreventDefault
  edgeBehavior?: NovaChartViewportControllerEdgeBehavior
}

export interface NovaChartViewportControllerTrackpadOptions {
  enabled?: boolean
  preferDeltaX?: boolean
  inertia?: boolean
}

export interface NovaChartViewportControllerPointerPanOptions {
  enabled?: boolean
  button?: NovaChartViewportControllerPointerButton
  speed?: number
  cursor?: string
}

export interface NovaChartViewportControllerKeyboardOptions {
  enabled?: boolean
  step?: number
  pageStep?: number
  keys?: {
    left?: string
    right?: string
    up?: string
    down?: string
    pageLeft?: string
    pageRight?: string
    pageUp?: string
    pageDown?: string
    home?: string
    end?: string
  }
}

export interface NovaChartViewportControllerScrollbarOptions {
  drag?: boolean
  clickTrack?: false | 'jump' | 'page'
}

export interface NovaChartViewportControllerContext {
  viewport: NovaChartViewportState
  orientation: 'horizontal' | 'vertical'
  scaleId?: string
}

export interface NovaChartViewportControllerWheelIntent {
  axis: 'horizontal' | 'vertical'
  delta: number
  mode: NovaChartViewportControllerDeltaMode
  source?: NovaChartViewportControllerSource
}

export interface NovaChartViewportControllerInputState {
  source: NovaChartViewportControllerSource
  value: number
  delta: number
  consumed: boolean
  axis: 'horizontal' | 'vertical'
}

export interface NovaChartViewportControllerOptions {
  enabled?: boolean
  viewportRef?: string
  wheel?: boolean | NovaChartViewportControllerWheelOptions
  trackpad?: boolean | NovaChartViewportControllerTrackpadOptions
  pointerPan?: boolean | NovaChartViewportControllerPointerPanOptions
  keyboard?: boolean | NovaChartViewportControllerKeyboardOptions
  scrollbar?: NovaChartViewportControllerScrollbarOptions
  mapWheel?: (event: WheelEvent, context: NovaChartViewportControllerContext) => NovaChartViewportControllerWheelIntent | null
  onInput?: (state: NovaChartViewportControllerInputState, event?: Event) => void
}

export interface NovaChartViewportControllerResolvedOptions {
  enabled: boolean
  viewportRef?: string
  wheel: Required<NovaChartViewportControllerWheelOptions>
  trackpad: Required<NovaChartViewportControllerTrackpadOptions>
  pointerPan: Required<NovaChartViewportControllerPointerPanOptions>
  keyboard: Required<Omit<NovaChartViewportControllerKeyboardOptions, 'keys'>> & {
    keys: Required<NonNullable<NovaChartViewportControllerKeyboardOptions['keys']>>
  }
  scrollbar: Required<NovaChartViewportControllerScrollbarOptions>
  mapWheel?: NovaChartViewportControllerOptions['mapWheel']
  onInput?: NovaChartViewportControllerOptions['onInput']
}

export interface NovaChartViewportControllerProps extends NovaUiCommonProps, NovaChartViewportControllerOptions {
  chartRef?: string
  scaleId?: string
}

export interface NovaChartViewportControllerResolvedProps extends NovaUiCommonResolvedProps, NovaChartViewportControllerResolvedOptions {
  className?: string | Array<string>
  attrs?: Record<string, unknown>
  chartRef?: string
  scaleId?: string
}

export interface NovaChartViewportControllerApi {
  refresh: () => void
}

export interface NovaChartViewportProps extends NovaUiCommonProps {
  chartRef?: string
  scaleId: string
  orientation?: 'horizontal' | 'vertical'
  enabled?: boolean
  value?: number
  visibleCount?: number
  wheelStep?: number
  controller?: false | NovaChartViewportControllerOptions
  scrollbar?: NovaScrollbarVisualOptions
  onChange?: (state: NovaChartViewportState, event?: Event) => void
}

export interface NovaChartViewportResolvedProps extends NovaUiCommonResolvedProps {
  className?: string | Array<string>
  attrs?: Record<string, unknown>
  chartRef?: string
  scaleId: string
  orientation: 'horizontal' | 'vertical'
  enabled: boolean
  value: number
  visibleCount?: number
  wheelStep: number
  controller: false | NovaChartViewportControllerResolvedOptions
  scrollbar: NovaScrollbarVisualOptions
  onChange?: (state: NovaChartViewportState, event?: Event) => void
}

export interface NovaChartViewportState {
  value: number
  max: number
  viewportSize: number
  contentSize: number
}

export interface NovaChartViewportApi {
  scrollTo: (value: number, event?: Event) => void
  scrollBy: (delta: number, event?: Event) => void
  scrollToIndex: (index: number, event?: Event) => void
  scrollToDomain: (domain: string | Array<string>, event?: Event) => void
  canScroll: (delta?: number) => boolean
  getViewportState: () => NovaChartViewportState
  refresh: () => void
}

export interface NovaChartLegendProps extends NovaUiCommonProps {
  chartRef?: string
  orientation?: 'horizontal' | 'vertical'
  hiddenSeriesIds?: Array<string>
  labels?: Record<string, string>
}

export interface NovaChartLegendResolvedProps extends NovaUiCommonResolvedProps {
  className?: string | Array<string>
  attrs?: Record<string, unknown>
  chartRef?: string
  orientation: 'horizontal' | 'vertical'
  hiddenSeriesIds: Array<string>
  labels: Record<string, string>
}

export interface NovaChartLegendApi {
  getSeries: () => Array<NovaChartSeriesMetadata>
  refresh: () => void
}

export interface NovaChartBarChartAxisOptions {
  visible?: boolean
  width?: number
  height?: number
  ticks?: ChartScaleTickOptions | ChartTimeTickOptions
}

export interface NovaChartBarChartResolvedAxisOptions {
  visible: boolean
  width: number
  height: number
  ticks?: ChartScaleTickOptions | ChartTimeTickOptions
}

export interface NovaChartBarChartProps<TData = Record<string, unknown>>
  extends NovaUiCommonProps, NovaChartCustomizationProps<TData>, Omit<NovaChartSeriesCustomizationProps<TData>, 'style' | 'motion'> {
  data?: Array<TData>
  keyField?: NovaChartFieldAccessor<TData, NovaChartRowKey>
  categoryField: NovaChartFieldAccessor<TData>
  valueField: NovaChartFieldAccessor<TData, number>
  seriesField?: NovaChartFieldAccessor<TData>
  orientation?: NovaChartBarOrientation
  mode?: NovaChartBarMode
  axes?: {
    category?: NovaChartBarChartAxisOptions
    value?: NovaChartBarChartAxisOptions
  }
  grid?: boolean | NovaChartGridProps
  legend?: boolean | NovaChartLegendProps
  tooltip?: boolean | NovaChartTooltipProps
  interaction?: boolean | NovaChartInteractionProps
  viewport?: boolean | Omit<NovaChartViewportProps, 'scaleId'>
  colors?: NovaChartBarColorOptions<TData>
  labels?: NovaChartBarLabelOptions<TData>
  accessibility?: false | NovaChartAccessibilityOptions<TData>
  children?: Array<NovaTemplateChildSchema>
}

export interface NovaChartBarChartResolvedProps<TData = Record<string, unknown>>
  extends NovaUiCommonResolvedProps, NovaChartCustomizationProps<TData>, Omit<NovaChartSeriesCustomizationProps<TData>, 'style' | 'motion'> {
  data: Array<TData>
  keyField?: NovaChartFieldAccessor<TData, NovaChartRowKey>
  categoryField: NovaChartFieldAccessor<TData>
  valueField: NovaChartFieldAccessor<TData, number>
  seriesField?: NovaChartFieldAccessor<TData>
  orientation: NovaChartBarOrientation
  mode: NovaChartBarMode
  axes: {
    category: NovaChartBarChartResolvedAxisOptions
    value: NovaChartBarChartResolvedAxisOptions
  }
  grid: boolean | NovaChartGridProps
  legend: boolean | NovaChartLegendProps
  tooltip: boolean | NovaChartTooltipProps
  interaction: boolean | NovaChartInteractionProps
  viewport: boolean | Omit<NovaChartViewportProps, 'scaleId'>
  colors: Required<Omit<NovaChartBarColorOptions<TData>, 'fill' | 'colorField' | 'highlight'>>
    & Pick<NovaChartBarColorOptions<TData>, 'fill' | 'colorField' | 'highlight'>
  labels: Required<Omit<NovaChartBarLabelOptions<TData>, 'formatter'>> & Pick<NovaChartBarLabelOptions<TData>, 'formatter'>
  accessibility: false | NovaChartResolvedAccessibilityOptions<TData>
  children: Array<NovaTemplateChildSchema>
}

export interface NovaChartBarChartApi<TData = Record<string, unknown>> {
  setData: (data: Array<TData>) => void
  getData: () => ReadonlyArray<TData>
  refresh: () => void
  exportChart: (options?: NovaExportImageOptions) => Promise<NovaExportImageResult>
  getSemanticSnapshot: (options?: NovaSemanticSnapshotOptions) => NovaSemanticSnapshot
}

export interface NovaChartComposedChartAxisOptions {
  scaleId?: string
  scaleType?: ChartScaleType
  field?: NovaChartFieldAccessor
  domain?: ChartScaleDomain
  zero?: boolean
  nice?: boolean
  paddingInner?: number
  paddingOuter?: number
  visible?: boolean
  width?: number
  height?: number
  ticks?: ChartScaleTickOptions | ChartTimeTickOptions
}

export interface NovaChartComposedChartResolvedAxisOptions {
  scaleId: string
  scaleType: ChartScaleType
  field?: NovaChartFieldAccessor
  domain?: ChartScaleDomain
  zero: boolean
  nice: boolean
  paddingInner: number
  paddingOuter: number
  visible: boolean
  width: number
  height: number
  ticks?: ChartScaleTickOptions | ChartTimeTickOptions
}

type NovaChartComposedSeriesBase<TProps> = {
  id?: string
} & Omit<TProps, 'chartRef' | 'xScaleId' | 'yScaleId'> & {
  xScaleId?: string
  yScaleId?: string
}

export type NovaChartComposedSeriesConfig<TData = Record<string, unknown>>
  = | ({ type: 'bar' } & NovaChartComposedSeriesBase<NovaChartBarSeriesProps<TData>>)
    | ({ type: 'line' } & NovaChartComposedSeriesBase<NovaChartLineSeriesProps<TData>>)
    | ({ type: 'area' } & NovaChartComposedSeriesBase<NovaChartAreaSeriesProps<TData>>)
    | ({ type: 'scatter' } & NovaChartComposedSeriesBase<NovaChartScatterSeriesProps<TData>>)
    | ({ type: 'bubble' } & NovaChartComposedSeriesBase<NovaChartBubbleSeriesProps<TData>>)

export interface NovaChartComposedChartProps<TData = Record<string, unknown>>
  extends NovaUiCommonProps, NovaChartCustomizationProps<TData>, Omit<NovaChartSeriesCustomizationProps<TData>, 'style' | 'motion'> {
  data?: Array<TData>
  keyField?: NovaChartFieldAccessor<TData, NovaChartRowKey>
  xAxis?: NovaChartComposedChartAxisOptions
  yAxis?: NovaChartComposedChartAxisOptions
  series?: Array<NovaChartComposedSeriesConfig<TData>>
  grid?: boolean | NovaChartGridProps
  axes?: boolean | {
    x?: boolean | NovaChartAxisProps
    y?: boolean | NovaChartAxisProps
  }
  legend?: boolean | NovaChartLegendProps
  tooltip?: boolean | NovaChartTooltipProps
  interaction?: boolean | NovaChartInteractionProps
  viewport?: boolean | Omit<NovaChartViewportProps, 'scaleId'>
  accessibility?: false | NovaChartAccessibilityOptions<TData>
  children?: Array<NovaTemplateChildSchema>
}

export interface NovaChartComposedChartResolvedProps<TData = Record<string, unknown>>
  extends NovaUiCommonResolvedProps, NovaChartCustomizationProps<TData>, Omit<NovaChartSeriesCustomizationProps<TData>, 'style' | 'motion'> {
  data: Array<TData>
  keyField?: NovaChartFieldAccessor<TData, NovaChartRowKey>
  xAxis: NovaChartComposedChartResolvedAxisOptions
  yAxis: NovaChartComposedChartResolvedAxisOptions
  series: Array<NovaChartComposedSeriesConfig<TData>>
  grid: boolean | NovaChartGridProps
  axes: boolean | {
    x?: boolean | NovaChartAxisProps
    y?: boolean | NovaChartAxisProps
  }
  legend: boolean | NovaChartLegendProps
  tooltip: boolean | NovaChartTooltipProps
  interaction: boolean | NovaChartInteractionProps
  viewport: boolean | Omit<NovaChartViewportProps, 'scaleId'>
  accessibility: false | NovaChartResolvedAccessibilityOptions<TData>
  children: Array<NovaTemplateChildSchema>
}

export interface NovaChartComposedChartApi<TData = Record<string, unknown>> {
  setData: (data: Array<TData>) => void
  getData: () => ReadonlyArray<TData>
  refresh: () => void
  exportChart: (options?: NovaExportImageOptions) => Promise<NovaExportImageResult>
  getSemanticSnapshot: (options?: NovaSemanticSnapshotOptions) => NovaSemanticSnapshot
}

export interface NovaChartRootChildSchema<TProps = Record<string, unknown>> extends NovaTemplateChildSchema<TProps> {}

export type NovaChartScaleDomainInput = ChartNumericDomain | ChartBandDomain
