import React from "react";

const LABELS = {
  expired: "Expired",
  urgent: "14 Days",
  due_soon: "30 Days",
  upcoming: "60 Days",
  active: "Active",
};

export default function StatusBadge({ status }) {
  return (
    <span className={`status-badge status-${status}`}>
      {LABELS[status] || status}
    </span>
  );
}
