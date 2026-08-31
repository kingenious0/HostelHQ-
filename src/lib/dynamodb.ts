import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
  BatchGetCommand,
  BatchWriteCommand,
  type GetCommandInput,
  type PutCommandInput,
  type UpdateCommandInput,
  type DeleteCommandInput,
  type QueryCommandInput,
  type ScanCommandInput,
} from "@aws-sdk/lib-dynamodb";
import "dotenv/config";

// ============================================================================
// AWS DynamoDB Configuration & Client Initializer
// ============================================================================
let _docClient: DynamoDBDocumentClient | null = null;

export function isDynamoConfigured(): boolean {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  return Boolean(accessKeyId && secretAccessKey && accessKeyId.length > 5 && secretAccessKey.length > 5);
}

export function getDocClient(): DynamoDBDocumentClient | null {
  if (!isDynamoConfigured()) {
    return null;
  }

  if (!_docClient) {
    const region = process.env.AWS_REGION || "eu-north-1";
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID!;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY!;

    const rawClient = new DynamoDBClient({
      region,
      maxAttempts: 2,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    _docClient = DynamoDBDocumentClient.from(rawClient, {
      marshallOptions: {
        removeUndefinedValues: true,
        convertClassInstanceToMap: true,
      },
      unmarshallOptions: {
        wrapNumbers: false,
      },
    });
  }

  return _docClient;
}

export const DYNAMODB_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || "HostelManagement";

// ============================================================================
// Generic DynamoDB Operations
// ============================================================================

/**
 * Retrieves a single item by its Primary Key (id and entityType).
 */
export async function getItem<T = Record<string, any>>(
  id: string,
  entityType: string,
  tableName: string = DYNAMODB_TABLE_NAME
): Promise<T | null> {
  const client = getDocClient();
  if (!client) return null;

  const params: GetCommandInput = {
    TableName: tableName,
    Key: {
      id,
      entityType,
    },
  };

  const response = await client.send(new GetCommand(params));
  return (response.Item as T) || null;
}

/**
 * Creates or completely replaces an item in DynamoDB.
 */
export async function putItem<T extends Record<string, any>>(
  item: T,
  tableName: string = DYNAMODB_TABLE_NAME
): Promise<T> {
  const client = getDocClient();
  if (!client) {
    return item;
  }

  const params: PutCommandInput = {
    TableName: tableName,
    Item: {
      ...item,
      updatedAt: new Date().toISOString(),
    },
  };

  await client.send(new PutCommand(params));
  return item;
}

/**
 * Updates specific attributes of an item in DynamoDB dynamically.
 */
export async function updateItem<T = Record<string, any>>(
  id: string,
  entityType: string,
  updates: Record<string, any>,
  tableName: string = DYNAMODB_TABLE_NAME
): Promise<T | null> {
  const client = getDocClient();
  if (!client) return null;

  const updateEntries = Object.entries(updates).filter(
    ([key, val]) => key !== "id" && key !== "entityType" && val !== undefined
  );

  if (updateEntries.length === 0) {
    return getItem<T>(id, entityType, tableName);
  }

  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};
  const setExpressions: string[] = [];

  updateEntries.forEach(([key, value], index) => {
    const attrName = `#attr${index}`;
    const attrVal = `:val${index}`;
    expressionAttributeNames[attrName] = key;
    expressionAttributeValues[attrVal] = value;
    setExpressions.push(`${attrName} = ${attrVal}`);
  });

  // Always update the updatedAt timestamp
  expressionAttributeNames["#updatedAt"] = "updatedAt";
  expressionAttributeValues[":updatedAt"] = new Date().toISOString();
  setExpressions.push("#updatedAt = :updatedAt");

  const params: UpdateCommandInput = {
    TableName: tableName,
    Key: {
      id,
      entityType,
    },
    UpdateExpression: `SET ${setExpressions.join(", ")}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: "ALL_NEW",
  };

  const response = await client.send(new UpdateCommand(params));
  return (response.Attributes as T) || null;
}

/**
 * Deletes an item by its Primary Key (id and entityType).
 */
export async function deleteItem(
  id: string,
  entityType: string,
  tableName: string = DYNAMODB_TABLE_NAME
): Promise<boolean> {
  const client = getDocClient();
  if (!client) return true;

  const params: DeleteCommandInput = {
    TableName: tableName,
    Key: {
      id,
      entityType,
    },
  };

  await client.send(new DeleteCommand(params));
  return true;
}

/**
 * Queries items sharing a partition key `id` and optional sort key condition.
 */
export async function queryById<T = Record<string, any>>(
  id: string,
  options: {
    entityTypeBeginsWith?: string;
    filterExpression?: string;
    expressionAttributeNames?: Record<string, string>;
    expressionAttributeValues?: Record<string, any>;
    limit?: number;
    tableName?: string;
  } = {}
): Promise<T[]> {
  const client = getDocClient();
  if (!client) return [];

  const tableName = options.tableName || DYNAMODB_TABLE_NAME;
  const names: Record<string, string> = {
    "#id": "id",
    ...(options.expressionAttributeNames || {}),
  };
  const values: Record<string, any> = {
    ":id": id,
    ...(options.expressionAttributeValues || {}),
  };

  let keyConditionExpression = "#id = :id";

  if (options.entityTypeBeginsWith) {
    names["#entityType"] = "entityType";
    values[":entityTypePrefix"] = options.entityTypeBeginsWith;
    keyConditionExpression += " AND begins_with(#entityType, :entityTypePrefix)";
  }

  const params: QueryCommandInput = {
    TableName: tableName,
    KeyConditionExpression: keyConditionExpression,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    FilterExpression: options.filterExpression,
    Limit: options.limit,
  };

  const response = await client.send(new QueryCommand(params));
  return (response.Items as T[]) || [];
}

/**
 * Scans the DynamoDB table filtering by entityType and additional attributes.
 */
export async function scanEntities<T = Record<string, any>>(
  options: {
    entityType?: string;
    entityTypes?: string[];
    filterExpression?: string;
    expressionAttributeNames?: Record<string, string>;
    expressionAttributeValues?: Record<string, any>;
    limit?: number;
    tableName?: string;
  } = {}
): Promise<T[]> {
  const client = getDocClient();
  if (!client) return [];

  const tableName = options.tableName || DYNAMODB_TABLE_NAME;
  const names: Record<string, string> = {
    ...(options.expressionAttributeNames || {}),
  };
  const values: Record<string, any> = {
    ...(options.expressionAttributeValues || {}),
  };

  const filterParts: string[] = [];

  if (options.filterExpression) {
    filterParts.push(`(${options.filterExpression})`);
  }

  if (options.entityType) {
    names["#entityType"] = "entityType";
    values[":entityType"] = options.entityType;
    filterParts.push("#entityType = :entityType");
  } else if (options.entityTypes && options.entityTypes.length > 0) {
    names["#entityType"] = "entityType";
    const typePlaceholders = options.entityTypes.map((t, idx) => {
      const ph = `:entityType${idx}`;
      values[ph] = t;
      return ph;
    });
    filterParts.push(`#entityType IN (${typePlaceholders.join(", ")})`);
  }

  const params: ScanCommandInput = {
    TableName: tableName,
    FilterExpression: filterParts.length > 0 ? filterParts.join(" AND ") : undefined,
    ExpressionAttributeNames: Object.keys(names).length > 0 ? names : undefined,
    ExpressionAttributeValues: Object.keys(values).length > 0 ? values : undefined,
    Limit: options.limit,
  };

  const response = await client.send(new ScanCommand(params));
  return (response.Items as T[]) || [];
}

/**
 * Batch retrieves items by primary keys.
 */
export async function batchGet<T = Record<string, any>>(
  keys: Array<{ id: string; entityType: string }>,
  tableName: string = DYNAMODB_TABLE_NAME
): Promise<T[]> {
  if (keys.length === 0) return [];

  const client = getDocClient();
  if (!client) return [];

  const BATCH_LIMIT = 100;
  const results: T[] = [];

  for (let i = 0; i < keys.length; i += BATCH_LIMIT) {
    const chunk = keys.slice(i, i + BATCH_LIMIT);
    const response = await client.send(
      new BatchGetCommand({
        RequestItems: {
          [tableName]: {
            Keys: chunk,
          },
        },
      })
    );

    const items = (response.Responses?.[tableName] as T[]) || [];
    results.push(...items);
  }

  return results;
}

/**
 * Batch writes items (puts and deletes) in chunks of 25 with exponential backoff retry.
 */
export async function batchWrite(
  options: {
    putItems?: Record<string, any>[];
    deleteKeys?: Array<{ id: string; entityType: string }>;
    tableName?: string;
  }
): Promise<{ written: number; deleted: number; failed: number }> {
  const client = getDocClient();
  if (!client) {
    return { written: 0, deleted: 0, failed: 0 };
  }

  const tableName = options.tableName || DYNAMODB_TABLE_NAME;
  const putItems = options.putItems || [];
  const deleteKeys = options.deleteKeys || [];

  const requests: any[] = [
    ...putItems.map((item) => ({
      PutRequest: {
        Item: {
          ...item,
          updatedAt: new Date().toISOString(),
        },
      },
    })),
    ...deleteKeys.map((key) => ({
      DeleteRequest: {
        Key: key,
      },
    })),
  ];

  if (requests.length === 0) {
    return { written: 0, deleted: 0, failed: 0 };
  }

  const BATCH_LIMIT = 25;
  let writtenCount = 0;
  let deletedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < requests.length; i += BATCH_LIMIT) {
    const chunk = requests.slice(i, i + BATCH_LIMIT);
    let requestItems = {
      [tableName]: chunk,
    };

    let retries = 0;
    const MAX_RETRIES = 5;

    while (requestItems[tableName] && requestItems[tableName].length > 0 && retries < MAX_RETRIES) {
      try {
        const response = await client.send(
          new BatchWriteCommand({
            RequestItems: requestItems,
          })
        );

        const unprocessed = response.UnprocessedItems?.[tableName] || [];

        chunk.forEach((req) => {
          if (req.PutRequest) writtenCount++;
          if (req.DeleteRequest) deletedCount++;
        });

        if (unprocessed.length > 0) {
          retries++;
          const delay = Math.pow(2, retries) * 100;
          await new Promise((r) => setTimeout(r, delay));
          requestItems = { [tableName]: unprocessed };
        } else {
          requestItems = {} as any;
        }
      } catch (err: any) {
        console.error("DynamoDB BatchWrite error:", err.message);
        failedCount += requestItems[tableName]?.length || chunk.length;
        break;
      }
    }
  }

  return { written: writtenCount, deleted: deletedCount, failed: failedCount };
}
