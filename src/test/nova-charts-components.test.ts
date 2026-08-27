// @vitest-environment jsdom

import type { NovaApp, NovaComponentDescriptor, NovaComponentSchema, NovaNode, NovaSurface } from '@endge/nova'
import type { NovaChartBarChartApi, NovaChartBarSeriesApi, NovaChartDatumRef, NovaChartHitTestInput, NovaChartLegendApi, NovaChartLineSeriesApi, NovaChartRootApi, NovaChartTooltipContext, NovaChartViewportApi, NovaChartViewportControllerApi } from '@/index'
import {
  Nova,

  RaphSchedulerType,
  RendererType,
} from '@endge/nova'
import { NovaUiComponentNode, NovaUIKit, registerNovaUIKit } from '@endge/nova-ui-kit'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {

  NovaCharts,

  registerNovaCharts,
} from '@/index'
import { NOVA_CHARTS_COMMON_DIRTY_POLICY } from '@/ui/shared/chart-props'
import { resolveNovaChartRuntime } from '@/ui/shared/chart-runtime-resolver'

interface Row {
  id: string
  category: string
  value: number
}

interface SeriesRow extends Row {
  series: string
}

interface LineRow extends Row {
  series?: string
  forecast?: number | null
}

type TestEvents = Record<string, any>

interface TestMixedSeriesProps {
  width?: number
  height?: number
  xScaleId: string
  yScaleId: string
  xDomain: Array<string>
  yDomain: [number, number]
  seriesId: string
  label: string
  color: string
  hit?: {
    x: number
    y: number
    key: string
    value: number
  }
}

const TEST_MIXED_SERIES_TYPE = 'Test.MixedSeries'

const TEST_MIXED_SERIES_DESCRIPTOR: NovaComponentDescriptor<
  TestMixedSeriesProps,
  { refresh: () => void },
  Record<string, never>,
  TestMixedSeriesProps
> = {
  type: TEST_MIXED_SERIES_TYPE,
  name: TEST_MIXED_SERIES_TYPE,
  title: TEST_MIXED_SERIES_TYPE,
  version: '0.1.0',
  kind: 'node-component',
  dirtyPolicy: NOVA_CHARTS_COMMON_DIRTY_POLICY,
  normalize: schema => schema.props as TestMixedSeriesProps,
  createNode: (context, schema: NovaComponentSchema<TestMixedSeriesProps>) => new TestMixedSeries(
    context.app,
    context.surface,
    schema.props as TestMixedSeriesProps,
    { componentId: schema.id },
  ),
}

class TestMixedSeries extends NovaUiComponentNode<
  TestMixedSeriesProps,
  { refresh: () => void },
  TestMixedSeriesProps,
  TestEvents
> {
  private readonly api = {
    refresh: () => this.dirty({ update: true, render: true }),
  }

  /**
   * Создает тестовую mixed-series, которая имитирует будущий LineSeries.
   */
  constructor(
    app: NovaApp<TestEvents>,
    surface: NovaSurface<TestEvents>,
    props: TestMixedSeriesProps,
    options: { componentId?: string } = {},
  ) {
    super(app, surface, TEST_MIXED_SERIES_DESCRIPTOR as any, props, { componentId: options.componentId })
  }

  override getApi(): { refresh: () => void } {
    return this.api
  }

  update(): void {
    const runtime = resolveNovaChartRuntime<Record<string, unknown>>(this)
    if (!runtime) {
      return
    }
    runtime.setScaleDomainContribution({
      id: `${this.componentId}:x`,
      scaleId: this.props.xScaleId,
      domain: this.props.xDomain,
    })
    runtime.setScaleDomainContribution({
      id: `${this.componentId}:y`,
      scaleId: this.props.yScaleId,
      domain: this.props.yDomain,
    })
    runtime.setSeriesMetadata(this.componentId, [{
      id: this.props.seriesId,
      kind: 'line',
      sourceSeriesId: this.componentId,
      scaleIds: {
        x: this.props.xScaleId,
        y: this.props.yScaleId,
      },
      label: this.props.label,
      color: this.props.color,
      visible: true,
    }])
    runtime.registerInteractiveSeries({
      id: this.componentId,
      api: {
        hitTest: input => this.hitTest(input),
      },
      dirty: () => this.dirty({ render: true }),
    })
  }

  render(): void {}

  protected override onUnmount(): void {
    const runtime = resolveNovaChartRuntime<Record<string, unknown>>(this)
    runtime?.unregisterInteractiveSeries(this.componentId)
    runtime?.removeScaleDomainContribution(`${this.componentId}:x`)
    runtime?.removeScaleDomainContribution(`${this.componentId}:y`)
    super.onUnmount()
  }

  private hitTest(input: NovaChartHitTestInput): NovaChartDatumRef<Record<string, unknown>> | null {
    const hit = this.props.hit
    if (!hit) {
      return null
    }
    const distancePx = Math.hypot(hit.x - input.x, hit.y - input.y)
    if (distancePx > (input.maxDistancePx ?? 16)) {
      return null
    }
    return {
      seriesId: this.componentId,
      seriesKind: 'line',
      key: hit.key,
      mode: 'datum',
      value: hit.value,
      xValue: hit.key,
      yValue: hit.value,
      label: this.props.label,
      color: this.props.color,
      point: {
        x: hit.x,
        y: hit.y,
      },
      distancePx,
    }
  }
}

function installCanvasMocks(): void {
  Object.defineProperty(window, 'devicePixelRatio', {
    value: 1,
    configurable: true,
  })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((type: string) => {
    if (type === RendererType.Web2D) {
      return create2DContextStub()
    }
    return null
  })
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation((mime?: string) => {
    return `data:${mime ?? 'image/png'};base64,ZmFrZQ==`
  })
}

function create2DContextStub(): CanvasRenderingContext2D {
  const state: Record<PropertyKey, any> = {
    measureText: vi.fn((text: string) => ({ width: text.length * 7 })),
    createPattern: vi.fn(() => ({})),
  }
  return new Proxy(state, {
    /**
     * Возвращает значение состояния текущего класса.
     */
    get(target, prop) {
      if (!(prop in target)) {
        target[prop] = vi.fn()
      }
      return target[prop]
    },
    /**
     * Обновляет значение состояния текущего класса.
     */
    set(target, prop, value) {
      target[prop] = value
      return true
    },
  }) as CanvasRenderingContext2D
}

