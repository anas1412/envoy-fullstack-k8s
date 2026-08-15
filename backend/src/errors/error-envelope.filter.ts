import { ArgumentsHost, Catch, ExceptionFilter, HttpException, NotFoundException } from '@nestjs/common'
import type { Request, Response } from 'express'

const USERS_ROUTE = /^\/api\/users(?:\/\d+)?$/

@Catch()
export class ErrorEnvelopeFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp()
    const res = ctx.getResponse<Response>()
    const req = ctx.getRequest<Request>()

    if (exception instanceof NotFoundException && exception.message.startsWith('Cannot ')) {
      const method = req.method
      const path = (req.originalUrl ?? req.url).split('?')[0]
      if (USERS_ROUTE.test(path) && method !== 'GET') {
        res.status(405).json({ error: `Method ${method} not allowed` })
      } else {
        res.status(404).json({ error: `No route for ${method} ${path}` })
      }
      return
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const body = exception.getResponse()
      if (typeof body === 'object' && body !== null && !('message' in body)) {
        res.status(status).json(body)
        return
      }
      const message =
        typeof body === 'string' ? body : (body as { message?: string | string[] }).message
      const text = Array.isArray(message) ? message[0] : (message ?? exception.message)
      res.status(status).json({ error: text })
      return
    }

    res.status(500).json({ error: 'Internal server error' })
  }
}
