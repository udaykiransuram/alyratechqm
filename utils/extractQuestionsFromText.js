function extractQuestionsFromText(text) {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  const questions = [];
  let current = null;
  let options = [];
  let answerIndexes = [];
  let explanation = undefined;

  lines.forEach(line => {
    // Match question formats
    const questionMatch = line.match(
      /^(?:Question\s*\d+\s*[:\-]|Q\d+[.:)]|^\d+[.)]?)\s*(.*)/i
    );
    if (questionMatch) {
      if (current && options.length > 0) {
        questions.push({
          content: current,
          options: options.map(o => ({ content: o })),
          type: 'single',
          answerIndexes,
          explanation,
          marks: 1,
        });
      }
      current = questionMatch[1].trim();
      options = [];      function extractQuestionsFromText(text) {
        const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
        const questions = [];
        let current = null;
        let options = [];
        let answerIndexes = [];
        let explanation = undefined;
      
        lines.forEach(line => {
          // Match question formats
          const questionMatch = line.match(
            /^(?:Question\s*\d+\s*[:\-]|Q\d+[.:)]|^\d+[.)]?)\s*(.*)/i
          );
          if (questionMatch) {
            if (current && options.length > 0) {
              questions.push({
                content: current,
                options: options.map(o => ({ content: o })),
                type: 'single',
                answerIndexes,
                explanation,
                marks: 1,
              });
            }
            current = questionMatch[1].trim();
            options = [];
            answerIndexes = [];
            explanation = undefined;
            return;
          }
      
          // Match option formats
          const optionMatch = line.match(
            /^(?:\(([A-D1-4])\)|([A-D1-4])[.)]|([A-D1-4])\s*[-:])\s*(.*)/i
          );
          if (optionMatch) {
            // optionMatch[1] for (A), optionMatch[2] for A., optionMatch[3] for A-
            options.push(optionMatch[4].trim());
            return;
          }
      
          // Match answer formats
          const answerMatch = line.match(
            /^(?:Answer|Ans|Correct Answer)\s*[:\-]?\s*([A-D1-4])/i
          );
          if (answerMatch) {
            const val = answerMatch[1].toUpperCase();
            const idx = isNaN(val) ? 'ABCD'.indexOf(val) : parseInt(val, 10) - 1;
            if (idx >= 0) answerIndexes = [idx];
            return;
          }
      
          // Match explanation formats
          const explanationMatch = line.match(/^(?:Explanation|Exp)\s*[:\-]?\s*(.*)/i);
          if (explanationMatch) {
            explanation = explanationMatch[1].trim();
            return;
          }
          // Ignore other lines
        });
      
        // Push last question if exists
        if (current && options.length > 0) {
          questions.push({
            content: current,
            options: options.map(o => ({ content: o })),
            type: 'single',
            answerIndexes,
            explanation,
            marks: 1,
          });
        }
      
        return questions;
      }
      
      module.exports = { extractQuestionsFromText };
      answerIndexes = [];
      explanation = undefined;
      return;
    }

    // Match option formats
    const optionMatch = line.match(
      /^(?:\(([A-D1-4])\)|([A-D1-4])[.)]|([A-D1-4])\s*[-:])\s*(.*)/i
    );
    if (optionMatch) {
      // optionMatch[1] for (A), optionMatch[2] for A., optionMatch[3] for A-
      options.push(optionMatch[4].trim());
      return;
    }

    // Match answer formats
    const answerMatch = line.match(
      /^(?:Answer|Ans|Correct Answer)\s*[:\-]?\s*([A-D1-4])/i
    );
    if (answerMatch) {
      const val = answerMatch[1].toUpperCase();
      const idx = isNaN(val) ? 'ABCD'.indexOf(val) : parseInt(val, 10) - 1;
      if (idx >= 0) answerIndexes = [idx];
      return;
    }

    // Match explanation formats
    const explanationMatch = line.match(/^(?:Explanation|Exp)\s*[:\-]?\s*(.*)/i);
    if (explanationMatch) {
      explanation = explanationMatch[1].trim();
      return;
    }
    // Ignore other lines
  });

  // Push last question if exists
  if (current && options.length > 0) {
    questions.push({
      content: current,
      options: options.map(o => ({ content: o })),
      type: 'single',
      answerIndexes,
      explanation,
      marks: 1,
    });
  }

  return questions;
}

module.exports = { extractQuestionsFromText };
