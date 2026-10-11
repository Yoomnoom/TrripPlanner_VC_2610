export type Marks = Record<string, 'visited' | 'wish'>;
export interface MapView {
  center: [number, number];
  zoom: number;
}

const VISITED = '#5B3DF5';
const WISH = '#F59E0B';
const EMPTY = '#E4E4EC';

/** Style per status; `wish` also gets a dashed outline so the state is not told by color alone. */
export const statusStyle = (s: 'visited' | 'wish' | undefined) => ({
  default: {
    fill: s === 'visited' ? VISITED : s === 'wish' ? WISH : EMPTY,
    stroke: s === 'wish' ? '#92400E' : '#FFFFFF',
    strokeWidth: s === 'wish' ? 0.9 : 0.4,
    strokeDasharray: s === 'wish' ? '3 2' : undefined,
    outline: 'none',
  },
  hover: {
    fill: s === 'visited' ? '#4A2FD0' : s === 'wish' ? '#D97706' : '#CFCFDB',
    outline: 'none',
    cursor: 'pointer',
  },
  pressed: { fill: '#3B25A8', outline: 'none' },
});
