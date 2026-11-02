// Domain types. Field names follow the PRD data model (section 9).

export type Role = 'client' | 'freelancer' | 'admin';

export type Availability = 'now' | 'this_week' | 'busy' | 'offline';

export type ReviewStatus = 'draft' | 'pending' | 'changes_requested' | 'approved';

export interface ExperienceEntry {
  title: string;
  company: string;
  startYear: number;
  endYear?: number;
  description?: string;
}

export interface EducationEntry {
  school: string;
  degree: string;
  startYear?: number;
  endYear?: number;
}

export interface PortfolioItem {
  title: string;
  link: string;
  description?: string;
  imageUrl?: string;
}

export interface Review {
  id: string;
  hireId: string;
  clientUid: string;
  freelancerUid: string;
  rating: number;
  text: string;
  reply?: string;
  createdAt?: number;
}

export interface Freelancer {
  id: string;
  name: string;
  headline: string;
  avatarUrl?: string;
  verified: boolean;
  skills: string[];
  rateMin: number;
  rateMax: number;
  currency: string;
  ratingAvg?: number;
  reviewCount?: number;
  avgResponseMinutes?: number;
  availability: Availability;
  backOn?: string | null;
  bio: string;
  portfolioUrl?: string;
  timezone: string;
  languages: string[];
  experience: ExperienceEntry[];
  education: EducationEntry[];
  portfolio: PortfolioItem[];
  completeness?: number;
  paused?: boolean;
  approved?: boolean;
  reviewStatus?: ReviewStatus;
  reviewNote?: string;
  /** Used by demo data only; live data reads reviews from the reviews collection. */
  reviews?: { text: string; rating: number }[];
}

export interface SearchParams {
  query?: string;
  skills?: string[];
  rateMin?: number;
  rateMax?: number;
  availability?: Availability[];
  minRating?: number;
  languages?: string[];
  /** Minimum hours of working-day overlap with this IANA timezone. */
  overlapTimezone?: string;
}

export interface BriefExtraction {
  rawBrief: string;
  extractedSkills: string[];
  budgetBand?: 'low' | 'mid' | 'high';
  rateMin?: number;
  rateMax?: number;
  timeline?: string;
  seniority?: 'junior' | 'mid' | 'senior';
}

export interface MatchLine {
  freelancerId: string;
  matchedCriteria: string[];
  reasoning: string;
}

export interface ReviewSummary {
  freelancerId: string;
  summary: string;
}

export interface ShortlistEntry {
  freelancerId: string;
  note: string;
  addedAt?: number;
}

export interface ShortlistList {
  id: string;
  name: string;
  items: ShortlistEntry[];
  /** Token of the active read-only link, if the list is shared. */
  shareToken?: string;
  createdAt?: number;
}

export type ConnectionStatus = 'pending' | 'accepted' | 'declined' | 'blocked' | 'expired';

export type DeclineReason = 'booked' | 'budget' | 'skills' | 'other';

export interface Connection {
  id: string;
  clientUid: string;
  freelancerUid: string;
  clientName?: string;
  freelancerName?: string;
  projectId?: string;
  projectTitle?: string;
  briefText?: string;
  firstMessage: string;
  status: ConnectionStatus;
  threadId?: string;
  declineReason?: DeclineReason;
  referredFreelancerId?: string;
  referredName?: string;
  createdAt?: number;
}

export interface Thread {
  id: string;
  participants: string[];
  names: Record<string, string>;
  connectionId: string;
  lastMessageAt?: number;
  lastMessage?: string;
  unread: Record<string, number>;
  lastRead: Record<string, number>;
  closed?: boolean;
  hireId?: string;
}

export interface Attachment {
  name: string;
  path: string;
  url: string;
  type: string;
  size: number;
}

export interface Message {
  id: string;
  senderUid: string;
  text: string;
  attachments: Attachment[];
  createdAt?: number;
  pending?: boolean;
  failed?: boolean;
}

export interface Hire {
  id: string;
  clientUid: string;
  freelancerUid: string;
  projectId?: string;
  markedAt?: number;
}

export type NotificationType =
  | 'new_request'
  | 'request_accepted'
  | 'request_declined'
  | 'request_expired'
  | 'new_message'
  | 'proposal_received'
  | 'profile_status'
  | 'new_review'
  | 'project_match'
  | 'search_alert';

export interface AppNotification {
  id: string;
  type: NotificationType;
  refId?: string;
  title: string;
  body: string;
  link: string;
  read: boolean;
  createdAt?: number;
}

export type NotificationPrefs = Record<
  'new_request' | 'request_accepted' | 'new_message' | 'proposal_received',
  { inApp: boolean; email: boolean }
>;

export interface Project {
  id: string;
  clientUid: string;
  clientName?: string;
  title: string;
  description: string;
  skills: string[];
  budgetMin: number;
  budgetMax: number;
  timeline: string;
  status: 'open' | 'closed';
  createdAt?: number;
}

export type ProposalStatus = 'sent' | 'shortlisted' | 'declined' | 'chosen';

export interface Proposal {
  id: string;
  projectId: string;
  projectTitle?: string;
  clientUid: string;
  freelancerUid: string;
  freelancerName?: string;
  message: string;
  rate: number;
  status: ProposalStatus;
  threadId?: string;
  createdAt?: number;
}

export interface SavedSearch {
  id: string;
  clientUid: string;
  label: string;
  query: string;
  filters: SearchParams;
  alertEnabled: boolean;
}

export interface Report {
  id: string;
  reporterUid: string;
  targetType: 'profile' | 'message';
  targetId: string;
  reason: string;
  status: 'open' | 'resolved';
  createdAt?: number;
}

export interface DayStat {
  day: string;
  views: number;
  shortlistAdds: number;
  requests: number;
}
