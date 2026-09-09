// ─────────────────────────────────────────────────────────────────────────────
// reader-payloads.mjs — the ONE corpus of CLI payload fixtures the plugin's
// readers are tested against (fictional acme tenant throughout).
//
// Two consumers, one set of bytes (CLI-adoption arm, D2, 2026-09-04):
//   - the suites that pin each reader's behaviour (tenant-deps, jo-report,
//     relationships-build, template-doc, doc-lib-fixtures) import their
//     fixtures from here instead of carrying private copies;
//   - test/trace-reader-shapes.mjs runs every reader over these fixtures under
//     a recording Proxy and emits the keys each reader actually dereferences
//     (build/emit-reader-shapes.mjs → data/reader-shapes.json, the read-surface
//     file the gs-fortress watch consults at every CLI audit).
// So a fixture edited to make a suite pass is the same fixture the tracer
// measures: the corpus cannot drift from the evidence.
//
// Key sets are authored from the installed CLI's handler source at the pinned
// version (each block's own comment says which); values are fictional. A new
// payload shape a reader learns to accept gets its fixture HERE, beside the
// generation it belongs to — never inline in one suite.
//
// Not a runner: this file lives under test/fixtures/ so check-doc-drift's
// battery enumeration (non-recursive over test/) never lists it.
// ─────────────────────────────────────────────────────────────────────────────

// ── tenant-deps extractors (rules · reports · jobs · designer · datasets · connectors · journey) ───

export const RULE_EXT = {
  result: true,
  data: {
    ruleDetails: {
      ruleId: "rule-ext-1",
      ruleName: "Acme|LOAD| CSM to Company",
      active: true,
      taskDetails: [
        { taskId: "t1", taskName: "Acme Accounts", object: "Account", objectLabel: "", connectionType: "SFDC", taskType: "sfdcExtract", parents: "" },
        { taskId: "t2", taskName: "Company", object: "company", objectLabel: "", connectionType: "MDA", taskType: "mdaExtract", parents: "" },
        { taskId: "t3", taskName: "Merge", object: "", objectLabel: "", connectionType: "", taskType: "join", parents: "t1, t2" },
      ],
      _flatMappings: [
        { actionType: "DATA_SYNC", areaName: "loadToCompany", srcObject: "Merge", srcField: "Csm Name", tgtObject: "company", tgtField: "CSM" },
        { actionType: "SET_SCOREV2", areaName: "scorecardV2", srcObject: "Merge", srcField: '{ "sc-1": "m-1" }', tgtObject: "scorecard", tgtField: "score" },
        { actionType: "REST_API", areaName: "NativeCta", srcObject: "Merge", srcField: "Cta Name", tgtObject: "Call To Action", tgtField: "Name" },
      ],
    },
    criteriaDetails: [
      {
        criteriaName: "Criteria 1",
        filters: {
          conditions: [
            {
              leftOperand: { fieldName: "Arr__gc", label: "ARR", objectName: "company", objectLabel: "Company" },
              comparisonOperator: "GREATER_THAN",
              filterAlias: "A",
            },
          ],
          expression: "A",
        },
      },
    ],
    gsRuleMetaActionDetails: [
      {
        actionType: "DATA_SYNC",
        actionInfo: {
          mappings: [
            { source: { field: { fieldName: "Csm Name", connectionId: "conn-sfdc-1", connectionType: "SFDC" } } },
            { source: { field: { fieldName: "GSID", connectionId: "MDA", connectionType: "MDA" } } },
          ],
        },
      },
    ],
  },
};

// scorecard-level scoring only (tgtField "scorecard", no measure mapping) —
// the Scorecards section must still surface the card
export const RULE_SC_LEVEL = {
  result: true,
  data: {
    ruleDetails: {
      ruleId: "rule-sc-2",
      ruleName: "Acme Scorecard Grade Setter",
      active: true,
      taskDetails: [{ taskId: "t1", taskName: "Company", object: "company", connectionType: "MDA", taskType: "mdaExtract", parents: "" }],
      _flatMappings: [
        // sc-9 HAS a KB doc (written below with a backtick-quoted `- id:`,
        // the F-341 shape) and must resolve by title; sc-8 has none and must
        // keep rendering unresolved — the two failure modes look alike in
        // the table, and only the documented one is F-341.
        { actionType: "SET_SCOREV2", areaName: "scorecardV2", srcObject: "Company", srcField: "sc-9", tgtObject: "scorecard", tgtField: "scorecard" },
        { actionType: "SET_SCOREV2", areaName: "scorecardV2", srcObject: "Company", srcField: "sc-8", tgtObject: "scorecard", tgtField: "scorecard" },
      ],
    },
    criteriaDetails: [],
  },
};

// ER-22 acceptance shape (fictional): a rule whose task-built source column
// carries the tenant's task-alias prefix (`A_<field>`). An exact-only run
// misses it; an --alias-prefix run must find it — and never the deliberately
// similar-but-unrelated names alongside it.
export const RULE_ALIAS = {
  result: true,
  data: {
    ruleDetails: {
      ruleId: "rule-alias-1",
      ruleName: "Acme|DATA| Renewal Amount v2",
      active: true,
      taskDetails: [
        { taskId: "t1", taskName: "A", object: "renewals_master", objectLabel: "", connectionType: "MDA", taskType: "mdaExtract", parents: "" },
      ],
      _flatMappings: [
        { actionType: "DATA_SYNC", areaName: "loadToRenewals", srcObject: "A", srcField: "A_Renewal Amount", tgtObject: "renewal_summary", tgtField: "Active_Renewal_Amount__gc" },
        { actionType: "DATA_SYNC", areaName: "loadToCompany", srcObject: "A", srcField: "Renewal Amount Total" },
        { actionType: "DATA_SYNC", areaName: "loadToCompany", srcObject: "A", srcField: "AB_Renewal Amount" },
      ],
    },
    criteriaDetails: [],
  },
};

