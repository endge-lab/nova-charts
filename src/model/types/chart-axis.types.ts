import type { ChartScaleTick, ChartScaleTickOptions } from '@/model/types/chart-scale.types'

export type ChartAxisOrientation = 'horizontal' | 'vertical'

export type ChartAxisLabelSide = 'start' | 'end'

export interface ChartAxisRect {
  x: number
  y: number
  width: number
  height: number
}

export interface ChartAxisOptions {
  scaleId: string
  orientation: ChartAxisOrientation
  rect: ChartAxisRect
  tickSize?: number
  labelPadding?: number
  tickSide?: ChartAxisLabelSide
  labelSide?: ChartAxisLabelSide
  ticks?: ChartScaleTickOptions
}

export interface ChartAxisRenderTick {
  value: number | string
  label: string
  major: boolean
  x1: number
  y1: number
  x2: number
  y2: number
  labelX: number
  labelY: number
}

export interface ChartAxisRenderPlan {
  scaleId: string
  orientation: ChartAxisOrientation
  rect: ChartAxisRect
  baseline: {
    x1: number
    y1: number
    x2: number
    y2: number
  }
  ticks: Array<ChartAxisRenderTick>
  sourceTicks: Array<ChartScaleTick>
}
