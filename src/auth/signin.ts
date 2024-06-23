// const {DynamoDBClient} = require("@aws-sdk/client-dynamodb")

// const {
//   DynamoDBDocumentClient,
//   GetCommand,
//   PutCommand,
// } = require("@aws-sdk/lib-dynamodb")

// const USERS_TABLE = process.env.USERS_TABLE
// const client = new DynamoDBClient()
// const docClient = DynamoDBDocumentClient.from(client)

// const params = {
//   TableName: USERS_TABLE,
//   Key: {
//     userId: req.params.userId,
//   },
// }

// const command = new GetCommand(params)
// const {Item} = await docClient.send(command)

// const params1 = {
//   TableName: USERS_TABLE,
//   Item: {userId, name},
// }

export function handler(event, context, callback) {
  console.log({ event })
  callback(null, {
    statusCode: "200",
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      test: "asdada"
    }),
  })
}

export const timeout = 10

export const httpMethod = "GET"