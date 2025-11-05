// Plik: server/controllers/feedbackController.js
const { BugReport } = require('../models/index.js');
const { sendBugReportEmail } = require('../services/feedbackService.js');

exports.reportBug = async (req, res) => {
  try {
    const { description } = req.body;
    if (!description) {
      return res.status(400).json({ error: 'Description is required.' });
    }

    const bugReport = await BugReport.create({
      description,
      context: {
        url: req.headers.referer || 'unknown',
        userAgent: req.headers['user-agent'],
        reportingUser: req.user
          ? { userId: req.user.id, email: req.user.email, role: req.user.role }
          : { userId: null, email: 'anonymous@mytms.app', role: 'guest' },
      },
      status: 'new',
    });

    // 🔔 Wyślij e-mail w tle
    sendBugReportEmail(bugReport).catch((err) =>
      console.error('Error while sending bug report email:', err)
    );

    return res.status(201).json({ message: 'Bug report submitted successfully', bugReport });
  } catch (error) {
    console.error('Error submitting bug report:', error);
    return res.status(500).json({ error: 'Failed to submit bug report' });
  }
};