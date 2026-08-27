import type { NovaSchema, NovaSchemaItem } from '@endge/nova'
import type {
  NovaChartCustomizationProps,
  NovaChartMarkStyle,
  NovaChartPlugin,
  NovaChartPluginRenderContext,
  NovaChartPreset,
  NovaChartResolvedMarkStyle,
  NovaChartRuntimeBridge,
  NovaChartSemanticTokens,
  NovaChartStyleContext,
  NovaChartStyleLayers,
  NovaChartStyleValue,
  NovaChartTooltipContext,
  NovaChartVisualPresetName,
  NovaChartVisualState,
} from '@/model/types/chart-components.types'
import { resolveNovaChartPreset } from '@/model/customization/chart-presets'
import { NovaChartStyleSheet } from '@/model/customization/chart-style-sheet'

export interface NovaChartCustomizationRuntime<TData = Record<string, unknown>> {
  readonly tokens: NovaChartSemanticTokens
  readonly visualPreset: NovaChartPreset<TData>
  readonly plugins: Array<NovaChartPlugin<TData>>
  resolveMarkStyle: (
    context: NovaChartStyleContext<TData>,
    layers?: NovaChartStyleLayers<TData>,
  ) => NovaChartResolvedMarkStyle
  renderPluginLayer: (
    layer: 'underlay' | 'overlay',
    context: NovaChartPluginRenderContext<TData>,
  ) => NovaSchema
  decorateTooltip: (context: NovaChartTooltipContext<TData>, content: unknown) => unknown
  decorateLegend: <TSeries>(series: Array<TSeries>) => Array<TSeries>
  notifyInteraction: (state: Parameters<NonNullable<NovaChartPlugin<TData>['onInteractionState']>>[0]) => void
  dispose: () => void
}

