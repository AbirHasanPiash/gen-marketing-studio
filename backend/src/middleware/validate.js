/**
 * Zod request validation. Parsed values replace the raw ones, so handlers work
 * with coerced, bounded input — an unvalidated `?brandId=abc` otherwise reaches
 * Prisma and surfaces as an opaque "Malformed ObjectID" 400.
 *
 * `req.query` is a getter on Express's request prototype and cannot be assigned
 * under ESM's strict mode, so the parsed object is defined as an own property
 * that shadows it (and mirrored on `req.validatedQuery`).
 */
export const validate = (schema) => (req, _res, next) => {
  try {
    if (schema.body) req.body = schema.body.parse(req.body ?? {});
    if (schema.params) req.params = schema.params.parse(req.params ?? {});
    if (schema.query) {
      const parsed = schema.query.parse(req.query ?? {});
      Object.defineProperty(req, 'query', {
        value: parsed,
        writable: true,
        configurable: true,
        enumerable: true,
      });
      req.validatedQuery = parsed;
    }
    next();
  } catch (err) {
    next(err);
  }
};

export default validate;
