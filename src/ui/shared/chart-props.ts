import {
  NOVA_UI_COMMON_DIRTY_POLICY,
  NOVA_UI_COMMON_FIELD_DEFINITIONS,
  finiteNumber,
  normalizeCommonProps,
} from '@endge/nova-ui-kit'
import { DEFAULT_BAR_VIRTUALIZATION } from '@/model/bar/create-bar-series-layout'
import { DEFAULT_LINE_VIRTUALIZATION } from '@/model/line/create-line-series-layout'
import { DEFAULT_POINT_SERIES_VIRTUALIZATION } from '@/model/cartesian/point-series'
import type {
  NovaChartAreaSeriesProps,
  NovaChartAreaSeriesResolvedProps,
  NovaChartAxisProps,
  NovaChartAxisResolvedProps,
  NovaChartBarChartProps,
  NovaChartBarChartResolvedProps,
  NovaChartBubbleSeriesProps,
  NovaChartBubbleSeriesResolvedProps,
  NovaChartComposedChartProps,
  NovaChartComposedChartResolvedProps,
  NovaChartInteractionProps,
  NovaChartInteractionResolvedProps,
  NovaChartBarSeriesProps,
  NovaChartBarSeriesResolvedProps,
  NovaChartLegendProps,
  NovaChartLegendResolvedProps,
  NovaChartLineSeriesProps,
  NovaChartLineSeriesResolvedProps,
  NovaChartPointSeriesVirtualizationOptions,
  NovaChartScatterSeriesProps,
  NovaChartScatterSeriesResolvedProps,
  NovaChartGridProps,
  NovaChartGridResolvedProps,
  NovaChartPlotProps,
  NovaChartPlotResolvedProps,
  NovaChartRootProps,
  NovaChartRootResolvedProps,
  NovaChartScaleProps,
  NovaChartScaleResolvedProps,
  NovaChartTooltipProps,
  NovaChartTooltipResolvedProps,
  NovaChartViewportProps,
  NovaChartViewportResolvedProps,
} from '@/model/types/chart-components.types'

export const NOVA_CHARTS_COMMON_FIELD_DEFINITIONS = {
  ...NOVA_UI_COMMON_FIELD_DEFINITIONS,
  styleSheet: { type: 'string' },
  visualPreset: { type: 'string' },
  plugins: { type: 'array' },
  accessibility: { type: 'record' },
  states: { type: 'record' },
  parts: { type: 'record' },
  renderers: { type: 'record' },
} as const

export const NOVA_CHARTS_COMMON_DIRTY_POLICY = {
  ...NOVA_UI_COMMON_DIRTY_POLICY,
  render: [
    ...(NOVA_UI_COMMON_DIRTY_POLICY.render ?? []),
    'styleSheet',
    'visualPreset',
    'plugins',
    'accessibility',
    'states',
    'parts',
    'renderers',
  ],
} as any

export function normalizeChartRootProps<TData>(
  props: NovaChartRootProps<TData> = {},
): NovaChartRootResolvedProps<TData> {
  return {
    ...normalizeCommonProps(props, {
      width: 720,
      height: 420,
      background: '#ffffff',
      clip: false,
    }),
    data: props.data ? [...props.data] : [],
    keyField: props.keyField,
    refScope: props.refScope,
    styleSheet: props.styleSheet,
    visualPreset: props.visualPreset,
    plugins: props.plugins ? [...props.plugins] : undefined,
    accessibility: normalizeChartAccessibilityOptions(props.accessibility),
  }
}

export function normalizeChartScaleProps<TData>(
  props: NovaChartScaleProps<TData>,
): NovaChartScaleResolvedProps<TData> {
  return {
    ...normalizeCommonProps(props, { width: 0, height: 0, clip: false }),
    scaleId: props.scaleId,
    scaleType: props.scaleType,
    field: props.field,
    domain: props.domain,
    zero: props.zero ?? props.scaleType !== 'band',
    nice: props.nice ?? props.scaleType !== 'band',
    clamp: props.clamp ?? false,
    paddingInner: finiteNumber(props.paddingInner, 0.18),
    paddingOuter: finiteNumber(props.paddingOuter, 0.08),
    locale: props.locale ?? 'ru-RU',
    timezone: props.timezone ?? 'UTC',
  }
}

