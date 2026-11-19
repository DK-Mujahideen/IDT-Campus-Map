import type { CalculatedRoute, MapNode, RouteSegment } from '../types/campus';

/**
 * Computes the shortest walking path between two campus map nodes using Dijkstra's algorithm.
 */
export function calculateShortestRoute(
  startNodeId: string,
  endNodeId: string,
  nodes: MapNode[],
  routes: RouteSegment[],
  accessibleOnly = false
): CalculatedRoute | null {
  if (!startNodeId || !endNodeId) {
    return null;
  }

  const nodeMap = new Map<string, MapNode>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  if (!nodeMap.has(startNodeId) || !nodeMap.has(endNodeId)) {
    return null;
  }

  if (startNodeId === endNodeId) {
    const singleNode = nodeMap.get(startNodeId)!;
    return {
      nodeIds: [startNodeId],
      nodes: [singleNode],
      segments: [],
      totalDistanceMeters: 0,
      estimatedMinutes: 0,
      steps: [`You are already at ${singleNode.label}.`],
      accessibleOnly,
    };
  }

  // Build bidirectional adjacency list
  const adj = new Map<string, Array<{ neighbor: string; segment: RouteSegment }>>();
  for (const node of nodes) {
    adj.set(node.id, []);
  }

  for (const seg of routes) {
    if (seg.visibility === 'archived') continue;
    if (accessibleOnly && !seg.accessible) continue;
    if (!nodeMap.has(seg.fromNodeId) || !nodeMap.has(seg.toNodeId)) continue;

    adj.get(seg.fromNodeId)?.push({ neighbor: seg.toNodeId, segment: seg });
    adj.get(seg.toNodeId)?.push({ neighbor: seg.fromNodeId, segment: seg });
  }

  const distances = new Map<string, number>();
  const previousNode = new Map<string, string | null>();
  const previousSegment = new Map<string, RouteSegment | null>();
  const unvisited = new Set<string>();

  for (const node of nodes) {
    distances.set(node.id, Infinity);
    previousNode.set(node.id, null);
    previousSegment.set(node.id, null);
    unvisited.add(node.id);
  }
  distances.set(startNodeId, 0);

  while (unvisited.size > 0) {
    let currentId: string | null = null;
    let minDist = Infinity;

    for (const id of unvisited) {
      const dist = distances.get(id) ?? Infinity;
      if (dist < minDist) {
        minDist = dist;
        currentId = id;
      }
    }

    if (currentId === null || minDist === Infinity) {
      break;
    }

    if (currentId === endNodeId) {
      break;
    }

    unvisited.delete(currentId);

    const neighbors = adj.get(currentId) ?? [];
    for (const { neighbor, segment } of neighbors) {
      if (!unvisited.has(neighbor)) continue;
      const alt = minDist + segment.distanceMeters;
      if (alt < (distances.get(neighbor) ?? Infinity)) {
        distances.set(neighbor, alt);
        previousNode.set(neighbor, currentId);
        previousSegment.set(neighbor, segment);
      }
    }
  }

  const totalDistance = distances.get(endNodeId) ?? Infinity;
  if (totalDistance === Infinity) {
    return null;
  }

  const pathIds: string[] = [];
  const pathSegments: RouteSegment[] = [];
  let cursor: string | null = endNodeId;

  while (cursor) {
    pathIds.unshift(cursor);
    const seg = previousSegment.get(cursor);
    if (seg) {
      pathSegments.unshift(seg);
    }
    cursor = previousNode.get(cursor) ?? null;
  }

  const pathNodes = pathIds
    .map((id) => nodeMap.get(id))
    .filter((n): n is MapNode => Boolean(n));

  const steps: string[] = [];
  steps.push(`Start at ${pathNodes[0]?.label ?? startNodeId}.`);

  for (let i = 0; i < pathSegments.length; i++) {
    const seg = pathSegments[i];
    const nextNode = pathNodes[i + 1];
    const pathName = seg.pathLabel ? ` via ${seg.pathLabel}` : '';
    const accessTag = !seg.accessible ? ' (stairs / non-ramp access)' : '';
    steps.push(
      `Walk ${Math.round(seg.distanceMeters)} m${pathName} to ${nextNode?.label ?? 'next junction'}${accessTag}.`
    );
  }

  const endNode = pathNodes[pathNodes.length - 1];
  steps.push(`Arrive at ${endNode?.label ?? endNodeId}.`);

  // Average campus walking speed ~ 78 meters / min (1.3 m/s)
  const estimatedMinutes = Math.max(1, Math.ceil(totalDistance / 78));

  return {
    nodeIds: pathIds,
    nodes: pathNodes,
    segments: pathSegments,
    totalDistanceMeters: Math.round(totalDistance),
    estimatedMinutes,
    steps,
    accessibleOnly,
  };
}
