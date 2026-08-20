import {
  getItem,
  putItem,
  updateItem,
  deleteItem,
  scanEntities,
  queryById,
} from "./src/lib/dynamodb.ts";
import {
  getHostelById,
  listHostels,
  getUserById,
  listBookingsByStudent,
  listVisitsByStudent,
  saveReview,
  updateReviewStatus,
} from "./src/lib/dynamodb-service.ts";
import dotenv from "dotenv";

dotenv.config();

async function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING AWS DYNAMODB SERVICE & CLIENT LAYER TESTS");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      process.stdout.write(`⏳ Testing: ${name}... `);
      await fn();
      console.log("✅ PASSED");
      passed++;
    } catch (err) {
      console.log(`❌ FAILED: ${err.message}`);
      failed++;
    }
  }

  // Test 1: Scan Hostels
  await test("listHostels() returns migrated hostels", async () => {
    const hostels = await listHostels();
    if (!Array.isArray(hostels) || hostels.length === 0) {
      throw new Error(`Expected non-empty array of hostels, got ${hostels.length}`);
    }
    console.log(`(Found ${hostels.length} hostels, first: "${hostels[0].name}")`);
  });

  // Test 2: Get specific Hostel by ID with rooms & reviews
  await test("getHostelById() returns full hostel with enriched rooms & reviews", async () => {
    const hostels = await listHostels();
    const targetId = hostels[0].id;
    const hostel = await getHostelById(targetId);
    if (!hostel || !hostel.id) {
      throw new Error(`Hostel not found for id: ${targetId}`);
    }
    console.log(`(Hostel "${hostel.name}" has ${hostel.roomTypes?.length || 0} roomTypes, rating: ${hostel.rating})`);
  });

  // Test 3: Scan and Query Users
  await test("scanEntities for STUDENT and AGENT returns users", async () => {
    const students = await scanEntities({ entityType: "STUDENT" });
    if (!Array.isArray(students)) throw new Error("Expected array of students");
    console.log(`(Found ${students.length} students in DynamoDB)`);
  });

  // Test 4: Generic Put, Get, Update, Delete cycle
  await test("Generic Put, Get, Update, Delete lifecycle", async () => {
    const testKey = "TEST_INTEGRATION_RECORD";
    const testEntity = "TEST_INTEGRATION";

    // 1. Put
    await putItem({
      id: testKey,
      entityType: testEntity,
      title: "Temporary Test Item",
      score: 100,
    });

    // 2. Get
    const item = await getItem(testKey, testEntity);
    if (!item || item.score !== 100) {
      throw new Error("Item put or get failed");
    }

    // 3. Update
    const updated = await updateItem(testKey, testEntity, { score: 200, status: "active" });
    if (!updated || updated.score !== 200 || updated.status !== "active") {
      throw new Error("Item update failed");
    }

    // 4. Delete
    await deleteItem(testKey, testEntity);
    const deleted = await getItem(testKey, testEntity);
    if (deleted !== null) {
      throw new Error("Item delete failed");
    }
  });

  console.log("\n=================================================");
  console.log(`📊 TEST RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log("=================================================\n");
}

runTests().catch((err) => {
  console.error("Test runner error:", err);
});