export function normalizeChartPlotProps(
  props: NovaChartPlotProps = {},
): NovaChartPlotResolvedProps {
  return {
    ...normalizeCommonProps(props, {
      width: 560,
      height: 300,
      clip: true,
    }),
    chartRef: props.chartRef,
    xScaleId: props.xScaleId,
    yScaleId: props.yScaleId,
  }
}

export function normalizeChartAxisProps(
  props: NovaChartAxisProps,
): NovaChartAxisResolvedProps {
  return {
    ...normalizeCommonProps(props, {
      width: 560,
      height: 36,
      clip: true,
      fontSize: 11,
      lineHeight: 14,
    }),
    chartRef: props.chartRef,
    scaleId: props.scaleId,
    orientation: props.orientation,
    tickSide: props.tickSide ?? 'end',
    labelSide: props.labelSide ?? props.tickSide ?? 'end',
    labelRotation: props.labelRotation ?? 0,
    tickSize: finiteNumber(props.tickSize, 5),
    labelPadding: finiteNumber(props.labelPadding, 5),
    ticks: props.ticks,
    lineColor: props.lineColor ?? '#d5deea',
    tickColor: props.tickColor ?? '#ccd6e3',
    labelColor: props.labelColor ?? '#64748b',
  }
}

export function normalizeChartGridProps(
  props: NovaChartGridProps = {},
): NovaChartGridResolvedProps {
  return {
    ...normalizeCommonProps(props, {
      width: 560,
      height: 300,
      clip: true,
    }),
    chartRef: props.chartRef,
    xScaleId: props.xScaleId,
    yScaleId: props.yScaleId,
    xTicks: props.xTicks,
    yTicks: props.yTicks,
    lineColor: props.lineColor ?? '#eef2f7',
  }
}

export function normalizeChartBarSeriesProps<TData>(
  props: NovaChartBarSeriesProps<TData>,
): NovaChartBarSeriesResolvedProps<TData> {
  const orientation = props.orientation ?? 'vertical'
  const categoryField = props.categoryField ?? props.xField
  const valueField = props.valueField ?? props.yField
  if (!categoryField) throw new Error('[NovaCharts] BarSeries requires categoryField or xField')
  if (!valueField) throw new Error('[NovaCharts] BarSeries requires valueField or yField')

  return {
    ...normalizeCommonProps(props, {
      width: 560,
      height: 300,
      clip: true,
    }),
    chartRef: props.chartRef,
    xScaleId: props.xScaleId,
    yScaleId: props.yScaleId,
    xField: props.xField,
    yField: props.yField,
    categoryField,
    valueField,
    seriesField: props.seriesField,
    labelField: props.labelField,
    orientation,
    mode: props.mode ?? (props.seriesField ? 'grouped' : 'single'),
    fill: props.fill ?? '#2563eb',
    radius: Math.max(0, finiteNumber(props.radius, 2)),
    minBarSize: Math.max(0, finiteNumber(props.minBarSize, 1)),
    virtualization: {
      enabled: props.virtualization?.enabled ?? DEFAULT_BAR_VIRTUALIZATION.enabled,
      overscanPx: finiteNumber(props.virtualization?.overscanPx, DEFAULT_BAR_VIRTUALIZATION.overscanPx),
      minBarWidthPx: finiteNumber(props.virtualization?.minBarWidthPx, DEFAULT_BAR_VIRTUALIZATION.minBarWidthPx),
      maxRenderedBars: Math.max(1, Math.trunc(finiteNumber(
        props.virtualization?.maxRenderedBars,
        DEFAULT_BAR_VIRTUALIZATION.maxRenderedBars,
      ))),
      aggregation: props.virtualization?.aggregation ?? DEFAULT_BAR_VIRTUALIZATION.aggregation,
    },
    highlight: {
      enabled: props.highlight?.enabled ?? props.colors?.highlight?.enabled ?? true,
      fill: props.highlight?.fill ?? props.colors?.highlight?.fill ?? '#1d4ed8',
      strokeColor: props.highlight?.strokeColor ?? props.colors?.highlight?.strokeColor ?? '#1e40af',
      strokeWidth: Math.max(0, finiteNumber(props.highlight?.strokeWidth, props.colors?.highlight?.strokeWidth ?? 0)),
      opacity: Math.max(0, Math.min(1, finiteNumber(props.highlight?.opacity, props.colors?.highlight?.opacity ?? 1))),
    },
    labels: {
      visible: props.labels?.visible ?? false,
      position: props.labels?.position ?? 'outside',
      color: props.labels?.color ?? '#0f172a',
      fontSize: Math.max(8, finiteNumber(props.labels?.fontSize, 11)),
      fontWeight: props.labels?.fontWeight ?? '700',
      formatter: props.labels?.formatter,
    },
    colors: {
      palette: props.colors?.palette?.length ? [...props.colors.palette] : [
        '#2563eb',
        '#16a34a',
        '#f59e0b',
        '#dc2626',
        '#7c3aed',
        '#0891b2',
        '#db2777',
        '#475569',
      ],
      colorField: props.colors?.colorField,
      fill: props.colors?.fill,
      highlight: props.colors?.highlight,
    },
    style: props.style,
    states: props.states ? { ...props.states } : undefined,
    parts: props.parts ? { ...props.parts } : undefined,
    renderers: props.renderers ? { ...props.renderers } : undefined,
    motion: props.motion,
  }
}

