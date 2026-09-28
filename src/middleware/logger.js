export const jsonLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const entry = {
      ts: new Date().toISOString(),
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      ms: Date.now() - start,
      user: req.user ? req.user._id : null,
    };
    console.log(JSON.stringify(entry));
  });

  next();
};