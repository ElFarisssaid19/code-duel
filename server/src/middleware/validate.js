/** Parses req.body with a zod schema and replaces it with the parsed value. ZodErrors go to errorHandler. */
export const validateBody = (schema) => (req, res, next) => {
  req.body = schema.parse(req.body);
  next();
};
