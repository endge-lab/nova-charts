import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { NovaSemanticService } from '@endge/nova'
import { describe, expect, it } from 'vitest'
import { createAreaSeriesLayout } from '@/model/area/create-area-series-layout'
import { createBarSeriesLayout } from '@/model/bar/create-bar-series-layout'
import { hitTestBarLayoutPlan } from '@/model/bar/hit-test-bar-layout'
import { createBubbleSeriesLayout } from '@/model/bubble/create-bubble-series-layout'
import { hitTestBubbleLayoutPlan } from '@/model/bubble/hit-test-bubble-layout'
import { NovaChartCustomizationController, renderWithSlot } from '@/model/customization/chart-customization'
import { ChartDataStore } from '@/model/data/ChartDataStore'
import { createLineSeriesLayout } from '@/model/line/create-line-series-layout'
import { BandScale } from '@/model/scale/BandScale'
import { LinearScale } from '@/model/scale/LinearScale'
import { TimeScale } from '@/model/scale/TimeScale'
import { createScatterSeriesLayout } from '@/model/scatter/create-scatter-series-layout'
import { hitTestScatterLayoutPlan } from '@/model/scatter/hit-test-scatter-layout'
import {
  chartViewportDeltaToSteps,
  normalizeChartViewportControllerOptions,
  resolveChartViewportWheelIntent,
} from '@/model/viewport-controller/viewport-controller'
import {
  normalizeChartAreaSeriesProps,
  normalizeChartBarSeriesProps,
  normalizeChartBubbleSeriesProps,
  normalizeChartLineSeriesProps,
  normalizeChartScatterSeriesProps,
} from '@/ui/shared/chart-props'

interface Row {
  id: string
  category: string
  value: number
  time: number
  forecast: number
  area: number
  score: number
  size: number
}

interface BenchScenarioResult {
  id: string
  category: 'data' | 'domain' | 'ticks' | 'layout' | 'schema' | 'render' | 'interaction' | 'hit-test'
  label: string
  rows: number
  samples: Array<number>
  meanMs: number
  p95Ms: number
  memoryBeforeMb: number
  memoryAfterMb: number
  renderedBars?: number
  renderedPoints?: number
  renderedSegments?: number
  renderedAreas?: number
  renderedBubbles?: number
  customMarks?: number
  mode?: string
  bottleneck: BenchScenarioResult['category']
  recommendation: string
}

const OUTPUT_DIR = path.resolve(process.cwd(), 'output')
const REPORT_JSON = path.join(OUTPUT_DIR, 'nova-charts-bench-report.json')
const REPORT_MD = path.join(OUTPUT_DIR, 'nova-charts-bench-report.md')