export const RULE_INACTIVE = {
  result: true,
  data: {
    ruleDetails: {
      ruleId: "rule-snow-1",
      ruleName: "Acme Snowflake Pull",
      active: false,
      taskDetails: [
        { taskId: "t1", taskName: "USAGE", object: "usage_summary", connectionType: "SNOWFLAKE", taskType: "snowflakeExtract", parents: "" },
      ],
      _flatMappings: [],
    },
    criteriaDetails: [],
  },
};

// F-217: a rule whose ONLY external reference is an External Action callout —
// the params block carries the External Action's configId and the REST
// connection it calls through, while the action's field mappings reference
// only internal sources (the exact live miss shape: reading mappings alone
// says "no external connection"). Two steps calling the same pair must
// aggregate to one row.
export const RULE_CALLOUT = {
  result: true,
  data: {
    ruleDetails: {
      ruleId: "rule-callout-1",
      ruleName: "Acme License Callout",
      active: true,
      taskDetails: [
        { taskId: "t1", taskName: "Users", object: "license_master", objectLabel: "", connectionType: "MDA", taskType: "mdaExtract", parents: "" },
      ],
      _flatMappings: [],
    },
    criteriaDetails: [],
    gsRuleMetaActionDetails: [
      {
        actionType: "REST_API",
        actionInfo: {
          mappings: [{ source: { field: { fieldName: "UserGSID", connectionId: "GAINSIGHT_API", connectionType: "MDA" } } }],
          params: { configId: "ext-lic-1", connectionId: "conn-rest-1", url: "https://acme.example/v1/users/{{UserGSID}}" },
        },
      },
      { actionType: "REST_API", actionInfo: { mappings: [], params: { configId: "ext-lic-1", connectionId: "conn-rest-1" } } },
    ],
  },
};

// the External Action's own doc (rules-engine-external-actions domain) — the
// registry that resolves its name; url/headers arrive masked from the doc
// generator
export const EXT_ACTION_DOC = {
  result: true,
  data: {
    configId: "ext-lic-1",
    name: "Acme License Assigner",
    config: { method: "PUT", url: "https://acme.example/****", connectionId: "conn-rest-1" },
  },
};

// F-229: a non-callout step whose params record a connectionId but NO
// configId — a real rule→connection edge whose KIND is unproven, which must
// wear the evidence-honest "action-step connection reference" label, never
// "external action callout". F-235: a configId containing a SPACE must
// round-trip the aggregation key intact (the old space-delimited extAgg key
// mis-split it into ids that exist nowhere).
// F-228: the STUB shape — a metadata-only crawl holds the raw list row with no
// data wrapper (configId/name at the top, the connection at config.connectionId
// or connectionId). The reader accepts both; this fixture is what makes the bare
// arm's reads observable to the tracer (it was the one shape the corpus lacked).
export const EXT_ACTION_STUB = {
  configId: "ext-stub-1",
  name: "Acme Stub Assigner",
  config: { method: "POST", url: "https://acme.example/****", connectionId: "conn-rest-stub" },
};

export const RULE_MIXED = {
  result: true,
  data: {
    ruleDetails: { ruleId: "rule-mixed-1", ruleName: "Acme Mixed Steps", active: true, taskDetails: [], _flatMappings: [] },
    criteriaDetails: [],
    gsRuleMetaActionDetails: [
      { actionType: "DATA_SYNC", actionInfo: { params: { connectionId: "conn-s3-9" } } },
      { actionType: "REST_API", actionInfo: { params: { configId: "ext spaced 9", connectionId: "conn-spaced-9" } } },
    ],
  },
};

// F-230: an External Action whose KB NAME carries GetSubstitution $-patterns
// ("$&" expands to the matched phrase under String.replace) — the resolved
// detail must render it verbatim.
export const EXT_DOLLAR_DOC = {
  result: true,
  data: {
    configId: "ext-dollar-1",
    name: "Send $& Webhook",
    config: { method: "POST", url: "https://acme.example/****", connectionId: "conn-dollar-1" },
  },
};
export const RULE_DOLLAR = {
  result: true,
  data: {
    ruleDetails: { ruleId: "rule-dollar-1", ruleName: "Acme Dollar Callout", active: true, taskDetails: [], _flatMappings: [] },
    criteriaDetails: [],
    gsRuleMetaActionDetails: [
      { actionType: "REST_API", actionInfo: { params: { configId: "ext-dollar-1", connectionId: "conn-dollar-1" } } },
    ],
  },
};

export const REPORT_MDA = {
  result: true,
  data: {
    reportId: "rep-1",
    reportName: "Acme ARR by CSM",
    deleted: false,
    sourceDetails: { objectName: "company", objectLabel: "Company", connectionId: "MDA", connectionType: "MDA", dataStoreType: "HAPOSTGRES" },
    showFields: [
      { fieldName: "Arr__gc", label: "ARR", objectName: "company", fieldAlias: "FF_Arr" },
      {
        fieldName: "Score",
        label: "Score",
        fieldType: "calculated",
        expressionDetails: { expression: { arguments: [{ fieldName: "Csm_Name__gc", label: "CSM Name", objectName: "company" }] } },
      },
    ],
    groupByFields: [{ fieldName: "Csm_Name__gc", label: "CSM Name", objectName: "company" }],
    whereFilters: {
      conditions: [
        {
          leftOperand: { fieldName: "Status__gc", label: "Status", objectName: "company", objectLabel: "Company" },
          comparisonOperator: "EQUALS",
          filterAlias: "A",
        },
      ],
      expression: "A",
    },
  },
};

export const REPORT_SFDC = {
  result: true,
  data: {
    reportId: "rep-sfdc-1",
    reportName: "Acme Open Opportunities",
    deleted: false,
    sourceDetails: { objectName: "Opportunity", objectLabel: "Opportunity", connectionId: "SFDC_00Dacme", connectionType: "SFDC", dataStoreType: "SFDC" },
    showFields: [{ fieldName: "Name", label: "Name", objectName: "Opportunity" }],
  },
};

