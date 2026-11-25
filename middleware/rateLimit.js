export function rateLimit({ windowMs, max, message }) {
  const requests = new Map();

  return (req, res, next) => {
    const key = String(req.user?.id || req.ip || req.socket.remoteAddress || 'unknown');
    const now = Date.now();
    const entry = requests.get(key);

    if (!entry || now >= entry.resetAt) {
      requests.set(key, { count: 1, resetAt: now + windowMs });
    } else if (entry.count >= max) {
      return res.status(429).json({ success: false, message });
    } else {
      entry.count += 1;
    }

    if (requests.size > 5000) {
      for (const [requestKey, requestEntry] of requests) {
        if (now >= requestEntry.resetAt) {
          requests.delete(requestKey);
        }
      }
    }

    next();
  };
}
