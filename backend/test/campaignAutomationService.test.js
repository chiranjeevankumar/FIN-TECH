const test = require("node:test");
const assert = require("node:assert/strict");
const { mock } = require("node:test");

const prisma = {
  workflow: {
    findMany: mock.fn(),
  },
  sequence: {
    findFirst: mock.fn(),
  },
  sequenceEnrollment: {
    findFirst: mock.fn(),
    create: mock.fn(),
  },
  leadTag: {
    findFirst: mock.fn(),
  },
  savedSearch: {
    findFirst: mock.fn(),
  },
};

const postgresModulePath = require.resolve("../config/postgres");
const originalPostgres = require.cache[postgresModulePath];

require.cache[postgresModulePath] = {
  id: postgresModulePath,
  filename: postgresModulePath,
  loaded: true,
  exports: { prisma },
};

const {
  enrollLeadInActiveCampaigns,
  leadMatchesAudience,
} = require("../services/campaignAutomationService");

const resetMocks = () => {
  for (const group of Object.values(prisma)) {
    for (const fn of Object.values(group)) {
      fn.mock.resetCalls();
      fn.mock.mockImplementation(() => undefined);
    }
  }
};

test.after(() => {
  if (originalPostgres) {
    require.cache[postgresModulePath] = originalPostgres;
  } else {
    delete require.cache[postgresModulePath];
  }
});

test.beforeEach(() => {
  resetMocks();
});

test("campaign automation service loads and exports expected functions", () => {
  assert.equal(typeof enrollLeadInActiveCampaigns, "function");
  assert.equal(typeof leadMatchesAudience, "function");
});

test("all audience matches a lead", async () => {
  const lead = {
    id: 1,
    email: "lead@example.com",
    status: "new",
  };

  const result = await leadMatchesAudience(
    lead,
    "all",
    10
  );

  assert.equal(result, true);
});

test("status audience matches only the requested status", async () => {
  const lead = {
    id: 1,
    email: "lead@example.com",
    status: "new",
  };

  assert.equal(
    await leadMatchesAudience(
      lead,
      { type: "status", status: "new" },
      10
    ),
    true
  );

  assert.equal(
    await leadMatchesAudience(
      lead,
      { type: "status", status: "contacted" },
      10
    ),
    false
  );
});

test("non-matching audience does not create an enrollment", async () => {
  const lead = {
    id: 1,
    email: "lead@example.com",
    status: "new",
  };

  prisma.workflow.findMany.mock.mockImplementation(() => [
    {
      id: 100,
      name: "Campaign: Status Campaign",
      orgId: 10,
      active: true,
      trigger: "SCHEDULED_TIME",
      conditions: {
        status: "running",
        audience: {
          type: "status",
          status: "contacted",
        },
      },
    },
  ]);

  const result = await enrollLeadInActiveCampaigns(
    lead,
    10,
    20
  );

  assert.deepEqual(result, {
    enrolled: 0,
    skipped: 1,
    campaignsChecked: 1,
  });

  assert.equal(prisma.sequence.findFirst.mock.calls.length, 0);
  assert.equal(prisma.sequenceEnrollment.create.mock.calls.length, 0);
});

test("matching running campaign creates an enrollment", async () => {
  const lead = {
    id: 1,
    email: "lead@example.com",
    status: "new",
  };

  prisma.workflow.findMany.mock.mockImplementation(() => [
    {
      id: 100,
      name: "Welcome Campaign",
      orgId: 10,
      active: true,
      trigger: "SCHEDULED_TIME",
      conditions: {
        status: "running",
        audience: "all",
      },
    },
  ]);

  prisma.sequence.findFirst.mock.mockImplementation(() => ({
    id: 200,
    orgId: 10,
    name: "Campaign: Welcome Campaign",
    status: "ACTIVE",
    steps: [
      {
        day: 0,
        time: "09:00",
        subject: "Welcome",
        body: "Hello {{name}}",
      },
    ],
  }));

  prisma.sequenceEnrollment.findFirst.mock.mockImplementation(() => null);
  prisma.sequenceEnrollment.create.mock.mockImplementation((args) => ({
    id: 300,
    ...args.data,
  }));

  const result = await enrollLeadInActiveCampaigns(
    lead,
    10,
    20
  );

  assert.deepEqual(result, {
    enrolled: 1,
    skipped: 0,
    campaignsChecked: 1,
  });

  assert.equal(prisma.sequenceEnrollment.create.mock.calls.length, 1);

  const createCall =
    prisma.sequenceEnrollment.create.mock.calls[0].arguments[0];

  assert.equal(createCall.data.sequenceId, 200);
  assert.equal(createCall.data.leadId, 1);
  assert.equal(createCall.data.email, "lead@example.com");
  assert.equal(createCall.data.status, "ACTIVE");
  assert.equal(createCall.data.currentStep, 0);
  assert.deepEqual(createCall.data.steps, [
    {
      day: 0,
      time: "09:00",
      subject: "Welcome",
      body: "Hello {{name}}",
    },
  ]);
  assert.ok(createCall.data.nextRunAt instanceof Date);
});

test("existing enrollment is skipped", async () => {
  const lead = {
    id: 1,
    email: "lead@example.com",
    status: "new",
  };

  prisma.workflow.findMany.mock.mockImplementation(() => [
    {
      id: 100,
      name: "Welcome Campaign",
      orgId: 10,
      active: true,
      trigger: "SCHEDULED_TIME",
      conditions: {
        status: "running",
        audience: "all",
      },
    },
  ]);

  prisma.sequence.findFirst.mock.mockImplementation(() => ({
    id: 200,
    orgId: 10,
    name: "Campaign: Welcome Campaign",
    status: "ACTIVE",
    steps: [],
  }));

  prisma.sequenceEnrollment.findFirst.mock.mockImplementation(() => ({
    id: 300,
  }));

  const result = await enrollLeadInActiveCampaigns(
    lead,
    10,
    20
  );

  assert.deepEqual(result, {
    enrolled: 0,
    skipped: 1,
    campaignsChecked: 1,
  });

  assert.equal(prisma.sequenceEnrollment.create.mock.calls.length, 0);
});
