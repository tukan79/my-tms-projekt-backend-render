// Plik: server/services/feedbackService.js
const nodemailer = require('nodemailer');
const logger = require('../config/logger.js'); // Użyjemy loggera dla spójności

const sendBugReportEmail = async (bugReport) => {
  try {
    const transportConfig = {
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      connectionTimeout: 10000, // 10 sekund
      tls: {
        // Opcjonalne: potrzebne w niektórych środowiskach chmurowych (np. Railway)
        rejectUnauthorized: false,
      },
    };

    // Logowanie konfiguracji (bez hasła) w celu diagnostyki
    const { pass, ...configToLog } = transportConfig.auth;
    logger.info('📧 Attempting to create SMTP transport with config:', {
      ...transportConfig,
      auth: configToLog,
    });

    const transporter = nodemailer.createTransport(transportConfig);

    // Krok 1: Weryfikacja połączenia z serwerem SMTP
    await transporter.verify();
    logger.info('📧 SMTP Connection verified successfully.');

    const mailOptions = {
      from: process.env.EMAIL_FROM || `"MyTMS Bug Reporter" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_TO || process.env.BUG_REPORT_EMAIL,
      subject: `🐞 Bug Report: ${bugReport.description?.slice(0, 60)}`,
      html: `
        <h2>Nowe zgłoszenie błędu w MyTMS</h2>
        <p><b>Opis:</b> ${bugReport.description}</p>
        <p><b>Status:</b> ${bugReport.status}</p>
        <p><b>Użytkownik:</b> ${bugReport.context?.reportingUser?.email || 'anonimowy'}</p>
        <p><b>URL:</b> ${bugReport.context?.url}</p>
        <p><b>User Agent:</b> ${bugReport.context?.userAgent}</p>
        <hr/>
        <p>Data: ${new Date(bugReport.createdAt).toLocaleString()}</p>
      `,
    };

    // Krok 2: Wysyłka e-maila
    const info = await transporter.sendMail(mailOptions);
    logger.info('✅ Bug report email sent successfully', { messageId: info.messageId });
  } catch (err) {
    logger.error('❌ Failed to send bug report email. Check SMTP configuration.', { error: err });
  }
};

module.exports = {
  sendBugReportEmail,
};