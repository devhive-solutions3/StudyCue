import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata={title:'Exam checklist PDF (plain text MVP)'};

export default function ExamChecklist(){
 redirect('/features');
}
