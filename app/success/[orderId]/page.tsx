export const dynamic = 'force-dynamic';
import { cookies } from 'next/headers';
import { connectDB } from '@/lib/db';
import { getTenantDb } from '@/lib/db-tenant';
import '@/models/Registration';

export default async function SuccessPage({ params }: any) {
  await connectDB();
  const schoolKey = cookies().get('schoolKey')?.value || '';
  if (!schoolKey) return <div>Select a school first.</div>;
  const conn = await getTenantDb(schoolKey);
  const RegistrationModel = conn.model('Registration');
  const registration = await RegistrationModel.findOne({ orderId: params.orderId });

  if (!registration) return <div>Invalid Order ID</div>;

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">Registration Successful</h1>
      <p>Thank you, {registration.studentName}!</p>
      <p>Your payment was received. We’ll contact you at {registration.phone}.</p>
      <a
        href={`/api/hallticket/${registration.orderId}`}
        className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        download
      >
        Download Hall Ticket PDF
      </a>
    </div>
  );
}