// Plik: server/controllers/feedbackController.js
const { sendBugReportEmail, createBugReport } = require('../services/feedbackService.js');

exports.reportBug = async (req, res) => {
  try {
    const { description, context } = req.body;

    if (!description || description.trim() === '') {
      return res.status(400).json({ error: 'Description is required.' });
    }

    const bugContext = {
      reportingUser: context?.reportingUser || {
        email: 'anonymous@mytms.app',
        userId: null,
        role: 'guest',
      },
      url: context?.url || req.headers.referer || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
    };

    // 1️⃣ Zapisz w bazie
    const report = await createBugReport(description, bugContext, bugContext.reportingUser.userId);

    // 2️⃣ Wyślij e-mail (jeśli działa SMTP)
    await sendBugReportEmail(description, bugContext);

    res.status(201).json({
      message: 'Bug report submitted successfully.',
      reportId: report.id,
    });
  } catch (error) {
    console.error('❌ Error in reportBug:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};