export function normalizeChartLineSeriesProps<TData>(
  props: NovaChartLineSeriesProps<TData>,
): NovaChartLineSeriesResolvedProps<TData> {
  return {
    ...normalizeCommonProps(props, {
      width: 560,
      height: 300,
      clip: true,
    }),
    chartRef: props.chartRef,
    xScaleId: props.xScaleId,
    yScaleId: props.yScaleId,
    xField: props.xField,
    yField: props.yField,
    seriesField: props.seriesField,
    labelField: props.labelField,
    curve: props.curve ?? 'linear',
    stroke: props.stroke ?? '#ea580c',
    strokeWidth: Math.max(1, finiteNumber(props.strokeWidth, 2)),
    opacity: Math.max(0, Math.min(1, finiteNumber(props.opacity, 1))),
    dashPattern: props.dashPattern ? [...props.dashPattern] : undefined,
    markers: {
      visible: props.markers?.visible ?? false,
      radius: props.markers?.radius ?? 3,
      fill: props.markers?.fill,
      strokeColor: props.markers?.strokeColor,
      strokeWidth: Math.max(0, finiteNumber(props.markers?.strokeWidth, 1.5)),
    },
    colors: {
      palette: props.colors?.palette?.length ? [...props.colors.palette] : [
        '#ea580c',
        '#0ea5e9',
        '#16a34a',
        '#7c3aed',
        '#dc2626',
        '#0891b2',
        '#db2777',
        '#475569',
      ],
      colorField: props.colors?.colorField,
      stroke: props.colors?.stroke,
    },
    defined: props.defined,
    connectNulls: props.connectNulls ?? false,
    hitRadiusPx: Math.max(0, finiteNumber(props.hitRadiusPx, 12)),
    virtualization: {
      enabled: props.virtualization?.enabled ?? DEFAULT_LINE_VIRTUALIZATION.enabled,
      overscanPx: finiteNumber(props.virtualization?.overscanPx, DEFAULT_LINE_VIRTUALIZATION.overscanPx),
      maxRenderedPoints: Math.max(2, Math.trunc(finiteNumber(
        props.virtualization?.maxRenderedPoints,
        DEFAULT_LINE_VIRTUALIZATION.maxRenderedPoints,
      ))),
    },
    style: props.style,
    states: props.states ? { ...props.states } : undefined,
    parts: props.parts ? { ...props.parts } : undefined,
    renderers: props.renderers ? { ...props.renderers } : undefined,
    motion: props.motion,
  }
}

