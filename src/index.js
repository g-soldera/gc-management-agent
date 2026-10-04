require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const logger = require('./logger');
const { validate, executeCommandSchema } = require('./validators');
const IntentAgent = require('./agent/intent');

const app = express();
const PORT = process.env.PORT || 3001;

if (!process.env.OPENAI_API_KEY || !process.env.API_KEY || !process.env.MCP_SERVER_PATH) {
  logger.error('Missing required environment variables');
  process.exit(1);
}

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: 'Too many requests',
  handler: (req, res) => {
    logger.warn({ ip: req.ip, path: req.path }, 'Rate limit exceeded');
    res.status(429).json({ error: 'Too many requests' });
  }
});

app.use(limiter);

const authMiddleware = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    logger.warn({ ip: req.ip, path: req.path }, 'Unauthorized access');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

const agent = new IntentAgent();

app.post('/api/execute', authMiddleware, validate(executeCommandSchema), async (req, res) => {
  const { command, context } = req.validated;
  
  logger.info({ command, hasContext: !!context }, 'Received A2A command');
  
  try {
    const result = await agent.execute(command, context);
    res.json(result);
  } catch (error) {
    logger.error({ error: error.message, stack: error.stack }, 'Execution failed');
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

const errorHandler = (err, req, res, next) => {
  logger.error({ err, path: req.path }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
};

app.use(errorHandler);

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing agent');
  await agent.close();
  process.exit(0);
});

app.listen(PORT, () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV }, 'Agent API started');
});
