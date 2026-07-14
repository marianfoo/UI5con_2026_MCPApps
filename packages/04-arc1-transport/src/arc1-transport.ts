export type RiskLevel = 'info' | 'low' | 'medium' | 'high';

export interface Arc1TransportTaskSummary {
  id: string;
  description: string;
  owner: string;
  status: string;
  objectCount?: number;
}

export interface Arc1TransportListItem {
  id: string;
  description: string;
  owner: string;
  status: string;
  type: string;
  target?: string;
  targetDesc?: string;
  objectCount?: number;
  tasks?: Arc1TransportTaskSummary[];
}

export interface Arc1TransportObject {
  pgmid?: string;
  type: string;
  name: string;
  wbtype?: string;
  description?: string;
  locked?: boolean;
  position?: string;
}

export interface Arc1TransportTaskDetail {
  id: string;
  description: string;
  owner: string;
  status: string;
  objectCount?: number;
  objects?: Arc1TransportObject[];
}

export interface Arc1TransportDetail {
  id: string;
  description: string;
  owner: string;
  status: string;
  type: string;
  target?: string;
  targetDesc?: string;
  objectCount?: number;
  tasks?: Arc1TransportTaskDetail[];
}

export interface TransportListRow {
  id: string;
  description: string;
  owner: string;
  status: string;
  statusLabel: string;
  type: string;
  typeLabel: string;
  target?: string;
  targetDescription?: string;
  objectCount: number;
  taskCount: number;
  tasks: Arc1TransportTaskSummary[];
}

export interface TransportObject {
  pgmid?: string;
  type: string;
  name: string;
  wbtype?: string;
  description?: string;
  locked: boolean;
  position?: string;
  taskId: string;
  taskDescription: string;
  packageName: 'unknown';
  changeType: 'unknown';
  riskLevel: RiskLevel;
}

export interface RiskSignal {
  level: RiskLevel;
  title: string;
  detail: string;
}

export interface TransportReview {
  transport: {
    id: string;
    description: string;
    owner: string;
    status: string;
    statusLabel: string;
    type: string;
    typeLabel: string;
    target?: string;
    targetDescription?: string;
    objectCount: number;
  };
  tasks: Array<Arc1TransportTaskDetail & { statusLabel: string; objectCount: number }>;
  objects: TransportObject[];
  summary: {
    taskCount: number;
    objectCount: number;
    lockedObjectCount: number;
    packageCount: number;
    riskCount: number;
  };
  riskSignals: RiskSignal[];
}

export interface MissingArc1Data {
  mode: 'missing';
  message: string;
  expected: string;
}

export function parseArc1Json<T>(json: string, label: string): T {
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not parse ${label} JSON: ${message}`);
  }
}

export function normalizeArc1TransportList(transports: Arc1TransportListItem[]): TransportListRow[] {
  return transports.map((transport) => ({
    id: transport.id,
    description: transport.description || '',
    owner: transport.owner || '',
    status: transport.status || '',
    statusLabel: getTransportStatusLabel(transport.status),
    type: transport.type || '',
    typeLabel: getTransportTypeLabel(transport.type),
    target: transport.target || undefined,
    targetDescription: transport.targetDesc || undefined,
    objectCount: getNumber(transport.objectCount),
    taskCount: transport.tasks?.length ?? 0,
    tasks: transport.tasks ?? []
  }));
}

export function normalizeArc1TransportDetail(transport: Arc1TransportDetail): TransportReview {
  const tasks = (transport.tasks ?? []).map((task) => {
    const objectCount = task.objectCount ?? task.objects?.length ?? 0;

    return {
      ...task,
      objects: task.objects ?? [],
      objectCount,
      statusLabel: getTransportStatusLabel(task.status)
    };
  });
  const objects = tasks.flatMap((task) => {
    return task.objects.map((object) => normalizeTransportObject(task, object));
  });
  const objectCount = transport.objectCount ?? objects.length;
  const lockedObjectCount = objects.filter((object) => object.locked).length;
  const riskSignals = deriveRiskSignals(transport, objectCount, lockedObjectCount);

  return {
    transport: {
      id: transport.id,
      description: transport.description || '',
      owner: transport.owner || '',
      status: transport.status || '',
      statusLabel: getTransportStatusLabel(transport.status),
      type: transport.type || '',
      typeLabel: getTransportTypeLabel(transport.type),
      target: transport.target || undefined,
      targetDescription: transport.targetDesc || undefined,
      objectCount
    },
    tasks,
    objects,
    summary: {
      taskCount: tasks.length,
      objectCount,
      lockedObjectCount,
      packageCount: 0,
      riskCount: riskSignals.filter((signal) => signal.level === 'medium' || signal.level === 'high').length
    },
    riskSignals
  };
}

export function summarizeTransportList(transports: TransportListRow[]): string {
  if (transports.length === 0) {
    return 'ARC-1 returned no transports to display.';
  }

  const objectCount = transports.reduce((sum, transport) => sum + transport.objectCount, 0);
  return `ARC-1 returned ${transports.length} transport(s) with ${objectCount} object(s) in total.`;
}

export function summarizeTransportReview(review: TransportReview): string {
  const { transport, summary } = review;
  return [
    `${transport.id}: ${transport.description || 'No description'}`,
    `Owner ${transport.owner || 'unknown'}, ${transport.statusLabel}, ${summary.objectCount} object(s), ${summary.taskCount} task(s), ${summary.lockedObjectCount} locked object(s).`
  ].join(' ');
}

export function buildMissingArc1Data(expected: string): MissingArc1Data {
  return {
    mode: 'missing',
    message: `No ARC-1 ${expected} data was passed to this UI tool.`,
    expected
  };
}

export function getTransportStatusLabel(status: string | undefined): string {
  const labels: Record<string, string> = {
    D: 'Modifiable',
    L: 'Modifiable, protected',
    O: 'Release started',
    R: 'Released',
    N: 'Released with import protection'
  };

  return labels[status ?? ''] ?? (status || 'Unknown');
}

export function getTransportTypeLabel(type: string | undefined): string {
  const labels: Record<string, string> = {
    K: 'Workbench request',
    W: 'Workbench task',
    C: 'Customizing request',
    S: 'Development correction'
  };

  return labels[type ?? ''] ?? (type || 'Unknown');
}

function normalizeTransportObject(
  task: Arc1TransportTaskDetail,
  object: Arc1TransportObject
): TransportObject {
  return {
    pgmid: object.pgmid,
    type: object.type || 'unknown',
    name: object.name || 'unknown',
    wbtype: object.wbtype,
    description: object.description,
    locked: Boolean(object.locked),
    position: object.position,
    taskId: task.id,
    taskDescription: task.description || '',
    packageName: 'unknown',
    changeType: 'unknown',
    riskLevel: object.locked ? 'medium' : 'info'
  };
}

function deriveRiskSignals(
  transport: Arc1TransportDetail,
  objectCount: number,
  lockedObjectCount: number
): RiskSignal[] {
  const signals: RiskSignal[] = [];

  if (objectCount === 0) {
    signals.push({
      level: 'info',
      title: 'No objects returned',
      detail: 'ARC-1 returned no task objects for this transport.'
    });
  }

  if (!transport.target && !transport.targetDesc) {
    signals.push({
      level: 'low',
      title: 'No target information',
      detail: 'ARC-1 did not return a target system or target description.'
    });
  }

  if (lockedObjectCount > 0) {
    signals.push({
      level: 'medium',
      title: 'Locked objects',
      detail: `${lockedObjectCount} object(s) are currently locked in this transport.`
    });
  }

  return signals;
}

function getNumber(value: number | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
