/** Parameter definitions shared by several fractals. */

export function iterationParams(defaultIter) {
  return [
    {
      id: 'maxIter', label: 'Iteration limit', type: 'range', min: 50, max: 3000, step: 10, value: defaultIter,
      help: 'How many times the rule is applied before a point is declared “inside”. Higher = finer boundary detail, slower.',
    },
    {
      id: 'autoIter', label: 'Raise iterations automatically as I zoom', type: 'checkbox', value: true,
    },
  ];
}

export function depthParams(defaultDepth, maxDepth, help) {
  return [
    {
      id: 'depth', label: 'Recursion depth', type: 'range', min: 0, max: maxDepth, step: 1, value: defaultDepth,
      help,
    },
    {
      id: 'autoDetail', label: 'Add detail automatically as I zoom', type: 'checkbox', value: true,
    },
  ];
}
