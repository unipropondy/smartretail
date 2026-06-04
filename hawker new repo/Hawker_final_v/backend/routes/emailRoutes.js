const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { authenticateToken } = require('../middleware/auth');

router.post('/send-settlement-email', authenticateToken, async (req, res) => {
    try {
        const { to, subject, pdfBase64, excelBase64, outletName, cashierName, date } = req.body;
        
      const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});
        
        const attachments = [];
        
        if (pdfBase64) {
            attachments.push({
                filename: `Settlement_Report_${date}.pdf`,
                content: pdfBase64,
                encoding: 'base64'
            });
        }
        
        if (excelBase64) {
            attachments.push({
                filename: `Settlement_Report_${date}.csv`,
                content: excelBase64,
                encoding: 'base64'
            });
        }
        
        const mailOptions = {
            from: `"${outletName} POS" <${process.env.EMAIL_USER}>`,
            to: to,
            subject: subject,
            html: `
                <h2>Settlement Report - ${outletName}</h2>
                <p><strong>Cashier:</strong> ${cashierName}</p>
                <p><strong>Date:</strong> ${date}</p>
                <p>Please find attached the settlement report.</p>
                <hr>
                <p>This is an auto-generated email from POS System.</p>
            `,
            attachments: attachments
        };
        
        await transporter.sendMail(mailOptions);
        
        console.log(`✅ Email sent to ${to}`);
        res.json({ success: true, message: 'Email sent successfully' });
        
    } catch (err) {
        console.error('Email error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;