export const JOB = {
  jobId: "job-1",
  jobName: "Acme Pricebook Sync",
  disabled: false,
  connectionDetails: { connectionId: "conn-sfdc-1", connectionName: "Acme Prod SFDC", connectionStatus: "AUTHORIZED", connectorType: "SFDC" },
  properties: { APPLICATION_DATA_TARGET_OBJECT: "GS Pricebook", APPLICATION_DATA_TARGET_OBJECT_NAME: "gs_pricebook" },
  taskInfo: [
    {
      taskId: "t1",
      taskName: "Salesforce Pricebook2",
      objectName: "Pricebook2",
      fieldInfoList: [{ fieldName: "Id", label: "Price Book ID", fieldAlias: "price_book_id__gs" }],
    },
  ],
};

// Data-designer docs come in THREE task-shape generations (scripts/tenant-deps.mjs
// extractDesignerUsages header), and the suite carries all three — F-342/F-343
// were one bare, legacy-shaped fixture certifying a reader the live CLI had
// already left behind:
//   DESIGNER_LEGACY       — CLI 1.0.4–1.0.7 model-authored docs: bare body, tasks
//                           with queryInfo + connectionDetails, no `_` keys.
//   DESIGNER_LIVE_SUMMARY — CLI 1.0.8 `dd t describe`, header without embedded
//                           task config (the common live case, F-343): envelope,
//                           tasks are summarizeTaskForRow rows — id/name/type/
//                           parents + _object/_connType/_fieldCount/_filterCount/
//                           _groupByCount — and NO queryInfo/connectionDetails.
//   DESIGNER_HYBRID       — the CLI 1.0.4 describe's shape, still in KBs (B12
//                           tester, real KB, 2026-09-02): summarizeTaskForRow
//                           spread the RAW task and added the `_` keys, with NO
//                           kind test — `_object` is queryInfo.objectName whatever
//                           the task, so a derived task carries its upstream TASK
//                           ID there. (F-344 stands for pin 1.0.8: no describe
//                           there emits raw + summary together; this shape is
//                           older docs, not a live one.)
// Key sets authored from the installed CLI's handler source at pin 1.0.8
// (data-designer/template.js describeTemplate; common/shared.js
// summarizeTaskForRow), fictional values.
export const LEGACY_TASK = {
  id: "t1",
  name: "CTAs",
  type: "mdaExtract",
  connectionDetails: { connectionId: "MDA", connectionType: "MDA" },
  queryInfo: {
    objectName: "call_to_action",
    show: [{ fieldName: "Name", label: "Name", objectName: "call_to_action" }],
    criteria: {
      conditions: [
        {
          leftOperand: { fieldName: "Arr__gc", label: "ARR", objectName: "company", objectLabel: "Company" },
          comparisonOperator: "GREATER_THAN",
          filterAlias: "A",
        },
      ],
    },
  },
};
export const DESIGNER_LEGACY = { templateId: "dd-1", name: "Acme CTA Rollup", _tasks: [LEGACY_TASK] };
export const DESIGNER_LIVE_SUMMARY = {
  result: true,
  data: {
    templateId: "dd-2",
    name: "Acme Company Health",
    description: "",
    folderId: "",
    modifiedByName: "",
    modifiedDateStr: "",
    _taskCount: 2,
    // Exact live key set (one read-only `dd t describe` on 2026-09-01, pin 1.0.8):
    // taskId, taskName, taskType, _parents (a joined STRING), _object, _connType,
    // _fieldCount, _filterCount, _groupByCount — no queryInfo, no connectionDetails.
    _tasks: [
      { taskId: "t1", taskName: "Companies", taskType: "mdaExtract", _parents: "", _object: "company", _connType: "MDA", _fieldCount: 4, _filterCount: 1, _groupByCount: 0 },
      { taskId: "t2", taskName: "Merge", taskType: "merge", _parents: "t1", _object: "", _connType: "MDA", _fieldCount: 8, _filterCount: 1, _groupByCount: 0 },
      // F-345: a labelled source object — summarizeTask emits the COMPOUND
      // "Label (name)" display form; the reader must split it, not match it whole.
      { taskId: "t3", taskName: "Account Records", taskType: "mdaExtract", _parents: "", _object: "Account Record (accountrec__gc)", _connType: "MDA", _fieldCount: 2, _filterCount: 0, _groupByCount: 0 },
      // DS-45 (W8): a LABEL-ONLY source object — the emitter prints the label
      // alone when a task carries an object label but no object name. On a
      // derived task (pivot here) that is the only reading: the no-label
      // branch would have printed "". The row must carry it as objectLabel
      // with objectName null — never as the name.
      { taskId: "t4", taskName: "Acme Sponsor Rollup", taskType: "pivot", _parents: "t1", _object: "Acme Sponsor Tracking", _connType: "MDA", _fieldCount: 3, _filterCount: 0, _groupByCount: 1 },
    ],
  },
};
export const DESIGNER_HYBRID = {
  result: true,
  data: {
    templateId: "dd-3",
    name: "Acme CTA Rollup (full)",
    _taskCount: 1,
    _tasks: [{ ...LEGACY_TASK, _object: "call_to_action", _connType: "MDA", _fieldCount: 1, _filterCount: 1, _groupByCount: 0 }],
  },
};
// A DERIVED hybrid task (unit-only, kept out of the e2e KB so the caveat
// counts there stay put): the 1.0.4 summarizer copied the internal
// source-task reference into `_object` — the same value queryInfo.objectName
// carries — with no kind test.
export const HYBRID_DERIVED_TASK = {
  id: "t3", name: "Merge", type: "join", parents: ["t1"],
  connectionDetails: { connectionId: "MDA", connectionType: "MDA" },
  queryInfo: { objectName: "t1", show: [], criteria: {} },
  _object: "t1", _connType: "MDA", _fieldCount: 3, _filterCount: 0, _groupByCount: 0,
};
// Kept for the older checks below that feed the legacy body directly.
export const DESIGNER_BODY = {
  templateId: "dd-1",
  name: "Acme CTA Rollup",
  _tasks: [
    {
      id: "t1",
      name: "CTAs",
      type: "mdaExtract",
      connectionDetails: { connectionId: "MDA", connectionType: "MDA" },
      queryInfo: {
        objectName: "call_to_action",
        show: [{ fieldName: "Name", label: "Name", objectName: "call_to_action" }],
        criteria: {
          conditions: [
            {
              leftOperand: { fieldName: "Arr__gc", label: "ARR", objectName: "company", objectLabel: "Company" },
              comparisonOperator: "GREATER_THAN",
              filterAlias: "A",
            },
          ],
        },
      },
    },
  ],
};