function createApp(): NovaApp<TestEvents> {
  const canvas = document.createElement('canvas')
  document.body.appendChild(canvas)
  const app = Nova.createApp<TestEvents>({
    target: canvas,
    size: { width: 900, height: 560, dpr: 1 },
    renderer: { main: RendererType.Web2D },
    scheduler: { type: RaphSchedulerType.Sync, loop: false },
  })
  registerNovaUIKit(app.schema)
  registerNovaCharts(app.schema)
  app.schema.register(TEST_MIXED_SERIES_DESCRIPTOR, { override: true })
  return app
}

function rows(count: number): Array<Row> {
  return Array.from({ length: count }, (_item, index) => ({
    id: `row-${index}`,
    category: `C${index}`,
    value: (index % 97) + 1,
  }))
}

function seriesRows(): Array<SeriesRow> {
  return [
    { id: 'a-q1', category: 'Q1', series: 'A', value: 12 },
    { id: 'b-q1', category: 'Q1', series: 'B', value: 8 },
    { id: 'a-q2', category: 'Q2', series: 'A', value: 16 },
    { id: 'b-q2', category: 'Q2', series: 'B', value: 7 },
    { id: 'a-q3', category: 'Q3', series: 'A', value: 6 },
    { id: 'b-q3', category: 'Q3', series: 'B', value: 14 },
  ]
}

function mountChart(app: NovaApp<TestEvents>, data: Array<Row>, width = 900, height = 420): void {
  const surface = app.createSurface('chart-test')
  app.schema.createNode(surface, {
    type: NovaUIKit.Root,
    id: 'ui-root',
    props: { width, height },
    children: [
      {
        type: NovaCharts.Root,
        id: 'chart',
        props: {
          width,
          height,
          data,
          keyField: 'id',
        },
        children: [
          {
            type: NovaCharts.Scale,
            id: 'x-scale',
            props: {
              scaleId: 'x',
              scaleType: 'band',
              field: 'category',
              paddingInner: 0.12,
            },
          },
          {
            type: NovaCharts.Scale,
            id: 'y-scale',
            props: {
              scaleId: 'y',
              scaleType: 'linear',
              field: 'value',
              zero: true,
              nice: false,
            },
          },
          {
            type: NovaCharts.Plot,
            id: 'plot',
            props: {
              xScaleId: 'x',
              yScaleId: 'y',
              width,
              height,
            },
            children: [
              {
                type: NovaCharts.Grid,
                id: 'grid',
                props: {
                  xScaleId: 'x',
                  yScaleId: 'y',
                  xTicks: { minStepPx: 80, maxCount: 12 },
                },
              },
              {
                type: NovaCharts.BarSeries,
                id: 'series',
                props: {
                  xScaleId: 'x',
                  yScaleId: 'y',
                  xField: 'category',
                  yField: 'value',
                  fill: '#2563eb',
                },
              },
            ],
          },
          {
            type: NovaCharts.Axis,
            id: 'x-axis',
            props: {
              scaleId: 'x',
              orientation: 'horizontal',
              ticks: { minStepPx: 80, maxCount: 12 },
            },
          },
        ],
      },
    ],
  })
  app.raph.run()
  app.raph.run()
}

function mountInteractiveChart(app: NovaApp<TestEvents>, data: Array<Row>, width = 900, height = 420): void {
  const surface = app.createSurface('chart-interaction-test')
  app.schema.createNode(surface, {
    type: NovaUIKit.Root,
    id: 'ui-root',
    props: { width, height },
    children: [
      {
        type: NovaCharts.Root,
        id: 'chart',
        props: {
          width,
          height,
          data,
          keyField: 'id',
        },
        children: [
          {
            type: NovaCharts.Scale,
            id: 'x-scale',
            props: {
              scaleId: 'x',
              scaleType: 'band',
              field: 'category',
              paddingInner: 0.12,
            },
          },
          {
            type: NovaCharts.Scale,
            id: 'y-scale',
            props: {
              scaleId: 'y',
              scaleType: 'linear',
              field: 'value',
              zero: true,
              nice: false,
            },
          },
          {
            type: NovaCharts.Plot,
            id: 'plot',
            props: {
              xScaleId: 'x',
              yScaleId: 'y',
              width,
              height,
            },
            children: [
              {
                type: NovaCharts.BarSeries,
                id: 'series',
                props: {
                  xScaleId: 'x',
                  yScaleId: 'y',
                  xField: 'category',
                  yField: 'value',
                  fill: '#2563eb',
                  highlight: {
                    enabled: true,
                    fill: '#1d4ed8',
                    strokeWidth: 1,
                  },
                },
              },
              {
                type: NovaCharts.Interaction,
                id: 'interaction',
                props: {
                  enabled: true,
                  hover: true,
                  tooltip: true,
                },
              },
              {
                type: NovaCharts.Tooltip,
                id: 'tooltip',
                props: {
                  enabled: true,
                },
              },
            ],
          },
        ],
      },
    ],
  })
  app.raph.run()
  app.raph.run()
}

function mountViewportChart(app: NovaApp<TestEvents>, data: Array<Row>, width = 720, height = 320): void {
  const surface = app.createSurface('chart-viewport-test')
  app.schema.createNode(surface, {
    type: NovaUIKit.Root,
    id: 'ui-root',
    props: { width, height },
    children: [
      {
        type: NovaCharts.Root,
        id: 'chart',
        props: {
          width,
          height,
          data,
          keyField: 'id',
        },
        children: [
          {
            type: NovaCharts.Scale,
            id: 'x-scale',
            props: {
              scaleId: 'x',
              scaleType: 'band',
              field: 'category',
            },
          },
          {
            type: NovaCharts.Scale,
            id: 'y-scale',
            props: {
              scaleId: 'y',
              scaleType: 'linear',
              field: 'value',
              zero: true,
            },
          },
          {
            type: NovaCharts.Plot,
            id: 'plot',
            props: { xScaleId: 'x', yScaleId: 'y', width, height: height - 20 },
            children: [
              {
                type: NovaCharts.BarSeries,
                id: 'series',
                props: {
                  xScaleId: 'x',
                  yScaleId: 'y',
                  xField: 'category',
                  yField: 'value',
                },
              },
            ],
          },
          {
            type: NovaCharts.Viewport,
            id: 'viewport',
            props: {
              scaleId: 'x',
              orientation: 'horizontal',
              visibleCount: 10,
              wheelStep: 5,
            },
          },
        ],
      },
    ],
  })
  app.raph.run()
  app.raph.run()
}

