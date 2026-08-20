import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { initializeApp as initClientApp, getApps as getClientApps } from "firebase/app";
import { getFirestore as getClientFirestore, collection, getDocs } from "firebase/firestore";
import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

// ==========================================
// 1. AWS DYNAMODB CLIENT CONFIGURATION
// ==========================================
const AWS_REGION = process.env.AWS_REGION || "us-east-1";
const DYNAMODB_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || "HostelManagement";

const ddbClient = new DynamoDBClient({
  region: AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const docClient = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
});

// ==========================================
// 2. FIREBASE INITIALIZATION (ADMIN OR CLIENT)
// ==========================================
let firestoreDb = null;
let isUsingAdmin = false;

function initFirebase() {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (privateKey) {
    privateKey = privateKey.replace(/\\n/g, "\n");
  }

  if (projectId && clientEmail && privateKey) {
    try {
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
      }
      firestoreDb = admin.firestore();
      isUsingAdmin = true;
      console.log("🔥 Initialized Firebase via Admin SDK");
      return;
    } catch (adminErr) {
      console.warn("⚠️ Firebase Admin SDK init failed, falling back to Client SDK:", adminErr.message);
    }
  }

  // Fallback to Client SDK
  const clientConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || projectId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  const app = !getClientApps().length ? initClientApp(clientConfig) : getClientApps()[0];
  firestoreDb = getClientFirestore(app);
  isUsingAdmin = false;
  console.log("🔥 Initialized Firebase via Client Firestore SDK");
}

// ==========================================
// 3. FIRESTORE DATA NORMALIZATION HELPERS
// ==========================================
function sanitizeValue(value) {
  if (value === null || value === undefined) return value;
  
  // Firestore Admin / Client Timestamp
  if (typeof value === "object" && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }
  
  // JS Date
  if (value instanceof Date) {
    return value.toISOString();
  }

  // GeoPoint or Custom Object with latitude/longitude
  if (typeof value === "object" && ("latitude" in value && "longitude" in value)) {
    return { lat: value.latitude, lng: value.longitude };
  }

  // Array
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  // Nested Object
  if (typeof value === "object" && value.constructor === Object) {
    const sanitizedObj = {};
    for (const [k, v] of Object.entries(value)) {
      sanitizedObj[k] = sanitizeValue(v);
    }
    return sanitizedObj;
  }

  return value;
}

function sanitizeDocData(data) {
  const result = {};
  for (const [key, val] of Object.entries(data)) {
    result[key] = sanitizeValue(val);
  }
  return result;
}

// ==========================================
// 4. DATA FETCHING (ADMIN & CLIENT COMPATIBLE)
// ==========================================
async function fetchCollectionDocs(collectionName) {
  if (isUsingAdmin) {
    const snap = await firestoreDb.collection(collectionName).get();
    return snap.docs.map((d) => ({
      id: d.id,
      data: d.data(),
      ref: d.ref,
    }));
  } else {
    const colRef = collection(firestoreDb, collectionName);
    const snap = await getDocs(colRef);
    return snap.docs.map((d) => ({
      id: d.id,
      data: d.data(),
      ref: d.ref,
    }));
  }
}

async function fetchSubcollectionDocs(parentCollection, parentId, subcollectionName) {
  if (isUsingAdmin) {
    const snap = await firestoreDb
      .collection(parentCollection)
      .doc(parentId)
      .collection(subcollectionName)
      .get();
    return snap.docs.map((d) => ({
      id: d.id,
      data: d.data(),
    }));
  } else {
    const subColRef = collection(firestoreDb, parentCollection, parentId, subcollectionName);
    const snap = await getDocs(subColRef);
    return snap.docs.map((d) => ({
      id: d.id,
      data: d.data(),
    }));
  }
}

// ==========================================
// 5. SINGLE-TABLE DESIGN MAPPINGS
// ==========================================
/**
 * Maps raw Firestore documents into DynamoDB items with:
 * - partition key: id (String)
 * - sort key: entityType (String)
 * - comprehensive metadata & original identifiers
 */
