'use client';

import { QuestionItem } from '@/components/question-items';

export default function QuestionItemClient(props: React.ComponentProps<typeof QuestionItem>) {
  return <QuestionItem {...props} />;
}