export class NovaChartCustomizationController<TData = Record<string, unknown>>
implements NovaChartCustomizationRuntime<TData> {
  private cleanupPlugins: Array<() => void> = []
  private styleSheet = new NovaChartStyleSheet()
  private bridge: NovaChartRuntimeBridge<TData>
  visualPreset: NovaChartPreset<TData> = resolveNovaChartPreset()
  tokens: NovaChartSemanticTokens = { ...(this.visualPreset.tokens ?? {}) }
  plugins: Array<NovaChartPlugin<TData>> = []

  constructor(
    props: NovaChartCustomizationProps<TData>,
    bridge: NovaChartRuntimeBridge<TData>,
  ) {
    this.bridge = bridge
    this.configure(props, bridge)
  }

  configure(props: NovaChartCustomizationProps<TData>, bridge: NovaChartRuntimeBridge<TData>): void {
    this.dispose()
    this.bridge = bridge
    this.visualPreset = resolveNovaChartPreset<TData>(props.visualPreset)
    this.tokens = { ...(this.visualPreset.tokens ?? {}) }
    this.styleSheet = new NovaChartStyleSheet(props.styleSheet)
    this.plugins = [...(props.plugins ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

    for (const plugin of this.plugins) {
      const cleanup = plugin.setup?.({ runtime: this.bridge, tokens: this.tokens })
      if (typeof cleanup === 'function') {
        this.cleanupPlugins.push(cleanup)
      }
    }
  }

  resolveMarkStyle(
    context: NovaChartStyleContext<TData>,
    layers: NovaChartStyleLayers<TData> = {},
  ): NovaChartResolvedMarkStyle {
    const style: NovaChartResolvedMarkStyle = {}
    const presetPartStyle = this.resolvePresetPartStyle(context)
    mergeResolvedStyle(style, resolveStyleObject(layers.defaults, context))
    mergeResolvedStyle(style, presetPartStyle)
    mergeResolvedStyle(style, this.styleSheet.resolve({ ...context, tokens: this.tokens }))
    mergeResolvedStyle(style, resolveStyleObject(layers.legacy, context))
    mergeResolvedStyle(style, resolveStyleObject(layers.part, context))
    mergeResolvedStyle(style, resolveSeriesStyle(layers.series, context))
    mergeResolvedStyle(style, resolveStyleObject(layers.state, context))
    mergeResolvedStyle(style, resolveStyleObject(layers.datum, context))

    for (const plugin of this.plugins) {
      const pluginStyle = plugin.resolveMarkStyle?.({ ...context, tokens: this.tokens }, { ...style })
      mergeResolvedStyle(style, resolveStyleObject(pluginStyle, context))
    }

    return style
  }

  renderPluginLayer(
    layer: 'underlay' | 'overlay',
    context: NovaChartPluginRenderContext<TData>,
  ): NovaSchema {
    const schema: NovaSchema = [] as unknown as NovaSchema
    for (const plugin of this.plugins) {
      const output = layer === 'underlay'
        ? plugin.renderUnderlay?.({ ...context, tokens: this.tokens })
        : plugin.renderOverlay?.({ ...context, tokens: this.tokens })
      appendSchema(schema, output)
    }
    return schema
  }

  decorateTooltip(context: NovaChartTooltipContext<TData>, content: unknown): unknown {
    let next = content
    for (const plugin of this.plugins) {
      next = plugin.decorateTooltip?.(context, next as any) ?? next
    }
    return next
  }

  decorateLegend<TSeries>(series: Array<TSeries>): Array<TSeries> {
    let next = series
    for (const plugin of this.plugins) {
      const decorated = plugin.decorateLegend?.(next as any) as Array<TSeries> | undefined
      next = decorated ?? next
    }
    return next
  }

  notifyInteraction(state: Parameters<NonNullable<NovaChartPlugin<TData>['onInteractionState']>>[0]): void {
    for (const plugin of this.plugins) {
      plugin.onInteractionState?.(state)
    }
  }

  dispose(): void {
    for (const cleanup of this.cleanupPlugins.splice(0)) {
      cleanup()
    }
  }

  private resolvePresetPartStyle(context: NovaChartStyleContext<TData>): NovaChartResolvedMarkStyle {
    const styles = this.visualPreset.styles ?? {}
    return resolveStyleObject(
      styles[`${context.componentName}::${context.part}`]
      ?? styles[`NovaCharts.${context.componentName}::${context.part}`]
      ?? styles[`*::${context.part}`]
      ?? styles[context.part],
      context,
    )
  }
}

export function defineNovaChartPlugin<TData = Record<string, unknown>>(
  plugin: NovaChartPlugin<TData>,
): NovaChartPlugin<TData> {
  return plugin
}

export function resolveVisualState(
  componentId: string,
  key: string | undefined,
  context: {
    hovered?: { seriesId?: string, key?: string } | null
    attrs?: Record<string, unknown>
    disabled?: boolean
  },
): NovaChartVisualState {
  if (context.disabled) {
    return 'disabled'
  }
  if (context.attrs?.focused === true || context.attrs?.['data-state'] === 'focused') {
    return 'focused'
  }
  if (context.attrs?.selected === true || context.attrs?.['data-state'] === 'selected') {
    return 'selected'
  }
  if (context.attrs?.muted === true || context.attrs?.['data-state'] === 'muted') {
    return 'muted'
  }
  if (context.hovered?.seriesId === componentId && (!key || context.hovered.key === key)) {
    return 'hovered'
  }
  return 'normal'
}

export function appendSchema(
  target: NovaSchema,
  input: NovaSchemaItem | NovaSchema | null | undefined,
): void {
  if (!input) {
    return
  }
  if (Array.isArray(input)) {
    target.push(...input)
  }
  else { target.push(input) }
}

export function renderWithSlot(
  target: NovaSchema,
  renderer: ((context: any) => NovaSchemaItem | NovaSchema | null | undefined) | undefined,
  context: Record<string, unknown>,
  fallback: NovaSchemaItem,
): void {
  if (!renderer) {
    target.push(fallback)
    return
  }
  const output = renderer({ ...context, defaultSchema: fallback })
  if (output === null) {
    return
  }
  appendSchema(target, output ?? fallback)
}

export function createRuntimeBridge<TData>(
  id: string,
  runtime: NovaChartRuntimeBridge<TData>,
): NovaChartRuntimeBridge<TData> {
  return {
    id,
    getData: () => runtime.getData(),
    getScale: scaleId => runtime.getScale(scaleId),
    getSeriesMetadata: () => runtime.getSeriesMetadata(),
    getInteractionState: () => runtime.getInteractionState(),
  }
}

export function normalizePresetName(name?: NovaChartVisualPresetName): NovaChartVisualPresetName {
  return name ?? 'dashboard'
}

function resolveSeriesStyle<TData>(
  value: NovaChartStyleLayers<TData>['series'],
  context: NovaChartStyleContext<TData>,
): NovaChartResolvedMarkStyle {
  if (!value) {
    return {}
  }
  const { datum: _datum, ...rest } = value
  return resolveStyleObject(rest, context)
}

function resolveStyleObject<TData>(
  style: NovaChartMarkStyle<TData> | Record<string, unknown> | null | undefined,
  context: NovaChartStyleContext<TData>,
): NovaChartResolvedMarkStyle {
  if (!style) {
    return {}
  }
  const resolved: NovaChartResolvedMarkStyle = {}
  for (const [key, value] of Object.entries(style as Record<string, unknown>)) {
    if (key === 'datum' || value === undefined) {
      continue
    }(resolved as Record<string, unknown>)[key] = resolveStyleValue(value as NovaChartStyleValue<TData>, context)
  }
  return resolved
}

function resolveStyleValue<TData>(
  value: NovaChartStyleValue<TData>,
  context: NovaChartStyleContext<TData>,
): unknown {
  if (typeof value === 'function') {
    return (value as (context: NovaChartStyleContext<TData>) => unknown)(context)
  }
  return value
}

function mergeResolvedStyle(target: NovaChartResolvedMarkStyle, source: NovaChartResolvedMarkStyle | null | undefined): void {
  if (!source) {
    return
  }
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined) {
      (target as Record<string, unknown>)[key] = value
    }
  }
}
