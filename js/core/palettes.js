/**
 * Palette presets. A preset sets the three color pickers
 * (background, fractal, interior) and adds two accent colors that
 * are blended with the picker colors to build gradients.
 * The pickers always win: change one after choosing a preset and the
 * drawing follows the picker.
 */
export const PALETTES = [
  { id: 'ember', name: 'Ember', bg: '#07061a', fg: '#ff7b1c', interior: '#000000', accents: ['#ffd45e', '#fff7e6'] },
  { id: 'ocean', name: 'Deep ocean', bg: '#020c1b', fg: '#1d9bf0', interior: '#00040a', accents: ['#7cf4d2', '#f2fffb'] },
  { id: 'aurora', name: 'Aurora', bg: '#050716', fg: '#38e8b0', interior: '#03030c', accents: ['#7d5cff', '#ff6fb5'] },
  { id: 'neon', name: 'Neon', bg: '#0b0016', fg: '#ff2fd2', interior: '#05000a', accents: ['#00e5ff', '#f6f6ff'] },
  { id: 'forest', name: 'Forest', bg: '#06110b', fg: '#57d163', interior: '#020604', accents: ['#d8f36a', '#f4ffe9'] },
  { id: 'paper', name: 'Ink on paper', bg: '#f6f1e4', fg: '#1f3a68', interior: '#14213d', accents: ['#c8553d', '#f2b134'] },
];

export function getPalette(id) {
  return PALETTES.find((p) => p.id === id) || PALETTES[0];
}
