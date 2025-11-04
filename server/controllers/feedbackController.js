// Plik: server/controllers/feedbackController.js
const feedbackService = require('../services/feedbackService.js');

exports.reportBug = async (req, res, next) => {
  try {
    const { description, context } = req.body;

    if (!description || description.trim() === '') {
      return res.status(400).json({ error: 'Description is required.' });
    }

    // Dodajemy informacje o użytkowniku z tokenu dla bezpieczeństwa
    const reportContext = {
      ...context,
      userAgent: req.headers['user-agent'], // Dodajemy User-Agent
    };

    // Krok 1: Zapisz zgłoszenie w bazie danych
    const newReport = await feedbackService.createBugReport(description, reportContext, req.auth.userId);

    // Krok 2 (Opcjonalny): Wyślij powiadomienie email
    // Używamy pełnego kontekstu z req.auth do wysyłki emaila
    const emailContext = { ...reportContext, reportingUser: req.auth };
    feedbackService.sendBugReportEmail(description, emailContext).catch(emailError => {
      // Logujemy błąd wysyłki, ale nie blokujemy odpowiedzi dla użytkownika
      console.error('Failed to send bug report email, but the report was saved.', emailError);
    });

    res.status(201).json({ message: 'Bug report submitted successfully.', reportId: newReport.id });
  } catch (error) {
    // Przekazujemy błąd do globalnego error handlera
    next(error);
  }
};