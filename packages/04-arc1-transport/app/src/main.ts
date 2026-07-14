import { App } from '@modelcontextprotocol/ext-apps';
import '@ui5/webcomponents/dist/Button.js';
import '@ui5/webcomponents/dist/Card.js';
import '@ui5/webcomponents/dist/CardHeader.js';
import '@ui5/webcomponents/dist/Dialog.js';
import '@ui5/webcomponents/dist/MessageStrip.js';
import type {
  Arc1TransportTaskDetail,
  Arc1TransportTaskSummary,
  TransportListRow,
  TransportObject,
  TransportReview
} from '../../src/arc1-transport';
import './styles.css';

interface Arc1TransportPayload {
  mode?: 'list' | 'review' | 'missing';
  transports?: TransportListRow[];
  review?: TransportReview;
  message?: string;
}

interface TaskPageSelection {
  task: Arc1TransportTaskSummary | (Arc1TransportTaskDetail & { statusLabel?: string });
  parentId: string;
  parentDescription: string;
  objects: TransportObject[];
}

interface DialogElement extends HTMLElement {
  open: boolean;
}

interface ButtonElement extends HTMLElement {
  disabled: boolean;
}

let currentPayload: Arc1TransportPayload | undefined;
let selectedTask: TaskPageSelection | undefined;
let mcpApp: App | undefined;

const app = new App({ name: 'ARC-1 Transport Organizer', version: '0.1.0' });

// The iframe receives normalized data, never ARC-1 credentials or a direct SAP connection.
app.addEventListener('toolresult', (result) => {
  renderPayload(result.structuredContent as Arc1TransportPayload | undefined);
});

try {
  await app.connect();
  mcpApp = app;
} catch {
  renderPayload({
    mode: 'missing',
    message: 'Open this app through an MCP Apps host and pass ARC-1 SAPTransport list or get data.'
  });
}

document.getElementById('se01-tree')?.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const taskButton = target.closest<HTMLElement>('[data-task-id]');
  if (taskButton?.dataset.taskId && taskButton.dataset.parentId) {
    openTaskPage(taskButton.dataset.taskId, taskButton.dataset.parentId);
  }
});

document.getElementById('back-to-organizer')?.addEventListener('click', showOrganizerPage);
document.getElementById('release-task')?.addEventListener('click', openReleaseDialog);
document.getElementById('cancel-release')?.addEventListener('click', closeReleaseDialog);
document.getElementById('confirm-release')?.addEventListener('click', requestTaskRelease);

function renderPayload(payload: Arc1TransportPayload | undefined): void {
  currentPayload = payload;
  selectedTask = undefined;
  showView('organizer');

  if (!payload || payload.mode === 'missing') {
    setHeader('Transport Organizer', 'Waiting for ARC-1 data');
    renderMessage(payload?.message ?? 'No ARC-1 data was passed to this UI tool.', 'Information');
    renderOrganizerTree([], undefined);
    return;
  }

  const review = payload.review;
  const transports = ensureSelectedTransport(payload.transports ?? [], review);
  const owner = review?.transport.owner || transports[0]?.owner || 'current user';
  setHeader('Transport Organizer: Requests', `Change requests involving ${owner}`);
  renderMessage(
    review
      ? `${transports.length} request(s) loaded. Select a transport task to open its object page.`
      : `${transports.length} request(s) loaded. Select a task; load transport details through ARC-1 to see its objects.`,
    'Information'
  );
  renderOrganizerTree(transports, review);
}

function ensureSelectedTransport(transports: TransportListRow[], review: TransportReview | undefined): TransportListRow[] {
  if (!review || transports.some((transport) => transport.id === review.transport.id)) return transports;

  // A detail-only tool call can still populate the shared organizer UI without a prior list call.
  return [{
    ...review.transport,
    taskCount: review.summary.taskCount,
    tasks: review.tasks,
    objectCount: review.summary.objectCount
  }, ...transports];
}

