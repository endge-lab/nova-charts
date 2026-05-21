import type {
  NovaChartPreset,
  NovaChartVisualPresetName,
} from '@/model/types/chart-components.types'

export const NOVA_CHART_DEFAULT_PALETTE = [
  '#2563eb',
  '#16a34a',
  '#f59e0b',
  '#dc2626',
  '#7c3aed',
  '#0891b2',
  '#db2777',
  '#475569',
] as const

const BUILTIN_PRESETS: Record<string, NovaChartPreset> = {
  dashboard: createNovaChartPreset({
    name: 'dashboard',
    tokens: {
      background: '#ffffff',
      surface: '#f8fafc',
      axisColor: '#94a3b8',
      gridColor: '#e2e8f0',
      textColor: '#334155',
      tooltipBackground: '#0f172a',
      tooltipText: '#f8fafc',
      legendText: '#475569',
      viewportTrack: 'rgba(148,163,184,0.24)',
      viewportThumb: 'rgba(71,85,105,0.72)',
      selection: '#2563eb',
      mutedOpacity: 0.28,
      palette: [...NOVA_CHART_DEFAULT_PALETTE],
    },
    styles: {
      'BarSeries::bar': { borderRadius: 3 },
      'LineSeries::segment': { strokeWidth: 2 },
      'AreaSeries::fill': { opacity: 0.28 },
      'ScatterSeries::point': { opacity: 0.88 },
      'BubbleSeries::bubble': { opacity: 0.54 },
    },
  }),
  editorial: createNovaChartPreset({
    name: 'editorial',
    tokens: {
      background: '#fbfbf8',
      surface: '#f1f0ea',
      axisColor: '#6b7280',
      gridColor: '#dedbd1',
      textColor: '#1f2937',
      tooltipBackground: '#1f2937',
      tooltipText: '#ffffff',
      legendText: '#374151',
      viewportTrack: 'rgba(107,114,128,0.16)',
      viewportThumb: 'rgba(31,41,55,0.58)',
      selection: '#b45309',
      mutedOpacity: 0.3,
      palette: ['#b45309', '#1f766d', '#7c2d12', '#4338ca', '#be123c', '#365314', '#0f766e', '#4b5563'],
    },
    styles: {
      'BarSeries::bar': { borderRadius: 1 },
      'LineSeries::segment': { strokeWidth: 2.5 },
      'AreaSeries::fill': { opacity: 0.24 },
    },
  }),
  financial: createNovaChartPreset({
    name: 'financial',
    tokens: {
      background: '#ffffff',
      surface: '#f8fafc',
      axisColor: '#64748b',
      gridColor: '#dbe4ef',
      textColor: '#0f172a',
      tooltipBackground: '#0f172a',
      tooltipText: '#f8fafc',
      legendText: '#334155',
      viewportTrack: 'rgba(15,23,42,0.08)',
      viewportThumb: 'rgba(15,23,42,0.62)',
      selection: '#0284c7',
      mutedOpacity: 0.22,
      palette: ['#16a34a', '#dc2626', '#0284c7', '#ca8a04', '#475569', '#7c3aed', '#0f766e', '#be123c'],
    },
    styles: {
      'BarSeries::bar': { borderRadius: 0 },
      'LineSeries::segment': { strokeWidth: 1.75 },
      'AreaSeries::fill': { opacity: 0.18 },
      'Grid::line': { opacity: 0.74 },
    },
  }),
  scientific: createNovaChartPreset({
    name: 'scientific',
    tokens: {
      background: '#ffffff',
      surface: '#f4f7fb',
      axisColor: '#475569',
      gridColor: '#cbd5e1',
      textColor: '#111827',
      tooltipBackground: '#111827',
      tooltipText: '#ffffff',
      legendText: '#1f2937',
      viewportTrack: 'rgba(71,85,105,0.14)',
      viewportThumb: 'rgba(37,99,235,0.68)',
      selection: '#7c3aed',
      mutedOpacity: 0.2,
      palette: ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#be123c', '#4b5563'],
    },
    styles: {
      'LineSeries::segment': { strokeWidth: 1.5 },
      'ScatterSeries::point': { radius: 3.5, opacity: 0.78 },
      'BubbleSeries::bubble': { opacity: 0.42 },
    },
  }),
  minimal: createNovaChartPreset({
    name: 'minimal',
    tokens: {
      background: '#ffffff',
      surface: '#ffffff',
      axisColor: '#cbd5e1',
      gridColor: '#eef2f7',
      textColor: '#475569',
      tooltipBackground: '#111827',
      tooltipText: '#ffffff',
      legendText: '#64748b',
      viewportTrack: 'rgba(203,213,225,0.36)',
      viewportThumb: 'rgba(100,116,139,0.48)',
      selection: '#111827',
      mutedOpacity: 0.18,
      palette: ['#111827', '#64748b', '#94a3b8', '#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed'],
    },
    styles: {
      'BarSeries::bar': { borderRadius: 2, opacity: 0.86 },
      'Grid::line': { opacity: 0.48 },
      'Legend::item': { opacity: 0.8 },
    },
  }),
  contrast: createNovaChartPreset({
    name: 'contrast',
    tokens: {
      background: '#0b1020',
      surface: '#111827',
      axisColor: '#cbd5e1',
      gridColor: 'rgba(226,232,240,0.22)',
      textColor: '#f8fafc',
      tooltipBackground: '#f8fafc',
      tooltipText: '#0f172a',
      legendText: '#f8fafc',
      viewportTrack: 'rgba(248,250,252,0.18)',
      viewportThumb: 'rgba(248,250,252,0.78)',
      selection: '#facc15',
      mutedOpacity: 0.2,
      palette: ['#facc15', '#38bdf8', '#fb7185', '#4ade80', '#c084fc', '#f97316', '#2dd4bf', '#f8fafc'],
    },
    styles: {
      'BarSeries::bar': { borderRadius: 2 },
      'LineSeries::segment': { strokeWidth: 2.5 },
      'AreaSeries::fill': { opacity: 0.32 },
      'ScatterSeries::point': { opacity: 0.96 },
    },
  }),
}

const registeredPresets = new Map<string, NovaChartPreset>(Object.entries(BUILTIN_PRESETS))

export function createNovaChartPreset<TData = Record<string, unknown>>(
  preset: NovaChartPreset<TData>,
): NovaChartPreset<TData> {
  return {
    ...preset,
    tokens: {
      ...(preset.tokens ?? {}),
      palette: preset.tokens?.palette ? [...preset.tokens.palette] : undefined,
    },
    styles: { ...(preset.styles ?? {}) },
  }
}

export function registerNovaChartPreset<TData = Record<string, unknown>>(preset: NovaChartPreset<TData>): void {
  registeredPresets.set(preset.name, createNovaChartPreset(preset) as NovaChartPreset)
}

export function resolveNovaChartPreset<TData = Record<string, unknown>>(
  name?: NovaChartVisualPresetName,
): NovaChartPreset<TData> {
  const resolved = registeredPresets.get(name ?? 'dashboard') ?? registeredPresets.get('dashboard')!
  return createNovaChartPreset(resolved) as NovaChartPreset<TData>
}

export function listNovaChartPresets(): Array<NovaChartPreset> {
  return Array.from(registeredPresets.values()).map(createNovaChartPreset)
}
