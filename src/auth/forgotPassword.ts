export function handler(event, context, callback) {
  console.log({ event, test: "gjsdkfsjkfsad test" })
  callback(null, {
    statusCode: "200",
    headers: {
      'Content-Type': 'application/json',
    },
    body: "test",
  })
}

export const httpMethod = "POST"