function mountViewportControllerChart(
  app: NovaApp<TestEvents>,
  data: Array<Row>,
  controllerProps: Record<string, unknown> = {},
  width = 720,
  height = 320,
): void {
  const surface = app.createSurface('chart-viewport-controller-test')
  app.schema.createNode(surface, {
    type: NovaUIKit.Root,
    id: 'ui-root',
    props: { width, height },
    children: [
      {
        type: NovaCharts.Root,
        id: 'chart',
        props: {
          width,
          height,
          data,
          keyField: 'id',
        },
        children: [
          {
            type: NovaCharts.Scale,
            id: 'x-scale',
            props: { scaleId: 'x', scaleType: 'band', field: 'category' },
          },
          {
            type: NovaCharts.Scale,
            id: 'y-scale',
            props: { scaleId: 'y', scaleType: 'linear', field: 'value', zero: true },
          },
          {
            type: NovaCharts.Plot,
            id: 'plot',
            props: { xScaleId: 'x', yScaleId: 'y', width, height: height - 20 },
            children: [
              {
                type: NovaCharts.BarSeries,
                id: 'series',
                props: {
                  xScaleId: 'x',
                  yScaleId: 'y',
                  xField: 'category',
                  yField: 'value',
                },
              },
              {
                type: NovaCharts.Interaction,
                id: 'interaction',
                props: { enabled: true, hover: true, tooltip: true },
              },
              {
                type: NovaCharts.ViewportController,
                id: 'viewport-controller',
                props: {
                  scaleId: 'x',
                  viewportRef: 'viewport',
                  ...controllerProps,
                },
              },
            ],
          },
          {
            type: NovaCharts.Viewport,
            id: 'viewport',
            props: {
              scaleId: 'x',
              orientation: 'horizontal',
              visibleCount: 10,
              wheelStep: 5,
              controller: controllerProps,
            },
          },
        ],
      },
    ],
  })
  app.raph.run()
  app.raph.run()
}

function mountSeriesChart(
  app: NovaApp<TestEvents>,
  props: Record<string, unknown>,
  data: Array<SeriesRow> = seriesRows(),
  width = 720,
  height = 320,
): void {
  const horizontal = props.orientation === 'horizontal'
  const surface = app.createSurface('chart-series-test')
  app.schema.createNode(surface, {
    type: NovaUIKit.Root,
    id: 'ui-root',
    props: { width, height },
    children: [
      {
        type: NovaCharts.Root,
        id: 'chart',
        props: {
          width,
          height,
          data,
          keyField: 'id',
        },
        children: [
          {
            type: NovaCharts.Scale,
            id: 'x-scale',
            props: {
              scaleId: 'x',
              scaleType: horizontal ? 'linear' : 'band',
              field: horizontal ? 'value' : 'category',
              domain: horizontal ? [0, 30] : ['Q1', 'Q2', 'Q3'],
              zero: horizontal,
            },
          },
          {
            type: NovaCharts.Scale,
            id: 'y-scale',
            props: {
              scaleId: 'y',
              scaleType: horizontal ? 'band' : 'linear',
              field: horizontal ? 'category' : 'value',
              domain: horizontal ? ['Q1', 'Q2', 'Q3'] : [0, 30],
              zero: !horizontal,
            },
          },
          {
            type: NovaCharts.Plot,
            id: 'plot',
            props: { xScaleId: 'x', yScaleId: 'y', width, height },
            children: [
              {
                type: NovaCharts.BarSeries,
                id: 'series',
                props: {
                  xScaleId: 'x',
                  yScaleId: 'y',
                  categoryField: 'category',
                  valueField: 'value',
                  seriesField: 'series',
                  colors: {
                    palette: ['#0ea5e9', '#f97316'],
                  },
                  ...props,
                },
              },
              {
                type: NovaCharts.Legend,
                id: 'legend',
                props: {
                  labels: { A: 'Alpha', B: 'Beta' },
                },
              },
            ],
          },
        ],
      },
    ],
  })
  app.raph.run()
  app.raph.run()
}

function mountBarChart(app: NovaApp<TestEvents>, data: Array<SeriesRow> = seriesRows(), props: Record<string, unknown> = {}): void {
  const surface = app.createSurface('chart-wrapper-test')
  app.schema.createNode(surface, {
    type: NovaUIKit.Root,
    id: 'ui-root',
    props: { width: 760, height: 360 },
    children: [
      {
        type: NovaCharts.BarChart,
        id: 'bar-chart',
        props: {
          width: 760,
          height: 360,
          data,
          keyField: 'id',
          categoryField: 'category',
          valueField: 'value',
          seriesField: 'series',
          mode: 'grouped',
          viewport: { visibleCount: 2 },
          tooltip: {
            contentFormatter: (context: NovaChartTooltipContext<SeriesRow>) => ({
              text: `${context.datum.seriesLabel}: ${context.formattedValue}`,
            }),
          },
          labels: {
            visible: true,
            position: 'outside',
          },
          colors: {
            palette: ['#0284c7', '#ea580c'],
          },
          ...props,
        },
      },
    ],
  })
  app.raph.run()
  app.raph.run()
}

