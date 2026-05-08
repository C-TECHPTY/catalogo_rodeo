const carts = new Map();
const cartCustomers = new Map();

function addItem(sender, product, quantity) {
  const key = String(sender || '');
  const itemCode = String(product.item || product.item_code || '').trim();
  const qty = Math.max(1, Number(quantity || 1));
  const cart = carts.get(key) || [];
  const existing = cart.find((item) => item.itemCode.toUpperCase() === itemCode.toUpperCase());

  if (existing) {
    existing.quantity += qty;
  } else {
    cart.push({
      itemCode,
      description: String(product.description || product.shortDescription || product.name || '').trim(),
      price: String(product.price || product.unit_price || '').trim(),
      unitPrice: parseMoney(product.price || product.unit_price || product.regular_price || 0),
      quantity: qty,
    });
  }

  carts.set(key, cart);
  return cart;
}

function getCart(sender) {
  return carts.get(String(sender || '')) || [];
}

function clearCart(sender) {
  carts.delete(String(sender || ''));
  cartCustomers.delete(String(sender || ''));
}

function setCustomerField(sender, field, value) {
  const key = String(sender || '');
  const customer = cartCustomers.get(key) || {};
  customer[field] = String(value || '').trim();
  cartCustomers.set(key, customer);
  return customer;
}

function getCustomer(sender) {
  return cartCustomers.get(String(sender || '')) || {};
}

function cartTotals(sender) {
  const cart = getCart(sender);
  return {
    lines: cart.length,
    totalQuantity: cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
    subtotal: cart.reduce((sum, item) => sum + (Number(item.unitPrice || 0) * Number(item.quantity || 0)), 0),
  };
}

function parseMoney(value) {
  if (typeof value === 'number') {
    return value;
  }

  const raw = String(value || '').trim();
  if (raw === '') {
    return 0;
  }

  const cleaned = raw.replace(/[^0-9,.-]/g, '');
  if (cleaned.includes(',') && !cleaned.includes('.')) {
    return Number(cleaned.replace(',', '.')) || 0;
  }

  if (cleaned.includes(',') && cleaned.includes('.')) {
    return Number(cleaned.replace(/,/g, '')) || 0;
  }

  return Number(cleaned) || 0;
}

module.exports = {
  addItem,
  cartTotals,
  clearCart,
  getCart,
  getCustomer,
  setCustomerField,
};
