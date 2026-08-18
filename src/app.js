const crypto = require('node:crypto');
const express = require('express');
const { ScanCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');
const docClient = require('./database/dynamodb');

const TABLE_NAME = process.env.DYNAMODB_TABLE || "deployment-tracker";

const app = express();
app.disable('x-powered-by');
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: 'Deployment Tracker is running',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'production',
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

app.get('/deployments', async (req, res) => {
  try {
    const result = await docClient.send(new ScanCommand({ TableName: TABLE_NAME }));
    res.json(result.Items || []);
  } catch (err) {
    console.error("Failed to fetch deployments, table:", TABLE_NAME, err);
    res.status(500).json({ error: 'Failed to fetch deployments' });
  }
});

app.get('/deployments/latest', async (req, res) => {
  try {
    const result = await docClient.send(new ScanCommand({ TableName: TABLE_NAME }));
    const items = result.Items || [];

    if (items.length === 0) {
      return res.status(404).json({ error: 'No deployments found' });
    }

    const latest = items.reduce((a, b) =>
      new Date(a.deployedAt) > new Date(b.deployedAt) ? a : b
    );

    res.json(latest);
  } catch (err) {
    console.error('Failed to fetch latest deployment', err);
    res.status(500).json({ error: 'Failed to fetch latest deployment' });
  }
});

app.post('/deployments', async (req, res) => {
  const { version, environment, status, deployedAt } = req.body || {};

  if (!version) {
    return res.status(400).json({ error: 'version is required' });
  }

  const item = {
    id: `deployment-${crypto.randomUUID()}`,
    version,
    environment: environment || 'production',
    status: status || 'successful',
    deployedAt: deployedAt || new Date().toISOString(),
  };

  try {
    await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
    res.status(201).json(item);
  } catch (err) {
    console.error('Failed to create deployment', err);
    res.status(500).json({ error: 'Failed to create deployment' });
  }
});

app.get('/endpoints', (req, res) => {
  const endpoints = app.router.stack
    .filter((layer) => layer.route)
    .flatMap((layer) =>
      Object.keys(layer.route.methods).map((method) => ({
        method: method.toUpperCase(),
        path: layer.route.path,
      }))
    );

  res.json(endpoints);
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

module.exports = app;
