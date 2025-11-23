prompt-commons-backend git:(main) ✗ npm run dev

> dev
> nodemon src/app.js

[nodemon] 3.1.11
[nodemon] to restart at any time, enter `rs`
[nodemon] watching path(s): *.*
[nodemon] watching extensions: js,mjs,cjs,json
[nodemon] starting `node src/app.js`
node:internal/modules/cjs/loader:1408
  throw err;
  ^

Error: Cannot find module 'bcrypt'
Require stack:
- /Users/songhyunsoo/대학/workspace-web/Project/prompt-commons-backend/src/routes/users.js
- /Users/songhyunsoo/대학/workspace-web/Project/prompt-commons-backend/src/app.js
    at Module._resolveFilename (node:internal/modules/cjs/loader:1405:15)
    at defaultResolveImpl (node:internal/modules/cjs/loader:1061:19)
    at resolveForCJSWithHooks (node:internal/modules/cjs/loader:1066:22)
    at Module._load (node:internal/modules/cjs/loader:1215:37)
    at TracingChannel.traceSync (node:diagnostics_channel:322:14)
    at wrapModuleLoad (node:internal/modules/cjs/loader:235:24)
    at Module.require (node:internal/modules/cjs/loader:1491:12)
    at require (node:internal/modules/helpers:135:16)
    at Object.<anonymous> (/Users/songhyunsoo/대학/workspace-web/Project/prompt-commons-backend/src/routes/users.js:4:16)
    at Module._compile (node:internal/modules/cjs/loader:1734:14) {
  code: 'MODULE_NOT_FOUND',
  requireStack: [
    '/Users/songhyunsoo/대학/workspace-web/Project/prompt-commons-backend/src/routes/users.js',
    '/Users/songhyunsoo/대학/workspace-web/Project/prompt-commons-backend/src/app.js'
  ]
}

Node.js v24.2.0
[nodemon] app crashed - waiting for file changes before starting...