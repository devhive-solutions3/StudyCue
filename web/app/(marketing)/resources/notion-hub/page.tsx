import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata={title:'Notion-compatible outline'};

export default function NotionStarter(){
 redirect('/features');
}