export function normalizeChartScatterSeriesProps<TData>(
  props: NovaChartScatterSeriesProps<TData>,
): NovaChartScatterSeriesResolvedProps<TData> {
  return {
    ...normalizeCommonProps(props, {
      width: 560,
      height: 300,
      clip: true,
    }),
    chartRef: props.chartRef,
    xScaleId: props.xScaleId,
    yScaleId: props.yScaleId,
    xField: props.xField,
    yField: props.yField,
    seriesField: props.seriesField,
    labelField: props.labelField,
    radius: props.radius ?? 4,
    fill: props.fill,
    strokeColor: props.strokeColor,
    strokeWidth: Math.max(0, finiteNumber(props.strokeWidth, 1)),
    opacity: Math.max(0, Math.min(1, finiteNumber(props.opacity, 0.9))),
    colors: {
      palette: props.colors?.palette?.length ? [...props.colors.palette] : [
        '#2563eb',
        '#16a34a',
        '#f59e0b',
        '#dc2626',
        '#7c3aed',
        '#0891b2',
        '#db2777',
        '#475569',
      ],
      colorField: props.colors?.colorField,
      fill: props.colors?.fill,
    },
    highlight: {
      enabled: props.highlight?.enabled ?? true,
      fill: props.highlight?.fill ?? '#1d4ed8',
      strokeColor: props.highlight?.strokeColor ?? '#1e40af',
      strokeWidth: Math.max(0, finiteNumber(props.highlight?.strokeWidth, 1.5)),
      opacity: Math.max(0, Math.min(1, finiteNumber(props.highlight?.opacity, 1))),
      radiusDelta: finiteNumber(props.highlight?.radiusDelta, 2),
    },
    hitRadiusPx: Math.max(0, finiteNumber(props.hitRadiusPx, 12)),
    virtualization: normalizePointVirtualization(props.virtualization),
    style: props.style,
    states: props.states ? { ...props.states } : undefined,
    parts: props.parts ? { ...props.parts } : undefined,
    renderers: props.renderers ? { ...props.renderers } : undefined,
    motion: props.motion,
  }
}

export function normalizeChartAreaSeriesProps<TData>(
  props: NovaChartAreaSeriesProps<TData>,
): NovaChartAreaSeriesResolvedProps<TData> {
  return {
    ...normalizeCommonProps(props, {
      width: 560,
      height: 300,
      clip: true,
    }),
    chartRef: props.chartRef,
    xScaleId: props.xScaleId,
    yScaleId: props.yScaleId,
    xField: props.xField,
    yField: props.yField,
    seriesField: props.seriesField,
    labelField: props.labelField,
    curve: props.curve ?? 'linear',
    baselineValue: finiteNumber(props.baselineValue, 0),
    baselineField: props.baselineField,
    mode: props.mode ?? 'single',
    fill: props.fill ?? '#bfdbfe',
    stroke: props.stroke ?? '#2563eb',
    strokeWidth: Math.max(0, finiteNumber(props.strokeWidth, 2)),
    opacity: Math.max(0, Math.min(1, finiteNumber(props.opacity, 0.32))),
    colors: {
      palette: props.colors?.palette?.length ? [...props.colors.palette] : [
        '#2563eb',
        '#16a34a',
        '#f59e0b',
        '#dc2626',
        '#7c3aed',
        '#0891b2',
        '#db2777',
        '#475569',
      ],
      colorField: props.colors?.colorField,
      fill: props.colors?.fill,
      stroke: props.colors?.stroke,
    },
    markers: {
      visible: props.markers?.visible ?? false,
      radius: props.markers?.radius ?? 3,
      fill: props.markers?.fill,
      strokeColor: props.markers?.strokeColor,
      strokeWidth: Math.max(0, finiteNumber(props.markers?.strokeWidth, 1.5)),
    },
    defined: props.defined,
    connectNulls: props.connectNulls ?? false,
    hitRadiusPx: Math.max(0, finiteNumber(props.hitRadiusPx, 12)),
    virtualization: normalizePointVirtualization(props.virtualization),
    style: props.style,
    states: props.states ? { ...props.states } : undefined,
    parts: props.parts ? { ...props.parts } : undefined,
    renderers: props.renderers ? { ...props.renderers } : undefined,
    motion: props.motion,
  }
}