export const DESIGNER = { result: true, data: DESIGNER_BODY };

export const DATASET = {
  objectName: "acme_mbo_tracking",
  label: "Acme MBO Tracking",
  fieldCount: 2,
  fields: [
    { fieldName: "CcActivityDate", displayName: "CC Activity Date" },
    { fieldName: "Arr__gc", displayName: "ARR" },
  ],
};

export const CONN_1 = {
  pnpConnectionsInfo: {
    connectionId: "conn-sfdc-1",
    connectionName: "Acme Prod SFDC",
    connectionType: "SFDC",
    connectionStatus: "AUTHORIZED",
    authorizationType: "OAUTH",
  },
};
export const CONN_2 = {
  pnpConnectionsInfo: {
    connectionId: "conn-sfdc-2",
    connectionName: "Acme Sandbox SFDC",
    connectionType: "SFDC",
    connectionStatus: "INIT",
    authorizationType: "OAUTH",
  },
};
export const CONN_SNOW = {
  pnpConnectionsInfo: {
    connectionId: "conn-snow-1",
    connectionName: "Acme Snowflake",
    connectionType: "SNOWFLAKE",
    connectionStatus: "AUTHORIZED",
    authorizationType: "M2M_OAUTH",
  },
};

export const SCORECARD = [
  {
    name: "Acme Scorecard",
    children: [
      {
        levelType: "GROUP",
        measureId: "g-1",
        name: "Engagement",
        children: [{ levelType: "MEASURE", measureId: "m-1", name: "Adoption" }],
      },
    ],
  },
];

export const JOURNEY_PAYLOAD = {
  result: true,
  data: {
    advancedOutreach: {
      advancedOutreachId: "prog-1",
      advancedOutreachName: "Acme Onboarding",
      advancedOutreachStatus: ["PROCESSING"],
      advancedOutreachModel: "DYNAMIC_PROGRAM",
      advancedOutreachModelName: "Program",
      stepJson: "[]",
      participantSourceConfigurations: [
        {
          participantSourceConfigurationId: "cfg-1",
          participantSourceType: "DYNAMIC_QUERY_V2",
          participantSourceName: "Src A",
          mappingInformation: JSON.stringify({ recipientEmailAddress: "Nominee Email" }),
          customMappings: JSON.stringify({}),
          config: JSON.stringify({
            filters: {
              conditions: [
                {
                  leftOperand: { objectName: "company", fieldName: "Arr__gc", label: "ARR" },
                  comparisonOperator: "GREATER_THAN",
                  filterAlias: "A",
                },
              ],
            },
          }),
        },
      ],
    },
  },
};

// F-388: the FLAT `cn list` row a CLI 1.0.9 captures (v2 duct connections) —
// the five fields at top level, no pnpConnectionsInfo key. DERIVED from the CLI
// package source (handlers/connectors.js header comment + connectors.json
// fieldsCatalog paths at 1.0.9; gs-fortress audit-1.0.9 §1 item 5 / §1.11),
// NOT a captured payload — the capture is the CP-6 arm the maintainers bank (repo validation ledger).
// Fictional values (acme). Lives beside the nested fixtures so one KB carries
// both generations — the mixed, long-lived-workspace case the F-388 probe
// measured SILENT before the fix.
export const CONN_FLAT_S3 = {
  connectionId: "conn-s3-9",
  connectionName: "Acme S3 Drop",
  connectionType: "S3",
  connectionStatus: "AUTHORIZED",
  authorizationType: "ACCESS_KEY",
};
// A connector job on the flat-shape connection (job rows are unchanged at 1.0.9:
// connectionDetails / taskInfo keys intact — the 1.0.8→1.0.9 handler diff).
export const JOB_S3 = {
  jobId: "job-s3-9",
  jobName: "Acme S3 Usage Load",
  disabled: false,
  connectionDetails: { connectionId: "conn-s3-9", connectionName: "Acme S3 Drop", connectionStatus: "AUTHORIZED", connectorType: "S3" },
  taskInfo: [{ taskId: "t1", taskName: "usage csv", objectName: "usage_summary", fieldInfoList: [{ fieldName: "Usage_Count__gc", label: "Usage Count" }] }],
};

// ── dm deps check — the all-areas live-dependents payload (parseLiveDepsAreas) ───

export const DEPS_CHECK = {
  result: true,
  data: {
    objectName: "company",
    progressStatus: { overallStatus: "COMPLETED" },
    dependents: {
      RULE: [{ entityId: "rule-ext-1", entityName: "Acme|LOAD| CSM to Company", columnReferences: [{ displayName: "ARR" }] }],
      REPORT: [{ entityId: "rep-1", entityName: "Acme ARR by CSM" }],
      JOURNEY_ORCHESTRATOR: [{ entityId: "prog-1", entityName: "Acme Onboarding" }],
      C360: [{ entityId: "layout-1", entityName: "Acme C360 Layout" }],
    },
  },
};

// ── designer COMPOSITE — the describe-batch _kb drilldown tables (W9) ─────────

