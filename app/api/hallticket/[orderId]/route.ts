    import { NextRequest, NextResponse } from 'next/server';
    import Registration from '@/models/Registration';
    import { connectDB } from '@/lib/db';
    import puppeteer from 'puppeteer'; // <--- THIS MUST BE 'puppeteer', NOT 'puppeteer-core'
    // Ensure there is NO import like: import chromium from '@sparticuz/chromium';

    export async function GET(req: NextRequest, { params }: { params: { orderId: string } }) {
      const { orderId } = params;

      if (!orderId) {
        return new NextResponse(JSON.stringify({ success: false, message: 'Order ID is required.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      try {
        await connectDB();

        const registration = await Registration.findOne({ orderId: orderId });

        if (!registration) {
          return new NextResponse(JSON.stringify({ success: false, message: 'Registration not found for this Order ID.' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // --- Generate HTML for the Hall Ticket ---
        const maskedAadhar = registration.aadhar.slice(0, 4) + ' **** **** ' + registration.aadhar.slice(8, 12);

        const hallTicketHtml = `
          <!DOCTYPE html>
          <html lang="en">
          <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Hall Ticket - Talent Test</title>
              <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap" rel="stylesheet">
              <style>
                  body {
                      font-family: 'Roboto', sans-serif;
                      margin: 0;
                      padding: 20px;
                      background-color: #f0f2f5;
                      color: #333;
                      display: flex;
                      justify-content: center;
                      align-items: flex-start;
                      min-height: 100vh;
                  }
                  .container {
                      width: 210mm;
                      min-height: 297mm;
                      padding: 30px;
                      border: 1px solid #ddd;
                      box-shadow: 0 0 15px rgba(0, 0, 0, 0.1);
                      background-color: #fff;
                      box-sizing: border-box;
                      position: relative;
                      overflow: hidden;
                  }
                  .watermark {
                      position: absolute;
                      top: 50%;
                      left: 50%;
                      transform: translate(-50%, -50%) rotate(-45deg);
                      font-size: 80px;
                      color: rgba(0, 0, 0, 0.08);
                      font-weight: bold;
                      text-transform: uppercase;
                      white-space: nowrap;
                      z-index: 0;
                      pointer-events: none;
                  }
                  .header {
                      text-align: center;
                      margin-bottom: 30px;
                      border-bottom: 2px solid #007bff;
                      padding-bottom: 15px;
                      position: relative;
                      z-index: 1;
                  }
                  .header h1 {
                      color: #007bff;
                      margin: 0;
                      font-size: 32px;
                      font-weight: bold;
                  }
                  .header p {
                      margin: 5px 0 0;
                      font-size: 18px;
                      color: #555;
                  }
                  .section-title {
                      font-size: 20px;
                      font-weight: bold;
                      color: #007bff;
                      margin-top: 25px;
                      margin-bottom: 15px;
                      border-bottom: 1px solid #eee;
                      padding-bottom: 5px;
                      position: relative;
                      z-index: 1;
                  }
                  .details-grid {
                      display: grid;
                      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                      gap: 15px 30px;
                      margin-bottom: 20px;
                      position: relative;
                      z-index: 1;
                  }
                  .detail-item {
                      font-size: 16px;
                      line-height: 1.5;
                  }
                  .detail-item strong {
                      color: #333;
                      display: block;
                      margin-bottom: 3px;
                  }
                  .instructions ol {
                      list-style-type: decimal;
                      padding-left: 25px;
                      margin-top: 10px;
                      position: relative;
                      z-index: 1;
                  }
                  .instructions li {
                      margin-bottom: 8px;
                      font-size: 15px;
                      color: #444;
                  }
                  .footer {
                      margin-top: 40px;
                      text-align: center;
                      font-size: 14px;
                      color: #777;
                      position: relative;
                      z-index: 1;
                  }
                  .signature-box {
                      margin-top: 30px;
                      display: flex;
                      justify-content: space-between;
                      padding-top: 20px;
                      border-top: 1px dashed #ccc;
                      font-size: 15px;
                      color: #555;
                      position: relative;
                      z-index: 1;
                  }
                  .signature-box div {
                      width: 45%;
                      text-align: center;
                  }
                  /* Print-specific styles */
                  @page {
                      size: A4;
                      margin: 20mm;
                  }
                  @media print {
                      body {
                          margin: 0;
                          padding: 0;
                          background-color: #fff;
                      }
                      .container {
                          box-shadow: none;
                          border: none;
                      }
                  }
              </style>
          </head>
          <body>
              <div class="container">
                  <div class="watermark">Hall Ticket</div>

                  <div class="header">
                      <h1>Talent Test - Hall Ticket</h1>
                      <p>Admit Card for Examination</p>
                  </div>

                  <div class="section-title">Student Details</div>
                  <div class="details-grid">
                      <div class="detail-item">
                          <strong>Student Name:</strong> ${registration.studentName}
                      </div>
                      <div class="detail-item">
                          <strong>Guardian's Name:</strong> ${registration.guardianName}
                      </div>
                      <div class="detail-item">
                          <strong>Phone Number:</strong> ${registration.phone}
                      </div>
                      <div class="detail-item">
                          <strong>Class Level:</strong> Class ${registration.classLevel}
                      </div>
                      <div class="detail-item">
                          <strong>Aadhar Number:</strong> ${maskedAadhar}
                      </div>
                      <div class="detail-item">
                          <strong>Career Aspiration:</strong> ${registration.careerAspiration}
                      </div>
                      <div class="detail-item">
                          <strong>Registration ID:</strong> ${registration.orderId}
                      </div>
                      <div class="detail-item">
                          <strong>Registration Date:</strong> ${new Date(registration.createdAt).toLocaleDateString()}
                      </div>
                  </div>

                  <div class="section-title">Examination Details</div>
                  <div class="details-grid">
                      <div class="detail-item">
                          <strong>Exam Date:</strong> DD/MM/YYYY (To be announced)
                      </div>
                      <div class="detail-item">
                          <strong>Exam Time:</strong> HH:MM AM/PM (To be announced)
                      </div>
                      <div class="detail-item">
                          <strong>Venue:</strong> [Your Exam Venue Address Here]
                      </div>
                      <div class="detail-item">
                          <strong>Reporting Time:</strong> HH:MM AM/PM (To be announced)
                      </div>
                  </div>

                  <div class="section-title">Important Instructions</div>
                  <div class="instructions">
                      <ol>
                          <li>Candidates must bring this Hall Ticket to the examination center.</li>
                          <li>A valid photo ID (e.g., School ID, Aadhar Card) must be presented for verification.</li>
                          <li>Arrive at the examination center at least 30 minutes before the reporting time.</li>
                          <li>No electronic gadgets (mobile phones, smartwatches, calculators) are allowed inside the exam hall.</li>
                          <li>Follow all instructions given by the invigilators.</li>
                          <li>Any form of malpractice will lead to immediate disqualification.</li>
                          <li>The decision of the examination authority will be final.</li>
                      </ol>
                  </div>

                  <div class="signature-box">
                      <div>
                          <p>_________________________</p>
                          <p>Candidate's Signature</p>
                      </div>
                      <div>
                          <p>_________________________</p>
                          <p>Invigilator\'s Signature</p>
                      </div>
                  </div>

                  <div class="footer">
                      &copy; ${new Date().getFullYear()} Your Organization Name. All rights reserved.
                  </div>
              </div>
          </body>
          </html>
        `;

        // --- Puppeteer PDF Generation ---
        const browser = await puppeteer.launch({
          headless: true, // true for old headless, 'new' for new headless mode
          // NO executablePath or args from @sparticuz/chromium here
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
          ],
        });
        const page = await browser.newPage();

        await page.setContent(hallTicketHtml, {
          waitUntil: 'networkidle0',
        });

        const pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: {
            top: '20mm',
            right: '20mm',
            bottom: '20mm',
            left: '20mm',
          },
        });

        await browser.close();

        return new NextResponse(pdfBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="hallticket_${orderId}.pdf"`,
          },
        });

      } catch (error: any) {
        console.error('Error generating hall ticket PDF:', error);
        return new NextResponse(JSON.stringify({ success: false, message: 'Failed to generate hall ticket PDF due to a server error. Please try again later.' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }
    