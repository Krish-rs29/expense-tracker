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

  const processRequest = (parsedBody) => {
    handleApiRoute(req, res, pathname, parsedUrl.query, parsedBody);
  };

  // If Vercel pre-parsed the body into an object or string
  if (req.body !== undefined && req.body !== null) {
    let body = req.body;
    if (typeof body === 'string' && body.trim()) {
      try {
        body = JSON.parse(body);
      } catch (e) {}
    }
    return processRequest(typeof body === 'object' ? body : null);
  }

  // If stream is already ended or GET/OPTIONS method
  if (req.readableEnded || req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return processRequest(null);
  }

  // Read request stream for POST/PUT/DELETE if body is unparsed stream
  let bodyData = '';
  req.on('data', chunk => {
    bodyData += chunk.toString();
  });

  req.on('end', () => {
    let parsedBody = null;
    if (bodyData.trim()) {
      try {
        parsedBody = JSON.parse(bodyData);
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
        return;
      }
    }
    processRequest(parsedBody);
  });
};
