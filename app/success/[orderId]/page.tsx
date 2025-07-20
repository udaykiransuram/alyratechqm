import { connectDB } from '@/lib/db';
import Registration from '@/models/Registration';

export default async function SuccessPage({ params }: any) {
  await connectDB();
  const registration = await Registration.findOne({ orderId: params.orderId });

  if (!registration) return <div>Invalid Order ID</div>;

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-4">Registration Successful</h1>
      <p>Thank you, {registration.name}!</p>
      <p>Your payment was received. We’ll contact you at {registration.email}.</p>
    </div>
  );
}