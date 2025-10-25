// Plik: server/controllers/feedbackController.js
const feedbackService = require('../services/feedbackService.js');

exports.reportBug = async (req, res, next) => {
  try {
    const { description, context } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'Description is required.' });
    }

    // Dodajemy informacje o użytkowniku z tokenu dla bezpieczeństwa
    const reportContext = {
      ...context,
      reportingUser: req.auth, // req.auth jest dodawane przez middleware
    };

    await feedbackService.sendBugReportEmail(description, reportContext);

    res.status(200).json({ message: 'Bug report sent successfully.' });
  } catch (error) {
    console.error('Error in feedbackController:', error);
    // Przekazujemy błąd do globalnego error handlera
    next(error);
  }
};