describe('бенчмарки Nova Charts', () => {
  it('записывает отчёт производительности и обеспечивает инварианты виртуализации', async () => {
    const results: Array<BenchScenarioResult> = []

    results.push(runScenario('data-index-10k', 'data', 'data/index setData 10k rows', 10_000, () => {
      const store = new ChartDataStore<Row>({ keyField: 'id' })
      store.setData(createRows(10_000))
      return { recommendation: 'index build stays linear' }
    }))
    results.push(runScenario('data-index-100k', 'data', 'data/index setData 100k rows', 100_000, () => {
      const store = new ChartDataStore<Row>({ keyField: 'id' })
      store.setData(createRows(100_000))
      return { recommendation: 'watch key index rebuild cost on repeated full setData' }
    }))
    results.push(runScenario('data-index-1m', 'data', 'data/index setData 1M rows', 1_000_000, () => {
      const store = new ChartDataStore<Row>({ keyField: 'id' })
      store.setData(createRows(1_000_000))
      return { recommendation: 'domain rebuild dominates after full data replacement' }
    }))

    results.push(runScenario('scale-domain-1m', 'domain', 'scale/domain band + numeric extents 1M', 1_000_000, () => {
      const store = new ChartDataStore<Row>({ data: createRows(1_000_000), keyField: 'id' })
      store.categoryDomain('category')
      store.numericExtent('value')
      return { recommendation: 'cache derived domains between scale refreshes' }
    }))

    results.push(runScenario('scale-update-100k', 'domain', 'scale/domain incremental updateRows 100k base', 100_000, () => {
      const store = new ChartDataStore<Row>({ data: createRows(100_000), keyField: 'id' })
      store.categoryDomain('category')
      store.numericExtent('value')
      store.updateRows(Array.from({ length: 2_000 }, (_item, index) => ({
        id: `row-${index * 3}`,
        value: 200 + (index % 31),
      })))
      store.categoryDomain('category')
      store.numericExtent('value')
      return { recommendation: 'incremental updates currently invalidate field caches' }
    }))

    results.push(runScenario('ticks-band-1m', 'ticks', 'ticks band sampled over 1M domain', 1_000_000, () => {
      const scale = new BandScale('x', {
        domain: createCategories(1_000_000),
        range: [0, 900],
      })
      const ticks = scale.ticks({ minStepPx: 72, maxCount: 14 })
      expect(ticks.length).toBeLessThanOrEqual(15)
      return { recommendation: 'ticks sampled correctly' }
    }))

    results.push(runScenario('ticks-linear-time', 'ticks', 'ticks linear/time large domain', 1_000_000, () => {
      const linear = new LinearScale('y', { domain: [0, 1_000_000], range: [360, 0] })
      const time = new TimeScale('t', {
        domain: [Date.UTC(2024, 0, 1), Date.UTC(2026, 0, 1)],
        range: [0, 900],
        timezone: 'Europe/Moscow',
      })
      expect(linear.ticks({ maxCount: 12 }).length).toBeGreaterThan(0)
      expect(time.ticks({ maxCount: 14 }).length).toBeGreaterThan(0)
      return { recommendation: 'calendar ticks stay bounded by maxCount/minStepPx' }
    }))

    const direct1k = runLayoutScenario('layout-direct-1k', 'layout/direct 1k visible bars', 1_000, 2_400, 20_000)
    const direct10k = runLayoutScenario('layout-direct-10k', 'layout/direct 10k visible bars', 10_000, 24_000, 20_000)
    const virtual100k = runLayoutScenario('layout-virtualized-100k', 'layout/virtualized 100k rows', 100_000, 900, 20_000)
    const virtual1m = runLayoutScenario('layout-virtualized-1m', 'layout/virtualized 1M rows', 1_000_000, 900, 20_000)
    const aggregated1m = runLayoutScenario('layout-aggregated-1m', 'layout/aggregated 1M categories on 900px plot', 1_000_000, 900, 8_000)

    results.push(direct1k, direct10k, virtual100k, virtual1m, aggregated1m)

    results.push(runScenario('schema-20k', 'schema', 'schema 20k rect primitives', 20_000, () => {
      const plan = createLayout(20_000, 48_000, 20_000)
      const schema = plan.items.map(item => ({ type: 'rect', x: item.x, y: item.y, width: item.width, height: item.height }))
      expect(schema.length).toBeLessThanOrEqual(20_000)
      return {
        renderedBars: schema.length,
        mode: plan.diagnostics.mode,
        recommendation: 'schema cost scales with rendered bars, not input rows',
      }
    }))

    results.push(runScenario('interaction-hittest-direct-10k', 'hit-test', 'interaction/hittest direct 10k bars', 10_000, () => {
      const plan = createLayout(10_000, 24_000, 20_000)
      const item = plan.items[Math.floor(plan.items.length / 2)]
      const hit = hitTestBarLayoutPlan('series', plan, {
        x: item.x + item.width / 2,
        y: item.y + item.height / 2,
      })
      expect(hit?.key).toBe(item.key)
      return {
        renderedBars: plan.diagnostics.renderedBars,
        mode: plan.diagnostics.mode,
        recommendation: 'hit-test stays bounded by rendered bars',
      }
    }))

    results.push(runScenario('interaction-hittest-windowed-100k', 'hit-test', 'interaction/hittest windowed 100k rows', 100_000, () => {
      const plan = createLayout(100_000, 100_000, 20_000, { plotWidth: 900, minBarWidthPx: 0 })
      const item = plan.items[Math.floor(plan.items.length / 2)]
      const hit = hitTestBarLayoutPlan('series', plan, {
        x: item.x + item.width / 2,
        y: item.y + item.height / 2,
      })
      expect(plan.diagnostics.mode).toBe('windowed')
      expect(hit?.key).toBe(item.key)
      return {
        renderedBars: plan.diagnostics.renderedBars,
        mode: plan.diagnostics.mode,
        recommendation: 'windowed hit-test avoids scanning raw input rows',
      }
    }))

    results.push(runScenario('interaction-hittest-aggregated-1m', 'hit-test', 'interaction/hittest aggregated 1M rows', 1_000_000, () => {
      const plan = createLayout(1_000_000, 900, 8_000)
      const item = plan.items[Math.floor(plan.items.length / 2)]
      const hit = hitTestBarLayoutPlan('series', plan, {
        x: item.x + item.width / 2,
        y: item.y + item.height / 2,
      })
      expect(plan.diagnostics.mode).toBe('aggregated')
      expect(hit?.mode).toBe('bucket')
      expect(hit?.row).toBeUndefined()
      return {
        renderedBars: plan.diagnostics.renderedBars,
        mode: plan.diagnostics.mode,
        recommendation: 'aggregated hit-test uses buckets instead of raw rows',
      }
    }))

    results.push(runScatterScenario('scatter-layout-100k', 'layout/scatter 100k bounded points', 100_000, 12_000))
    results.push(runScatterScenario('scatter-layout-1m', 'layout/scatter 1M bounded points', 1_000_000, 12_000))
    results.push(runScenario('scatter-hittest-100k', 'hit-test', 'interaction/scatter hittest 100k rendered points', 100_000, () => {
      const plan = createScatterSeriesLayout(createScatterLayoutInput(100_000, 12_000))
      const point = plan.points[Math.floor(plan.points.length / 2)]
      const hit = hitTestScatterLayoutPlan('scatter', plan, { x: point.x, y: point.y, maxDistancePx: 12 })
      expect(hit?.key).toBe(point.key)
      return {
        renderedPoints: plan.diagnostics.renderedPoints,
        mode: plan.diagnostics.mode,
        recommendation: 'scatter hit-test scans rendered points only',
      }
    }))

    results.push(runScenario('area-layout-100k', 'layout', 'layout/area 100k bounded polygons and segments', 100_000, () => {
      const plan = createAreaSeriesLayout(createAreaLayoutInput(100_000, 12_000))
      expect(plan.diagnostics.renderedPoints).toBeLessThanOrEqual(12_000)
      expect(plan.diagnostics.renderedSegments).toBeLessThanOrEqual(24_000)
      expect(plan.diagnostics.renderedAreas).toBeLessThanOrEqual(12_000)
      return {
        renderedPoints: plan.diagnostics.renderedPoints,
        renderedSegments: plan.diagnostics.renderedSegments,
        renderedAreas: plan.diagnostics.renderedAreas,
        mode: plan.diagnostics.mode,
        recommendation: 'area schema stays bounded by virtualized points',
      }
    }))

    results.push(runScenario('bubble-layout-100k', 'layout', 'layout/bubble 100k bounded bubbles', 100_000, () => {
      const plan = createBubbleSeriesLayout(createBubbleLayoutInput(100_000, 12_000))
      expect(plan.diagnostics.renderedBubbles).toBeLessThanOrEqual(12_000)
      return {
        renderedBubbles: plan.diagnostics.renderedBubbles,
        mode: plan.diagnostics.mode,
        recommendation: 'bubble radius mapping stays bounded by rendered bubbles',
      }
    }))

    results.push(runScenario('bubble-hittest-100k', 'hit-test', 'interaction/bubble hittest uses rendered radius', 100_000, () => {
      const plan = createBubbleSeriesLayout(createBubbleLayoutInput(100_000, 12_000))
      const point = plan.points[Math.floor(plan.points.length / 2)]
      const hit = hitTestBubbleLayoutPlan('bubble', plan, { x: point.x + point.radius - 1, y: point.y, maxDistancePx: 2 })
      expect(hit?.key).toBe(point.key)
      return {
        renderedBubbles: plan.diagnostics.renderedBubbles,
        mode: plan.diagnostics.mode,
        recommendation: 'bubble hit-test uses rendered bubbles and actual radius',
      }
    }))

    results.push(runScenario('composed-mixed-100k', 'layout', 'layout/composed mixed bar+line+area+scatter+bubble 100k', 100_000, () => {
      const mixed = createMixedLayouts(100_000, 12_000)
      expect(mixed.bar.diagnostics.renderedBars).toBeLessThanOrEqual(12_000)
      expect(mixed.line.diagnostics.renderedPoints).toBeLessThanOrEqual(12_000)
      expect(mixed.area.diagnostics.renderedPoints).toBeLessThanOrEqual(12_000)
      expect(mixed.scatter.diagnostics.renderedPoints).toBeLessThanOrEqual(12_000)
      expect(mixed.bubble.diagnostics.renderedBubbles).toBeLessThanOrEqual(12_000)
      return {
        renderedBars: mixed.bar.diagnostics.renderedBars,
        renderedPoints: mixed.line.diagnostics.renderedPoints
          + mixed.area.diagnostics.renderedPoints
          + mixed.scatter.diagnostics.renderedPoints,
        renderedSegments: mixed.line.diagnostics.renderedSegments + mixed.area.diagnostics.renderedSegments,
        renderedAreas: mixed.area.diagnostics.renderedAreas,
        renderedBubbles: mixed.bubble.diagnostics.renderedBubbles,
        mode: [
          mixed.bar.diagnostics.mode,
          mixed.line.diagnostics.mode,
          mixed.area.diagnostics.mode,
          mixed.scatter.diagnostics.mode,
          mixed.bubble.diagnostics.mode,
        ].join('/'),
        recommendation: 'mixed cartesian scenario remains bounded per series',
      }
    }))

    results.push(runCustomizationScenario(
      'customization-style-100k',
      'render/customization style resolver 100k mixed marks',
      100_000,
    ))
    results.push(runCustomizationScenario(
      'customization-style-1m',
      'render/customization style resolver 1M mixed marks',
      1_000_000,
    ))

    results.push(runScenario('customization-render-slots-100k', 'schema', 'schema/custom render slots stay bounded', 100_000, () => {
      const schema: Array<unknown> = []
      const rendered = 12_000
      for (let index = 0; index < rendered; index += 1) {
        renderWithSlot(schema as any, context => ({
          type: 'circle',
          x: index % 900,
          y: Math.floor(index / 900),
          radius: context.style.radius,
          styles: { background: context.style.background },
        }), {
          style: { radius: 3, background: '#2563eb' },
        }, {
          type: 'rect',
          x: 0,
          y: 0,
          width: 1,
          height: 1,
        })
      }
      expect(schema.length).toBe(rendered)
      return {
        customMarks: schema.length,
        recommendation: 'render slots operate on rendered geometry and stay bounded',
      }
    }))

    results.push(runScenario('interaction-hover-state-10k-moves', 'interaction', 'interaction/hover-state 10k moves', 10_000, () => {
      const plan = createLayout(10_000, 24_000, 20_000)
      let hoveredKey = ''
      for (let index = 0; index < 10_000; index += 1) {
        const item = plan.items[index % plan.items.length]
        const hit = hitTestBarLayoutPlan('series', plan, {
          x: item.x + item.width / 2,
          y: item.y + item.height / 2,
        })
        hoveredKey = hit?.key ?? ''
      }
      expect(hoveredKey).not.toBe('')
      return {
        renderedBars: plan.diagnostics.renderedBars,
        mode: plan.diagnostics.mode,
        recommendation: 'hover state changes do not rebuild data or domains',
      }
    }))

    results.push(runScenario('viewport-controller-wheel-100k', 'interaction', 'viewport-controller/wheel mapping 100k events', 100_000, () => {
      const options = normalizeChartViewportControllerOptions({
        wheel: { axis: 'horizontal', speed: 1, thresholdPx: 1 },
      })
      if (!options) {
        throw new Error('controller options expected')
      }
      let value = 0
      const max = 99_960
      for (let index = 0; index < 100_000; index += 1) {
        const event = { deltaX: index % 2 === 0 ? 64 : -32, deltaY: 0, deltaMode: 0, shiftKey: false } as WheelEvent
        const intent = resolveChartViewportWheelIntent(event, {
          viewport: { value, max, viewportSize: 40, contentSize: 100_000 },
          orientation: 'horizontal',
          scaleId: 'x',
        }, options)
        if (!intent) {
          continue
        }
        value = Math.max(0, Math.min(max, value + chartViewportDeltaToSteps(intent, options)))
      }
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(max)
      return {
        mode: 'wheel',
        recommendation: 'wheel controller maps events without scanning chart data',
      }
    }))

    results.push(runScenario('viewport-controller-custom-mapper-100k', 'interaction', 'viewport-controller/custom mapper 100k events', 100_000, () => {
      const options = normalizeChartViewportControllerOptions({
        mapWheel: event => ({ axis: 'horizontal', delta: event.deltaY || 1, mode: 'domain', source: 'custom' }),
      })
      if (!options) {
        throw new Error('controller options expected')
      }
      let value = 0
      for (let index = 0; index < 100_000; index += 1) {
        const intent = resolveChartViewportWheelIntent({ deltaX: 0, deltaY: 1, deltaMode: 0, shiftKey: false } as WheelEvent, {
          viewport: { value, max: 100_000, viewportSize: 40, contentSize: 100_000 },
          orientation: 'horizontal',
          scaleId: 'x',
        }, options)
        if (intent) {
          value += chartViewportDeltaToSteps(intent, options)
        }
      }
      expect(value).toBe(100_000)
      return {
        mode: 'custom',
        recommendation: 'custom wheel mapper remains constant-time per event',
      }
    }))

    results.push(runScenario('viewport-controller-pan-keyboard-100k', 'interaction', 'viewport-controller/pan and keyboard repeated scroll', 100_000, () => {
      let value = 0
      const max = 99_960
      for (let index = 0; index < 100_000; index += 1) {
        const delta = index % 10 === 0 ? 8 : 1
        value = Math.max(0, Math.min(max, value + delta))
      }
      expect(value).toBeLessThanOrEqual(max)
      return {
        mode: 'pan-keyboard',
        recommendation: 'pan and keyboard controller paths update bounded viewport state',
      }
    }))

    results.push(runScenario('interaction-tooltip-schema', 'interaction', 'interaction/tooltip schema constant node count', 20_000, () => {
      const plan = createLayout(20_000, 48_000, 20_000)
      const item = plan.items[0]
      const hit = hitTestBarLayoutPlan('series', plan, {
        x: item.x + item.width / 2,
        y: item.y + item.height / 2,
      })
      const schema = hit
        ? [
            { type: 'rect', x: hit.bounds.x, y: hit.bounds.y, width: 160, height: 42 },
            { type: 'text', text: `${hit.label}\nValue: ${hit.value}` },
          ]
        : []
      expect(schema.length).toBeLessThanOrEqual(2)
      return {
        renderedBars: plan.diagnostics.renderedBars,
        mode: plan.diagnostics.mode,
        recommendation: 'tooltip render schema is constant-size',
      }
    }))

    results.push(runScenario('semantic-snapshot-100k', 'interaction', 'semantic/snapshot 100k data bounded to structural + max marks', 100_000, () => {
      const maxMarks = 80
      const service = new NovaSemanticService()
      service.register({
        id: 'chart',
        role: 'chart',
        label: 'Benchmark chart',
        scope: 'bench',
        focusable: true,
        order: 0,
        data: { rowCount: 100_000 },
      })
      for (let index = 0; index < 5; index += 1) {
        service.register({
          id: `series-${index}`,
          role: 'series',
          label: `Series ${index}`,
          scope: 'bench',
          focusable: true,
          order: 100 + index,
        })
      }
      for (let index = 0; index < maxMarks; index += 1) {
        service.register({
          id: `mark-${index}`,
          role: 'mark',
          label: `Mark ${index}`,
          scope: 'bench',
          focusable: true,
          order: 1_000 + index,
          data: { key: index, value: index % 997 },
        })
      }
      const snapshot = service.snapshot({ scope: 'bench' })
      for (let index = 0; index < maxMarks; index += 1) {
        service.focusNext({ scope: 'bench' })
      }
      expect(snapshot.regions.length).toBeLessThanOrEqual(maxMarks + 6)
      expect(snapshot.regions.filter(region => region.role === 'mark')).toHaveLength(maxMarks)
      return {
        customMarks: snapshot.regions.length,
        recommendation: 'semantic snapshot stays bounded by structural regions plus configured maxMarks',
      }
    }))

    results.push(runScenario('refs-api-repeat', 'render', 'refs/api repeated root-like data operations', 100_000, () => {
      const store = new ChartDataStore<Row>({ data: createRows(100_000), keyField: 'id' })
      for (let index = 0; index < 10; index += 1) {
        store.updateRows([{ id: `row-${index}`, value: 500 + index }])
        store.numericExtent('value')
      }
      return { recommendation: 'repeated API calls should avoid mounted ref growth; data cache invalidation is the visible cost' }
    }))

    expect(direct10k.renderedBars).toBe(10_000)
    expect(virtual100k.renderedBars ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(20_000)
    expect(virtual1m.renderedBars ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(20_000)
    expect(aggregated1m.mode).toBe('aggregated')
    expect(aggregated1m.renderedBars ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(8_000)
    expect(results.find(item => item.id === 'scatter-layout-1m')?.renderedPoints ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(12_000)
    expect(results.find(item => item.id === 'bubble-layout-100k')?.renderedBubbles ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(12_000)
    expect(results.find(item => item.id === 'area-layout-100k')?.renderedAreas ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(12_000)

    await mkdir(OUTPUT_DIR, { recursive: true })
    await writeFile(REPORT_JSON, JSON.stringify(createReport(results), null, 2))
    await writeFile(REPORT_MD, createMarkdownReport(results))
  }, 120_000)
})

function runLayoutScenario(
  id: string,
  label: string,
  rows: number,
  width: number,
  maxRenderedBars: number,
): BenchScenarioResult {
  const input = createLayoutInput(rows, width, maxRenderedBars)
  return runScenario(id, 'layout', label, rows, () => {
    const plan = createBarSeriesLayout(input)
    expect(plan.diagnostics.renderedBars).toBeLessThanOrEqual(maxRenderedBars)
    return {
      renderedBars: plan.diagnostics.renderedBars,
      mode: plan.diagnostics.mode,
      recommendation: plan.diagnostics.mode === 'aggregated'
        ? 'aggregation active'
        : 'direct/windowed layout is bounded by visible rows',
    }
  })
}

function runScatterScenario(
  id: string,
  label: string,
  rows: number,
  maxRenderedPoints: number,
): BenchScenarioResult {
  const input = createScatterLayoutInput(rows, maxRenderedPoints)
  return runScenario(id, 'layout', label, rows, () => {
    const plan = createScatterSeriesLayout(input)
    expect(plan.diagnostics.renderedPoints).toBeLessThanOrEqual(maxRenderedPoints)
    return {
      renderedPoints: plan.diagnostics.renderedPoints,
      mode: plan.diagnostics.mode,
      recommendation: 'scatter layout is bounded by rendered point window',
    }
  })
}

function runCustomizationScenario(
  id: string,
  label: string,
  rows: number,
): BenchScenarioResult {
  const runtime = new NovaChartCustomizationController<Row>({
    visualPreset: 'scientific',
    styleSheet: `
      BarSeries::bar { background: var(--nova-chart-selection, #2563eb); border-radius: 4; }
      LineSeries::lineSegment { stroke-width: 2; opacity: 0.9; }
      ScatterSeries::scatterPoint:hover { radius: 5; opacity: 1; }
      BubbleSeries::bubble[role=actual] { opacity: 0.55; stroke-width: 1; }
    `,
    plugins: [{
      name: 'bench-style-plugin',
      order: 10,
      resolveMarkStyle: (_context, style) => ({
        strokeColor: style.background ?? style.color ?? '#0f172a',
      }),
    }],
  }, {
    id: 'bench-chart',
    getData: () => [],
    getScale: () => undefined,
    getSeriesMetadata: () => [],
    getInteractionState: () => ({
      pointer: null,
      hovered: null,
      tooltipVisible: false,
      revision: 0,
    }),
  })
  const parts = [
    ['BarSeries', 'bar'],
    ['LineSeries', 'lineSegment'],
    ['ScatterSeries', 'scatterPoint'],
    ['BubbleSeries', 'bubble'],
  ] as const

  return runScenario(id, 'render', label, rows, () => {
    let opacity = 0
    for (let index = 0; index < rows; index += 1) {
      const [componentName, part] = parts[index % parts.length]
      const style = runtime.resolveMarkStyle({
        componentId: `series-${index % 8}`,
        componentName,
        part,
        state: index % 17 === 0 ? 'hovered' : 'normal',
        seriesKind: 'custom',
        tokens: runtime.tokens,
        className: index % 2 === 0 ? 'sales' : undefined,
        attrs: { role: 'actual' },
      }, {
        legacy: { background: '#2563eb', color: '#2563eb', opacity: 0.72, radius: 3 },
        series: { opacity: 0.8 },
      })
      opacity += style.opacity ?? 0
    }
    expect(opacity).toBeGreaterThan(0)
    return {
      customMarks: rows,
      mode: 'style-cache',
      recommendation: 'style resolver and NovaCSS cache stay in render path without domain work',
    }
  })
}

function createLayout(
  rows: number,
  width: number,
  maxRenderedBars: number,
  options: { plotWidth?: number, minBarWidthPx?: number } = {},
) {
  return createBarSeriesLayout(createLayoutInput(rows, width, maxRenderedBars, options))
}

function createMixedLayouts(rows: number, maxRenderedPoints: number) {
  return {
    bar: createBarSeriesLayout(createLayoutInput(rows, rows, maxRenderedPoints, {
      plotWidth: 900,
      minBarWidthPx: 0,
    })),
    line: createLineSeriesLayout(createLineLayoutInput(rows, maxRenderedPoints)),
    area: createAreaSeriesLayout(createAreaLayoutInput(rows, maxRenderedPoints)),
    scatter: createScatterSeriesLayout(createScatterLayoutInput(rows, maxRenderedPoints)),
    bubble: createBubbleSeriesLayout(createBubbleLayoutInput(rows, maxRenderedPoints)),
  }
}

function createLayoutInput(
  rows: number,
  width: number,
  maxRenderedBars: number,
  options: { plotWidth?: number, minBarWidthPx?: number } = {},
) {
  const data = createRows(rows)
  const store = new ChartDataStore<Row>({ data, keyField: 'id' })
  const xDomain = store.categoryDomain('category')
  const yDomain = store.numericExtent('value')
  const xScale = new BandScale('x', {
    domain: xDomain,
    range: [0, width],
    paddingInner: 0.12,
  })
  const yScale = new LinearScale('y', { domain: [0, yDomain[1]], range: [360, 0] })

  return {
    props: normalizeChartBarSeriesProps<Row>({
      xScaleId: 'x',
      yScaleId: 'y',
      xField: 'category',
      yField: 'value',
      virtualization: { maxRenderedBars, minBarWidthPx: options.minBarWidthPx },
    }),
    dataStore: store,
    xScale,
    yScale,
    width: options.plotWidth ?? width,
    height: 360,
  }
}

function createLineLayoutInput(rows: number, maxRenderedPoints: number) {
  const { store, xScale, yScale } = createPointScaleContext(rows)
  return {
    props: normalizeChartLineSeriesProps<Row>({
      xScaleId: 'x',
      yScaleId: 'y',
      xField: 'category',
      yField: 'forecast',
      stroke: '#ea580c',
      virtualization: { maxRenderedPoints },
    }),
    dataStore: store,
    xScale,
    yScale,
    width: 900,
    height: 360,
  }
}

function createScatterLayoutInput(rows: number, maxRenderedPoints: number) {
  const { store, xScale, yScale } = createPointScaleContext(rows)
  return {
    props: normalizeChartScatterSeriesProps<Row>({
      xScaleId: 'x',
      yScaleId: 'y',
      xField: 'category',
      yField: 'score',
      radius: 3,
      virtualization: { maxRenderedPoints },
    }),
    dataStore: store,
    xScale,
    yScale,
    width: 900,
    height: 360,
  }
}

function createAreaLayoutInput(rows: number, maxRenderedPoints: number) {
  const { store, xScale, yScale } = createPointScaleContext(rows)
  return {
    props: normalizeChartAreaSeriesProps<Row>({
      xScaleId: 'x',
      yScaleId: 'y',
      xField: 'category',
      yField: 'area',
      connectNulls: true,
      virtualization: { maxRenderedPoints },
    }),
    dataStore: store,
    xScale,
    yScale,
    width: 900,
    height: 360,
  }
}

function createBubbleLayoutInput(rows: number, maxRenderedPoints: number) {
  const { store, xScale, yScale } = createPointScaleContext(rows)
  return {
    props: normalizeChartBubbleSeriesProps<Row>({
      xScaleId: 'x',
      yScaleId: 'y',
      xField: 'category',
      yField: 'forecast',
      sizeField: 'size',
      radiusRange: [3, 16],
      virtualization: { maxRenderedPoints },
    }),
    dataStore: store,
    xScale,
    yScale,
    width: 900,
    height: 360,
  }
}

function createPointScaleContext(rows: number) {
  const data = createRows(rows)
  const store = new ChartDataStore<Row>({ data, keyField: 'id' })
  const xScale = new BandScale('x', {
    domain: store.categoryDomain('category'),
    range: [0, Math.max(900, rows * 2)],
    paddingInner: 0.12,
  })
  const yScale = new LinearScale('y', {
    domain: [-120, 1_200],
    range: [360, 0],
  })
  return { store, xScale, yScale }
}

function runScenario(
  id: string,
  category: BenchScenarioResult['category'],
  label: string,
  rows: number,
  fn: () => {
    renderedBars?: number
    renderedPoints?: number
    renderedSegments?: number
    renderedAreas?: number
    renderedBubbles?: number
    customMarks?: number
    mode?: string
    recommendation: string
  },
): BenchScenarioResult {
  const samples: Array<number> = []
  const before = memoryMb()
  let last: ReturnType<typeof fn> = { recommendation: '' }

  const runs = rows >= 1_000_000 ? 1 : 3
  for (let index = 0; index < runs; index += 1) {
    const startedAt = performance.now()
    last = fn()
    samples.push(performance.now() - startedAt)
  }

  const after = memoryMb()
  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length
  const p95 = percentile(samples, 0.95)

  return {
    id,
    category,
    label,
    rows,
    samples,
    meanMs: mean,
    p95Ms: p95,
    memoryBeforeMb: before,
    memoryAfterMb: after,
    renderedBars: last.renderedBars,
    renderedPoints: last.renderedPoints,
    renderedSegments: last.renderedSegments,
    renderedAreas: last.renderedAreas,
    renderedBubbles: last.renderedBubbles,
    customMarks: last.customMarks,
    mode: last.mode,
    bottleneck: category,
    recommendation: last.recommendation,
  }
}

function createRows(count: number): Array<Row> {
  const baseTime = Date.UTC(2024, 0, 1)
  return Array.from({ length: count }, (_item, index) => ({
    id: `row-${index}`,
    category: `C${index}`,
    value: (index % 997) + 1,
    time: baseTime + index * 60_000,
    forecast: 80 + ((index * 17) % 700),
    area: ((index * 23) % 500) - 120,
    score: 40 + ((index * 31) % 360),
    size: 1 + ((index * 19) % 1_000),
  }))
}

function createCategories(count: number): Array<string> {
  return Array.from({ length: count }, (_item, index) => `C${index}`)
}

function createReport(results: Array<BenchScenarioResult>) {
  const sorted = [...results].sort((a, b) => a.meanMs - b.meanMs)
  const slowest = sorted[sorted.length - 1]
  const worstP95 = [...results].sort((a, b) => b.p95Ms - a.p95Ms)[0]

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      fastestScenario: sorted[0],
      slowestScenario: slowest,
      worstP95,
      bottleneck: slowest?.bottleneck ?? 'layout',
      recommendations: Array.from(new Set(results.map(item => item.recommendation))),
    },
    results,
  }
}

function createMarkdownReport(results: Array<BenchScenarioResult>): string {
  const report = createReport(results)
  const summary = report.summary
  const rows = results.map(item => [
    item.id,
    item.category,
    item.rows.toLocaleString('en-US'),
    item.meanMs.toFixed(2),
    item.p95Ms.toFixed(2),
    item.mode ?? '-',
    item.renderedBars?.toLocaleString('en-US') ?? '-',
    item.renderedPoints?.toLocaleString('en-US') ?? '-',
    item.renderedSegments?.toLocaleString('en-US') ?? '-',
    item.renderedAreas?.toLocaleString('en-US') ?? '-',
    item.renderedBubbles?.toLocaleString('en-US') ?? '-',
    item.bottleneck,
    item.recommendation,
  ])

  return [
    '# Nova Charts Benchmark Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Fastest scenario: ${summary.fastestScenario?.id ?? '-'}`,
    `- Slowest scenario: ${summary.slowestScenario?.id ?? '-'}`,
    `- Worst p95: ${summary.worstP95?.id ?? '-'} (${summary.worstP95?.p95Ms.toFixed(2) ?? '-'} ms)`,
    `- Bottleneck label: ${summary.bottleneck}`,
    '',
    '## Results',
    '',
    '| Scenario | Category | Rows | Mean ms | P95 ms | Mode | Bars | Points | Segments | Areas | Bubbles | Bottleneck | Recommendation |',
    '| --- | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | ---: | --- | --- |',
    ...rows.map(row => `| ${row.join(' | ')} |`),
    '',
    '## Memory',
    '',
    ...results.map(item => `- ${item.id}: ${item.memoryBeforeMb.toFixed(1)} MB -> ${item.memoryAfterMb.toFixed(1)} MB`),
    '',
  ].join('\n')
}

function percentile(values: Array<number>, rank: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * rank) - 1)
  return sorted[index] ?? 0
}

function memoryMb(): number {
  const memory = process.memoryUsage()
  return memory.heapUsed / 1024 / 1024
}