export function normalizeChartBubbleSeriesProps<TData>(
  props: NovaChartBubbleSeriesProps<TData>,
): NovaChartBubbleSeriesResolvedProps<TData> {
  const radiusRange = props.radiusRange ?? [props.minRadius ?? 4, props.maxRadius ?? 18]
  const minRadius = Math.max(0, finiteNumber(props.minRadius, radiusRange[0]))
  const maxRadius = Math.max(minRadius, finiteNumber(props.maxRadius, radiusRange[1]))

  return {
    ...normalizeCommonProps(props, {
      width: 560,
      height: 300,
      clip: true,
    }),
    chartRef: props.chartRef,
    xScaleId: props.xScaleId,
    yScaleId: props.yScaleId,
    xField: props.xField,
    yField: props.yField,
    sizeField: props.sizeField,
    seriesField: props.seriesField,
    labelField: props.labelField,
    radiusRange: [minRadius, maxRadius],
    sizeScale: props.sizeScale ?? 'sqrt',
    minRadius,
    maxRadius,
    fill: props.fill,
    strokeColor: props.strokeColor,
    strokeWidth: Math.max(0, finiteNumber(props.strokeWidth, 1)),
    opacity: Math.max(0, Math.min(1, finiteNumber(props.opacity, 0.58))),
    colors: {
      palette: props.colors?.palette?.length ? [...props.colors.palette] : [
        '#0ea5e9',
        '#f97316',
        '#16a34a',
        '#7c3aed',
        '#dc2626',
        '#0891b2',
        '#db2777',
        '#475569',
      ],
      colorField: props.colors?.colorField,
      fill: props.colors?.fill,
    },
    highlight: {
      enabled: props.highlight?.enabled ?? true,
      fill: props.highlight?.fill ?? '#0284c7',
      strokeColor: props.highlight?.strokeColor ?? '#0f172a',
      strokeWidth: Math.max(0, finiteNumber(props.highlight?.strokeWidth, 1.5)),
      opacity: Math.max(0, Math.min(1, finiteNumber(props.highlight?.opacity, 0.82))),
      radiusDelta: finiteNumber(props.highlight?.radiusDelta, 2),
    },
    hitRadiusPx: Math.max(0, finiteNumber(props.hitRadiusPx, 8)),
    virtualization: normalizePointVirtualization(props.virtualization),
    style: props.style,
    states: props.states ? { ...props.states } : undefined,
    parts: props.parts ? { ...props.parts } : undefined,
    renderers: props.renderers ? { ...props.renderers } : undefined,
    motion: props.motion,
  }
}

export function normalizeChartInteractionProps(
  props: NovaChartInteractionProps = {},
): NovaChartInteractionResolvedProps {
  return {
    ...normalizeCommonProps(props, {
      width: 560,
      height: 300,
      clip: false,
      cursor: { hover: 'pointer' },
    }),
    chartRef: props.chartRef,
    enabled: props.enabled ?? true,
    hover: props.hover ?? true,
    tooltip: props.tooltip ?? true,
    mode: props.mode ?? 'exact',
    maxDistancePx: Math.max(0, finiteNumber(props.maxDistancePx, 16)),
    seriesIds: props.seriesIds ? [...props.seriesIds] : [],
  }
}

export function normalizeChartTooltipProps(
  props: NovaChartTooltipProps = {},
): NovaChartTooltipResolvedProps {
  return {
    ...normalizeCommonProps(props, {
      width: 560,
      height: 300,
      clip: false,
      opacity: 1,
      background: '#111827',
      color: '#ffffff',
      border: { width: 1, color: '#111827', radius: 6 },
      fontSize: 12,
      lineHeight: 16,
      padding: 8,
    }),
    chartRef: props.chartRef,
    enabled: props.enabled ?? true,
    offsetX: finiteNumber(props.offsetX, 12),
    offsetY: finiteNumber(props.offsetY, 12),
    maxWidth: Math.max(96, finiteNumber(props.maxWidth, 220)),
    background: props.background ?? '#111827',
    color: props.color ?? '#ffffff',
    borderColor: props.borderColor ?? '#111827',
    content: props.content ?? null,
    contentFormatter: props.contentFormatter,
    labelFormatter: props.labelFormatter,
    valueFormatter: props.valueFormatter,
    placement: props.placement ?? 'cursor',
    collision: {
      boundary: props.collision?.boundary ?? 'parent',
      padding: Math.max(0, finiteNumber(props.collision?.padding, 8)),
      flip: props.collision?.flip ?? true,
      shift: props.collision?.shift ?? true,
    },
    followCursor: props.followCursor ?? true,
    animation: props.animation === false
      ? false
      : {
          type: props.animation?.type ?? 'fade-scale',
          duration: Math.max(0, finiteNumber(props.animation?.duration, 120)),
          easing: props.animation?.easing ?? 'outCubic',
        },
    renderers: props.renderers ? { ...props.renderers } : undefined,
  }
}

