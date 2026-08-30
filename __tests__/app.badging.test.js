const AppBadging = require("../public/js/app-badging");

describe("PWA App Badging API Client Utility", () => {
  beforeEach(() => {
    // Reset navigator mocks
    global.navigator = {};
  });

  test("isSupported returns false if navigator methods are not defined", () => {
    expect(AppBadging.isSupported()).toBe(false);
  });

  test("isSupported returns true when setAppBadge and clearAppBadge exist", () => {
    global.navigator.setAppBadge = jest.fn();
    global.navigator.clearAppBadge = jest.fn();

    expect(AppBadging.isSupported()).toBe(true);
  });

  test("setAppBadge calls navigator.setAppBadge with numeric count", async () => {
    global.navigator.setAppBadge = jest.fn().mockResolvedValue(true);
    global.navigator.clearAppBadge = jest.fn().mockResolvedValue(true);

    const result = await AppBadging.setAppBadge(7);
    expect(result).toBe(true);
    expect(global.navigator.setAppBadge).toHaveBeenCalledWith(7);
  });

  test("setAppBadge automatically calls clearAppBadge when count is 0", async () => {
    global.navigator.setAppBadge = jest.fn().mockResolvedValue(true);
    global.navigator.clearAppBadge = jest.fn().mockResolvedValue(true);

    const result = await AppBadging.setAppBadge(0);
    expect(result).toBe(true);
    expect(global.navigator.clearAppBadge).toHaveBeenCalled();
  });

  test("syncFromSubscriber sets badge according to subscriber streakCount", async () => {
    global.navigator.setAppBadge = jest.fn().mockResolvedValue(true);
    global.navigator.clearAppBadge = jest.fn().mockResolvedValue(true);

    await AppBadging.syncFromSubscriber({ email: "test@example.com", streakCount: 14 });
    expect(global.navigator.setAppBadge).toHaveBeenCalledWith(14);

    await AppBadging.syncFromSubscriber(null);
    expect(global.navigator.clearAppBadge).toHaveBeenCalled();
  });
});
