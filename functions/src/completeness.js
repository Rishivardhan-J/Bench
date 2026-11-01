// Profile completeness (F6). Keep in sync with src/lib/completeness.ts (a parity test covers both).
const CHECKS = [
  { id: "avatar", label: "Add a profile picture", weight: 10, done: (p) => Boolean(p.avatarUrl) },
  { id: "name", label: "Add your name", weight: 5, done: (p) => Boolean(p.name && p.name.trim()) },
  { id: "headline", label: "Write a headline", weight: 10, done: (p) => Boolean(p.headline && p.headline.trim().length >= 5) },
  { id: "bio", label: "Write a bio of at least 80 characters", weight: 15, done: (p) => Boolean(p.bio && p.bio.trim().length >= 80) },
  { id: "skills", label: "List at least 3 skills", weight: 15, done: (p) => Array.isArray(p.skills) && p.skills.length >= 3 },
  { id: "rate", label: "Set your hourly rate", weight: 10, done: (p) => Number(p.rateMin) > 0 && Number(p.rateMax) >= Number(p.rateMin) },
  { id: "timezone", label: "Set your timezone", weight: 5, done: (p) => Boolean(p.timezone) },
  { id: "portfolio", label: "Add a portfolio link or item", weight: 10, done: (p) => Boolean(p.portfolioUrl) || (Array.isArray(p.portfolio) && p.portfolio.length > 0) },
  { id: "experience", label: "Add your experience", weight: 10, done: (p) => Array.isArray(p.experience) && p.experience.length > 0 },
  { id: "languages", label: "Add the languages you speak", weight: 5, done: (p) => Array.isArray(p.languages) && p.languages.length > 0 },
  { id: "education", label: "Add your education", weight: 5, done: (p) => Array.isArray(p.education) && p.education.length > 0 },
];

function computeCompleteness(profile) {
  return CHECKS.reduce((sum, c) => sum + (c.done(profile) ? c.weight : 0), 0);
}

module.exports = { CHECKS, computeCompleteness };
