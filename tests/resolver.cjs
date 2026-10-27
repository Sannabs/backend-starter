/**
 * Source files import with the `.js` extension Node's ESM resolver requires, but
 * only the `.ts` sources exist at test time. A blanket moduleNameMapper for that
 * also rewrites dependencies' own relative imports — which breaks packages that
 * genuinely ship `.js` (libphonenumber-js loads its metadata that way).
 *
 * So strip the extension only for requests originating outside node_modules.
 */
module.exports = (request, options) => {
  const stripped = request.replace(/^(\.{1,2}\/.*)\.js$/, "$1");
  const isOwnSource =
    stripped !== request && !options.basedir.includes("node_modules");

  if (isOwnSource) {
    try {
      return options.defaultResolver(stripped, options);
    } catch {
      // Fall through — a real .js file next to our sources still resolves below.
    }
  }

  return options.defaultResolver(request, options);
};
