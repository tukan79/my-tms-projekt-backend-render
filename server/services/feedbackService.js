// Plik: server/services/feedbackService.js
const { Resend } = require('resend');
const logger = require('../config/logger.js');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

const sendBugReportEmail = async (bugReport) => {
  if (!resend) {
    logger.warn('Skipping bug report email: RESEND_API_KEY is not configured.');
    return null;
  }

  if (!process.env.EMAIL_TO) {
    logger.warn('Skipping bug report email: EMAIL_TO is not configured.');
    return null;
  }

  const { description, context } = bugReport;

  const emailHtml = `
    <h2>🪲 New Bug Report</h2>
    <p><b>Description:</b> ${description}</p>
    <p><b>Context:</b></p>
    <pre><code>${context ? JSON.stringify(context, null, 2) : 'No additional context provided.'}</code></pre>
    <p>Reported at: ${new Date(bugReport.createdAt).toLocaleString()}</p>
  `;

  try {
    const data = await resend.emails.send({
      from: process.env.EMAIL_FROM || 'Bug Reporter <onboarding@resend.dev>',
      to: process.env.EMAIL_TO,
      subject: '🐛 New Bug Report Received',
      html: emailHtml,
    });

    logger.info('✅ Bug report email sent successfully via Resend.', { data });
    return data;
  } catch (error) {
    logger.error('❌ Failed to send bug report email via Resend.', { error });
    // Re-throwing the error allows the controller's .catch() block to handle it,
    // but it won't crash the server or block the user response.
    throw error;
  }
};

module.exports = {
  sendBugReportEmail,
};