export function normalizeChartViewportProps(
  props: NovaChartViewportProps,
): NovaChartViewportResolvedProps {
  return {
    ...normalizeCommonProps(props, {
      width: 560,
      height: 300,
      clip: false,
    }),
    chartRef: props.chartRef,
    scaleId: props.scaleId,
    orientation: props.orientation ?? 'horizontal',
    enabled: props.enabled ?? true,
    value: Math.max(0, finiteNumber(props.value, 0)),
    visibleCount: props.visibleCount === undefined ? undefined : Math.max(1, Math.trunc(finiteNumber(props.visibleCount, 1))),
    wheelStep: Math.max(1, finiteNumber(props.wheelStep, 3)),
    scrollbar: props.scrollbar ?? {},
    onChange: props.onChange,
  }
}

export function normalizeChartLegendProps(
  props: NovaChartLegendProps = {},
): NovaChartLegendResolvedProps {
  return {
    ...normalizeCommonProps(props, {
      width: 160,
      height: 80,
      clip: true,
      fontSize: 11,
      lineHeight: 16,
      color: '#475569',
      padding: 6,
    }),
    chartRef: props.chartRef,
    orientation: props.orientation ?? 'vertical',
    hiddenSeriesIds: props.hiddenSeriesIds ? [...props.hiddenSeriesIds] : [],
    labels: { ...(props.labels ?? {}) },
  }
}

export function normalizeChartBarChartProps<TData>(
  props: NovaChartBarChartProps<TData>,
): NovaChartBarChartResolvedProps<TData> {
  const grid = props.grid ?? true
  const legend = props.legend ?? !!props.seriesField
  const tooltip = props.tooltip ?? true
  const interaction = props.interaction ?? true
  const viewport = props.viewport ?? false

  return {
    ...normalizeCommonProps(props, {
      width: 720,
      height: 420,
      background: '#ffffff',
      clip: true,
      padding: 0,
    }),
    data: props.data ? [...props.data] : [],
    keyField: props.keyField,
    categoryField: props.categoryField,
    valueField: props.valueField,
    seriesField: props.seriesField,
    orientation: props.orientation ?? 'vertical',
    mode: props.mode ?? (props.seriesField ? 'grouped' : 'single'),
    axes: {
      category: {
        visible: props.axes?.category?.visible ?? true,
        width: Math.max(24, finiteNumber(props.axes?.category?.width, 56)),
        height: Math.max(24, finiteNumber(props.axes?.category?.height, 52)),
        ticks: props.axes?.category?.ticks,
      },
      value: {
        visible: props.axes?.value?.visible ?? true,
        width: Math.max(24, finiteNumber(props.axes?.value?.width, 58)),
        height: Math.max(24, finiteNumber(props.axes?.value?.height, 44)),
        ticks: props.axes?.value?.ticks,
      },
    },
    grid,
    legend,
    tooltip,
    interaction,
    viewport,
    colors: {
      palette: props.colors?.palette?.length ? [...props.colors.palette] : [
        '#2563eb',
        '#16a34a',
        '#f59e0b',
        '#dc2626',
        '#7c3aed',
        '#0891b2',
        '#db2777',
        '#475569',
      ],
      colorField: props.colors?.colorField,
      fill: props.colors?.fill,
      highlight: props.colors?.highlight,
    },
    labels: {
      visible: props.labels?.visible ?? false,
      position: props.labels?.position ?? 'outside',
      color: props.labels?.color ?? '#0f172a',
      fontSize: Math.max(8, finiteNumber(props.labels?.fontSize, 11)),
      fontWeight: props.labels?.fontWeight ?? '700',
      formatter: props.labels?.formatter,
    },
    children: props.children ? [...props.children] : [],
    styleSheet: props.styleSheet,
    visualPreset: props.visualPreset,
    plugins: props.plugins ? [...props.plugins] : undefined,
    accessibility: normalizeChartAccessibilityOptions(props.accessibility),
    states: props.states ? { ...props.states } : undefined,
    parts: props.parts ? { ...props.parts } : undefined,
    renderers: props.renderers ? { ...props.renderers } : undefined,
  }
}

