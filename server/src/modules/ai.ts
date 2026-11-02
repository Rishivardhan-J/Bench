import type { FastifyInstance } from 'fastify';
import { SchemaType } from '@google/generative-ai';
import { z } from 'zod';
import { many, pool } from '../db/client.ts';
import { ApiError } from '../lib/errors.ts';
import { INJECTION_PREAMBLE, generateJson, generateText, getModel, wrapUntrusted } from '../lib/ai.ts';
import { HOUR, enforceRateLimit } from '../lib/rateLimit.ts';
import { clientIp, requireRole } from '../lib/session.ts';
import { storage } from '../lib/storage.ts';
import { contentGuard, id as idSchema, parse, text } from '../lib/validate.ts';

const STR = { type: SchemaType.STRING } as const;
const STR_ARRAY = { type: SchemaType.ARRAY, items: STR } as const;

const BASE_SKILLS = [
  'JavaScript', 'TypeScript', 'React', 'Next.js', 'Vue', 'Angular', 'Node.js', 'Python', 'Django', 'Flask', 'Java', 'Kotlin',
  'Swift', 'SwiftUI', 'Go', 'Rust', 'PHP', 'Laravel', 'Ruby', 'Rails', 'C#', '.NET', 'SQL', 'PostgreSQL', 'MySQL', 'MongoDB',
  'Firebase', 'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'GraphQL', 'REST', 'Tailwind CSS', 'HTML', 'CSS', 'Figma',
  'UI/UX', 'Prototyping', 'Design Systems', 'Illustration', 'Branding', 'After Effects', 'Cinema 4D', 'Lottie', 'Premiere Pro',
  'Video Editing', 'Copywriting', 'B2B Copywriting', 'SEO', 'Content Strategy', 'Brand Voice', 'Technical Writing',
  'Tableau', 'Power BI', 'Data Visualization', 'A/B Testing', 'Machine Learning', 'Excel', 'Product Management',
];

