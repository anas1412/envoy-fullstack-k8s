import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import type { NextFunction, Request, Response } from 'express'
import { json, urlencoded } from 'express'
import { AppModule } from './app.module'
import { ErrorEnvelopeFilter } from './errors/error-envelope.filter'

const port = Number(process.env.PORT ?? 3000)

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false })

  // Own the JSON parser so body errors keep the wire contract:
  // invalid JSON -> 400 "Request body must be valid JSON"; strict:false accepts
  // top-level primitives, which validation rejects as "must be a JSON object".
  const parseJson = json({ strict: false })
  app.use((req: Request, res: Response, next: NextFunction) => {
    parseJson(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: 'Request body must be valid JSON' })
        return
      }
      next()
    })
  })
  app.use(urlencoded({ extended: true }))

  app.setGlobalPrefix('api')
  app.useGlobalFilters(new ErrorEnvelopeFilter())
  await app.listen(port)
}

void bootstrap()