function renderOrganizerTree(transports: TransportListRow[], review: TransportReview | undefined): void {
  const tree = document.getElementById('se01-tree');
  const context = document.getElementById('tree-context');
  if (!tree || !context) return;

  if (transports.length === 0) {
    context.textContent = 'No transport requests loaded';
    tree.innerHTML = '<div class="empty-tree">Call ARC-1 SAPTransport list, then pass the result to this app.</div>';
    return;
  }

  const owner = review?.transport.owner || transports[0].owner || 'current user';
  const systemId = (review?.transport.id || transports[0].id).slice(0, 3).toUpperCase();
  context.textContent = `Change Requests Involving User ${owner}`;

  const rows: string[] = [];
  rows.push(treeRow(0, `${systemId} · ${transports.length} request(s)`, '', 'SAP System', 'group'));

  for (const [type, typeTransports] of groupBy(transports, (transport) => transport.typeLabel)) {
    rows.push(treeRow(1, type, '', 'Request Type', 'group'));
    rows.push(treeRow(2, 'Local Change Requests', '', '', 'group'));

    for (const [status, statusTransports] of groupBy(typeTransports, (transport) => transport.statusLabel)) {
      rows.push(treeRow(3, status, '', '', 'group'));

      for (const transport of statusTransports) {
        rows.push(treeRow(4, transport.id, transport.owner, transport.description || 'No description', 'request'));
        const detailed = transport.id === review?.transport.id;
        const tasks = detailed ? review.tasks : transport.tasks;

        for (const task of tasks) {
          rows.push(treeRow(
            5,
            task.id,
            task.owner,
            task.description || 'Unclassified',
            'task',
            { taskId: task.id, parentId: transport.id }
          ));

          if (!detailed) continue;
          const taskObjects = review.objects.filter((object) => object.taskId === task.id);
          for (const [objectType, objects] of groupBy(taskObjects, (object) => object.type)) {
            rows.push(treeRow(6, getObjectTypeLabel(objectType), '', `${objects.length} object(s)`, 'group'));
            for (const object of objects) {
              rows.push(treeRow(7, object.name, '', object.description || object.type, 'object'));
            }
          }
        }
      }
    }
  }

  tree.innerHTML = rows.join('');
}

function treeRow(
  level: number,
  label: string,
  owner: string,
  description: string,
  kind: 'group' | 'request' | 'task' | 'object',
  data?: { taskId: string; parentId: string }
): string {
  const node = data
    ? `<button class="tree-node task-node" data-task-id="${escapeHtml(data.taskId)}" data-parent-id="${escapeHtml(data.parentId)}"><span class="node-icon">▻</span>${escapeHtml(label)}</button>`
    : `<span class="tree-node ${kind}-node"><span class="node-icon">${kind === 'object' ? '•' : '▾'}</span>${escapeHtml(label)}</span>`;

  return [
    `<div class="tree-row ${kind}-row" style="--tree-level:${level}">`,
    `<div class="node-cell">${node}</div>`,
    `<div class="owner-cell">${escapeHtml(owner)}</div>`,
    `<div class="description-cell">${escapeHtml(description)}</div>`,
    '</div>'
  ].join('');
}

function openTaskPage(taskId: string, parentId: string): void {
  if (!currentPayload) return;
  const review = currentPayload.review;
  const transports = ensureSelectedTransport(currentPayload.transports ?? [], review);
  const parent = transports.find((transport) => transport.id === parentId);
  const detailedTask = review?.transport.id === parentId
    ? review.tasks.find((task) => task.id === taskId)
    : undefined;
  const summaryTask = parent?.tasks.find((task) => task.id === taskId);
  const task = detailedTask ?? summaryTask;
  if (!task) return;

  selectedTask = {
    task,
    parentId,
    parentDescription: parent?.description || review?.transport.description || '',
    objects: review?.objects.filter((object) => object.taskId === taskId) ?? []
  };

  renderTaskPage(selectedTask);
  showView('task');
}

function renderTaskPage(selection: TaskPageSelection): void {
  const { task, objects } = selection;
  const statusLabel = getTaskStatusLabel(task);
  const isReleasable = task.status === 'D' || task.status === 'L';
  const releaseButton = document.getElementById('release-task') as ButtonElement | null;
  if (releaseButton) releaseButton.disabled = !isReleasable;

  setHeader(`Transport Task ${task.id}`, task.description || 'No description');
  setText('task-id', task.id);
  setText('task-description', task.description || 'No description');
  setText('task-status', statusLabel);
  setText('task-owner', task.owner || '-');
  setText('parent-request', selection.parentId);
  setText('parent-description', selection.parentDescription || '-');
  setText('task-object-count', String(task.objectCount ?? objects.length));
  setText('task-release-state', isReleasable ? 'Ready for release' : 'Task is not modifiable');
  renderTaskObjects(objects);
  renderTaskMessage(
    objects.length > 0
      ? `${objects.length} repository object(s) loaded from ARC-1.`
      : 'Object details are not loaded. Fetch the parent request with ARC-1 SAPTransport get and reopen this task.',
    objects.length > 0 ? 'Information' : 'Critical'
  );
}

