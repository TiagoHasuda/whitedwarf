class HttpResponse {
  readonly statusCode: number
  headers: { [key: string]: string }
  readonly body: string

  constructor(statusCode = 200, body = {}, headers = {"Content-Type": "application/json"}) {
    this.statusCode = statusCode
    this.headers = headers
    this.body = JSON.stringify(body)
  }
}

export class SuccessResponse extends HttpResponse {
  constructor(data: any) {
    super(200, data)
  }
}

export class BadRequestException extends HttpResponse {
  constructor(error: any) {
    super(400, error)
  }
}

export class UnauthorizedException extends HttpResponse {
  constructor(error: any) {
    super(401, error)
  }
}

export class ForbiddenException extends HttpResponse {
  constructor(error: any) {
    super(403, error)
  }
}

export class NotFoundException extends HttpResponse {
  constructor(error: any) {
    super(404, error)
  }
}

export class ImATeapotException extends HttpResponse {
  constructor(error: any) {
    super(418, error)
  }
}

export class InternalServerErrorException extends HttpResponse {
  constructor(error: any) {
    super(500, error)
  }
}
