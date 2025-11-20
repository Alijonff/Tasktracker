import { calculateAuctionPrice, calculateOverduePenaltyHours } from "../server/businessRules";
import { diffWorkingHours, getTashkentTime } from "../shared/utils";
import { Task } from "../shared/schema";

// Mock Task
const mockTask = (overrides: Partial<Task> = {}): Task => ({
    id: "1",
    title: "Test Task",
    description: "Test",
    status: "BACKLOG",
    type: "UNIT",
    priority: "medium",
    grade: "B",
    auctionMode: "MONEY",
    basePrice: "100",
    baseTimeMinutes: 60,
    auctionStartAt: new Date(),
    auctionPlannedEndAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
} as Task);

function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ FAIL: ${message}`);
        process.exit(1);
    } else {
        console.log(`✅ PASS: ${message}`);
    }
}

console.log("Starting Business Logic V2 Tests...");

// 1. Test Tashkent Time
const date = new Date("2023-10-27T12:00:00Z"); // 17:00 Tashkent
const tashkentDate = getTashkentTime(date);
assert(tashkentDate.getUTCHours() === 17, "getTashkentTime should return correct hour (UTC+5)");

// 2. Test Working Hours (09:00 - 18:00)
// Friday 17:00 to Friday 18:00 = 1 hour
const start = new Date("2023-10-27T12:00:00Z"); // Fri 17:00 Tashkent
const end = new Date("2023-10-27T13:00:00Z");   // Fri 18:00 Tashkent
const diff = diffWorkingHours(start, end);
assert(Math.abs(diff - 1) < 0.01, `diffWorkingHours 17-18 should be 1, got ${diff}`);

// Friday 18:00 to Monday 09:00 = 0 hours
const startWeekend = new Date("2023-10-27T13:00:00Z"); // Fri 18:00
const endWeekend = new Date("2023-10-30T04:00:00Z");   // Mon 09:00
const diffWeekend = diffWorkingHours(startWeekend, endWeekend);
assert(diffWeekend === 0, `diffWorkingHours over weekend should be 0, got ${diffWeekend}`);

// 3. Test Auction Price Growth
// Checkpoints: 0, 3, 6, 9, 12, 15, 18, 21
// Growth starts after 2nd checkpoint.

// Case: Start at 10:00, End at 20:00 (Same day)
// Checkpoints passed: 12:00, 15:00, 18:00. Total 3 checkpoints.
// Passed checkpoints at 16:00 (current time): 12:00, 15:00. (2 checkpoints).
// Increases = max(0, 2 - 1) = 1.
// Total checkpoints = 3.
// Fraction = 1 / (3 - 1) = 0.5.
// Multiplier = 1 + 0.5 * 0.5 = 1.25.
// Base 100 -> 125.

const auctionStart = new Date("2023-10-27T05:00:00Z"); // 10:00 Tashkent
const auctionEnd = new Date("2023-10-27T15:00:00Z");   // 20:00 Tashkent
const now = new Date("2023-10-27T11:00:00Z");          // 16:00 Tashkent

const task = mockTask({
    auctionStartAt: auctionStart,
    auctionPlannedEndAt: auctionEnd,
    basePrice: "100"
});

const price = calculateAuctionPrice(task, now, "MONEY");
// Expected: 125
assert(price === 125, `Auction price should be 125, got ${price}`);

// Case: Before 2nd checkpoint
// Now 11:00 (1 checkpoint passed: none? No, 12 is first).
// Wait, 10:00 start. Checkpoints: 12, 15, 18.
// If now is 11:00 (06:00 UTC), 0 checkpoints passed.
// Increases = 0. Price = 100.
const nowEarly = new Date("2023-10-27T06:00:00Z"); // 11:00 Tashkent
const priceEarly = calculateAuctionPrice(task, nowEarly, "MONEY");
assert(priceEarly === 100, `Auction price early should be 100, got ${priceEarly}`);

// Case: After 1st checkpoint (13:00 Tashkent, 08:00 UTC)
// Passed: 12. (1 checkpoint).
// Increases = 1 - 1 = 0. Price = 100.
const nowMid = new Date("2023-10-27T08:00:00Z"); // 13:00 Tashkent
const priceMid = calculateAuctionPrice(task, nowMid, "MONEY");
assert(priceMid === 100, `Auction price after 1 checkpoint should be 100, got ${priceMid}`);

console.log("All tests passed!");
