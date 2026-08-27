// @vitest-environment jsdom

import type { NovaApp, NovaNode } from '@endge/nova'
import type { NovaChartAreaSeriesApi, NovaChartBubbleSeriesApi, NovaChartComposedChartApi, NovaChartLegendApi, NovaChartRootApi, NovaChartScatterSeriesApi, NovaChartViewportApi } from '@/index'
import {
  Nova,

  RaphSchedulerType,
  RendererType,
} from '@endge/nova'
import { NovaUIKit, registerNovaUIKit } from '@endge/nova-ui-kit'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BandScale,
  ChartDataStore,
  createAreaSeriesLayout,
  createBubbleSeriesLayout,
  hitTestAreaLayoutPlan,
  hitTestBubbleLayoutPlan,
  LinearScale,
  normalizeChartAreaSeriesProps,
  normalizeChartBubbleSeriesProps,

  NovaCharts,

  registerNovaCharts,
  resolveAreaYDomain,
} from '@/index'

type TestEvents = Record<string, any>

interface PointRow {
  id: string
  category: string
  value: number | null
  forecast?: number
  area?: number | null
  score?: number
  size?: number
  series?: string
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
}

function create2DContextStub(): CanvasRenderingContext2D {
  const state: Record<PropertyKey, any> = {
    measureText: vi.fn((text: string) => ({ width: text.length * 7 })),
    createPattern: vi.fn(() => ({})),
  }
  return new Proxy(state, {
    get(target, prop) {
      if (!(prop in target)) {
        target[prop] = vi.fn()
      }
      return target[prop]
    },
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
  return app
}

function pointRows(): Array<PointRow> {
  return [
    { id: 'a-q1', category: 'Q1', series: 'A', value: 10, forecast: 12, area: 8, score: 4, size: 4 },
    { id: 'b-q1', category: 'Q1', series: 'B', value: 12, forecast: 14, area: 5, score: 6, size: 9 },
    { id: 'a-q2', category: 'Q2', series: 'A', value: 15, forecast: 17, area: null, score: 7, size: 16 },
    { id: 'b-q2', category: 'Q2', series: 'B', value: 8, forecast: 10, area: 6, score: 2, size: Number.NaN },
    { id: 'a-q3', category: 'Q3', series: 'A', value: 18, forecast: 21, area: 10, score: 9, size: 25 },
    { id: 'b-q3', category: 'Q3', series: 'B', value: 7, forecast: 9, area: -4, score: 5, size: 36 },
  ]
}

function createLayoutInput<TProps>(props: TProps, data: Array<PointRow> = pointRows()) {
  const store = new ChartDataStore<PointRow>({ data, keyField: 'id' })
  const xScale = new BandScale('x', {
    domain: ['Q1', 'Q2', 'Q3'],
    range: [0, 360],
    paddingInner: 0.1,
  })
  const yScale = new LinearScale('y', {
    domain: [-20, 60],
    range: [240, 0],
  })
  return {
    props,
    dataStore: store,
    xScale,
    yScale,
    width: 360,
    height: 240,
  }
}

function mountRootChart(app: NovaApp<TestEvents>, data: Array<PointRow> = pointRows()): void {
  const surface = app.createSurface('cartesian-series-test')
  app.schema.createNode(surface, {
    type: NovaUIKit.Root,
    id: 'ui-root',
    props: { width: 760, height: 360 },
    children: [
      {
        type: NovaCharts.Root,
        id: 'chart',
        props: {
          width: 760,
          height: 360,
          data,
          keyField: 'id',
        },
        children: [
          { type: NovaCharts.Scale, id: 'x-scale', props: { scaleId: 'x', scaleType: 'band', field: 'category' } },
          { type: NovaCharts.Scale, id: 'y-scale', props: { scaleId: 'y', scaleType: 'linear', zero: true, nice: false } },
          {
            type: NovaCharts.Plot,
            id: 'plot',
            props: { xScaleId: 'x', yScaleId: 'y', width: 620, height: 300 },
            children: [
              {
                type: NovaCharts.ScatterSeries,
                id: 'scatter',
                props: {
                  xScaleId: 'x',
                  yScaleId: 'y',
                  xField: 'category',
                  yField: 'score',
                  seriesField: 'series',
                  colors: { palette: ['#2563eb', '#f97316'] },
                  virtualization: { maxRenderedPoints: 4 },
                },
              },
              {
                type: NovaCharts.AreaSeries,
                id: 'area',
                props: {
                  xScaleId: 'x',
                  yScaleId: 'y',
                  xField: 'category',
                  yField: 'area',
                  connectNulls: true,
                  markers: { visible: true },
                },
              },
              {
                type: NovaCharts.BubbleSeries,
                id: 'bubble',
                props: {
                  xScaleId: 'x',
                  yScaleId: 'y',
                  xField: 'category',
                  yField: 'forecast',
                  sizeField: 'size',
                  radiusRange: [3, 12],
                },
              },
              { type: NovaCharts.Interaction, id: 'interaction', props: { mode: 'nearest', tooltip: true } },
              { type: NovaCharts.Tooltip, id: 'tooltip', props: {} },
            ],
          },
          { type: NovaCharts.Legend, id: 'legend', props: { orientation: 'horizontal' } },
        ],
      },
    ],
  })
  app.raph.run()
  app.raph.run()
}

beforeEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  installCanvasMocks()
})

