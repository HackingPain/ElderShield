const express = require('express');
require('dotenv').config();

console.log('Starting minimal server...');

const app = express();
const PORT = process.env.PORT || 8001;

// Basic health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

// Basic API endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is working!' });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Minimal server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');  
    process.exit(0);
  });
});