import type { Freelancer } from '@/types';

export const demoFreelancers: Freelancer[] = [
  {
    id: 'f1',
    name: 'Alex Rivera',
    role: 'Product Designer',
    verified: true,
    skills: ['Figma', 'UI/UX', 'Prototyping', 'Design Systems'],
    rateMin: 80,
    rateMax: 120,
    currency: 'USD',
    rating: 4.9,
    reviewCount: 42,
    responseTimeMinutes: 15,
    availability: 'now',
    bio: 'Senior product designer with 8 years of experience building B2B SaaS applications. I focus on clean aesthetics and intuitive user flows.',
    timezone: 'America/New_York',
    reviews: [
      { text: 'Alex completely transformed our onboarding flow. Highly recommended.', rating: 5 },
      { text: 'Fast, communicative, and delivered top-tier designs.', rating: 5 }
    ]
  },
  {
    id: 'f2',
    name: 'Samira Jones',
    role: 'Full-Stack Engineer',
    verified: true,
    skills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'AWS'],
    rateMin: 100,
    rateMax: 150,
    currency: 'USD',
    rating: 4.8,
    reviewCount: 28,
    responseTimeMinutes: 60,
    availability: 'this_week',
    bio: 'Full-stack developer specializing in scalable web applications. I love turning complex problems into elegant, maintainable code.',
    timezone: 'Europe/London',
    reviews: [
      { text: 'Samira is a powerhouse. She delivered our MVP ahead of schedule.', rating: 5 },
      { text: 'Great code quality and very easy to work with.', rating: 4.5 }
    ]
  },
  {
    id: 'f3',
    name: 'Chen Wei',
    role: 'Motion Designer',
    verified: false,
    skills: ['After Effects', 'Cinema 4D', 'Lottie', 'Illustration'],
    rateMin: 60,
    rateMax: 90,
    currency: 'USD',
    rating: 4.6,
    reviewCount: 15,
    responseTimeMinutes: 120,
    availability: 'busy',
    bio: 'Creative motion designer bringing static interfaces to life. Experienced in creating micro-interactions and explainer videos.',
    timezone: 'Asia/Singapore',
    reviews: [
      { text: 'The animations Chen created made our app feel so much more premium.', rating: 5 }
    ]
  },
  {
    id: 'f4',
    name: 'Elena Rostova',
    role: 'Copywriter',
    verified: true,
    skills: ['B2B Copywriting', 'SEO', 'Brand Voice', 'Content Strategy'],
    rateMin: 50,
    rateMax: 80,
    currency: 'USD',
    rating: 4.7,
    reviewCount: 35,
    responseTimeMinutes: 30,
    availability: 'now',
    bio: 'Strategic copywriter helping tech companies communicate complex ideas simply. I write words that convert.',
    timezone: 'Europe/Berlin',
    reviews: [
      { text: 'Elena nailed our brand voice on the first try.', rating: 5 },
      { text: 'Clear, compelling copy that drove immediate results.', rating: 4.5 }
    ]
  },
  {
    id: 'f5',
    name: 'Marcus Thorne',
    role: 'Data Analyst',
    verified: true,
    skills: ['SQL', 'Python', 'Tableau', 'Data Visualization', 'A/B Testing'],
    rateMin: 70,
    rateMax: 110,
    currency: 'USD',
    rating: 4.9,
    reviewCount: 50,
    responseTimeMinutes: 45,
    availability: 'offline',
    bio: 'Data analyst turning raw data into actionable insights. I help teams make data-driven decisions with confidence.',
    timezone: 'America/Los_Angeles',
    reviews: [
      { text: 'Marcus helped us uncover insights that completely changed our product roadmap.', rating: 5 },
      { text: 'Incredibly thorough and analytical.', rating: 5 }
    ]
  }
];