function mapFirestoreToDynamo(collectionName, docId, rawData, extraMeta = {}) {
  const data = sanitizeDocData(rawData);
  const now = new Date().toISOString();

  let pk = "";
  let sk = "";
  let entityCategory = "";

  switch (collectionName) {
    case "users": {
      const role = (data.role || "user").toLowerCase();
      if (role === "student") {
        pk = `STUDENT#${docId}`;
        sk = "STUDENT";
        entityCategory = "STUDENT";
      } else if (role === "agent") {
        pk = `AGENT#${docId}`;
        sk = "AGENT";
        entityCategory = "AGENT";
      } else if (role === "admin") {
        pk = `ADMIN#${docId}`;
        sk = "ADMIN";
        entityCategory = "ADMIN";
      } else {
        pk = `USER#${docId}`;
        sk = "USER";
        entityCategory = "USER";
      }
      break;
    }

    case "pendingUsers": {
      pk = `PENDING_USER#${docId}`;
      sk = "PENDING_USER";
      entityCategory = "PENDING_USER";
      break;
    }

    case "hostels": {
      pk = `HOSTEL#${docId}`;
      sk = "HOSTEL";
      entityCategory = "HOSTEL";
      break;
    }

    case "pendingHostels": {
      pk = `PENDING_HOSTEL#${docId}`;
      sk = "PENDING_HOSTEL";
      entityCategory = "PENDING_HOSTEL";
      break;
    }

    case "roomTypes": {
      const parentId = extraMeta.parentId || "UNKNOWN";
      const isPending = extraMeta.parentCollection === "pendingHostels";
      pk = `ROOM#${parentId}#${docId}`;
      sk = isPending ? "PENDING_ROOM" : "ROOM";
      entityCategory = isPending ? "PENDING_ROOM" : "ROOM";
      break;
    }

    case "bookings": {
      pk = `BOOKING#${docId}`;
      sk = "BOOKING";
      entityCategory = "BOOKING";
      break;
    }

    case "visits": {
      pk = `VISIT#${docId}`;
      sk = "VISIT";
      entityCategory = "VISIT";
      break;
    }

    case "reviews": {
      pk = `REVIEW#${docId}`;
      sk = "REVIEW";
      entityCategory = "REVIEW";
      break;
    }

    default: {
      const formattedCol = collectionName.toUpperCase();
      pk = `${formattedCol}#${docId}`;
      sk = formattedCol;
      entityCategory = formattedCol;
      break;
    }
  }

  return {
    id: pk,
    entityType: sk,
    entityCategory,
    originalId: docId,
    sourceCollection: collectionName,
    migratedAt: now,
    ...extraMeta,
    ...data,
  };
}

// ==========================================
// 6. DYNAMODB BATCH WRITER (MAX 25 PER BATCH)
// ==========================================
async function batchWriteToDynamoDB(tableName, items) {
  if (items.length === 0) return { written: 0, failed: 0 };

  const BATCH_LIMIT = 25;
  let totalWritten = 0;
  let totalFailed = 0;

  for (let i = 0; i < items.length; i += BATCH_LIMIT) {
    const chunk = items.slice(i, i + BATCH_LIMIT);
    let requestItems = {
      [tableName]: chunk.map((item) => ({
        PutRequest: {
          Item: item,
        },
      })),
    };

    let retries = 0;
    const MAX_RETRIES = 5;

    while (requestItems[tableName] && requestItems[tableName].length > 0 && retries < MAX_RETRIES) {
      try {
        const response = await docClient.send(
          new BatchWriteCommand({
            RequestItems: requestItems,
          })
        );

        const unprocessed = response.UnprocessedItems?.[tableName] || [];
        const writtenInThisAttempt = requestItems[tableName].length - unprocessed.length;
        totalWritten += writtenInThisAttempt;

        if (unprocessed.length > 0) {
          retries++;
          const delay = Math.pow(2, retries) * 100;
          console.warn(`⏳ [${tableName}] ${unprocessed.length} items unprocessed. Retrying in ${delay}ms (Attempt ${retries}/${MAX_RETRIES})...`);
          await new Promise((r) => setTimeout(r, delay));
          requestItems = { [tableName]: unprocessed };
        } else {
          requestItems = {};
        }
      } catch (err) {
        console.error(`❌ Batch write error at index ${i}-${i + chunk.length}:`, err.message);
        totalFailed += requestItems[tableName]?.length || chunk.length;
        break;
      }
    }

    if (requestItems[tableName] && requestItems[tableName].length > 0) {
      console.error(`❌ Failed to write ${requestItems[tableName].length} items after ${MAX_RETRIES} retries.`);
      totalFailed += requestItems[tableName].length;
    }
  }

  return { written: totalWritten, failed: totalFailed };
}

