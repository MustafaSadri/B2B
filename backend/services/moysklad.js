const fetch = require('node-fetch');

const MS_BASE = 'https://api.moysklad.ru/api/remap/1.2';
const TOKEN = () => process.env.MOYSKLAD_API_TOKEN;

const msHeaders = () => ({
  Authorization: 'Bearer ' + TOKEN(),
  Accept: 'application/json;charset=utf-8',
  'Content-Type': 'application/json',
});

// In-memory cache
const cache = new Map();
const cached = async (key, ttlMs, fn) => {
  const now = Date.now();
  if (cache.has(key)) {
    const { data, expiresAt } = cache.get(key);
    if (now < expiresAt) return data;
  }
  const data = await fn();
  cache.set(key, { data, expiresAt: now + ttlMs });
  return data;
};

const clearCache = (key) => {
  if (key) cache.delete(key);
  else cache.clear();
};

// Single request with retry + exponential backoff
const ms = async (path, options = {}, _retries = 3) => {
  for (let attempt = 0; attempt <= _retries; attempt++) {
    const r = await fetch(MS_BASE + path, {
      headers: msHeaders(),
      ...options,
    });

    if (r.status === 429 && attempt < _retries) {
      await new Promise((res) => setTimeout(res, Math.pow(2, attempt) * 1000));
      continue;
    }
    if (!r.ok) {
      const errText = await r.text().catch(() => '');
      throw new Error(`MS API ${r.status} ${path}: ${errText}`);
    }
    return r.json();
  }
};

// Auto-paginate (handles >1000 records)
const msAll = async (endpoint, maxRecords = 10000) => {
  const sep = endpoint.includes('?') ? '&' : '?';
  const first = await ms(`${endpoint}${sep}limit=1000&offset=0`);
  const total = first.meta?.size || 0;
  let rows = first.rows || [];

  if (total > 1000) {
    const pages = [];
    for (let offset = 1000; offset < Math.min(total, maxRecords); offset += 1000) {
      pages.push(ms(`${endpoint}${sep}limit=1000&offset=${offset}`));
    }
    const settled = await Promise.allSettled(pages);
    settled.forEach((r) => {
      if (r.status === 'fulfilled') rows = rows.concat(r.value.rows || []);
    });
  }
  return { rows, total };
};

// ─── Products ─────────────────────────────────────────────────────────────────

const getProducts = () =>
  cached('products_all', 15 * 60 * 1000, async () => {
    const { rows } = await msAll('/entity/product');
    return rows;
  });

const getProductGroups = () =>
  cached('product_groups', 30 * 60 * 1000, async () => {
    const { rows } = await msAll('/entity/productfolder');
    return rows;
  });

const getAssortment = () =>
  cached('assortment_all', 30 * 60 * 1000, async () => {
    const { rows } = await msAll('/entity/assortment');
    return rows;
  });

// Build href -> name map (for resolving product names in positions)
const getNameMap = async () => {
  const rows = await getAssortment();
  const map = {};
  rows.forEach((a) => {
    if (a.meta?.href && a.name) map[a.meta.href] = a.name;
  });
  return map;
};

// ─── Stock ────────────────────────────────────────────────────────────────────

const getStock = () =>
  cached('stock_all', 3 * 60 * 1000, () =>
    ms('/report/stock/all?limit=1000').then((r) => r.rows || [])
  );

// ─── Price Types ──────────────────────────────────────────────────────────────

const getPriceTypes = () =>
  cached('price_types', 30 * 60 * 1000, async () => {
    const r = await ms('/context/companysettings/pricetype');
    return r.rows || r || [];
  });

// ─── Orders ───────────────────────────────────────────────────────────────────

const getOrderById = (msOrderId) =>
  ms(`/entity/customerorder/${msOrderId}?expand=state`);

