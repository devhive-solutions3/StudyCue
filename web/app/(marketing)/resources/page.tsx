import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { canonical } from '@/lib/site-config';

export const metadata: Metadata={
 title:'Downloads & templates',
 alternates:{ canonical:canonical('/resources')},
};

export default function ResourcesIndex(){
 redirect('/features');
}
