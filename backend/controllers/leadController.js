const { prisma } = require("../config/postgres");
const { dispatchNotification } = require("../services/notificationService");
const { updateLeadScore } = require("../services/leadScoringService");
const { recordActivity, diffLead, summarizeChanges } = require("../services/leadActivityService");
const asyncHandler = require("../utils/asyncHandler");
const response = require("../utils/response");
const { AppError } = require("../middleware/errorHandler");
const { recordAudit } = require("../services/auditService");
const { incrementUsage, enforcePlanLimit } = require("../services/usageService");
const { publish } = require("../services/webhookService");
const { enrollLeadInActiveCampaigns } = require("../services/campaignAutomationService");

const LEAD_INCLUDE = {
  addedBy: { select: { id: true, name: true, email: true } },
  assignedTo: { select: { id: true, name: true, email: true } },
  tags: { include: { tag: true } },
  _count: { select: { notes: true, tasks: true, activities: true } },
};

const buildLeadWhere = ({ search, status, source, tagId, assigneeId, scoreMin, scoreMax }) => {
  const where = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { domain: { contains: search, mode: "insensitive" } },
      { companyName: { contains: search, mode: "insensitive" } },
      { jobTitle: { contains: search, mode: "insensitive" } },
    ];
  }
  if (status) where.status = status;
  if (source) where.source = source;
  if (assigneeId) where.assignedToId = Number(assigneeId);
  if (tagId) where.tags = { some: { tagId: Number(tagId) } };
  if (scoreMin !== undefined || scoreMax !== undefined) {
    where.score = {};
    if (scoreMin !== undefined) where.score.gte = Number(scoreMin);
    if (scoreMax !== undefined) where.score.lte = Number(scoreMax);
  }
  return where;
};

const mapCreateInput = (body) => ({
  name: body.name.trim(),
  email: body.email.toLowerCase(),
  phone: body.phone || null,
  domain: body.domain?.trim().toLowerCase() || null,
  status: body.status || "new",
  source: body.source || "other",
  engagement: body.engagement,
  jobTitle: body.jobTitle || null,
  managementLevel: body.managementLevel || null,
  department: body.department || null,
  location: body.location || null,
  industry: body.industry || null,
  skills: body.skills || null,
  companyLocation: body.companyLocation || null,
  companySize: body.companySize || null,
  revenue: body.revenue || null,
  companyName: body.companyName || null,
});

const mapUpdateInput = (body) => {
  const out = {};
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined) continue;
    if (key === "name") out.name = String(value).trim();
    else if (key === "email") out.email = String(value).toLowerCase();
    else if (["phone", "domain"].includes(key)) out[key] = value ? String(value).trim().toLowerCase() : null;
    else if (key === "assignedToId") out.assignedToId = value ? Number(value) : null;
    else out[key] = value;
  }
  return out;
};

const createLead = asyncHandler(async (req, res) => {
  const email = req.body.email.toLowerCase();
  const existingLead = await prisma.lead.findUnique({ where: { email } });
  if (existingLead) {
    if (existingLead.orgId === req.orgId) {
      return response.success(res, existingLead);
    } else {
      throw new AppError("A lead with this email already exists in another workspace.", 400);
    }
  }

  const lead = await prisma.lead.create({
    data: {
      ...mapCreateInput(req.body),
      orgId: req.orgId,
      addedById: req.user.id,
    },
    include: LEAD_INCLUDE,
  });
  // await updateLeadScore(lead.id);
  const updated = await prisma.lead.findUnique({ where: { id: lead.id }, include: LEAD_INCLUDE });

  // Automatically enroll a newly created lead into matching running campaigns.
  // Enrollment is intentionally non-blocking so campaign automation failures
  // cannot prevent successful lead creation.
  enrollLeadInActiveCampaigns(updated, req.orgId, req.user.id).catch((error) => {
    console.error("Failed to auto-enroll lead into campaigns:", error);
  });
  
  // ---------------------------------------------------------------------------
  // NOTIFICATION: Always notify the AUTHENTICATED USER who triggered this event.
  // userId must come from req.user.id (verified JWT session) — never from
  // req.body.userId or any client-supplied field. The user's own preference
  // toggles determine whether they receive in-app, email, or push notifications.
  // ---------------------------------------------------------------------------
  dispatchNotification({
    userId: req.user.id,
    orgId: req.orgId,
    type: "LEAD_CREATED",
    category: "lead",
    message: `Lead ${lead.name} added to your pipeline.`,
    link: `/app/leads/${lead.id}`,
    metadata: { leadId: lead.id, leadName: lead.name },
  }).catch(console.error);
  // TODO: Add similar dispatchNotification calls for:
  //   - BILLING category: in billingController after payment/invoice events
  //   - TEAM category:    in teamController after invite/join/role-change events
  //   - SYSTEM category:  in adminController for system-wide alerts