"use client";

import { useState } from "react";
import { formatGhs } from "@/lib/format";
import type { PaymentStatus } from "@/types/database";

export type DashboardOrderRow = {
  id: string;
  buyer_name: string;
  buyer_phone: string;
  qty: number;
  amount_pesewas: number;
  payment_status: PaymentStatus;
  created_at: string;
};

const PAYMENT_BADGE: Record<PaymentStatus, string> = {
  paid: "bg-teal-50 text-teal-800",
  pending: "bg-amber-50 text-amber-800",
  failed: "bg-red-50 text-red-700",
};

export function OrdersTable({ orders }: { orders: DashboardOrderRow[] }) {
  const [remindedIds, setRemindedIds] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);

  function handleSendReminder(order: DashboardOrderRow) {
    // Placeholder action: intentionally does not send SMS yet.
    setRemindedIds((prev) => new Set(prev).add(order.id));
    setNotice(
      `Payment reminder prepared for ${order.buyer_name} (${order.buyer_phone}). SMS sending is not enabled yet.`
    );
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center">
        <p className="text-sm font-medium text-gray-900">No orders yet</p>
        <p className="mt-1 text-xs text-gray-500">
          Share your listing link in WhatsApp to start receiving reservations.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {notice && (
        <div className="flex items-start justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="shrink-0 font-semibold text-amber-800 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-3 py-2.5 font-semibold">Buyer</th>
              <th className="px-3 py-2.5 font-semibold">Phone</th>
              <th className="px-3 py-2.5 text-right font-semibold">Qty</th>
              <th className="px-3 py-2.5 text-right font-semibold">Amount</th>
              <th className="px-3 py-2.5 font-semibold">Status</th>
              <th className="px-3 py-2.5 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.map((order) => {
              const isReminded = remindedIds.has(order.id);
              return (
                <tr key={order.id} className="align-middle">
                  <td className="whitespace-nowrap px-3 py-3 font-medium text-gray-900">
                    {order.buyer_name}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 font-mono text-gray-700">
                    <a
                      href={`tel:${order.buyer_phone}`}
                      className="hover:text-teal-700 hover:underline"
                    >
                      {order.buyer_phone}
                    </a>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-medium text-gray-900">
                    {order.qty}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-gray-900">
                    {formatGhs(order.amount_pesewas)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${PAYMENT_BADGE[order.payment_status]}`}
                    >
                      {order.payment_status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">
                    {order.payment_status === "pending" ? (
                      <button
                        type="button"
                        onClick={() => handleSendReminder(order)}
                        className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-100"
                      >
                        {isReminded ? "Reminder queued" : "Send payment reminder"}
                      </button>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
