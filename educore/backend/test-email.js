require('./loadEnv');
const { sendEmail } = require('./middleware/notify');

async function testMail() {
  console.log('Testing email configuration...');
  
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('SMTP credentials are missing from .env');
    return;
  }

  try {
    console.log(`Sending from: ${process.env.EMAIL_FROM || process.env.SMTP_USER}`);
    console.log(`Sending to: ${process.env.SMTP_USER}`);
    
    // We send to ourselves (SMTP_USER) as a test
    await sendEmail({
      to: process.env.SMTP_USER, 
      subject: 'EduCore System: Test Email',
      html: '<p>This is a test email to verify that EduCore can successfully send emails.</p>'
    });
    
    console.log('Test script finished executing. If successful, you should see "📧 Email sent to..." above and the email should arrive within a few minutes.');
    process.exit(0);
  } catch (err) {
    console.error('An error occurred running the test:', err);
    process.exit(1);
  }
}

testMail();
