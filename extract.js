const express = require('express');
const bodyParser = require('body-parser');
const { extractQuestionsFromText } = require('./utils/extractQuestionsFromText');
const PDFExtract = require('pdf.js-extract').PDFExtract;

const app = express();
const PORT = 5000;

app.use(bodyParser.raw({ type: 'application/pdf', limit: '50mb' }));

app.post('/extract', async (req, res) => {
  try {
    const buffer = req.body;
    if (!buffer || !Buffer.isBuffer(buffer)) {
      return res.status(400).json({ error: 'No PDF buffer received' });
    }

    const pdfExtract = new PDFExtract();
    const options = {}; // default options

    // Extract text from PDF buffer
    pdfExtract.extractBuffer(buffer, options, (err, data) => {
      if (err) {
        console.error('[extract] Error:', err);
        return res.status(500).json({ error: 'Failed to extract PDF', details: err.message });
      }

      // Concatenate all text from all pages
      const fullText = data.pages
        .map(page => page.content.map(item => item.str).join('\n'))
        .join('\n');

     // console.log('Extracted PDF text:\n', fullText);

      const questionsRaw = extractQuestionsFromText(fullText);

      const classId = req.headers['x-class-id'] || null;
      const subjectId = req.headers['x-subject-id'] || null;

      const questions = questionsRaw.map(q => ({
        subject: subjectId,
        class: classId,
        content: q.content,
        type: q.type || 'single',
        options: q.options || [],
        answerIndexes: q.answerIndexes || [],
        explanation: q.explanation || '',
        marks: q.marks || 1,
      }));

      res.json({ questions });
    });

  } catch (err) {
    console.error('[extract] Error:', err);
    res.status(500).json({ error: 'Failed to extract PDF', details: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`PDF extraction service running on http://localhost:${PORT}/extract`);
});