function renderTaskObjects(objects: TransportObject[]): void {
  const table = document.getElementById('task-object-table');
  if (!table) return;

  if (objects.length === 0) {
    table.innerHTML = '<div class="empty-tree">No repository objects loaded for this task.</div>';
    return;
  }

  table.innerHTML = [
    '<div class="object-row object-header"><span>Object</span><span>Type</span><span>Description</span><span>Lock</span></div>',
    ...objects.map((object) => [
      '<div class="object-row">',
      `<span><strong>${escapeHtml(object.name)}</strong><small>${escapeHtml(object.position || '')}</small></span>`,
      `<span>${escapeHtml(object.type)}${object.wbtype ? ` · ${escapeHtml(object.wbtype)}` : ''}</span>`,
      `<span>${escapeHtml(object.description || 'No description')}</span>`,
      `<span class="lock-state ${object.locked ? 'locked' : ''}">${object.locked ? 'Locked' : 'Open'}</span>`,
      '</div>'
    ].join(''))
  ].join('');
}

function showOrganizerPage(): void {
  selectedTask = undefined;
  renderPayload(currentPayload);
}

function showView(view: 'organizer' | 'task'): void {
  document.getElementById('organizer-view')?.toggleAttribute('hidden', view !== 'organizer');
  document.getElementById('task-view')?.toggleAttribute('hidden', view !== 'task');
}

function openReleaseDialog(): void {
  if (!selectedTask) return;
  setText('release-task-id', selectedTask.task.id);
  (document.getElementById('release-dialog') as DialogElement | null)?.setAttribute('open', '');
}

function closeReleaseDialog(): void {
  (document.getElementById('release-dialog') as DialogElement | null)?.removeAttribute('open');
}

async function requestTaskRelease(): Promise<void> {
  if (!selectedTask) return;
  closeReleaseDialog();

  if (!mcpApp) {
    renderTaskMessage('This host connection cannot send the release request to the agent.', 'Negative');
    return;
  }

  const releaseButton = document.getElementById('release-task') as ButtonElement | null;
  if (releaseButton) releaseButton.disabled = true;
  renderTaskMessage(`Sending release request for ${selectedTask.task.id} to the agent…`, 'Information');

  try {
    // sendMessage returns control to the agent so ARC-1 can perform the confirmed write under its own controls.
    const result = await mcpApp.sendMessage({
      role: 'user',
      content: [{
        type: 'text',
        text: [
          `Release transport task ${selectedTask.task.id} using ARC-1 SAPTransport.`,
          'The release was explicitly confirmed in the Transport Organizer UI.',
          `After a successful release, fetch parent request ${selectedTask.parentId} again and refresh show_arc1_transport.`
        ].join(' ')
      }]
    });

    if (result.isError) throw new Error('The host rejected the release request.');
    renderTaskMessage(`Release request for ${selectedTask.task.id} was sent to the agent.`, 'Positive');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    renderTaskMessage(`Could not send the release request: ${message}`, 'Negative');
    if (releaseButton) releaseButton.disabled = false;
  }
}

function renderMessage(message: string, design: string): void {
  const container = document.getElementById('message-strip');
  if (container) container.innerHTML = `<ui5-message-strip design="${design}" hide-close-button>${escapeHtml(message)}</ui5-message-strip>`;
}

function renderTaskMessage(message: string, design: string): void {
  const container = document.getElementById('task-message');
  if (container) container.innerHTML = `<ui5-message-strip design="${design}" hide-close-button>${escapeHtml(message)}</ui5-message-strip>`;
}

function getTaskStatusLabel(task: Arc1TransportTaskSummary | (Arc1TransportTaskDetail & { statusLabel?: string })): string {
  return 'statusLabel' in task && task.statusLabel ? task.statusLabel : task.status;
}

function getObjectTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    CLAS: 'Class (ABAP Objects)',
    INTF: 'Interface (ABAP Objects)',
    DDLS: 'Data Definition',
    DDLX: 'Metadata Extension',
    BDEF: 'Behavior Definition',
    SRVD: 'Service Definition',
    SRVB: 'Service Binding',
    TABL: 'Database Table',
    DTEL: 'Data Element',
    DOMA: 'Domain'
  };
  return labels[type] ?? type;
}

function groupBy<T>(items: T[], key: (item: T) => string): Array<[string, T[]]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const groupKey = key(item);
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), item]);
  }
  return [...groups.entries()];
}

function setHeader(title: string, subtitle: string): void {
  const header = document.getElementById('card-header') as HTMLElement & {
    titleText: string;
    subtitleText: string;
  };
  header.titleText = title;
  header.subtitleText = subtitle;
}

function setText(id: string, value: string): void {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
