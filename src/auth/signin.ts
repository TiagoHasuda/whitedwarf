import { DynamoDBClient } from "@aws-sdk/client-dynamodb"

import {
  DynamoDBDocumentClient,
  GetCommand,
} from "@aws-sdk/lib-dynamodb"

// const params = {
//   TableName: USERS_TABLE,
//   Key: {
//     userId: req.params.userId,
//   },
// }


// const params1 = {
//   TableName: USERS_TABLE,
//   Item: {userId, name},
// }

export async function handler(event, context, callback) {
  const USERS_TABLE = process.env.USERS_TABLE
  const client = new DynamoDBClient()
  const docClient = DynamoDBDocumentClient.from(client)
  const command = new GetCommand({ TableName: USERS_TABLE, Key: { id: "test" } })
  const result = await docClient.send(command)
  console.log({ result })
  callback(null, {
    statusCode: "200",
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      result,
    }),
  })
}

export const timeout = 10

export const httpMethod = "GET"