// ==========================================
// 7. MAIN MIGRATION ORCHESTRATOR
// ==========================================
async function runMigration() {
  console.log("=================================================");
  console.log("🚀 STARTING FIRESTORE TO DYNAMODB MIGRATION");
  console.log(`🎯 Target DynamoDB Table: ${DYNAMODB_TABLE_NAME} (Region: ${AWS_REGION})`);
  console.log("=================================================\n");

  const startTime = Date.now();
  initFirebase();

  const collectionsToMigrate = [
    "users",
    "pendingUsers",
    "hostels",
    "pendingHostels",
    "bookings",
    "visits",
    "reviews",
  ];

  const allDynamoItems = [];
  const stats = {};

  for (const colName of collectionsToMigrate) {
    console.log(`📦 Reading collection: [${colName}]...`);
    try {
      const docs = await fetchCollectionDocs(colName);
      console.log(`   Found ${docs.length} document(s) in [${colName}].`);
      stats[colName] = { fetched: docs.length, roomsFetched: 0 };

      for (const doc of docs) {
        const item = mapFirestoreToDynamo(colName, doc.id, doc.data);
        allDynamoItems.push(item);

        // Fetch subcollection roomTypes for hostels and pendingHostels
        if (colName === "hostels" || colName === "pendingHostels") {
          try {
            const roomDocs = await fetchSubcollectionDocs(colName, doc.id, "roomTypes");
            if (roomDocs.length > 0) {
              stats[colName].roomsFetched += roomDocs.length;
              for (const roomDoc of roomDocs) {
                const roomItem = mapFirestoreToDynamo("roomTypes", roomDoc.id, roomDoc.data, {
                  parentId: doc.id,
                  parentCollection: colName,
                  hostelName: doc.data?.name || "Unknown Hostel",
                });
                allDynamoItems.push(roomItem);
              }
            }
          } catch (subErr) {
            console.warn(`   ⚠️ Error reading roomTypes subcollection for ${colName}/${doc.id}:`, subErr.message);
          }
        }
      }
    } catch (err) {
      console.error(`❌ Failed reading collection [${colName}]:`, err.message);
      stats[colName] = { fetched: 0, error: err.message };
    }
  }

  console.log("\n=================================================");
  console.log(`📊 TOTAL ITEMS PREPARED FOR DYNAMODB: ${allDynamoItems.length}`);
  console.log("=================================================");

  if (allDynamoItems.length === 0) {
    console.log("⚠️ No items to migrate. Check your Firestore connection or collection data.");
    return;
  }

  // Sample preview of items
  console.log("\n🔍 Preview of first 3 mapped items:");
  allDynamoItems.slice(0, 3).forEach((item, idx) => {
    console.log(`[${idx + 1}] ID: ${item.id} | EntityType: ${item.entityType} | Source: ${item.sourceCollection}`);
  });

  console.log(`\n💾 Writing ${allDynamoItems.length} items to DynamoDB table '${DYNAMODB_TABLE_NAME}' in batches of 25...`);
  const writeResults = await batchWriteToDynamoDB(DYNAMODB_TABLE_NAME, allDynamoItems);

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("\n=================================================");
  console.log("🏁 MIGRATION COMPLETED");
  console.log("=================================================");
  console.log(`⏱️ Duration: ${durationSec}s`);
  console.log(`✅ Successfully Written: ${writeResults.written}`);
  console.log(`❌ Failed: ${writeResults.failed}`);
  console.log("📋 Collection Summary:");
  for (const [col, info] of Object.entries(stats)) {
    const roomInfo = info.roomsFetched ? ` (+ ${info.roomsFetched} roomTypes)` : "";
    console.log(`   - ${col}: ${info.fetched} docs${roomInfo}`);
  }
  console.log("=================================================\n");
}

runMigration().catch((err) => {
  console.error("💥 Fatal Migration Error:", err);
});