export function normalizeChartComposedChartProps<TData>(
  props: NovaChartComposedChartProps<TData>,
): NovaChartComposedChartResolvedProps<TData> {
  const grid = props.grid ?? true
  const axes = props.axes ?? true
  const legend = props.legend ?? true
  const tooltip = props.tooltip ?? true
  const interaction = props.interaction ?? true
  const viewport = props.viewport ?? false

  return {
    ...normalizeCommonProps(props, {
      width: 760,
      height: 420,
      background: '#ffffff',
      clip: true,
      padding: 0,
    }),
    data: props.data ? [...props.data] : [],
    keyField: props.keyField,
    xAxis: {
      scaleId: props.xAxis?.scaleId ?? 'x',
      scaleType: props.xAxis?.scaleType ?? 'band',
      field: props.xAxis?.field,
      domain: props.xAxis?.domain,
      zero: props.xAxis?.zero ?? props.xAxis?.scaleType !== 'band',
      nice: props.xAxis?.nice ?? props.xAxis?.scaleType !== 'band',
      paddingInner: finiteNumber(props.xAxis?.paddingInner, 0.18),
      paddingOuter: finiteNumber(props.xAxis?.paddingOuter, 0.08),
      visible: props.xAxis?.visible ?? true,
      width: Math.max(24, finiteNumber(props.xAxis?.width, 58)),
      height: Math.max(24, finiteNumber(props.xAxis?.height, 44)),
      ticks: props.xAxis?.ticks,
    },
    yAxis: {
      scaleId: props.yAxis?.scaleId ?? 'y',
      scaleType: props.yAxis?.scaleType ?? 'linear',
      field: props.yAxis?.field,
      domain: props.yAxis?.domain,
      zero: props.yAxis?.zero ?? true,
      nice: props.yAxis?.nice ?? true,
      paddingInner: finiteNumber(props.yAxis?.paddingInner, 0.18),
      paddingOuter: finiteNumber(props.yAxis?.paddingOuter, 0.08),
      visible: props.yAxis?.visible ?? true,
      width: Math.max(24, finiteNumber(props.yAxis?.width, 58)),
      height: Math.max(24, finiteNumber(props.yAxis?.height, 44)),
      ticks: props.yAxis?.ticks,
    },
    series: props.series ? [...props.series] : [],
    grid,
    axes,
    legend,
    tooltip,
    interaction,
    viewport,
    children: props.children ? [...props.children] : [],
    styleSheet: props.styleSheet,
    visualPreset: props.visualPreset,
    plugins: props.plugins ? [...props.plugins] : undefined,
    accessibility: normalizeChartAccessibilityOptions(props.accessibility),
    states: props.states ? { ...props.states } : undefined,
    parts: props.parts ? { ...props.parts } : undefined,
    renderers: props.renderers ? { ...props.renderers } : undefined,
  }
}

function normalizePointVirtualization(
  options: NovaChartPointSeriesVirtualizationOptions | undefined,
) {
  return {
    enabled: options?.enabled ?? DEFAULT_POINT_SERIES_VIRTUALIZATION.enabled,
    overscanPx: finiteNumber(options?.overscanPx, DEFAULT_POINT_SERIES_VIRTUALIZATION.overscanPx),
    maxRenderedPoints: Math.max(2, Math.trunc(finiteNumber(
      options?.maxRenderedPoints,
      DEFAULT_POINT_SERIES_VIRTUALIZATION.maxRenderedPoints,
    ))),
  }
}

function normalizeChartAccessibilityOptions<TData>(options: NovaChartRootProps<TData>['accessibility']) {
  if (options === false) return false
  return {
    label: options?.label,
    description: options?.description,
    dataSummary: options?.dataSummary,
    includeVisibleMarks: options?.includeVisibleMarks ?? false,
    maxMarks: Math.max(0, Math.trunc(finiteNumber(options?.maxMarks, 80))),
    keyboardNavigation: options?.keyboardNavigation ?? true,
    exposeTooltip: options?.exposeTooltip ?? true,
    exposeLegend: options?.exposeLegend ?? true,
  }
}
