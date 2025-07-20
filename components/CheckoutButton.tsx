'use client';

import { useEffect, useState } from 'react';
import { load } from '@cashfreepayments/cashfree-js';

export default function CheckoutButton({ paymentSessionId }: { paymentSessionId: string }) {
  const [cashfree, setCashfree] = useState<any>(null);

  useEffect(() => {
    const init = async () => {
      const cf = await load({
        mode: process.env.NEXT_PUBLIC_CASHFREE_ENV || 'sandbox',
      });
      setCashfree(cf);
    };
    init();
  }, []);

  const doPayment = () => {
    if (!cashfree) {
      alert('Cashfree SDK not loaded yet');
      return;
    }

    cashfree.checkout({
      paymentSessionId,
      redirectTarget: '_self',
    });
  };

  return (
    <div className="my-4">
      <p>Click below to pay with UPI, cards, or netbanking</p>
      <button onClick={doPayment} className="px-4 py-2 bg-blue-600 text-white rounded">
        Pay Now
      </button>
    </div>
  );
}
