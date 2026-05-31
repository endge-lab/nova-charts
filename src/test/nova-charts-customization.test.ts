import { describe, expect, it, vi } from 'vitest'
import {
  NovaChartCustomizationController,
  appendSchema,
  createNovaChartPreset,
  defineNovaChartPlugin,
  registerNovaChartPreset,
  renderWithSlot,
  resolveVisualState,
  type NovaChartRuntimeBridge,
  type NovaChartStyleContext,
} from '@/index'
import {
  normalizeChartBubbleSeriesProps,
  normalizeChartScatterSeriesProps,
} from '@/ui/shared/chart-props'

interface Row {
  id: string
  category: string
  value: number
}

const TEST_BRIDGE: NovaChartRuntimeBridge<Row> = {
  id: 'chart',
  getData: () => [],
  getScale: () => undefined,
  getSeriesMetadata: () => [],
  getInteractionState: () => ({
    pointer: null,
    hovered: null,
    tooltipVisible: false,
    revision: 0,
  }),
}

function context(part = 'bar', state: NovaChartStyleContext<Row>['state'] = 'normal'): NovaChartStyleContext<Row> {
  return {
    componentId: 'series',
    componentName: 'BarSeries',
    part,
    state,
    seriesKind: 'bar',
    tokens: {
      selection: '#f59e0b',
      palette: ['#2563eb'],
    },
    className: 'sales primary',
    attrs: {
      role: 'actual',
    },
  }
}

