// Plik: server/services/feedbackService.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendBugReportEmail = async (description, context) => {
  const { reportingUser, url, userAgent } = context;

  const subject = `[MyTMS Bug Report] - Issue from ${reportingUser.email}`;

  const htmlBody = `
    <h1>New Bug Report from MyTMS</h1>
    <p>A new issue has been reported. Here are the details:</p>
    <hr>
    <h3>Description:</h3>
    <p style="background-color: #f5f5f5; border: 1px solid #ddd; padding: 10px; border-radius: 4px;">
      ${description.replace(/\n/g, '<br>')}
    </p>
    <hr>
    <h3>Context:</h3>
    <ul>
      <li><strong>User:</strong> ${reportingUser.email} (ID: ${reportingUser.userId}, Role: ${reportingUser.role})</li>
      <li><strong>URL:</strong> <a href="${url}">${url}</a></li>
      <li><strong>User Agent:</strong> ${userAgent}</li>
      <li><strong>Timestamp:</strong> ${new Date().toISOString()}</li>
    </ul>
  `;

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: process.env.EMAIL_TO,
    subject: subject,
    html: htmlBody,
  };

  try {
    console.log('Attempting to send bug report email...');
    const info = await transporter.sendMail(mailOptions);
    console.log('Bug report email sent successfully:', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending bug report email:', error);
    // Rzucamy błąd dalej, aby kontroler mógł go obsłużyć
    throw new Error('Failed to send email. Please check server configuration.');
  }
};

module.exports = {
  sendBugReportEmail,
};