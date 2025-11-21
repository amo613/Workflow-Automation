import { BaseEdge, getSmoothStepPath } from 'reactflow';

export function AnimatedExecutionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}) {
  // Get offset from data (calculated in parent component)
  const offset = data?.offset || 0;

  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    offset, // Apply offset to path for parallel edges
  });

  // Check if this edge should be animated (from data.isExecuted)
  const isAnimated = data?.isExecuted || false;
  const edgeColor = style?.stroke || '#10b981';

  // Animation duration in seconds
  const animationDuration = 1.5;

  // Create unique ID for this edge's animation path
  const pathId = `edge-path-${id}`;

  return (
    <>
      {/* Base Edge - keeps the colored line */}
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      {/* SVG Animation - only when edge is executed */}
      {isAnimated && (
        <>
          <defs>
            <path id={pathId} d={edgePath} fill="none" stroke="none" />
          </defs>
          <g>
            {/* Animated circle/pulse moving along the edge */}
            <circle r="4" fill={edgeColor} opacity="0.9">
              <animateMotion
                dur={`${animationDuration}s`}
                repeatCount="indefinite"
              >
                <mpath href={`#${pathId}`} />
              </animateMotion>
            </circle>
            {/* Glow effect */}
            <circle r="6" fill={edgeColor} opacity="0.3">
              <animateMotion
                dur={`${animationDuration}s`}
                repeatCount="indefinite"
              >
                <mpath href={`#${pathId}`} />
              </animateMotion>
              <animate
                attributeName="opacity"
                values="0.3;0.6;0.3"
                dur="1s"
                repeatCount="indefinite"
              />
            </circle>
          </g>
        </>
      )}
    </>
  );
}