export const showRow = (i, field, type = "STRING", calc = "—") => ({ _index: i, _field: field, _type: type, _calc: calc });
export const detailRows = (kv) => Object.entries(kv).map(([k, v]) => ({ _key: k, _value: v }));
export const T1 = {
  _taskDetailRows: detailRows({ "Task ID": "t1", Name: "Companies", Type: "mdaExtract", Parents: "—", Children: "t3", Source: "company (MDA)", "Show Fields": "4" }),
  // "ARR (MAX)" = an aggregated field (suffix stripped for the --field call);
  // "Name" twice = the measured duplicate-label case; "Extra" = refused by
  // the CLI under every spelling (permanent gap); "Score" = a calculated
  // field whose detail carries no Field Name row.
  _taskShowFields: [showRow(1, "ARR (MAX)", "NUMBER"), showRow(2, "Name"), showRow(3, "Name"), showRow(4, "Lifecycle Stage"), showRow(5, "Extra"), showRow(6, "Score", "NUMBER", "ƒ(NUMBER)")],
  _taskCriteriaConditions: [{ _index: 1, _alias: "A", _lhsField: "ARR", _lhsType: "NUMBER", _operator: "GREATER_THAN", _rhsType: "VALUE", _rhsValue: "1000" }],
  _taskCriteriaExpressionRows: [{ _expr: "A" }], _taskJoinConditions: [], _taskUnionMerged: [], _taskUnionOther: [],
  _taskS3Export: [], _taskS3FieldOrder: [], _taskPivotColumns: [], _taskPivotConditions: [],
  _taskFieldDetail: [], _taskFieldFormula: [], _taskFieldCase: [],
};
export const T3 = {
  _taskDetailRows: detailRows({ "Task ID": "t3", Name: "Merge", Type: "join", Parents: "t1, t2", Children: "—", "Join Type": "LEFT", "Base Task": "t1 (Companies)", "Joined Task": "t2 (Users)", "Fields (t1)": "Companies: ARR, Lifecycle Stage (2)", "Fields (t2)": "Users: Email (1)" }),
  _taskShowFields: [],
  _taskCriteriaConditions: [{ _index: 1, _alias: "A", _lhsField: "Lifecycle Stage", _lhsType: "STRING", _operator: "EQUALS", _rhsType: "FIELD", _rhsValue: "Email" }],
  _taskCriteriaExpressionRows: [{ _expr: "A" }],
  _taskJoinConditions: [{ _index: 1, _left: "Companies.Gsid", _op: "EQ", _right: "Users.CompanyId__gc" }],
  _taskUnionMerged: [], _taskUnionOther: [], _taskS3Export: [], _taskS3FieldOrder: [], _taskPivotColumns: [], _taskPivotConditions: [],
  _taskFieldDetail: [], _taskFieldFormula: [], _taskFieldCase: [],
};
export const fd = (kv) => detailRows(kv);
// t4: a join task whose `Fields (src)` row does not parse (declared 2, three
// items) — the reader must say so as its own row even though a derived task
// has no source-object row (review round, T1).
export const T4 = {
  _taskDetailRows: detailRows({ "Task ID": "t4", Name: "Bad Join", Type: "join", Parents: "t1, t2", Children: "—", "Fields (t1)": "Companies: ARR, Name, Extra (2)" }),
  _taskShowFields: [], _taskCriteriaConditions: [], _taskCriteriaExpressionRows: [],
  _taskJoinConditions: [{ _index: 1, _left: "Companies.Gsid", _op: "EQ", _right: "Users.CompanyId__gc" }],
  _taskUnionMerged: [], _taskUnionOther: [], _taskS3Export: [], _taskS3FieldOrder: [], _taskPivotColumns: [], _taskPivotConditions: [],
  _taskFieldDetail: [], _taskFieldFormula: [], _taskFieldCase: [],
};
export const KB_COMPOSITE = {
  version: 1, templateFingerprint: "f".repeat(40), capturedAt: "2026-09-02T00:00:00.000Z", flags: { task: "--task-id", field: "--field" },
  tasks: { t1: { status: "ok" }, t2: { status: "failed", error: "exit 1: boom" }, t3: { status: "ok" }, t4: { status: "ok", fieldListUnparsed: "Fields (t1): value does not parse as \"<label>: f1, f2 (N)\" with exactly one split yielding N fields (0 qualifying split(s))" } },
  fields: {
    t1: {
      ARR: { status: "ok", source: "show", suffix: "MAX" }, Name: { status: "ok", source: "show", duplicates: 1 },
      "Lifecycle Stage": { status: "failed", source: "show", error: "exit 1: no field" },
      Extra: { status: "failed", source: "show", error: "exit 1: No field found on task \"t1\" matching: \"Extra\"", permanent: true },
      Score: { status: "ok", source: "show" },
    },
    t3: { ARR: { status: "ok", source: "join" }, "Lifecycle Stage": { status: "ok", source: "join" }, Email: { status: "ok", source: "join" } },
    t4: {},
  },
  taskDetails: { t1: T1, t3: T3, t4: T4 },
  fieldDetails: {
    t1: {
      ARR: fd({ Task: "t1 (Companies)", "Display Name": "ARR", "Field Name": "Arr__gc", "Field Alias (output header)": "ARR", "Source Object": "Company (company)", Connection: "MDA", "Data Type": "NUMBER", Aggregation: "MAX", "Group By": "No" }),
      Name: fd({ Task: "t1 (Companies)", "Display Name": "Name", "Field Name": "Name", "Field Alias (output header)": "Name", "Source Object": "company", Connection: "MDA", "Data Type": "STRING", "Group By": "No" }),
      // A calculated field: buildFieldDetail pushes no "Field Name" row when
      // fieldName is empty (review round, T2).
      Score: fd({ Task: "t1 (Companies)", "Display Name": "Score", "Field Alias (output header)": "Score", "Data Type": "NUMBER", "Group By": "No" }),
    },
    t3: {
      ARR: fd({ Task: "t3 (Merge)", "Display Name": "ARR", "Field Name": "Arr__gc", "Field Alias (output header)": "ARR", "Source Object": "Company (company)", Connection: "MDA", "Data Type": "NUMBER" }),
      // Connection differs from the task's own type: a connection of its own
      // (review round, T4).
      "Lifecycle Stage": fd({ Task: "t3 (Merge)", "Display Name": "Lifecycle Stage", "Field Name": "LifecycleStage__gc", "Field Alias (output header)": "Stage", "Source Object": "Account Record", Connection: "SFDC", "Data Type": "STRING" }),
      Email: fd({ Task: "t3 (Merge)", "Display Name": "Email", "Field Name": "Email", "Field Alias (output header)": "Email", "Source Object": "User (gsuser)", Connection: "MDA", "Data Type": "STRING" }),
    },
  },
};
export const DESIGNER_COMPOSITE = {
  result: true,
  data: {
    templateId: "dd-4", name: "Acme Composite Rollup", description: "", folderId: "", modifiedByName: "", modifiedDateStr: "", _taskCount: 4,
    _tasks: [
      { taskId: "t1", taskName: "Companies", taskType: "mdaExtract", _parents: "", _object: "Company (company)", _connType: "MDA", _fieldCount: 6, _filterCount: 1, _groupByCount: 0 },
      { taskId: "t2", taskName: "Users", taskType: "mdaExtract", _parents: "", _object: "gsuser", _connType: "MDA", _fieldCount: 1, _filterCount: 0, _groupByCount: 0 },
      { taskId: "t3", taskName: "Merge", taskType: "join", _parents: "t1, t2", _object: "", _connType: "MDA", _fieldCount: 3, _filterCount: 1, _groupByCount: 0 },
      { taskId: "t4", taskName: "Bad Join", taskType: "join", _parents: "t1, t2", _object: "", _connType: "MDA", _fieldCount: 3, _filterCount: 0, _groupByCount: 0 },
    ],
    ...Object.fromEntries(Object.keys(T1).map((k) => [k, []])),
    _kb: KB_COMPOSITE,
  },
};

