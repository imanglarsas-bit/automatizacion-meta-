const levels = { info: "INFO", warn: "WARN", error: "ERROR", debug: "DEBUG" };

function format(level, message, meta) {
  const ts = new Date().toISOString();
  const base = `[${ts}] [${level}] ${message}`;
  return meta ? `${base} ${JSON.stringify(meta)}` : base;
}

export const logger = {
  info:  (msg, meta) => console.log(format(levels.info, msg, meta)),
  warn:  (msg, meta) => console.warn(format(levels.warn, msg, meta)),
  error: (msg, meta) => console.error(format(levels.error, msg, meta)),
  debug: (msg, meta) => {
    if (process.env.DEBUG) console.log(format(levels.debug, msg, meta));
  },
};
