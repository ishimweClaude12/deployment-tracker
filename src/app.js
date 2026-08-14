const express = require('express');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand } = require('@aws-sdk/lib-dynamodb');

const TABLE_NAME = process.env.DEPLOYMENTS_TABLE || 'deployments';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

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
    console.error('Failed to fetch deployments', err);
    res.status(500).json({ error: 'Failed to fetch deployments' });
  }
});

app.post('/deployments', async (req, res) => {
  const { version, deployedAt } = req.body || {};

  if (!version) {
    return res.status(400).json({ error: 'version is required' });
  }

  const item = {
    version,
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

module.exports = app;
