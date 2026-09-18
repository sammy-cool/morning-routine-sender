"use strict";

process.env.USE_MOCK_REDIS = "true";
process.env.NODE_ENV = "test";

jest.mock("mjml", () =>
  jest.fn((content) => ({
    html: `<!doctype html><html><body>${content}</body></html>`,
    errors: [],
  })),
);

jest.mock("../db/knex", () => {
  const queryBuilder = {
    where: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue([]),
    first: jest.fn().mockResolvedValue(null),
    insert: jest.fn().mockResolvedValue([1]),
    update: jest.fn().mockResolvedValue(1),
  };
  return jest.fn(() => queryBuilder);
});

jest.mock("../helper/util", () => {
  const actual = jest.requireActual("../helper/util");
  return {
    ...actual,
    dailyDevNews: jest.fn().mockResolvedValue({
      title: "Tech News Headline",
      description: "Summary of latest developer updates",
      url: "https://news.example.com",
    }),
  };
});

jest.mock("../helper/aiSparkGenerator", () => ({
  getDailyMorningSpark: jest.fn().mockResolvedValue({
    sparkReflection: "Master your internal focus.",
    microAction: "Define one critical task.",
    focusMantra: "Deep work wins.",
    source: "curated",
    streakTier: "Tier 1: Spark Catalyst",
  }),
}));

const {
  MERN_CURRICULUM,
  getDailyMernInsight,
  markMernInsightDelivered,
  getSeenMernInsightIds,
  resetMernProgress,
  getCurriculum,
} = require("../helper/mernKnowledgeService");
const emailService = require("../email-core/emailService");

describe("💻 MERN Stack Developer Dynamic Knowledge Service Test Suite", () => {
  const testEmail = "developer.test@example.com";

  beforeEach(async () => {
    await resetMernProgress(testEmail);
  });

  describe("1. Curriculum Data Integrity", () => {
    test("has at least 40 high-yield, production-grade lessons", () => {
      expect(MERN_CURRICULUM.length).toBeGreaterThanOrEqual(40);
      const curriculum = getCurriculum();
      expect(curriculum.length).toBe(MERN_CURRICULUM.length);
    });

    test("every lesson has unique ID and required structural fields", () => {
      const ids = new Set();
      const validCategories = [
        "MongoDB",
        "Express.js",
        "React 19",
        "Node.js Core",
        "Full-Stack Architecture",
      ];

      for (const lesson of MERN_CURRICULUM) {
        expect(lesson.id).toBeDefined();
        expect(typeof lesson.id).toBe("string");
        expect(lesson.id.length).toBeGreaterThan(3);
        expect(ids.has(lesson.id)).toBe(false);
        ids.add(lesson.id);

        expect(validCategories).toContain(lesson.category);
        expect(lesson.pillarIcon).toBeDefined();
        expect(lesson.title).toBeDefined();
        expect(lesson.mentalModel).toBeDefined();
        expect(lesson.takeaway).toBeDefined();
      }
    });
  });

  describe("2. Non-Repeating Daily Progression", () => {
    test("delivers non-repeating consecutive lessons for the same subscriber", async () => {
      const email = "consecutive.dev@example.com";
      await resetMernProgress(email);

      const deliveredIds = new Set();
      const numDays = 10;

      for (let day = 1; day <= numDays; day++) {
        const insight = await getDailyMernInsight({
          email,
          dayNumber: day,
          streakCount: day,
        });

        expect(insight).toBeDefined();
        expect(insight.id).toBeDefined();
        expect(deliveredIds.has(insight.id)).toBe(false);

        deliveredIds.add(insight.id);
        await markMernInsightDelivered(email, insight.id);
      }

      expect(deliveredIds.size).toBe(numDays);
    });

    test("supports forceId override for previews and testing", async () => {
      const insight = await getDailyMernInsight({
        email: testEmail,
        forceId: "mongo-esr-rule",
      });

      expect(insight.id).toBe("mongo-esr-rule");
      expect(insight.category).toBe("MongoDB");
      expect(insight.title).toContain("The ESR Rule");
    });
  });

  describe("3. Mastery Review Cycle Completion", () => {
    test("automatically cycles to Mastery Review when all lessons are completed", async () => {
      const email = "veteran.architect@example.com";
      await resetMernProgress(email);

      // Simulate completing all lessons except the last one
      for (let i = 0; i < MERN_CURRICULUM.length - 1; i++) {
        await markMernInsightDelivered(email, MERN_CURRICULUM[i].id);
      }

      // Fetch the last remaining lesson
      const finalLesson = await getDailyMernInsight({ email });
      expect(finalLesson.id).toBe(MERN_CURRICULUM[MERN_CURRICULUM.length - 1].id);
      expect(finalLesson.isMasteryReview).toBe(false);
      await markMernInsightDelivered(email, finalLesson.id);

      // Next fetch should trigger automatic Mastery Review reset!
      const reviewLesson = await getDailyMernInsight({ email });
      expect(reviewLesson).toBeDefined();
      expect(reviewLesson.isMasteryReview).toBe(true);
      expect(reviewLesson.sequenceNumber).toBe(1);
    });
  });

  describe("4. Email Template Integration & Plain-Text Fallback", () => {
    test("renders MERN knowledge card in email HTML and text versions", async () => {
      const mockTransporter = {
        sendMail: jest.fn().mockResolvedValue({ messageId: "<mern-msg-test@app>" }),
      };

      const result = await emailService.sendRoutineEmail(mockTransporter, "https://routine.test", {
        email: testEmail,
        routineTrack: "deep-work",
        streakCount: 7,
        forceMernInsightId: "node-event-loop-microtask",
      });

      expect(result.success).toBe(true);
      expect(result.mernInsightId).toBe("node-event-loop-microtask");
      expect(mockTransporter.sendMail).toHaveBeenCalled();

      const mailOptions = mockTransporter.sendMail.mock.calls[0][0];

      // HTML contains MERN Section
      expect(mailOptions.html).toContain("Daily MERN Stack Deep-Dive");
      expect(mailOptions.html).toContain("Event Loop Microtask Starvation");
      expect(mailOptions.html).toContain("Node.js Core");

      // Plain-text contains MERN Section
      expect(mailOptions.text).toContain("Daily MERN Stack Deep-Dive");
      expect(mailOptions.text).toContain("Event Loop Microtask Starvation");
      expect(mailOptions.text).toContain("Core Mental Model");
    });
  });
});
