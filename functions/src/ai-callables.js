const { onCall } = require("firebase-functions/v2/https");
const { SchemaType } = require("@google/generative-ai");
const {
  admin,
  db,
  HttpsError,
  callableOpts,
  clientIp,
  requireAuth,
  enforceRateLimit,
  cleanText,
  contentGuard,
  HOUR,
} = require("./common");
const { getModel, generateJson, generateText, wrapUntrusted, INJECTION_PREAMBLE } = require("./ai");

// Shared per-person budget for all AI features (T4/AI cost and abuse).
async function aiLimit(request) {
  const who = request.auth?.uid || clientIp(request);
  await enforceRateLimit("ai", who, 30, HOUR, "You've hit the limit for now. Try again in a bit.");
}

const STR = { type: SchemaType.STRING };
const STR_ARRAY = { type: SchemaType.ARRAY, items: STR };

exports.extractBrief = onCall(callableOpts, async (request) => {
  const brief = cleanText(request.data?.brief, 2000, "Brief");
  contentGuard(brief);
  await aiLimit(request);

  const known = Array.isArray(request.data?.knownSkills)
    ? request.data.knownSkills.filter((s) => typeof s === "string").slice(0, 200).map((s) => s.slice(0, 60))
    : [];

  const prompt = `You extract structured hiring criteria from a project brief.
${INJECTION_PREAMBLE}

Return:
- extractedSkills: specific skills required. Prefer exact names from this catalogue when they apply: ${JSON.stringify(known)}.
- budgetBand: "low" (under $40/hr), "mid" ($40-$90/hr) or "high" ($90+/hr). Omit if unstated.
- rateMin / rateMax: hourly numbers in USD if the brief states a range or limit. Omit if unstated.
- timeline: short phrase such as "3 months". Omit if unstated.
- seniority: "junior", "mid" or "senior". Omit if not implied.

${wrapUntrusted(brief)}`;

  const json = await generateJson(prompt, {
    type: SchemaType.OBJECT,
    properties: {
      extractedSkills: STR_ARRAY,
      budgetBand: { type: SchemaType.STRING, enum: ["low", "mid", "high"] },
      rateMin: { type: SchemaType.NUMBER },
      rateMax: { type: SchemaType.NUMBER },
      timeline: STR,
      seniority: { type: SchemaType.STRING, enum: ["junior", "mid", "senior"] },
    },
    required: ["extractedSkills"],
  });

  const num = (v) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 10000 ? v : undefined);
  return {
    rawBrief: brief,
    extractedSkills: (Array.isArray(json.extractedSkills) ? json.extractedSkills : [])
      .filter((s) => typeof s === "string" && s.trim())
      .map((s) => s.trim().slice(0, 60))
      .slice(0, 20),
    budgetBand: ["low", "mid", "high"].includes(json.budgetBand) ? json.budgetBand : undefined,
    rateMin: num(json.rateMin),
    rateMax: num(json.rateMax),
    timeline: typeof json.timeline === "string" ? json.timeline.slice(0, 60) : undefined,
    seniority: ["junior", "mid", "senior"].includes(json.seniority) ? json.seniority : undefined,
  };
});

