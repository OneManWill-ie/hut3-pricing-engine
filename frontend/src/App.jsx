import { useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const gbp = (pence) => `£${(pence / 100).toFixed(2)}`;

export default function App() {
  const [cart, setCart] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [pricing, setPricing] = useState(null);
  const [couponCode, setCouponCode] = useState('');
  const [error, setError] = useState(null);

  const loadCart = () =>
    fetch(`${API_URL}/api/cart`)
      .then((r) => r.json())
      .then((items) => {
        setCart(items);
        setQuantities(Object.fromEntries(items.map((item) => [item.id, item.quantity])));
      })
      .catch(() => setError('Could not reach the API'));

  const loadPricing = (code = '') => {
    fetch(`${API_URL}/api/price`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coupon_code: code || undefined }),
    })
      .then((r) => r.json())
      .then(setPricing)
      .catch(() => setError('Could not reach the API'));
  };

  useEffect(() => {
    loadCart();
    loadPricing();
  }, []);

  const applyCoupon = (e) => {
    e.preventDefault();
    loadPricing(couponCode);
  };

  const removeItem = async (id) => {
    await fetch(`${API_URL}/api/cart/${id}`, { method: 'DELETE' });
    loadCart();
    loadPricing(couponCode);
  };

  const updateItem = async (id) => {
    const response = await fetch(`${API_URL}/api/cart/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: quantities[id] }),
    });

    if (!response.ok) {
      const result = await response.json();
      setError(result.error || 'Could not update the cart');
      return;
    }

    loadCart();
    loadPricing(couponCode);
  };

  if (error) return <p style={{ fontFamily: 'sans-serif', color: 'crimson' }}>{error}</p>;

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: 480, margin: '2rem auto' }}>
      <h1>Cart</h1>

      {cart.length === 0 && <p>Your cart is empty.</p>}

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {cart.map((item) => (
          <li
            key={item.id}
            style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}
          >
            <span>
              {item.name} ({gbp(item.unit_price_pence)} each)
            </span>
            <span>
              <input
                type="number"
                min="1"
                step="1"
                value={quantities[item.id] ?? item.quantity}
                onChange={(e) =>
                  setQuantities({ ...quantities, [item.id]: Number(e.target.value) })
                }
                aria-label={`Quantity for ${item.name}`}
                style={{ width: '3rem' }}
              />{' '}
              <button onClick={() => updateItem(item.id)}>Update</button>{' '}
              {gbp(item.unit_price_pence * (quantities[item.id] ?? item.quantity))}{' '}
              <button onClick={() => removeItem(item.id)}>remove</button>
            </span>
          </li>
        ))}
      </ul>

      <form onSubmit={applyCoupon} style={{ margin: '1rem 0' }}>
        <input
          placeholder="Coupon code"
          value={couponCode}
          onChange={(e) => setCouponCode(e.target.value)}
        />
        <button type="submit">Apply</button>
      </form>

      {pricing && (
        <div>
          <h2>Breakdown</h2>
          <p>Subtotal: {gbp(pricing.subtotal_pence)}</p>

          {pricing.discounts.length === 0 && <p>No discounts applied.</p>}
          <ul>
            {pricing.discounts.map((d, i) => (
              <li key={i}>
                {d.description}: -{gbp(d.amount_pence)}
              </li>
            ))}
          </ul>

          {pricing.coupon_error && <p style={{ color: 'crimson' }}>{pricing.coupon_error}</p>}

          <h3>Total: {gbp(pricing.total_pence)}</h3>
        </div>
      )}
    </div>
  );
}