// ── relationships-build docs — a scorecard card doc and a chain doc ───────────

export const SCORECARD_CARD = {
  id: "sc-gsid-acme-0001",
  name: "Acme Customer Health",
  payload: {
    data: [
      {
        levelType: "GROUP",
        measureId: "m-gsid-acme-0100",
        name: "Usage",
        children: [
          { levelType: "MEASURE", measureId: "m-gsid-acme-0101", name: "Login Frequency" },
          { levelType: "MEASURE", measureId: "m-gsid-acme-0102", name: "Feature Adoption" },
        ],
      },
    ],
  },
};
export const CHAIN = {
  id: "wf-acme-0001",
  name: "Acme Nightly Scoring",
  payload: {
    data: {
      chainDetails: {
        name: "Acme Nightly Scoring",
        tasks: [
          { type: "BIONIC_RULE", name: "CS|Health|Compute Score Trend" },
          { _ruleName: "CS|Ops|Sync Legacy Flags" },
        ],
      },
    },
  },
};

// ── journey programs — classic generation builders + the flow-canvas nodes AO ───

export const emailAction = (tplId, tplName, variantId) =>
  JSON.stringify({
    emailTemplateId: tplId,
    emailTemplateName: tplName,
    variantMappings: [
      {
        variantTokenMapping: {
          templateId: tplId,
          templateName: "Default",
          tokenMapping: {
            tokens: [
              {
                name: "embd::gs-token-first",
                value: {
                  type: "field", field: "firstName", fieldName: "FirstName", fieldType: "field",
                  label: "firstName", fieldLabel: "First Name", valueType: "STRING", objectName: "particpantscollection",
                },
              },
              { name: "unsubscribeText", value: { type: "value", valueType: "STRING", value: "Click here to unsubscribe." } },
            ],
          },
          surveyTokenMappings: [
            { id: "gs-token-survey", surveyToken: { surveyId: "SVY-1", surveyName: "Intake Survey", tokenType: "SURVEY", language: "en_us" } },
          ],
        },
        defaultTemplate: true,
      },
      ...(variantId ? [{ variantTokenMapping: { templateId: variantId, templateName: "Variant B" } }] : []),
    ],
  });

/** @param {{id:string, name:string, status:string, tplId:string, tplName:string, variantId?:string}} ao */
export const makeAo = ({ id, name, status, tplId, tplName, variantId }) => ({
  advancedOutreachId: id,
  advancedOutreachName: name,
  advancedOutreachStatus: [status],
  advancedOutreachModel: "DRIPV2",
  advancedOutreachModelName: "Email Chain",
  advancedOutreachStartDate: 1670000000000,
  stepJson: JSON.stringify([
    { stepId: "Start_1", stepType: "START", stepName: "Start", order: 1, enable: true },
    {
      stepId: "Action_2", stepType: "ACTION", actionType: "OUTBOUND_CALL", outboundAction: "SEND_EMAIL",
      stepName: "Send Email", order: 2, enable: true, emailActionJson: emailAction(tplId, tplName, variantId),
    },
    { stepId: "Timer_3", stepType: "TIMER", stepName: "Wait", timerType: "SINGLE", order: 3, enable: true, timerValue: "P3D" },
    { stepId: "End_4", stepType: "END", stepName: "End", order: 4, enable: true },
  ]),
  aoConfiguration: JSON.stringify({
    scheduleInfo: {
      schedules: [{
        type: "CRON", cronExpression: "0 0 8 1/1 * ? *", nextRunTime: 1782000000000,
        lastSuccessTime: 1781900000000, lastRunSuccess: true, runningNow: false,
        timeZoneName: "America/New_York", jobType: "ADVANCED_OUTREACH_SCHEDULE",
      }],
    },
  }),
  participantSourceConfigurations: [{
    participantSourceConfigurationId: "cfg-1",
    participantSourceType: "BIONIC",
    participantSourceName: "Nominees",
    participantSourceCollectionId: "coll-1",
    participantOperationType: "ADD_ALL_PARTICIPANT_IN_POWER_LIST",
    mappingInformation: JSON.stringify({ recipientEmailAddress: "Nominee Email" }),
    customMappings: JSON.stringify({ f5ewvo27: { fieldName: "Account_ID" } }),
    scheduleInfo: JSON.stringify({
      schedules: [{ type: "CRON", cronExpression: "0 0 8 ? * MON *", timeZoneName: "UTC", jobType: "ADVANCED_OUTREACH_BIONIC_QUERY" }],
    }),
    config: JSON.stringify({
      filters: {
        conditions: [{
          leftOperand: { fieldName: "OptOut", label: "Email Opt Out", objectName: "nominees_obj", dataType: "BOOLEAN" },
          filterAlias: "A", comparisonOperator: "EQ", rightOperandType: "VALUE", filterValue: { value: [false] },
        }],
        expression: "A",
      },
    }),
  }],
});

