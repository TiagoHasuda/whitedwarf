export function handler(event, context, callback) {
  console.log({ event })
  callback(null, {
    statusCode: "200",
    headers: {
      'Content-Type': 'application/json',
    },
    body: "test",
  })
}

export const httpMethod = "POST"