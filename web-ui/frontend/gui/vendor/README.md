# Vendored front-end libraries (pinned)

React, ReactDOM, and Babel are served from here instead of a runtime CDN, so a
CDN compromise can't inject script into visitors and the Content-Security-Policy
can lock `script-src` to `'self'`. Pinned versions:

| file | package |
|------|---------|
| `react.production.min.js`     | `react@18.3.1` |
| `react-dom.production.min.js` | `react-dom@18.3.1` |
| `babel.min.js`                | `@babel/standalone@7.26.4` |

## Re-vendor
```sh
curl -sSL -o react.production.min.js     https://unpkg.com/react@18.3.1/umd/react.production.min.js
curl -sSL -o react-dom.production.min.js https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js
curl -sSL -o babel.min.js                https://unpkg.com/@babel/standalone@7.26.4/babel.min.js
```

## Longer-term
Precompile the inline JSX at build time to drop `@babel/standalone` (~3 MB) and
tighten `script-src` further (remove `'unsafe-eval'` / `'unsafe-inline'`).
