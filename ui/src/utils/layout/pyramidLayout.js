const DEFAULT_TRIGGER_TYPES = [
  'start',
  'call-trigger',
  'webhook-trigger',
  'schedule-trigger',
  'google-sheets-trigger',
];

const DEFAULT_OPTIONS = {
  triggerTypes: DEFAULT_TRIGGER_TYPES,
  laneSpacing: 420,
  levelSpacing: 220,
  intraSpacing: 220,
};

export function computePyramidLayout(nodes = [], edges = [], options = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const { triggerTypes, laneSpacing, levelSpacing, intraSpacing } = config;

  if (!nodes.length) {
    return new Map();
  }

  const adjacency = new Map();
  const incomingCount = new Map();

  edges.forEach(edge => {
    if (!adjacency.has(edge.source)) {
      adjacency.set(edge.source, []);
    }
    adjacency.get(edge.source).push(edge.target);

    incomingCount.set(edge.target, (incomingCount.get(edge.target) || 0) + 1);
  });

  let startNodes = nodes.filter(node => triggerTypes.includes(node.type));

  if (!startNodes.length) {
    startNodes = nodes.filter(node => (incomingCount.get(node.id) || 0) === 0);
  }

  if (!startNodes.length) {
    startNodes = [nodes[0]];
  }

  const levels = new Map();
  const queue = [];
  let laneCounter = 0;

  startNodes.forEach(node => {
    if (!levels.has(node.id)) {
      levels.set(node.id, { level: 0, lane: laneCounter });
      queue.push(node.id);
      laneCounter += 1;
    }
  });

  while (queue.length) {
    const currentId = queue.shift();
    const currentInfo = levels.get(currentId);
    const neighbors = adjacency.get(currentId) || [];

    neighbors.forEach(targetId => {
      const nextLevel = currentInfo.level + 1;
      const existing = levels.get(targetId);

      if (
        !existing ||
        nextLevel < existing.level ||
        (nextLevel === existing.level && currentInfo.lane < existing.lane)
      ) {
        levels.set(targetId, { level: nextLevel, lane: currentInfo.lane });
        queue.push(targetId);
      }
    });
  }

  nodes.forEach(node => {
    if (!levels.has(node.id)) {
      levels.set(node.id, { level: 0, lane: laneCounter });
      laneCounter += 1;
    }
  });

  const laneIds = Array.from(
    new Set(Array.from(levels.values()).map(info => info.lane))
  ).sort((a, b) => a - b);

  const laneIndexMap = new Map();
  laneIds.forEach((laneId, idx) => laneIndexMap.set(laneId, idx));

  const laneLevelBuckets = new Map();

  levels.forEach((info, nodeId) => {
    const laneIdx = laneIndexMap.get(info.lane) ?? 0;
    if (!laneLevelBuckets.has(laneIdx)) {
      laneLevelBuckets.set(laneIdx, new Map());
    }
    const levelMap = laneLevelBuckets.get(laneIdx);
    if (!levelMap.has(info.level)) {
      levelMap.set(info.level, []);
    }
    levelMap.get(info.level).push(nodeId);
  });

  const laneCount = laneIds.length || 1;
  const laneBaseOffset = -((laneCount - 1) * laneSpacing) / 2;

  const positions = new Map();

  laneLevelBuckets.forEach((levelMap, laneIdx) => {
    levelMap.forEach((nodeIds, level) => {
      const count = nodeIds.length;
      nodeIds.forEach((nodeId, index) => {
        const offset = (index - (count - 1) / 2) * intraSpacing;
        const x = laneBaseOffset + laneIdx * laneSpacing + offset;
        const y = level * levelSpacing;
        positions.set(nodeId, { x, y });
      });
    });
  });

  return positions;
}
