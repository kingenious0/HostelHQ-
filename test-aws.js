import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import dotenv from "dotenv";

dotenv.config();

const client = new DynamoDBClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const docClient = DynamoDBDocumentClient.from(client);

async function testDynamoDB() {
  const tableName = "HostelManagement";

  try {
    // 1. Write a test item
    console.log("Writing test hostel record to AWS...");
    await docClient.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          id: "TEST#001",
          entityType: "CONNECTION_TEST",
          message: "AWS DynamoDB is live and working!",
          timestamp: new Date().toISOString(),
        },
      })
    );
    console.log("✅ Success! Record written.");

    // 2. Read it back
    console.log("Reading test record back from AWS...");
    const response = await docClient.send(
      new GetCommand({
        TableName: tableName,
        Key: {
          id: "TEST#001",
          entityType: "CONNECTION_TEST",
        },
      })
    );
    console.log("✅ Retrieved Item:", response.Item);

  } catch (error) {
    console.error("❌ Connection Error:", error);
  }
}

testDynamoDB();