export const JOURNEY_FLOW_VTM = [
  {
    id: "subj::gs-flow-hris", tokenType: "STANDARD",
    tokenMapping: {
      name: "subj::gs-flow-hris",
      value: { type: "FIELD", dataType: "STRING", fieldConfig: { field: "dv1", objectName: "ao_participant_custom_fields", used: true }, label: "Vendor Portal Provider" },
    },
  },
  { id: "gs-flow-survey", tokenType: "SurveyToken", surveyToken: { tokenType: "SURVEY", language: "en_us" } },
  {
    id: "embd::gs-flow-calc", tokenType: "STANDARD",
    tokenMapping: { name: "embd::gs-flow-calc", value: { type: "DYNAMIC_QUERY_V2", dataType: "STRING", fieldConfig: { fieldId: "calc-01" }, label: "CSM Name Calc" } },
  },
];
export const JOURNEY_NODES_AO = {
  advancedOutreachId: "prog-nodes", advancedOutreachName: "Flow Program",
  advancedOutreachStatus: ["NEW"], advancedOutreachModel: "DYNAMIC_PROGRAM",
  stepJson: JSON.stringify({
    nodes: [
      { type: "START", id: "n1", name: "Audience", nodeType: "START", properties: { x: 1, y: 2 } },
      {
        type: "SURVEY_ACTION", id: "n2", name: "Send Email", nodeType: "ACTION",
        surveyIdFromEmailActionV2: "SVY-FLOW",
        actionConfig: JSON.stringify({
          globalConfigInfo: { surveyInfo: { surveyId: "SVY-FLOW", surveyName: "Flow Intake Survey", surveyParameters: { surveySiteURL: "https://x.example.com" } } },
          emailTemplateId: "tpl-nodes", emailTemplateName: "Flow Email",
          variantMappings: [{ templateId: "tpl-nodes", templateName: "Default", variantTokenMapping: JOURNEY_FLOW_VTM }],
        }),
      },
    ],
    edges: [],
  }),
};

// ── email templates — jo e template payloads (renderTemplateDoc) ──────────────

export const TEMPLATE_MAIN = {
  templateId: "tpl 1/weird",
  title: "Welcome & Hello",
  subject: "Hi &amp; welcome",
  htmlContent: "&lt;html&gt;&lt;body&gt;&lt;p&gt;HTML ONLY MARKER&lt;/p&gt;&lt;/body&gt;&lt;/html&gt;",
  editorContent: "&lt;html&gt;EDITOR ONLY MARKER&lt;/html&gt;",
  plainTextContent: "Hello and welcome to PF, this is the plain searchable body.",
  active: true, transactional: false, variantCount: 1, builderVersion: 2,
  system: false, published: false, folderId: 68,
  createdDate: 1681441493742, createdByName: "Jordan",
  createdDateStr: "2023-04-14 03:04:53 UTC",
  modifiedDateStr: "2023-06-12 18:26:31 UTC", modifiedByName: "Leah",
};

export const TEMPLATE_FALLBACK = {
  templateId: "tpl-2",
  title: "No Plain Body",
  subject: "Fallback",
  htmlContent: "&lt;html&gt;&lt;head&gt;&lt;style&gt;.x{color:red}&lt;/style&gt;&lt;/head&gt;" +
    "&lt;body&gt;&lt;p&gt;Milestone deadline is approaching &amp;amp; near&lt;/p&gt;&lt;/body&gt;&lt;/html&gt;",
  plainTextContent: "",
};

export const TEMPLATE_VARIANTS = { templateId: "tpl-3", title: "With Variants", subject: "V", plainTextContent: "Primary body content goes here." };
// The variant carries all three body arms so bodyOf's `plainTextContent`, then
// `htmlContent ?? editorContent` chain is MEASURED at the variant site too, not
// only at the template's (F-390 round 2, mechanism iii: a key no fixture carries
// can never be a deletion candidate, so it can never earn an alternate).
export const TEMPLATE_VARIANT_B = {
  variantName: "Variant B", subject: "V-B", plainTextContent: "Variant body content lives here.",
  htmlContent: "&lt;p&gt;Variant HTML body&lt;/p&gt;", editorContent: "&lt;p&gt;Variant editor body&lt;/p&gt;",
};

export const TEMPLATE_TOKENS = {
  templateId: "tpl-4", title: "With Tokens", subject: "T ${subj::gs-t1}", plainTextContent: "Body.",
  _tokens: [{ variant: "Default", tokenKey: "subj::gs-t1", displayName: "Product Name", defaultValue: "Your Product", tokenType: "STANDARD" }],
  tokenMappings: { MDA: { "gs-t2": { surveyToken: { surveyId: "SVY-1", surveyName: "Intake", tokenType: "SURVEY" } } } },
};

