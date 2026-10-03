const { prisma } = require("../config/postgres");

/**
 * FIN-TECH campaign auto-enrollment service.
 *
 * Purpose:
 * - Find active/running scheduled campaigns for a workspace.
 * - Check whether a newly created lead matches each campaign audience.
 * - Enroll the lead into the campaign's existing Sequence.
 *
 * This service intentionally does NOT modify:
 * - campaign activation
 * - campaign pause/resume
 * - followupJob scheduling
 * - SMTP/email delivery
 * - Prisma schema
 */

const normalizeAudience = (audience) => {
  if (!audience) return { type: "all" };

  if (typeof audience === "string") {
    return { type: audience };
  }

  if (typeof audience === "object") {
    return audience;
  }

  return { type: "all" };
};

const valuesMatch = (actual, expected) => {
  if (actual === null || actual === undefined) return false;
  if (expected === null || expected === undefined) return false;

  return String(actual).trim().toLowerCase() ===
    String(expected).trim().toLowerCase();
};

const matchesSavedSearchFilters = (lead, filters) => {
  if (!filters || typeof filters !== "object") return true;

  if (Array.isArray(filters)) {
    return filters.every((filter) =>
      matchesSavedSearchFilters(lead, filter)
    );
  }

  if (Array.isArray(filters.conditions)) {
    return filters.conditions.every((condition) =>
      matchesSavedSearchFilters(lead, condition)
    );
  }

  const field = filters.field;
  const operator = String(filters.operator || "equals").toLowerCase();
  const expected = filters.value;

  if (field) {
    const actual = lead[field];

    switch (operator) {
      case "equals":
      case "eq":
        return valuesMatch(actual, expected);

      case "not_equals":
      case "neq":
        return !valuesMatch(actual, expected);

      case "contains":
        return actual !== null &&
          actual !== undefined &&
          String(actual).toLowerCase().includes(String(expected).toLowerCase());

      case "starts_with":
        return actual !== null &&
          actual !== undefined &&
          String(actual).toLowerCase().startsWith(String(expected).toLowerCase());

      case "ends_with":
        return actual !== null &&
          actual !== undefined &&
          String(actual).toLowerCase().endsWith(String(expected).toLowerCase());

      default:
        return false;
    }
  }

  return Object.entries(filters).every(([key, value]) => {
    if (key === "conditions" || key === "operator" || key === "field" || key === "value") {
      return true;
    }

    return valuesMatch(lead[key], value);
  });
};

const leadMatchesAudience = async (lead, audience, orgId) => {
  const config = normalizeAudience(audience);
  const type = String(config.type || "all").toLowerCase();

  if (type === "all") {
    return true;
  }

  if (type === "status") {
    return valuesMatch(lead.status, config.status);
  }

  if (type === "tag") {
    const tagId = Number(config.tagId ?? config.id);

    if (!Number.isInteger(tagId) || tagId <= 0) {
      return false;
    }

    const tag = await prisma.leadTag.findFirst({
      where: {
        leadId: lead.id,
        tagId,
      },
    });

    return Boolean(tag);
  }

  if (type === "segment") {
    const segmentId = Number(
      config.segmentId ?? config.savedSearchId ?? config.id
    );

    if (!Number.isInteger(segmentId) || segmentId <= 0) {
      return false;
    }

    const savedSearch = await prisma.savedSearch.findFirst({
      where: {
        id: segmentId,
        OR: [
          { orgId },
          { orgId: null },
        ],
      },
      select: {
        filters: true,
      },
    });

    if (!savedSearch) {
      return false;
    }

    return matchesSavedSearchFilters(lead, savedSearch.filters);
  }

  return false;
};

const enrollLeadInActiveCampaigns = async (lead, orgId, userId) => {
  if (!lead || !lead.id || !lead.email || !orgId || !userId) {
    return {
      enrolled: 0,
      skipped: 0,
      campaignsChecked: 0,
    };
  }

  const campaigns = await prisma.workflow.findMany({
    where: {
      orgId,
      trigger: "SCHEDULED_TIME",
      active: true,
    },
    orderBy: {
      id: "asc",
    },
  });

  const runningCampaigns = campaigns.filter((campaign) => {
    const conditions =
      campaign.conditions &&
      typeof campaign.conditions === "object"
        ? campaign.conditions
        : {};

    return String(conditions.status || "").toLowerCase() === "running";
  });

  let enrolled = 0;
  let skipped = 0;

  for (const campaign of runningCampaigns) {
    const conditions =
      campaign.conditions &&
      typeof campaign.conditions === "object"
        ? campaign.conditions
        : {};

    const audience = conditions.audience || "all";

    const matches = await leadMatchesAudience(
      lead,
      audience,
      orgId
    );

    if (!matches) {
      skipped += 1;
      continue;
    }

    const sequence = await prisma.sequence.findFirst({
      where: {
        orgId,
        name: `Campaign: ${campaign.name}`,
        status: "ACTIVE",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!sequence) {
      skipped += 1;
      continue;
    }

    const existingEnrollment = await prisma.sequenceEnrollment.findFirst({
      where: {
        sequenceId: sequence.id,
        leadId: lead.id,
      },
      select: {
        id: true,
      },
    });

    if (existingEnrollment) {
      skipped += 1;
      continue;
    }

    try {
      await prisma.sequenceEnrollment.create({
        data: {
          sequenceId: sequence.id,
          leadId: lead.id,
          email: lead.email,
          status: "ACTIVE",
          currentStep: 0,
          steps: sequence.steps,
          nextRunAt: new Date(),
        },
      });

      enrolled += 1;
    } catch (error) {
      /*
       * FIN-TECH does not currently have TL's database-level
       * @@unique([sequenceId, leadId]) constraint.
       *
       * If another request creates the enrollment between our
       * lookup and create, leave the existing campaign state
       * untouched and continue processing other campaigns.
       */
      if (error?.code === "P2002") {
        skipped += 1;
        continue;
      }

      throw error;
    }
  }

  return {
    enrolled,
    skipped,
    campaignsChecked: runningCampaigns.length,
  };
};

module.exports = {
  enrollLeadInActiveCampaigns,
  leadMatchesAudience,
};
