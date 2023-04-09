const fs = require('fs');
const path = require('path');
const express = require('express');
const compression = require('compression');
const morgan = require('morgan');
const spdy = require('spdy');
const dotenv = require('dotenv');
const logger = require('./logger');
const cache = require('./cache');

// Load environment variables from .env file
dotenv.config();

// Create Express app
const app = express();

// Use compression middleware
app.use(compression());

// Configure logging
app.use(
  morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) },
  })
);

// Serve static files from the public directory with caching
app.use(async (req, res, next) => {
  const cachedContent = await cache.getAsync(req.url);
  if (cachedContent) {
    res.setHeader('X-Cache', 'Hit');
    res.send(cachedContent);
  } else {
    res.setHeader('X-Cache', 'Miss');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    const originalSend = res.send;
    res.send = function (data) {
      cache.setAsync(req.url, data, 'EX', 3600);
      originalSend.call(this, data);
    };
    next();
  }
});

app.use(express.static(path.join(__dirname, 'public')));

// Configure HTTPS and start the server
const privateKey = fs.readFileSync('ssl/private-key.pem', 'utf8');
const certificate = fs.readFileSync('ssl/certificate.pem', 'utf8');

const credentials = {
  key: privateKey,
  cert: certificate,
};

const httpsServer = spdy.createServer(credentials, app);

const port = process.env.PORT || 3000;
httpsServer.listen(port, () => {
  logger.info(`CDN server is running on port ${port}`);
});
