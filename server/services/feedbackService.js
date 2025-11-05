// Plik: server/services/feedbackService.js
const nodemailer = require('nodemailer');

const sendBugReportEmail = async (bugReport) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false, // true jeśli port 465
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        // Opcjonalne: potrzebne w niektórych środowiskach chmurowych (np. Railway)
        rejectUnauthorized: false,
      },
    });

    const mailOptions = {
      from: `"MyTMS Bug Reporter" <${process.env.SMTP_USER}>`,
      to: process.env.BUG_REPORT_EMAIL,
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

    await transporter.sendMail(mailOptions);
    console.log('📧 Bug report email sent successfully');
  } catch (err) {
    console.error('❌ Failed to send bug report email:', err.message);
  }
};

module.exports = {
  sendBugReportEmail,
};