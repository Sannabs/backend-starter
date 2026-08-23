import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { toNodeHandler } from 'better-auth/node'
import { env } from './config/env.js'
import { auth } from './lib/auth.js'
import { errorHandler } from './middleware/error.middleware.js'
import { requestLogger } from './middleware/requestLogger.middleware.js'


const app = express()



// Global middleware
app.use(requestLogger)
app.use(helmet())
app.use(cors({ origin: env.CLIENT_URL, credentials: true }))



app.all('/api/auth/{*splat}', toNodeHandler(auth))

app.use(express.json())

app.use(errorHandler)


export default app