exports.generateMatchReasoning = onCall(callableOpts, async (request) => {
  const brief = cleanText(request.data?.brief, 2000, "Brief");
  const ids = Array.isArray(request.data?.freelancerIds)
    ? [...new Set(request.data.freelancerIds.filter((s) => typeof s === "string"))].slice(0, 25)
    : null;
  if (!ids) throw new HttpsError("invalid-argument", "freelancerIds is required.");
  if (ids.length === 0) return [];
  await aiLimit(request);

  // Candidates are read server-side, so callers cannot smuggle text into the prompt through the payload.
  const snaps = await Promise.all(ids.map((id) => db.doc(`freelancerProfiles/${id}`).get()));
  const candidates = snaps
    .filter((s) => s.exists && s.data().approved === true && s.data().paused !== true)
    .map((s) => {
      const d = s.data();
      return {
        id: s.id,
        headline: d.headline,
        skills: d.skills,
        rateMin: d.rateMin,
        rateMax: d.rateMax,
        availability: d.availability,
        bio: String(d.bio || "").slice(0, 400),
      };
    });
  if (candidates.length === 0) return [];
  const allowed = new Set(candidates.map((c) => c.id));

  const prompt = `You help a client pick freelancers for a project.
${INJECTION_PREAMBLE}

Rank the candidates by relevance to the brief, best first. For each, give the criteria they actually match and exactly ONE concise sentence (max 28 words, no line breaks) saying why they fit, based only on the candidate data. Never invent facts.

Brief:
${wrapUntrusted(brief)}

Candidates (JSON data):
${wrapUntrusted(JSON.stringify(candidates))}`;

  const json = await generateJson(prompt, {
    type: SchemaType.ARRAY,
    items: {
      type: SchemaType.OBJECT,
      properties: { freelancerId: STR, matchedCriteria: STR_ARRAY, reasoning: STR },
      required: ["freelancerId", "matchedCriteria", "reasoning"],
    },
  });

  return (Array.isArray(json) ? json : [])
    .filter((r) => r && allowed.has(r.freelancerId) && typeof r.reasoning === "string")
    .map((r) => ({
      freelancerId: r.freelancerId,
      matchedCriteria: (Array.isArray(r.matchedCriteria) ? r.matchedCriteria : []).filter((c) => typeof c === "string").slice(0, 8),
      reasoning: r.reasoning.replace(/\s+/g, " ").trim().slice(0, 220),
    }));
});

