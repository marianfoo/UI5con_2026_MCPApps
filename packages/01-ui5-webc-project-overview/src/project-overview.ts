export type ProjectCheckState = 'success' | 'warning' | 'error' | 'information';

export interface Ui5ProjectOverview {
  project: {
    id: string;
    title: string;
    description: string;
    version: string;
    ui5Version: string;
    theme: string;
    template: string;
    service: string;
  };
  summary: {
    viewCount: number;
    controllerCount: number;
    modelCount: number;
    libraryCount: number;
  };
  libraries: Array<{
    name: string;
    purpose: string;
  }>;
  checks: Array<{
    name: string;
    state: ProjectCheckState;
    value: string;
    detail: string;
  }>;
}

export const projectOverviewFixture: Ui5ProjectOverview = {
  project: {
    id: 'ui.v2.ordersv2freestylenondraftopenui5',
    title: 'Orders V2 Freestyle',
    description: 'Generated list-detail UI5 application used by the linter demo.',
    version: '0.0.1',
    ui5Version: '1.120.29',
    theme: 'sap_horizon',
    template: 'Fiori freestyle list-detail',
    service: '/odata/v2/orders/'
  },
  summary: {
    viewCount: 6,
    controllerCount: 8,
    modelCount: 2,
    libraryCount: 5
  },
  libraries: [
    { name: 'sap.m', purpose: 'Responsive controls' },
    { name: 'sap.ui.core', purpose: 'UI5 runtime and MVC' },
    { name: 'sap.f', purpose: 'Flexible column layout' },
    { name: 'sap.ui.table', purpose: 'Desktop data tables' },
    { name: 'cc.spreadsheetimporter', purpose: 'Spreadsheet import component' }
  ],
  checks: [
    { name: 'Descriptor', state: 'success', value: 'Valid', detail: 'manifest.json declares the app, models, routing and dependencies.' },
    { name: 'Data source', state: 'information', value: 'OData V2', detail: 'The main service points to /odata/v2/orders/.' },
    { name: 'UI5 linter', state: 'warning', value: 'Findings available', detail: 'The detailed findings are shown in sample 03.' },
    { name: 'Device support', state: 'success', value: 'Responsive', detail: 'Desktop, tablet and phone are enabled.' }
  ]
};

export function getProjectOverview(): Ui5ProjectOverview {
  return projectOverviewFixture;
}

export function summarizeProjectOverview(overview: Ui5ProjectOverview): string {
  return [
    `${overview.project.title} (${overview.project.id}) uses UI5 ${overview.project.ui5Version} with ${overview.project.theme}.`,
    `${overview.summary.viewCount} views, ${overview.summary.controllerCount} controllers and ${overview.summary.libraryCount} libraries.`
  ].join(' ');
}