function heuristicResume(source: string, vocabulary: string[]) {
  const lower = source.toLowerCase();
  const skills = [...new Set(vocabulary)].filter((s) => {
    const esc = s.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z0-9])${esc}($|[^a-z0-9])`, 'i').test(lower);
  });
  const firstLine = source.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 2 && l.length < 60 && !/@|http/.test(l));
  return { name: firstLine || '', headline: '', skills: skills.slice(0, 20), experience: [], education: [] };
}

/** Reads the text of a PDF. pdf-parse 2.x exposes a PDFParse class, not a function. */
export async function pdfText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    // pdf-parse 2 adds "-- 1 of 3 --" page markers; they are not resume content.
    return (await parser.getText()).text.replaceAll('\0', '').replace(/^-- \d+ of \d+ --$/gm, '').trim().slice(0, 20000);
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

export async function aiRoutes(app: FastifyInstance) {
  const limit = async (req: import('fastify').FastifyRequest) =>
    enforceRateLimit(pool, 'ai', req.user?.id ?? clientIp(req), 30, HOUR, "You've hit the limit for now. Try again in a bit.");

  app.post('/api/ai/extract-brief', async (req) => {
    const body = parse(z.object({ brief: text(2000, 'Brief'), knownSkills: z.array(z.string().max(60)).max(200).default([]) }), req.body);
    contentGuard(body.brief);
    await limit(req);
    const json = await generateJson<Record<string, unknown>>(
      `You extract structured hiring criteria from a project brief.
${INJECTION_PREAMBLE}

Return:
- extractedSkills: specific skills required. Prefer exact names from this catalogue when they apply: ${JSON.stringify(body.knownSkills)}.
- budgetBand: "low" (under $40/hr), "mid" ($40-$90/hr) or "high" ($90+/hr). Omit if unstated.
- rateMin / rateMax: hourly numbers in USD if the brief states a range or limit. Omit if unstated.
- timeline: short phrase such as "3 months". Omit if unstated.
- seniority: "junior", "mid" or "senior". Omit if not implied.

${wrapUntrusted(body.brief)}`,
      {
        type: SchemaType.OBJECT,
        properties: {
          extractedSkills: STR_ARRAY,
          budgetBand: { type: SchemaType.STRING, format: 'enum', enum: ['low', 'mid', 'high'] },
          rateMin: { type: SchemaType.NUMBER },
          rateMax: { type: SchemaType.NUMBER },
          timeline: STR,
          seniority: { type: SchemaType.STRING, format: 'enum', enum: ['junior', 'mid', 'senior'] },
        },
        required: ['extractedSkills'],
      },
    );
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 10000 ? v : undefined);
    return {
      rawBrief: body.brief,
      extractedSkills: (Array.isArray(json.extractedSkills) ? json.extractedSkills : [])
        .filter((s): s is string => typeof s === 'string' && s.trim() !== '')
        .map((s) => s.trim().slice(0, 60))
        .slice(0, 20),
      budgetBand: ['low', 'mid', 'high'].includes(json.budgetBand as string) ? json.budgetBand : undefined,
      rateMin: num(json.rateMin),
      rateMax: num(json.rateMax),
      timeline: typeof json.timeline === 'string' ? json.timeline.slice(0, 60) : undefined,
      seniority: ['junior', 'mid', 'senior'].includes(json.seniority as string) ? json.seniority : undefined,
    };
  });

  app.post('/api/ai/match', async (req) => {
    const body = parse(z.object({ brief: text(2000, 'Brief'), freelancerIds: z.array(idSchema()).max(25) }), req.body);
    const ids = [...new Set(body.freelancerIds)];
    if (ids.length === 0) return [];
    await limit(req);

    // Candidates are read here, never taken from the caller, so nobody can smuggle text into the prompt.
    const rows = await many<{ id: string; headline: string; skills: string[]; rateMin: number; rateMax: number; availability: string; bio: string }>(
      pool,
      `SELECT user_id AS id, headline, skills, rate_min AS "rateMin", rate_max AS "rateMax", availability, left(bio, 400) AS bio
       FROM freelancer_profiles WHERE user_id = ANY($1) AND approved AND NOT paused`,
      [ids],
    );
    if (rows.length === 0) return [];
    const allowed = new Set(rows.map((r) => r.id));

    const json = await generateJson<{ freelancerId: string; matchedCriteria?: string[]; reasoning: string }[]>(
      `You help a client pick freelancers for a project.
${INJECTION_PREAMBLE}

Rank the candidates by relevance to the brief, best first. For each, give the criteria they actually match and exactly ONE concise sentence (max 28 words, no line breaks) saying why they fit, based only on the candidate data. Never invent facts.

Brief:
${wrapUntrusted(body.brief)}

Candidates (JSON data):
${wrapUntrusted(JSON.stringify(rows))}`,
      {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: { freelancerId: STR, matchedCriteria: STR_ARRAY, reasoning: STR },
          required: ['freelancerId', 'matchedCriteria', 'reasoning'],
        },
      },
    );
    return (Array.isArray(json) ? json : [])
      .filter((r) => r && allowed.has(r.freelancerId) && typeof r.reasoning === 'string')
      .map((r) => ({
        freelancerId: r.freelancerId,
        matchedCriteria: (Array.isArray(r.matchedCriteria) ? r.matchedCriteria : []).filter((c) => typeof c === 'string').slice(0, 8),
        reasoning: r.reasoning.replace(/\s+/g, ' ').trim().slice(0, 220),
      }));
  });

  app.post('/api/ai/review-summary', async (req) => {
    const { freelancerId } = parse(z.object({ freelancerId: idSchema('freelancerId') }), req.body);
    const live = await pool.query('SELECT 1 FROM freelancer_profiles WHERE user_id = $1 AND approved', [freelancerId]);
    if (live.rowCount === 0) throw new ApiError('not-found', 'Profile not found.');

    const reviews = await many<{ text: string; rating: number }>(pool, 'SELECT text, rating FROM reviews WHERE freelancer_id = $1 ORDER BY created_at DESC LIMIT 30', [freelancerId]);
    if (reviews.length === 0) return { freelancerId, summary: 'Not enough reviews yet to generate a summary.' };

    const cached = (await pool.query('SELECT summary, review_count FROM review_summaries WHERE freelancer_id = $1', [freelancerId])).rows[0];
    if (cached && cached.review_count === reviews.length) return { freelancerId, summary: cached.summary as string };

    let summary: string;
    if (getModel()) {
      await limit(req);
      summary = await generateText(`Condense these client reviews into a calm 2-3 sentence summary of the freelancer's strengths and common feedback. No bullet points. Do not invent details.
${INJECTION_PREAMBLE}

${wrapUntrusted(JSON.stringify(reviews))}`);
    } else {
      const avg = reviews.reduce((n, r) => n + r.rating, 0) / reviews.length;
      summary = `Rated ${avg.toFixed(1)} out of 5 across ${reviews.length} review${reviews.length === 1 ? '' : 's'}. Most recent feedback: "${reviews[0].text.slice(0, 160)}"`;
    }
    summary = summary.replace(/\s+/g, ' ').slice(0, 600);
    await pool.query(
      `INSERT INTO review_summaries (freelancer_id, summary, review_count) VALUES ($1, $2, $3)
       ON CONFLICT (freelancer_id) DO UPDATE SET summary = $2, review_count = $3, updated_at = now()`,
      [freelancerId, summary, reviews.length],
    );
    return { freelancerId, summary };
  });

  app.post('/api/ai/resume', async (req) => {
    const user = requireRole(req, 'freelancer');
    await limit(req);
    const buffer = await storage.get(`resumes/${user.id}/resume.pdf`);
    if (!buffer) throw new ApiError('invalid-argument', 'Upload your resume first.');

    let source: string;
    try {
      source = await pdfText(buffer);
    } catch {
      throw new ApiError('invalid-argument', "We couldn't read that PDF. Try another file.");
    }
    if (!source.trim()) throw new ApiError('invalid-argument', 'That PDF has no readable text.');

    const known = await many<{ skill: string }>(pool, `SELECT DISTINCT unnest(skills) AS skill FROM freelancer_profiles WHERE approved LIMIT 400`);
    const vocabulary = [...BASE_SKILLS, ...known.map((k) => k.skill)];
    if (!getModel()) return { suggestions: heuristicResume(source, vocabulary) };

    const json = await generateJson<{ name?: string; headline?: string; skills?: string[]; experience?: Record<string, unknown>[]; education?: Record<string, unknown>[] }>(
      `Extract profile suggestions from this resume text.
${INJECTION_PREAMBLE}

Return name, a short professional headline, up to 15 skills, experience entries (title, company, startYear, endYear if finished, one-line description) and education entries (school, degree, startYear, endYear). Only include facts present in the text.

${wrapUntrusted(source)}`,
      {
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
              required: ['title', 'company', 'startYear'],
            },
          },
          education: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: { school: STR, degree: STR, startYear: { type: SchemaType.INTEGER }, endYear: { type: SchemaType.INTEGER } },
              required: ['school', 'degree'],
            },
          },
        },
        required: ['skills'],
      },
    );
    const str = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '');
    const year = (v: unknown) => (Number.isInteger(v) && (v as number) > 1950 && (v as number) < 2100 ? (v as number) : undefined);
    return {
      suggestions: {
        name: str(json.name, 80),
        headline: str(json.headline, 120),
        skills: (json.skills ?? []).filter((s) => typeof s === 'string').map((s) => s.slice(0, 50)).slice(0, 20),
        experience: (json.experience ?? []).slice(0, 8).map((e) => ({
          title: str(e.title, 100), company: str(e.company, 100), startYear: year(e.startYear) ?? new Date().getFullYear(),
          endYear: year(e.endYear), description: str(e.description, 240),
        })),
        education: (json.education ?? []).slice(0, 5).map((e) => ({ school: str(e.school, 100), degree: str(e.degree, 100), startYear: year(e.startYear), endYear: year(e.endYear) })),
      },
    };
  });
}
