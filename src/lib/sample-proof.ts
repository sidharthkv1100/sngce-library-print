// Generates realistic mock UPI payment screenshots as SVG Data URLs for seed/test data

export function generateSampleUpiReceipt(
  studentName: string,
  amount: number,
  utr: string,
  appName: 'Google Pay' | 'PhonePe' | 'Paytm' = 'Google Pay'
): string {
  const dateStr = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const appColor = appName === 'PhonePe' ? '#5f259f' : appName === 'Paytm' ? '#00b9f5' : '#1a73e8';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 560" width="380" height="560">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="100%" stop-color="#f8fafc"/>
      </linearGradient>
      <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
        <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000000" flood-opacity="0.1"/>
      </filter>
    </defs>
    
    <!-- Background Card -->
    <rect width="380" height="560" fill="url(#bg)" rx="16"/>
    
    <!-- Header -->
    <rect width="380" height="70" fill="${appColor}" rx="16"/>
    <rect y="50" width="380" height="20" fill="${appColor}"/>
    <text x="190" y="42" fill="#ffffff" font-family="system-ui, sans-serif" font-size="18" font-weight="700" text-anchor="middle">
      ${appName}
    </text>
    
    <!-- Success Icon Circle -->
    <circle cx="190" cy="115" r="32" fill="#10b981" filter="url(#shadow)"/>
    <path d="M178 115 L186 123 L203 106" stroke="#ffffff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>

    <!-- Amount and Status -->
    <text x="190" y="172" fill="#0f172a" font-family="system-ui, sans-serif" font-size="28" font-weight="800" text-anchor="middle">
      ₹${amount.toFixed(2)}
    </text>
    <text x="190" y="194" fill="#059669" font-family="system-ui, sans-serif" font-size="13" font-weight="600" text-anchor="middle">
      Paid Successfully
    </text>
    <text x="190" y="214" fill="#64748b" font-family="system-ui, sans-serif" font-size="11" text-anchor="middle">
      ${dateStr}
    </text>

    <!-- Divider -->
    <line x1="25" y1="235" x2="355" y2="235" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="4"/>

    <!-- Transaction Details Card -->
    <rect x="24" y="250" width="332" height="225" fill="#ffffff" stroke="#e2e8f0" rx="10"/>

    <!-- Paid To -->
    <text x="40" y="278" fill="#64748b" font-family="system-ui, sans-serif" font-size="11">PAID TO</text>
    <text x="40" y="298" fill="#0f172a" font-family="system-ui, sans-serif" font-size="14" font-weight="700">
      SNGCE Central Library
    </text>
    <text x="40" y="315" fill="#64748b" font-family="system-ui, sans-serif" font-size="11">
      sngce.library@upi
    </text>

    <line x1="40" y1="330" x2="340" y2="330" stroke="#f1f5f9" stroke-width="1"/>

    <!-- From Student -->
    <text x="40" y="352" fill="#64748b" font-family="system-ui, sans-serif" font-size="11">FROM STUDENT</text>
    <text x="40" y="372" fill="#0f172a" font-family="system-ui, sans-serif" font-size="13" font-weight="600">
      ${studentName}
    </text>

    <line x1="40" y1="388" x2="340" y2="388" stroke="#f1f5f9" stroke-width="1"/>

    <!-- UPI Ref / UTR -->
    <text x="40" y="410" fill="#64748b" font-family="system-ui, sans-serif" font-size="11">UPI TRANSACTION ID / UTR</text>
    <text x="40" y="432" fill="#1e293b" font-family="system-ui, monospace" font-size="14" font-weight="700" letter-spacing="1">
      ${utr}
    </text>
    <text x="40" y="454" fill="#059669" font-family="system-ui, sans-serif" font-size="10" font-weight="600">
      Verified 12-Digit Reference
    </text>

    <!-- Footer Note -->
    <rect x="24" y="490" width="332" height="42" fill="#f8fafc" stroke="#e2e8f0" rx="8"/>
    <text x="190" y="515" fill="#64748b" font-family="system-ui, sans-serif" font-size="11" text-anchor="middle">
      Print Queue Payment Counter • SNGCE Kadayiruppu
    </text>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
