import { DynamoDBClient } from "@aws-sdk/client-dynamodb"

import {
  DynamoDBDocumentClient,
  GetCommand,
} from "@aws-sdk/lib-dynamodb"
import { SuccessResponse } from "../../classes/httpResponses"

export async function handler(event, context, callback) {
  const data = event.body
  const USERS_TABLE = process.env.USERS_TABLE
  const client = new DynamoDBClient()
  const docClient = DynamoDBDocumentClient.from(client)
  const command = new GetCommand({ TableName: USERS_TABLE, Key: { email: data.email } })
  const result = await docClient.send(command)
  callback(null, new SuccessResponse({data, result}))
}

export const timeout = 10

export const httpMethod = "GET"