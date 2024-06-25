import { DynamoDBClient } from "@aws-sdk/client-dynamodb"

import {
  DynamoDBDocumentClient,
  GetCommand,
} from "@aws-sdk/lib-dynamodb"

export async function handler(event, context, callback) {
  const data = event.body
  const USERS_TABLE = process.env.USERS_TABLE
  const client = new DynamoDBClient()
  const docClient = DynamoDBDocumentClient.from(client)
  const command = new GetCommand({ TableName: USERS_TABLE, Key: { email: data.email } })
  const result = await docClient.send(command)
  callback(null, {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
    },
    body: {
      data,
      result
    }
  })
}

export const timeout = 10

export const httpMethod = "POST"