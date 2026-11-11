export type Mode = 'light' | 'dark';

export interface Theme {
  bg: string;
  fg: string;
  muted: string;
  accent: string;
  hairline: string;
}

export function theme(mode: Mode, accent: string): Theme {
  if (mode === 'dark') {
    return {
      bg: '#0f1115',
      fg: '#f4f4f2',
      muted: 'rgba(244,244,242,0.62)',
      hairline: 'rgba(244,244,242,0.14)',
      accent,
    };
  }
  return {
    bg: '#f7f6f2',
    fg: '#15161a',
    muted: 'rgba(21,22,26,0.6)',
    hairline: 'rgba(21,22,26,0.14)',
    accent,
  };
}

export const FONT = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export function font(weight: number, px: number): string {
  return `${weight} ${px}px ${FONT}`;
}
