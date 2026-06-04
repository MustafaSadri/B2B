import { statusColors, statusLabels } from '../../lib/api';

const OrderStatusBadge = ({ status, lang = 'ru' }) => {
  const colorClass = statusColors[status] || 'badge-gray';
  const label = statusLabels[status]?.[lang] || status;
  return <span className={colorClass}>{label}</span>;
};

export default OrderStatusBadge;