exports.summarizeReviews = onCall(callableOpts, async (request) => {
  const freelancerId = cleanText(request.data?.freelancerId, 128, "freelancerId");
  const profile = await db.doc(`freelancerProfiles/${freelancerId}`).get();
  if (!profile.exists || profile.data().approved !== true) throw new HttpsError("not-found", "Profile not found.");

  // Reviews come from Firestore, never from the caller.
  const snap = await db.collection("reviews").where("freelancerUid", "==", freelancerId).orderBy("createdAt", "desc").limit(30).get();
  const reviews = snap.docs.map((d) => ({ text: d.data().text, rating: d.data().rating }));
  if (reviews.length === 0) return { freelancerId, summary: "Not enough reviews yet to generate a summary." };

  const cacheRef = db.doc(`reviewSummaries/${freelancerId}`);
  const cached = await cacheRef.get();
  if (cached.exists && cached.data().reviewCount === reviews.length) return { freelancerId, summary: cached.data().summary };

  let summary;
  if (getModel()) {
    await aiLimit(request);
    summary = await generateText(`Condense these client reviews into a calm 2-3 sentence summary of the freelancer's strengths and common feedback. No bullet points. Do not invent details.
${INJECTION_PREAMBLE}

${wrapUntrusted(JSON.stringify(reviews))}`);
  } else {
    const avg = reviews.reduce((n, r) => n + r.rating, 0) / reviews.length;
    summary = `Rated ${avg.toFixed(1)} out of 5 across ${reviews.length} review${reviews.length === 1 ? "" : "s"}. Most recent feedback: "${String(reviews[0].text).slice(0, 160)}"`;
  }
  summary = summary.replace(/\s+/g, " ").slice(0, 600);
  await cacheRef.set({ summary, reviewCount: reviews.length, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  return { freelancerId, summary };
});

const BASE_SKILLS = [
  "JavaScript", "TypeScript", "React", "Next.js", "Vue", "Angular", "Node.js", "Python", "Django", "Flask", "Java", "Kotlin",
  "Swift", "SwiftUI", "Go", "Rust", "PHP", "Laravel", "Ruby", "Rails", "C#", ".NET", "SQL", "PostgreSQL", "MySQL", "MongoDB",
  "Firebase", "AWS", "GCP", "Azure", "Docker", "Kubernetes", "GraphQL", "REST", "Tailwind CSS", "HTML", "CSS", "Figma",
  "UI/UX", "Prototyping", "Design Systems", "Illustration", "Branding", "After Effects", "Cinema 4D", "Lottie", "Premiere Pro",
  "Video Editing", "Copywriting", "B2B Copywriting", "SEO", "Content Strategy", "Brand Voice", "Technical Writing", "Python",
  "Tableau", "Power BI", "Data Visualization", "A/B Testing", "Machine Learning", "Excel", "Product Management",
];

function heuristicResume(text, vocabulary) {
  const lower = text.toLowerCase();
  const skills = [...new Set(vocabulary)].filter((s) => {
    const esc = s.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${esc}($|[^a-z0-9])`, "i").test(lower);
  });
  const firstLine = text.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 2 && l.length < 60 && !/@|http/.test(l));
  return { name: firstLine || "", headline: "", skills: skills.slice(0, 20), experience: [], education: [] };
}

exports.parseResume = onCall({ ...callableOpts, memory: "512MiB", timeoutSeconds: 60 }, async (request) => {
  const uid = requireAuth(request);
  const path = cleanText(request.data?.path, 300, "path");
  if (!path.startsWith(`resumes/${uid}/`) || path.includes("..")) throw new HttpsError("permission-denied", "Not your file.");
  await aiLimit(request);

  let text;
  try {
    const [buffer] = await admin.storage().bucket().file(path).download();
    const pdf = require("pdf-parse");
    text = (await pdf(buffer)).text.replace(/\u0000/g, "").slice(0, 20000);
  } catch (error) {
    throw new HttpsError("invalid-argument", "We couldn't read that PDF. Try another file.");
  }
  if (!text.trim()) throw new HttpsError("invalid-argument", "That PDF has no readable text.");

  const catalogue = await db.collection("freelancerProfiles").where("approved", "==", true).limit(200).get();
  const vocabulary = [...BASE_SKILLS, ...catalogue.docs.flatMap((d) => d.data().skills || [])];

  if (!getModel()) return { suggestions: heuristicResume(text, vocabulary) };

  const prompt = `Extract profile suggestions from this resume text.
${INJECTION_PREAMBLE}

Return name, a short professional headline, up to 15 skills, experience entries (title, company, startYear, endYear if finished, one-line description) and education entries (school, degree, startYear, endYear). Only include facts present in the text.

${wrapUntrusted(text)}`;

  const json = await generateJson(prompt, {
    type: SchemaType.OBJECT,
    properties: {
      name: STR,
      headline: STR,
      skills: STR_ARRAY,
      experience: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: { title: STR, company: STR, startYear: { type: SchemaType.INTEGER }, endYear: { type: SchemaType.INTEGER }, description: STR },
          required: ["title", "company", "startYear"],
        },
      },
      education: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: { school: STR, degree: STR, startYear: { type: SchemaType.INTEGER }, endYear: { type: SchemaType.INTEGER } },
          required: ["school", "degree"],
        },
      },
    },
    required: ["skills"],
  });

  const str = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");
  const year = (v) => (Number.isInteger(v) && v > 1950 && v < 2100 ? v : undefined);
  return {
    suggestions: {
      name: str(json.name, 80),
      headline: str(json.headline, 120),
      skills: (json.skills || []).filter((s) => typeof s === "string").map((s) => s.slice(0, 50)).slice(0, 20),
      experience: (json.experience || []).slice(0, 8).map((e) => ({
        title: str(e.title, 100),
        company: str(e.company, 100),
        startYear: year(e.startYear) || new Date().getFullYear(),
        endYear: year(e.endYear),
        description: str(e.description, 240),
      })),
      education: (json.education || []).slice(0, 5).map((e) => ({
        school: str(e.school, 100),
        degree: str(e.degree, 100),
        startYear: year(e.startYear),
        endYear: year(e.endYear),
      })),
    },
  };
});