// ── KB indexer + paginated list pages (findItemsArray · scanListEnvelope) ─────

export const INDEXER_PAYLOAD = { data: { rows: [{ rid: "1" }, { rid: "2" }], decoys: [{ z: 1 }] } };

export const LIST_PAGE_ROWS = {
  data: { liteObjects: [{ id: 1, steps: Array.from({ length: 50 }, (_, i) => i) }, { id: 2 }, { id: 3 }] },
};

export const LIST_PAGE_TOTALS = {
  _total: 74,
  data: {
    data: [1, 2],
    pageInfo: { totalRecords: 474, totalAfterFilters: 474 },
    totalNumberOfObjects: 591,
    totalCount: 9,
  },
};

export const LIST_PAGE_PAGEINFO = { data: { limit: 99, pageInfo: { pageSize: 200, returned: 20 } } };

// ── paginated list pages: the CONTINUATION signals (F-390 tester item 1) ──────
// scanListEnvelope recognises PAGE_SIGNAL_KEYS anywhere on the spine by
// membership over Object.keys, so the tracer can only record what a fixture
// carries — and the corpus carried none of the five until this round.
export const LIST_PAGE_SIGNALS = {
  data: {
    rows: [{ id: "a" }, { id: "b" }],
    totalPages: 12,
    lastPage: false,
    nextAvailable: true,
    nextPage: 3,
    pageNumber: 2,
    pageInfo: { totalRecords: 240, returned: 20 },
  },
};

// ── dd t describe, the THREE levels the designer doc-mode spawns (F-390 tester
// item 2) — the payloads a fake gs-admin prints for describe-batch.mjs, built
// from the composite's own tables so the fake and the tracer share one set of
// bytes. Header shape per the CLI at pin 1.0.8 (the describe-batch suite's fake).
const DD_EMPTY_TABLES = Object.fromEntries(
  ["_taskDetailRows", "_taskShowFields", "_taskFieldDetail", "_taskFieldFormula", "_taskFieldCase", "_taskJoinConditions", "_taskUnionMerged",
   "_taskUnionOther", "_taskS3Export", "_taskS3FieldOrder", "_taskCriteriaExpressionRows", "_taskCriteriaConditions", "_taskPivotColumns", "_taskPivotConditions"].map((k) => [k, []]),
);
const DD_HEADER = { templateId: "dd-9", name: "Acme Drilldown Rollup", description: "", folderId: "", modifiedByName: "", modifiedDateStr: "2026-01-15 00:00:00 UTC", _taskCount: 2 };
export const DESIGNER_DRILLDOWN = {
  templateId: "dd-9",
  template: {
    result: true,
    data: {
      ...DD_HEADER,
      _tasks: [
        { taskId: "t1", taskName: "Companies", taskType: "mdaExtract", _parents: "", _object: "Company (company)", _connType: "MDA", _fieldCount: 2, _filterCount: 1, _groupByCount: 0 },
        { taskId: "t3", taskName: "Merge", taskType: "join", _parents: "t1", _object: "", _connType: "MDA", _fieldCount: 1, _filterCount: 0, _groupByCount: 0 },
      ],
      ...DD_EMPTY_TABLES,
    },
  },
  tasks: {
    t1: { result: true, data: { ...DD_HEADER, _tasks: [], ...DD_EMPTY_TABLES, ...T1, _taskShowFields: [showRow(1, "ARR (MAX)", "NUMBER"), showRow(2, "Name")] } },
    t3: { result: true, data: { ...DD_HEADER, _tasks: [], ...DD_EMPTY_TABLES, ...T3 } },
  },
  fields: {
    t1: {
      ARR: { result: true, data: { ...DD_HEADER, _tasks: [], ...DD_EMPTY_TABLES, _taskFieldDetail: fd({ Task: "t1 (Companies)", "Display Name": "ARR", "Field Name": "Arr__gc", "Field Alias (output header)": "ARR", "Source Object": "Company (company)", Connection: "MDA", "Data Type": "NUMBER", Aggregation: "MAX", "Group By": "No" }), _hideHeaderFields: true } },
      Name: { result: true, data: { ...DD_HEADER, _tasks: [], ...DD_EMPTY_TABLES, _taskFieldDetail: fd({ Task: "t1 (Companies)", "Display Name": "Name", "Field Name": "Name", "Field Alias (output header)": "Name", "Source Object": "company", Connection: "MDA", "Data Type": "STRING", "Group By": "No" }), _hideHeaderFields: true } },
    },
    t3: {
      ARR: { result: true, data: { ...DD_HEADER, _tasks: [], ...DD_EMPTY_TABLES, _taskFieldDetail: fd({ Task: "t3 (Merge)", "Display Name": "ARR", "Field Name": "Arr__gc", "Field Alias (output header)": "ARR", "Source Object": "Company (company)", Connection: "MDA", "Data Type": "NUMBER" }), _hideHeaderFields: true } },
      "Lifecycle Stage": { result: true, data: { ...DD_HEADER, _tasks: [], ...DD_EMPTY_TABLES, _taskFieldDetail: fd({ Task: "t3 (Merge)", "Display Name": "Lifecycle Stage", "Field Name": "LifecycleStage__gc", "Field Alias (output header)": "Stage", "Source Object": "Account Record", Connection: "SFDC", "Data Type": "STRING" }), _hideHeaderFields: true } },
      // the join's `Fields (t2)` row names Email too — every label the composite derives must resolve, or the real script records a gap
      Email: { result: true, data: { ...DD_HEADER, _tasks: [], ...DD_EMPTY_TABLES, _taskFieldDetail: fd({ Task: "t3 (Merge)", "Display Name": "Email", "Field Name": "Email", "Field Alias (output header)": "Email", "Source Object": "User (gsuser)", Connection: "MDA", "Data Type": "STRING" }), _hideHeaderFields: true } },
    },
  },
};