function mountMixedCoreChart(app: NovaApp<TestEvents>): void {
  const width = 720
  const height = 320
  const surface = app.createSurface('chart-mixed-core-test')
  app.schema.createNode(surface, {
    type: NovaUIKit.Root,
    id: 'ui-root',
    props: { width, height },
    children: [
      {
        type: NovaCharts.Root,
        id: 'chart',
        props: {
          width,
          height,
          data: [
            { id: 'bar-a', category: 'A', value: 10 },
            { id: 'bar-b', category: 'B', value: 20 },
          ],
          keyField: 'id',
        },
        children: [
          {
            type: NovaCharts.Scale,
            id: 'x-scale',
            props: {
              scaleId: 'x',
              scaleType: 'band',
              field: 'category',
            },
          },
          {
            type: NovaCharts.Scale,
            id: 'y-scale',
            props: {
              scaleId: 'y',
              scaleType: 'linear',
              zero: true,
              nice: false,
            },
          },
          {
            type: NovaCharts.Plot,
            id: 'plot',
            props: { xScaleId: 'x', yScaleId: 'y', width, height },
            children: [
              {
                type: NovaCharts.BarSeries,
                id: 'bars',
                props: {
                  xScaleId: 'x',
                  yScaleId: 'y',
                  categoryField: 'category',
                  valueField: 'value',
                  fill: '#2563eb',
                },
              },
              {
                type: TEST_MIXED_SERIES_TYPE,
                id: 'line-like',
                props: {
                  xScaleId: 'x',
                  yScaleId: 'y',
                  xDomain: ['B', 'C'],
                  yDomain: [5, 45],
                  seriesId: 'forecast',
                  label: 'Forecast',
                  color: '#f97316',
                  hit: {
                    x: 16,
                    y: 18,
                    key: 'C',
                    value: 45,
                  },
                },
              },
              {
                type: NovaCharts.Interaction,
                id: 'interaction',
                props: {
                  enabled: true,
                  hover: true,
                  tooltip: true,
                  mode: 'nearest',
                  maxDistancePx: 24,
                },
              },
              {
                type: NovaCharts.Legend,
                id: 'legend',
                props: {},
              },
            ],
          },
          {
            type: NovaCharts.Viewport,
            id: 'viewport',
            props: {
              scaleId: 'x',
              orientation: 'horizontal',
              visibleCount: 2,
            },
          },
        ],
      },
    ],
  })
  app.raph.run()
  app.raph.run()
}

function mountLineSeriesChart(
  app: NovaApp<TestEvents>,
  data: Array<LineRow> = [
    { id: 'actual-q1', category: 'Q1', series: 'Actual', value: 10 },
    { id: 'actual-q2', category: 'Q2', series: 'Actual', value: 16 },
    { id: 'actual-q3', category: 'Q3', series: 'Actual', value: 12 },
    { id: 'plan-q1', category: 'Q1', series: 'Plan', value: 8 },
    { id: 'plan-q2', category: 'Q2', series: 'Plan', value: 14 },
    { id: 'plan-q3', category: 'Q3', series: 'Plan', value: 20 },
  ],
  lineProps: Record<string, unknown> = {},
): void {
  const width = 720
  const height = 320
  const surface = app.createSurface('chart-line-test')
  app.schema.createNode(surface, {
    type: NovaUIKit.Root,
    id: 'ui-root',
    props: { width, height },
    children: [
      {
        type: NovaCharts.Root,
        id: 'chart',
        props: {
          width,
          height,
          data,
          keyField: 'id',
        },
        children: [
          {
            type: NovaCharts.Scale,
            id: 'x-scale',
            props: {
              scaleId: 'x',
              scaleType: 'band',
              field: 'category',
              paddingInner: 0.12,
            },
          },
          {
            type: NovaCharts.Scale,
            id: 'y-scale',
            props: {
              scaleId: 'y',
              scaleType: 'linear',
              field: 'value',
              zero: true,
              nice: false,
            },
          },
          {
            type: NovaCharts.Plot,
            id: 'plot',
            props: { xScaleId: 'x', yScaleId: 'y', width, height },
            children: [
              {
                type: NovaCharts.LineSeries,
                id: 'line',
                props: {
                  xScaleId: 'x',
                  yScaleId: 'y',
                  xField: 'category',
                  yField: 'value',
                  seriesField: 'series',
                  markers: { visible: true },
                  colors: {
                    palette: ['#ea580c', '#0ea5e9'],
                  },
                  ...lineProps,
                },
              },
              {
                type: NovaCharts.Interaction,
                id: 'interaction',
                props: {
                  enabled: true,
                  hover: true,
                  tooltip: true,
                  mode: 'nearest',
                  maxDistancePx: 24,
                },
              },
              {
                type: NovaCharts.Tooltip,
                id: 'tooltip',
                props: {
                  enabled: true,
                },
              },
              {
                type: NovaCharts.Legend,
                id: 'legend',
                props: {
                  labels: { Actual: 'Факт', Plan: 'План' },
                },
              },
            ],
          },
        ],
      },
    ],
  })
  app.raph.run()
  app.raph.run()
}

