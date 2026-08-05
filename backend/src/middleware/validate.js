export const validate = (schema) => (req, _res, next) => {
  try {
    if (schema.body) req.body = schema.body.parse(req.body ?? {});
    if (schema.query) req.validatedQuery = schema.query.parse(req.query ?? {});
    if (schema.params) req.params = schema.params.parse(req.params ?? {});
    next();
  } catch (err) {
    next(err);
  }
};

export default validate;