// Map MoySklad state name → our internal status
const mapMsStateToStatus = (stateName) => {
  if (!stateName || /черновик|draft/i.test(stateName)) return 'confirmed';
  if (/отмен|cancel|аннул|отклон/i.test(stateName)) return 'cancelled';
  // "ready" must be checked BEFORE "dispatch" — "Ready to Dispatch" contains both words
  if (/готов|ready/i.test(stateName)) return 'readyToDispatch';
  if (/отгруж|dispatched/i.test(stateName)) return 'dispatched';
  return 'processing';
};

const getAllOrders = () =>
  cached('orders_all_v3', 2 * 60 * 1000, () =>
    ms('/entity/customerorder?limit=1000&order=moment,desc&expand=state').then((r) => r.rows || [])
  );

const getOrderStateMap = () =>
  cached('order_state_map', 15 * 60 * 1000, async () => {
    const meta = await ms('/entity/customerorder/metadata');
    const statesArr = Array.isArray(meta.states) ? meta.states : meta.states?.rows || [];
    const stateMap = {};
    statesArr.forEach((s) => {
      if (s.id && s.name) stateMap[s.id] = s.name;
    });
    return stateMap;
  });

const resolveState = (order, stateMap) => {
  if (!order.state) return '';
  if (order.state.name) return order.state.name;
  const id = (order.state.meta?.href || '').split('/').pop().split('?')[0];
  return stateMap[id] || '';
};

// Auto-fetch the first organization from MoySklad
const getOrganization = () =>
  cached('org_first', 60 * 60 * 1000, async () => {
    const r = await ms('/entity/organization?limit=1');
    return r.rows?.[0] || null;
  });

const getWarehouseByName = (name) =>
  cached(`warehouse_${name.toLowerCase()}`, 60 * 60 * 1000, async () => {
    const { rows } = await msAll('/entity/store');
    const needle = name.toLowerCase().replace(/\s+/g, '');
    return rows.find((w) => (w.name || '').toLowerCase().replace(/\s+/g, '') === needle)
      || rows.find((w) => (w.name || '').toLowerCase().replace(/\s+/g, '').includes(needle))
      || null;
  });

const buildOrderDescription = ({ notes, shippingAddress, customer }) => {
  const lines = [];
  if (shippingAddress) lines.push(`Shipping address: ${shippingAddress}`);
  if (notes) lines.push(`Special instructions: ${notes}`);
  if (customer?.phone) lines.push(`Phone: ${customer.phone}`);
  if (customer?.email) lines.push(`Email: ${customer.email}`);
  return lines.join('\n');
};

// Create order in MoySklad
const createMoyskladOrder = async (orderData) => {
  const { customer, items, notes, shippingAddress } = orderData;

  const org = await getOrganization();
  if (!org) throw new Error('No MoySklad organization found.');

  let agentHref = customer.moyskladCounterpartyId
    ? `${MS_BASE}/entity/counterparty/${customer.moyskladCounterpartyId}`
    : null;

  if (!agentHref) {
    const counterparty = await createCounterparty(customer);
    if (!counterparty?.id) throw new Error('Could not create MoySklad counterparty for customer.');
    agentHref = counterparty.meta?.href || `${MS_BASE}/entity/counterparty/${counterparty.id}`;
    if (typeof customer.updateOne === 'function') {
      await customer.updateOne({ moyskladCounterpartyId: counterparty.id });
    }
  }

  const warehouseName = process.env.MOYSKLAD_DEFAULT_WAREHOUSE || 'yuzhnie Vorota';
  const warehouse = await getWarehouseByName(warehouseName);

  const positions = items
    .filter((item) => item.moyskladProductId || item.moyskladHref)
    .map((item) => ({
      quantity: item.quantity,
      price: Math.round(item.unitPrice * 100),
      discount: item.discount || 0,
      assortment: {
        meta: {
          href: item.moyskladHref || `${MS_BASE}/entity/${item.moyskladType || 'product'}/${item.moyskladProductId}`,
          type: item.moyskladType || (item.moyskladHref?.includes('/entity/variant/') ? 'variant' : 'product'),
          mediaType: 'application/json',
        },
      },
    }));

  const payload = {
    organization: { meta: { href: org.meta.href, type: 'organization', mediaType: 'application/json' } },
    agent: { meta: { href: agentHref, type: 'counterparty', mediaType: 'application/json' } },
    applicable: false,
    positions,
    description: buildOrderDescription({ notes, shippingAddress, customer }),
  };

  // Assign order owner to the sales rep's MoySklad employee
  const { salesRep } = orderData;
  if (salesRep?.moyskladEmployeeId) {
    payload.owner = {
      meta: {
        href: `${MS_BASE}/entity/employee/${salesRep.moyskladEmployeeId}`,
        type: 'employee',
        mediaType: 'application/json',
      },
    };
  }

  if (shippingAddress) payload.shipmentAddress = shippingAddress;
  if (warehouse?.meta?.href) {
    payload.store = {
      meta: { href: warehouse.meta.href, type: 'store', mediaType: 'application/json' },
    };
  }

  return ms('/entity/customerorder', { method: 'POST', body: JSON.stringify(payload) });
};