describe('Nova Charts customization layer', () => {
  it('resolves style precedence from preset, stylesheet, legacy props, series, state, datum and plugins', () => {
    const plugin = defineNovaChartPlugin<Row>({
      name: 'accent-plugin',
      resolveMarkStyle: (_context, style) => ({
        strokeColor: style.background,
        strokeWidth: 2,
      }),
    })
    const runtime = new NovaChartCustomizationController<Row>({
      visualPreset: 'dashboard',
      styleSheet: `
        BarSeries::bar { background: #94a3b8; opacity: 0.4; }
        BarSeries::bar:hover { background: var(--nova-chart-selection, #111827); }
        .sales[role=actual]::bar { border-radius: 6; }
        Viewport::thumb { background: #334155; border-radius: 9; }
      `,
      plugins: [plugin],
    }, TEST_BRIDGE)

    const resolved = runtime.resolveMarkStyle(context('bar', 'hovered'), {
      legacy: { background: '#2563eb', opacity: 0.72, radius: 2 },
      series: { background: '#16a34a' },
      state: { background: '#dc2626', opacity: 0.9 },
      datum: { background: '#0f172a' },
    })

    expect(resolved.background).toBe('#0f172a')
    expect(resolved.opacity).toBe(0.9)
    expect(resolved.borderRadius).toBe(6)
    expect(resolved.strokeColor).toBe('#0f172a')
    expect(resolved.strokeWidth).toBe(2)

    const viewportStyle = runtime.resolveMarkStyle({
      ...context('viewportThumb'),
      componentId: 'viewport',
      componentName: 'Viewport',
      part: 'viewportThumb',
    })
    expect(viewportStyle.background).toBe('#334155')
    expect(viewportStyle.borderRadius).toBe(9)
  })

  it('registers custom presets and preserves explicit overrides', () => {
    registerNovaChartPreset(createNovaChartPreset({
      name: 'unit-test',
      tokens: {
        selection: '#22c55e',
      },
      styles: {
        'BarSeries::bar': { background: '#64748b', opacity: 0.5 },
      },
    }))
    const runtime = new NovaChartCustomizationController<Row>({
      visualPreset: 'unit-test',
    }, TEST_BRIDGE)

    const resolved = runtime.resolveMarkStyle(context(), {
      series: { opacity: 0.95 },
    })

    expect(runtime.tokens.selection).toBe('#22c55e')
    expect(resolved.background).toBe('#64748b')
    expect(resolved.opacity).toBe(0.95)
  })

  it('supports renderer slots, including null to hide default marks', () => {
    const target = [] as any
    renderWithSlot(target, slotContext => ({
      type: 'circle',
      x: 4,
      y: 5,
      radius: slotContext.style.radius,
      styles: { background: '#2563eb' },
    }), {
      style: { radius: 8 },
    }, {
      type: 'rect',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    })

    renderWithSlot(target, () => null, { style: {} }, {
      type: 'rect',
      x: 1,
      y: 1,
      width: 10,
      height: 10,
    })

    expect(target).toHaveLength(1)
    expect(target[0].type).toBe('circle')
    expect(target[0].radius).toBe(8)
  })

  it('runs plugin setup, ordered overlays, tooltip and legend decorators, then cleanup', () => {
    const calls: Array<string> = []
    const cleanup = vi.fn()
    const runtime = new NovaChartCustomizationController<Row>({
      plugins: [
        defineNovaChartPlugin({
          name: 'second',
          order: 20,
          renderOverlay: () => {
            calls.push('second')
            return { type: 'line', x1: 0, y1: 0, x2: 1, y2: 1 }
          },
          decorateTooltip: (_context, content) => `${content}\nSecond`,
        }),
        defineNovaChartPlugin({
          name: 'first',
          order: 10,
          setup: () => cleanup,
          renderOverlay: () => {
            calls.push('first')
            return { type: 'rect', x: 0, y: 0, width: 1, height: 1 }
          },
          decorateLegend: series => series.map(item => ({ ...item, label: `Plugin ${item.label}` })),
        }),
      ],
    }, TEST_BRIDGE)

    const overlay = runtime.renderPluginLayer('overlay', {
      componentId: 'plot',
      componentName: 'Plot',
      width: 100,
      height: 80,
      runtime: TEST_BRIDGE,
      tokens: runtime.tokens,
    })
    const tooltip = runtime.decorateTooltip({
      state: TEST_BRIDGE.getInteractionState(),
      datum: {
        seriesId: 'series',
        key: 'row',
        mode: 'datum',
        value: 1,
        distancePx: 0,
      },
      label: 'A',
      value: 1,
      formattedValue: '1',
    }, 'Base')
    const legend = runtime.decorateLegend([{ id: 'a', label: 'A', color: '#000', visible: true }])

    expect(calls).toEqual(['first', 'second'])
    expect(overlay).toHaveLength(2)
    expect(tooltip).toBe('Base\nSecond')
    expect(legend[0]?.label).toBe('Plugin A')

    runtime.dispose()
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('keeps hover/selection state resolution render-only and independent from domain data', () => {
    expect(resolveVisualState('series', 'a', {
      hovered: { seriesId: 'series', key: 'a' },
    })).toBe('hovered')
    expect(resolveVisualState('series', 'a', {
      attrs: { selected: true },
    })).toBe('selected')
    expect(resolveVisualState('series', 'a', {
      attrs: { muted: true },
    })).toBe('muted')
  })

  it('keeps default point-series hover highlight from changing mark geometry', () => {
    const scatter = normalizeChartScatterSeriesProps<Row>({
      xScaleId: 'x',
      yScaleId: 'y',
      xField: 'category',
      yField: 'value',
    })
    const bubble = normalizeChartBubbleSeriesProps<Row>({
      xScaleId: 'x',
      yScaleId: 'y',
      xField: 'category',
      yField: 'value',
      sizeField: 'value',
    })

    expect(scatter.highlight.radiusDelta).toBe(0)
    expect(scatter.highlight.strokeWidth).toBe(scatter.strokeWidth)
    expect(bubble.highlight.radiusDelta).toBe(0)
    expect(bubble.highlight.strokeWidth).toBe(bubble.strokeWidth)

    const explicitScatter = normalizeChartScatterSeriesProps<Row>({
      xScaleId: 'x',
      yScaleId: 'y',
      xField: 'category',
      yField: 'value',
      highlight: {
        radiusDelta: 3,
        strokeWidth: 4,
      },
    })

    expect(explicitScatter.highlight.radiusDelta).toBe(3)
    expect(explicitScatter.highlight.strokeWidth).toBe(4)
  })

  it('appends custom schemas without growing hidden defaults', () => {
    const schema = [] as any
    appendSchema(schema, [{ type: 'rect', x: 0, y: 0, width: 1, height: 1 }])
    appendSchema(schema, null)

    expect(schema).toHaveLength(1)
  })
})
