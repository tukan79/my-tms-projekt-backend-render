// Plik: server/controllers/feedbackController.js
const { BugReport } = require('../models');
const { sendBugReportEmail } = require('../services/feedbackService.js');

exports.reportBug = async (req, res) => {
  try {
    const { description } = req.body;

    if (!description || description.trim().length === 0) {
      return res.status(400).json({ error: 'Description is required.' });
    }

    // Zapewniamy, że rola istnieje — Twój JWT ma tylko id i email.
    const reportingUser = req.user
      ? {
          userId: req.user.id,
          email: req.user.email,
          role: req.user.role || 'user',
        }
      : {
          userId: null,
          email: 'anonymous@mytms.app',
          role: 'guest',
        };

    const bugReport = await BugReport.create({
      description,
      context: {
        url: req.headers.referer || null,
        userAgent: req.headers['user-agent'] || null,
        reportingUser,
      },
      status: 'new',
    });

    // Wysyłamy mail — ale nie blokujemy odpowiedzi API
    sendBugReportEmail(bugReport).catch((err) =>
      console.error('Error while sending bug report email:', err)
    );

    return res
      .status(201)
      .json({ message: 'Bug report submitted successfully', bugReport });
  } catch (error) {
    console.error('Error submitting bug report:', error);
    return res.status(500).json({ error: 'Failed to submit bug report' });
  }
};