// ─── Employees ────────────────────────────────────────────────────────────────

const getEmployees = () =>
  cached('employees_all', 15 * 60 * 1000, async () => {
    const { rows } = await msAll('/entity/employee');
    return rows;
  });

const getEmployeeMap = async () => {
  const employees = await getEmployees();
  const map = {};
  employees.forEach((e) => {
    const id = (e.meta?.href || '').split('/').pop().split('?')[0];
    if (id) map[id] = e.name || e.shortFio || 'Unknown';
  });
  return map;
};

// ─── Counterparties (Customers) ───────────────────────────────────────────────

const getCounterparties = () =>
  cached('counterparties_all', 5 * 60 * 1000, async () => {
    const { rows } = await msAll('/entity/counterparty');
    return rows;
  });

const createCounterparty = async (customerData) => {
  const { name, phone, email, companyName } = customerData;
  const payload = {
    name: companyName || name,
    phone,
    email,
    companyType: 'legal',
  };
  return ms('/entity/counterparty', { method: 'POST', body: JSON.stringify(payload) });
};

// ─── Profit Reports ───────────────────────────────────────────────────────────

const getProfitByProduct = (momentFrom, momentTo, limit = 10) => {
  const enc = encodeURIComponent;
  const from = momentFrom || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01 00:00:00`;
  const to = momentTo || new Date().toISOString().slice(0, 10).replace('T', ' ') + ' 23:59:59';
  const key = `profit_product_${from}_${to}`;
  return cached(key, 5 * 60 * 1000, () =>
    ms(
      `/report/profit/byproduct?momentFrom=${enc(from)}&momentTo=${enc(to)}&limit=${limit}`
    ).then((r) => r.rows || [])
  );
};

const getProfitByCounterparty = (momentFrom, momentTo, limit = 10) => {
  const enc = encodeURIComponent;
  const from = momentFrom || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01 00:00:00`;
  const to = momentTo || new Date().toISOString().slice(0, 10).replace('T', ' ') + ' 23:59:59';
  const key = `profit_counterparty_${from}_${to}`;
  return cached(key, 5 * 60 * 1000, () =>
    ms(
      `/report/profit/bycounterparty?momentFrom=${enc(from)}&momentTo=${enc(to)}&limit=${limit}`
    ).then((r) => r.rows || [])
  );
};

// ─── Demands (Shipments) ──────────────────────────────────────────────────────

const getRecentDemands = () =>
  cached('demands_200', 90 * 1000, () =>
    ms('/entity/demand?limit=200&order=moment,desc').then((r) => r.rows || [])
  );

module.exports = {
  ms,
  msAll,
  cached,
  clearCache,
  getProducts,
  getOrderById,
  mapMsStateToStatus,
  getProductGroups,
  getAssortment,
  getNameMap,
  getStock,
  getPriceTypes,
  getAllOrders,
  getOrderStateMap,
  resolveState,
  createMoyskladOrder,
  getEmployees,
  getEmployeeMap,
  getCounterparties,
  createCounterparty,
  getProfitByProduct,
  getProfitByCounterparty,
  getRecentDemands,
  MS_BASE,
};
