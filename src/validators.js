const { z } = require('zod');

const executeCommandSchema = z.object({
  command: z.string().min(1).max(1000),
  context: z.object({
    discord_user_id: z.string().optional(),
    authorized_users: z.array(z.string()).optional()
  }).optional()
});

const validate = (schema) => (req, res, next) => {
  try {
    req.validated = schema.parse(req.body);
    next();
  } catch (error) {
    res.status(400).json({ 
      error: 'Validation failed', 
      details: error.errors 
    });
  }
};

module.exports = { validate, executeCommandSchema };
