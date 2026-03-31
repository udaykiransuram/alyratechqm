import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

export const QUESTION_IMPORT_TEMPLATE_VERSION = "1";

export function buildQuestionImportTemplateDocx() {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            heading: HeadingLevel.TITLE,
            children: [
              new TextRun("Teacher Master Import Template"),
            ],
            alignment: AlignmentType.LEFT,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Fill in the values and content under each label. Keep the labels and the End lines so the importer can read the file correctly.",
                bold: true,
              }),
            ],
          }),
          new Paragraph("Template Version: 1"),
          new Paragraph(""),
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            text: "Paper Metadata",
          }),
          new Paragraph("Paper Title: Sample Mathematics Assessment"),
          new Paragraph("Class: Class 7"),
          new Paragraph("Duration (minutes): 60"),
          new Paragraph("Passing Marks: 24"),
          new Paragraph("Exam Date: 2026-04-15"),
          new Paragraph("Academic Sections:"),
          new Paragraph("Paper Instructions:"),
          new Paragraph(
            "Students must attempt all questions. Use rough work where needed.",
          ),
          new Paragraph("End Paper Instructions"),
          new Paragraph(""),
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            text: "Paper Section",
          }),
          new Paragraph("Section: Section A"),
          new Paragraph("Section Subject: Mathematics"),
          new Paragraph("Section Default Marks: 1"),
          new Paragraph("Section Default Negative Marks: 0"),
          new Paragraph("Section Description:"),
          new Paragraph("Objective questions covering number sense and operations."),
          new Paragraph("End Section Description"),
          new Paragraph("Section Instructions:"),
          new Paragraph("Choose the best answer for each question."),
          new Paragraph("End Section Instructions"),
          new Paragraph(""),
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            text: "Question Block",
          }),
          new Paragraph("Question 1"),
          new Paragraph("Type: single"),
          new Paragraph("Subject: Mathematics"),
          new Paragraph("Marks: 1"),
          new Paragraph("Negative Marks: 0"),
          new Paragraph("Difficulty: easy"),
          new Paragraph("Topic: Whole Numbers"),
          new Paragraph("Template ID: temp_successor_v1"),
          new Paragraph(
            "Tags: competency=understand | chapter-name=Integers",
          ),
          new Paragraph("Stem:"),
          new Paragraph("Compute \\( -7 + (-5) \\)."),
          new Paragraph(
            "You may also paste Mathpix-style display math like \\[ \\frac{1}{2} + \\frac{1}{4} \\].",
          ),
          new Paragraph("End Stem"),
          new Paragraph("Option A:"),
          new Paragraph("\\( -12 \\)"),
          new Paragraph("End Option A"),
          new Paragraph("Option B:"),
          new Paragraph("\\( 12 \\)"),
          new Paragraph("End Option B"),
          new Paragraph("Option C:"),
          new Paragraph("\\( -2 \\)"),
          new Paragraph("End Option C"),
          new Paragraph("Option D:"),
          new Paragraph("\\( 2 \\)"),
          new Paragraph("End Option D"),
          new Paragraph("Correct Answer: A"),
          new Paragraph("Explanation:"),
          new Paragraph("The sum of two negative integers remains negative."),
          new Paragraph("End Explanation"),
          new Paragraph("End Question"),
          new Paragraph(""),
          new Paragraph("End Section"),
          new Paragraph(""),
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            text: "Authoring Rules",
          }),
          new Paragraph("1. Keep the labels and the End lines exactly as shown."),
          new Paragraph("2. Use one question block per question and one section block per paper section."),
          new Paragraph("3. Put images directly inside Stem, Option, or Explanation blocks."),
          new Paragraph("4. Supported question types in this version: single, multiple, descriptive."),
          new Paragraph("5. Academic Sections is optional. Leave it blank unless you want to assign the paper to specific school sections."),
          new Paragraph("6. DOCX is the only supported upload format in this version."),
        ],
      },
    ],
  });

  return Packer.toBuffer(doc);
}
