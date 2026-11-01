// Bench Cloud Functions. Each domain lives in src/ and is re-exported here.
const accounts = require("./src/accounts");
const ai = require("./src/ai-callables");
const connections = require("./src/connections");
const hires = require("./src/hires");
const moderation = require("./src/moderation");
const triggers = require("./src/triggers");

exports.initAccount = accounts.initAccount;
exports.deleteAccount = accounts.deleteAccount;

exports.extractBrief = ai.extractBrief;
exports.generateMatchReasoning = ai.generateMatchReasoning;
exports.summarizeReviews = ai.summarizeReviews;
exports.parseResume = ai.parseResume;

exports.sendConnectRequest = connections.sendConnectRequest;
exports.respondToConnection = connections.respondToConnection;
exports.blockUser = connections.blockUser;
exports.openProposalThread = connections.openProposalThread;

exports.markHire = hires.markHire;
exports.createReview = hires.createReview;
exports.replyToReview = hires.replyToReview;

exports.reviewProfile = moderation.reviewProfile;
exports.setVerified = moderation.setVerified;
exports.resolveReport = moderation.resolveReport;
exports.lookupUser = moderation.lookupUser;
exports.trackProfileView = moderation.trackProfileView;

exports.onMessageCreated = triggers.onMessageCreated;
exports.onReviewWritten = triggers.onReviewWritten;
exports.onProfileWritten = triggers.onProfileWritten;
exports.onProjectCreated = triggers.onProjectCreated;
exports.onProposalCreated = triggers.onProposalCreated;
exports.onShortlistWritten = triggers.onShortlistWritten;
