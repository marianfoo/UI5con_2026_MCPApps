import type { ProjectCheckState, Ui5ProjectOverview } from './project-overview.js';

export type IntegrationCardManifest = Record<string, unknown>;

export function buildProjectCardManifests(overview: Ui5ProjectOverview): IntegrationCardManifest[] {
  return [
    buildProjectSummaryCard(overview),
    buildProjectChecksCard(overview)
  ];
}

function buildProjectSummaryCard(overview: Ui5ProjectOverview): IntegrationCardManifest {
  const { project, summary } = overview;

  return {
    'sap.app': {
      id: 'ui5con.project.overview.summary',
      type: 'card',
      title: 'UI5 Project Summary',
      applicationVersion: { version: '1.0.0' }
    },
    'sap.card': {
      type: 'Object',
      header: {
        title: project.title,
        subtitle: project.id,
        status: { text: `UI5 ${project.ui5Version}` }
      },
      content: {
        groups: [
          {
            title: 'Runtime',
            items: [
              { label: 'Theme', value: project.theme },
              { label: 'Version', value: project.version },
              { label: 'Template', value: project.template },
              { label: 'Service', value: project.service }
            ]
          },
          {
            title: 'Structure',
            items: [
              { label: 'Views', value: String(summary.viewCount) },
              { label: 'Controllers', value: String(summary.controllerCount) },
              { label: 'Models', value: String(summary.modelCount) },
              { label: 'Libraries', value: String(summary.libraryCount) }
            ]
          }
        ]
      }
    }
  };
}

function buildProjectChecksCard(overview: Ui5ProjectOverview): IntegrationCardManifest {
  return {
    'sap.app': {
      id: 'ui5con.project.overview.checks',
      type: 'card',
      title: 'UI5 Project Checks',
      applicationVersion: { version: '1.0.0' }
    },
    'sap.card': {
      type: 'List',
      header: {
        title: 'Project Checks',
        subtitle: `${overview.libraries.length} libraries · ${overview.checks.length} checks`,
        status: { text: 'Same data as WebC' }
      },
      content: {
        data: {
          json: {
            checks: overview.checks.map((check) => ({
              title: check.name,
              description: check.detail,
              value: check.value,
              state: mapCardState(check.state)
            }))
          },
          path: '/checks'
        },
        item: {
          title: '{title}',
          description: '{description}',
          info: {
            value: '{value}',
            state: '{state}'
          }
        }
      }
    }
  };
}

function mapCardState(state: ProjectCheckState): string {
  switch (state) {
    case 'success':
      return 'Success';
    case 'warning':
      return 'Warning';
    case 'error':
      return 'Error';
    default:
      return 'Information';
  }
}
