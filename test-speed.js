import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import dotenv from "dotenv";

dotenv.config();

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "eu-north-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || "HostelManagement";

async function runSpeedBenchmark() {
  console.log("=================================================");
  console.log("⚡ AWS DYNAMODB LATENCY & SPEED BENCHMARK");
  console.log(`🎯 Table: ${TABLE_NAME} (Region: ${process.env.AWS_REGION})`);
  console.log("=================================================\n");

  // Step 1: Discover a valid hostel from the table
  console.log("🔍 Finding a sample hostel from DynamoDB...");
  const scanStart = performance.now();
  const scanResponse = await docClient.send(
    new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: "#entityType = :entityType",
      ExpressionAttributeNames: { "#entityType": "entityType" },
      ExpressionAttributeValues: { ":entityType": "HOSTEL" },
      Limit: 5,
    })
  );
  const scanDuration = (performance.now() - scanStart).toFixed(2);
  console.log(`⏱️ Table Scan (Filter 'HOSTEL') Duration: ${scanDuration} ms`);

  const sampleHostels = scanResponse.Items || [];
  if (sampleHostels.length === 0) {
    console.error("❌ No hostels found in DynamoDB to test with.");
    return;
  }

  const sampleHostel = sampleHostels[0];
  console.log(`✅ Testing with sample: "${sampleHostel.name}" (ID: ${sampleHostel.id})\n`);

  // ==========================================
  // Test 1: Single Point Read (GetCommand)
  // ==========================================
  console.log("-------------------------------------------------");
  console.log("📊 1. SINGLE POINT READ (GetCommand by Key)");
  console.log("-------------------------------------------------");

  const getTimings = [];
  const ROUNDS = 5;

  for (let i = 1; i <= ROUNDS; i++) {
    const t0 = performance.now();
    const res = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          id: sampleHostel.id,
          entityType: "HOSTEL",
        },
      })
    );
    const t1 = performance.now();
    const duration = +(t1 - t0).toFixed(2);
    getTimings.push(duration);
    console.log(`   Round ${i}: ${duration.toFixed(2)} ms (Hostel: "${res.Item?.name}")`);
  }

  const avgGet = (getTimings.reduce((a, b) => a + b, 0) / getTimings.length).toFixed(2);
  const minGet = Math.min(...getTimings).toFixed(2);
  const maxGet = Math.max(...getTimings).toFixed(2);

  console.log(`\n   ⭐ Point Read Summary -> Min: ${minGet} ms | Avg: ${avgGet} ms | Max: ${maxGet} ms\n`);

  // ==========================================
  // Test 2: Write Latency (PutCommand & Delete)
  // ==========================================
  console.log("-------------------------------------------------");
  console.log("📊 2. WRITE LATENCY (PutCommand & DeleteCommand)");
  console.log("-------------------------------------------------");

  const writeTimings = [];
  for (let i = 1; i <= 3; i++) {
    const testId = `BENCHMARK#${Date.now()}#${i}`;
    const t0 = performance.now();
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          id: testId,
          entityType: "BENCHMARK",
          message: "Speed test payload",
          timestamp: new Date().toISOString(),
        },
      })
    );
    const t1 = performance.now();
    const writeDuration = +(t1 - t0).toFixed(2);
    writeTimings.push(writeDuration);
    console.log(`   Put Item ${i}: ${writeDuration.toFixed(2)} ms`);

    // Clean up
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { id: testId, entityType: "BENCHMARK" },
      })
    );
  }

  const avgWrite = (writeTimings.reduce((a, b) => a + b, 0) / writeTimings.length).toFixed(2);
  console.log(`\n   ⭐ Write Summary -> Avg: ${avgWrite} ms\n`);

  // ==========================================
  // Test 3: Concurrent Multi-Read (Promise.all)
  // ==========================================
  console.log("-------------------------------------------------");
  console.log("📊 3. CONCURRENT PARALLEL READS (5 Simultaneous Requests)");
  console.log("-------------------------------------------------");

  const concurrentStart = performance.now();
  await Promise.all(
    sampleHostels.slice(0, 5).map((hostel) =>
      docClient.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: {
            id: hostel.id,
            entityType: "HOSTEL",
          },
        })
      )
    )
  );
  const concurrentDuration = (performance.now() - concurrentStart).toFixed(2);
  console.log(`   ⚡ 5 Parallel Reads Completed in: ${concurrentDuration} ms (Avg ${(concurrentDuration / 5).toFixed(2)} ms per read in parallel)`);

  console.log("\n=================================================");
  console.log("🏁 SPEED BENCHMARK COMPLETE");
  console.log("=================================================");
  console.log(`✅ Point Read Avg:   ${avgGet} ms`);
  console.log(`✅ Write Avg:        ${avgWrite} ms`);
  console.log(`✅ 5 Parallel Reads: ${concurrentDuration} ms total`);
  console.log("=================================================\n");
}

runSpeedBenchmark().catch((err) => {
  console.error("Benchmark failed:", err);
});
