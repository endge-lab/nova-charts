import { describe, expect, it } from 'vitest'
import { ChartAxisModel } from '@/model/axis/ChartAxisModel'
import { BandScale } from '@/model/scale/BandScale'
import { ChartScaleRegistry } from '@/model/scale/ChartScaleRegistry'
import { createChartScale } from '@/model/scale/create-chart-scale'
import { LinearScale } from '@/model/scale/LinearScale'
import { TimeScale } from '@/model/scale/TimeScale'

describe('linearScale', () => {
  it('maps values to pixels and back', () => {
    const scale = new LinearScale('value', {
      domain: [10, 20],
      range: [100, 300],
    })

    expect(scale.toPx(15)).toBe(200)
    expect(scale.fromPx(250)).toBe(17.5)
  })

  it('creates readable numeric ticks', () => {
    const scale = new LinearScale('value', {
      domain: [0, 100],
      range: [0, 500],
    })

    expect(scale.ticks({ maxCount: 5 }).map(tick => tick.value)).toEqual([0, 20, 40, 60, 80, 100])
  })
})

describe('bandScale', () => {
  it('maps categories to bands and exposes centers', () => {
    const scale = new BandScale('groups', {
      domain: ['a', 'b', 'c'],
      range: [0, 300],
    })

    expect(scale.toPx('b')).toBe(100)
    expect(scale.center('b')).toBe(150)
    expect(scale.bandwidth()).toBe(100)
    expect(scale.fromPx(240)).toBe('c')
  })

  it('supports explicit tick values, labels and category step', () => {
    const scale = new BandScale('groups', {
      domain: ['a', 'b', 'c', 'd', 'e'],
      range: [0, 500],
    })

    expect(scale.ticks({
      categoryStep: 2,
      labels: { a: 'Alpha', c: 'Charlie', e: 'Echo' },
    }).map(tick => tick.label)).toEqual(['Alpha', 'Charlie', 'Echo'])

    expect(scale.ticks({
      values: [
        { value: 'b', label: 'Beta' },
        'd',
      ],
      labels: { d: 'Delta' },
    }).map(tick => tick.label)).toEqual(['Beta', 'Delta'])
  })
})

describe('timeScale', () => {
  it('creates calendar month ticks without approximating month as 30 days', () => {
    const scale = new TimeScale('time', {
      domain: [
        Date.UTC(2026, 0, 15),
        Date.UTC(2026, 3, 15),
      ],
      range: [0, 400],
      timezone: 'UTC',
      locale: 'en-US',
    })

    const ticks = scale.ticks({
      unit: 'month',
      format: { month: 'short' },
    })

    expect(ticks.map(tick => new Date(tick.value).toISOString().slice(0, 10))).toEqual([
      '2026-02-01',
      '2026-03-01',
      '2026-04-01',
    ])
    expect(ticks.map(tick => tick.label)).toEqual(['Feb', 'Mar', 'Apr'])
  })

  it('uses timezone-aware day boundaries', () => {
    const scale = new TimeScale('time', {
      domain: [
        Date.UTC(2026, 4, 15, 20),
        Date.UTC(2026, 4, 17, 20),
      ],
      range: [0, 480],
      timezone: 'Europe/Moscow',
      locale: 'en-US',
    })

    const ticks = scale.ticks({
      unit: 'day',
      format: { day: '2-digit' },
    })

    expect(ticks.map(tick => new Date(tick.value).toISOString())).toEqual([
      '2026-05-15T21:00:00.000Z',
      '2026-05-16T21:00:00.000Z',
    ])
  })
})

describe('chartScaleRegistry', () => {
  it('stores scales by id and updates ranges', () => {
    const registry = new ChartScaleRegistry()
    registry.register(createChartScale({
      id: 'value',
      type: 'linear',
      domain: [0, 1],
    }))

    registry.setRange('value', [0, 100])

    expect(registry.require<number>('value').toPx(0.5)).toBe(50)
  })
})

describe('chartAxisModel', () => {
  it('creates axis render plans from registered scales', () => {
    const registry = new ChartScaleRegistry()
    registry.register(new LinearScale('value', {
      domain: [0, 100],
    }))

    const axis = new ChartAxisModel(registry)
    const plan = axis.createRenderPlan({
      scaleId: 'value',
      orientation: 'horizontal',
      rect: {
        x: 10,
        y: 20,
        width: 200,
        height: 40,
      },
      ticks: {
        maxCount: 4,
      },
    })

    expect(plan.baseline).toEqual({
      x1: 10,
      y1: 60,
      x2: 210,
      y2: 60,
    })
    expect(plan.ticks[0]).toMatchObject({
      value: 0,
      x1: 10,
      y1: 60,
    })
  })
})