describe('nova Charts cartesian series', () => {
  it('exports and registers new public schema names', () => {
    const app = createApp()
    expect(NovaCharts.ScatterSeries).toBe('NovaCharts.ScatterSeries')
    expect(NovaCharts.AreaSeries).toBe('NovaCharts.AreaSeries')
    expect(NovaCharts.BubbleSeries).toBe('NovaCharts.BubbleSeries')
    expect(NovaCharts.ComposedChart).toBe('NovaCharts.ComposedChart')
    expect(app.schema.has(NovaCharts.ScatterSeries)).toBe(true)
    expect(app.schema.has(NovaCharts.AreaSeries)).toBe(true)
    expect(app.schema.has(NovaCharts.BubbleSeries)).toBe(true)
    expect(app.schema.has(NovaCharts.ComposedChart)).toBe(true)
  })

  it('lays out scatter points, publishes metadata and hit-tests rendered points only', () => {
    const app = createApp()
    mountRootChart(app)

    const api = app.components.api<NovaChartScatterSeriesApi<PointRow>>('scatter')
    const legend = app.components.api<NovaChartLegendApi>('legend')
    const plan = api?.getLayoutPlan()

    expect(api?.getDiagnostics().kind).toBe('scatter')
    expect(plan?.points.length).toBeLessThanOrEqual(4)
    expect(plan?.points[0]?.x).toBeGreaterThan(0)
    expect(legend?.getSeries().some(item => item.kind === 'scatter' && item.label === 'A')).toBe(true)

    const point = plan?.points[0]
    expect(point).toBeDefined()
    const hit = api?.hitTest({ x: point!.x, y: point!.y, maxDistancePx: 12 })
    expect(hit?.seriesKind).toBe('scatter')
    expect(hit?.point).toEqual({ x: point!.x, y: point!.y })
  })

  it('keeps explicit scale domain fixed while scatter contributes metadata to source domain', () => {
    const app = createApp()
    const surface = app.createSurface('explicit-domain-test')
    app.schema.createNode(surface, {
      type: NovaUIKit.Root,
      id: 'ui-root',
      props: { width: 420, height: 240 },
      children: [
        {
          type: NovaCharts.Root,
          id: 'chart',
          props: { data: pointRows(), keyField: 'id' },
          children: [
            { type: NovaCharts.Scale, id: 'x-scale', props: { scaleId: 'x', scaleType: 'band', domain: ['Q1'] } },
            { type: NovaCharts.Scale, id: 'y-scale', props: { scaleId: 'y', scaleType: 'linear', domain: [0, 10], zero: false } },
            {
              type: NovaCharts.Plot,
              id: 'plot',
              props: { xScaleId: 'x', yScaleId: 'y' },
              children: [
                {
                  type: NovaCharts.ScatterSeries,
                  id: 'scatter',
                  props: { xScaleId: 'x', yScaleId: 'y', xField: 'category', yField: 'score' },
                },
              ],
            },
          ],
        },
      ],
    })
    app.raph.run()
    app.raph.run()

    const root = app.components.api<NovaChartRootApi<PointRow>>('chart')
    expect(root?.getScaleSourceDomain('x')).toEqual(['Q1'])
    expect(root?.getScaleSourceDomain('y')).toEqual([0, 10])
    expect(root?.getScaleDomainContributions('x').length).toBe(1)
  })

  it('creates area polygons, stacked y-domain totals, null gaps and step segments', () => {
    const singleProps = normalizeChartAreaSeriesProps<PointRow>({
      xScaleId: 'x',
      yScaleId: 'y',
      xField: 'category',
      yField: 'area',
      connectNulls: false,
      virtualization: { enabled: false },
    })
    const connectedProps = normalizeChartAreaSeriesProps<PointRow>({
      ...singleProps,
      connectNulls: true,
      curve: 'step',
    })

    const gappedRows: Array<PointRow> = [
      { id: 'a', category: 'Q1', value: 1, area: 4 },
      { id: 'b', category: 'Q2', value: 1, area: Number.NaN },
      { id: 'c', category: 'Q3', value: 1, area: 8 },
    ]
    const single = createAreaSeriesLayout(createLayoutInput(singleProps, gappedRows))
    const connected = createAreaSeriesLayout(createLayoutInput(connectedProps, gappedRows))
    const stackedDomain = resolveAreaYDomain(createLayoutInput(normalizeChartAreaSeriesProps<PointRow>({
      xScaleId: 'x',
      yScaleId: 'y',
      xField: 'category',
      yField: 'area',
      seriesField: 'series',
      mode: 'stacked',
    })))

    expect(single.areas.length).toBeLessThan(connected.areas.length)
    expect(connected.segments.length).toBeGreaterThan(connected.points.length - 1)
    expect(stackedDomain[0]).toBeLessThanOrEqual(-4)
    expect(stackedDomain[1]).toBeGreaterThanOrEqual(13)

    const point = connected.points[0]
    const hit = hitTestAreaLayoutPlan('area', connected, { x: point.x, y: point.y, maxDistancePx: 12 })
    expect(hit?.seriesKind).toBe('area')
  })

  it('maps bubble sizes to bounded radius range and hit-tests by bubble radius', () => {
    const props = normalizeChartBubbleSeriesProps<PointRow>({
      xScaleId: 'x',
      yScaleId: 'y',
      xField: 'category',
      yField: 'forecast',
      sizeField: 'size',
      radiusRange: [4, 18],
      virtualization: { enabled: false },
    })
    const plan = createBubbleSeriesLayout(createLayoutInput(props))

    expect(plan.points.length).toBe(pointRows().length)
    expect(Math.min(...plan.points.map(point => point.radius))).toBeGreaterThanOrEqual(4)
    expect(Math.max(...plan.points.map(point => point.radius))).toBeLessThanOrEqual(18)

    const point = plan.points.find(item => item.sizeValue === plan.sizeDomain[1]) ?? plan.points[0]
    const hit = hitTestBubbleLayoutPlan('bubble', plan, {
      x: point.x + point.radius - 1,
      y: point.y,
      maxDistancePx: 2,
    })
    expect(hit?.seriesKind).toBe('bubble')
  })

  it('mounts ComposedChart with bar, line, area, scatter and bubble on shared scales', () => {
    const app = createApp()
    const surface = app.createSurface('composed-chart-test')
    app.schema.createNode(surface, {
      type: NovaUIKit.Root,
      id: 'ui-root',
      props: { width: 780, height: 420 },
      children: [
        {
          type: NovaCharts.ComposedChart,
          id: 'composed',
          props: {
            width: 780,
            height: 420,
            data: pointRows(),
            keyField: 'id',
            xAxis: { scaleType: 'band', field: 'category', height: 36 },
            yAxis: { scaleType: 'linear', zero: true, nice: false, width: 54 },
            viewport: { visibleCount: 2, controller: { wheel: { axis: 'horizontal' } } },
            legend: { orientation: 'vertical' },
            tooltip: {
              contentFormatter: context => ({
                text: `${context.datum.seriesKind}: ${context.formattedValue}`,
              }),
            },
            series: [
              { type: 'bar', id: 'bar', categoryField: 'category', valueField: 'value', seriesField: 'series', fill: '#2563eb' },
              { type: 'line', id: 'line', xField: 'category', yField: 'forecast', markers: { visible: true } },
              { type: 'area', id: 'area', xField: 'category', yField: 'area', connectNulls: true },
              { type: 'scatter', id: 'scatter', xField: 'category', yField: 'score' },
              { type: 'bubble', id: 'bubble', xField: 'category', yField: 'forecast', sizeField: 'size' },
            ],
            children: [
              {
                type: NovaCharts.Grid,
                id: 'custom-grid-overlay',
                props: { xScaleId: 'x', yScaleId: 'y', lineColor: '#eef2f7' },
              },
            ],
          },
        },
      ],
    })
    app.raph.run()
    app.raph.run()

    const composed = app.components.api<NovaChartComposedChartApi<PointRow>>('composed')
    const root = app.components.api<NovaChartRootApi<PointRow>>('composed:root')
    const legend = app.components.api<NovaChartLegendApi>('composed:legend')
    const scatter = app.components.api<NovaChartScatterSeriesApi<PointRow>>('composed:series:scatter')
    const area = app.components.api<NovaChartAreaSeriesApi<PointRow>>('composed:series:area')
    const bubble = app.components.api<NovaChartBubbleSeriesApi<PointRow>>('composed:series:bubble')
    const controller = app.components.require('composed:viewport-controller') as unknown as NovaNode<TestEvents>
    const viewport = app.components.requireApi<NovaChartViewportApi>('composed:viewport')

    expect(composed?.getData().length).toBe(pointRows().length)
    expect(scatter?.getDiagnostics().kind).toBe('scatter')
    expect(area?.getDiagnostics().renderedAreas).toBeGreaterThan(0)
    expect(bubble?.getDiagnostics().renderedBubbles).toBeGreaterThan(0)
    expect(new Set(legend?.getSeries().map(item => item.kind))).toEqual(new Set(['bar', 'line', 'area', 'scatter', 'bubble']))

    const sourceDomain = root?.getScaleSourceDomain('x')
    root?.setScaleDomain('x', ['Q1', 'Q2'])
    expect(root?.getScale('x')?.getDomain()).toEqual(['Q1', 'Q2'])
    expect(root?.getScaleSourceDomain('x')).toEqual(sourceDomain)

    controller.eventHandlers.wheel?.(new WheelEvent('wheel', { deltaY: 96 }))
    expect(viewport.getViewportState().value).toBe(1)
  })
})
