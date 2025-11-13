import { NextResponse } from 'next/server';
import { format } from 'date-fns';
import CryptoJS from 'crypto-js';
import { db } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

const AGENT_MAP: { [key: string]: string } = {
  '101': 'Aylen', '104': 'Alanis', '105': 'Marisol', '107': 'Lisset',
  '108': 'Wendy', '110': 'Avril', '111': 'Luz', '113': 'Fiorela',
  '114': 'Eduardo', '115': 'Daiana', '116': 'Noemi',
};

export async function GET(req: Request) {
  return NextResponse.json({ status: 'ok', message: 'En construcción' });
}