describe('nova Charts components', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
    installCanvasMocks()
  })

  it('registers root scales and exposes runtime API', () => {
    const app = createApp()
    mountChart(app, rows(4))

    const root = app.components.requireApi<NovaChartRootApi<Row>>('chart')
    expect(root.getData()).toHaveLength(4)
    expect(root.requireScale('x').getDomain()).toEqual(['C0', 'C1', 'C2', 'C3'])
    expect(root.requireScale('y').getDomain()).toEqual([0, 4])
    expect(root.getDiagnostics().scaleCount).toBe(2)
  })

  it('updates scale ranges from Plot layout rect', () => {
    const app = createApp()
    mountChart(app, rows(10), 640, 320)

    const root = app.components.requireApi<NovaChartRootApi<Row>>('chart')
    expect(root.requireScale('x').getRange()).toEqual([0, 640])
    expect(root.requireScale('y').getRange()).toEqual([320, 0])
  })

  it('shares scale ticks between Axis and Grid', () => {
    const app = createApp()
    mountChart(app, rows(20), 800, 360)

    const axis = app.components.requireApi<{ getTickCount: () => number }>('x-axis')
    const grid = app.components.requireApi<{ getLineCount: () => number }>('grid')

    expect(axis.getTickCount()).toBeGreaterThan(0)
    expect(grid.getLineCount()).toBeGreaterThanOrEqual(axis.getTickCount())
  })

  it('computes direct bar layout for small data', () => {
    const app = createApp()
    mountChart(app, rows(3), 600, 300)

    const series = app.components.requireApi<NovaChartBarSeriesApi<Row>>('series')
    const plan = series.getLayoutPlan()

    expect(plan.diagnostics.mode).toBe('direct')
    expect(plan.items).toHaveLength(3)
    expect(plan.items[0].x).toBeGreaterThanOrEqual(0)
    expect(plan.items[0].height).toBeGreaterThan(0)
  })

  it('aggregates huge category domains into bounded buckets', () => {
    const app = createApp()
    mountChart(app, rows(100_000), 900, 360)

    const series = app.components.requireApi<NovaChartBarSeriesApi<Row>>('series')
    const diagnostics = series.getDiagnostics()

    expect(diagnostics.mode).toBe('aggregated')
    expect(diagnostics.renderedBars).toBeLessThanOrEqual(20_000)
    expect(diagnostics.renderedBars).toBeLessThan(100_000)
  })

  it('updates and removes rows through root API indexes', () => {
    const app = createApp()
    mountChart(app, rows(5))
    const root = app.components.requireApi<NovaChartRootApi<Row>>('chart')

    root.updateRows([{ id: 'row-2', value: 120 }, { id: 'row-5', category: 'C5', value: 8 }])
    root.removeRows(['row-0'])
    app.raph.run()
    app.raph.run()

    expect(root.getData()).toHaveLength(5)
    expect(root.requireScale('y').getDomain()).toEqual([0, 120])
    expect(root.requireScale('x').getDomain()).toContain('C5')
  })

  it('allows external components to read a root scale through chartRef', () => {
    const app = createApp()
    mountChart(app, rows(8))

    const surface = app.createSurface('external-axis')
    app.schema.createNode(surface, {
      type: NovaUIKit.Root,
      id: 'external-root',
      children: [
        {
          type: NovaCharts.Axis,
          id: 'external-axis-node',
          props: {
            chartRef: 'chart',
            scaleId: 'x',
            orientation: 'horizontal',
          },
        },
      ],
    })
    app.raph.run()
    app.raph.run()

    const axis = app.components.requireApi<{ getTickCount: () => number }>('external-axis-node')
    expect(axis.getTickCount()).toBeGreaterThan(0)
  })

  it('stores and publishes interaction state from root API', () => {
    const app = createApp()
    mountInteractiveChart(app, rows(4))
    const root = app.components.requireApi<NovaChartRootApi<Row>>('chart')
    const listener = vi.fn()
    root.subscribeInteraction(listener)

    root.setInteractionState({
      pointer: { x: 10, y: 20, plotX: 10, plotY: 20 },
      hovered: null,
      tooltipVisible: false,
    })

    expect(root.getInteractionState().pointer?.plotX).toBe(10)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('hit-tests direct bars and returns null outside the layout', () => {
    const app = createApp()
    mountInteractiveChart(app, rows(3), 600, 300)

    const series = app.components.requireApi<NovaChartBarSeriesApi<Row>>('series')
    const item = series.getLayoutPlan().items[0]
    expect(item).toBeDefined()

    const hit = series.hitTest({
      x: item.x + item.width / 2,
      y: item.y + item.height / 2,
    })

    expect(hit?.key).toBe('row-0')
    expect(hit?.mode).toBe('datum')
    expect(hit?.label).toBe('C0')
    expect(series.hitTest({ x: -20, y: -20 })).toBeNull()
  })

  it('hit-tests windowed bars after scale range expansion', () => {
    const app = createApp()
    mountInteractiveChart(app, rows(100_000), 900, 360)

    const root = app.components.requireApi<NovaChartRootApi<Row>>('chart')
    const series = app.components.requireApi<NovaChartBarSeriesApi<Row>>('series')
    root.requireScale('x').setRange([0, 100_000])
    series.setVirtualization({ minBarWidthPx: 0 })

    const plan = series.getLayoutPlan()
    const item = plan.items[0]
    expect(plan.diagnostics.mode).toBe('windowed')
    expect(plan.diagnostics.visibleRows).toBeLessThan(100_000)
    expect(series.hitTest({ x: item.x + item.width / 2, y: item.y + item.height / 2 })?.key).toBe(item.key)
  })

  it('hit-tests aggregated buckets without exposing raw rows', () => {
    const app = createApp()
    mountInteractiveChart(app, rows(100_000), 900, 360)

    const series = app.components.requireApi<NovaChartBarSeriesApi<Row>>('series')
    const plan = series.getLayoutPlan()
    const item = plan.items[0]
    const hit = series.hitTest({ x: item.x + item.width / 2, y: item.y + item.height / 2 })

    expect(plan.diagnostics.mode).toBe('aggregated')
    expect(hit?.mode).toBe('bucket')
    expect(hit?.row).toBeUndefined()
  })

  it('interaction component updates hover and clears it on leave', () => {
    const app = createApp()
    mountInteractiveChart(app, rows(10), 700, 320)

    const root = app.components.requireApi<NovaChartRootApi<Row>>('chart')
    const series = app.components.requireApi<NovaChartBarSeriesApi<Row>>('series')
    const interaction = app.components.require('interaction') as unknown as NovaNode<TestEvents>
    const item = series.getLayoutPlan().items[0]

    interaction.eventHandlers.mousemove?.(new MouseEvent('mousemove', {
      clientX: item.x + item.width / 2,
      clientY: item.y + item.height / 2,
    }))

    expect(root.getInteractionState().hovered?.key).toBe('row-0')
    expect(root.getInteractionState().tooltipVisible).toBe(true)

    interaction.eventHandlers.mouseleave?.(new MouseEvent('mouseleave'))
    expect(root.getInteractionState().hovered).toBeNull()
    expect(root.getInteractionState().tooltipVisible).toBe(false)
  })

  it('external components can read interaction state through chartRef API', () => {
    const app = createApp()
    mountInteractiveChart(app, rows(5))

    const root = app.components.requireApi<NovaChartRootApi<Row>>('chart')
    root.setInteractionState({
      pointer: { x: 12, y: 18, plotX: 12, plotY: 18 },
      hovered: null,
      tooltipVisible: false,
    })

    const externalRoot = app.components.requireApi<NovaChartRootApi<Row>>('chart')
    expect(externalRoot.getInteractionState().pointer?.plotY).toBe(18)
  })

  it('renders tooltip through UIKit adapter and calls content formatter', () => {
    const app = createApp()
    const formatter = vi.fn((context: NovaChartTooltipContext<Row>) => ({
      text: `${context.label}: ${context.formattedValue}`,
    }))
    mountInteractiveChart(app, rows(3), 600, 300)

    app.components.require('tooltip').setProps({
      contentFormatter: formatter,
      labelFormatter: context => `Label ${context.datum.category}`,
      valueFormatter: context => `${context.value} pts`,
    } as any)
    const root = app.components.requireApi<NovaChartRootApi<Row>>('chart')
    const series = app.components.requireApi<NovaChartBarSeriesApi<Row>>('series')
    const item = series.getLayoutPlan().items[0]
    root.setInteractionState({
      pointer: { x: item.x + 2, y: item.y + 2, plotX: item.x + 2, plotY: item.y + 2 },
      hovered: series.hitTest({ x: item.x + item.width / 2, y: item.y + item.height / 2 }),
      tooltipVisible: true,
    })
    app.raph.run()

    expect(formatter).toHaveBeenCalled()
    expect(formatter.mock.calls[0]?.[0].label).toBe('Label C0')
    expect(formatter.mock.calls[0]?.[0].formattedValue).toBe('1 pts')
  })

  it('scrolls a band domain through Viewport without losing source domain', () => {
    const app = createApp()
    mountViewportChart(app, rows(40))

    const root = app.components.requireApi<NovaChartRootApi<Row>>('chart')
    const viewport = app.components.requireApi<NovaChartViewportApi>('viewport')

    expect(root.requireScale('x').getDomain()).toEqual(['C0', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9'])
    expect(root.getScaleSourceDomain('x')).toHaveLength(40)

    viewport.scrollTo(12)
    app.raph.run()

    expect(root.requireScale('x').getDomain()[0]).toBe('C12')
    expect(viewport.getViewportState()).toMatchObject({
      value: 12,
      max: 30,
      viewportSize: 10,
      contentSize: 40,
    })
  })

  it('registers ViewportController and scrolls horizontal viewport from deltaX', () => {
    const app = createApp()
    mountViewportControllerChart(app, rows(40), {
      wheel: { axis: 'horizontal', useDeltaX: true, speed: 1 },
    })

    expect(NovaCharts.ViewportController).toBe('NovaCharts.ViewportController')
    expect(app.components.api<NovaChartViewportControllerApi>('viewport-controller')).toBeTruthy()

    const viewport = app.components.requireApi<NovaChartViewportApi>('viewport')
    const controller = app.components.require('viewport-controller') as unknown as NovaNode<TestEvents>
    controller.eventHandlers.wheel?.(new WheelEvent('wheel', { deltaX: 96, deltaY: 0 }))

    expect(viewport.getViewportState().value).toBe(2)
    expect(app.components.requireApi<NovaChartRootApi<Row>>('chart').getScaleSourceDomain('x')).toHaveLength(40)
  })

  it('maps Shift+wheel to horizontal viewport and filters tiny deltas', () => {
    const app = createApp()
    mountViewportControllerChart(app, rows(40), {
      wheel: { axis: 'horizontal', shiftYToX: true, thresholdPx: 8 },
    })

    const viewport = app.components.requireApi<NovaChartViewportApi>('viewport')
    const controller = app.components.require('viewport-controller') as unknown as NovaNode<TestEvents>
    controller.eventHandlers.wheel?.(new WheelEvent('wheel', { deltaY: 4, shiftKey: true }))
    expect(viewport.getViewportState().value).toBe(0)

    controller.eventHandlers.wheel?.(new WheelEvent('wheel', { deltaY: 96, shiftKey: true }))
    expect(viewport.getViewportState().value).toBe(2)
  })

  it('allows wheel pass-through at viewport bounds', () => {
    const app = createApp()
    mountViewportControllerChart(app, rows(20), {
      wheel: { axis: 'horizontal', edgeBehavior: 'pass-through', preventDefault: 'when-scrollable' },
    })

    const controller = app.components.require('viewport-controller') as unknown as NovaNode<TestEvents>
    const event = new WheelEvent('wheel', { deltaX: -96 })
    controller.eventHandlers.wheel?.(event)

    expect((event as unknown as Record<string, unknown>).__novaAllowDefault).toBe(true)
    expect(app.components.requireApi<NovaChartViewportApi>('viewport').getViewportState().value).toBe(0)
  })

  it('supports pointer pan, keyboard and custom wheel mapper', () => {
    const app = createApp()
    const onInput = vi.fn()
    mountViewportControllerChart(app, rows(60), {
      wheel: { axis: 'horizontal' },
      pointerPan: { enabled: true, speed: 1 },
      keyboard: { enabled: true, step: 3, pageStep: 8 },
      mapWheel: () => ({ axis: 'horizontal', delta: 5, mode: 'domain', source: 'custom' }),
      onInput,
    })

    const viewport = app.components.requireApi<NovaChartViewportApi>('viewport')
    const controller = app.components.require('viewport-controller') as unknown as NovaNode<TestEvents>
    controller.eventHandlers.wheel?.(new WheelEvent('wheel', { deltaY: 1 }))
    expect(viewport.getViewportState().value).toBe(5)
    expect(onInput).toHaveBeenLastCalledWith(expect.objectContaining({ source: 'custom', delta: 5 }), expect.any(WheelEvent))

    controller.eventHandlers.mousedown?.(new MouseEvent('mousedown', { button: 0, clientX: 100, clientY: 100 }))
    controller.eventHandlers.dragmove?.(new MouseEvent('mousemove', { clientX: 0, clientY: 100 }), -96, 0, {
      startX: 100,
      startY: 100,
      x: 0,
      y: 100,
      dx: -96,
      dy: 0,
      totalDx: -96,
      totalDy: 0,
      pointerId: 1,
    })
    expect(viewport.getViewportState().value).toBe(7)

    controller.eventHandlers.keydown?.(new KeyboardEvent('keydown', { key: 'PageDown' }))
    expect(viewport.getViewportState().value).toBe(15)
  })

  it('keeps scrollbar wheel behavior backward-compatible without controller', () => {
    const app = createApp()
    mountViewportChart(app, rows(40))

    const viewport = app.components.requireApi<NovaChartViewportApi>('viewport')
    const scrollbar = app.components.require('viewport') as unknown as NovaNode<TestEvents>
    scrollbar.eventHandlers.wheel?.(new WheelEvent('wheel', { deltaX: 0, deltaY: 96 }))

    expect(viewport.getViewportState().value).toBe(5)
  })

  it('keeps generic bar metadata and scale domain contributions in root API', () => {
    const app = createApp()
    mountSeriesChart(app, { mode: 'grouped', orientation: 'vertical' })

    const root = app.components.requireApi<NovaChartRootApi<SeriesRow>>('chart')
    const legend = app.components.requireApi<NovaChartLegendApi>('legend')

    expect(legend.getSeries()).toEqual([
      expect.objectContaining({
        id: 'A',
        kind: 'bar',
        sourceSeriesId: 'series',
        scaleIds: { x: 'x', y: 'y' },
      }),
      expect.objectContaining({
        id: 'B',
        kind: 'bar',
        sourceSeriesId: 'series',
        scaleIds: { x: 'x', y: 'y' },
      }),
    ])
    expect(root.getScaleDomainContributions('x')).toEqual([
      expect.objectContaining({
        id: 'series:category-domain',
        scaleId: 'x',
        domain: ['Q1', 'Q2', 'Q3'],
      }),
    ])
    expect(root.getScaleDomainContributions('y')).toEqual([
      expect.objectContaining({
        id: 'series:value-domain',
        scaleId: 'y',
        domain: [6, 16],
      }),
    ])
  })

  it('merges mixed series contributions into shared scales and viewport keeps source domain', () => {
    const app = createApp()
    mountMixedCoreChart(app)

    const root = app.components.requireApi<NovaChartRootApi<Row>>('chart')
    const viewport = app.components.requireApi<NovaChartViewportApi>('viewport')
    const legend = app.components.requireApi<NovaChartLegendApi>('legend')

    expect(root.getScaleSourceDomain('x')).toEqual(['A', 'B', 'C'])
    expect(root.requireScale('x').getDomain()).toEqual(['A', 'B'])
    expect(root.requireScale('y').getDomain()).toEqual([0, 45])
    expect(root.getScaleDomainContributions('x').map(item => item.id).sort()).toEqual([
      'bars:category-domain',
      'line-like:x',
    ])
    expect(legend.getSeries()).toEqual([
      expect.objectContaining({ id: 'forecast', kind: 'line', scaleIds: { x: 'x', y: 'y' } }),
    ])

    viewport.scrollTo(1)
    app.raph.run()

    expect(root.requireScale('x').getDomain()).toEqual(['B', 'C'])
    expect(root.getScaleSourceDomain('x')).toEqual(['A', 'B', 'C'])
  })

  it('keeps explicit scale domain fixed when series publishes contributions', () => {
    const app = createApp()
    mountSeriesChart(app, { mode: 'stacked', orientation: 'vertical' })

    const root = app.components.requireApi<NovaChartRootApi<SeriesRow>>('chart')
    expect(root.requireScale('y').getDomain()).toEqual([0, 30])
    expect(root.getScaleSourceDomain('y')).toEqual([0, 30])
    expect(root.getScaleDomainContributions('y')[0]).toEqual(expect.objectContaining({
      id: 'series:value-domain',
      domain: [0, 23],
    }))
  })

  it('interaction can select nearest datum from a non-bar registered series', () => {
    const app = createApp()
    mountMixedCoreChart(app)

    const root = app.components.requireApi<NovaChartRootApi<Row>>('chart')
    const interaction = app.components.require('interaction') as unknown as NovaNode<TestEvents>

    interaction.eventHandlers.mousemove?.(new MouseEvent('mousemove', {
      clientX: 16,
      clientY: 18,
    }))

    expect(root.getInteractionState().hovered).toEqual(expect.objectContaining({
      seriesId: 'line-like',
      seriesKind: 'line',
      key: 'C',
      point: { x: 16, y: 18 },
    }))
  })

  it('registers LineSeries as a public schema with metadata and domain contributions', () => {
    const app = createApp()
    mountLineSeriesChart(app)

    const root = app.components.requireApi<NovaChartRootApi<LineRow>>('chart')
    const line = app.components.requireApi<NovaChartLineSeriesApi<LineRow>>('line')
    const legend = app.components.requireApi<NovaChartLegendApi>('legend')
    const plan = line.getLayoutPlan()

    expect(NovaCharts.LineSeries).toBe('NovaCharts.LineSeries')
    expect(plan.series.map(item => item.id)).toEqual(['Actual', 'Plan'])
    expect(plan.points).toHaveLength(6)
    expect(plan.segments).toHaveLength(4)
    expect(plan.points[0].x).toBeGreaterThan(0)
    expect(root.getScaleDomainContributions('x')).toEqual([
      expect.objectContaining({
        id: 'line:x-domain',
        scaleId: 'x',
        domain: ['Q1', 'Q2', 'Q3'],
      }),
    ])
    expect(root.getScaleDomainContributions('y')).toEqual([
      expect.objectContaining({
        id: 'line:y-domain',
        scaleId: 'y',
        domain: [8, 20],
      }),
    ])
    expect(legend.getSeries()).toEqual([
      expect.objectContaining({ id: 'Actual', kind: 'line', label: 'Факт', scaleIds: { x: 'x', y: 'y' } }),
      expect.objectContaining({ id: 'Plan', kind: 'line', label: 'План', scaleIds: { x: 'x', y: 'y' } }),
    ])
  })

  it('renders step LineSeries and keeps null gaps unless connectNulls is enabled', () => {
    const data: Array<LineRow> = [
      { id: 'q1', category: 'Q1', value: 10 },
      { id: 'q2', category: 'Q2', value: Number.NaN },
      { id: 'q3', category: 'Q3', value: 20 },
    ]

    const app = createApp()
    mountLineSeriesChart(app, data, { seriesField: undefined, curve: 'step' })
    const line = app.components.requireApi<NovaChartLineSeriesApi<LineRow>>('line')
    expect(line.getLayoutPlan().points).toHaveLength(2)
    expect(line.getLayoutPlan().segments).toHaveLength(0)

    const connectedApp = createApp()
    mountLineSeriesChart(connectedApp, data, { seriesField: undefined, curve: 'step', connectNulls: true })
    const connected = connectedApp.components.requireApi<NovaChartLineSeriesApi<LineRow>>('line')
    expect(connected.getLayoutPlan().segments).toHaveLength(2)
  })

  it('hit-tests LineSeries points and passes generic datum to tooltip formatter', () => {
    const app = createApp()
    const formatter = vi.fn((context: NovaChartTooltipContext<LineRow>) => ({
      text: `${context.datum.seriesKind}:${context.datum.xValue}:${context.formattedValue}`,
    }))
    mountLineSeriesChart(app)
    app.components.require('tooltip').setProps({ contentFormatter: formatter } as any)

    const root = app.components.requireApi<NovaChartRootApi<LineRow>>('chart')
    const line = app.components.requireApi<NovaChartLineSeriesApi<LineRow>>('line')
    const point = line.getLayoutPlan().points[0]
    const hit = line.hitTest({ x: point.x + 1, y: point.y + 1 })

    expect(hit).toEqual(expect.objectContaining({
      seriesId: 'line',
      seriesKind: 'line',
      key: point.key,
      xValue: point.xValue,
      yValue: point.yValue,
      point: { x: point.x, y: point.y },
    }))

    root.setInteractionState({
      pointer: { x: point.x, y: point.y, plotX: point.x, plotY: point.y },
      hovered: hit,
      tooltipVisible: true,
    })
    app.raph.run()

    expect(formatter).toHaveBeenCalled()
    expect(formatter.mock.calls[0]?.[0].datum.seriesKind).toBe('line')
  })

  it('virtualizes large LineSeries datasets with bounded rendered points', () => {
    const app = createApp()
    mountLineSeriesChart(app, rows(80_000), {
      seriesField: undefined,
      virtualization: {
        maxRenderedPoints: 500,
      },
    })

    const line = app.components.requireApi<NovaChartLineSeriesApi<Row>>('line')
    expect(line.getDiagnostics().renderedPoints).toBeLessThanOrEqual(500)
    expect(line.getDiagnostics().mode).toBe('sampled')
  })

  it('computes grouped and stacked layouts with series metadata', () => {
    const app = createApp()
    mountSeriesChart(app, { mode: 'grouped', orientation: 'vertical' })

    const grouped = app.components.requireApi<NovaChartBarSeriesApi<SeriesRow>>('series').getLayoutPlan()
    const legend = app.components.requireApi<NovaChartLegendApi>('legend')

    expect(grouped.mode).toBe('grouped')
    expect(grouped.series.map(item => item.id)).toEqual(['A', 'B'])
    expect(grouped.items).toHaveLength(6)
    expect(legend.getSeries().map(item => item.label)).toEqual(['Alpha', 'Beta'])

    const stackedApp = createApp()
    mountSeriesChart(stackedApp, { mode: 'stacked', orientation: 'vertical' })
    const stacked = stackedApp.components.requireApi<NovaChartBarSeriesApi<SeriesRow>>('series').getLayoutPlan()
    expect(stacked.mode).toBe('stacked')
    expect(stacked.items.filter(item => item.category === 'Q1').map(item => item.value)).toEqual([12, 20])
  })

  it('computes horizontal bars and labels from the professional BarSeries API', () => {
    const app = createApp()
    mountSeriesChart(app, {
      mode: 'grouped',
      orientation: 'horizontal',
      labels: {
        visible: true,
        formatter: (context: { seriesKey?: string, value: number }) => `${context.seriesKey}:${context.value}`,
      },
    })

    const plan = app.components.requireApi<NovaChartBarSeriesApi<SeriesRow>>('series').getLayoutPlan()
    expect(plan.orientation).toBe('horizontal')
    expect(plan.items[0].width).toBeGreaterThan(0)
    expect(plan.items[0].labelText).toBe('A:12')
  })

  it('mounts high-level BarChart wrapper and keeps low-level APIs reachable', () => {
    const app = createApp()
    mountBarChart(app)

    const wrapper = app.components.requireApi<NovaChartBarChartApi<SeriesRow>>('bar-chart')
    const root = app.components.requireApi<NovaChartRootApi<SeriesRow>>('bar-chart:root')
    const series = app.components.requireApi<NovaChartBarSeriesApi<SeriesRow>>('bar-chart:series')
    const viewport = app.components.requireApi<NovaChartViewportApi>('bar-chart:viewport')

    expect(wrapper.getData()).toHaveLength(6)
    expect(root.requireScale('category').getDomain()).toEqual(['Q1', 'Q2'])
    expect(root.getScaleSourceDomain('category')).toEqual(['Q1', 'Q2', 'Q3'])
    expect(series.getLayoutPlan().mode).toBe('grouped')

    viewport.scrollTo(1)
    app.raph.run()
    expect(root.requireScale('category').getDomain()).toEqual(['Q2', 'Q3'])
  })

  it('auto-mounts ViewportController from BarChart viewport controller props', () => {
    const app = createApp()
    mountBarChart(app, seriesRows(), {
      viewport: {
        visibleCount: 2,
        controller: {
          wheel: { axis: 'horizontal' },
        },
      },
    })

    const controller = app.components.require('bar-chart:viewport-controller') as unknown as NovaNode<TestEvents>
    const viewport = app.components.requireApi<NovaChartViewportApi>('bar-chart:viewport')
    controller.eventHandlers.wheel?.(new WheelEvent('wheel', { deltaY: 96 }))

    expect(viewport.getViewportState().value).toBe(1)
  })

  it('exposes bounded chart semantics and export wrappers', async () => {
    const app = createApp()
    mountBarChart(app, seriesRows(), {
      accessibility: {
        label: 'Revenue chart',
        description: 'Grouped bar chart for accessibility smoke',
        includeVisibleMarks: true,
        maxMarks: 2,
        keyboardNavigation: true,
      },
    })

    const wrapper = app.components.requireApi<NovaChartBarChartApi<SeriesRow>>('bar-chart')
    const root = app.components.requireApi<NovaChartRootApi<SeriesRow>>('bar-chart:root')
    const snapshot = root.getSemanticSnapshot()
    const marks = snapshot.regions.filter(region => region.role === 'mark')

    expect(snapshot.regions.some(region => region.role === 'chart' && region.label === 'Revenue chart')).toBe(true)
    expect(snapshot.regions.some(region => region.role === 'axis')).toBe(true)
    expect(snapshot.regions.some(region => region.role === 'series')).toBe(true)
    expect(snapshot.regions.some(region => region.role === 'legend')).toBe(true)
    expect(marks.length).toBeLessThanOrEqual(2)
    expect(marks[0]?.data).not.toHaveProperty('row')

    const focused = app.semantics.focusNext({ scope: 'bar-chart:root', role: 'mark' })
    expect(focused?.role).toBe('mark')

    const exported = await wrapper.exportChart({ format: 'png', includeSemanticSnapshot: true })
    expect(exported.dataUrl).toContain('image/png')
    expect(exported.semanticSnapshot?.regions.some(region => region.label === 'Revenue chart')).toBe(true)
  })

  it('disables chart semantic publishing when accessibility is false', () => {
    const app = createApp()
    mountBarChart(app, seriesRows(), { accessibility: false })

    const root = app.components.requireApi<NovaChartRootApi<SeriesRow>>('bar-chart:root')
    expect(root.getSemanticSnapshot().regions).toEqual([])
  })
})
