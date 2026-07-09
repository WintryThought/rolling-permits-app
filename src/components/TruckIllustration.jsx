import React from "react";

export default function TruckIllustration({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 200 120"
      fill="none"
      stroke="#241f18"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 85h150v-8a6 6 0 00-6-6h-24l-10-22a6 6 0 00-5.5-3.5H70a6 6 0 00-6 5v6" />
      <path d="M10 85V50a4 4 0 014-4h56v39" />
      <rect x="70" y="46" width="30" height="20" rx="2" />
      <path d="M76 50h18" />
      <path d="M160 71h20v14a6 6 0 01-6 6h-14z" fill="#b8412a" stroke="#b8412a" />
      <circle cx="38" cy="93" r="10" />
      <circle cx="38" cy="93" r="3.5" fill="#241f18" />
      <circle cx="140" cy="93" r="10" />
      <circle cx="140" cy="93" r="3.5" fill="#241f18" />
      <path d="M4 62h6M4 68h6M4 74h6" stroke="#c1811f" strokeWidth="2" />
    </svg>
  );
}
