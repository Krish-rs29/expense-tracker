/**
 * Vercel Serverless Handler for Expense Tracker API
 */
const url = require('node:url');
const { handleApiRoute } = require('../routes');

module.exports = (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname || '/api';

  // Ensure pathname starts with /api
  if (!pathname.startsWith('/api')) {
    pathname = '/api' + (pathname.startsWith('/') ? '' : '/') + pathname;
  }

  // If Vercel pre-parsed the body into an object
  if (req.body && typeof req.body === 'object') {
    return handleApiRoute(req, res, pathname, parsedUrl.query, req.body);
  }

  // Read stream if body is passed as raw string or stream
  let bodyData = '';
  req.on('data', chunk => {
    bodyData += chunk.toString();
  });

  req.on('end', () => {
    let parsedBody = null;
    if (typeof req.body === 'string' && req.body.trim()) {
      try {
        parsedBody = JSON.parse(req.body);
      } catch (e) {}
    }
    if (!parsedBody && bodyData.trim()) {
      try {
        parsedBody = JSON.parse(bodyData);
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
        return;
      }
    }
    handleApiRoute(req, res, pathname, parsedUrl.query, parsedBody);
  });
};
