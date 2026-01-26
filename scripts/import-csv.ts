import { parse } from 'csv-parse/sync';
import { readFileSync, writeFileSync } from 'fs';

const CSV_PATH = process.argv[2];
if (!CSV_PATH) {
  console.error('Usage: bun run scripts/import-csv.ts <csv-path>');
  process.exit(1);
}

const OUTPUT_PATH = './data/faq.json';

// Read and parse CSV
const csvContent = readFileSync(CSV_PATH, 'utf-8');
const records = parse(csvContent, {
  skip_empty_lines: false,
  relax_quotes: true,
  relax_column_count: true,
});

// Skip first 4 rows (metadata + header)
const dataRows = records.slice(4);

interface FaqItem {
  id: number;
  category: string;
  question: string;
  answer: string;
}

const faqs: FaqItem[] = [];
let id = 1;

for (const row of dataRows) {
  // Columns: [empty, No, 고객사, 카테고리, 질문, 일시, 번호, 상태, 답변]
  const category = row[3]?.trim();
  const question = row[4]?.trim();
  const status = row[7]?.trim();
  const answer = row[8]?.trim();

  // Skip if missing required fields or status is not '정상'
  if (!category || !question || !answer) {
    continue;
  }

  if (status && status !== '정상') {
    continue;
  }

  faqs.push({
    id: id++,
    category,
    question,
    answer,
  });
}

console.log(`Parsed ${faqs.length} FAQs from CSV`);

// Write to faq.json
writeFileSync(OUTPUT_PATH, JSON.stringify(faqs, null, 2), 'utf-8');
console.log(`Written to ${OUTPUT_PATH}`);

// Show sample
console.log('\nSample FAQs:');
faqs.slice(0, 3).forEach((faq) => {
  console.log(`[${faq.id}] ${faq.category}: ${faq.question.slice(0, 50)}...`);
});
