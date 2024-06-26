import { DynamoDBClient } from "@aws-sdk/client-dynamodb"

import {
  DynamoDBDocumentClient,
  ScanCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb"

export async function handler(event, context, callback) {
  const data = JSON.parse(event.body)
  const email = data?.email || ""
  const USERS_TABLE = process.env.USERS_TABLE
  console.log({ data, event })
  const client = new DynamoDBClient()
  const docClient = DynamoDBDocumentClient.from(client)
  const command = new ScanCommand({ TableName: USERS_TABLE, FilterExpression: `#email = :email_val`, ExpressionAttributeNames: { "#email": "email" }, ExpressionAttributeValues: { ":email_val": email } })
  const result = await docClient.send(command)
  callback(null, {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data,
      dataEmail: data.email,
      email,
      result
    })
  })
}

export const timeout = 10

export const httpMethod = "POST"