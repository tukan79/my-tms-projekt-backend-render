const axios = require('axios');

const OPTIMIZER_URL = process.env.OPTIMIZER_URL;
const OPTIMIZER_TOKEN = process.env.OPTIMIZER_TOKEN;

if (!OPTIMIZER_URL) {
  console.warn('OPTIMIZER_URL is not set; external optimizer calls are disabled.');
}

const optimizeRoutes = async (payload) => {
  if (!OPTIMIZER_URL) {
    throw new Error('OPTIMIZER_URL is not configured');
  }

  try {
    const response = await axios.post(`${OPTIMIZER_URL}/optimize/routes`, payload, {
      timeout: 30_000,
      headers: OPTIMIZER_TOKEN ? { Authorization: `Bearer ${OPTIMIZER_TOKEN}` } : {},
    });
    return response.data;
  } catch (error) {
    const status = error?.response?.status;
    const details = error?.response?.data || error.message;
    throw new Error(
      `Optimizer request failed${status ? ` (status ${status})` : ''}: ${JSON.stringify(details)}`
    );
  }
};

module.exports = { optimizeRoutes };
